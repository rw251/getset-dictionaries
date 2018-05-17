const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const CodeSchema = new Schema({
  _id: String, // The clinical code
  words: { type: [String] /* , index: true*/ }, // An array of strings of length n contained in t
}, { autoIndex: false, collection: 'codesWithWords' });

CodeSchema.index({ words: 1 }, { background: false });

const Code = mongoose.model('Code', CodeSchema);

module.exports = Code;
