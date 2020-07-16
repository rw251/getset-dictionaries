const inquirer = require('inquirer');
const logger = require('../logger');
const { readdirSync } = require('fs');
const { join } = require('path');

const ALL = 'ALL';
const separator = ' - ';

const findRawTerminologies = (directory = join(__dirname, '..', '..', 'terminologies')) => {
  const terminologies = readdirSync(directory, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
  if (terminologies.length === 0) {
    logger.error(
      'There are no sub-directories in',
      directory,
      "Check out the README to see where you're going wrong."
    );
    process.exit(1);
  }
  return terminologies;
};

const getChoicesForVersions = (versions) =>
  [{ name: 'All', value: ALL }, new inquirer.Separator()].concat(
    versions.map((x) => `${x.id}${separator}${x.version}`)
  );

const whichTerminologiesToUpload = async (versions) => {
  const choices = getChoicesForVersions(versions);
  return inquirer
    .prompt([
      {
        type: 'list',
        name: 'terminology',
        message: 'Which cached terminology file do you want to upload?',
        choices,
      },
    ])
    .then((answer) => answer.terminology.split(separator))
    .then(([id, version]) =>
      id === ALL ? versions : versions.filter((x) => x.id === id && x.version === version)
    );
};

const whichTerminolgiesToProcess = async (versions) => {
  const choices = getChoicesForVersions(versions);
  return inquirer
    .prompt([
      {
        type: 'list',
        name: 'terminology',
        message: 'Which terminology do you want to process?',
        choices,
      },
    ])
    .then((answer) => answer.terminology.split(separator))
    .then(([id, version]) =>
      id === ALL ? versions : versions.filter((x) => x.id === id && x.version === version)
    );
};

const optionNames = {
  fromRawToFormat: 'fromRawToFormat',
  fromFormatToJSON: 'fromFormatToJSON',
  uploadJSON: 'uploadJSON',
  uploadAndIndex: 'uploadAndIndex',
  addIndexes: 'addIndexes',
};
const options = {
  fromRawToFormat:
    'Take raw terminology data and process it to the 3 column format (id,description,parent)',
  fromFormatToJSON: 'Process 3 column format data into JSON ready to upload to mongo',
  uploadAndIndex: 'Upload JSON to mongo and add indexes',
  uploadJSON: "Upload JSON to mongo but don't add indexes",
  addIndexes: 'Add indexes to existing collection',
};

const whatToDo = async () => {
  const choices = Object.keys(options).map((x) => ({ name: options[x], value: [x] }));
  return inquirer
    .prompt([
      {
        type: 'list',
        name: 'todo',
        message: 'What do you want to do?',
        choices,
      },
    ])
    .then((answer) => answer.todo[0]);
};

const whichRawTerminologyToProcess = async () => {
  const terminologies = findRawTerminologies();
  const choices = [{ name: 'All', value: ALL }, new inquirer.Separator()].concat(terminologies);
  return inquirer
    .prompt([
      {
        type: 'list',
        name: 'terminology',
        message: 'Which terminology do you want to process?',
        choices,
      },
    ])
    .then((answer) => answer.terminology)
    .then((terminology) => (terminology === 'ALL' ? terminologies : [terminology]));
};

module.exports = {
  whichTerminolgiesToProcess,
  whichTerminologiesToUpload,
  whichRawTerminologyToProcess,
  whatToDo,
  optionNames,
};
