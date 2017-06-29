const mongoose = require('mongoose');
const TestCode = require('./model');
const bench = require('../benchmark.js');
const config = require('./config.js');

mongoose.connect(config.MONGO_URL);

const findTerm = function findTerm(term, n) {
  return new Promise((resolve, reject) => {
   // console.time(`${term}`);
    const bit = term.substr(0, n).toLowerCase();
    let match = { c: bit };
    if (bit.length < n) {
      const reg = new RegExp(`^${bit}`);
      match = { c: { $regex: reg } };
    }
    TestCode.find(match, { c: 0 }, (err, codes) => {
      if (err) reject(err);
      else {
        const rtn = codes.map((v) => {
          if (v.t.toLowerCase().indexOf(term.toLowerCase()) > -1) return v;
          return null;
        }).filter(v => v);
       // console.timeEnd(`${term}`);
        resolve(rtn);
      }
    });
  });
};

const doTest = function doTest() {
  return new Promise((resolve, reject) => {
    const terms = ['Myocardial Infarction', 'Abdominal pain', 'Aspirin', 'Back pain', 'Chest pain', 'Otalgia', 'Headache', 'pelvic pain', 'Toothache', 'Vaginal', 'Rectal pain', 'Dermatitis'];
    const promises = terms.map(term => findTerm(term, config.BIT_LENGTH));

    console.time('TOTAL');
    Promise.all(promises)
      .catch((err) => {
        reject(err);
      })
      .then((values) => {
        console.timeEnd('TOTAL');
        resolve(values);
      });
  });
};

bench.execute(doTest, 100).then((avg) => {
  console.log(avg);
  process.exit(0);
});

/*
 *  BIT_LENGTH=4
 *  "ns" : "getset.testcodes",
    "size" :            154MB,
    "count" :           166122,
    "avgObjSize" :      977,
    "storageSize" :     167MB,
    "totalIndexSize" :  252MB,

    0.123s
 *
 *  BIT_LENGTH=5
 *  "ns" : "getset.testcodes",
    "size" :            173MB,
    "count" :           166122,
    "avgObjSize" :      1093,
    "storageSize" :     232MB,
    "totalIndexSize" :  262MB,

    0.0684s
 *
 *  BIT_LENGTH=6
 *  "ns" : "getset.testcodes",
    "size" :            192MB,
    "count" :           166122,
    "avgObjSize" :      1212,
    "storageSize" :     232MB,
    "totalIndexSize" :  265MB,

    0.0473s (localhost)
    0.139s (mlab)

 *  BIT_LENGTH=7
 *  "ns" : "getset.testcodes",
    "size" :            206MB,
    "count" :           166122,
    "avgObjSize" :      1302,
    "storageSize" :     232MB,
    "totalIndexSize" :  289MB,

    0.0380s
 *
 *
 *
 *
 */

