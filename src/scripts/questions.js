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

const getChoicesForVersions = (versions, includeAll = true) =>
  includeAll
    ? [{ name: 'All', value: ALL }, new inquirer.Separator()].concat(
        versions.map((x) => `${x.id}${separator}${x.version}`)
      )
    : versions.map(
        (x) =>
          `${x.id}${separator}${x.version}${
            x.tuple ? `${separator}${x.tuple}${separator}tuple` : ''
          }`
      );

const whichTerminologies = async (versions, verb = 'upload', includeAll = true) => {
  const choices = getChoicesForVersions(versions, includeAll);
  return inquirer
    .prompt([
      {
        type: 'list',
        name: 'terminology',
        message: `Which cached terminology file do you want to ${verb}?`,
        choices,
      },
    ])
    .then((answer) => answer.terminology.split(separator))
    .then(([id, version, tuple]) =>
      id === ALL
        ? versions
        : versions.filter(
            (x) => x.id === id && x.version === version && (!tuple || +x.tuple === +tuple)
          )
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

const getNumber = () =>
  inquirer
    .prompt([
      {
        type: 'input',
        message: 'Enter a number',
        name: 'n',
      },
    ])
    .then((answer) => +answer.n);

const optionNames = {
  fromRawToFormat: 'fromRawToFormat',
  fromFormatToJSON: 'fromFormatToJSON',
  uploadJSON: 'uploadJSON',
  uploadAndIndex: 'uploadAndIndex',
  addIndexes: 'addIndexes',
  createTuples: 'createTuples',
  uploadTuples: 'uploadTuples',
};
const options = {
  fromRawToFormat:
    'Take raw terminology data and process it to the 3 column format (id,description,parent)',
  fromFormatToJSON: 'Process 3 column format data into JSON ready to upload to mongo',
  uploadAndIndex: 'Upload JSON to mongo and add indexes',
  uploadJSON: "Upload JSON to mongo but don't add indexes",
  addIndexes: 'Add indexes to existing collection',
  createTuples: 'Create tuples',
  uploadTuples: 'Upload tuples',
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
  whichTerminologies,
  whichRawTerminologyToProcess,
  whatToDo,
  optionNames,
  getNumber,
};
