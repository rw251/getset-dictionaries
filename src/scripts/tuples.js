const fs = require('fs');
const parentLogger = require('../logger');
let logger = parentLogger;
const { join } = require('path');

const ROOT_DIR = join(__dirname, '..', '..');
const CACHE_DIR = join(ROOT_DIR, 'cache');
const CACHED_TUPLE_DIR = join(ROOT_DIR, 'cachedTuples');

let al = {};
let called = 0;
const dotReplacement = '_/\\_';
const joiner = '||';

// const add = (arr) => {
//   let pointer = al;
//   const final = arr.pop();
//   arr.forEach((el) => {
//     if (!pointer[el]) pointer[el] = {};
//     pointer = pointer[el];
//   });
//   if (!pointer[final]) pointer[final] = 1;
//   else pointer[final] += 1;
// };

const getAllSubsequences = (arr, limit) => {
  if (called > 0 && called % 4000 === 0) {
    console.log(called);
  }
  called++;
  const findsubsequences = (arr, ans) => {
    if (ans.length === limit) {
      if (limit === 1) {
        const hash = ans.join(joiner);
        if (!al[hash]) al[hash] = 1;
        else al[hash] += 1;
      } else {
        const hash = ans.slice(1).join(joiner);
        if (!al[ans[0]]) al[ans[0]] = {};
        if (!al[ans[0]][hash]) al[ans[0]][hash] = 1;
        else al[ans[0]][hash] += 1;
        // add(ans);
      }
      return;
    }
    if (arr.length === 0) {
      return;
    }

    findsubsequences(arr.slice(1), ans.concat(arr[0]));
    findsubsequences(arr.slice(1), ans);
  };

  // TODO at some point maybe stop doing single letters - though e.g. influenza A,
  // or type I diabetes it's very important
  // const uniqueArray = Array.from(new Set(arr.filter((x) => x.length > 1)));
  const uniqueArray = Array.from(new Set(arr));

  if (uniqueArray.length < limit) return;
  if (uniqueArray.length === limit) {
    findsubsequences([], uniqueArray.sort());
  } else {
    findsubsequences(uniqueArray.sort(), []);
  }
};

const doPlesRedux = (n, id, version) => (docs) =>
  new Promise((resolve, reject) => {
    logger.info(`Creating and caching the ${n}-tuples...`);
    called = 0;
    al = {};
    docs.forEach((doc) => {
      if (doc.length >= n) {
        getAllSubsequences(doc, n);
      } else {
        if (called > 0 && called % 4000 === 0) {
          console.log(called);
        }
        called++;
      }
    });

    logger.info(`${Object.keys(al).length} tuples cached.`);
    logger.info(`Creating JSON file...`);

    const Stream = require('stream');
    const readable = new Stream.Readable();
    const filename = `${id}-${version}-${n}-tuples.json`;

    const outputStream = fs.createWriteStream(join(CACHED_TUPLE_DIR, filename));
    readable.pipe(outputStream);

    outputStream.on('finish', () => {
      logger.info(`${filename} written to disk.`);
      return resolve();
    });
    outputStream.on('error', reject);

    if (n === 1) {
      const firstKey = Object.keys(al)[0];
      let firstxdot = firstKey.replace(/\./g, dotReplacement);
      const firstItem = { _id: firstxdot, n: al[firstKey] };

      // Start of array
      readable.push(`[\n ${JSON.stringify(firstItem)}`);

      delete al[firstKey];
      Object.keys(al)
        .sort((a, b) => al[b] - al[a])
        .forEach((x) => {
          let xdot = x.replace(/\./g, dotReplacement);
          const item = { _id: xdot, n: al[x] };
          readable.push(`,\n ${JSON.stringify(item)}`);
        });
    } else {
      const firstKey = Object.keys(al)[0];
      let firstxdot = firstKey.replace(/\./g, dotReplacement);
      const firstSubKey = Object.keys(al[firstKey])[0];
      let firstydot = firstSubKey.replace(/\./g, dotReplacement);
      const firstItem = { _id: [firstxdot, firstydot].join(joiner), n: al[firstKey][firstSubKey] };

      // Start of array
      readable.push(`[\n ${JSON.stringify(firstItem)}`);

      delete al[firstKey][firstSubKey];

      Object.keys(al).forEach((x) => {
        let xdot = x.replace(/\./g, dotReplacement);
        Object.keys(al[x]).forEach((y) => {
          if (al[x][y] < 2) return;
          let ydot = y.replace(/\./g, dotReplacement);
          const item = { _id: [xdot, ydot].join(joiner), n: al[x][y] };
          readable.push(`,\n ${JSON.stringify(item)}`);
        });
        delete al[x];
      });
    }

    // End of array
    readable.push('\n]\n');
    // no more data
    readable.push(null);

    logger.info(`Writing JSON file...`);
  });

const getWordsFromFile = ({ id, version }) =>
  new Promise((resolve) => {
    logger.info('Loading words from cached file...');
    const words = JSON.parse(fs.readFileSync(join(CACHE_DIR, id, `${version}.json`), 'utf8')).map(
      (x) => x.w
    );
    logger.info('File loaded into memory.');
    return resolve(words);
  });

const createTuples = async (n, { id, version }) => {
  logger = parentLogger.child({ terminology: id, version });
  return getWordsFromFile({ id, version })
    .then(doPlesRedux(n, id, version))
    .then(() => console.log('All done!'))
    .catch((err) => console.log(err));
};

const loadTupleFromCache = ({ id, version, tuple }) => {
  const file = fs.readFileSync(
    join(CACHED_TUPLE_DIR, `${id}-${version}-${tuple}-tuples.json`),
    'utf8'
  );
  return JSON.parse(file);
};

module.exports = {
  createTuples,
  loadTupleFromCache,
};
