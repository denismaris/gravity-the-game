/**
 * Jest mock for `@react-native-async-storage/async-storage`.
 *
 * The real module needs a native TurboModule that isn't present under Jest's
 * Node environment. This re-exports the library's own in-memory mock so
 * `createDefaultBackend()` resolves to a working async key/value store in
 * tests instead of falling back to (and warning about) the memory backend.
 */
module.exports = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
