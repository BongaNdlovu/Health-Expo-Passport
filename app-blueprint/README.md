# App Blueprint

A fill-in template for planning a whole app to production standard before the code is written.

| File | What it is |
| --- | --- |
| [BLUEPRINT.md](BLUEPRINT.md) | The blank template: 19 sections, plus an ADR template, glossary and references. |
| [EXAMPLE-stokfam.md](EXAMPLE-stokfam.md) | The template filled in (abridged) for a Stokfam-style app, showing what "done" looks like. |

## How to use it

1. Copy `BLUEPRINT.md` into the new repo as `docs/BLUEPRINT.md`.
2. Fill in the sections roughly in order. Each part is grounded by the one before:

   | Sections | Topic |
   | --- | --- |
   | §1–3 | why and what |
   | §4–5 | the quality bar and data |
   | §6–8 | how it's built and secured |
   | §9–13 | how it ships and stays up |
   | §14–17 | cost, people, risk, launch |

3. Build a **walking skeleton** first (§15, milestone M1). That means one thin journey deployed through the real pipeline to staging, before any feature work.
4. Keep the document alive. When reality changes, update the section and add an ADR. Don't let the plan drift from the system.

## The three rules that make it work

- **Every number is labelled** FACT (with a source in §18), TARGET (a decision with an owner), or NOT MEASURED.
- **Every section ends in a "Done when" checklist** that someone else could verify.
- **Tags say what can wait.**
  - **[MVP]** must be true before real users arrive.
  - **[SCALE]** waits until a named trigger.

  A small team can launch with only the [MVP] items ticked.
