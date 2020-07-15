const { readdirSync } = require('fs');
const { join } = require('path');
const logger = require('pino')();

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
const mapSeries = async () => {
  for (const terminology of terminologies) {
    logger.info(`Starting to process the terminology: ${terminology}`);
    const { execute } = require(join(__dirname, terminology, 'process.js'));
    await execute({ exitProcessOnMissingData: false });
    logger.info(`Completed the terminology: ${terminology}`);
  }
};

mapSeries();
