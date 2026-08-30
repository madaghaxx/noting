const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite's web implementation is WebAssembly-backed. SDK 54 requires wasm
// files to be handled as assets for the web bundle to resolve that implementation.
config.resolver.assetExts.push("wasm");

module.exports = config;
