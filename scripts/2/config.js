const BIT_LENGTH = 6;
const CACHED_FILE = `cache/2/bitLength${BIT_LENGTH}.json`;
const OVERWRITE_FILE = false;
const MONGO_URL = process.env.GETSET_MONGO_URL;
// const MONGO_URL = 'mongodb://localhost:27017/getset';

module.exports = {
  BIT_LENGTH,
  CACHED_FILE,
  OVERWRITE_FILE,
  MONGO_URL,
};
