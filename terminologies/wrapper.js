const { join } = require('path');
const logger = require('../src/logger');

// Execute promises sequentially
const mapSeries = async (terms) => {
  for (const terminology of terms) {
    logger.info(`Starting to process the terminology: ${terminology}`);
    const { execute } = require(join(__dirname, terminology, 'process.js'));
    await execute({ exitProcessOnMissingData: false });
    logger.info(`Completed the terminology: ${terminology}`);
  }
};

exports.processRawTerminologies = (terminologies) => mapSeries(terminologies);
