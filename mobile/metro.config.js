/**
 * Metro configuration
 * Fixes TypeScript stripping issue with Node.js 24+ and Expo SDK 57
 */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable TypeScript stripping for node_modules (Node.js 24+ compatibility)
config.resolver.unstable_enablePackageExports = false;
config.resolver.unstable_conditionNames = ['require', 'default'];

// Use legacy TypeScript transformer
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
};

// Ensure proper module resolution
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

module.exports = config;