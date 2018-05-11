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
  level:      options['log-level'],
  format:     combine(timestamp(), format),
  transports: [ new winston.transports.Console() ]
});

if (options['log-file']) {
  logger.add(new winston.transports.File({
    filename: options['log-file'],
    options:  { flags: 'w' },
    level:    options['log-file-level'] || options['log-level']
  }));
}

module.exports = logger;
