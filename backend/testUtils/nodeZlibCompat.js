'use strict';
// Jest 25 cannot resolve the Node 22 'node:zlib' specifier from Express 5.
// Re-export the actual Node builtin without mocking compression behavior.
module.exports = require('zlib');
