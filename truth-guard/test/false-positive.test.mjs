import assert from 'node:assert/strict';

import { auditFinalAnswer as workspaceAudit } from '../lib/audit.js';
import { auditFinalAnswer as installedAudit } from 'file:///C:/Users/fanel/.dsh/profiles/desktop/node_modules/dsh-truth-guard/lib/audit.js';

const TURN = 7;

function user(seq, text) {
  return {
    seq,
    type: 'user/message',
    data: { turn: TURN, message: { content: [{ type: 'text', text }] } },
  };
}

function call(seq, id, name, args) {
  return {
    seq,
    type: 'assistant/message',
    data: {
      turn: TURN,
      message: {
        content: [{ type: 'tool-call', id, name, arguments: JSON.stringify(args) }],
      },
    },
  };
}

function result(seq, callId, text, isError = false) {
  return {
    seq,
    type: 'tool/result',
    data: {
      turn: TURN,
      message: { toolCallId: callId, content: [{ type: 'text', text }], isError },
    },
  };
}

function edit(seq, id, path) {
  return [
    call(seq, id, 'edit', { file_path: path, old_string: 'a', new_string: 'b' }),
    result(seq + 1, id, 'edited'),
  ];
}

// This is the command shape that caused the live false positive: a file write
// whose here-string payload happens to contain test and bypass text.
const restoreCommand = `$content = @'
node test/audit.test.js --passWithNoTests
--no-verify
'@; Set-Content -LiteralPath test/audit.test.js -Value $content`;

const falsePositiveEvents = [
  user(1, 'Add regression tests.'),
  ...edit(2, 'edit-1', 'test/audit.test.js'),
  call(4, 'restore-1', 'pwsh', { command: restoreCommand }),
  result(5, 'restore-1', 'written'),
  call(6, 'run-1', 'pwsh', { command: 'node test/audit.test.js' }),
  result(7, 'run-1', '16 tests, 16 passed, 0 failed'),
];

const realBypassEvents = [
  user(1, 'Run the tests.'),
  call(2, 'run-2', 'pwsh', { command: 'pnpm test -- --passWithNoTests' }),
  result(3, 'run-2', 'Tests 1 passed'),
];

for (const [name, audit] of [
  ['workspace', workspaceAudit],
  ['installed desktop copy', installedAudit],
]) {
  const falsePositive = audit({
    text: 'I added two regression tests to test/audit.test.js. All 16 tests passed.',
    events: falsePositiveEvents,
  });
  assert.equal(
    falsePositive.some((issue) => issue.code === 'bypass-used'),
    false,
    `${name}: here-string payload was still treated as a bypass`,
  );

  const realBypass = audit({
    text: 'All tests passed.',
    events: realBypassEvents,
  });
  assert.equal(
    realBypass.some((issue) => issue.code === 'bypass-used'),
    true,
    `${name}: real bypass flag was missed`,
  );

  console.log(`${name}: false positive suppressed; real bypass still detected`);
}

console.log('targeted fix check passed');
