const logger = require('pino')({
  prettyPrint: {
    ignore: 'pid,hostname,terminology,version',
    messageFormat: '{terminology}>{version}> {msg}',
    translateTime: 'yyyy-mm-dd HH:MM:ss',
  },
});
module.exports = logger;
