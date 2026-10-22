import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditFinalAnswer,
  classifyCommand,
  commandSucceeded,
  detectClaims,
  disclosesTestChange,
  isTestPath,
  normalizeUrl,
  renderCorrection,
  stripShellPayloads,
} from '../lib/audit.js';

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
        content: [
          {
            type: 'tool-call',
            id,
            name,
            arguments: JSON.stringify(args),
          },
        ],
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
      message: {
        toolCallId: callId,
        content: [{ type: 'text', text }],
        isError,
      },
    },
  };
}

function edit(seq, id, path) {
  return [
    call(seq, id, 'edit', { file_path: path, old_string: 'a', new_string: 'b' }),
    result(seq + 1, id, 'edited'),
  ];
}

test('detects completed verification claims but not future or hypothetical ones', () => {
  assert.deepEqual(
    detectClaims('All tests passed. The build succeeded. Lint is clean.').map((claim) => claim.kind),
    ['test', 'build', 'lint'],
  );
  assert.equal(detectClaims('The tests should pass after this change.').length, 0);
  assert.equal(detectClaims('If the build succeeds, I will deploy.').length, 0);
  assert.equal(detectClaims('Do the tests pass?').length, 0);
});

test('flags a passing claim when no command ran', () => {
  const issues = auditFinalAnswer({
    text: 'All tests passed.',
    events: [user(1, 'Please fix it.')],
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'missing-verification');
});

test('accepts a test command that ran after the last edit', () => {
  const issues = auditFinalAnswer({
    text: 'All tests passed.',
    events: [
      user(1, 'Please fix it.'),
      ...edit(2, 'e1', 'src/app.ts'),
      call(4, 'c1', 'pwsh', { command: 'pnpm test' }),
      result(5, 'c1', 'Test Files  3 passed (3)\nTests  12 passed (12)'),
    ],
  });
  assert.deepEqual(issues, []);
});

test('flags verification that ran before the last edit', () => {
  const issues = auditFinalAnswer({
    text: 'All tests passed.',
    events: [
      user(1, 'Please fix it.'),
      call(2, 'c1', 'pwsh', { command: 'pnpm test' }),
      result(3, 'c1', 'Tests  12 passed (12)'),
      ...edit(4, 'e1', 'src/app.ts'),
    ],
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'missing-verification');
  assert.match(issues[0].message, /before the last file change/);
});

test('flags a failed test result even when the tool call did not throw', () => {
  const issues = auditFinalAnswer({
    text: 'All tests passed.',
    events: [
      user(1, 'Please fix it.'),
      call(2, 'c1', 'pwsh', { command: 'pnpm test' }),
      result(3, 'c1', 'Tests  1 failed | 11 passed (12)'),
    ],
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'missing-verification');
});

test('requires disclosure when tests were modified and a passing claim is made', () => {
  const events = [
    user(1, 'Please fix it.'),
    ...edit(2, 'e1', 'tests/app.test.ts'),
    call(4, 'c1', 'pwsh', { command: 'pnpm test' }),
    result(5, 'c1', 'Tests  12 passed (12)'),
  ];
  const hidden = auditFinalAnswer({ text: 'All tests passed.', events });
  assert.equal(hidden.length, 1);
  assert.equal(hidden[0].code, 'undisclosed-test-change');

  const disclosed = auditFinalAnswer({
    text: 'I modified tests/app.test.ts to cover the new branch. All tests passed.',
    events,
  });
  assert.deepEqual(disclosed, []);
});

test('flags verification bypass flags', () => {
  const issues = auditFinalAnswer({
    text: 'All tests passed.',
    events: [
      user(1, 'Please fix it.'),
      call(2, 'c1', 'pwsh', { command: 'pnpm test -- --passWithNoTests' }),
      result(3, 'c1', 'No tests found, exiting with code 0'),
    ],
  });
  assert.equal(issues.some((issue) => issue.code === 'bypass-used'), true);
});

test('grounds URLs in tool results or the user message', () => {
  const unsupported = auditFinalAnswer({
    text: 'The API is documented at https://docs.example.invalid/reference.',
    events: [user(1, 'Check the docs.')],
  });
  assert.equal(unsupported.length, 1);
  assert.equal(unsupported[0].code, 'ungrounded-url');

  const supported = auditFinalAnswer({
    text: 'The API is documented at https://api.deepseek.com/docs.',
    events: [
      user(1, 'Check the docs.'),
      call(2, 'c1', 'web_fetch', { url: 'https://api.deepseek.com/docs' }),
      result(3, 'c1', 'Fetched https://api.deepseek.com/docs successfully.'),
    ],
  });
  assert.deepEqual(supported, []);
});

test('does not flag placeholder or local URLs', () => {
  const issues = auditFinalAnswer({
    text: 'For example, see https://example.com/demo or http://localhost:3000.',
    events: [user(1, 'Give an example.')],
  });
  assert.deepEqual(issues, []);
});

test('classifies common verification commands', () => {
  assert.equal(classifyCommand('pnpm test').test, true);
  assert.equal(classifyCommand('npx vitest run').test, true);
  assert.equal(classifyCommand('node test/audit.test.js').test, true);
  assert.equal(classifyCommand('pnpm run build').build, true);
  assert.equal(classifyCommand('npx tsc --noEmit').typecheck, true);
  assert.equal(classifyCommand('pnpm lint').lint, true);
  assert.equal(classifyCommand('git commit --no-verify -m x').bypass, true);
});

test('does not read here-string payloads as verification or bypass commands', () => {
  const command = `$content = @'
node test/audit.test.js --passWithNoTests
--no-verify
'@; Set-Content -LiteralPath test.js -Value $content`;
  const classification = classifyCommand(command);
  assert.equal(classification.test, false);
  assert.equal(classification.bypass, false);
  assert.match(stripShellPayloads(command), /Set-Content/);
});

test('does not treat a plain echo of a bypass flag as a verification bypass', () => {
  const issues = auditFinalAnswer({
    text: 'All tests passed.',
    events: [
      user(1, 'Please fix it.'),
      call(2, 'c1', 'pwsh', { command: 'pnpm test' }),
      result(3, 'c1', 'Tests  12 passed (12)'),
      call(4, 'c2', 'pwsh', { command: 'echo --no-verify' }),
      result(5, 'c2', '--no-verify'),
    ],
  });
  assert.equal(issues.some((issue) => issue.code === 'bypass-used'), false);
});

test('recognizes successful, failed, and error results', () => {
  assert.equal(commandSucceeded({ text: 'ok', isError: false }), true);
  assert.equal(commandSucceeded({ text: '[exit code: 0]', isError: false }), true);
  assert.equal(commandSucceeded({ text: '[exit code: 1]', isError: false }), false);
  assert.equal(commandSucceeded({ text: 'Tests 1 failed', isError: false }), false);
  assert.equal(commandSucceeded({ text: 'No tests found, exiting with code 0' }), false);
  assert.equal(commandSucceeded({ text: 'ok', isError: true }), false);
});

test('recognizes test paths and disclosure wording', () => {
  assert.equal(isTestPath('tests/app.test.ts'), true);
  assert.equal(isTestPath('src/__tests__/app.ts'), true);
  assert.equal(isTestPath('src/test-utils.ts'), false);
  assert.equal(disclosesTestChange('I changed the test fixture.'), true);
  assert.equal(disclosesTestChange('I updated tests/app.test.ts.'), true);
  assert.equal(disclosesTestChange('I changed src/app.ts.'), false);
  assert.equal(disclosesTestChange('No tests were changed.'), false);
});

test('normalizes URLs for comparison', () => {
  assert.equal(normalizeUrl('https://API.DeepSeek.com/a/?q=1#x'), 'https://api.deepseek.com/a');
  assert.equal(normalizeUrl('https://api.deepseek.com/a'), 'https://api.deepseek.com/a');
  assert.equal(normalizeUrl('https://example.com/a'), null);
  assert.equal(normalizeUrl('not a url'), null);
});

test('renders a correction that names each finding', () => {
  const text = renderCorrection([
    { code: 'missing-verification', message: 'No test command ran.' },
    { code: 'ungrounded-url', message: 'The URL was not observed.' },
  ]);
  assert.match(text, /missing verification/i);
  assert.match(text, /No test command ran\./);
  assert.match(text, /The URL was not observed\./);
  assert.match(text, /not verified/i);
});
