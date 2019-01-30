const mongoose = require('mongoose');

const Schema = mongoose.Schema;

// hmm duplicate keys using Read and SNOMED (e.g. 1359000 occurs in both)
// consider making _id: {code: String, terminology: String} - or maybe term first if querying e.g. on search AND term

const CodeSchema = new Schema({
  _id: {
    d: String, // The clinical code dictionary (EMIS/Readv2/SNOMED)
    c: String, // The clinical code
  },
  t: String, // A | separated list of
  a: { type: [String] }, // Ancestors in a comma delimited string
  p: { type: [String] }, // Immediate parents in a comma delimited string
  c: { type: [String] }, // An array of strings of length n contained in t
}, { autoIndex: false });

CodeSchema.index({ a: 1 }, { background: false });
CodeSchema.index({ p: 1 }, { background: false });
CodeSchema.index({ c: 1 }, { background: false });

const CodeWordsSchema = new Schema({
  _id: {
    d: String, // The clinical code dictionary (EMIS/Readv2/SNOMED)
    c: String, // The clinical code
  },
  words: { type: [String] }, // An array of strings of length n contained in t
}, { autoIndex: false, collection: 'codesWithWords' });

CodeWordsSchema.index({ words: 1 }, { background: false });

exports.Code = mongoose.model('Code', CodeSchema);
exports.CodeWords = mongoose.model('CodeWordsSchema', CodeWordsSchema);
