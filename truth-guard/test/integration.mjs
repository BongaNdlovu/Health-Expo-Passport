import assert from 'node:assert/strict';

import { apply } from '../lib/index.js';

const TURN = 7;

function event(seq, type, data) {
  return { seq, type, data };
}

function user(seq, text, source = { kind: 'user' }) {
  return event(seq, 'user/message', {
    turn: TURN,
    source,
    message: { content: [{ type: 'text', text }] },
  });
}

function assistantCall(seq, id, name, args) {
  return event(seq, 'assistant/message', {
    turn: TURN,
    step: 0,
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
  });
}

function toolResult(seq, callId, text, isError = false) {
  return event(seq, 'tool/result', {
    turn: TURN,
    step: 0,
    message: { toolCallId: callId, content: [{ type: 'text', text }], isError },
  });
}

function final(seq, text) {
  return event(seq, 'assistant/message', {
    turn: TURN,
    step: 1,
    message: { content: [{ type: 'text', text }] },
  });
}

function setup(events, { origin } = {}) {
  const listeners = new Map();
  const followups = [];
  const agent = {
    id: 'main-1',
    status: 'idle',
    session: {
      header: { origin },
      surface: { nodes: events.map((item) => item.seq) },
      eventAt(seq) {
        return events[seq];
      },
    },
    followup(message) {
      followups.push(message);
    },
  };
  const ctx = {
    systemPrompt: { section() {} },
    on(name, listener) {
      listeners.set(name, listener);
    },
    logger: { warn() {} },
    agents: {
      get(id) {
        return id === agent.id ? agent : undefined;
      },
      withoutInitiator(fn) {
        fn();
      },
    },
  };
  apply(ctx, {});
  return { listeners, followups, agent };
}

async function tick() {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

async function run(events, options = {}) {
  const prepared = options.lastUserSource
    ? events.map((item, index) =>
        index === 0
          ? { ...item, data: { ...item.data, source: options.lastUserSource } }
          : item,
      )
    : events;
  const harness = setup(prepared, options);
  harness.listeners.get('agent/status')({ agent: harness.agent, status: 'idle' });
  await tick();
  return harness;
}

const base = [
  user(0, 'Fix the failing test.'),
  event(1, 'turn/start', { turn: TURN }),
  assistantCall(2, 'edit-1', 'edit', {
    file_path: 'src/app.ts',
    old_string: 'a',
    new_string: 'b',
  }),
  toolResult(3, 'edit-1', 'edited'),
  final(4, 'All tests passed.'),
  event(5, 'turn/end', { turn: TURN, reason: { kind: 'completed' } }),
];

const unsupported = await run(base);
assert.equal(unsupported.followups.length, 1);
assert.equal(unsupported.followups[0].source.kind, 'truth-guard');
assert.match(
  unsupported.followups[0].content[0].text,
  /no successful tests command ran in this turn/i,
);

const supportedEvents = [
  ...base.slice(0, 4),
  assistantCall(4, 'test-1', 'pwsh', { command: 'pnpm test' }),
  toolResult(5, 'test-1', 'Tests  12 passed (12)'),
  final(6, 'All tests passed.'),
  event(7, 'turn/end', { turn: TURN, reason: { kind: 'completed' } }),
];
const supported = await run(supportedEvents);
assert.equal(supported.followups.length, 0);

const subagent = await run(base, { origin: 'subagent' });
assert.equal(subagent.followups.length, 0);

const correctionTurn = await run(base, { lastUserSource: { kind: 'truth-guard' } });
assert.equal(correctionTurn.followups.length, 0);

console.log('integration ok: correction queued only for unsupported main-agent claims');
