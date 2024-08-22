# Rate Limit MongoDB Store

MongoDB store for the [express-rate-limit](https://github.com/nfriedly/express-rate-limit) Node.js middleware package, used at [iROOMit](https://www.iroomit.com/).

This package was heavily inspired by [2do2go/rate-limit-mongo](https://github.com/2do2go/rate-limit-mongo), but is not a direct fork. Development on [2do2go/rate-limit-mongo](https://github.com/2do2go/rate-limit-mongo) has been stalled for several years, and also relies on some dependencies that are unnecessary in modern Node.js.

This implementation is also written in TypeScript for improved IntelliSense in VSCode and improved compile-time error detection.

## Compatibility

This package is tested as compatible for MongoDB driver version >= 5, and express-rate-limit version >= 6.

Although untested, it may work with older versions of the MongoDB driver.

Version 6 and up of the express-rate-limit package is a hard requirement.

## Install

```sh
$ npm install @iroomit/rate-limit-mongodb
```

or

```sh
$ yarn add @iroomit/rate-limit-mongodb
```