#!/usr/bin/env node

/**
 * Synchronizes plugin version metadata across package files.
 *
 * Intended to be run from an npm lifecycle script such as:
 *
 * {
 *   "scripts": {
 *     "version": "node scripts/version-bump.js"
 *   }
 * }
 *
 * Usage:
 *
 * npm version patch
 * npm version minor
 * npm version major
 */

const { readFileSync, writeFileSync } = require('fs');

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const targetVersion = packageJson.version;

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const { minAppVersion } = manifest;

manifest.version = targetVersion;

writeFileSync(
  'manifest.json',
  JSON.stringify(manifest, null, '\t') + '\n'
);

const versions = JSON.parse(readFileSync('versions.json', 'utf8'));

if (!(targetVersion in versions)) {
  versions[targetVersion] = minAppVersion;

  writeFileSync(
    'versions.json',
    JSON.stringify(versions, null, '\t') + '\n'
  );
}