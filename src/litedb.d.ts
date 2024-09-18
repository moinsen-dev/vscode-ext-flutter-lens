declare module 'litedb' {
    export class Db {
        constructor(path: string);
        getCollection(name: string): Collection;
        close(): void;
    }

    export class Collection {
        insert(doc: any): Promise<void>;
        find(query?: any): Promise<any[]>;
        findOne(query: any): Promise<any>;
        remove(query: any): Promise<void>;
    }
}