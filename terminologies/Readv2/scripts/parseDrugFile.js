const parse = require('csv-parse');
const fs = require('fs');
const { join } = require('path');
const logger = require('pino')();
const transform = require('stream-transform');

const getReadV2Parent = function getReadV2Parent(code) {
  // get code like G30.. and return G3...
  const f = code.indexOf('.');
  return f > -1
    ? `${code.substr(0, f - 1)}.${code.substr(f)}`
    : `${code.substr(0, code.length - 1)}.`;
};

let already = {};

const doTheProcess = (data) => {
  const parent = getReadV2Parent(data[7]);
  const rtn = [];
  if (!already[data[7] + data[5] + data[2]]) {
    rtn.push(`${data[7] + data[5]}\t${data[2]}\t${parent}\n`);
    already[data[7] + data[5] + data[2]] = true;
  }
  if (data[3] && !already[data[7] + data[5] + data[3]]) {
    rtn.push(`${data[7] + data[5]}\t${data[3]}\t${parent}\n`);
    already[data[7] + data[5] + data[3]] = true;
  }
  if (data[4] && !already[data[7] + data[5] + data[4]]) {
    rtn.push(`${data[7] + data[5]}\t${data[4]}\t${parent}\n`);
    already[data[7] + data[5] + data[4]] = true;
  }
  return rtn.join('');
};

const transformer = transform(
  function (record, callback) {
    setImmediate(function () {
      callback(null, doTheProcess(record));
    });
  },
  {
    parallel: 5,
  }
);

const getFileInputLocation = (directory, version) => {
  const filePath = join(
    directory,
    version,
    'drugs',
    'Source',
    'v1_v2',
    'unidrug.key'
  );
  if (!fs.existsSync(filePath)) {
    logger.error(
      'The file',
      filePath,
      'does not exist. Please download the drug dictionary from TRUD.'
    );
    process.exit(1);
  }
  return filePath;
};

const run = (directory, version) =>
  new Promise((resolve, reject) => {
    already = {};

    const inputLocation = getFileInputLocation(directory, version);
    const input = fs.createReadStream(inputLocation);
    const output = fs.createWriteStream(
      join(
        'terminologies',
        'Readv2',
        'data-processed',
        version,
        'drugs.dict.txt'
      )
    );
    const parser = parse({ delimiter: '|', trim: true, quote: '' });

    parser.on('error', (err) => {
      logger.error(err.message);
      return reject();
    });
    parser.on('end', () => logger.info('Drug file finished processing.'));

    output.on('finish', () => {
      logger.info('Drug file written');
      resolve();
    });

    logger.info('Drug file start loading...');
    input.pipe(parser).pipe(transformer).pipe(output);
  });

module.exports = { run };
