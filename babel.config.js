module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Reanimated's worklets - must stay the last plugin.
  plugins: ['react-native-worklets/plugin'],
};
