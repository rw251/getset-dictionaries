/* jshint node: true */


const transform = require('stream-transform');

const getReadV2Parent = function getReadV2Parent(code) {
  // get code like G30.. and return G3...
  const f = code.indexOf('.');
  return f > -1 ? `${code.substr(0, f - 1)}.${code.substr(f)}` : `${code.substr(0, code.length - 1)}.`;
};

const already = {};

const transformer = transform((data, callback) => {
  setImmediate(function process() {
    const parent = getReadV2Parent(data[7]);
    const rtn = [null];
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
    callback.apply(this, rtn);
  });
}, { parallel: 20 });

transformer.on('readable', (row) => {
  while ((row = transformer.read()) !== null) {
    return row;
  }
});

transformer.on('error', (err) => {
  console.log(err.message);
});

module.exports = { transformer };
