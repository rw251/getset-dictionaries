const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const CodeSchema = new Schema({
  _id: String, // The clinical code
  t: String, // A | separated list of
  a: String, // Ancestors in a comma delimited string
  p: { type: String, index: true }, // Immediate parents in a comma delimited string
});

CodeSchema.index({ t: 'text' });

module.exports = mongoose.model('Code', CodeSchema);
