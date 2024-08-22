import type {
    Store,
    Options,
    IncrementResponse,
    ClientRateLimitInfo,
} from 'express-rate-limit';
import { Collection, MongoClientOptions, MongoClient, Document } from 'mongodb';

type CommonMongoDBStoreOptions = {
    prefix?: string;
    expireTimeMs?: number;
    resetExpireDateOnChange?: boolean;
    createTtlIndex?: boolean;
    errorHandler?: () => void;
};

export type MongoDBStoreOptions = (CommonMongoDBStoreOptions & {
    uri: string;
    collectionName?: string;
    collection?: never; // Ensures `collection` is not used in this variant
    connectionOptions?: MongoClientOptions;
    user?: string;
    password?: string;
    authSource?: string;
})
    | (CommonMongoDBStoreOptions & {
        collection: Collection;
        uri?: never; // Ensures `uri` is not used in this variant
        collectionName?: never; // Ensures `collectionName` is not used in this variant
        connectionOptions?: never;
        user?: never;
        password?: never;
        authSource?: never;
    });

export class MongoDBStore implements Store {

    windowMs!: number
    prefix!: string
    storeOptions!: MongoDBStoreOptions
    collection?: Collection
    client?: MongoClient
    resolveOrRejectOnCollectionCreation: ([(value: Collection<Document>) => void, (reason?: any) => void])[] = [];
    collectionState: "uninitialized" | "initializing" | "initialized" = "uninitialized";

    constructor(options: MongoDBStoreOptions) {

        this.prefix = options.prefix ?? "mongodb_rl_";
        this.storeOptions = options;

        if (options.collection) {
            this.collection = options.collection;
            this.collectionState = "initialized";
        }
    }

    /**
     * Method that actually initializes the store.
     *
     * @param options {Options} - The options used to setup express-rate-limit.
     *
     * @public
     */
    init(options: Options): void {
        this.windowMs = options.windowMs;
    }

    /**
     * Method to prefix the keys with the given text.
     *
     * Call this from get, increment, decrement, resetKey, etc.
     *
     * @param key {string} - The key.
     *
     * @returns {string} - The text + the key.
     */
    prefixKey(key: string): string {
        return `${this.prefix}${key}`
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
                    this.collection.createIndex({expirationDate: 1}, {expireAfterSeconds: 0});
                }
                
                this.collectionState = "initialized";

                resolve(this.collection);

                for (let rslvRjct of this.resolveOrRejectOnCollectionCreation) {
                    rslvRjct[0](this.collection as Collection);
                }

                this.resolveOrRejectOnCollectionCreation = [];
            } catch (e) {

                this.collectionState = "uninitialized";

                reject(e);

                for (let rslvRjct of this.resolveOrRejectOnCollectionCreation) {
                    rslvRjct[1](e);
                }

                this.resolveOrRejectOnCollectionCreation = [];
            }
        });
    }

    private async createCollection() {

        const dbName = this.storeOptions.uri?.split("/").pop()?.split("?")[0];

        let connectionOptions: MongoClientOptions = {};

        connectionOptions.authSource = this.storeOptions.authSource ?? dbName;

        if (this.storeOptions.user) {
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

    get?: ((key: string) => Promise<ClientRateLimitInfo | undefined> | ClientRateLimitInfo | undefined) | undefined;
    increment: (key: string) => Promise<IncrementResponse> | IncrementResponse;
    decrement: (key: string) => Promise<void> | void;
    resetKey: (key: string) => Promise<void> | void;
    resetAll?: (() => Promise<void> | void) | undefined;
    shutdown?: (() => Promise<void> | void) | undefined;
    localKeys?: boolean | undefined;
}