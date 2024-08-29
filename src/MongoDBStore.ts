import type {
    Store,
    Options,
    IncrementResponse,
    ClientRateLimitInfo,
} from 'express-rate-limit';
import { Collection, MongoClientOptions, MongoClient, Document } from 'mongodb';

// Options regardless if we're passed a collection, or if we're to connect and initialize the collection ourself
type CommonMongoDBStoreOptions = {
    prefix?: string;
    resetExpireDateOnChange?: boolean;
    createTtlIndex?: boolean;
};

export type MongoDBStoreOptions =

// Passed a uri and we should connect to the collection ourselves
(CommonMongoDBStoreOptions & {
    uri: string;
    collectionName?: string;
    collection?: never; // Ensures `collection` is not used in this variant
    connectionOptions?: MongoClientOptions;
    user?: string;
    password?: string;
    authSource?: string;
})
    |

// Passed a MongoDB collection directly
(CommonMongoDBStoreOptions & {
        collection: Collection;
        uri?: never; // Ensures `uri` is not used in this variant
        collectionName?: never; // Ensures `collectionName` is not used in this variant
        connectionOptions?: never;
        user?: never;
        password?: never;
        authSource?: never;
});

type MongoDBStoreEntry = {
    _id: string, // Usually an ObjectId is used in the _id field for MongoDB, but the rate-limit key works better in this case
    counter: number,
    expirationDate: Date
};

export class MongoDBStore implements Store {

    /* Number of MS to wait before calls can be made again once limit is reached */
    windowMs!: number;

    /* Set a prefix on the _id value added to MongoDB */
    prefix!: string;

    /* Stores a reference to the options passed to the constructor of this store */
    storeOptions!: MongoDBStoreOptions;

    /* Stores a reference to the collection */
    collection?: Collection;

    /* MongoDB client used to connect to the collection, if one isn't explicitly provided */
    client?: MongoClient;

    /* getCollection may be called by increment and decrement before the collection is ready.
     * We only want the connection logic to run once, so if getCollection is called while we're waiting
     * on a collection, we store the resolve and reject methods of the subsequent calls so we can resolve/reject
     * them along with the single call responsible for connection.
     */
    resolveOrRejectOnCollectionCreation: ([(value: Collection<Document>) => void, (reason?: any) => void])[] = [];

    /* State if MongoDB collection is ready for use */
    collectionState: "uninitialized" | "initializing" | "initialized" = "uninitialized";

    constructor(options: MongoDBStoreOptions) {

        this.prefix = options.prefix ?? "mongodb_rl_";
        this.storeOptions = options;

        if (options.collection) {
            this.collection = options.collection;
            this.collectionState = "initialized";
        }
    }

    init(options: Options): void {
        this.windowMs = options.windowMs;
    }

    prefixKey(key: string): string {
        return `${this.prefix}${key}`;
    }

    async increment(key: string): Promise<IncrementResponse> {

        const record = await this.incrementOrDecrement(key, 1);
        
        return ({
            totalHits: record.counter,
            resetTime: record.expirationDate
        });
    }

    async decrement(key: string): Promise<void> {
        await this.incrementOrDecrement(key, -1);
    }

    async get(key: string): Promise<ClientRateLimitInfo | undefined> {
        const collection = await this.getCollection();
        
        const record = await collection.findOne({_id: this.prefixKey(key) as any}) as unknown as (MongoDBStoreEntry | undefined);

        if (record) {
            return ({
                totalHits: record.counter,
                resetTime: record.expirationDate
            });
        }
    }

    async resetKey(key: string): Promise<void> {
        const collection = await this.getCollection();

        await collection.deleteOne({_id: this.prefixKey(key) as any}); 
    }

    async resetAll(): Promise<void> {
        const collection = await this.getCollection();
        
        await collection.deleteMany({});
    }

    private async incrementOrDecrement(key: string, byValue: number): Promise<MongoDBStoreEntry> {
        const collection = await this.getCollection();

        const modifier: {
            $inc: {counter: number},
            $set?: {expirationDate: Date},
            $setOnInsert?: {expirationDate: Date}
        } = {
            $inc: {counter: byValue}
        };

        const newExpiry = new Date(Date.now() + (this.windowMs));

        modifier[this.storeOptions.resetExpireDateOnChange ? "$set" : "$setOnInsert"] = {expirationDate: newExpiry};

        const result = await collection.findOneAndUpdate({_id: this.prefixKey(key) as any}, modifier, {upsert: true, returnDocument: 'after'});
        const record = result?.value as unknown as MongoDBStoreEntry;

        return record;
    }

    private getCollection(): Promise<Collection> {
        return new Promise(async (resolve, reject) => {
            if (this.collectionState == "initialized") {
                resolve(this.collection as Collection);
                return;
            }
            
            if (this.collectionState == "initializing") {
                this.resolveOrRejectOnCollectionCreation.push([resolve, reject]);
                return;
            }

            this.collectionState = "initializing";

            try {

                this.collection = await this.createCollection();

                if (typeof this.storeOptions.createTtlIndex == "undefined" || this.storeOptions.createTtlIndex) {
                    await this.collection.createIndex({expirationDate: 1}, {expireAfterSeconds: 0});
                }
                
                this.collectionState = "initialized";

                resolve(this.collection);

                for (let rslvRjct of this.resolveOrRejectOnCollectionCreation) {
                    rslvRjct[0](this.collection as Collection); // resolve any pending calls to this function as well
                }
            } catch (e) {

                this.collectionState = "uninitialized";

                reject(e);

                for (let rslvRjct of this.resolveOrRejectOnCollectionCreation) {
                    rslvRjct[1](e);
                }

                
            }

            this.resolveOrRejectOnCollectionCreation = [];
        });
    }

    private async createCollection() {

        const dbName = this.storeOptions.uri?.split("/").pop()?.split("?")[0]; // remove any query parameters from end of uri as well

        let connectionOptions: MongoClientOptions = {};

        connectionOptions.authSource = this.storeOptions.authSource ?? dbName;

        if (this.storeOptions.user) { // could technically have a blank password, so we won't check for one
            connectionOptions.auth = {
                username: this.storeOptions.user,
                password: this.storeOptions.password
            }
        }

        connectionOptions = {
            ...connectionOptions,
            ...this.storeOptions.connectionOptions // override any computed connection options with user-provided options
        }

        this.client = await MongoClient.connect(this.storeOptions.uri as string, connectionOptions); // assign the client to an instance variable to keep the connection alive

        const collection = this.client.db().collection(this.storeOptions.collectionName ?? "expressRateRecords");

        return collection;
    }
}