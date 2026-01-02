const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Exclude virtual environment directories from Metro's file watcher to prevent permission errors on Windows
// Use [/\\] to match both forward slash (Unix) and backslash (Windows) path separators
config.resolver.blockList = [
  /\.venv[/\\].*/,
  /venv_rag[/\\].*/,
];

// Web用: expo-secure-storeをポリフィルに置き換え
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Webプラットフォームの場合、expo-secure-storeをポリフィルに置き換え
  if (platform === 'web' && moduleName === 'expo-secure-store') {
    return {
      filePath: path.resolve(__dirname, 'lib/securestore-polyfill.ts'),
      type: 'sourceFile',
    };
  }

  // それ以外は通常の解決を使用
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
