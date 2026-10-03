const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Screens are 140 files deep; Metro's default watcher exhausts its file handles
// on a warm start without this.
config.resolver.nodeModulesPaths = [
  ...config.resolver.nodeModulesPaths,
  require('path').resolve(__dirname, '../../node_modules'),
];
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
