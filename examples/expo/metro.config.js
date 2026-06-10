// Lets Metro bundle the library source from ../../src while resolving
// react / react-native / svg / reanimated from THIS app's node_modules.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
// also look in this app's node_modules when resolving the library's imports
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// NOTE: keep hierarchical lookup ON so nested transitive deps still resolve.

module.exports = config;
