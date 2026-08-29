/**
 * Puppeteer config - persists Chrome usage across sessions
 * Uses system Chrome to avoid downloading ~400MB chromium on every npx.
 * System Chrome at /Applications/Google Chrome.app persists across reboots and sessions.
 * If system Chrome missing, falls back to puppeteer cache at .cache/puppeteer (project-local, gitignored).
 * See: https://pptr.dev/guides/configuration
 */
const { existsSync } = require('fs');
const sysChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
module.exports = {
  // Project-local cache - persists in repo, survives npx cache clears, shared across sessions
  cacheDirectory: __dirname + '/.cache/puppeteer',
  // Prefer system Chrome - instant launch, no download
  ...(existsSync(sysChrome) ? { executablePath: sysChrome } : {}),
  // Skip download if system chrome available (saves 400MB + 90s)
  skipDownload: existsSync(sysChrome),
};
