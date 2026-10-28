# UI inventory — Health Expo Passport 1.2.8

**Baseline:** tag `ui-baseline-1.2.8` (commit `7bed494e064c8236d23a1f76e27f24582e9fc205`, “Release v1.2.8 (versionCode 13): the volunteer hub ships in the APK.”).

Every `file:line` in this document is a line number in the **tag**, not in the live working tree. For example, `src/visitor.js:105` means line 105 of:

```bash
git show ui-baseline-1.2.8:src/visitor.js
```

All counts in §3 were measured against the tag tree. The tag was extracted with `git archive ui-baseline-1.2.8`; spot checks matched `git show ui-baseline-1.2.8:<path>` line-for-line. Estimates are labelled **estimate**. No browser, layout, animation, print, or visual regression test was run for this inventory.

---

## 1. Surface inventory

### 1.1 View functions

`render()` selects the view by `state.tab`; the four journey tabs (`screen`, `results`, `plan`, `send`) are wrapped by `journeyTop()` + `journeyBottom()`, while `serve` is dispatched separately by `renderServeView()`. See `src/shell.js:33-41` and `src/shell.js:74-83`.

| Surface | Entry point at tag | What it renders | Key classes / IDs | Actions dispatched |
|---|---|---|---|---|
| **Home** | `src/visitor.js:105` (`viewHome`), visitor-list helpers `src/visitor.js:199-224` | “Now serving” hero; BP/sugar/BMI tiles; clinical red-flag banner; continue/open-passport button; practice-mode bar; new-visitor form with POPIA consent; today’s visitor list; incoming-expo card. | `.stagger`, `.hero`, `.wave-clip`, `.wave`, `.tile`, `.tile-flag/.tile-watch/.tile-ok`, `.glass`, `.field`, `.vw-bar`, `.vw-sw`, `.btn`, `.tap-link`; `#visitorList`, `#rgName`, `#rgNumber`, `#rgErr`, `#homeHealth`. | `goVisit`, `switchTo`, `toggleReg`, `registerSubmit`, `pick-sex`, `openSwitcher`, `resetDemo`, `installApp`, `openCloud`, `openVolModal`; input handlers `guardian-show`, `visitors-filter`. |
| **Screen / Check** | `src/visitor.js:384` (`viewScreen`), helpers `src/visitor.js:305-314`, `373-383`, `451-537`, `573-637` | Consent gate; past-visit gate; red-flag banner; progress bar; “Your station” picker; BP card; 8 check cards; height/BMI input; medical history; Health Age survey; follow-up/interests/prayer card. | `.glass`, `.stagger`, `.st-bp`, `.st-grid`, `.st-one`, `.st-height`, `.step-btn`, `.step-input`, `.st-warn`, `.st-fix`, `.chip`, `.chip-flag/.chip-watch/.chip-ok`, `.availpill`, `.availpill-on`, `.fd-chip`, `.field`; `#redBanner`, `#stProgTxt`, `#stProgBar`, `#chip-*`, `#warn-*`, `#in-*`. | `recordConsent`, `new-visit`, `step`, `station-input`, `station-commit`, `height-set`, `answer-set`, `chronic-list`, `interest-toggle`, `prayer-set`, `tick-toggle`, `toggleOptin`, `setMyStation`, `reading-apply`. |
| **Results** | `src/results.js:37` (`viewResults`), helpers `src/results.js:14-32`, `105-132` | Three score tiles (actual age, now, 90-day goal); “what to work on”; “what adds the most years”; collapsible 90-day simulation with three sliders and BP bars; disclaimer. | `.glass`, `.rounded-[18px]`, `.bar-track`, `.bar-fill`, `.sim-panel`, `.chip`, `.pl-switch`, `.pl-det`; `#scoreGoal`, `#simNow`, `#simNew`, `#simCat`, `#simDrop`, `#simAge`. | No `data-action` buttons; `data-on-toggle="sim-open"`; range input `sim-set`. |
| **Plan** | `src/results.js:251` (`viewPlan`), content from `planFor()` `src/results.js:241-250` | Plan hero/problem; alternate-needs chips; “show a different plan”; church-plan picker; urgent box; “also talk about”; three action cards; “add later”; recheck/pills; help box; precautions; Food entry; full-day, hydro, evidence details. | `.glass`, `.hue-tint`, `.pl-problem`, `.pl-also`, `.fd-chip`, `.pl-switch`, `.ac-list`, `.ac-card`, `.ac-top`, `.ac-n`, `.ac-do`, `.ac-why`, `.ac-how`, `.ac-cost`, `.pl-urgent`, `.pl-h`, `.pl-more`, `.pl-row`, `.pl-ic`, `.pl-food`, `.pl-det`, `.ac-ref`. | `selectProtocol`, `openFood`, `chooseChurchPlan`; `data-on-toggle` none in Plan. |
| **Food** | `src/results.js:381` (`viewFood`), rows `src/results.js:391-404` | Plan selector chips; day/21-day/store-price segmented control; three cost tiles; food list with animated bars, cheapest/median/dearest mini-bars, expandable “why this food” details. | `.glass`, `.fd-chips`, `.fd-chip`, `.fd-seg`, `.fd-tiles`, `.fd-tile`, `.fd-list`, `.fd-row`, `.fd-head`, `.fd-name`, `.fd-val`, `.fd-track`, `.fd-bar`, `.fd-detail`, `.fd-mini`, `.fd-hi/.fd-lo`, `.fd-pouch`; `#fh-*`, `#fd-*`. | `closeFood`, `setFoodPlan`, `setFoodMetric`, `toggleFood`. |
| **Send home** | `src/visitor.js:60` (`viewSend`) | Four send options (WhatsApp, email, print, reserve pouch); follow-up line; follow-up-person picker. | `.stagger`, `.snd-list`, `.snd-item`, `.snd-ic`, `.snd-go`, `.is-on`, `.glass`, `.tap-link`. | Resolved template actions `openWhatsApp`, `openEmail`, `printCard`, `reservePouch`; `switchTab`; `chooseFollowup` via `followupPicker()`. |
| **Care** | `src/results.js:437` (`viewCare`), lists `462-472`, cards `476-494` | Three count tiles (Urgent, Nurse calls, Interests); three filtered lists; 30-card cap + “show more”; WhatsApp shortcut for opted-in visitors; CSV export. | `.glass`, `.stagger`, `.chip`, `.chip-flag/.chip-watch/.chip-ok`, `.chip-none`, `.btn`. | `exportCSV`, `openWAFor`, `showAllCare`. |
| **Queue** | `src/queue.js:306` (`viewQueue`), helpers `src/queue.js:221-305` | Live/demo/offline state bar; four totals; six station cards; selected-station detail with “Call next”, “Add visitor”, serving/waiting rows and remove/two-tap confirm. | `.q-state`, `.q-state-*`, `.q-totals`, `.q-total`, `.q-board`, `.q-card`, `.q-card-ok/watch/flag`, `.q-actions`, `.q-label`, `.q-row`, `.q-row-serving`, `.q-mini`, `.q-empty`, `.q-note`. | `openBigScreen`, `qSelect`, `queueCallNext`, `openQueuePick`, `queueServe`, `queueDone`, `queueBack`, `queueRemove`. |
| **Profile** | `src/account.js:551` (`viewProfile`), helpers `src/account.js:556-666` | Signed-out hero + sign-in form / service unavailable; signed-in hero + role/church chips, sync box, my details, health results, pledge, team, password, account/sign-out/delete. | `.pf`, `.stagger`, `.hero`, `.servechip`, `.sc-ok/.sc-warn/.sc-off`, `.tile`, `.tap-link`, `.field`, `.av`, `.hue-lilac`. | Signed out: `cloudSignIn`, `profGate` (`forgot`/`signup`), `cloudInit`; signed in: `saveMyDetails`, `myPledgeSave`, `my-pledge-edit`, `my-pledge-withdraw`, `profPassword`, `cloudSignOut`, `profDeleteAsk`, `profDeleteGo`, `prof-delete-typed`, `openAcct`, `openCloud`, `sync-now`, team actions. |
| **Church plan** | `src/churchPlans.js:88` (`viewChurchPlan`), picker `src/churchPlans.js:80-87` | Replaces the Plan screen when a church plan is chosen: church-authored goal/problem, urgent box, top actions, more actions, recheck/pills, help, precautions, “use the app’s plan instead”. | `.glass`, `.hue-tint`, `.hue-sage`, `.ac-card`, `.ac-top`, `.ac-n`, `.ac-do`, `.ac-why`, `.ac-how`, `.pl-problem`, `.pl-urgent`, `.pl-h`, `.pl-more`, `.pl-row`, `.tap-link`. | `chooseChurchPlan` (pick one / empty to return to app plan). |
| **No visitor** | `src/visitor.js:90` (`viewNoVisitor`) | Empty-state card shown for journey tabs when `attendees.length === 0`; register CTA. | `.glass`, `.stagger`, `.display`, `.btn`. | `registerNew`. |
| **Serve / Pledge** | `src/volunteer.js:157` (`viewVolPledge`), shell `123-143`, tabs `144-154` | Expo hero, staffed/vacancy counts, coverage bar, Serve sub-tabs, viewer’s badge card, how-volunteering-works steps, link to Muster. | `.hero`, `.wave-clip`, `.wave`, `.servechip`, `.vt-tabs`, `.glass`, `.medal`, `.rankpill`, `.covbar`, `.tile`, `.btn`, `.vw-bar`. | `openVolReg`, `switchToVol`, `logExpoEntry`, `setVolTab`; `openVolSwitcher` from the “Viewing … Switch” bar. |
| **Serve / Muster** | `src/volunteer.js:237` (`viewVolMuster`) | Team totals, booth coverage with leaders, confirmed helper rows, pending-registration rows, CSV export, show-more caps. | `.vt-tabs`, `.glass`, `.tile`, `.tile-watch`, `.covbar`, `.covbar-short/.covbar-none`, `.boothpick-glyph`, `.servechip`, `.rankpill`. | `switchToVol`, `exportVolCSV`, `setVolTab`, `showAllVol`, `openPlaceSheet` (when `mayPlace()`) or `setVol`. |
| **Serve / Booth** | `src/volunteer.js:448` (`viewVolBooth`) | Volunteer badge/assignment card, booth blurb, on-booth/expos/hours tiles, shift picker, team list, log/roster buttons, alternate booth choices. | `.glass`, `.hue-tint`, `.medal`, `.rankpill`, `.servechip`, `.tile`, `.availpill`, `.availpill-on`, `.boothpick-glyph`, `.covbar`. | `switchToVol`, `openVolReg`, `toggleShift`, `logExpoEntry`, `exportVolCSV`, `setVolTab`. |
| **Serve / Record** | `src/volunteer.js:567` (`viewVolRecord`) | Service-record header, badge card, next-tier progress, lifetime totals, expo log form, history rows, badge ladder, CSV export. | `.glass`, `.medal`, `.covbar`, `.tile`, `.tline`, `.tdate`, `.servechip`, `.sc-ok/.sc-off`, `.btn`. | `logExpoEntry`, `expo-remove`, `log-close`, `saveExpoEntry`, `exportVolCSV`, `setVolTab`. |
| **Serve / Registration** | `src/volunteer.js:745` (`viewVolRegister`), shared fields `680-723` | Back button; four sections: identity, pledge/skills/availability, booth preference, emergency/notes; sticky submit; registration-specific copy. | `.glass`, `.field`, `.availpill`, `.boothpick`, `.boothpick-sel`, `.microlabel`, `.sticky`, `.btn`. | `closeVolReg`, `saveVolunteer`; field handlers `vf-name`, `vf-phone`, `vf-shirt`, `vf-email`, `vf-emergency`, `vf-notes`; `pledge-pick`, `draft-toggle`, `toggleDraftBooth`, `pickSecondBooth`. |
| **Serve dispatcher** | `src/volunteer.js:123` (`renderServeView`) | Selects Pledge/Muster/Booth/Record/Registration and writes `#main.innerHTML`; suppresses repeated entry animation using `state._serveKey`. | Top-level `.stagger`. | None directly; the rendered sub-view supplies actions. |

### 1.2 Overlays and sheets

The tag has **nine** `role="dialog"` overlays with IDs: `#switcherModal`, `#tv`, `#queueModal`, `#notifSheet`, `#placeSheet`, `#cloudModal`, `#acctSheet`, `#volModal`, `#waModal` (`index.html:904-1018`). `#authGate` (`index.html:1022-1037`) is a blocking gate, not one of those nine. The crash card, toast, intro, and `#printArea` are additional non-sheet surfaces.

| Overlay / surface | Renderer at tag | What it renders | Key classes / IDs | Actions |
|---|---|---|---|---|
| **Switcher** | `src/volunteer.js:893` (`openSwitcher`), lists `916-949`, tabs `887-891` | Bottom sheet to switch visitor/volunteer; optional search over 25+ rows; active row mark; “register new visitor” / “pledge new volunteer” footer. | `#switcherModal`, `#switcherHead`, `#switcherList`, `#switcherFoot`; `.glass`, `.sheet-up`, `.rounded-t-[28px]`, `.bg-[#0b1a1c]/40`; `.field`, `.av`, `.tint`, `.servechip`. | Backdrop `closeSwitcher`; `setSwitchMode`, `pickAttendee`, `pickVolunteer`, `registerNew`, `startNewVolunteer`; input handlers `switcher-filter`, `vol-switcher-filter`. |
| **TV / projector board** | `src/queue.js:239` (`renderBigScreen`), open/close `254-263` | Full-screen dark queue board: state, clock, six station tiles, now-serving badge numbers, next badge numbers, wait estimate. | `#tv`, `#tvState`, `#tvClock`, `#tvGrid`; `.q-tv`, `.q-tv-top`, `.q-tv-grid`, `.q-tv-tile`, `.q-tv-ok/watch/flag`, `.q-tv-now`, `.q-tv-next`, `.q-tv-none`, `.q-tv-meta`. | `closeBigScreen`. |
| **Queue pick sheet** | `src/queue.js:195` (`openQueuePick`), rows `204-216` | Bottom sheet search/add a visitor to a station line; shows “In line”, “Being served”, or other station chips; disabled when already in this line. | `#queueModal`, `#queueHead`, `#queueList`; `.glass`, `.sheet-up`, `.q-pick`, `.q-who`, `.chip`, `.chip-ok`, `.chip-none`, `.q-mini`, `.field`. | Backdrop/Done `closeQueuePick`; `qPickAdd`; input handler `queue-filter`. |
| **Notifications** | `src/account.js:437` (`openNotifs`), `448-465` (`renderNotifs`), loader `440-446` | Bottom sheet of up to 50 notifications, newest first; unread marker; mark-all-read; offline/error empty states. | `#notifSheet`, `#notifBody`; `.glass`, `.sheet-up`, `.tap-link`, `.microlabel`, `.opacity-70`, `border-[#123033]/[.07]`. | Backdrop/Close `notif-close`; `notif-mark-read`, `notif-open`. |
| **Placement board** | `src/volunteer.js:353` (`openPlaceSheet`), `358-389` (`placeSheetHTML`) | Sheet for an admin/station leader: move to station, swap with eligible volunteer, release, make/remove team leader; shows preferences and linked-account warning. | `#placeSheet`, `#placeBody`; `.glass`, `.sheet-up`, `.boothpick`, `.boothpick-sel`, `.boothpick-glyph`, `.servechip`, `.av`, `.btn`. | Backdrop `place-close`; `place-move`, `place-swap`, `place-release`, `place-lead`. |
| **Cloud / staff sign-in** | `src/cloud.js:405` (`openCloud`), `444-470` (`renderCloudBody`), approvals `430-443` | Bottom sheet: signed-out email/password form; signed-in sync status, visitor/volunteer/pending tiles, sign-out, sync, status panel, account shortcuts, approvals, install block. | `#cloudModal`, `#cloudBody`; `.glass`, `.sheet-up`, `.tile`, `.btn`, `.field`, `.tap-link`, `.microlabel`. | Backdrop `closeCloud`; `cloudSignIn`, `cloudSignOut`, `sync-now`, `staff-approve`, `approvals-clear`; `hub-open` via `acctButtons`; `installApp`. |
| **Account hub** | `src/account.js:490` (`openAcct`), `498-506` (`renderAcct`), tabs `483-489`, body builders `507-520`, `669-870` | Bottom sheet with tabs My account / My church / All churches; details, screening results, pledge, team, church members, church plans/invites/details, platform-admin church list/audit. | `#acctSheet`, `#acctTabs`, `#acctBody`; `.glass`, `.sheet-up`, `max-h-[92vh]`, `.btn-primary/.btn-glass`, `.field`, `acctBox()` output, `.servechip`, `.tap-link`, `.tile`. | Backdrop `closeAcct`; `openAcct`, `leaveChurch`, `saveMyDetails`, `myPledgeSave`, `my-pledge-edit`, `my-pledge-withdraw`, `team-add`, `team-release`, `team-shift`, `plan-edit`, `plan-delete`, `plan-save`, `plan-edit-cancel`, `invite-make`, `copyInvite`, `shareInvite`, `member-approve`, `member-role`, `member-link`, `member-vol-link`, `followup-toggle`, `removeMember`, `stepDown`, `church-save`, `church-status`, `openChurchData`, `manageChurch`, `all-churches-back`, `back-to-churches`, `select-self`. |
| **Incoming expo / volunteer modal** | `src/volunteer.js:960` (`openVolModal`), `962-986` (`renderVolModal`), static `index.html:970-992` | Modal with expo ID/venue/date, pledge progress, booths still needing helpers, “See the team”, “Pledge to help”. | `#volModal`, `#volModalTitle`, `#volModalSub`, `#volBody`; `.glass`, `.modal-in`, `.rounded-[28px]`, `.bg-[#0b1a1c]/50`, `.covbar`, `.boothpick-glyph`. | Backdrop `closeVolModal`; `vol-modal-team`, `vol-modal-new`. |
| **WhatsApp / email preview** | `src/volunteer.js:1043` (`openWhatsApp`), preview `1001-1034`, footer `1035-1042`, `1053-1065` (`openEmail`) | Modal preview of the take-home scorecard + plan; email variant adds “Send to” field and optional save-to-badge checkbox; footer changes per channel. | `#waModal`, `#waSub`, `#waBody`, `#waFoot`; `.glass`, `.modal-in`, `.rounded-[28px]`, `.bg-[#0b1a1c]/50`, `.field`, `.btn`, `.rounded-[20px]`, `.text-[10px]`. | Backdrop `closeWhatsApp`; `recycleBadge`, `sendWhatsApp`, `sendEmail`. |
| **Auth gate** | `src/cloud.js:231` (`renderGate`), `gateState` `188-198`, account gates `src/account.js:108-132` | Full-screen blocking sign-in/gate flow: staff form, signup, verify, forgot, forgot-sent, new password, loading, error, unavailable, church selection/wait/suspended/pending/member. | `#authGate`, `#authGateBody`; `.glass`, `.modal-in`, `.rounded-[28px]`, `.field`, `.btn`, `.text-[#...]`, `.text-rose-600`, `.tap-link`. | `gateView`, `gateDemo`, `cloudSignIn`, `cloudSignUp`, `cloudResend`, `cloudForgot`, `cloudNewPassword`, `cloudSignOut`, `sync-now`, `cloudInit`, `gateBack`; account-gate actions such as `join-church`, `registerChurch`, `leaveChurch`, `openAcct`, `reg-church-form`, `reg-church-list`. |
| **Print area** | `src/volunteer.js:1187` (`buildPrintCard`), `1226-1231` (`fitPrintCard`), `1232-1249` (print paths), CSS `index.html:208-250` | Hidden A6 card target (`#printArea`); browser print uses `body.print-mode`; Android sends a standalone HTML document containing only `.pc-*` rules to `CardPrinter`. | `#printArea`; `.pc-card`, `.pc-head`, `.pc-body`, `.pc-grid4`, `.pc-metric`, `.pc-habit`, `.pc-foot`, `.pc-safety`, `.pc-verse`, `.pc-bottom`, `.pc-fit1/.pc-fit2`; `@page{size:105mm 148mm;margin:0}`. | `printCard`; no `data-action` in the rendered card. |
| **Toast** | `src/shell.js:86` (`toast`), `95-102` (`toastUndo`) | Bottom toast; optional Undo button (6 s) used by placement moves. | `#toast`, `#toastMsg`, `#toastUndo`; `.fixed`, `.bottom-28`, `.opacity-0`, `.translate-y-3`, `.rounded-2xl`; inline gradient. | Undo is assigned directly (`u.onclick`), not via the action registry. |
| **Crash card** | `src/crash.js:18` (`showCrash`) | Dynamically created full-screen `#crashCard` with message (300-char cap), Try again, Reload, Close. | Inline styles only; `role="alertdialog"`, `#crashMsg`, `#crashAgain`, `#crashReload`, `#crashClose`. | Direct listeners calling `crashAction('again'/'reload'/'close')`; no registry actions. |
| **Intro** | static `index.html:858-859`; script `src/shell.js:182-195` | Logo splash painted before scripts; beats/pops then app rises; removed after animations, 1.6 s stall fallback, 5 s cap; reduced-motion users never see it. | `#intro`, `.intro-badge`, `.intro-out`, root `.intro-rise`; `.intro-rise #app` animation. | None. |

### 1.3 Static shell surfaces

| Surface | Static markup at tag | JS emitters | Key classes |
|---|---|---|---|
| Header | `index.html:868-893` | `renderHeaderChip()` `src/shell.js:42-57`; `notifRefresh()` `src/account.js:404-410` | `.glass`, `.hdr-brand`, `.hdr-tools`, `.hdr-title`, `#headerChip`, `#cloudBtn`, `#cloudDot`, `#notifBell`, `#notifDot`. |
| Main content | `index.html:895` | `render()` / `renderMain()` `src/shell.js:33-41`, `74-83` | `#main`, `.stagger`, `.pour`. |
| Nav / dock | `index.html:897-900` | `renderNav()` `src/shell.js:61-73`; `movePill()` `111-134` | `#navBar`, `#navItems`, `#navPill`, `.nav-item`, `.nav-item-active`, `.nav-ico`, `.nav-lbl`, `.nav-badge`, `.nav-badge-alert`, `.nav-goo`, `.nav-pill`. |
| Ambient background | `index.html:861-864` | `movePill()` swaps `.ambient` hue class `src/shell.js:115` | `.ambient`, `.blob`, `.b1`–`.b5`, `.hue-*`. |
| Intro | `index.html:858-859` | `introLeave()` `src/shell.js:182-195` | `#intro`, `.intro-badge`, `.intro-rise`, `.intro-out`. |

### 1.4 Action contract

- Delegation is declared in `src/actions.js:14-26`: the nearest `[data-action]`, `[data-on-input]`, `[data-on-change]`, or `[data-on-toggle]` is resolved; forms submit through their `data-action`.
- Every registered name is in `src/action-registry.js:27-193`, and `main.js:21-22` calls `registerActions(ACTION_MAP)` + `initActions()`.
- **`data-action` names, `data-args`, field action names, element IDs, and CSS custom properties are part of the UI contract.** Tokenisation should not rename them.

---

## 2. Shared components actually in use

Measured usage below is “occurrences in `src/*.js`” from the tag, via `git grep -F`; it is a rough coupling signal, not a render count.

| Component | Defining CSS section at tag | JS helpers / emitters | Usage evidence |
|---|---|---|---|
| **Header / top bar** | `index.html:868-893`; header rules `498-506` | `renderHeaderChip()` `src/shell.js:42-57`; `notifRefresh()` `src/account.js:404-410` | Static `#headerChip`, `#cloudBtn`, `#notifBell`; header actions `openCloud`, `openNotifs`, `switcher-open`. |
| **Nav / dock** | `index.html:897-900`; CSS `109-125`, `296-301`, `361-364`, `393-394` | `SERVE_TABS` `src/shell.js:22-29`; `renderNav()` `61-73`; `movePill()` `111-134` | 6 tabs; `.nav-item` 3 JS hits; `.nav-pill` one emitter but heavily styled. |
| **Glass cards** | `54-72`, `251-276`, `401-404`; `.glass.hue-tint` `338-339` | Raw class emission in every view; no single card helper. `acctBox()` `src/account.js:105` creates a card-like box with its own utility classes. | `.glass` 124 JS hits + 20 static body hits; `.glass-thin` 1 JS hit. |
| **Hero** | `137-147`, `272-276`, `352-353`, `408`, `508` | `viewHome` `src/visitor.js:114-138`; `viewVolPledge` `src/volunteer.js:164-180`; `profHero` `src/account.js:549-550` | `.hero` 10 JS hits; waves in Home/Serve. |
| **Tiles / metrics** | `126-136`, `279-280`, `832-833` | `metric()` `src/visitor.js:109`; `scoreTiles()` `src/results.js:14-19`; tile inline `39-42`; `countTile()` `src/results.js:440-442`; `profSync()` `src/account.js:602`; `platformHTML()` `src/account.js:783`. | `.tile` 34 JS hits. |
| **Buttons** | `87-101`, `284-295`, `826`; `.btn-hue` `337` | Raw classes; `pwField()` includes the Show/Hide button `src/cloud.js:218-220`. | `.btn-primary` 47 JS hits; `.btn-glass`, `.btn-soft`, `.btn-hue`. |
| **Fields / form controls** | `102-108`, `558-562`, `661`, `848-853` | `pwField()` `src/cloud.js:218-220`; `stepperHTML()` `src/visitor.js:373-383`; `st-height` markup `409-410`; raw `.field` in forms. | `.field` 59 JS hits; `.step-input` and `.step-btn` used in Screen. |
| **Chips / status pills** | `.chip*` `78-86`, `281-282`, `341`; `.availpill` `478-482`, `821`; `.servechip` `448-453`; `.rankpill` `444-446`; `.fd-chip` `757-759` | `chipOf()` / `chipNote()` / `chipClass()` `src/helpers.js:60-74`; status classes from `STATUS_UI` `src/data.js:95-99`; `badgeTier()` `src/volunteer.js:42-47`. | `.chip` 54 JS hits; `.servechip` 16; `.availpill` 13; `.rankpill` 4; `.fd-chip` 5. |
| **Toast** | No dedicated section; inline `index.html:1041-1048`; `dropIn` keyframes `index.html:370`; static inline gradient `index.html:1044` | `toast()` `src/shell.js:86-92`; `toastUndo()` `95-102` | Used by nearly every write action; Undo only for placement. |
| **Sheets / modals** | `.sheet-up` `190-191`; `.modal-in` `193-194`; `.is-closing` `318-321`; scrim `371-372`, `415-416`; static overlays `903-1018` | `showModal()` / `hideModal()` `src/volunteer.js:885-886`; `data-backdrop` handling `src/actions.js:24`; `hideModal` 260 ms close. | 9 overlays + auth gate; every overlay toggles `hidden`/`flex`. |
| **Avatars / initials** | `.av` `336`; `.tint`/`.ico` `335`; hue map `327-334` | `initials()` `src/helpers.js:23`; `hueOf()` `src/data.js:679`; badge hue via `badgeTier()` | `.av` used in Home, switcher, Care, placement, Profile, volunteer rows. |
| **Pills / segmented pills** | `.availpill` `478-482`, `.rankpill` `444-446`, `.servechip` `448-453`, `.fd-chip` `757-759`, `.nav-pill` `297-299`, `.jr-change` `678`, `.vw-sw` `667` | Raw templates; no central pill helper beyond class maps. | `.availpill-on` is the selected state; `.fd-chip[aria-pressed="true"]` is the food selector. |
| **Medals** | `.medal` `429-442`, `.medal-sm` `439-442` | `medalHTML()` `src/volunteer.js:79-84`; `starGlyph()` `71-75`; `badgeTier()` `42-47` | Volunteer Pledge/Booth/Record, team rows. |

**Duplication note:** there is no single Card / Button / Field / Pill component in JS. They are raw class strings spread across views, so a token change in CSS affects all of them but a class rename must be swept through `src/*.js` and `index.html`.

---

## 3. Hardcoded colour / utility debt

### 3.1 Method and totals

Measured over the tag tree with `[regex]::Matches` on the exact `git show`/archive bytes:

- hex colours: `#` + 3, 6, or 8 hex digits, with a following word boundary to exclude `#acctSheet`;
- arbitrary colour utilities: `(text|bg|border|ring|from|to|via|divide|fill|stroke|shadow)-[#rrggbb]`;
- named palette utilities: `(text|bg|border|ring|from|to|via|divide)-(white|black|brand|rose|amber|sky|sage|lilac|mint|aqua|peach|sand)` with optional shade/opacity;
- inline hex: hex tokens inside `style="…"` attributes.

| Measure | Count |
|---|---:|
| Hex colour tokens in `src/*.js` | **331** |
| … of which inside arbitrary colour utility classes | **308** (93.1%) |
| … `text-[#...]` | **283** |
| … `bg-[#...]` | **5** |
| … `border-[#...]` | **20** |
| Named Tailwind palette utilities in `src/*.js` | **168** |
| `rgba()` literals in `src/*.js` | **6** |
| Inline-style hex tokens in `src/*.js` | **14** (crash 9, visitor 3, volunteer 2) |
| Hex tokens in authored `index.html` CSS | **319** |
| Hex tokens in generated Tailwind block (`index.html:518`) | **28** |
| Hex tokens in static shell inline styles | **18** |
| Named palette utilities in static shell body | **22** |
| Arbitrary colour utilities in static shell body | **18** |
| Authored CSS `rgba()` / gradients / `!important` / media queries / keyframes | **252 / 86 / 18 / 16 / 24** |
| Authored CSS custom-property declarations | **51** |

**Headline:** roughly **505 hardcoded colour decisions in `src`** (331 hex + 168 named utilities + 6 `rgba()`), before the 384 literal hex tokens in `index.html` (319 authored CSS + 28 generated Tailwind + 1 head meta + 36 in the body, of which 18 are inline-style and 18 arbitrary utility classes). The same greys are repeated hundreds of times; the top 8 hex values account for 283 of 331 JS hex tokens.

### 3.2 Per-file counts (measured)

Columns: hex tokens; arbitrary colour utilities (text/bg/border); named palette utilities; hex inside inline styles. Hex includes the arbitrary-utility hexes, so do not add columns together.

| File | Hex | Arbitrary (text/bg/border) | Named utilities | Inline-style hex | Render/UI role |
|---|---:|---:|---:|---:|---|
| `src/account.js` | 65 | 65 (55/0/10) | 21 | 0 | Profile, account sheet, notifications, gates, church/platform admin |
| `src/churchPlans.js` | 10 | 10 (7/0/3) | 3 | 0 | Church plan view/picker, follow-up |
| `src/cloud.js` | 35 | 27 (23/0/4) | 15 | 0 | Gate screens, cloud panel, status signals |
| `src/crash.js` | 9 | 0 | 0 | 9 | Crash overlay (all inline) |
| `src/data.js` | 2 | 2 (2/0/0) | 1 | 0 | `precautionsHTML()` |
| `src/results.js` | 34 | 34 (33/1/0) | 50 | 0 | Results, Plan, Food, Care |
| `src/shell.js` | 9 | 9 (9/0/0) | 0 | 0 | Header chip/nav labels |
| `src/visitor.js` | 45 | 42 (39/2/1) | 24 | 3 | Home, Screen, Send, NoVisitor, consent |
| `src/volunteer.js` | 122 | 119 (115/2/2) | 54 | 2 | Serve, registration, placement, switcher, modal, WhatsApp, print |
| **Total** | **331** | **308** | **168** | **14** | |

Zero-debt source files: `queue.js` has **0** arbitrary/named colour utilities in JS; its debt is concentrated in authored CSS (`.q-*`, `index.html:569-653`). `results.js:323-434` (Food) has only **1** arbitrary utility. Print-card JS has **0**.

### 3.3 Per-surface counts (measured within render spans)

These are occurrences inside the named render span, including any helper functions drawn by that span. Spans overlap (e.g. Home includes visitor-row/list helpers; Screen includes consent/history/survey helpers), so **rows are not additive**. “Arb” = arbitrary colour utility occurrences; “Named” = named palette utility occurrences; “Hex” = all hex tokens.

| Surface | Span at tag | Arb | Named | Hex | Arbitrary literals appearing in span |
|---|---|---:|---:|---:|---|
| Home | `src/visitor.js:105-224` | 16 | 12 | 17 | `text-[#0f2a2c]`, `text-[#5b7178]`, `text-[#5c747a]`, `text-[#6b8187]`, `text-[#4f6870]`, `text-[#8a9aa0]`, `text-[#9db0b4]`, `bg-[#123033]` |
| Journey chrome | `src/visitor.js:23-50` | 0 | 0 | 0 | — |
| Screen / Check | `src/visitor.js:370-637` | 14 | 8 | 14 | `text-[#6b8187]`, `bg-[#123033]`, `text-[#5c747a]`, `text-[#4f6870]`, `text-[#33504f]` |
| Send | `src/visitor.js:60-84` | 3 | 0 | 3 | `text-[#5c747a]`, `text-[#123033]`, `text-[#3d5c5e]` |
| NoVisitor | `src/visitor.js:90-96` | 2 | 0 | 2 | `text-[#0f2a2c]`, `text-[#5b7178]` |
| Results | `src/results.js:14-132` | 18 | 30 | 18 | `text-[#33504f]`, `text-[#5c747a]`, `text-[#123033]`, `text-[#3d5c5e]`, `text-[#6b8187]`, `text-[#0f2a2c]`, `text-[#b3c2c5]`, `text-[#8a9aa0]`, `text-[#667d83]` |
| Plan | `src/results.js:251-321` | 7 | 4 | 7 | `text-[#0f2a2c]`, `text-[#33504f]`, `text-[#3d5c5e]`, `text-[#8a9aa0]` |
| Food | `src/results.js:323-434` | 1 | 3 | 1 | `text-[#5c747a]` |
| Care | `src/results.js:436-494` | 8 | 13 | 8 | `text-[#5c747a]`, `text-[#6b8187]`, `text-[#5b7178]`, `text-[#128C4B]`, `bg-[#123033]` |
| Profile | `src/account.js:523-666` | 7 | 10 | 7 | `text-[#0f2a2c]`, `text-[#5b7178]`, `text-[#5c747a]`, `text-[#33504f]`, `text-[#8a9aa0]` |
| Account hub | `src/account.js:483-520` | 2 | 1 | 2 | `text-[#123033]`, `text-[#4f6870]` |
| Notifications | `src/account.js:400-480` | 5 | 1 | 5 | `text-[#5c747a]`, `border-[#123033]`, `text-[#8a9aa0]`, `text-[#123033]`, `text-[#4f6870]` |
| Account gates | `src/account.js:104-185` | 17 | 3 | 17 | `text-[#5c747a]`, `border-[#123033]`, `text-[#0f2a2c]`, `text-[#5b7178]`, `text-[#33504f]`, `text-[#8a9aa0]`, `text-[#4f6870]`, `text-[#123033]` |
| Church admin / platform | `src/account.js:669-870` | 20 | 3 | 20 | `text-[#123033]`, `border-[#123033]`, `text-[#33504f]`, `text-[#4f6870]`, `text-[#8a9aa0]` |
| Health / pledge boxes | `src/account.js:188-370` | 13 | 2 | 13 | `text-[#8a9aa0]`, `text-[#6b8187]`, `border-[#123033]`, `text-[#123033]`, `text-[#33504f]`, `text-[#4f6870]`, `text-[#bf9a40]` |
| Gate screens | `src/cloud.js:231-337` | 13 | 6 | 13 | `text-[#0f2a2c]`, `text-[#5c747a]`, `border-[#123033]`, `text-[#4f6870]`, `text-[#8a9aa0]`, `text-[#33504f]`, `text-[#5b7178]` |
| Cloud panel | `src/cloud.js:405-470` | 11 | 5 | 11 | `border-[#123033]`, `text-[#4f6870]`, `text-[#123033]`, `text-[#33504f]`, `text-[#6b8187]`, `text-[#5b7178]`, `text-[#5c747a]` |
| Status signals | `src/cloud.js:485-572` | 2 | 1 | 2 | `border-[#123033]`, `text-[#8a9aa0]` |
| Queue pick | `src/queue.js:195-217` | 0 | 0 | 0 | — |
| TV board | `src/queue.js:237-252` | 0 | 0 | 0 | — |
| Queue view | `src/queue.js:268-323` | 0 | 0 | 0 | — |
| Serve / Pledge | `src/volunteer.js:157-234` | 19 | 2 | 19 | `text-[#0f2a2c]`, `text-[#5c747a]`, `text-[#667d83]`, `text-[#5b7178]`, `text-[#33504f]`, `text-[#6b8187]`, `text-[#8a5a12]`, `bg-[#123033]` |
| Serve / Muster | `src/volunteer.js:237-303` | 8 | 4 | 8 | `text-[#0f2a2c]`, `text-[#5b7178]`, `text-[#33504f]`, `text-[#8a9aa0]`, `text-[#6b8187]` |
| Serve / Booth | `src/volunteer.js:448-564` | 18 | 3 | 18 | `text-[#0f2a2c]`, `text-[#5b7178]`, `text-[#667d83]`, `text-[#6b8187]`, `text-[#33504f]`, `text-[#123033]`, `text-[#8a9aa0]` |
| Serve / Record | `src/volunteer.js:567-665` | 21 | 6 | 21 | `text-[#0f2a2c]`, `text-[#33504f]`, `text-[#5b7178]`, `text-[#bf9a40]`, `text-[#c9d3d6]`, `text-[#6b8187]`, `text-[#8a5a12]`, `text-[#123033]`, `text-[#8a9aa0]`, `text-[#b8c4c8]` |
| Serve / Registration | `src/volunteer.js:675-777` | 7 | 0 | 7 | `text-[#6b8187]`, `text-[#5b7178]`, `text-[#0f2a2c]`, `text-[#33504f]`, `text-[#8a9aa0]` |
| Placement sheet | `src/volunteer.js:353-422` | 9 | 3 | 9 | `text-[#123033]`, `text-[#4f6870]`, `text-[#8a5a12]`, `text-[#8a9aa0]`, `text-[#6b8187]` |
| Switcher | `src/volunteer.js:884-959` | 7 | 12 | 7 | `text-[#1f6b62]`, `text-[#5b7178]`, `bg-[#123033]`, `text-[#6b8187]` |
| Volunteer modal | `src/volunteer.js:960-986` | 6 | 3 | 6 | `border-[#123033]`, `text-[#8f5420]`, `text-[#33504f]`, `text-[#5b7178]` |
| WhatsApp / email | `src/volunteer.js:1000-1065` | 15 | 17 | 17 | `border-[#123033]`, `text-[#5b7178]`, `text-[#33504f]`, `text-[#8a9aa0]`, `text-[#6b8187]` |
| Print card | `src/volunteer.js:1186-1250` | 0 | 0 | 1 | — |
| Church plan | `src/churchPlans.js:88-123` | 2 | 0 | 2 | `text-[#0f2a2c]`, `text-[#4f6870]` |
| Church plan picker | `src/churchPlans.js:80-87` | 0 | 0 | 0 | — |
| Shell header/nav | `src/shell.js:33-83` | 9 | 0 | 9 | `text-[#123033]`, `text-[#667d83]`, `text-[#6b8187]` |
| Precautions block | `src/data.js:186-206` | 2 | 1 | 2 | `text-[#33504f]`, `text-[#3d5c5e]` |

### 3.4 Most repeated literals (measured)

| Literal | Occurrences in `src/*.js` | Likely semantic role |
|---|---:|---|
| `#123033` | 57 | primary ink / scrim-track border |
| `#6b8187` | 48 | tertiary/meta text |
| `#33504f` | 43 | body-strong text |
| `#5b7178` | 41 | secondary text |
| `#4f6870` | 24 | muted text |
| `#8a9aa0` | 24 | faint/meta text |
| `#0f2a2c` | 24 | heading ink |
| `#5c747a` | 22 | muted text |
| `#3d5c5e` | 9 | body text |
| `#667d83` | 8 | small meta text |
| `#8a5a12` | 6 | watch/amber ink |
| `#9db0b4` | 4 | disabled/placeholder |
| `#fff` | 3 | on-dark/hairline |
| `#e0a63a` | 3 | cloud loading/syncing dot |

### 3.5 Named palette utilities (measured)

The 168 named utilities are concentrated in status and surface classes. Top occurrences:

| Utility | Count | Utility | Count |
|---|---:|---|---:|
| `text-rose-700` | 21 | `bg-white/60` | 14 |
| `text-rose-600` | 15 | `text-brand-800` | 10 |
| `text-brand-700` | 9 | `border-amber-200/70` | 5 |
| `bg-amber-50/80` | 5 | `ring-brand-400/25` | 5 |
| `border-rose-200/70` | 5 | `bg-white/70` | 5 |
| `bg-white/85` | 4 | `border-white/90` | 4 |
| `bg-brand-500/10` | 4 | `text-amber-800` | 4 |
| `text-brand-900` | 4 | `border-sky-200/70` | 3 |
| `text-sky-800` | 3 | `bg-brand-500` | 3 |
| `text-amber-900` | 3 | `text-brand-600` | 3 |
| `text-lilac-700` | 3 | `bg-rose-50/70` | 3 |

This is not a Tailwind build step: these class strings are hand-written in templates and rely on the precompiled `#tw` block (`index.html:518`) plus `#tw-extra` (`519-855`).

### 3.6 Inline / dynamic colour debt

- **Static shell** has 18 arbitrary colour utilities and 18 inline-style hex tokens; overlay scrims repeat `bg-[#0b1a1c]/40` or `/50` eight times (`index.html:904`, `924`, `934`, `943`, `952`, `960`, `970`, `995`).
- **`CLOUD_UI`** stores status dot colours as hex (`src/cloud.js:134-142`): e.g. `#e0a63a`.
- **Crash card** is entirely inline-styled with 9 hex tokens (`src/crash.js:26-36`).
- **`viewHome`** has an inline `style="color:#4f6870"` on Reset demo (`src/visitor.js:174`); **`viewScreen`** uses inline backgrounds for read-only visitor number (`src/visitor.js:161`) and other small fixes.
- **Volunteer/WhatsApp** use inline gradients (`src/volunteer.js:1041`); visitor error buttons use inline flat colours (`src/visitor.js:356-357`); print previews use `style="flex:1"` etc.
- Dynamic class names avoid literal scans: `hue-${hueOf(a.id)}`, `hue-${badgeTier(v).hue}`, `q-state-${k}`, `q-card-${st.tone}`, `q-tv-${s.tone}`, `text-${...}` generated from status maps. These are **not** counted as arbitrary literals but still need semantic mapping.

**Tokenisation implication:** replacing every `text-[#...]` with a semantic class in markup is safer than redefining the arbitrary selector, because `#tw` is generated. Keep the existing named status classes (`chip-flag`, etc.) or alias them to semantic status tokens.

---

## 4. CSS map — `index.html`

`index.html` has 1,052 lines. Authored CSS is 823 lines across two `<style>` blocks (29-516 and 520-854); the second block is `#tw-extra`; `index.html:518` is a single 21,787-byte generated Tailwind 3.4.17 line. The body starts at 857.

### 4.1 Authored CSS sections

Status means “referenced in the tag's markup/JS” based on `git grep` and class scans. “Dead” means no reference outside the CSS at all; “layered” means the same class is redefined later and the later block is a partial override, not a replacement.

| Lines | Section | Purpose | Status / evidence |
|---|---|---|---|
| 29-43 | BASE | Body font/background/ink, number-input cleanup, range accent, `.no-scrollbar` | Referenced. `body` + `.field`/`.no-scrollbar` in markup/JS. |
| 44-53 | AMBIENT BACKGROUND | `.ambient`, `.blob`, `.b1`–`.b3` fixed background field | Referenced. `index.html:861-864`, `src/shell.js:115`. |
| 54-72 | GLASS SYSTEM | `.glass`, `.glass-thin`, `.hairline` | Referenced: `.glass` 124 JS + 20 body hits; `.glass-thin` 1. `.hairline` dead (see 4.3). |
| 73-77 | TYPE | `.microlabel`, `.display`, `.mono` | Referenced: 102 / 52 / 48 JS hits. |
| 78-86 | CHIPS | `.chip`, `.chip-ok/watch/flag/none` | Referenced via `chipClass()` `src/helpers.js:74`, plus literal `.chip` use. |
| 87-101 | BUTTONS | `.btn`, `.btn-primary`, `.btn-glass`, `.btn-soft` | Referenced; `.btn-primary` 47 JS hits. Layered later at 284-295. |
| 102-108 | FORM FIELDS | `.field`, placeholder, focus ring | Referenced; `.field` 59 JS hits. |
| 109-125 | NAV | `.nav-item`, `.nav-item-active`, `.nav-ico`, `.nav-lbl`, `.nav-badge`, `.nav-badge-alert` | Referenced by `renderNav()`; layered at 296-301, 343-344, 393-394. |
| 126-136 | TILES / METRICS | `.tile`, `.tile-l`, `.tile-v`, `.tile-watch/flag/ok` | Referenced; `.tile` 34 JS hits; layered at 279-280, 339, 832-833. |
| 137-147 | HERO | `.hero` base gradient/radius/shadow | Referenced; layered at 260, 269, 272-276, 352-353, 408, 508. |
| 148-157 | SIM PANEL | `.sim-panel`, `.bar-track`, `.bar-fill` | Referenced by Results simulation. Layered at 303-304, 323, 382-385, 516. |
| 158-170 | STEPPER | `.step-btn`, `.step-input` | Referenced by Screen; layered at 254, 661, 694-695, 848-853. |
| 171-207 | ANIMATIONS | `.stagger`, `.pop-in`, `.fade-in`, `.sheet-up`, `.modal-in`, `.pulse-dot`, reduced-motion base | Referenced via `.stagger`/`.sheet-up`/`.modal-in`; `.fade-in` and `.pulse-dot` dead (4.3). `@keyframes fadeIn` is reused by `.lite` at 423. |
| 208-250 | A6 PRINT CARD | `#printArea`, `.pc-*`, `@page`, `body.print-mode` | Referenced by `buildPrintCard()`/`printCard()`; `.pc-item` dead (4.3). |
| 251-324 | v3 LIQUID GLASS REFRESH | Overrides glass/hero/tiles/chips/nav/buttons; ripple `.rip`; `.is-closing`; slider styling; new `rise` | Referenced. Layered over 54-250; do not delete as a “newer version” of the earlier block. |
| 325-355 | v4 HUES | `:root` and `.hue-*` tokens (`--t1`, `--t2`, `--s1`, `--s2`, `--ink`), avatars/buttons/tints | Referenced widely: `hue-` 71 JS hits. |
| 356-377 | v5 MORE LIQUID | Ambient transitions, `.nav-goo`, `.wave`, `.w1/.w2`, `.jelly`, `.dropIn`, dialog scrim | Referenced: Home/Serve waves, nav pill, `jelly()`. |
| 378-400 | v6 LIQUID FINISH | `fillIn`, `.pour`, nav icon jelly, range thumb, reduced-motion overrides | Referenced: Results bars, Plan card pour, nav. |
| 401-427 | v7 PERFORMANCE | Removes glass backdrop blur, static blobs/waves, `.wave-clip`, `.lite` mode, fade entry | Referenced: `.lite` 3 JS + body class; `.wave-clip` Home/Serve. |
| 428-484 | VOLUNTEER / SERVE | `.medal`, `.rankpill`, `.servechip`, `.boothpick`, `.covbar`, `.tline`, `.tdate`, `.availpill` | Referenced by all Serve views; `.sc-hot` dead (4.3). |
| 485-516 | v8 INTRO / SIZES | `#intro`, `.intro-badge`, header sizing, safe-area, Home title clamp, stagger durations, bar duration | Referenced by static intro, header/nav, Home, and harness source regexes. |
| 518 | GENERATED TAILWIND | 21,787-byte precompiled Tailwind 3.4.17 subset (includes likely-unused utilities) | Referenced broadly by utilities in all views. Over-inclusive and not hand-editable; regenerate from markup. Several selectors are likely unused (4.3). |

### 4.2 `#tw-extra` and body sections

| Lines | Section | Purpose | Status / evidence |
|---|---|---|---|
| 519-558 | TW-EXTRA TOP-UP | Utilities the volunteer screens need but the generated block lacks; comment says regenerate and delete after a rebuild | Referenced; harness class-existence test depends on it (`.smoke/harness.js:801-847`). |
| 560-567 | PHONE / INSTALLED APP | 16px fields on coarse pointers, overscroll containment, tap-action, standalone selection | Referenced by static CSS only; no JS hook. |
| 569-626 | LIVE QUEUE | `.q-state*`, `.q-totals`, `.q-board`, `.q-card*`, `.q-actions`, `.q-label`, `.q-row`, `.q-mini*`, `.q-empty`, `.q-pick`, `.q-note`, `.q-tvbtn` | Referenced by `viewQueue()`; `.q-state-*` and `.q-card-*` are dynamically emitted by `qStateBar()`/`qCard()`. |
| 627-653 | BIG SCREEN / TV | `.q-tv*`, 3×2 grid (2×3 portrait), vmin type, tone classes | Referenced by `renderBigScreen()`; `.q-tv-ok/watch/flag` dynamic. |
| 654-668 | CHECK WARNINGS | `.st-warn`, `.st-fix`, `.st-height`, `.is-bad`, `.step-input.is-bad` | Referenced by Screen and reading validation. |
| 669-710 | VISITOR JOURNEY FRAME | `.jr`, `.jr-who`, `.jr-av`, `.jr-name`, `.jr-steps`, `.jr-step`, `.jr-dot`, `.jr-foot`, `.jr-btns`, `.jr-note` | Referenced by `journeyTop()`/`journeyBottom()`. |
| 711-753 | PLAN | `.pl-problem`, `.pl-also`, `.pl-switch`, `.pl-urgent`, `.pl-h`, `.ac-list`, `.ac-card`, `.ac-top`, `.ac-n`, `.ac-do`, `.ac-why`, `.ac-how`, `.ac-ref`, `.ac-cost`, `.pl-more`, `.pl-row`, `.pl-ic`, `.pl-food`, `.pl-det` | Referenced by Plan, Church plan, Food, Send. |
| 754-810 | FOOD | `.fd-*` list, chips, segmented control, tiles, bars, detail, pouch | Referenced by `viewFood()`/`foodDetail()`. |
| 811-830 | READABILITY | Raises tiny type, darkens faint greys, min tap heights, min buttons | Referenced globally; do not delete as “overrides” — it is deliberate accessibility policy. |
| 831-854 | SPACING | Home tile spacing, `.st-grid`, `.q-totals`, `.jr-steps`, `.vt-tabs`, `.st-bp` | Referenced by Home, Screen, Queue, Serve. |
| 855 | `</style>` | End of `#tw-extra` | — |
| 858-859 | INTRO | Pre-script logo splash | Referenced by `src/shell.js:182-195`. |
| 861-864 | AMBIENT | Five blob spans | Referenced by `movePill()` ambient class swap. |
| 866-901 | APP SHELL | `#app`, header, `#main`, nav/dock | Referenced constantly; `#main` is the render target. |
| 903-1018 | NINE OVERLAYS | Switcher, TV, queue, notifications, placement, cloud, account, vol modal, WhatsApp | Referenced by IDs from `open*`/`close*` functions. |
| 1020-1039 | GATE + PRINT | Auth gate, `#printArea` | Referenced by `renderGate()` and `buildPrintCard()`. |
| 1041-1048 | TOAST | `#toast`, `#toastMsg`, `#toastUndo` | Referenced by `toast()`/`toastUndo()`. |
| 1050 | MODULE SCRIPT | `./src/main.js` | App entry. |

### 4.3 Likely dead rules (give these a visual diff before deletion)

A simple `.class` scan finds 285 distinct authored class selectors. A static scan found 15 with no direct literal use: 10 are dynamic families (`q-state-*`, `q-card-*`, `q-tv-*`) that are emitted by template interpolation, and 5 are the rules below.

| Rule | Line(s) | Grep evidence at tag | Verdict |
|---|---|---|---|
| `.hairline` | 71 | `git grep -n -F hairline ui-baseline-1.2.8 -- index.html src/*.js` → 1 hit, the definition | **Likely dead.** No markup/JS. |
| `.fade-in` | 188 | same grep → 1 hit, the definition | **Likely dead class.** Keep `@keyframes fadeIn` at 423 because `.lite` uses it. |
| `.pulse-dot` | 197-198 | same grep → 1 hit at the definition | **Likely dead.** `pulseDot` keyframes have no other user. |
| `.pc-item` | 231-232 | `git grep -n -F pc-item …` → 2 hits, both inside the print CSS; no `.pc-item` in `buildPrintCard()` | **Likely dead** (old print-card row). |
| `.sc-hot` | 453 | same grep → 1 hit, the definition | **Likely dead.** `STATUS_UI` uses `sc-warn`/`sc-ok`, never `sc-hot`. |

Generated Tailwind is over-inclusive. These utilities have **no use in markup or `src`**; the only possible match is the generated block at `index.html:518` (escaped selectors such as `.bg-black\/55`): `.object-cover`, `.h-40`, `.w-40`, `.text-lg`, `.bg-brand-400`, `.text-brand-200`, `.border-brand-300`, `.bg-black/55`, `.text-sky-950/85`, `.rounded-tr-[20px]`. **Do not hand-delete these**; rebuild `#tw` from final markup and delete `#tw-extra` only then (its own comment at 520-523 says exactly that).

### 4.4 Cascade / safe-deletion notes

A class appearing once in the map does not mean its rules are disposable; the stylesheet is layered deliberately:

- `.glass`: base 55-62; v3 261-265; hue tint 338; v7 403-404.
- `.hero`: base 138-146; v3 260, 269-276; v4 352-353; v7 408; v8 508.
- `.btn`: 88-92; v3 284-285; readability 826. `.btn-primary` 93-95 + 286; `.btn-glass` 96-98 + 288.
- `.chip-ok`: 82; 281; 341. `.tile`: 127-129; 280; 339; 833. `.bar-fill`: 154-156; 304; 323; 382-385; 516.
- `.nav-item-active`: 115-116; 301; 344; 394.

Deleting an early block because a later block “overrides” it will drop properties the later block does not repeat (layout, radius, shadow, base background). Safe order is: remove only the five dead rules above; regenerate the Tailwind block; then refactor tokens section by section with computed-style/screenshot checks.

**CSS custom properties are behaviour contracts** and must survive tokenisation with the same names:

- `--pct`: range fill, set by `syncRanges()` `src/shell.js:106`; used at `index.html:308`, `345`.
- `--w`, `--d`: food bar widths/delays, emitted at `src/results.js:358`, `395`; used at `777-780`.
- `--mx`, `--my`: pointer sheen, set at `src/shell.js:144`; used at `270`.
- `--navh`: sticky journey footer, set at `src/shell.js:59`; used at `690`.
- `--qc`: queue tone, set by `.q-card-ok/watch/flag` and `.q-tv-*`; used at `589-590`, `643-644`.
- `--t1`, `--t2`, `--s1`, `--s2`, `--ink`: hue system `326-344`, used by `.ico`, `.tint`, `.av`, `.btn-hue`, `.rankpill`, `.boothpick`, etc.

---

## 5. Tests — what `.smoke/harness.js` does and does not prove

### 5.1 What the harness is

`.smoke/harness.js` is a Node/vm smoke test. It:

1. bundles `src/main.js` with esbuild (`harness.js:11-14`);
2. reads `index.html` as text (`17`);
3. builds a hand-written fake DOM (`63-109`) with `classList`, string `innerHTML`, `style.display`, and id lookup;
4. boots the bundle in a vm (`150-155`);
5. calls `__NEWSTART.__internals` functions directly (`158-160`) and asserts strings/state.

It is **not** a browser. `getComputedStyle` is a stub returning `''` (`135`); `document.querySelectorAll()` returns `[]` (`105`); fake `querySelector` returns a fresh element (`84`); `getBoundingClientRect()` is fixed at 100×40 (`87`); `document.addEventListener` is a no-op (`107`). Therefore layout, CSS cascade, real events, focus, scrolling, real animations, media queries and print layout are not exercised.

### 5.2 UI assertions it does make

| Area | Evidence at tag | What is asserted |
|---|---|---|
| Core views render | `harness.js:214-237` | Serve sub-tabs return >400 chars; Home/Screen/Results/Plan/Care return >200 chars; registration form contains “Who you are”; registration has 12 `boothpick` occurrences. Send/Queue/Profile are covered by their later dedicated blocks, not this loop. |
| Shared container | `245-255` | `#main.style.display !== 'none'` and non-empty HTML after Serve and after returning to each visitor tab. |
| Tab navigation | `256-270` | Each Serve sub-tab has its marker text; Team tab container stays visible. |
| Profile / nav active | `1943-2084`, esp. `1979` | Profile page states, nav item string includes `nav-item hue-lilac nav-item-active` + `aria-current="page"`, auth/delete/save flows. |
| Account/status screens | `1927-1933`, `2073-2079`, `2517-2522` | Every class string in captured account/profile/status HTML appears somewhere in the CSS text; used-size thresholds >30/>40/>15. |
| Every CSS class used is defined | `801-847` | Collects `class="..."` strings from many rendered states; checks `css.includes('.' + escapedClass)`. 12 booth choices, all views, switcher, WhatsApp, print, cloud, all gate states, empty screens. |
| Escaping / injection | `403-417`, `632-670`, `2531-2569` | Hostile names, prayers, phone/email, church/member/status fields do not appear as markup on every screen. |
| Intro / motion / layout source | `1061-1104` | CSS source contains expected intro keyframes, header/safe-area rules, stagger/bar durations, reduced-motion blocks, nav pill rules, fill transforms; source text has no `startViewTransition`; intro script is regex-checked. |
| Intro logic | `1114-1166` | Extracted `introLeave()` function is run with fake animation promises/timers: waits for animation finish, 1.6 s stall fallback, 5 s cap, leaves once, old-browser path. |
| Print native path | `1048-1051` | `printCard()` does not throw in app mode; printed HTML contains `@page{size:105mm 148mm` and “Never stop prescribed pills suddenly”. |
| Queue UI | `3314-3346` | Queue demo flow; nav badge count; `viewQueue()` includes “Who is waiting where”, “Big screen”, “Being served”. |
| PWA shell | `3045-3048` | Static HTML has mobile tags, manifest/icons, viewport-fit; service worker registration source text. |
| Exact markup assumptions | e.g. `3571` | Church-plan button must match an exact class/markup string. |

### 5.3 Source-text-only assertions (do not prove browser behaviour)

These pass by matching **text** in `index.html`/`src/*.js`, not by rendering:

- “cards arrive within half a second” (`1084-1085`): regex on `.stagger`/`.pour` durations.
- “people who ask for less motion…” (`1088-1089`): regex on `@media (prefers-reduced-motion:reduce)`.
- “header never makes the page wider than the phone” (`1076-1078`): regex on header CSS, not layout.
- “header and tabs clear the phone’s status/gesture bar” (`1079-1080`): regex on `padding-top:max(...)`/`padding-bottom:max(...)`, not computed safe-area.
- “nav pill slides in one spring, self-corrects…” (`1090-1094`): checks class names and the presence of `_pillRaf` in source; never moves a pill.
- “speed: … static, bars grow with transforms” (`1095-1100`): regex on CSS text, no runtime measurement.
- “tab switches are plain renders” (`1086-1087`): source regex, no browser transition behavior.
- “Profile tab is the highlighted one” (`1979`): HTML string regex, not computed colour/background.
- “serve tab keeps the container visible” (`246-254`): only the fake `style.display` string.
- “every class … exists” (`845`, `1931`, `2077`, `2520`): `css.includes(...)`; a selector that is dead, inside a comment, inside an unmatched media query, or overridden still passes.
- `getComputedStyle` is never used for an assertion; the only definition is the returning-empty stub (`135`).

### 5.4 Gaps that matter for this migration

1. **No computed-style checks.** No assertion reads resolved colour, font size, contrast, background, border, radius, shadow, z-index, or visibility.
2. **No layout checks.** No `offsetWidth/offsetHeight`, `scrollHeight/clientHeight`, `scrollWidth`, `getBoundingClientRect` in the fake DOM; no overflow, clipping, sticky-footer, safe-area, or nav-pill geometry.
3. **No real animation checks.** CSS keyframes are regexed; the intro logic is unit-tested with fake promises. No `Animation`/`getAnimations()` browser result, no `prefers-reduced-motion` runtime, no transition timing.
4. **No CSS cascade/specificity check.** Class existence is substring-only. Duplicate `.glass`/`.hero`/`.btn`/`.chip-ok` layers, `!important` overrides, and utility collisions are invisible.
5. **No dark mode / token / contrast check.** No `prefers-color-scheme`, no token resolution, no WCAG contrast computation.
6. **No modal behaviour check.** No focus trap, focus return, Escape/backdrop click, scroll lock, z-index stacking, or `hideModal` 260 ms closing test. `document.addEventListener` is a stub.
7. **No print/PDF check.** `fitPrintCard()` cannot measure because fake elements have no `scrollHeight/clientHeight`; the test only checks the A6 `@page` string and some copy.
8. **No accessibility check.** ARIA states are usually asserted as strings; no screen-reader tree, role computation, target size, or keyboard navigation.
9. **Brittle exact-source assertions.** e.g. exact button markup at `3571`, exact `state.tab=t;render();window.scrollTo(0,0)` at `1087`, exact copy checks. Formatting changes can fail tests without a UI change.

---

## 6. Migration order

### 6.0 Prerequisite — token layer (not a screen)

Do this first, with **no visual change**:

- Add semantic tokens for surface/ink/muted/line/brand/status/scrim/glass/radius/shadow, plus status aliases (`danger`, `watch`, `ok`, `info`).
- Keep `.hue-*` and the custom properties used by JS (`--pct`, `--w`, `--d`, `--mx/--my`, `--navh`, `--qc`) working under their old names.
- Bridge old CSS classes to the new tokens in place; do not reorder the cascade or delete the layered blocks yet.
- Replace raw arbitrary utilities only after the semantic class exists; do not redefine `text-[#...]` selectors globally.
- **Estimate:** `index.html` authored CSS 823 lines / ~120-220 edited lines; plus 9 source files for class swaps. This is the highest-leverage step and the one the current harness cannot validate visually.

Recommended verification after P0: browser screenshots at 360, 390, 768, 1280 px; light/dark; reduced motion; signed-in/out; empty/demo/live; print preview. The harness should remain green but is not sufficient.

### 6.1 Safest screen sequence

The order below starts with isolated CSS and low clinical risk, then shared/clinical screens, then auth and the large volunteer surface. “Edit size” is an **estimate** of changed lines, not a measured diff; “source span” is the measured code region to inspect.

| # | Surface | Files / source span | Why this position | Depends on | Risk | Edit size (est.) |
|---:|---|---|---|---|---|---|
| 1 | **Queue + TV** | `src/queue.js:195-323`; `index.html:569-653` | Zero arbitrary/named colour utilities in JS; all debt is the dedicated `.q-*` CSS. Isolated from visitor/clinical content. | P0; none | **Low** (behaviour-critical, but CSS-only) | 1 JS + 1 CSS; ~100-160 |
| 2 | **Food** | `src/results.js:323-434`; `index.html:754-810` | Only 1 arbitrary utility; own `.fd-*` CSS; one entry point. | P0; Plan hue tokens (`HUE_P`) | **Low-Med** | 1 JS + 1 CSS; ~80-120 |
| 3 | **Print card** | `src/volunteer.js:1187-1234`; `index.html:208-250` | 0 JS arbitrary utilities; isolated `.pc-*`; colour-only changes are straightforward. | P0; plan/visitor content; A6 preview | **Medium** (fixed A6 clipping; native CSS extraction) | 1 JS + 1 CSS; ~60-100 |
| 4 | **Home** | `src/visitor.js:105-233`, consent `273-289` | High-traffic but structurally simple; establishes avatar/tile/button mappings used elsewhere. | P0; shell/header; consent fields | **Medium** | 1 JS; ~80-130 |
| 5 | **Care** | `src/results.js:436-494` | Small, list-based, reuses chips/avatars; good place to settle status-chip tokens. | P0; Care status semantics | **Medium** (redFlag must not change) | 1 JS; ~40-70 |
| 6 | **Results** | `src/results.js:14-132` | Establishes score tiles, bars, sim panel, chip mappings used by Plan. | P0; Care chip tokens; sim layout | **Med-High** (clinical numbers, simulation) | 1 JS; ~90-140 |
| 7 | **Plan + Church plan** | `src/results.js:251-321`; `src/churchPlans.js:80-123` | Shares `.ac-*`/`.pl-*`; highest content branching, so do after Results primitives. | P0; Results tokens; Food entry | **High** (many conditional branches, disclaimer) | 2 JS; ~90-140 |
| 8 | **Send + WhatsApp/email** | `src/visitor.js:60-84`; `src/churchPlans.js:230-239`; `src/volunteer.js:1001-1065`; `index.html:995-1018` | Shares plan copy; can be done as one content-preservation pass. | Plan; Print card | **Med-High** (message copy, escaping) | 2 JS + 1 HTML; ~90-140 |
| 9 | **Screen / Check** | `src/visitor.js:370-637` | Highest clinical interaction density: live steppers, consent gate, red flags, history/survey. Do last among visitor screens. | All visitor tokens; chips; stepper; Care/Results semantics | **High** | 1 JS; ~150-230 |
| 10 | **Gate / cloud** | `src/cloud.js:231-337`, `405-470`; `src/account.js:104-185`; `index.html:1022-1037` | Consequence of a visual break is lockout; do after core screens and P0 are stable. | P0; forms/buttons; account gaps | **High** (auth lockout) | 3 files; ~160-240 |
| 11 | **Profile + account hub + notifications** | `src/account.js:400-520`, `523-666`, `669-870`; `index.html:933-967` | Complex role/state surfaces; depends on auth gate and account tokens. | Gate/cloud; forms; status chips | **High** (roles, RLS messaging) | 1 JS + 1 HTML; ~160-240 |
| 12 | **Serve: Pledge, Muster, Booth, Record** | `src/volunteer.js:123-303`, `448-665`; `index.html:428-484` | Largest colour debt (119 arbitrary utilities) and many badge/coverage states; do after account roles are stable. | P0; tokens; account/role gates; Care chips | **High** | 1 JS + CSS; ~220-340 |
| 13 | **Registration + placement + switcher + vol modal** | `src/volunteer.js:353-422`, `675-777`, `884-986`; static overlay CSS | Permission-sensitive placement and shared modal helpers; last because it depends on Serve and account. | Serve; `showModal`/`hideModal`; role gates | **High** | 1 JS; ~180-280 |
| 14 | **Global overlays / toast / crash / intro sweep** | `src/shell.js:86-195`; `src/crash.js:18-51`; `index.html:903-1048` | Cross-cutting; do last when stacking, z-index, motion and scrim tokens are settled. | Every surface above | **Medium** | 3 files; ~60-100 |

**Why this order:** it keeps the first edits in CSS with no clinical or auth logic (Queue/TV, Food), settles card/list/status primitives on Home/Care/Results, then handles the high-branch Plan and copy-sensitive Send/WhatsApp, then the clinical Screen, then auth/account, then the large volunteer surface. The queue and TV are behaviour-critical, so their CSS migration must be followed by a live/demo/offline queue smoke test, but their styling is the most isolated.

### 6.2 Checkpoints that replace missing browser tests

- **Every step:** light + dark screenshot at 360/390 px; one 768/1280 px layout; reduced-motion on; no-console-error check.
- **Queue/TV:** demo, live, offline, empty line, serving, long wait, >99 badge, 3×2 and 2×3 TV grid.
- **Food/Print:** cheapest/median/dearest bars; A6 browser print preview and Android print path; safety note not clipped.
- **Screen:** consent/no-consent, minor guardian, past-visit, red flag, invalid reading, all 8 stations, single-station mode.
- **Auth/account:** every `gateState()` state; member vs staff vs church admin vs platform admin; pending/suspended/churchwait; deleted account; notifications offline.
- **Serve:** prospect/registered/checked-in; no leader/leader; admin/leader/non-placer; placement move/swap/release/lead/undo.

---

## 7. Behaviour that must not change

### 7.1 Auth and authorization

- `gateState()` must keep its states and precedence (`src/cloud.js:188-198`): hidden, newpass, pending, error, loading, unavailable, form, signup, verify, forgot, forgotSent, and the account gates (`church`, `churchwait`, `suspended`, `pending`, `member`) from `ACCT_GATES` (`src/account.js:25`, `108-132`).
- UI gating is not authorization: Supabase RLS and RPCs enforce access. Do not move a check into CSS or hide-only markup.
- Password rules and copy (`src/cloud.js:201-209`) and the “same answer whether or not the address exists” forgot-password behavior (`378-392`) must remain.
- `cloud.demo`/`gateDemo()` (`src/cloud.js:337`) must remain the only way into practice mode without a session; demo must never show real shared data.

### 7.2 Clinical status and ordering

- **Thresholds must not change:** `redFlag()` = systolic ≥160, diastolic ≥100, sugar ≥15 or <3 (`src/helpers.js:28`); `cat()` bands for BP, sugar, cholesterol, BMI, fat, water, waist, PEF, pulse, veg, walk, water, sleep (`32-54`).
- **Chip semantics must not change:** `chipClass()` maps `flag`/`watch`/`ok`/none to `.chip-flag/.chip-watch/.chip-ok/.chip-none` (`74`). A colour token change must not invert or merge these.
- **Ordering:** red-flag triage before the step test (`src/visitor.js:420-424`); urgent box before the home plan (`src/results.js:235-239`, `277`); “see the triage nurse now” before any plan. `planNeeds()` order is deliberate (`src/results.js:146-179`).
- Results wording `readings deleted` / screening-not-diagnosis / “not health professionals” (`src/results.js:34`, `101`; `src/data.js:185-192`) must stay; it is content, not decoration.

### 7.3 Queue

- Modes and refusal: `qMode()` / `qCan()` (`src/queue.js:28-29`); `qGate()` refuses offline live changes (`57-63`). Do not add optimistic offline writes.
- Status vocabulary: `waiting`, `serving`, `done`, `left` (`src/queue.js:34-39`); one active entry per visitor/station is enforced by the database, not the UI.
- Realtime re-sync (`src/queue.js:170-185`) and the 18-hour window (`20`) must remain.
- TV privacy: **badge numbers only, never names** (`index.html:913` comment; `src/queue.js:239-252`). Keep `WAITING/SERVING` counts and ETA semantics.
- Demo queue is in-memory and lost on reload (`src/queue.js:11-15`, `73-89`); that is intentional.

### 7.4 Print

- `#printArea` stays hidden (`index.html:209`); print is triggered by `body.print-mode` + `@page{size:105mm 148mm;margin:0}` (`244-249`).
- `.pc-card` is fixed 105mm × 148mm; `fitPrintCard()` measures and adds `.pc-fit1/.pc-fit2` (`src/volunteer.js:1226-1231`). Do not change card box sizing or remove those classes.
- Android print extracts only CSS rules whose selector contains `.pc-` (`src/volunteer.js:1243-1245`) and sends `#printArea.innerHTML` to `CardPrinter.print` (`1246-1248`). Renaming `.pc-*` classes or restructuring the card silently breaks native print.
- Keep the safety line, “never stop prescribed pills suddenly”, deleted-readings note, and no-QR state (harness asserts no QR, `harness.js:663`).

### 7.5 Offline, demo, persistence

- Offline-first data: `localStorage` write is the source of truth for visitors/volunteers; `persistNow()` (`src/state.js:22-37`); `SYNC_KEY` ledger (`src/cloud.js:36`, `114-131`).
- Demo/reset: `seedDemo()`, `resetDemo()` (`src/visitor.js:362-366`); demo visitors are not shared; reset is refused when connected (`src/visitor.js:363`).
- **Persistence keys/formats must not change without a migration:** `newstart.passport.v2` (`src/state.js:9`), `newstart.cloud.v1` (`src/cloud.js:36`), `newstart.church.v1` (`src/account.js:24`), `newstart.churchplans.v1` (`src/churchPlans.js:19`), `newstart.invite.v1` (`261`), `newstart.myStation` (`src/visitor.js:470`). `migrateAttendee`/`migrateVolunteer` assumptions (`src/state.js:45-86`) must remain.
- POPIA consent gate: a passport with no consent must show `consentCard()` and no check inputs (`src/visitor.js:305-314`, `416`); under-18 guardian fields (`277-300`); consent version `2026-10-27` (`249`). Retention is 7 days / 2 years (`src/retention.js:9-10`).

### 7.6 Action and CSS contracts

- `data-action`, `data-args`, `data-on-input`, `data-on-change`, `data-on-toggle`, `data-backdrop`, IDs, and the action registry names are API-like. Renaming them requires changing `src/action-registry.js` and every template.
- `showModal`/`hideModal` rely on `hidden`/`flex` and `.is-closing`; `data-backdrop="1"` closes only on the backdrop (`src/actions.js:24`).
- Do not remove the `--pct`, `--w`, `--d`, `--mx/--my`, `--navh`, `--qc` custom properties; they are written/read by JS.
- Keep the six tabs and four journey steps: `SERVE_TABS` (`src/shell.js:22-29`), `JOURNEY` (`src/shell.js:19-20`), labels and `nav-go` mapping.

---

## 8. Five biggest CSS/UI risks

1. **The cascade is deliberately layered, and deletion is unsafe by inspection.** `.glass`, `.hero`, `.btn`, `.chip-ok`, `.tile`, `.bar-fill`, `.nav-item-active` are redefined across 3-5 sections (e.g. `.glass` at 55, 261, 338, 404; `.hero` at 138, 260, 269, 272, 274, 352, 408, 508). Later blocks are partial overrides, not replacements. With 319 hex + 252 rgba + 86 gradients + 18 `!important` and no computed-style test, a “cleanup” that removes an early block can silently drop layout/radius/shadow. The five genuinely dead rules are safe; whole sections are not.
2. **Dark mode / glass will not invert mechanically.** The app is explicitly light-only (`index.html:18`, no `prefers-color-scheme` anywhere), with 168 named utilities heavily using white/translucency (`bg-white/60` ×14, `bg-white/70` ×5, `bg-white/85` ×4, `border-white/90` ×4) plus 252 `rgba()` and 86 gradients. Hardcoded white borders, white glass gradients, `backdrop-filter: none`, `color-mix`, and the teal hue variables need real surface/ink tokens and contrast checks; a global find/replace will break contrast and layering.
3. **Clinical colour semantics are safety-critical.** `redFlag`, `cat`, `chipClass`, the red banner, urgent box, Care lists, queue tones and TV tones all encode `flag/watch/ok`. There are 21 `text-rose-700`, 15 `text-rose-600`, 5 `border-rose-200/70`, plus `.chip-flag`, `.tile-flag`, `.q-card-flag`, `.q-tv-flag`, `.pc-hot`. A token map that maps red/amber by hue alone, or a dark-mode palette that dims danger, can make triage look less urgent. Map to semantic status tokens and keep the thresholds/ordering unchanged.
4. **Colour debt is enormous and spread across templates.** 331 hex tokens, 308 arbitrary colour utilities (283 `text-[#...]`, 5 `bg-[#...]`, 20 `border-[#...]`), 168 named utilities, 14 inline-style hex, 6 `rgba()`. The top eight greys are repeated 283 times. There is no component abstraction for buttons/cards/fields/pills, so replacing literals touches 9 JS files plus `index.html`; the class-existence test only checks that a class string exists, not that the right token won, not contrast, and not dark mode.
5. **Print and overlays are fixed-layout, high-consequence surfaces with no real layout test.** The A6 card is 105×148mm, `fitPrintCard()` relies on `scrollHeight/clientHeight`, Android prints only `.pc-*` rules, and the safety note can be clipped. Seven sheets sit at z-50, TV and account at z-70, auth gate at z-65, toast at z-60, crash at z-90, intro at z-100, with `max-h`, sticky nav/`--navh`, and a 260ms close; no focus, scroll-lock, stacking, safe-area, or print-preview test exists. A token/class refactor can break these without a single failing assertion.

---

## Evidence and limits

### Commands used

```bash
git rev-parse ui-baseline-1.2.8
git ls-tree -r --name-only ui-baseline-1.2.8
git show ui-baseline-1.2.8:src/visitor.js
git show ui-baseline-1.2.8:src/results.js
git show ui-baseline-1.2.8:src/volunteer.js
git show ui-baseline-1.2.8:index.html
git show ui-baseline-1.2.8:.smoke/harness.js
git grep -n -o -E '(text|bg|border|ring|from|to|via|divide|fill|stroke|shadow)-\[#[0-9a-fA-F]{3,8}\]' ui-baseline-1.2.8 -- 'src/*.js'
git grep -n -F hairline ui-baseline-1.2.8 -- index.html src/*.js
git grep -n -F pc-item ui-baseline-1.2.8 -- index.html src/*.js
git grep -n -F sc-hot ui-baseline-1.2.8 -- index.html src/*.js
git grep -n -F fade-in ui-baseline-1.2.8 -- index.html src/*.js
git grep -n -F pulse-dot ui-baseline-1.2.8 -- index.html src/*.js
```

The tag tree was extracted to a temporary directory outside the repository for line-number-stable reading. Spot checks with `git show … | Select-Object -Index` matched the quoted lines (e.g. `src/visitor.js:105` = `export function viewHome(){`, `src/queue.js:306` = `export function viewQueue(){`, `index.html:904` = `#switcherModal`).

### What was not verified

- No browser was launched; no screenshot, computed-style, layout, contrast, focus, keyboard, animation, print-preview or PDF check was run.
- `.smoke/harness.js` was **read**, not executed. No pass/fail claim is made.
- Per-surface counts are line-span scans and overlap shared helpers; they are not dependency-complete.
- Dead-code classifications are static. Dynamic emitters are marked as dynamic (`q-state-*`, `q-card-*`, `q-tv-*`, `hue-*`, `tile-*`); only rules with zero static/dynamic rationale are labelled likely dead.
- No file other than this document was intentionally modified. The working tree already had untracked `mockup-review-dark.png`, `mockup-review-light.png`, and `tools/serve.js`; additional untracked tooling/verification files (`tools/capture.ps1`, `tools/ui-budget.js`, `tools/visual-diff.ps1`, `verification/`) appeared during the session. They were not used as evidence and were not created or modified by this inventory.
