//import 'rxjs';

//import { range, filter, map } from 'rxjs';

const {AsyncSubject, Observable, Subject, fromEvent, of, merge } = rxjs;
const {tap, filter, map, takeWhile, take,concatMap, switchMap, mergeMap, flatMap, bufferCount,
    groupBy,
    delayWhen, bufferWhen,  bufferTime, bufferWithTimeOrCount } = rxjs.operators ;

let db ;

const store_name = "commands" ;
const command$ = new Subject();

export const commandStream = command$.pipe( 
    delayWhen( s => onlineMonitor.pipe(filter((v) => v) )),
    map( id => mapToObj(id)),
    concatMap(p => p),
);

const onlineMonitor = merge(
    of(null),
    fromEvent(window, 'online'),
    fromEvent(window, 'offline')
).pipe( 
    map(() => navigator.onLine)
) ;

// preparing the database
const DBOpenRequest = window.indexedDB.open("DB", 1);

DBOpenRequest.onerror = () => { 
    console.log('can not create db' )
}

DBOpenRequest.onupgradeneeded = (e) => {
    db = e.target.result;
    console.log('Upgrading db ...');
    let objectStore ;

    if (e.oldVersion < 1) {
        //const objectStore = db.createObjectStore(store_name, { autoIncrement: true });
        objectStore = db.createObjectStore(store_name, { keypath: "id", autoIncrement: false });
        objectStore.createIndex('timestamp', 'timestamp' , {unique: true} );
        console.log('store created');
    }

}

DBOpenRequest.onsuccess = (event) => {
    console.log('db opened');
    db = DBOpenRequest.result;


    let transaction = db.transaction([store_name], "readwrite");

    transaction.oncomplete = () => { console.log('All DB records ids are emmited') } 

    let store = transaction.objectStore(store_name);

    var index = store.index("timestamp");

    let cursorRequest = index.openCursor();

    cursorRequest.onsuccess = (e) => {
        let cursor = e.target.result;
        if (cursor) {
            let item = cursor.value;
            command$.next(item.id);
            cursor.continue();
        }
    }

    cursorRequest.onerror = (e) => { 
        console.log('error getting cursor' , e)
    }  
}


export function add(item) {

    return new Observable( observer => {

        const tx = db.transaction(store_name , 'readwrite');

        tx.onerror = (e) => console.log('failed aquiring transaction', e);

        const store = tx.objectStore(store_name);

        const addItemRequest = store.add(item, item['id']);

        addItemRequest.onsuccess = (event) => {
            command$.next(item.id);
            observer.next(item);
            observer.complete();
        }
        addItemRequest.onerror = (event) => {
            console.log('error occured');
            observer.error(event)
        }
    });
}


/***
 * map id to a db object. Deleting the object when read
 *
 ***/
function mapToObj(id) {

    return new Observable( (sub) => {
        console.log('looking up object ', id);

        let transaction = db.transaction([store_name], "readwrite");
        let store = transaction.objectStore(store_name);
        let itemReq = store.get(id) ;

        itemReq.onsuccess = (i) => {
            let item = i.target.result 

            if (item != null) {
                let deleteReq = store.delete(id) ;
                deleteReq.onsuccess = (res) => sub.next(item);
                deleteReq.onerror = () => {
                    sub.error('Can not delete object');
                }
            }
            else 
                sub.error("Not found" , id);
            // not needed, because deleteReq passed
            transaction.oncomplete = () => { sub.complete()} 
            //transaction.onerror = () => { console.log('transaction error') } 
        }
    });
}


