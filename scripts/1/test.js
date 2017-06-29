const mongoose = require('mongoose');
const TestCode = require('./model');

mongoose.connect(process.env.GETSET_MONGO_URL);
const BIT_LENGTH = 6;

const findTerm = function findTerm(term, n) {
  return new Promise((resolve, reject) => {
    console.time(`${term}_1`);
    const bit = term.substr(0, n).toLowerCase();
    TestCode.aggregate([
      { $match: { _id: bit } },
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
      console.timeEnd(`${term}_1`);
      console.time(`${term}_2`);
      if (err) reject(err);
      else {
        const rtn = codes.map((v) => {
          if (v.t.toLowerCase().indexOf(term.toLowerCase()) > -1) return v;
          return null;
        }).filter(v => v);
        console.timeEnd(`${term}_2`);
        resolve(rtn);
      }
    });
  });
};

const terms = ['Myocardial Infarction', 'Abdominal pain', 'Aspirin', 'Back pain', 'Chest pain', 'Otalgia', 'Headache', 'pelvic pain', 'Toothache', 'Vaginal', 'Rectal pain', 'Dermatitis'];
const promises = terms.map(term => findTerm(term, BIT_LENGTH));
console.time('TOTAL');
Promise.all(promises).then((values) => {
  console.log(values.length);
  console.timeEnd('TOTAL');
  process.exit(0);
});
