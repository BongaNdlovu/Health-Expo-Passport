import assert from 'node:assert/strict';

import { apply, inject, name } from '../lib/index.js';

function fakeContext() {
  const sections = [];
  const listeners = [];
  return {
    sections,
    listeners,
    ctx: {
      systemPrompt: {
        section(section) {
          sections.push(section);
        },
      },
      on(event, listener) {
        listeners.push([event, listener]);
      },
      logger: { warn() {} },
      agents: {
        get() {
          return undefined;
        },
      },
    },
  };
}

assert.equal(name, 'truth-guard');
assert.deepEqual(inject, ['systemPrompt', 'agents']);

const full = fakeContext();
apply(full.ctx, {});
assert.equal(full.sections.length, 1);
assert.equal(full.sections[0].name, 'truth-guard:contract');
assert.equal(full.sections[0].order, 50);
assert.match(full.sections[0].text, /Truth and evidence contract/);
assert.deepEqual(
  full.listeners.map(([event]) => event),
  ['agent/status', 'agent/disposed'],
);

const disabled = fakeContext();
apply(disabled.ctx, { enabled: false });
assert.equal(disabled.sections.length, 1);
assert.equal(disabled.listeners.length, 0);

const contractOnly = fakeContext();
apply(contractOnly.ctx, { promptContract: false });
assert.equal(contractOnly.sections.length, 0);
assert.equal(contractOnly.listeners.length, 2);

console.log('smoke ok: prompt section and listeners register');
