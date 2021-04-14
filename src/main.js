const fs = require('fs');
const { join } = require('path');
const parentLogger = require('./logger');
const mongoose = require('mongoose');
const readline = require('readline');
const {
  whichTerminolgiesToProcess,
  whichTerminologies,
  whichRawTerminologyToProcess,
  whatToDo,
  optionNames,
  getNumber,
} = require('./scripts/questions');
const {
  getTermVersFromProcessedData,
  getTermVersFromCache,
  getTuplesFromCache,
} = require('./scripts/file');
const { processRawTerminologies } = require('../terminologies/wrapper');
const { createTuples, getTupleStreamFromCache } = require('./scripts/tuples');
const replacements = require('./scripts/replacements');
const { Tuple } = require('./scripts/model');
require('dotenv').config();

const CACHED_DIR = join(__dirname, '..', 'cache');
const TERMINOLOGY_DIR = join(__dirname, '..', 'terminologies');

const terminologyVersions = getTermVersFromProcessedData();
const cachedTerminologyVersions = getTermVersFromCache();
const cachedTuplifiedTerminologies = getTuplesFromCache();
const mem = {};
const GDone = {};
const G = {};
let logger = parentLogger;

mongoose.Promise = Promise;

const filterOutReplacements = (wordList) =>
  wordList.filter(
    (x) => !replacements[x] || replacements[x].filter((y) => wordList.indexOf(y) > -1).length === 0
  );

// Determines if the code is the root code for that terminology
const isRoot = function isRoot(code, terminology) {
  if (terminology === 'Readv2' && code === '.....00') return true;
  else if (terminology === 'EMIS' && code === '.....') return true;
  else if (terminology === 'CTV3' && code === '.....') return true;
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
const createIndexes = async (collection) => {
  logger.info(`Adding indexes to ${collection.modelName}...`);
  try {
    await collection.createIndexes();
    logger.info(`Indexes added to ${collection.modelName}`);
  } catch (err) {
    logger.info(`Failed to add indexes to ${collection.modelName}`);
    logger.error(err);
    process.exit(1);
  }
};

const addIndexes = (tvs = cachedTerminologyVersions) =>
  Promise.all(
    tvs.map((terminology) =>
      Promise.all([
        createIndexes(terminology.codeCollection),
        createIndexes(terminology.wordCollection),
      ])
    )
  );

// Insert documents to mongo and then return a promise
const insertToMongo = async (collection, docs, terminology) => {
  logger.info(`${terminology}: Inserting documents for ${collection.modelName}...`);
  try {
    const operations = docs.map((doc) => ({ insertOne: { document: doc } }));
    await collection.collection.bulkWrite(operations, { ordered: false });
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

/**
 * Takes the string definitions and splits them into words
 * @param {object} terminology The terminology to work on
 */
const splitDefinitionsIntoWords = (terminology) => {
  const wordCounter = {};
  Object.keys(mem[terminology.id][terminology.version]).forEach((v) => {
    const nword = {};
    mem[terminology.id][terminology.version][v].t.forEach((vv) => {
      if (vv) {
        vv.toLowerCase() // make case consistent
          .replace(/\[/g, ' [') // add extra space before and after parentheses
          .replace(/\]/g, '] ') // add extra space before and after parentheses
          .replace(/\(/g, ' (') // add extra space before and after parentheses
          .replace(/\)/g, ') ') // add extra space before and after parentheses
          .replace(/,([^ 0-9])/g, ', $1') // add space after commas UNLESS it's followed by a number e.g. 1,000
          .split(' ') // separate into "words" by splitting on spaces
          .forEach((word) => {
            // trim any non-alphanumeric characters from the word
            const trimmedWord = word.replace(/(^[^\w\d]*|[^\w\d]*$)/g, '');

            if (trimmedWord === '') return; // was just non-alphanumeric characters

            nword[trimmedWord] = true;

            // check for word boundaries "\b" within the trimmed word
            // this will never be spaces because of the earlier split, but
            // might be things like "one/two". We want to keep "one/two" as
            // a single word (in case it's important to search for it), but also
            // to add "one" and "two" separately.
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
    mem[terminology.id][terminology.version][v].w = filterOutReplacements(Object.keys(nword));
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
    const Stream = require('stream');
    const readable = new Stream.Readable();

    const outputStream = fs.createWriteStream(filepath);
    readable.pipe(outputStream);

    // Start of array
    readable.push(`[\n ${JSON.stringify(docs[0])}`);

    // Array items
    docs.slice(1).forEach((item) => readable.push(`,\n ${JSON.stringify(item)}`));

    // End of array
    readable.push('\n]\n');
    // no more data
    readable.push(null);

    outputStream.on('finish', () => {
      logger.info(`${filepath} written to disk.`);
      return resolve();
    });
    outputStream.on('error', reject);
  });

const processInMemoryTerminologies = () =>
  Promise.all(
    terminologyVersions.map((terminology) => {
      if (!mem[terminology.id]) return Promise.resolve();
      if (!mem[terminology.id][terminology.version]) return Promise.resolve();
      splitDefinitionsIntoWords(terminology);

      const docs = createDocsForCodeCollection(terminology.id, terminology.version);
      const docWithWords = createDocsForWordsCollection(terminology);

      logger.info(`${terminology.id}: Writing cached doc files...`);

      return writeDocFiles(
        docs,
        join(CACHED_DIR, terminology.id, `${terminology.version}.json`)
      ).then(() => {
        logger.info(`${terminology.id}: First doc file written. Writing second...`);
        return writeDocFiles(
          docWithWords,
          join(CACHED_DIR, terminology.id, `words_${terminology.version}.json`)
        );
      });
    })
  );

// For a given dictionary file load it and map to an object - mem
// Then determine the ancestors for each code and upload the resulting objects to mongo
const processDictionaryFile = (terminology, version, directory, file) =>
  new Promise((resolve) => {
    logger.info(`${terminology}: ${file}: Loading...`);
    if (!mem[terminology]) mem[terminology] = {};
    if (!mem[terminology][version]) mem[terminology][version] = {};

    // Ignore files that don't contain 'dict.txt'
    if (file.indexOf('dict.txt') < 0) return;

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
      logger.info(`${terminology}: ${file}: Read complete.`);
      resolve();
      // if (todo === done) {
      //   logger.info(`${terminology}: All files read into memory.`);
      //   return resolve(3);
      //   // return processInMemoryTerminologies().then(() => {
      //   //   logger.info('My message debug 123');
      //   //   resolve();
      //   // });
      // }
    };

    const rlInput = readline.createInterface({
      input: inputStream,
    });
    rlInput.on('line', onInputLine).on('close', onInputEnd);
  });

// For a given terminology find all the data files and process them sequentially
const processTerminology = (terminology) => {
  logger.info(`${terminology.id}: Starting processing...`);
  const directory = join(TERMINOLOGY_DIR, terminology.id, 'data-processed', terminology.version);
  const proms = fs
    .readdirSync(directory)
    .map((file) =>
      file.indexOf('swp') < 0
        ? processDictionaryFile(terminology.id, terminology.version, directory, file)
        : Promise.resolve()
    );
  return Promise.all(proms).catch(() => {
    logger.info(`${terminology.id}: No files found. Processing ends. `);
  });
};

const loadCachedFile = (filepath) =>
  new Promise((resolve, reject) => {
    fs.readFile(filepath, 'utf8', (err, data) => {
      if (err) return reject(err);
      const docs = JSON.parse(data);
      resolve(docs);
    });
  });

const loadCachedFiles = async (terminology, version) => {
  logger.info(`${terminology}: ${version}: Loading files from cache...`);
  const result = await Promise.all([
    loadCachedFile(join(CACHED_DIR, terminology, `${version}.json`)),
    loadCachedFile(join(CACHED_DIR, terminology, `words_${version}.json`)),
  ]);
  logger.info(`${terminology}: ${version}: Files loaded into memory.`);
  return result;
};

const connectToMongo = () =>
  mongoose.connect(process.env.GETSET_MONGO_URL, {
    socketTimeoutMS: 0,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

const disconnectFromMongo = () => mongoose.disconnect();

const createJSON = (tvs = terminologyVersions) => {
  const proms = tvs.map(async (terminology) => processTerminology(terminology));
  return Promise.all(proms).then(() => processInMemoryTerminologies());
};

const uploadJSON = async (tvs = cachedTerminologyVersions, shouldAddIndexes = true) => {
  await connectToMongo();
  await dropCollections(tvs);
  await Promise.all(
    tvs.map(async (terminology) => {
      const [docs, docWithWords] = await loadCachedFiles(terminology.id, terminology.version);
      return uploadToMongo(docs, docWithWords, terminology);
    })
  );
  if (shouldAddIndexes) await addIndexes(tvs);
  await disconnectFromMongo();
};

const justAddIndexes = async (tvs = cachedTerminologyVersions) => {
  await connectToMongo();
  await addIndexes(tvs);
  await disconnectFromMongo();
};

const dropTupleCollection = async (collection) => {
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

const uploadTuple = async (collection, docs) => {
  logger.info(`Inserting tuple documents for ${collection.modelName}...`);
  try {
    const operations = docs.map((doc) => ({ insertOne: { document: doc } }));
    await collection.collection.bulkWrite(operations, { ordered: false });
    logger.info(`All tuple documents inserted for ${collection.modelName}.`);
  } catch (errInsert) {
    logger.info(`Tuple documents failed to insert for ${collection.modelName}.`);
    logger.error(errInsert);
    process.exit(1);
  }
};

const applyOperations = async (collection, operations) => {
  logger.info(`Inserting tuple documents for ${collection.modelName}...`);
  try {
    await collection.collection.bulkWrite(operations, { ordered: false });
    logger.info(`All tuple documents inserted for ${collection.modelName}.`);
  } catch (errInsert) {
    logger.info(`Tuple documents failed to insert for ${collection.modelName}.`);
    logger.error(errInsert);
    process.exit(1);
  }
};

const getTupleOperations = (tupleStream) =>
  new Promise((resolve) => {
    logger.info(`Constructing tuple insert operations...`);
    const readline = require('readline');
    const rl = readline.createInterface({
      input: tupleStream,
    });
    const operations = [];
    rl.on('line', (line) => {
      operations.push({ insertOne: { document: JSON.parse(line) } });
    });
    rl.on('close', () => {
      logger.info(`Finished constructing ${operations.length} insert operations.`);
      resolve(operations);
    });
  });

const main = async () => {
  const letsDo = await whatToDo();
  console.log(letsDo);
  switch (letsDo) {
    case optionNames.fromFormatToJSON: {
      const terminologiesToCreate = await whichTerminolgiesToProcess(terminologyVersions);
      await createJSON(terminologiesToCreate);
      return main();
    }
    case optionNames.uploadAndIndex: {
      const terminologiesToUpload = await whichTerminologies(cachedTerminologyVersions);
      await uploadJSON(terminologiesToUpload, true);
      return main();
    }
    case optionNames.uploadJSON: {
      const terminologiesToUpload = await whichTerminologies(cachedTerminologyVersions);
      await uploadJSON(terminologiesToUpload, false);
      return main();
    }
    case optionNames.addIndexes: {
      const terminologiesToUpload = await whichTerminologies(cachedTerminologyVersions);
      await justAddIndexes(terminologiesToUpload);
      return main();
    }
    case optionNames.fromRawToFormat: {
      const terminologyToProcess = await whichRawTerminologyToProcess();
      await processRawTerminologies(terminologyToProcess);
      return main();
    }
    case optionNames.createTuples: {
      const terminolgyToTuplify = await whichTerminologies(
        cachedTerminologyVersions,
        'tuplify',
        false
      );
      const n = await getNumber();
      await createTuples(n, terminolgyToTuplify[0]);
      return main();
    }
    case optionNames.uploadTuples: {
      const selection = await whichTerminologies(
        cachedTuplifiedTerminologies,
        'upload the tuplified version',
        false
      );
      const { id, version, tuple } = selection[0];

      const tupleStream = getTupleStreamFromCache({ id, version, tuple });
      const operations = await getTupleOperations(tupleStream);
      await connectToMongo();
      const tupleCollection = Tuple(id, version, tuple);
      await dropTupleCollection(tupleCollection);
      await applyOperations(tupleCollection, operations);
      await disconnectFromMongo();
      // const cachedData = loadTupleFromCache({ id, version, tuple });
      // await connectToMongo();
      // const tupleCollection = Tuple(id, version, tuple);
      // await dropTupleCollection(tupleCollection);
      // await uploadTuple(tupleCollection, cachedData);
      // await disconnectFromMongo();
      return main();
    }
  }
};

// Catch any attempt to kill the process e.g. CTRL-C / CMD-C and
// exit gracefully
process.kill = () => {
  process.stdout.write('\n\n');
  logger.info('Exiting...');
  logger.info('Thanks for using. Have a nice day!');
  process.exit();
};

main()
  .then(() => {
    logger.info('all done');
  })
  .catch((e) => {
    logger.error(e);
  });
