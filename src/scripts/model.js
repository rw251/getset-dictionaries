const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Each version of each terminology gets its own mongo collection
 * containing the code as the _id, then information on the code
 * description, parent and ancestor concepts, and an array of the
 * individual words in the description
 * @param {string} terminologyName
 * @param {string} version
 */
exports.Code = (terminologyName, version) => {
  const CodeSchema = new Schema(
    {
      _id: String, // The clinical code
      t: String, // A | separated list of definitions
      a: { type: [String] }, // Ancestors in a comma delimited string
      p: { type: [String] }, // Immediate parents in a comma delimited string
      w: { type: [String] }, // An array of strings of length n contained in t
    },
    { autoIndex: false, collection: `codes-${terminologyName}-${version}` }
  );

  CodeSchema.index({ a: 1 }, { background: false });
  CodeSchema.index({ p: 1 }, { background: false });
  CodeSchema.index({ w: 1 }, { background: false });

  return mongoose.model(`Code${terminologyName}${version}`, CodeSchema);
};

/**
 *
 * @param {string} terminologyName
 * @param {string} version
 */
exports.Word = (terminologyName, version) => {
  const WordSchema = new Schema(
    {
      _id: String, // The word
      n: Number, // Frequency of words
    },
    { autoIndex: false, collection: `words-${terminologyName}-${version}` }
  );

  return mongoose.model(`Word${terminologyName}${version}`, WordSchema);
};

/**
 *
 * @param {string} terminologyName
 * @param {string} version
 */
exports.Tuple = (terminologyName, version, tuple) => {
  const TupleSchema = new Schema(
    {
      _id: String, // The || separated words in the n-tuple
      n: Number, // Frequency of the n-tuple
    },
    { autoIndex: false, collection: `tuples-${terminologyName}-${version}-${tuple}-tuple` }
  );

  return mongoose.model(`Tuple${terminologyName}${version}-${tuple}tuple`, TupleSchema);
};
