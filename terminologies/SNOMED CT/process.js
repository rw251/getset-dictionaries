require('dotenv').config();
const fs = require('fs');
const { join } = require('path');
const inquirer = require('inquirer');
const logger = require('../../src/logger');
const { run } = require('./scripts/parseSnomedFiles');

const getLocationOfInputFiles = (exitProcessOnMissingData) => {
  const directory = process.env.SNOMED_DIRECTORY;
  if (!directory) {
    logger.error(
      "The env variable SNOMED_DIRECTORY is not set. Please make sure you've followed the README and created a .env file."
    );
    if (exitProcessOnMissingData) process.exit(1);
    return false;
  }
  logger.info(`SNOMED directory from env vars: ${directory}`);
  if (!fs.existsSync(directory)) {
    logger.error(`The SNOMED_DIRECTORY does not exist. Please make sure that ${directory} exists.`);
    if (exitProcessOnMissingData) process.exit(1);
    return false;
  }
  return directory;
};

const getSnomedVersions = (directory) => {
  logger.info('Searching for SNOMED version directories');
  const versions = fs.readdirSync(directory);
  if (!versions.length) {
    logger.warn(
      `There don\'t seem to be any sub-directories in the SNOMED directory: ${directory}`
    );
    process.exit(0);
  }
  logger.info(`Found the following versions: ${versions.join(', ')}`);
  return versions;
};

const createOutputVersionDirIfNotExists = (version) => {
  const dirPath = join(__dirname, 'data-processed', version);
  if (!fs.existsSync(dirPath)) {
    logger.info('SNOMED:');
    fs.mkdirSync(dirPath);
  }
};

const processVersions = async (versions, inputFileLocation) => {
  // Execute promises sequentially
  for (const version of versions) {
    createOutputVersionDirIfNotExists(version);
    await run(inputFileLocation, version);
  }
};

const execute = async ({ exitProcessOnMissingData = true } = {}) => {
  const inputFileLocation = getLocationOfInputFiles(exitProcessOnMissingData);
  if (!inputFileLocation) return;
  const snomedVersions = getSnomedVersions(inputFileLocation);

  const ALL = 'ALL';
  const choices = [{ name: 'All', value: ALL }, new inquirer.Separator()].concat(snomedVersions);

  if (choices.length < 4) {
    return processVersions(snomedVersions, inputFileLocation);
  }

  return inquirer
    .prompt([
      {
        type: 'list',
        name: 'version',
        message: 'Which SNOMED version do you want to process?',
        choices,
      },
    ])
    .then((answer) => {
      if (answer.version === ALL) {
        processVersions(snomedVersions, inputFileLocation);
      } else {
        processVersions([answer.version], inputFileLocation);
      }
    });
};

module.exports = { execute };
