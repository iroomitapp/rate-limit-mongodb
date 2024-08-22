import type {
	Store,
	Options,
	IncrementResponse,
	ClientRateLimitInfo,
} from 'express-rate-limit';
import { Collection, ConnectionOptions, MongoClient } from 'mongodb';

export type MongoDBStoreOptions = {
    prefix?: string,
    uri?: string,
    collectionName?: string,
    user?: string,
    password?: string,
    authSource?: string,
    collection?: Collection,
    connectionOptions?: ConnectionOptions,
    expireTimeMs?: number,
    resetExpireDateOnChange?: boolean,
    createTtlIndex?: boolean,
    errorHandler?: () => void
};

export class MongoDBStore implements Store {

    windowMs!: number
	prefix!: string
    collection!: Collection

    constructor(options: MongoDBStoreOptions) {

        this.prefix = options.prefix ?? "mongodb_rl_";

        if (options.collection) {
            this.collection = options.collection;
        } else {
            
        }
    }

    init?: ((options: Options) => void) | undefined;
    get?: ((key: string) => Promise<ClientRateLimitInfo | undefined> | ClientRateLimitInfo | undefined) | undefined;
    increment: (key: string) => Promise<IncrementResponse> | IncrementResponse;
    decrement: (key: string) => Promise<void> | void;
    resetKey: (key: string) => Promise<void> | void;
    resetAll?: (() => Promise<void> | void) | undefined;
    shutdown?: (() => Promise<void> | void) | undefined;
    localKeys?: boolean | undefined;
}