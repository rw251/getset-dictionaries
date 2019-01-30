const fs = require('fs');
const path = require('path');
const pino = require('pino')();
const es = require('event-stream');
const mongoose = require('mongoose');
const jsonfile = require('jsonfile');
const config = require('./config.js');

mongoose.Promise = Promise;
mongoose.connect(config.MONGO_URL);
// TODO IN THE MIDDLE OF CHANGING THIS SO THAT EVERYTHING
// IE ALL TERMINOLOGIES GO TO THE GETSET DB ON THE MONGO TEST
// SERVER
const Code = require('./model');

const terminologies = fs.readdirSync('terminologies');
const mem = {};
let todo = 0;
let done = 0;

const dropMongoCollection = function dropMongoCollection(terminology, callback) {
  // NB mlab doesn't allow listCollections
  Code.db.db.listCollections({ name: 'codes' })
    .next((err, collInfo) => {
      if (collInfo) {
  // collection exists so we drop
        Code.collection.drop((errRemove) => {
          if (errRemove) {
            pino.error(errRemove);
            pino.info(`Cant remove from collection Code for terminology ${terminology}`);
            process.exit(1);
          }
          callback();
        });
      } else {
        callback();
      }
    });
};

const insertToMongo = function insertToMongo(docs, terminology, callback) {
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
          } else {
            mem[terminology][bits[0]] = {
              t: [bits[1]],
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
                  // spilt into words > 2 chars long
                  const matches = vv.toLowerCase().match(/\b(\w\w\w+)\b/g);
                  if (!matches || matches.length === 0) return;
                  matches.forEach((m) => {
                    nchar[m] = true;
                  });
                } else {
                  pino.info(v, mem[term][v]);
                }
              });
              mem[term][v].words = Object.keys(nchar);
            });

            const docs = Object.keys(mem[term]).map(v => ({ _id: v, t: mem[term][v].t.join('|'), words: mem[term][v].words }));
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
    if (terminology !== 'SNOMED CT') return;
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
    if (terminology !== 'Readv2') {
      doneLocal += 1;
      return;
    }
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

