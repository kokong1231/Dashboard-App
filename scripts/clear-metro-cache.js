/**
 * Clears Metro transform/haste cache before a production build.
 * Equivalent to `react-native start --reset-cache` but without starting the server.
 */
const { tmpdir } = require('os');
const { readdirSync, rmSync, existsSync } = require('fs');
const path = require('path');

const tmp = tmpdir();
let cleared = 0;

try {
  const entries = readdirSync(tmp);
  for (const entry of entries) {
    if (/^metro[-_]/.test(entry) || /^haste[-_]/.test(entry)) {
      const full = path.join(tmp, entry);
      try {
        rmSync(full, { recursive: true, force: true });
        cleared++;
      } catch (_) {
        // ignore permission errors on individual cache entries
      }
    }
  }
} catch (_) {
  // tmpdir not readable — skip silently
}

// Also clear RN packager cache inside the project
const projectCacheDirs = [
  path.join(__dirname, '..', '.metro-cache'),
  path.join(__dirname, '..', 'node_modules', '.cache'),
];
for (const dir of projectCacheDirs) {
  if (existsSync(dir)) {
    try {
      rmSync(dir, { recursive: true, force: true });
      cleared++;
    } catch (_) {}
  }
}

console.log(`[clear-metro-cache] Cleared ${cleared} cache entr${cleared === 1 ? 'y' : 'ies'} from ${tmp}`);
