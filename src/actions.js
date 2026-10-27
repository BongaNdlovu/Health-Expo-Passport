// @ts-check
/* Delegated events. Every button, form and field declares data-action="name" (or data-on-input /
   data-on-change for field events, so a select's change does not also fire on the click that opened
   it) plus data-* attributes for its arguments; one routing function attached to the four event types
   finds the nearest element that declares an action and calls its adapter with (element, event).
   The security policy needs no 'unsafe-inline' for scripts, because no handler markup is inline.
   The registry is filled in src/action-registry.js; main.js calls initActions() once at boot. */
const ACTIONS = {};

/** Registers action adapters; a plain function receives (element, event) and may ignore both. */
export function registerActions(map) { for (const k of Object.keys(map)) ACTIONS[k] = map[k]; }

/** Runs the action declared on the nearest data-action element around `el` (or null). */
export function dispatch(el, ev) {
  const t = el && el.closest ? el.closest('[data-action],[data-on-input],[data-on-change],[data-on-toggle]') : null;
  if (!t) return;
  /* a form's action is its submit handler: a click, input or change on a field inside it bubbles up to the form,
     and running the submit then would validate early and (via preventDefault) undo the tick of a checkbox */
  if (t.tagName === 'FORM' && (!ev || ev.type !== 'submit')) return;
  const name = ev && ev.type === 'input' ? t.dataset.onInput : ev && ev.type === 'change' ? t.dataset.onChange
    : ev && ev.type === 'toggle' ? t.dataset.onToggle : t.dataset.action;
  const fn = name && ACTIONS[name];
  if (!fn) { if (name) console.warn('no action registered for "' + name + '"'); return; }
  if (t.hasAttribute('data-backdrop') && ev && ev.target !== t) return;   /* modal backdrop: only a click on the dimmed itself closes */
  fn(t, ev);
}

export function initActions() {
  /* one routing function for all five event types */
  const route = ev => {
    if (ev.type === 'submit') {
      const t = ev.target.closest ? ev.target.closest('[data-action]') : null;
      if (t) { ev.preventDefault(); dispatch(t, ev); }
      return;
    }
    dispatch(ev.target instanceof Element ? ev.target : null, ev);
  };
  ['click', 'submit', 'input', 'change'].forEach(type => document.addEventListener(type, route));
  /* a <details> toggle event does not bubble, so it is caught on its way down instead */
  document.addEventListener('toggle', route, true);
}
