# Home & Sign-In feature parity

The mockup composition is a skin, not a scope cut. Every capability that lived on the old Home
(v1.2.8) and the old gate is still reachable, and the remaining screens keep their existing
controls until they are migrated.

| Capability | v1.2.8 location | New location | State |
|---|---|---|---|
| Switch visitor | header chip + “Find a visitor” button | hero staff pill; sheet down-arrow | present |
| Register a new visitor | “+ New visitor” button above the list | sheet header **+** button; empty-state CTA | present |
| Search visitors | search input when >25 visitors | unchanged (`#vq`, same handler) | present |
| Visitor row progress | 8 dots + name check | `n / 4` step badge + “n/8 checks” in the row sub + ✓ when done | present |
| Notification centre | header bell + unread badge | hero bell + unread badge; both dots updated by `notifRefresh` | present |
| Cloud sync status / sheet | header cloud button + status dot | hero cloud button + status dot; sheet footer “Sync / Sign in”; both dots updated by `setCloud` | present |
| Sign in / sync | header cloud sheet | hero cloud button; sheet footer | present |
| Reset demo | list-header link | sheet footer action | present |
| Install app | list-header link (when offered) | sheet footer action | present |
| Practice mode / sign in | practice bar | practice banner with Sign in | present |
| Home health panel | under visitors header | unchanged (`#homeHealth`) | present |
| Incoming expo / pledge | wide banner with “Pledge to help · pick your booth · n awaiting registration” | same banner; pending text restored as a third line | present |
| Active visitor | row highlight | `.hx-row.is-on` | present |
| Theme | new | hero Light/Dark control + gate control; persisted | present |
| Gate auth | email/password, show, forgot, create, verify, pending, error, unavailable | same state machine and handlers; new card/CTA | present |
| Gate demo | “Practise first” button | Practise Sandbox tile (+ Offline Training tile), both call `gateDemo()` | present |
| Gate sandbox safety | not offered once the device holds shared data | `#gateSandbox` hidden when `cloud.mode` is true | preserved |

## Deliberate visual changes that are not capability changes

- The old global header is hidden **on Home only**; it still renders on every other tab. Its
  visitor chip, cloud and notification actions are re-hosted inside the hero.
- Eight progress dots became a readable “n/8 checks” line plus the journey badge. The old dots were
  8 px each and unlabelled; the information is now text.
- The volunteer “wave” decoration and the hue-tinted glass were removed; they carried no action.
- The gate’s two sandbox tiles replace the single demo button, so both entry points are still live.

## Verification

- `npm test` — 825 checks, including the notification bell show/hide/count and gate form checks.
- `npm run typecheck` — 0.
- Screenshots: `verification/shots/home-features-390-{light,dark}.png`.
- Not yet migrated: journey, queue, care, results, plan, send, team, profile, overlays — these
  screens retain all current controls while their visual migration is pending.
