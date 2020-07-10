require('dotenv').config();
const fs = require('fs');
const logger = require('pino')();
const { run } = require('./scripts/parseSnomedFiles');

const getLocationOfInputFiles = (exitProcessOnMissingData) => {
  const directory = process.env.SNOMED_DIRECTORY;
  if(!directory) {
    logger.error('The env variable SNOMED_DIRECTORY is not set. Please make sure you\'ve followed the README and created a .env file.');
    if(exitProcessOnMissingData) process.exit(1);
    return false;
  }
  logger.info(`SNOMED directory from env vars: ${directory}`);
  if(!fs.existsSync(directory)) {
    logger.error(`The SNOMED_DIRECTORY does not exist. Please make sure that ${directory} exists.`);
    if(exitProcessOnMissingData) process.exit(1);
    return false;
  }
  return directory;
};

const getSnomedVersions = (directory) => {
  logger.info('Searching for SNOMED version directories');
  const versions = fs.readdirSync(directory);
  if(!versions.length) {
    logger.warn(`There don\'t seem to be any sub-directories in the SNOMED directory: ${directory}`);
    process.exit(0);
  }
  logger.info(`Found the following versions: ${versions.join(', ')}`);
  return versions;
}

const execute = async ({exitProcessOnMissingData = true} = {}) => {
  const inputFileLocation = getLocationOfInputFiles(exitProcessOnMissingData);
  if(!inputFileLocation) return;
  const snomedVersions = getSnomedVersions(inputFileLocation);

  // Execute promises sequentially
  for (const version of snomedVersions) {
    await run(inputFileLocation, version)
  }
}

module.exports = { execute };
