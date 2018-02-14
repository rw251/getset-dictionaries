require('dotenv').config();

const MONGO_URL = process.env.GETSET_MONGO_URL;
const MONGO_URL_EMIS = process.env.GETSET_MONGO_URL_EMIS;
// const MONGO_URL = 'mongodb://localhost:27017/getset';

module.exports = {
  MONGO_URL,
  MONGO_URL_EMIS,
};
