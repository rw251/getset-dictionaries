const mongoose = require('mongoose');
const config = require('./config');

const Schema = mongoose.Schema;

const CodeSchema = new Schema({
  _id: String, // The clinical code
  t: String, // A | separated list of
  a: String, // Ancestors in a comma delimited string
  p: { type: String, index: true }, // Immediate parents in a comma delimited string
});

CodeSchema.index({ t: 'text' });

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
