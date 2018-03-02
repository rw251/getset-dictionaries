const mongoose = require('mongoose');
const config = require('./config');

const Schema = mongoose.Schema;

const CodeSchema = new Schema({
  _id: String, // The clinical code
  t: String, // A | separated list of
  a: { type: [String] /* , index: true*/ }, // Ancestors in a comma delimited string
  p: { type: [String] /* , index: true*/ }, // Immediate parents in a comma delimited string
  c: { type: [String] /* , index: true*/ }, // An array of strings of length n contained in t
}, { autoIndex: false });

CodeSchema.index({ a: 1 }, { background: false });
CodeSchema.index({ p: 1 }, { background: false });
CodeSchema.index({ c: 1 }, { background: false });

module.exports = (terminology) => {
  let model = mongoose.model('Code', CodeSchema);
  switch (terminology) {
    case 'EMIS':
      model = mongoose.createConnection(config.MONGO_URL_EMIS).model('Code', CodeSchema);
      break;
    default:
  }
  return model;
};
