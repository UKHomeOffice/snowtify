'use strict';

const logs  = require('./logger-mock/logs.json');
const shell = require('shelljs');

describe('Logger', function () {
  before('point the shell wrapper to the test directory', () => {
    this.pwd = shell.pwd().stdout;
    shell.cd('test/logger-mock');
  });

  describe('default configuration', function () {
    before(() => {
      this.result = shell.exec('./log-tester.js');
      expect(this.result).to.include.property('code', 0);
    });

    it('should log errors to stderr', () =>
      expect(this.result)
        .to.have.property('stderr')
        .that.contains(` ERROR: ${logs.error}`));
    it('should log warnings and info messages to stdout', () =>
      expect(this.result)
        .to.have.property('stdout')
        .that.contains(` WARN: ${logs.warn}`)
        .and.contains(` INFO: ${logs.info}`));
  });

  after('restore pwd', () => {
    shell.cd(this.pwd);
  });

});
