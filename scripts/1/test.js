const mongoose = require('mongoose');
const TestCode = require('./model');
const bench = require('../benchmark.js');
const config = require('./config.js');

mongoose.connect(config.MONGO_URL);

const findTerm = function findTerm(term, n) {
  return new Promise((resolve, reject) => {
   // console.time(`${term}`);
    const bit = term.substr(0, n).toLowerCase();
    let match = { _id: bit };
    if (bit.length < n) {
      const reg = new RegExp(`^${bit}`);
      match = { _id: { $regex: reg } };
    }
    TestCode.aggregate([
      { $match: match },
      { $unwind: '$c' },
      {
        $lookup:
        {
          from: 'codes',
          localField: 'c',
          foreignField: '_id',
          as: 'cc',
        },
      },
      { $unwind: '$cc' },
      { $project: { _id: '$cc._id', t: '$cc.t', a: '$cc.a', p: '$cc.p' } },
    ], (err, codes) => {
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
    "size" :            185MB,
    "count" :           159102,
    "avgObjSize" :      1217,
    "storageSize" :     232MB,
    "totalIndexSize" :  5MB,

    0.156
 *
 *  BIT_LENGTH=5
 *  "ns" : "getset.testcodes",
    "size" :            178MB,
    "count" :           399881,
    "avgObjSize" :      465,
    "storageSize" :     232MB,
    "totalIndexSize" :  13MB,

    0.0863
 *
 *  BIT_LENGTH=6
 *  "ns" : "getset.testcodes",
    "size" :            215MB,
    "count" :           763497,
    "avgObjSize" :      295,
    "storageSize" :     232MB,
    "totalIndexSize" :  26MB,

    0.0566

 *  BIT_LENGTH=7
 *  "ns" : "getset.testcodes",
    "size" :            205MB,
    "count" :           1031820,
    "avgObjSize" :      208,
    "storageSize" :     232MB,
    "totalIndexSize" :  36MB,

    0.0480
 *
 *
 *
 *
 */

