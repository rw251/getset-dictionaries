const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const TestCodeSchema = new Schema({
  _id: String, // The n char substring
  c: [String], // An array of codes containing that string
});

module.exports = mongoose.model('TestCode', TestCodeSchema);
