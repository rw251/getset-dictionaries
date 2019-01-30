const mongoose = require('mongoose');

const Schema = mongoose.Schema;

exports.Code = (terminologyName) => {
  const CodeSchema = new Schema({
    _id: String, // The clinical code
    t: String, // A | separated list of definitions
    a: { type: [String] }, // Ancestors in a comma delimited string
    p: { type: [String] }, // Immediate parents in a comma delimited string
    w: { type: [String] }, // An array of strings of length n contained in t
  }, { autoIndex: false, collection: `codes-${terminologyName}` });

  CodeSchema.index({ a: 1 }, { background: false });
  CodeSchema.index({ p: 1 }, { background: false });
  CodeSchema.index({ w: 1 }, { background: false });

  return mongoose.model(`Code${terminologyName}`, CodeSchema);
};

exports.Word = (terminologyName) => {
  const WordSchema = new Schema({
    _id: String, // The word
    n: Number, // Frequency of words
  }, { autoIndex: false, collection: `words-${terminologyName}` });

  return mongoose.model(`Word${terminologyName}`, WordSchema);
};

