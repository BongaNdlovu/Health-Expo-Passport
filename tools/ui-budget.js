#!/usr/bin/env node
'use strict';

/*
 * ui-budget.js - dependency-free size/origin guard for the self-contained app.
 *
 * Defaults (relative to the repo root, not the caller's cwd):
 *   dist/index.html
 *   verification/budget.json
 *
 * Exit codes:
 *   0 = all checks pass
 *   1 = one or more budget checks failed
 *   2 = missing/invalid input or budget configuration
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const APP_PATH = path.join(ROOT, 'dist', 'index.html');
const BUDGET_PATH = path.join(ROOT, 'verification', 'budget.json');

const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
const SCRIPT_BLOCK_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const URL_RE = /https?:\/\/[^\s"'`<>\\]+/gi;
const VALID_HOST_RE = /^(\*\.)?[a-z0-9.-]+$/i;

function inputError(message) {
  console.error('ui-budget: ' + message);
  process.exitCode = 2;
}

function formatInt(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatPct(value) {
  return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
}

function pctChange(actual, baseline) {
  if (!baseline) return 0;
  return ((actual / baseline) - 1) * 100;
}

function padLeft(value, width) {
  const text = String(value);
  return text.length >= width ? text : ' '.repeat(width - text.length) + text;
}

function padRight(value, width) {
  const text = String(value);
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function readJson(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    throw new Error('cannot read budget file ' + file + ': ' + err.message);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error('budget file is not valid JSON (' + file + '): ' + err.message);
  }
}

function requireInteger(obj, key, label) {
  const value = obj && obj[key];
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(label + '.' + key + ' must be a non-negative integer');
  }
  return value;
}

function requireLimit(budgets, key) {
  const item = budgets && budgets[key];
  if (!item || typeof item !== 'object') {
    throw new Error('budgets.' + key + ' is missing');
  }
  if (typeof item.pct !== 'number' || !Number.isFinite(item.pct) || item.pct <= 0) {
    throw new Error('budgets.' + key + '.pct must be a positive number');
  }
  if (!Number.isSafeInteger(item.limit) || item.limit < 0) {
    throw new Error('budgets.' + key + '.limit must be a non-negative integer');
  }
  return item;
}

function measure(html, buffer) {
  const styles = [...html.matchAll(STYLE_BLOCK_RE)];
  const cssChars = styles.reduce((sum, match) => sum + match[1].length, 0);

  const scripts = [...html.matchAll(SCRIPT_BLOCK_RE)];
  const inline = scripts
    .filter((match) => !/\bsrc\s*=/i.test(match[1]))
    .map((match) => match[2]);
  if (inline.length === 0) {
    throw new Error('dist/index.html contains no inline script to measure');
  }
  // The build emits one large app bundle plus a tiny font bootstrap. The recorded
  // baseline counted the app bundle only, so measure the largest inline script.
  const inlineJsChars = Math.max(...inline.map((source) => source.length));

  const tokenPatterns = [
    ['!important', /!important/gi],
    ['backdrop-filter', /backdrop-filter/gi],
    ['filter:', /filter:/gi],
    ['animation:', /animation:/gi],
    ['transition: all', /transition:\s*all\b/gi],
  ];
  const tokenCounts = tokenPatterns.map(([label, pattern]) => ({
    label,
    count: (html.match(pattern) || []).length,
  }));

  const origins = new Set();
  for (const match of html.matchAll(URL_RE)) {
    const candidate = match[0]
      .replace(/[),.;\]}]+$/g, '')
      .replace(/&amp;/g, '&');
    let parsed;
    try {
      parsed = new URL(candidate);
    } catch {
      continue;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
    if (!VALID_HOST_RE.test(parsed.hostname)) continue;
    if (parsed.hostname.includes('..')) continue;
    origins.add(parsed.origin);
  }

  return {
    bytes: buffer.length,
    cssChars,
    inlineJsChars,
    styleBlocks: styles.length,
    inlineScripts: inline.length,
    tokenCounts,
    origins: [...origins].sort(),
    gzipBytes: zlib.gzipSync(buffer, { level: 9 }).length,
  };
}

function main() {
  let budget;
  try {
    budget = readJson(BUDGET_PATH);
    requireInteger(budget.baseline, 'rawBytes', 'baseline');
    requireInteger(budget.baseline, 'cssChars', 'baseline');
    requireInteger(budget.baseline, 'inlineJsChars', 'baseline');
    requireInteger(budget.baseline, 'gzipBytes', 'baseline');
    requireLimit(budget.budgets, 'rawBytes');
    requireLimit(budget.budgets, 'cssChars');
    requireLimit(budget.budgets, 'inlineJsChars');
    if (!budget.externalOrigins || !Array.isArray(budget.externalOrigins.allowlist)) {
      throw new Error('externalOrigins.allowlist must be an array');
    }
    if (!budget.externalOrigins.allowlist.every((item) => typeof item === 'string')) {
      throw new Error('externalOrigins.allowlist must contain only strings');
    }
  } catch (err) {
    inputError(err.message);
    return;
  }

  let buffer;
  let html;
  try {
    buffer = fs.readFileSync(APP_PATH);
    html = buffer.toString('utf8');
  } catch (err) {
    inputError('cannot read app at ' + APP_PATH + ': ' + err.message);
    return;
  }

  let result;
  try {
    result = measure(html, buffer);
  } catch (err) {
    inputError(err.message);
    return;
  }

  const baseline = budget.baseline;
  const rawLimit = budget.budgets.rawBytes;
  const cssLimit = budget.budgets.cssChars;
  const jsLimit = budget.budgets.inlineJsChars;

  const allowlist = new Set(budget.externalOrigins.allowlist);
  const newOrigins = result.origins.filter((origin) => !allowlist.has(origin));

  const rows = [
    {
      label: 'raw bytes',
      baseline: baseline.rawBytes,
      actual: result.bytes,
      limit: rawLimit.limit,
      pct: rawLimit.pct,
      pass: result.bytes <= rawLimit.limit,
    },
    {
      label: 'css chars',
      baseline: baseline.cssChars,
      actual: result.cssChars,
      limit: cssLimit.limit,
      pct: cssLimit.pct,
      pass: result.cssChars <= cssLimit.limit,
    },
    {
      label: 'inline JS chars',
      baseline: baseline.inlineJsChars,
      actual: result.inlineJsChars,
      limit: jsLimit.limit,
      pct: jsLimit.pct,
      pass: result.inlineJsChars <= jsLimit.limit,
    },
    {
      label: 'external origins',
      baseline: allowlist.size,
      actual: result.origins.length,
      limit: allowlist.size,
      pct: 0,
      pass: newOrigins.length === 0,
      external: true,
    },
  ];

  const failures = rows.filter((row) => !row.pass);

  console.log('Health Expo UI budget');
  console.log('app:    ' + path.relative(ROOT, APP_PATH));
  console.log('budget: ' + path.relative(ROOT, BUDGET_PATH));
  console.log('css chars = content of every <style> block; inline JS = largest inline <script> (the app bundle).');
  console.log('');

  const header = [
    padRight('Metric', 17),
    padLeft('Baseline', 12),
    padLeft('Actual', 12),
    padLeft('Delta', 9),
    padLeft('Limit', 12),
    padLeft('Budget', 8),
    '  Result',
  ].join(' ');
  const rule = [
    '-'.repeat(17),
    '-'.repeat(12),
    '-'.repeat(12),
    '-'.repeat(9),
    '-'.repeat(12),
    '-'.repeat(8),
    '  ------',
  ].join(' ');
  console.log(header);
  console.log(rule);

  for (const row of rows) {
    let delta;
    if (row.external) {
      delta = (row.actual - row.baseline >= 0 ? '+' : '') + (row.actual - row.baseline);
    } else {
      delta = formatPct(pctChange(row.actual, row.baseline));
    }
    const budgetLabel = row.external ? '0 new' : '+' + row.pct + '%';
    console.log([
      padRight(row.label, 17),
      padLeft(formatInt(row.baseline), 12),
      padLeft(formatInt(row.actual), 12),
      padLeft(delta, 9),
      padLeft(formatInt(row.limit), 12),
      padLeft(budgetLabel, 8),
      '  ' + (row.pass ? 'PASS' : 'FAIL'),
    ].join(' '));
  }

  console.log('');
  console.log('stylesheet blocks: ' + result.styleBlocks + '; inline scripts: ' + result.inlineScripts);
  console.log('gzip (level 9, informational, not gated): ' + formatInt(result.gzipBytes) + ' B; baseline ' +
    formatInt(baseline.gzipBytes) + ' B (' + formatPct(pctChange(result.gzipBytes, baseline.gzipBytes)) + ')');

  if (newOrigins.length) {
    console.log('');
    console.log('NEW external origins (' + newOrigins.length + '):');
    for (const origin of newOrigins) console.log('  ' + origin);
  } else {
    console.log('external origins: all ' + result.origins.length + ' observed origins are allowlisted.');
  }

  console.log('');
  console.log('Style debt (case-insensitive literal counts across the whole page):');
  for (const item of result.tokenCounts) {
    console.log('  ' + padRight(item.label, 18) + formatInt(item.count));
  }
  console.log('  note: "filter:" also matches "backdrop-filter:"; "-webkit-backdrop-filter" counts as "backdrop-filter".');

  if (failures.length === 0) {
    console.log('');
    console.log('PASS - all UI budget checks are within limits.');
    return;
  }

  console.log('');
  console.log('FAIL - ' + failures.length + ' budget check(s) failed:');
  for (const row of failures) {
    if (row.external) {
      console.log('  - external origins: ' + newOrigins.length + ' origin(s) are not allowlisted.');
      continue;
    }
    const over = row.actual - row.limit;
    console.log('  - ' + row.label + ': ' + formatInt(row.actual) + ' exceeds ' + formatInt(row.limit) +
      ' by ' + formatInt(over) + ' (' + formatPct(pctChange(row.actual, row.baseline)) + ' vs baseline).');
  }
  process.exitCode = 1;
}

try {
  main();
} catch (err) {
  inputError(err && err.stack ? err.stack : String(err));
}
