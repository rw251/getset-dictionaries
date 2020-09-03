const fs = require('fs');
const { join } = require('path');
const parentLogger = require('../../../src/logger');
const logger = parentLogger.child({ terminology: 'EMIS' });

const getFileInputLocation = (directory, version) => {
  const filePath = join(directory, version, 'EMIS.dic.txt');
  if (!fs.existsSync(filePath)) {
    logger.error(
      'The file',
      filePath,
      'does not exist. Please download the EMIS dictionary from somewhere.'
    );
    process.exit(1);
  }
  return filePath;
};

const run = (directory, version) =>
  new Promise((resolve) => {
    const inputLocation = getFileInputLocation(directory, version);

    const data = fs.readFileSync(inputLocation, 'utf8');
    const output = data
      .split('\n')
      .map((x) => `${x}\t.....`)
      .join('\n');
    fs.writeFileSync(join('terminologies', 'EMIS', 'data-processed', version, 'dict.txt'), output);
    resolve();
  });

module.exports = { run };
