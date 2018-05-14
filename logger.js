'use strict';

const yargs = require('yargs');
const winston = require('winston');
const { combine, timestamp, printf } = winston.format;

const format = printf(contents => `${contents.timestamp} ${contents.level.toUpperCase()}: ${contents.message}`);

const inputOptions = yargs
  .option({
    'log-level': {
      default: 'info',
      coerce:  level => level.toLowerCase()
    },
    'log-file': { },
    'log-file-level': {
      coerce:  level => level && level.toLowerCase()
    }
  });
const defaults = inputOptions.env('SNOW').argv;
const options  = inputOptions.default(defaults).env('PLUGIN').argv;

const logger = winston.createLogger({
  level:      options.logLevel,
  format:     combine(timestamp(), format),
  transports: [ new winston.transports.Console() ]
});
logger.verbose('Logging at level: ' + options.logLevel);

if (options.logFile) {
  const fileLevel = options.logFileLevel || options.logLevel;
  logger.add(new winston.transports.File({
    filename: options.logFile,
    options:  { flags: 'w' },
    level:    fileLevel
  }));
  logger.verbose(`Logging to file "${options.logFile}" at level: ${fileLevel}`);
}

module.exports = logger;
