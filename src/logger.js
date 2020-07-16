const chalk = require('chalk');
const logger = require('pino')({
  prettyPrint: {
    ignore: 'pid,hostname,terminology,version',
    messageFormat: '{terminology}>{version}> {msg}',
    translateTime: 'yyyy-mm-dd HH:MM:ss',
    customPrettifiers: {
      terminology: (value) => {
        return chalk.blue.bgRed.bold(value + '!');
      },
    },
  },
});
module.exports = logger;
