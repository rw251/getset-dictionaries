const fs = require('fs');
const { join } = require('path');
const inquirer = require('inquirer');
const parentLogger = require('./logger');
const mongoose = require('mongoose');
const readline = require('readline');
const JSONStream = require('JSONStream');
const { Code, Word } = require('./model');
require('dotenv').config();

const CACHED_DIR = join(__dirname, '..', 'cache');
const TERMINOLOGY_DIR = join(__dirname, '..', 'terminologies');

const terminologyVersions = [];
const cachedTerminologyVersions = [];
const mem = {};
const GDone = {};
const G = {};
let todo = 0;
let done = 0;
let logger = parentLogger;

mongoose.Promise = Promise;

const getSubDirectories = (directory) =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

const getFiles = (directory) =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((dirent) => dirent.isFile())
    .map((dirent) => dirent.name);

const createOutputCacheDirIfNotExists = (terminology) => {
  const dirPath = join(CACHED_DIR, terminology);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
};

// Populate the terminology/version combos that exist in the data-processed dirs
getSubDirectories(TERMINOLOGY_DIR).map((terminology) => {
  createOutputCacheDirIfNotExists(terminology);
  const versions = getSubDirectories(join(TERMINOLOGY_DIR, terminology, 'data-processed'));
  versions.map((version) => {
    terminologyVersions.push({
      id: terminology,
      version,
    });
  });
});
// Populate the cached terminology/version combos that exist in the cache directory
getSubDirectories(CACHED_DIR).map((terminology) => {
  const files = getFiles(join(CACHED_DIR, terminology));
  const versionObject = {};
  files.forEach((file) => {
    const isWordFile = file.indexOf('words_') === 0;
    const version = isWordFile ? file.substr(6, file.length - 11) : file.substr(0, file.length - 5);
    if (!versionObject[version]) {
      versionObject[version] = { hasWordFile: isWordFile, hasOtherFile: !isWordFile };
    } else if (
      (isWordFile && versionObject[version].hasOtherFile) ||
      (!isWordFile && versionObject[version].hasWordFile)
    ) {
      cachedTerminologyVersions.push({
        id: terminology,
        version,
        codeCollection: Code(terminology, version),
        wordCollection: Word(terminology, version),
      });
    }
  });
});

// Determines if the code is the root code for that terminology
const isRoot = function isRoot(code, terminology) {
  if (terminology === 'Readv2' && code === '.....00') return true;
  else if (terminology === 'EMIS' && code === '.....') return true;
  else if (terminology === 'SNOMED CT' && code === '?') return true;
  else if (!code) return true;
  return false;
};

// Get all parents of code as properties of the G[code] object
const doCode = (code, terminology, version) => {
  try {
    if (terminology === 'Readv2' && code.length === 5) code += '00';
    if (!GDone[code]) {
      if (isRoot(code, terminology)) {
        GDone[code] = true;
        return {};
      }
      G[code] = {};
      if (!mem[terminology][version][code]) {
        console.log(code);
      }
      mem[terminology][version][code].p.forEach((parent) => {
        G[code][parent] = true;
        if (!GDone[parent]) G[parent] = doCode(parent, terminology, version);
        Object.keys(G[parent]).forEach((v) => {
          G[code][v] = true;
        });

        GDone[parent] = true;
      });
      GDone[code] = true;
    }
    return G[code];
  } catch (e) {
    logger.error(e);
    logger.info(`Code: ${code}, Terminology: ${terminology}`);
    throw e;
  }
};

// Get all ancestors of a code (including if multiple inheritance) and return as an array
const getAncestorsAsArray = (code, terminology, version) =>
  Object.keys(doCode(code, terminology, version));

// Drops the collection and returns a promise
const dropCollection = async (collection) => {
  logger.info(`Dropping ${collection.modelName} if it exists...`);
  try {
    const collectionInfo = await collection.db.db
      .listCollections({ name: collection.collection.name })
      .next();
    if (collectionInfo) {
      // collection exists so we drop
      await collection.collection.drop();
      logger.info(`Collection ${collection.modelName} removed.`);
    } else {
      logger.info(`Collection ${collection.modelName} does not exist so don't need to remove.`);
    }
  } catch (err) {
    logger.error(err);
    logger.info(`Error dropping collection ${collection.modelName}`);
    process.exit(1);
  }
};

const dropCollections = async (tvs = cachedTerminologyVersions) => {
  await Promise.all(
    tvs.reduce((p, c) => {
      p.push(dropCollection(c.codeCollection));
      p.push(dropCollection(c.wordCollection));
      return p;
    }, [])
  );
};

// Adds the indexes to the collection and returns a promise
const ensureIndexes = async (collection) => {
  logger.info(`Adding indexes to ${collection.modelName}...`);
  try {
    await collection.ensureIndexes();
    logger.info(`Indexes added to ${collection.modelName}`);
  } catch (err) {
    logger.info(`Failed to add indexes to ${collection.modelName}`);
    logger.error(err);
    process.exit(1);
  }
};

const addIndexes = async (tvs = cachedTerminologyVersions) => {
  await Promise.all(
    tvs.reduce((p, c) => {
      p.push(ensureIndexes(c.codeCollection));
      p.push(ensureIndexes(c.wordCollection));
      return p;
    }, [])
  );
};

// Insert documents to mongo and then return a promise
const insertToMongo = async (collection, docs, terminology) => {
  logger.info(`${terminology}: Inserting documents for ${collection.modelName}...`);
  try {
    // const batch = Code.collection.initializeUnorderedBulkOp();
    const operations = docs.map((doc) => ({ insertOne: { document: doc } }));
    // await batch.execute();
    await collection.collection.bulkWrite(operations);
    logger.info(`${terminology}: All documents inserted for ${collection.modelName}.`);
  } catch (errInsert) {
    logger.info(`${terminology}: Documents failed to insert for ${collection.modelName}.`);
    logger.error(errInsert);
    process.exit(1);
  }
};

const uploadToMongo = async (docs, docsWithWords, terminology) => {
  await Promise.all([
    insertToMongo(terminology.codeCollection, docs, terminology.id),
    insertToMongo(terminology.wordCollection, docsWithWords, terminology.id),
  ]);
};

const splitDefinitionsIntoWords = (terminology) => {
  const wordCounter = {};
  Object.keys(mem[terminology.id][terminology.version]).forEach((v) => {
    const nword = {};
    mem[terminology.id][terminology.version][v].t.forEach((vv) => {
      if (vv) {
        vv.toLowerCase()
          .split(' ')
          .forEach((word) => {
            const trimmedWord = word.replace(/(^[^\w\d]*|[^\w\d]*$)/g, '');
            nword[trimmedWord] = true;
            const matches = trimmedWord.match(/\b[\w\d]+\b/g);
            if (!matches || matches.length === 0) {
              return;
            }
            matches.forEach((m) => {
              nword[m] = true;
            });
          });
      } else {
        logger.info(v, mem[terminology.id][terminology.version][v]);
      }
    });
    Object.keys(nword).forEach((w) => {
      if (!wordCounter[w]) wordCounter[w] = 1;
      else wordCounter[w] += 1;
    });
    mem[terminology.id][terminology.version][v].w = Object.keys(nword);
  });
  if (terminology.wordCount) {
    logger.error('should only hit this once per terminology');
  } else {
    terminology.wordCount = wordCounter;
  }
};

const createDocsForCodeCollection = (terminology, version) =>
  Object.keys(mem[terminology][version]).map((v) => {
    const ancestors = getAncestorsAsArray(v, terminology, version);
    return {
      _id: v,
      t: mem[terminology][version][v].t.join('|'),
      a: ancestors,
      p: mem[terminology][version][v].p,
      w: mem[terminology][version][v].w,
    };
  });

const createDocsForWordsCollection = (terminology) =>
  Object.keys(terminology.wordCount).map((v) => ({
    _id: v,
    n: terminology.wordCount[v],
  }));

const writeDocFiles = (docs, filepath) =>
  new Promise((resolve, reject) => {
    const transformStream = JSONStream.stringify('[\n ', ',\n ', '\n]\n');
    const outputStream = fs.createWriteStream(filepath);
    transformStream.pipe(outputStream);
    docs.forEach(transformStream.write);
    transformStream.end();

    outputStream.on('finish', resolve);
    outputStream.on('error', reject);
  });

const processInMemoryTerminologies = () => {
  terminologyVersions.forEach(async (terminology) => {
    if (!mem[terminology.id]) return;
    if (!mem[terminology.id][terminology.version]) return;
    splitDefinitionsIntoWords(terminology);

    const docs = createDocsForCodeCollection(terminology.id, terminology.version);
    const docWithWords = createDocsForWordsCollection(terminology);

    logger.info(`${terminology.id}: Writing cached doc files...`);

    await writeDocFiles(docs, join(CACHED_DIR, terminology.id, `${terminology.version}.json`));
    logger.info(`${terminology.id}: First doc file written. Writing second...`);
    await writeDocFiles(
      docWithWords,
      join(CACHED_DIR, terminology.id, `words_${terminology.version}.json`)
    );
    logger.info(`${terminology.id}: Both doc files written.`);
    // await uploadToMongo(docs, docWithWords, terminology);
  });
};

// For a given dictionary file load it and map to an object - mem
// Then determine the ancestors for each code and upload the resulting objects to mongo
const processDictionaryFile = (terminology, version, directory, file) => {
  logger.info(`${terminology}: ${file}: Loading...`);
  if (!mem[terminology]) mem[terminology] = {};
  if (!mem[terminology][version]) mem[terminology][version] = {};

  // Ignore files that don't contain 'dict.txt'
  if (file.indexOf('dict.txt') < 0) return;

  todo += 1;

  const inputStream = fs.createReadStream(join(directory, file));

  const onInputLine = (line) => {
    const bits = line.split('\t');
    if (mem[terminology][version][bits[0]]) {
      if (mem[terminology][version][bits[0]].t.indexOf(bits[1]) < 0) {
        mem[terminology][version][bits[0]].t.push(bits[1]);
      }
      if (mem[terminology][version][bits[0]].p.indexOf(bits[2]) < 0) {
        mem[terminology][version][bits[0]].p.push(bits[2]);
      }
    } else {
      mem[terminology][version][bits[0]] = {
        t: [bits[1]],
        p: [bits[2]],
      };
    }
  };

  const onInputEnd = () => {
    done += 1;
    logger.info(`${terminology}: ${file}: Read complete.`);
    if (todo === done) {
      logger.info(`${terminology}: All files read into memory.`);
      processInMemoryTerminologies();
    }
  };

  const rlInput = readline.createInterface({
    input: inputStream,
  });
  rlInput.on('line', onInputLine).on('close', onInputEnd);
};

// For a given terminology find all the data files and process them sequentially
const processTerminology = function processTerminology(terminology) {
  logger.info(`${terminology.id}: Starting processing...`);
  try {
    const directory = join(TERMINOLOGY_DIR, terminology.id, 'data-processed', terminology.version);
    fs.readdirSync(directory).forEach((file) => {
      if (file.indexOf('swp') < 0)
        processDictionaryFile(terminology.id, terminology.version, directory, file);
    });
  } catch (e) {
    logger.info(`${terminology.id}: No files found. Processing ends. `);
  }
};

const doItAll = function doItAll() {
  terminologyVersions.forEach((terminology) => {
    processTerminology(terminology);
  });
};

const loadCachedFile = (filepath) =>
  new Promise((resolve, reject) => {
    const transformStream = JSONStream.parse('*');
    const inputStream = fs.createReadStream(filepath);
    const docs = [];

    inputStream
      .pipe(transformStream)
      .on('data', (data) => {
        docs.push(data);
      })
      .on('error', reject)
      .on('end', () => {
        resolve(docs);
      });
  });

const loadCachedFiles = async (terminology, version) => {
  const result = await Promise.all([
    loadCachedFile(join(CACHED_DIR, terminology, `${version}.json`)),
    loadCachedFile(join(CACHED_DIR, terminology, `words_${version}.json`)),
  ]);
  return result;
};

const connectToMongo = () =>
  mongoose.connect(process.env.GETSET_MONGO_URL, {
    server: { socketOptions: { socketTimeoutMS: 0 } },
  });
// .then(async () => {
//   await dropCollections();

//   if (config.OVERWRITE_FILE) {
//     doItAll();
//   } else {
//     logger.info('Reading cached files..');
//     await Promise.all(

//     );

//     await addIndexes();

//     process.exit(0);
//   }
// });

const createJSON = () => {
  terminologyVersions.forEach((terminology) => {
    processTerminology(terminology);
  });
};

const uploadJSON = async (tvs = cachedTerminologyVersions) => {
  await dropCollections(tvs);
  tvs.map(async (terminology) => {
    const [docs, docWithWords] = await loadCachedFiles(terminology.id, terminology.version);
    await uploadToMongo(docs, docWithWords, terminology);
  });
  await addIndexes(tvs);
};
const ALL = 'ALL';
const separator = ' - ';

switch (process.argv[2]) {
  case 'createJSON': {
    const choices = [{ name: 'All', value: ALL }, new inquirer.Separator()].concat(
      terminologyVersions.map((x) => `${x.id}${separator}${x.version}`)
    );
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
          createJSON();
        } else {
          const [id, version] = answer.terminology.split(separator);
          const terminology = terminologyVersions.filter(
            (x) => x.id === id && x.version === version
          )[0];
          return processTerminology(terminology);
        }
      });
    break;
  }
  case 'uploadJSON': {
    const choices = [{ name: 'All', value: ALL }, new inquirer.Separator()].concat(
      cachedTerminologyVersions.map((x) => `${x.id}${separator}${x.version}`)
    );
    inquirer
      .prompt([
        {
          type: 'list',
          name: 'terminology',
          message: 'Which cached terminology file do you want to upload?',
          choices,
        },
      ])
      .then((answer) => {
        connectToMongo().then(() => {
          if (answer.terminology === ALL) {
            uploadJSON();
          } else {
            const [id, version] = answer.terminology.split(separator);
            const terminology = cachedTerminologyVersions.filter(
              (x) => x.id === id && x.version === version
            )[0];
            return uploadJSON([terminology]);
          }
        });
      });
    break;
  }
  default: {
    logger.warn(
      "You must call this with `node main.js [operation]` where [operation] is either 'createJSON' or 'uploadJSON'."
    );
  }
}
