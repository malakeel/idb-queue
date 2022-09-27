//import { map } from 'rxjs';

let db ;
let stream ;

const store_name = "commands" ;

// preparing the database
const DBOpenRequest = window.indexedDB.open("myDB", 4);
DBOpenRequest.onerror = (e) => console.log('can not create db', e)
DBOpenRequest.onupgradeneeded = (event) => {
    console.log('db needs upgrade ..');
    db = event.target.result;
    db.onerror = (e) => {
        console.error('failed to upgrade', e);
    };
    const objectStore = db.createObjectStore(store_name, { autoIncrement: true });
    // define what data items the objectStore will contain
    //objectStore.createIndex("id", "id", { unique: true});
    console.log('store created');
};

DBOpenRequest.onsuccess = (event) => {
    db = DBOpenRequest.result;
    console.log('opened db');
    stream = new Rx.Observable((subscriber) => emitNextItemObservable(db, subscriber));
    stream.subscribe( o => {
        o.subscribe( i => {
            console.log('unwrapped: ', i)
        }
        )
    });
};

function add(item) {

    return new Rx.Observable( observer => {
        const tx = db.transaction(store_name , 'readwrite');
        tx.onerror = (e) => console.log('failed transaction' , e);

        const store = tx.objectStore(store_name);
        const addItemRequest = store.add(item);
        addItemRequest.onsuccess = (event) => {
            observer.next(item);
            observer.complete();
        }
        addItemRequest.onerror = (event) => {
            observer.error(event)
        }
    });

}

function emitNextItemObservable(db, streamObserver){

    const checkAgain = () => {
        var sleep = 10000;
        console.log('no more elements. Checking after %d seconds ', sleep/1000);
        setTimeout(() => {
            emitNextItemObservable(db, streamObserver)
        }, sleep);
    }

    console.log('emitting next available')
    let transaction = db.transaction([store_name], "readwrite");
    let store = transaction.objectStore(store_name);
    let cursorRequest = store.openCursor();

    cursorRequest.onsuccess = (e) => {
        let cursor = e.target.result;
        if (cursor){
            let item = cursor.value;
            const req = cursor.delete();
            req.onsuccess = (e) => {
                console.log('dequeued item', item);
                const item$ = new Rx.Observable( (observer) => {
                    observer.next(item)
                    observer.complete() 
                    let countReq = store.count() ;
                    countReq.onsuccess = () => {
                        if(countReq.result > 0){
                            console.log('more items available ', countReq.result);
                            emitNextItemObservable(db, streamObserver)
                        } else {
                            console.log('done all');
                            checkAgain();
                        }
                    }
                });
                streamObserver.next(item$);
            }
        } else {
            checkAgain()
        }
    };
    cursorRequest.onerror = (e) => console.log('error getting cursor' , e)
}



console.log('module loaded');

