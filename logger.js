'use strict';

const winston = require('winston');
const { combine, timestamp, printf } = winston.format;

const format = printf(info => `${info.timestamp} ${info.level.toUpperCase()}: ${info.message}`);

const logger = winston.createLogger({
  format:     combine(timestamp(), format),
  transports: [ new winston.transports.Console() ]
});

module.exports = logger;
