'use strict';

global.chai       = require('chai');
global.expect     = chai.expect;
global.rewire     = require('rewire');
global.proxyquire = require('proxyquire');
global.sinon      = require('sinon');
global.chai.use(require('sinon-chai'));
global.chai.use(require('chai-as-promised'));
global.chai.use(require('chai-json'));
