const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const CodeSchema = new Schema({
  _id: String, // The clinical code
  t: String, // A | separated list of
  a: String, // Ancestors in a comma delimited string
  p: { type: [String], index: true }, // Immediate parents in a comma delimited string
  c: { type: [String], index: true }, // An array of strings of length n contained in t
});

module.exports = mongoose.model('Code', CodeSchema);
