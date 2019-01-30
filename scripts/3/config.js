require('dotenv').config();

const BIT_LENGTH = 6;
const CACHED_DIR = 'cache/3/';
const CACHED_FILE = `bitLength${BIT_LENGTH}.json`;
const OVERWRITE_FILE = true;
// const MONGO_URL = process.env.GETSET_MONGO_URL;
const MONGO_URL = process.env.GETSET_MONGO_URL;
const MONGO_URL_EMIS = process.env.GETSET_MONGO_URL_EMIS;

module.exports = {
  BIT_LENGTH,
  CACHED_DIR,
  CACHED_FILE,
  OVERWRITE_FILE,
  MONGO_URL,
  MONGO_URL_EMIS,
};