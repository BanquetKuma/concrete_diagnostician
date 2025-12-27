const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude .venv directory from Metro's file watcher to prevent permission errors on Windows
config.resolver.blockList = [
  /\.venv\/.*/,
];

module.exports = config;
