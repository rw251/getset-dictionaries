require('dotenv').config();
const fs = require('fs');
const { join } = require('path');
const logger = require('../../src/logger');
const readDrugs = require('./scripts/parseDrugFile');
const readCodes = require('./scripts/parseReadcodeFile');

const getLocationOfInputFiles = (exitProcessOnMissingData) => {
  const directory = process.env.READ_V2_DIRECTORY;
  if (!directory) {
    logger.error(
      "The env variable READ_V2_DIRECTORY is not set. Please make sure you've followed the README and created a .env file."
    );
    if (exitProcessOnMissingData) process.exit(1);
    return false;
  }
  logger.info(`READ v2 directory from env vars: ${directory}`);
  if (!fs.existsSync(directory)) {
    logger.error(
      `The READ_V2_DIRECTORY does not exist. Please make sure that ${directory} exists.`
    );
    if (exitProcessOnMissingData) process.exit(1);
    return false;
  }
  return directory;
};

const getReadv2Versions = (directory) => {
  logger.info('Searching for READ v2 version directories');
  const versions = fs.readdirSync(directory);
  if (!versions.length) {
    logger.warn(
      `There don't seem to be any sub-directories in the READ v2 directory: ${directory}`
    );
    process.exit(0);
  }

  versions.forEach((version) => {
    const codesDirectory = join(directory, version, 'codes');
    if (!fs.existsSync(codesDirectory)) {
      logger.error(
        `The 'codes' directory does not exist. Please make sure that ${codesDirectory} exists.`
      );
      process.exit(1);
    }
    const drugsDirectory = join(directory, version, 'drugs');
    if (!fs.existsSync(drugsDirectory)) {
      logger.error(
        `The 'drugs' directory does not exist. Please make sure that ${drugsDirectory} exists.`
      );
      process.exit(1);
    }
  });

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
  const readv2Versions = getReadv2Versions(inputFileLocation);

  // Execute promises sequentially
  for (const version of readv2Versions) {
    createOutputVersionDirIfNotExists(version);
    await readCodes.run(inputFileLocation, version);
    await readDrugs.run(inputFileLocation, version);
  }
};

module.exports = { execute };
