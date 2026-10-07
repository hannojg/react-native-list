/** @type {import('react-native-worklets/plugin').PluginOptions} */
const workletsPluginOptions = {
  // globals: ['React'],
  bundleMode: true,
  importForwarding: {
    moduleNames: [
      "react",
      "react-native-list",
      "react-native-reanimated",
      "react-native-worklets",
      "react-native",
      "_reactNative",
      "react-native-nitro-modules",
      "expo-modules-core",
      "expo",
    ],
  },
  // TODO: test with setting this to true, as true will become the default!
  // https://docs.swmansion.com/react-native-worklets/docs/worklets-babel-plugin/plugin-options#strictglobal-
  strictGlobals: false,
};

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [["react-native-worklets/plugin", workletsPluginOptions]],
  };
};
