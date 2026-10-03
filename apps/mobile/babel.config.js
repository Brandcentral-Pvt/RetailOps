module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    // react-native-worklets must stay last — Reanimated 4 reads it.
    plugins: ['react-native-worklets/plugin'],
  };
};
