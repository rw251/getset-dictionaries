const fs = require('fs');
const path = require('path');
const pino = require('pino')();
const mongoose = require('mongoose');
const readline = require('readline');
const JSONStream = require('JSONStream');
const config = require('./config.js');

const CACHED_DIR = 'cache';

mongoose.Promise = Promise;

const { Code, Word } = require('./model');

const terminologies = fs.readdirSync('terminologies').map(terminology => ({
  id: terminology,
  codeCollection: Code(terminology),
  wordCollection: Word(terminology),
}));
const mem = {};
let todo = 0;
let done = 0;

// Determines if the code is the root code for that terminology
const isRoot = function isRoot(code, terminology) {
  if (terminology === 'Readv2' && code === '.....00') return true;
  else if (terminology === 'EMIS' && code === '.....') return true;
  else if (terminology === 'SNOMED CT' && code === '?') return true;
  else if (!code) return true;
  return false;
};

const GDone = {};
const G = {};

// Get all parents of code as properties of the G[code] object
const doCode = (code, terminology) => {
  try {
    if (terminology === 'Readv2' && code.length === 5) code += '00';
    if (!GDone[code]) {
      if (isRoot(code, terminology)) {
        GDone[code] = true;
        return {};
      }
      G[code] = {};
      if (!mem[terminology][code]) {
        console.log(code);
      }
      mem[terminology][code].p.forEach((parent) => {
        G[code][parent] = true;
        if (!GDone[parent]) G[parent] = doCode(parent, terminology);
        Object.keys(G[parent]).forEach((v) => {
          G[code][v] = true;
        });

        GDone[parent] = true;
      });
      GDone[code] = true;
    }
    return G[code];
  } catch (e) {
    pino.error(e);
    pino.info(`Code: ${code}, Terminology: ${terminology}`);
    throw (e);
  }
};

// Get all ancestors of a code (including if multiple inheritance) and return as an array
const getAncestorsAsArray = (code, terminology) => Object.keys(doCode(code, terminology));

// Drops the collection and returns a promise
const dropCollection = async (collection) => {
  pino.info(`Dropping ${collection.modelName} if it exists...`);
  try {
    const collectionInfo = await collection.db.db
      .listCollections({ name: collection.collection.name }).next();
    if (collectionInfo) {
      // collection exists so we drop
      await collection.collection.drop();
      pino.info(`Collection ${collection.modelName} removed.`);
    } else {
      pino.info(`Collection ${collection.modelName} does not exist so don't need to remove.`);
    }
  } catch (err) {
    pino.error(err);
    pino.info(`Error dropping collection ${collection.modelName}`);
    process.exit(1);
  }
};

const dropCollections = async () => {
  await Promise.all(terminologies.reduce((p, c) => {
    p.push(dropCollection(c.codeCollection));
    p.push(dropCollection(c.wordCollection));
    return p;
  }, []));
};

// Adds the indexes to the collection and returns a promise
const ensureIndexes = async (collection) => {
  pino.info(`Adding indexes to ${collection.modelName}...`);
  try {
    await collection.ensureIndexes();
    pino.info(`Indexes added to ${collection.modelName}`);
  } catch (err) {
    pino.info(`Failed to add indexes to ${collection.modelName}`);
    pino.error(err);
    process.exit(1);
  }
};

const addIndexes = async () => {
  await Promise.all(terminologies.reduce((p, c) => {
    p.push(ensureIndexes(c.codeCollection));
    p.push(ensureIndexes(c.wordCollection));
    return p;
  }, []));
};

// Insert documents to mongo and then return a promise
const insertToMongo = async (collection, docs, terminology) => {
  pino.info(`Inserting documents for ${collection.modelName} and ${terminology}`);
  try {
    // const batch = Code.collection.initializeUnorderedBulkOp();
    const operations = docs.map(doc => ({ insertOne: { document: doc } }));
    // await batch.execute();
    await collection.collection.bulkWrite(operations);
    pino.info(`All documents inserted for ${collection.modelName} and ${terminology}`);
  } catch (errInsert) {
    pino.info(`Documents failed to insert for ${collection.modelName} and ${terminology}`);
    pino.error(errInsert);
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
  Object.keys(mem[terminology.id]).forEach((v) => {
    const nword = {};
    mem[terminology.id][v].t.forEach((vv) => {
      if (vv) {
        vv.toLowerCase().split(' ')
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
        pino.info(v, mem[terminology.id][v]);
      }
    });
    Object.keys(nword).forEach((w) => {
      if (!wordCounter[w]) wordCounter[w] = 1;
      else wordCounter[w] += 1;
    });
    mem[terminology.id][v].w = Object.keys(nword);
  });
  if (terminology.wordCount) {
    pino.error('should only hit this once per terminology');
  } else {
    terminology.wordCount = wordCounter;
  }
};

const createDocsForCodeCollection = terminology => Object.keys(mem[terminology]).map((v) => {
  const ancestors = getAncestorsAsArray(v, terminology);
  return {
    _id: v,
    t: mem[terminology][v].t.join('|'),
    a: ancestors,
    p: mem[terminology][v].p,
    w: mem[terminology][v].w,
  };
});

const createDocsForWordsCollection = terminology =>
  Object.keys(terminology.wordCount).map(v => ({ _id: v, n: terminology.wordCount[v] }));

const writeDocFiles = (docs, filepath) => new Promise((resolve, reject) => {
  const transformStream = JSONStream.stringify();
  const outputStream = fs.createWriteStream(filepath);
  transformStream.pipe(outputStream);
  docs.forEach(transformStream.write);
  transformStream.end();

  outputStream.on('finish', () => { resolve(); });
  outputStream.on('error', reject);
});

const processInMemoryTerminologies = () => {
  terminologies.forEach(async (terminology) => {
    if (!mem[terminology.id]) return;
    splitDefinitionsIntoWords(terminology);

    const docs = createDocsForCodeCollection(terminology.id);
    const docWithWords = createDocsForWordsCollection(terminology);

    pino.info(`Writing cached doc files for ${terminology.id}..`);

    await writeDocFiles(docs, path.join(CACHED_DIR, terminology.id, CACHED_FILE));
    pino.info(`1 doc file written for ${terminology.id}..`);
    await writeDocFiles(docWithWords, path.join(CACHED_DIR, terminology.id, `words_${CACHED_FILE}`));
    pino.info(`Both doc files written for ${terminology.id}..`);
    await uploadToMongo(docs, docWithWords, terminology);
  });
};

// For a given dictionary file load it and map to an object - mem
// Then determine the ancestors for each code and upload the resulting objects to mongo
const processDictionaryFile = (terminology, directory, file) => {
  pino.info(`Processing ${file} for ${terminology}`);
  if (!mem[terminology]) mem[terminology] = {};

  // Ignore files that don't contain 'dict.txt'
  if (file.indexOf('dict.txt') < 0) return;

  todo += 1;

  const inputStream = fs.createReadStream(path.join(directory, file));

  const onInputLine = (line) => {
    const bits = line.split('\t');
    if (mem[terminology][bits[0]]) {
      if (mem[terminology][bits[0]].t.indexOf(bits[1]) < 0) {
        mem[terminology][bits[0]].t.push(bits[1]);
      }
      if (mem[terminology][bits[0]].p.indexOf(bits[2]) < 0) {
        mem[terminology][bits[0]].p.push(bits[2]);
      }
    } else {
      mem[terminology][bits[0]] = {
        t: [bits[1]],
        p: [bits[2]],
      };
    }
  };

  const onInputEnd = () => {
    done += 1;
    pino.info(`Read complete for ${file} and ${terminology}`);
    if (todo === done) {
      pino.info('All files read into memory.');
      processInMemoryTerminologies();
    }
  };

  const rlInput = readline.createInterface({
    input: inputStream,
  });
  rlInput
  .on('line', onInputLine)
  .on('close', onInputEnd);
};

// For a given terminology find all the data files and process them sequentially
const processTerminology = function processTerminology(terminology) {
  pino.info(`Processing ${terminology.id}`);
  try {
    const directory = path.join('terminologies', terminology.id, 'data-processed');
    fs.readdirSync(directory).forEach((file) => {
      if (file.indexOf('swp') < 0) processDictionaryFile(terminology.id, directory, file);
    });
  } catch (e) {
    pino.info(`No files found for ${terminology.id}`);
  }
};

const doItAll = function doItAll() {
  terminologies.forEach((terminology) => {
    processTerminology(terminology);
  });
};

const loadCachedFile = filepath => new Promise((resolve, reject) => {
  const transformStream = JSONStream.parse('*');
  const inputStream = fs.createReadStream(filepath);
  const docs = [];

  inputStream
    .pipe(transformStream)
    .on('data', (data) => {
      docs.push(data);
    })
    .on('error', reject)
    .on('end', () => { resolve(docs); });
});

const loadCachedFiles = async (terminology) => {
  const result = await Promise.all([
    loadCachedFile(path.join(CACHED_DIR, terminology, CACHED_FILE)),
    loadCachedFile(path.join(CACHED_DIR, terminology, `words_${CACHED_FILE}`)),
  ]);
  return result;
};

mongoose.connect(config.MONGO_URL, {
  server: {
    socketOptions: {
      socketTimeoutMS: 0,
    },
  },
}).then(async () => {
  await dropCollections();

  if (config.OVERWRITE_FILE) {
    doItAll();
  } else {
    pino.info('Reading cached files..');
    await Promise.all(terminologies.map(async (terminology) => {
      const [docs, docWithWords] = await loadCachedFiles(terminology.id);

      await uploadToMongo(docs, docWithWords, terminology);
    }));

    await addIndexes();

    process.exit(0);
  }
});
