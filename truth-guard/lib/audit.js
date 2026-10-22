/**
 * Deterministic evidence checks for a completed assistant turn.
 *
 * This module deliberately does not ask another model to judge truthfulness.
 * It checks only claims that can be tied to observable session facts:
 *   - a command tool call and its committed result;
 *   - the order of that call relative to file mutations;
 *   - whether a cited URL appeared in the user's message or a tool result.
 *
 * It cannot detect every false statement. It is a backstop for the common
 * failure modes: claiming a check passed without running it, running it before
 * the last edit, hiding a test edit, bypassing a check, and inventing links.
 */

const TEST_WORDS = /\b(?:tests?|test suite|unit tests?|integration tests?|e2e tests?|specs?)\b/i;
const BUILD_WORDS = /\b(?:build|compile|bundle|typecheck|type check|type-check)\b/i;
const LINT_WORDS = /\b(?:lint|eslint|ruff|clippy)\b/i;
const TYPE_WORDS = /\b(?:typecheck|type check|type-check|tsc|types?)\b/i;
const PASS_WORDS = /\b(?:pass(?:es|ed)?|passing|succeed(?:s|ed)?|green|clean)\b/i;
const RAN_WORDS = /\b(?:ran|executed|invoked)\b/i;
const MODAL_WORDS =
  /\b(?:may|might|could|should|would|will|expect(?:ed|s)?|if|whether|unless|probably|likely|hope|assuming)\b/i;

const TEST_COMMAND =
  /(?:^|[;&|]\s*|\s)(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:test|tests|vitest|jest|e2e)(?::[\w-]+)?\b|\b(?:vitest|jest|pytest|py\.test|cargo\s+test|go\s+test|dotnet\s+test|mvn\s+test|gradlew?\s+test|playwright\s+test|cypress\s+run|node\s+--test|phpunit|rspec|swift\s+test|flutter\s+test)\b|\bnode\s+(?:--test\s+)?[^\s;&|]*test[^\s;&|]*\.(?:[cm]?js|mjs)\b/i;
const BUILD_COMMAND =
  /(?:^|[;&|]\s*|\s)(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?build\b|\b(?:tsc|vite\s+build|webpack|next\s+build|cargo\s+build|go\s+build|dotnet\s+build|mvn\s+(?:package|install)|gradlew?\s+build|make|cmake\s+--build)\b/i;
const LINT_COMMAND =
  /(?:^|[;&|]\s*|\s)(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?lint\b|\b(?:eslint|ruff|flake8|pylint|golangci-lint|cargo\s+clippy)\b/i;
const TYPECHECK_COMMAND =
  /(?:^|[;&|]\s*|\s)(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:typecheck|type-check|tsc)\b|\btsc\s+--noemit\b|\b(?:mypy|pyright)\b/i;
const BYPASS_COMMAND =
  /(?:^|\s)--no-verify\b|(?:^|\s)--passwithnotests\b|(?:^|\s)--no-tests\b|\|\|\s*true\b|;\s*exit\s+0\b|\bgit\s+push\b[^\n]*\b--force\b/i;

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;
const PLACEHOLDER_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'example.com',
  'example.org',
  'example.net',
]);

const MAX_URL_ISSUES = 5;

/** Human-readable labels for claim kinds. */
const KIND_LABEL = {
  test: 'tests',
  build: 'build',
  lint: 'lint',
  typecheck: 'type check',
  verification: 'verification',
};

/**
 * Remove fenced code blocks before looking for citations. A URL shown as an
 * example inside a code block is not a citation claim.
 */
export function stripCodeFences(text) {
  return String(text ?? '').replace(/```[\s\S]*?```/g, ' ');
}

/**
 * Split prose into sentences without a full NLP dependency. A sentence is the
 * unit of claim detection; a modal anywhere in it suppresses the claim.
 */
export function splitSentences(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Detect claims that a verification activity passed. Conservative by design:
 * future/probable statements and questions are not treated as claims.
 *
 * @returns {{kind: string, sentence: string}[]} distinct claim kinds
 */
export function detectClaims(text) {
  const found = new Map();
  for (const sentence of splitSentences(text)) {
    if (sentence.endsWith('?')) continue;
    if (MODAL_WORDS.test(sentence)) continue;

    const pass = PASS_WORDS.test(sentence);
    const ran = RAN_WORDS.test(sentence);
    if (!pass && !ran) continue;

    if (TEST_WORDS.test(sentence)) {
      found.set('test', { kind: 'test', sentence });
      continue;
    }
    if (LINT_WORDS.test(sentence)) {
      found.set('lint', { kind: 'lint', sentence });
      continue;
    }
    if (TYPE_WORDS.test(sentence) && pass) {
      found.set('typecheck', { kind: 'typecheck', sentence });
      continue;
    }
    if (BUILD_WORDS.test(sentence) && pass) {
      found.set('build', { kind: 'build', sentence });
      continue;
    }
    if (pass && /\b(?:verified|confirmed|validated)\b/i.test(sentence)) {
      found.set('verification', { kind: 'verification', sentence });
    }
  }
  return [...found.values()];
}

/**
 * Remove shell heredoc/here-string payloads before interpreting a command.
 * A command that writes a test file can contain the literal text of a test
 * command or a bypass flag without executing either; scanning that payload
 * as if it were the command line produces false bypass findings.
 */
export function stripShellPayloads(command) {
  return String(command ?? '')
    .replace(/@'[\s\S]*?'@/g, ' ')
    .replace(/@"[\s\S]*?"@/g, ' ')
    .replace(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[\s\S]*?\n\s*\2\b/g, ' ');
}

/**
 * Classify a shell command by the verification activity it performs.
 * A command may be more than one kind (for example `pnpm test && pnpm build`).
 */
export function classifyCommand(command) {
  const text = stripShellPayloads(command);
  return {
    test: TEST_COMMAND.test(text),
    build: BUILD_COMMAND.test(text),
    lint: LINT_COMMAND.test(text),
    typecheck: TYPECHECK_COMMAND.test(text),
    bypass: BYPASS_COMMAND.test(text),
  };
}

/** Extract plain text from a model/tool content array. */
export function extractText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) {
    if (content && typeof content === 'object' && content.type === 'text') {
      return String(content.text ?? '');
    }
    return '';
  }
  return content
    .filter((block) => block && block.type === 'text')
    .map((block) => String(block.text ?? ''))
    .join('\n');
}

/** Parse tool-call arguments defensively; malformed arguments yield {}. */
export function parseArguments(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

/** Normalize a URL to protocol + host + path, ignoring query and fragment. */
export function normalizeUrl(raw) {
  try {
    const url = new URL(String(raw));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (PLACEHOLDER_HOSTS.has(host) || host.endsWith('.example')) return null;
    const path = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
    return `${url.protocol}//${host}${path}`;
  } catch {
    return null;
  }
}

/** Add every URL found in text to a normalized set. */
export function addUrls(text, set) {
  const source = String(text ?? '');
  for (const match of source.matchAll(URL_PATTERN)) {
    const normalized = normalizeUrl(match[0].replace(/[.,;:!?)\]}>'"]+$/g, ''));
    if (normalized) set.add(normalized);
  }
}

/** Whether a tool-result body shows a non-zero exit or a failed check. */
export function commandSucceeded(result) {
  if (!result || result.isError) return false;
  const text = String(result.text ?? '');
  if (/\[exit code:\s*(?!0\b)\d+\]/i.test(text)) return false;
  if (/\b[1-9]\d*\s+(?:failed|failing|errors?)\b/i.test(text)) return false;
  if (/\b(?:no tests? (?:found|ran|executed)|0 tests?|no test files?)\b/i.test(text)) return false;
  if (/(?:^|\n)\s*(?:FAIL|FAILED|ERROR)\b/.test(text)) return false;
  return true;
}

/** Whether a path looks like a test, spec, fixture, or e2e file. */
export function isTestPath(path) {
  const normalized = String(path ?? '').replace(/\\/g, '/');
  if (/(?:^|\/)(?:__tests__|test|tests|spec|specs|e2e|cypress|playwright)(?:\/|$)/i.test(normalized)) {
    return true;
  }
  return /\.(?:test|spec)\.[^/]+$/i.test(normalized);
}

/** Whether the answer discloses that tests or verification files changed. */
export function disclosesTestChange(text) {
  const source = String(text ?? '');
  const negated =
    /\b(?:no|not|never|without|didn't|did not|haven't|have not)\b[^.\n]{0,24}\b(?:changed|modified|updated|added|removed|rewrote|edited|adjusted|weakened|skipped)\b/i.test(
      source,
    );
  if (negated) return false;
  return (
    /\b(?:test|tests|spec|specs|fixture|fixtures|verification)[^.\n]{0,80}\b(?:changed|modified|updated|added|removed|rewrote|edited|adjusted|weakened|skipped)\b/i.test(
      source,
    ) ||
    /\b(?:changed|modified|updated|added|removed|rewrote|edited|adjusted|weakened|skipped)\b[^.\n]{0,80}\b(?:test|tests|spec|specs|fixture|fixtures)\b/i.test(
      source,
    )
  );
}

function mutationPath(name, args) {
  if (!['write', 'edit', 'str_replace_editor', 'multi_edit'].includes(name)) return null;
  if (name === 'str_replace_editor' && args.command === 'view') return null;
  if (typeof args.file_path === 'string') return args.file_path;
  if (typeof args.path === 'string') return args.path;
  return null;
}

/**
 * Build the observable evidence from surface events. Events are the committed
 * session records for the turn, so a claim can only be supported by a fact the
 * model actually received.
 */
export function collectEvidence(events) {
  const calls = new Map();
  const results = new Map();
  const mutations = [];
  const urls = new Set();

  for (const event of events) {
    const data = event?.data ?? {};
    if (event.type === 'assistant/message') {
      const content = data.message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (!block || block.type !== 'tool-call') continue;
        const args = parseArguments(block.arguments);
        calls.set(block.id, {
          seq: event.seq,
          id: block.id,
          name: String(block.name ?? ''),
          args,
          argsText: typeof block.arguments === 'string' ? block.arguments : JSON.stringify(args),
        });
        addUrls(JSON.stringify(args), urls);
      }
      continue;
    }
    if (event.type === 'tool/result') {
      const message = data.message ?? {};
      const callId = message.toolCallId ?? message.callId;
      const text = extractText(message.content);
      results.set(callId, { seq: event.seq, text, isError: Boolean(message.isError) });
      addUrls(text, urls);
      continue;
    }
    if (event.type === 'user/message') {
      addUrls(extractText(data.message?.content ?? data.content), urls);
    }
  }

  const commands = [];
  for (const call of calls.values()) {
    if (call.name !== 'bash' && call.name !== 'pwsh') continue;
    const command = typeof call.args.command === 'string' ? call.args.command : '';
    if (!command) continue;
    const result = results.get(call.id);
    commands.push({
      seq: call.seq,
      name: call.name,
      command,
      classification: classifyCommand(command),
      success: commandSucceeded(result),
      resultText: result?.text ?? '',
      isError: Boolean(result?.isError),
    });
  }

  for (const call of calls.values()) {
    const path = mutationPath(call.name, call.args);
    if (path) mutations.push({ seq: call.seq, name: call.name, path });
  }

  const testMutations = mutations.filter((mutation) => isTestPath(mutation.path));
  const lastMutationSeq = mutations.reduce((max, mutation) => Math.max(max, mutation.seq), -1);

  return { calls, results, commands, mutations, testMutations, lastMutationSeq, urls };
}

function hasFreshCommand(evidence, kind) {
  if (kind === 'verification') {
    return evidence.commands.some(
      (command) => command.success && command.seq > evidence.lastMutationSeq,
    );
  }
  return evidence.commands.some(
    (command) =>
      command.classification[kind] &&
      command.success &&
      command.seq > evidence.lastMutationSeq,
  );
}

function commandForKind(evidence, kind) {
  return evidence.commands.filter(
    (command) => command.classification[kind] || (kind === 'verification' && command.success),
  );
}

/**
 * Audit one final answer against the evidence in its own turn.
 *
 * @param {{text: string, events: object[], config?: object}} input
 * @returns {{code: string, message: string}[]} unsupported-claim findings
 */
export function auditFinalAnswer({ text, events, config = {} }) {
  const answer = String(text ?? '');
  const issues = [];
  const evidence = collectEvidence(events);
  const claims = detectClaims(answer);

  for (const claim of claims) {
    if (!hasFreshCommand(evidence, claim.kind)) {
      const label = KIND_LABEL[claim.kind] ?? claim.kind;
      const beforeLastEdit =
        evidence.lastMutationSeq >= 0 &&
        commandForKind(evidence, claim.kind).some((command) => command.success);
      issues.push({
        code: 'missing-verification',
        message: beforeLastEdit
          ? `The answer claims ${label} succeeded, but the only successful ${label} command ran before the last file change in this turn.`
          : `The answer claims ${label} succeeded, but no successful ${label} command ran in this turn.`,
      });
    }

    if (
      config.auditTestTampering !== false &&
      claim.kind === 'test' &&
      evidence.testMutations.length > 0 &&
      !disclosesTestChange(answer)
    ) {
      const paths = [...new Set(evidence.testMutations.map((mutation) => mutation.path))].slice(0, 4);
      issues.push({
        code: 'undisclosed-test-change',
        message: `The answer claims tests pass after modifying ${paths.join(', ')}, but does not disclose those test or verification-file changes.`,
      });
    }

    if (config.auditBypass !== false) {
      const bypasses = evidence.commands.filter((command) => {
        if (!command.classification.bypass || command.seq <= evidence.lastMutationSeq) {
          return false;
        }
        const shell = stripShellPayloads(command.command);
        const kind = command.classification;
        return (
          kind.test ||
          kind.build ||
          kind.lint ||
          kind.typecheck ||
          /\bgit\s+(?:commit|push)\b/i.test(shell)
        );
      });
      if (bypasses.length > 0) {
        const sample = stripShellPayloads(bypasses[0].command)
          .split(/\r?\n/)[0]
          .slice(0, 240);
        issues.push({
          code: 'bypass-used',
          message: `The answer claims ${KIND_LABEL[claim.kind] ?? claim.kind} succeeded, but a verification command used a bypass flag: ${sample}.`,
        });
      }
    }
  }

  if (config.auditUrls !== false) {
    const cited = new Set();
    const prose = stripCodeFences(answer);
    for (const match of prose.matchAll(URL_PATTERN)) {
      const normalized = normalizeUrl(match[0].replace(/[.,;:!?)\]}>'"]+$/g, ''));
      if (normalized) cited.add(normalized);
    }
    let reported = 0;
    for (const url of cited) {
      if (evidence.urls.has(url)) continue;
      if (reported >= MAX_URL_ISSUES) break;
      reported += 1;
      issues.push({
        code: 'ungrounded-url',
        message: `The answer cites ${url}, but that URL never appeared in the user's message or a tool result in this turn.`,
      });
    }
  }

  const seen = new Set();
  return issues.filter((issue) => {
    const key = `${issue.code}\u0000${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Model-facing correction queued as a user message after an unsupported answer. */
export function renderCorrection(issues) {
  const lines = issues.map((issue, index) => `${index + 1}. ${issue.message}`).join('\n');
  return `<truth_gate>
Your previous answer contains claims that this session's tool results do not support:

${lines}

Do not repeat those claims. Either:
- run the missing verification now, after the last file change, and cite the exact command and result; or
- correct the answer and label the claim "not verified" or "not run".

If you changed tests, fixtures, or verification files, disclose exactly which files changed and why. Then give the corrected final answer. Treat this as a correctness requirement, not a suggestion.
</truth_gate>`;
}
