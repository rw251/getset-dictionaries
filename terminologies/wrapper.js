const { readdirSync } = require('fs');
const { join } = require('path');
const inquirer = require('inquirer');
const logger = require('../scripts/logger');

const findTerminologies = (directory = __dirname) => {
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

const terminologies = findTerminologies();

// Execute promises sequentially
const mapSeries = async (terms) => {
  for (const terminology of terms) {
    logger.info(`Starting to process the terminology: ${terminology}`);
    const { execute } = require(join(__dirname, terminology, 'process.js'));
    await execute({ exitProcessOnMissingData: false });
    logger.info(`Completed the terminology: ${terminology}`);
  }
};

const ALL = 'ALL';
const choices = [{ name: 'All', value: ALL }, new inquirer.Separator()].concat(terminologies);
inquirer
  .prompt([
    {
      type: 'list',
      name: 'terminology',
      message: 'Which terminology do you want to process?',
      choices,
    },
  ])
  .then((answer) => {
    if (answer.terminology === ALL) {
      mapSeries(terminologies);
    } else {
      mapSeries([answer.terminology]);
    }
  });
