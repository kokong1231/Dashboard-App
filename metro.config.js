const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    extraNodeModules: {
      // @env is transformed by react-native-dotenv (Babel plugin) at compile time.
      // This stub lets Metro resolve the module path without failing.
      '@env': path.resolve(__dirname, 'env-stub.js'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
