require('dotenv').config();

const OVERWRITE_FILE = true;
const MONGO_URL = process.env.GETSET_MONGO_URL;

module.exports = {
  OVERWRITE_FILE,
  MONGO_URL,
};
