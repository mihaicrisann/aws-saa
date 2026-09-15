const { getDefaultConfig } = require('expo/metro-config')

/* Everything Metro needs lives inside mobile/: the curriculum JSON is copied in
   by scripts/sync-content.mjs, so there are no watch folders outside the app. */
module.exports = getDefaultConfig(__dirname)
