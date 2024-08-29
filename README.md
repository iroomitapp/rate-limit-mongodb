# Rate Limit MongoDB Store

[![Npm version](https://img.shields.io/npm/v/@iroomit/rate-limit-mongodb.svg)](https://www.npmjs.org/package/@iroomit/rate-limit-mongodb)

MongoDB store for the [express-rate-limit](https://github.com/nfriedly/express-rate-limit) Node.js middleware package, used at [iROOMit](https://www.iroomit.com/).

This package was heavily inspired by [2do2go/rate-limit-mongo](https://github.com/2do2go/rate-limit-mongo), but is not a direct fork. Development on [2do2go/rate-limit-mongo](https://github.com/2do2go/rate-limit-mongo) has been stalled for several years, and also relies on some dependencies that are unnecessary in modern Node.js.

This implementation is also written in TypeScript for improved IntelliSense in VSCode and improved compile-time error detection.

## Compatibility

This package is tested as compatible for MongoDB driver version >= 5, and express-rate-limit version >= 6.

Although untested, it may work with older versions of the MongoDB driver.

Version 6 and up of the express-rate-limit package is a hard requirement.

## Install

```sh
npm install @iroomit/rate-limit-mongodb
```

or

```sh
yarn add @iroomit/rate-limit-mongodb
```

## Usage


```ts
import RateLimit from 'express-rate-limit';
import MongoDBStore from '@iroomit/rate-limit-mongodb';

const limiter = new RateLimit({
  store: new MongoDBStore({
    uri: 'mongodb://127.0.0.1:27017/test_db',
    user: 'mongouser',
    password: 'mongopassword'
  }),
  max: 100,
  windowMs: 15 * 60 * 1000
});

//  apply to all requests
app.use(limiter);
```

## Configuration

The `MongoDBStore` class can be configured using the following options, depending on whether you are passing a MongoDB URI to establish the connection with this library or directly passing a MongoDB collection.

### Common Options

These options apply regardless of whether you are passing a MongoDB URI or a MongoDB collection directly:

- **`prefix`** (optional):
  - A string that will be prefixed to all keys stored in the MongoDB collection.
  - Default: `"mongodb_rl_"`.

- **`resetExpireDateOnChange`** (optional):
  - A boolean that, if set to `true`, will reset the expiration date of a key each time it is incremented or decremented.
  - Default: `false`.

- **`createTtlIndex`** (optional):
  - A boolean that, if set to `true`, will automatically create a TTL index on the `expirationDate` field in the MongoDB collection.
  - This is useful to automatically remove expired rate-limit records.
  - Default: `true`.

### MongoDB Connection Options

These options are used if you are passing a MongoDB URI to connect to the database yourself. The `collection` field should not be provided in this case.

- **`uri`** (required):
  - A string representing the MongoDB connection URI.
  - Example: `"mongodb://localhost:27017/rateLimitDB"`.

- **`collectionName`** (optional):
  - The name of the MongoDB collection where rate-limit records will be stored.
  - Default: `"expressRateRecords"`.

- **`connectionOptions`** (optional):
  - An object containing additional options to be passed to the `MongoClient` constructor.
  - This allows for advanced configuration of the MongoDB connection, such as SSL settings, connection pool size, etc.

- **`user`** (optional):
  - A string representing the MongoDB username for authentication.

- **`password`** (optional):
  - A string representing the MongoDB password for authentication.

- **`authSource`** (optional):
  - A string representing the database to authenticate against.
  - Default: The database name extracted from the URI.

### MongoDB Collection Option

These options are used if you are directly passing a MongoDB collection object to the `MongoDBStore` constructor. The `uri` field should not be provided in this case.

- **`collection`** (required):
  - A MongoDB `Collection` instance where rate-limit records will be stored.

## Testing

The test suite can be run with Docker, by running:

```sh
docker-compose -f docker-compose.test.yml up
```

You may be able to run the test suite outside of Docker, however the `mongodb-memory-server` package used in the test suite only runs on select operating systems. This is probably fine if you are using Windows or macOS, but may cause problems on Linux if your distribution is not supported.

By running the test suite in Docker, we ensure that all required dependencies are installed for the `mongodb-memory-server` package.