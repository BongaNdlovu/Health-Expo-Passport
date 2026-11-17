/* Where the database tests get PGlite (Postgres compiled to WebAssembly) from.
   It is a pinned dev dependency, so `npm install` is enough. NEWSTART_PGLITE (a folder with its own install) still
   works, for an older checkout. Returns the PGlite class, or null when neither is present. */
const path = require('path');

function loadPGlite() {
  try { return require('@electric-sql/pglite').PGlite; } catch (e) { /* not installed here: try the shared folder */ }
  const shared = process.env.NEWSTART_PGLITE;
  if (!shared) return null;
  return require(path.join(shared, 'node_modules', '@electric-sql', 'pglite')).PGlite;
}

module.exports = { loadPGlite };
