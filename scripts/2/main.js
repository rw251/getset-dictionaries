const fs = require('fs');
const path = require('path');
const pino = require('pino')();
const es = require('event-stream');
const mongoose = require('mongoose');
const jsonfile = require('jsonfile');
const config = require('./config.js');

mongoose.Promise = Promise;
mongoose.connect(config.MONGO_URL);
mongoose.createConnection(config.MONGO_URL_EMIS);

const CodeREAD = require('./model')();
const CodeEMIS = require('./model')('EMIS');

const terminologies = fs.readdirSync('terminologies');
const mem = {};
let todo = 0;
let done = 0;

// Determines if the code is the root code for that terminology
const isRoot = function isRoot(code, terminology) {
  if (terminology === 'Readv2' && code === '.....00') return true;
  else if (terminology === 'EMIS' && code === '.....') return true;
  else if (!code) return true;
  return false;
};


const GDone = {};
const G = {};

// Get all parents of code as properties of the G[code] object
const doCode = function doCode(code, terminology) {
  try {
    if (terminology === 'Readv2' && code.length === 5) code += '00';
    if (!GDone[code]) {
      if (isRoot(code, terminology)) {
        GDone[code] = true;
        return {};
      }
      G[code] = {};
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
const getAncestorsAsArray = function getAncestors(code, terminology) {
  return Object.keys(doCode(code, terminology));
};

const isFirstQuery = true;

const dropMongoCollection = function dropMongoCollection(terminology, callback) {
  const Code = terminology === 'Readv2' ? CodeREAD : CodeEMIS;

  // NB mlab doesn't allow listCollections
  // Code.db.db.listCollections({ name: 'codes' })
  //   .next((err, collInfo) => {
  //     if (collInfo) {
      // collection exists so we drop
  Code.collection.drop((errRemove) => {
    if (errRemove) {
      pino.error(errRemove);
      pino.info(`Cant remove from collection Code for terminology ${terminology}`);
      process.exit(1);
    }
    callback();
  });
    //   } else {
    //     callback();
    //   }
    // });
};

const insertToMongo = function insertToMongo(docs, terminology, callback) {
  const Code = terminology === 'Readv2' ? CodeREAD : CodeEMIS;
  Code.collection.insert(docs, (errInsert) => {
    if (errInsert) {
      pino.error(errInsert);
      process.exit(1);
    } else {
      pino.info(`ALL INSERTED FOR ${terminology}`);
      pino.info(`Adding indexes for ${terminology}..`);
      Code.ensureIndexes((err) => {
          // need to call this to ensure the index gets added
        if (err) {
          pino.error(err);
          process.exit(1);
        }
        pino.info(`INDEXES ADDED FOR ${terminology}`);
        callback();
      });
    }
  });
};

const uploadToMongo = function uploadToMongo(docs, terminology, callback) {
  dropMongoCollection(terminology, () => {
    insertToMongo(docs, terminology, callback);
  });
};

// For a given dictionary file load it and map to an object - mem
// Then determine the ancestors for each code and upload the resulting objects to mongo
const processDictionaryFile = function processDictionaryFile(terminology, directory, file) {
  pino.info(`Processing ${file}`);
  if (!mem[terminology]) mem[terminology] = {};
  if (file.indexOf('dict.txt') < 0) return;

  todo += 1;
  const s = fs.createReadStream(path.join(directory, file))
    .pipe(es.split())
    .pipe(es.mapSync((line) => {
      // pause the readstream
      s.pause();

      (
        function processLine() {
          // process line here and call s.resume() when rdy
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

          // resume the readstream
          s.resume();
        }()
      );
    })
      .on('end', () => {
        done += 1;
        pino.info('Read entirefile.');
        if (todo === done) {
          pino.info('ALL DONE');

          terminologies.forEach((term) => {
            if (!mem[term]) return;
            Object.keys(mem[term]).forEach((v) => {
              const nchar = {};
              mem[term][v].t.forEach((vv) => {
                if (vv) {
                  for (let i = 0; i < vv.length - 2; i += 1) {
                    if (vv[i] !== ' ') {
                      const bit = vv.substr(i, config.BIT_LENGTH).toLowerCase();
                      if (!nchar[bit]) nchar[bit] = true;
                    }
                  }
                } else {
                  pino.info(v, mem[term][v]);
                }
              });
              mem[term][v].c = Object.keys(nchar);
            });

            const docs = Object.keys(mem[term]).map((v) => {
              const ancestors = getAncestorsAsArray(v, term);
              return { _id: v, t: mem[term][v].t.join('|'), a: ancestors, p: mem[term][v].p, c: mem[term][v].c };
            });
            pino.info('Writing cached file..');
            jsonfile.writeFileSync(path.join(config.CACHED_DIR, term, config.CACHED_FILE), docs);
            pino.info('Done.');
            uploadToMongo(docs, term, () => {
              pino.info(`Done for ${term}`);
            });
          });
        }
      })
      .on('error', e => pino.error(e)));
};

// For a given terminology find all the data files and process them sequentially
const processTerminology = function processTerminology(terminology) {
  pino.info(`Processing terminology ${terminology}`);
  try {
    const directory = path.join('terminologies', terminology, 'data-processed');
    fs.readdirSync(directory).forEach((file) => {
      processDictionaryFile(terminology, directory, file);
    });
  } catch (e) {
    pino.info(`No files found for ${terminology}`);
  }
};

const doItAllForTerminology = (terminology) => {
  processTerminology(terminology);
};

const doItAll = function doItAll() {
  terminologies.forEach((terminology) => {
    processTerminology(terminology);
  });
};

if (config.OVERWRITE_FILE) {
  doItAll();
} else {
  pino.info('Reading cached files..');
  const todoLocal = terminologies.length;
  let doneLocal = 0;
  terminologies.forEach((terminology) => {
    jsonfile.readFile(path.join(config.CACHED_DIR, terminology, config.CACHED_FILE), (err, obj) => {
      if (err) {
        doneLocal += 1;
        pino.info(`No cached file found for ${terminology}`);
        doItAllForTerminology(terminology);
      } else {
        pino.info(`Cached file for ${terminology} successfully loaded into memory.`);
        uploadToMongo(obj, terminology, () => {
          doneLocal += 1;
          if (todoLocal === doneLocal) {
            console.log('All files processed. Exiting');
            process.exit(0);
          }
        });
      }
    });
  });
}

