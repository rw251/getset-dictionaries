const chalk = require('chalk');
const logger = require('pino')({
  prettyPrint: {
    ignore: 'pid,hostname,terminology,version',
    messageFormat: '{terminology}>{version}> {msg}',
    customPrettifiers: {
      terminology: (value) => {
        return chalk.blue.bgRed.bold(value + '!');
      },
    },
  },
});
module.exports = logger;
