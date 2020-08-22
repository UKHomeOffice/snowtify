#!/usr/bin/env node

'use strict';

const logger = require('../../src/logger');
const logs   = require('./logs.json');

Object.keys(logs).forEach(level => logger.log(level, logs[level]));
