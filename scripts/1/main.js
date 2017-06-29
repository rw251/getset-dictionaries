const fs = require('fs');
const path = require('path');
const pino = require('pino')();
const es = require('event-stream');
const mongoose = require('mongoose');
const jsonfile = require('jsonfile');
const config = require('./config.js');

mongoose.connect(config.MONGO_URL);

const TestCode = require('./model');

const terminologies = fs.readdirSync('terminologies');
const mem = {};
let todo = 0;
let done = 0;

const uploadToMongo = function uploadToMongo(docs) {
  TestCode.collection.drop((errRemove) => {
    if (errRemove) {
      pino.error(errRemove);
      pino.info('Cant remove from collection TestCode');
      process.exit(1);
    }
    TestCode.collection.insert(docs, (errInsert) => {
      if (errInsert) {
        pino.error(errInsert);
        process.exit(1);
      } else {
        pino.info('ALL INSERTED.');
        pino.info('Adding indexes..');
        TestCode.ensureIndexes((err) => {
          // need to call this to ensure the index gets added
          if (err) {
            pino.error(err);
            process.exit(1);
          }
          pino.info('INDEXES ADDED');
          process.exit(0);
        });
      }
    });
  });
};

// For a given dictionary file load it and map to an object - mem
// Then determine the ancestors for each code and upload the resulting objects to mongo
const processDictionaryFile = function processDictionaryFile(terminology, directory, file) {
  pino.info(`Processing ${file}`);
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
          if (mem[bits[0]]) {
            if (mem[bits[0]].t.indexOf(bits[1]) < 0) {
              mem[bits[0]].t.push(bits[1]);
            }
          } else {
            mem[bits[0]] = {
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

          const nchar = {};
          Object.keys(mem).forEach((v) => {
            mem[v].t.forEach((vv) => {
              if (vv) {
                for (let i = 0; i < vv.length - 2; i += 1) {
                  if (vv[i] !== ' ') {
                    const bit = vv.substr(i, config.BIT_LENGTH).toLowerCase();
                    if (!nchar[bit]) nchar[bit] = {};
                    nchar[bit][v] = true;
                  }
                }
              } else {
                pino.info(v, mem[v]);
              }
            });
          });
          const docs = Object.keys(nchar).map(v => ({ _id: v, c: Object.keys(nchar[v]) }));
          pino.info('Writing cached file..');
          jsonfile.writeFileSync(config.CACHED_FILE, docs);
          pino.info('Done.');
          uploadToMongo(docs);
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

const doItAll = function doItAll() {
  terminologies.forEach((terminology) => {
    processTerminology(terminology);
  });
};

if (config.OVERWRITE_FILE) {
  doItAll();
} else {
  pino.info('Reading cached file..');
  jsonfile.readFile(config.CACHED_FILE, (err, obj) => {
    if (err) {
      pino.info('Not found.');
      doItAll();
    } else {
      pino.info('Done.');
      uploadToMongo(obj);
    }
  });
}

