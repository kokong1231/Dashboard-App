module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: { '@': './src' },
      },
    ],
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env.jin',
        safe: false,
        allowUndefined: false,
      },
    ],
    'react-native-reanimated/plugin', // must be last
  ],
};
