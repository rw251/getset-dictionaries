require('dotenv').config();
const fs = require('fs');
const { join } = require('path');
const logger = require('../../src/logger');
const { run } = require('./scripts/parseCTV3Files');

const getLocationOfInputFiles = (exitProcessOnMissingData) => {
  const directory = process.env.CTV3_DIRECTORY;
  if (!directory) {
    logger.error(
      "The env variable CTV3_DIRECTORY is not set. Please make sure you've followed the README and created a .env file."
    );
    if (exitProcessOnMissingData) process.exit(1);
    return false;
  }
  logger.info(`CTV3 directory from env vars: ${directory}`);
  if (!fs.existsSync(directory)) {
    logger.error(`The CTV3_DIRECTORY does not exist. Please make sure that ${directory} exists.`);
    if (exitProcessOnMissingData) process.exit(1);
    return false;
  }
  return directory;
};

const getCTV3Versions = (directory) => {
  logger.info('Searching for CTV version directories');
  const versions = fs.readdirSync(directory);
  if (!versions.length) {
    logger.warn(`There don't seem to be any sub-directories in the CTV directory: ${directory}`);
    process.exit(0);
  }

  logger.info(`Found the following versions: ${versions.join(', ')}`);
  return versions;
};

const createOutputVersionDirIfNotExists = (version) => {
  const dirPath = join(__dirname, 'data-processed', version);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
};

const execute = async ({ exitProcessOnMissingData = true } = {}) => {
  const inputFileLocation = getLocationOfInputFiles(exitProcessOnMissingData);
  if (!inputFileLocation) return;
  const readv2Versions = getCTV3Versions(inputFileLocation);

  // Execute promises sequentially
  for (const version of readv2Versions) {
    createOutputVersionDirIfNotExists(version);
    await run(inputFileLocation, version);
  }
};

module.exports = { execute };
