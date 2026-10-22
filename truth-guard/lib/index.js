/**
 * truth-guard: a host-plane DSH plugin.
 *
 * It contributes one system-prompt section and audits each completed main-agent
 * turn against committed session facts. If the final answer claims a check
 * passed without supporting evidence, it queues one correction turn. The layer
 * is deliberately conservative: it only asserts what the session log proves,
 * and it never edits the answer or fabricates an audit result.
 */
import { randomUUID } from 'node:crypto';

import { auditFinalAnswer, extractText, renderCorrection } from './audit.js';
import { PROMPT_CONTRACT } from './contract.js';

export const name = 'truth-guard';
export const inject = ['systemPrompt', 'agents'];

const DEFAULTS = {
  enabled: true,
  promptContract: true,
  auditUrls: true,
  auditTestTampering: true,
  auditBypass: true,
};

function messageText(message) {
  return extractText(message?.content ?? []);
}

/**
 * Build the same durable user-message shape the harness uses, without taking a
 * package dependency. The session append path snapshots and freezes the value.
 */
function createUserMessage(input) {
  return structuredClone({
    ...input,
    id: randomUUID(),
    role: 'user',
  });
}

export function apply(ctx, config = {}) {
  const options = { ...DEFAULTS, ...(config ?? {}) };

  if (options.promptContract) {
    ctx.systemPrompt.section({
      name: 'truth-guard:contract',
      order: 50,
      text: PROMPT_CONTRACT,
    });
  }

  if (!options.enabled) return;

  const states = new Map();

  function inspect(agent) {
    try {
      if (ctx.agents.get(agent.id) !== agent) return;
      if (agent.session?.header?.origin === 'subagent') return;

      const session = agent.session;
      const nodes = session.surface?.nodes;
      if (!Array.isArray(nodes) || nodes.length === 0) return;

      const events = [];
      for (const seq of nodes) {
        const event = session.eventAt(seq);
        if (event) events.push(event);
      }

      let finalIndex = -1;
      for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index];
        if (event.type !== 'assistant/message') continue;
        const content = event.data?.message?.content;
        if (!Array.isArray(content)) continue;
        if (content.some((block) => block?.type === 'tool-call')) continue;
        if (messageText(event.data.message).trim().length === 0) continue;
        finalIndex = index;
        break;
      }
      if (finalIndex < 0) return;

      const finalEvent = events[finalIndex];
      const turn = finalEvent.data?.turn;
      if (!Number.isInteger(turn)) return;

      const state = states.get(agent) ?? { lastAuditedTurn: -1 };
      states.set(agent, state);
      if (state.lastAuditedTurn === turn) return;

      let lastUserIndex = -1;
      for (let index = finalIndex - 1; index >= 0; index -= 1) {
        if (events[index].type === 'user/message') {
          lastUserIndex = index;
          break;
        }
      }
      if (lastUserIndex < 0) return;

      state.lastAuditedTurn = turn;
      const source = events[lastUserIndex].data?.source;
      if (source?.kind === 'truth-guard') return;

      let startIndex = 0;
      for (let index = lastUserIndex; index >= 0; index -= 1) {
        if (events[index].type === 'turn/start' && events[index].data?.turn === turn) {
          startIndex = index;
          break;
        }
      }

      const turnEvents = [
        events[lastUserIndex],
        ...events
          .slice(startIndex)
          .filter((event) => event.data?.turn === turn || event.type === 'turn/start'),
      ];
      const issues = auditFinalAnswer({
        text: messageText(finalEvent.data.message),
        events: turnEvents,
        config: options,
      });
      if (issues.length === 0) return;

      const summary = `Evidence check: ${issues.length} unsupported claim${issues.length === 1 ? '' : 's'}`;
      const correction = createUserMessage({
        content: [{ type: 'text', text: renderCorrection(issues) }],
        source: { kind: 'truth-guard', form: 'notice', summary },
      });
      const queue = () => agent.followup(correction);
      if (typeof ctx.agents.withoutInitiator === 'function') {
        ctx.agents.withoutInitiator(queue);
      } else {
        queue();
      }
      ctx.logger?.warn?.(
        `truth-guard: corrected agent "${agent.id}" turn ${turn}: ${issues
          .map((issue) => issue.code)
          .join(', ')}`,
      );
    } catch (error) {
      ctx.logger?.warn?.(
        `truth-guard: audit failed for agent "${agent.id}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  ctx.on('agent/status', ({ agent, status }) => {
    if (status !== 'idle') return;
    queueMicrotask(() => inspect(agent));
  });

  ctx.on('agent/disposed', ({ agent }) => {
    states.delete(agent);
  });
}
