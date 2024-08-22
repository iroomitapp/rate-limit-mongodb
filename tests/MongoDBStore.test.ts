import { MongoDBStore, MongoDBStoreOptions } from '../src/MongoDBStore';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { Options } from 'express-rate-limit';

// Running test suite with --forceExit for now, because there appears to be a memory leak in mongodb-memory-server that doesn't play nicely with Jest

describe('MongoDBStore', () => {
    let mongoServer: MongoMemoryServer;
    let mongoUri: string;
    let store: MongoDBStore;
    let client: MongoClient;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        mongoUri = mongoServer.getUri();
    });

    afterAll(async () => {
        if (client) {
            await client.close();
        }

        await mongoServer.stop();
    });

    beforeEach(async () => {
        store = new MongoDBStore({
            uri: mongoUri,
            collectionName: 'rateLimitTestCollection',
        } as MongoDBStoreOptions);

        store.init({ windowMs: 60000 } as Options);
        client = new MongoClient(mongoUri);
        await client.connect();
    });

    afterEach(async () => {
        if (client) {
            await client.db().dropDatabase();
            await client.close();
        }
    });

    test('should increment and return correct hits and reset time', async () => {
        const key = 'testKey';
        const result = await store.increment(key);

        expect(result.totalHits).toBe(1);
        expect(result.resetTime).toBeInstanceOf(Date);
    });

    test('should decrement and return correct hits', async () => {
        const key = 'testKey';
        await store.increment(key);
        await store.increment(key);
        await store.decrement(key);

        const result = await store.get(key);

        expect(result?.totalHits).toBe(1);
    });

    test('should reset key', async () => {
        const key = 'testKey';
        await store.increment(key);
        await store.resetKey(key);

        const result = await store.get(key);

        expect(result).toBeUndefined();
    });

    test('should reset all keys', async () => {
        await store.increment('testKey1');
        await store.increment('testKey2');
        await store.resetAll();

        const result1 = await store.get('testKey1');
        const result2 = await store.get('testKey2');

        expect(result1).toBeUndefined();
        expect(result2).toBeUndefined();
    });

    test('should respect prefix in keys', async () => {
        const key = 'testKey';
        const prefix = 'customPrefix_';

        store = new MongoDBStore({
            uri: mongoUri,
            collectionName: 'rateLimitTestCollection',
            prefix,
        } as MongoDBStoreOptions);
        store.init({ windowMs: 60000 } as Options);

        await store.increment(key);

        const collection = client.db().collection('rateLimitTestCollection');
        const record = await collection.findOne({ _id: `${prefix}${key}` as any });

        expect(record).toBeDefined();
        expect(record?.counter).toBe(1);
    });

    test('should create TTL index on expirationDate', async () => {
        store = new MongoDBStore({
            uri: mongoUri,
            collectionName: 'rateLimitTestCollection',
            createTtlIndex: true,
        } as MongoDBStoreOptions);
        store.init({ windowMs: 60000 } as Options);

        await store.increment('testKey');

        const collection = client.db().collection('rateLimitTestCollection');
        const indexes = await collection.indexes();

        const ttlIndex = indexes.find((index) => index.key.expirationDate);

        expect(ttlIndex).toBeDefined();
        expect(ttlIndex?.expireAfterSeconds).toBe(0);
    });
});
