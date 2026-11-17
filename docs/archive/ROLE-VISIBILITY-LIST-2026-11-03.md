# Who sees what: role-only controls and admin wording (list for approval, 2026-11-03)

Read from the code on `fix/2026-11-02-review`. Line numbers are as they were before the change.

**Status (2026-11-03): approved with the recommendations, and done.**
- **Part A:** tags are on the controls. My church and All churches carry one tag at the top of the screen instead of
  one per box. A16 (the "tap to place" hint) has no tag, since that line is cut short on a phone.
- **Part B:** texts reworded, and Help filtered by role.
- **Part C:** kept as is.
- **Part D:** softened.
- **Checks:** FUP-ROLE-1 to 6 in `.smoke/harness.js`.

**Roles in the app:**
- **Platform admin:** the app owner. Has "All churches".
- **Church admin:** two posts, the Health Department Leader (rank 1) and the Assistant (rank 2).
- **Team leader:** a volunteer marked ★ for one station.
- **Staff:** approved, can see visitors.
- **Member:** approved, sees only their own things.
- **Practice mode:** not signed in; everything is open.

**Your two rules:**
1. Anyone with special rights sees a clear, consistent label on every control that only they have.
2. Nobody else is told those controls exist.

## Part A: role-only controls and their labels today

Proposed label: one small tag in the same style everywhere: **Admin only**, **Leader & admin**, **Leader of the
Health Department**, or **App owner**. In practice mode no tag is shown, because everyone can do everything there.

| # | Where | Control | Who sees it | Label today | Proposed tag |
|---|---|---|---|---|---|
| A1 | Profile → tabs (account.js:705-706, 740, 844) | **My church** tab | Church admin, platform admin | none | Admin only |
| A2 | Profile → tabs (same lines) | **All churches** tab | Platform admin | "(platform admin)" on one button (:209) only | App owner |
| A3 | Profile chips (account.js:833) | "Platform admin" chip | Platform admin | chip | keep |
| A4 | My church → **Health Expos** box (account.js:936, 1186-1194) | + New Health Expo, Edit, Open for members, Mark done, Reopen, Delete | Church admin, platform admin | "Save as a draft (only admins see it)" on one button (:1261) | Admin only, on the box title |
| A5 | My church → **Members** box (account.js:937-940) | Approve, Remove, admin-post picker | Church admin | none | Admin only |
| A6 | Members → admin post picker (account.js:962) | Give or take an admin post | Health Department Leader, platform admin | none | Leader of the Health Department |
| A7 | My church → **My admin post** box (account.js:942) | Step down, swap posts | Church admin | none | Admin only |
| A8 | My church → **Church plans** box (account.js:944) | Write, edit, delete church plans | Church admin | none | Admin only |
| A9 | My church → **Follow-up people** (account.js:932, churchPlans.js:256) | Name up to 5 follow-up people | Church admin | none | Admin only |
| A10 | My church → **Invite link** box (churchPlans.js:339) | Make or cancel invite links | Church admin | none | Admin only |
| A11 | All churches screens (account.js:1300-1345) | Approve or pause churches, audit, **Platform admins** | Platform admin | box titles only | App owner |
| A12 | Visitor → Plan → **custom plan** (customPlan.js:140-148) | Write, edit, remove a custom plan | Church admin, platform admin | none | Admin only |
| A13 | Queue → **Clear finished & removed** (queue.js:1213) | Clear history for every desk | Church admin | none | Admin only |
| A14 | Home and Visitor → **bin / Remove visitor** (visitor.js:38, 262, 334) | Remove a visitor | Church admin, team leader | none | Leader & admin |
| A15 | Team → **placement sheet** (volunteer.js:377-406) | Move, swap, release, make ★ leader | Admin (all); team leader (own station) | sheet title "Placement" only | Leader & admin; "Make ★ team leader" gets Admin only |
| A16 | Team → station card "tap to place" hint (volunteer.js:297) | Opens placement | Admin, team leader | none | Leader & admin |
| A17 | Profile → **My team** box (account.js:568-585) | Add, release, set shifts for own station | Team leader | "★ Team leader" chip | keep the chip, add Leader & admin to the box |
| A18 | Team → expo card **Manage Health Expos** (volunteer.js:1009) | Opens the Health Expos box | Church admin, platform admin | none | Admin only |
| A19 | Home banner "Tap Details, then Manage Health Expos to create one" (visitor.js:301) | Note | Church admin | none | Admin only |
| A20 | Cloud status → **Waiting for approval** box (cloud.js:545) | Approve staff (old staff list) | Admin of the old staff list | none | Admin only |

## Part B: text that tells other people about admin controls (reword to neutral)

| # | Where | Seen by | Says today | Proposed |
|---|---|---|---|---|
| B1 | Team → expo card, sample expo (volunteer.js:1008) | Non-admins | "Your church's admins create the real Health Expos; …" | "Your church's Health Expo will show here once it is announced." |
| B2 | Visitor removal refused (account.js:1865, 1883) | Staff | "Only your church's admins and team leaders can remove a visitor" | The bin is already hidden from them. Make it "This visitor can't be removed from this phone." |
| B3 | Custom plan refused (customPlan.js:173, 181) | Staff | "Only a church admin or the app owner can write a custom plan." | The button is already hidden. Make it "Custom plans are not available on this account." |
| B4 | Queue clear refused (queue.js:926) | Staff | "Only a church admin can clear the queue" | The button is already hidden. Make it "This can't be done from this account." |
| B5 | Follow-up picker, none named (churchPlans.js:286) | Staff | "A church admin can name up to 5 on the Church screen." | "No follow-up people are named yet." (Admins keep the how-to.) |
| B6 | Church plans example (churchPlans.js:24) | Staff in practice-church data | "Real plans are written by your church's admin." | "This is an example plan." |
| B7 | Members, Assistant request (account.js:959) | Assistant | "Only the Health Department Leader or the Expo admin can make someone the Assistant." | Shown to an admin about a higher post. Recommend keeping (see Part D). |
| B8 | **Help screens** (help.js:38-39, 87, 122, 166, 187, 246-263, 271, 311) | Everyone | Describe admin and leader features: custom plan, clear queue, placement board, staff approval, remove visitor | Show those help entries only to the roles that have them. |

## Part C: blocked or next-step messages (recommend keeping)

These tell someone why they can't go on, and who unblocks them. Without them a person is stuck.

| # | Where | Says |
|---|---|---|
| C1 | account.js:1571 | "This sign-in is not on the staff list yet. Ask your church admin to approve it …" |
| C2 | account.js:1568, 418, 721, 905 | "… not switched on … Ask your church admin to contact the app's support." |
| C3 | account.js:44-45, 215-218, 317 | Church waiting for or paused by the Health Expo admin |
| C4 | cloud.js:349, 394, 442, 456 | Sign-up: "an administrator approves your account …" |
| C5 | account.js:375 | "Your results appear here once a church admin links your expo badge …" |
| C6 | account.js:254, 211 | Joining a church or asking for a post: the admin approves it |

## Part D: how things work for members (needs your call)

These don't reveal a control. They explain what happens to the member. For example:
- account.js:419, 474, 532-533: "Your church's admin registers you and chooses your station."
- account.js:432: "Not placed yet — the admin chooses your station."
- account.js:441, 535: "Only your church's admin can change that now."
- account.js:585: (to a team leader) "Moving between stations is the admin's job."
- account.js:939-940, 1029-1034: admin-to-admin explanations of the two posts and stepping down.

Two options:
- **Recommended: keep them, with softer wording.** For example, "You'll be given a station before the expo."
- **Keep them as they are.**

## Not covered or not checked
- No screen was rendered for this list; the gating was read from the code.
- Database permissions (who the server allows) are unchanged and out of scope: labels are only what the screen shows.
