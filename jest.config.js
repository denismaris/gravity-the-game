module.exports = {
  preset: '@react-native/jest-preset',
  // Reanimated runs its web implementation under Jest; its resolver picks it.
  resolver: 'react-native-reanimated/jest/resolver',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@shopify/react-native-skia|react-native-safe-area-context|react-native-reanimated|react-native-worklets)/)',
  ],
};
