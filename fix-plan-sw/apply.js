#!/usr/bin/env node
/* apply.js (gated-fix-plan): applies the plan's exact edits and nothing else.
 *
 *   node fix-plan/apply.js <projectRoot>
 *
 * Reads fix-plan/edits.js ([{ id, file, find, replace }]) and fix-plan/config.js (the `edited` allowlist).
 * - An edit to a file that is not in config.edited is refused.
 * - Every `find` must match EXACTLY ONCE in the file as it stands at that point, or nothing is written at all.
 * - Line endings are matched to each file (CRLF or LF), so edits can be written with plain \n.
 */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.resolve(process.argv[2] || '.');
const C = require(path.join(__dirname, 'config.js'));
const EDITS = require(path.join(__dirname, 'edits.js'));
const CR = String.fromCharCode(13), LF = String.fromCharCode(10);

const stop = msg => { console.error('STOP: ' + msg + ' Nothing was written.'); process.exit(1); };
if (!Array.isArray(EDITS) || !EDITS.length) stop('edits.js exports no edits.');
const byFile = new Map();
for (const e of EDITS) {
  if (!e || !e.id || !e.file || typeof e.find !== 'string' || typeof e.replace !== 'string') stop('malformed edit ' + JSON.stringify(e && e.id));
  if (!C.edited.includes(e.file)) stop(`edit "${e.id}" targets ${e.file}, which is not in config.edited (${C.edited.join(', ')}).`);
  if (!e.find.length) stop(`edit "${e.id}" has an empty find.`);
  if (!byFile.has(e.file)) byFile.set(e.file, []);
  byFile.get(e.file).push(e);
}
const out = new Map();
for (const [file, edits] of byFile) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) stop(`${file} does not exist under ${root}.`);
  let text = fs.readFileSync(p, 'utf8');
  const eol = text.includes(CR + LF) ? CR + LF : LF;
  const fix = t => t.split(CR + LF).join(LF).split(LF).join(eol);
  for (const e of edits) {
    const find = fix(e.find), repl = fix(e.replace);
    const n = text.split(find).length - 1;
    if (n !== 1) stop(`edit "${e.id}" in ${file} matched ${n} times (must be exactly 1).`);
    text = text.replace(find, () => repl);
  }
  out.set(p, text);
}
for (const [p, text] of out) fs.writeFileSync(p, text);
console.log(`applied ${EDITS.length} edits to ${out.size} file${out.size > 1 ? 's' : ''}`);
