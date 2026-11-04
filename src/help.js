// @ts-check
import { $, esc } from './helpers.js';
import { state } from './data.js';
import { JOURNEY, toast } from './shell.js';
import { hideModal, isAdminAcct, mayPlace, showModal } from './volunteer.js';
import { cloud } from './state.js';
import { roleTag } from './ui.js';

/** @typedef {[string, string] | [string, string, string]} HelpRow  a third element names the only role that has it */

/* Help for a control only some roles have is shown only to them, with the same tag the control carries; nobody else
   reads about it. Practice mode shows everything, as everyone can do everything there. */
const isOwner = () => !!(cloud.acct && cloud.acct.platform_admin);
function helpSees(role) {
 if (!role || !cloud.user) return true;
 if (role === 'owner') return isOwner();
 if (role === 'admin') return isAdminAcct() || isOwner();
 if (role === 'lead') return mayPlace() || isOwner();
 return true;
}
const helpKey = () => ['owner', 'admin', 'lead'].map(r => helpSees(r) ? 1 : 0).join('');

/* The Help & tutorial sheet, opened from Profile. It is written from the app itself: each page, the sections on it, and
   what each control does. It is plain text, so it changes only when the app changes; update it with the app. Every
   claim was checked against the code (see the Help checks in .smoke/harness.js). */

/* The opening pages of the guide: what the app is for, a visit, the roles, practice mode and privacy (v1.6.2). */
/** @type {{title:string, what:string, sections:{name:string, role?:string, items:HelpRow[]}[]}[]} */
export const HELP_START = [
 { title: 'Start here: what this app is for',
   what: 'Health Expo Passport helps your church run a health expo. Each visitor gets a passport. Volunteers record 8 quick checks at the stations. The app turns them into a health age and a 90-day plan, sends the plan home, and gives your follow-up team a list of who to call. It does not diagnose anyone.',
   sections: [
    { name: 'Health age is not a diagnosis', items: [
      ['Health age', 'An estimate made from the expo checks, to start a conversation about healthy living. It is not a diagnosis. Anyone with a red or amber reading should be encouraged to see a clinic.'],
      ['Medicine', 'Visitors keep taking any medicine they were prescribed. Only their clinic should change it.'] ] },
    { name: 'Learn by doing', items: [
      ['Guided tour', 'Profile → Settings & help → Take the guided tour walks you through every tab with demo data.'],
      ['Help on every tab', 'The ? button in the header opens the help for the screen you are on.'] ] } ] },
 { title: 'How a visit works',
   what: 'The same six steps for every visitor.',
   sections: [
    { name: 'Steps', items: [
      ['1. Register', 'Visitor → Register a new visitor, with their consent.'],
      ['2. Check', 'Each station records its readings; the queue moves the visitor on.'],
      ['3. Results', 'Confirm the readings and see the health age.'],
      ['4. Plan', 'A 90-day plan built from the readings.'],
      ['5. Send home', 'WhatsApp, email or a printed card, then Finish visit ✓.'],
      ['6. Care', 'After the expo: call the Urgent list first, then the 48-hour follow-ups.'] ] } ] },
 { title: 'Who does what',
   what: 'Four kinds of people use the app.',
   sections: [
    { name: 'Roles', items: [
      ['Volunteer', 'Pledges on Team, then works a station. On Check, pick Your station and use Done · call next. If you are a volunteer, start on Team → Pledge.'],
      ['Team leader', 'Leads one booth. Can place helpers and remove a visitor at their own station.', 'lead'],
      ['Church admin (Health Department Leader)', 'Approves people, sets up expos, writes plans, exports data and clears the queue.', 'admin'],
      ['Staff account', 'A signed-in account. It needs a church admin’s approval before it can see the queue and church data.'] ] } ] },
 { title: 'Practice mode and live use',
   what: 'Practice mode is for learning; sign in to work a real expo.',
   sections: [
    { name: 'The difference', items: [
      ['Practice mode', 'Three made-up visitors. Nothing is sent to your church’s database and other phones cannot see it. Demo data stays on this phone until you tap Reset demo.'],
      ['Live', 'Sign in (the cloud button, or Profile). Visitors, the queue and volunteers are then shared between the desks of your church.'],
      ['Rule', 'Never enter real visitors in practice mode.'],
      ['Leaving practice mode', 'Sign in from the cloud button or Profile. Sign out returns you to the start screen.'] ] } ] },
 { title: 'Privacy: who sees visitor data',
   what: 'Visitor health information is personal (POPIA).',
   sections: [
    { name: 'Who can see it', items: [
      ['Who', 'Only your church’s admins and the staff they approve can see visitor records. Volunteers see only what their station needs.'],
      ['How long', 'Readings and prayer notes are deleted 7 days after the visit. If a visitor agreed to follow-up, only their name and contact details are kept, for up to 2 years.'],
      ['Visitor rights', 'Visitors may ask to see, correct or delete their data. Tell your church admin, who removes it from Visitor → Remove visitor. Complaints: the Information Regulator (inforegulator.org.za).'],
      ['Exports', 'A CSV export holds personal health data. Keep it private and delete it when you are done.'] ] } ] },
 { title: 'If a reading is red',
   what: 'Red means a reading is in the danger range (blood pressure 160/100 or more, or blood sugar 15 or more, or blood sugar under 3). Stay calm and kind; the app does not diagnose.', /* (A12) */
   sections: [
    { name: 'What to do', items: [
      ['1. Tell the counselling desk', 'Let the counselling or health lead at the expo know now, so a trained person can talk with the visitor.'],
      ['2. Advise a clinic visit', 'Encourage the visitor to see a clinic or doctor soon, ideally within 24 hours. The Care → Urgent list reminds the team to call.'],
      ['3. Emergency signs', 'If the visitor has chest pain, signs of a stroke, fainting or a very low sugar, call for emergency help straight away.'],
      ['Emergency numbers', '[PLACEHOLDER — church health lead to confirm before the expo] Ambulance 10177 · Emergency from a cellphone 112'],
      ['Wording', 'This guidance must be approved by your church’s health lead before a live expo.'] ] } ] },
 { title: 'Getting help and support',
   what: 'Who to ask when something does not work.',
   sections: [
    { name: 'Contacts', items: [
      ['First', 'Your church admin (Health Department Leader).'],
      ['App support', '[PLACEHOLDER — church admin to fill in] Support contact: name and WhatsApp number.'],
      ['Common messages', 'See “Messages you may see” further down this guide.'] ] } ] }
];

/* [label, what it does] pairs inside a section */
/** @type {{title:string, tab:string, role?:string, what:string, sections:{name:string, role?:string, items:HelpRow[]}[]}[]} */
export const HELP_PAGES = [
 { title: 'Home', tab: 'home',
   what: 'The start screen. It shows who is being screened right now, today’s visitors and how far the expo has got.',
   sections: [
    { name: 'Now serving', items: [
      ['Visitor card', 'The visitor whose checks are open: badge, name, age and sex, with the four steps Check, Results, Plan and Send.'],
      ['Continue: Check', 'Opens that visitor’s check screen, where the readings are taken.'],
      ['Blood pressure, Blood sugar, Body BMI', 'The three headline readings. A dash means not measured yet.'] ] },
    { name: 'Visitors today', items: [
      ['Visitor rows', 'Everyone registered today, with how many of the 8 checks are done and which step they are on. Tap a row to open their passport; the line under the heading says “the bin removes them” where you may remove visitors.'],
      ['Remove (the bin at the right of a row)', 'Deletes that visitor, after asking “Remove NAME?”. Signed in, only church admins and team leaders see it; in practice mode anyone does. It is the same as Remove visitor on the passport: it deletes their passport and readings for every desk and takes them out of every queue line, and it cannot be undone from the app.', 'lead'] ] },
    { name: 'Screening Spectrum', items: [
      ['Emergency — attend quickly', 'A red reading, such as blood pressure 160/100 or more, blood sugar 15 or more, or blood sugar under 3.'],
      ['Watch — elevated', 'Something is raised, but no reading is in the red range.'],
      ['Optimal — healthy', 'Blood pressure, blood sugar and BMI are all normal.'],
      ['Count line', 'How many visitors are screened (their blood pressure, blood sugar and BMI are in), and how many are still in checks.'] ] },
    { name: 'Expo and volunteers', items: [
      ['Expo banner', 'The expo’s name, and how many helpers are confirmed out of the number needed.'],
      ['Pledge & Booth Registration', 'Tapping the banner opens the volunteer sheet, to pledge to help, pick a booth or add a new volunteer. The note counts pledged helpers still waiting for registration.'] ] },
    { name: 'Status, sync and theme', items: [
      ['Status line', 'Whether this device’s data is saved to the shared database, for example “Up to date with the shared database”.'],
      ['Sync', 'Opens the sync panel, where Sync now sends and fetches changes.'],
      ['Sign out', 'Clears the visitor and volunteer data on this device, after asking you to confirm. Changes not yet uploaded are lost, and you are warned first. Data already on the server is kept.'],
      ['Light / dark button', 'Switches between light and dark mode.'],
      ['Reset demo', 'Practice mode only (not signed in): starts the practice data again.'] ] } ] },

 { title: 'Visitor', tab: 'visit',
   what: 'Where visitors are registered and taken through the four steps: Check, Results, Plan and Send home.',
   sections: [
    { name: 'Register a new visitor', items: [
      ['Full name', 'Required.'],
      ['Age', 'Required, from 12 to 105. For someone under 18, a box for the parent or guardian’s name and their consent appears, and both are required.'],
      ['Sex', 'Male or Female, one tap. Required.'],
      ['WhatsApp (optional)', 'If given, it must look like a South African number. Used to send the plan on WhatsApp.'],
      ['Height (cm, optional)', 'From 100 to 220 cm if given. Needed for the BMI and the health age.'],
      ['Email (optional)', 'If given, it must look like an email address. Used to send the plan by email.'],
      ['Visitor number', 'Given automatically. It is the badge number on their lanyard.'],
      ['Duplicate check', 'If the name, the last nine phone digits or the email match someone already registered, registration stops. You can open their existing record, or register a new passport anyway.'],
      ['Register & start the checks', 'Saves the visitor. When the live queue is on, they join the Blood Pressure line straight away (the first check).'] ] },
    { name: 'Consent (POPIA)', items: [
      ['Yes, they consent', 'Required. Without it no check can be recorded. The date is kept with the record.'],
      ['May we contact you afterwards?', 'Optional, and separate from the screening consent. Answer it with the visitor.'] ] },
    { name: 'Visitor header', items: [
      ['Change', 'Opens the switcher to pick a different visitor.'],
      ['Where they stand in the queue', 'A small note under the name, for example “In line at Blood Pressure · 2 of 5” or “Being served at Blood Pressure”. It lists every line they are in, and it is empty when they are in no line or the queue cannot be read (no connection). It updates by itself as the lines move.'],
      ['Remove visitor', 'Under the visitor’s name bar, on every step. It asks “Remove NAME?” first. Remove deletes their passport and readings for every desk in your church and takes them out of every queue line. It cannot be undone from the app. Signed in, only church admins and team leaders see it; a leader can remove only a visitor who is waiting or being served at their own station. It needs a connection when the visitor is already on the shared database. In practice mode, anyone can remove, and it only affects this device.', 'lead'] ] },
    { name: 'Finding a visitor', items: [
      ['Where the lists are', 'Change (at the top of the visitor screens) opens a list of visitors, and Home has Visitors today. Tap a name to open that visitor where they left off.'],
      ['The latest 25', 'With more than 25 visitors, each list shows only the latest 25 (and the visitor who is open), with a search box above it. On Home a note says, for example, “Latest 25 of 140 — search to find anyone else.”'],
      ['Search', 'By name, badge number or phone. In the Change list, no match says “Nobody matches that.” On Home it says “Nobody matches …” and a Clear search button brings the list back.'] ] },
    { name: 'Journey bar', items: [
      ['Check, Results, Plan, Send home', 'The four steps. Tap a step, or Next, to move on. “←” goes back one step. Moving from Check to Results asks you to confirm the readings, once per visit: the answer is kept, also after the app reloads or syncs.'],
      ['Finish visit ✓', 'The button on the last step. It marks the visit complete and returns to Home, saying the visitor’s visit is complete and you are ready for the next. Afterwards it reads “Visit complete ✓ · Home”. It also takes the visitor out of every queue line they are still in, and the message says which, for example “taken out of the Blood Pressure line”. The visit is saved first: with no connection it still finishes, the message says the lines could not be updated, and they are left as soon as the queue can change again.'],
      ['The passport and the queue work together', 'Registering puts the visitor in the Blood Pressure line, the first check; the lines then follow the order of the checks. Finish visit ✓ takes them out of every line. On the Check screen, the footer has Start and Done for your station (see Queue). If you type a reading while they are still waiting in that station’s line, the app asks “Start Blood Pressure for …?”: Yes starts serving them there, No keeps them waiting. It asks once per visitor and station, and never starts on its own. Opening Results, Plan or Send home marks any check station still serving them as done and moves them on.'] ] },
    { name: 'A returning visitor', items: [
      ['Past visit', 'A visitor opened by an old number whose visit was more than 7 days ago has had their readings deleted, so the passport takes no new checks. “Register as a new visit” starts a new passport on a new badge, with their details filled in and consent asked again.'] ] },
    { name: 'Check: station screening', items: [
['One check at a time', 'The Check step opens on one check at a time: a big question (for example What is the blood sugar?), the unit (mmHg, mmol/L, kg, cm), the app’s healthy range, and a large number box with − and +. Check 3 of 8 and the bar show where you are. Next → (or Enter) goes on, ← Back goes back and keeps the answers, Not done · skip leaves a check empty. After check 8 a summary lists all 8: tap one to change it. Readings save as you type, exactly as on the full screen.'],
      ['Show all 8 checks', 'Shows all 8 checks, the rest of the paper record and the survey on one screen, as before. One at a time → at the top goes back. The choice is kept until the app is closed.'],
      ['Your station', 'The station this desk takes, saved on this device. A station volunteer’s footer offers Results and Next in line, and above them the Start and Done row for the queue line of that station (see Queue). Weight and Waist belong to the Vitals & BMI line, Blood pressure to Blood Pressure, Blood sugar and Cholesterol together to Sugar & Chol., and Fruit & Veg, Exercise, Water and Sleep each to a line of their own. Only the paper-record extras (Body fat, Body water, Lung function and Fitness) have no line, so no row, and their footer button reads Next visitor and opens the registration form.'],
      ['Next in line', 'In a station volunteer’s footer. It calls whoever has waited longest at your line and opens their passport; being called is being started. With nobody waiting, or with no connection, it opens the registration form instead, so a desk can always add a visitor.'],
      ['Blood pressure', 'Top and bottom numbers, and whether they take BP medication.'],
      ['Blood sugar, Cholesterol', 'Values in mmol/L.'],
      ['Weight', 'Kilograms. With the height, the BMI is worked out.'],
      ['Fruit & Veg, Exercise, Water, Sleep', 'Servings a day, minutes of brisk exercise a day, glasses of water a day, hours of sleep a night.'],
      ['− and +, or type', 'Change a value. A chip turns amber or red when a value needs attention.'],
      ['Warnings under a field', 'A red note says when a value looks wrong or impossible, for example “The bottom number should be lower than the top one. Check both readings.” Where the app can suggest a value, the note has a “Use …” button that applies it.'] ] },
    { name: 'Check: Personal Health Record', items: [
      ['Medical history', 'Major operations and chronic illnesses. A list appears when chronic illness is Yes.'],
      ['Waist, Body fat (BIA), Body water (TBW), Lung function (PEF)', 'The rest of the paper record. Not part of the 8 checks.'],
      ['Fitness', 'Pulse at rest, after exercise, and after 3 minutes of recovery.'] ] },
    { name: 'Check: health age survey', items: [
      ['Exercise, breakfast, snacking, smoking, alcohol', 'Five questions. The answers are saved with the record. They do not change the health age.'] ] },
    { name: 'Check: follow-up', items: [
      ['Follow-up call', 'Ticked, it puts them on the 48-hour follow-up calls list in Care.'],
      ['Cooking school, Stress & peace, R25 pouch', 'Ticked, they put the visitor on the Seminar & co-op interests list in Care.'],
      ['May the church contact them after the expo?', 'Yes or No.'],
      ['Seminars they agreed to', 'Shown from the notice they agreed to.'],
      ['How did they hear about the expo?', 'Social media, Newspaper, Flyer, Word of mouth, Other.'],
      ['Prayer request (optional)', 'Saved with the record and noted under Follow-up for the team. It is in the CSV export as Prayer note.'] ] },
    { name: 'Results (step 2)', items: [
      ['Health age', 'The age their readings point to, next to their actual age. It shows only when all 8 checks and a height are in; until then it says what is missing.'],
      ['90-day goal', 'The age they could reach in 90 days with the plan, and the years that would be won. Shown after all 8 checks.'],
      ['What to work on', 'The readings that most need attention.'],
      ['What adds the most years', 'The readings that add the most years to the health age.'],
      ['Show the 90-day win (counselling tool)', 'Sliders for the three commitments, to show how the numbers would respond.'] ] },
    { name: 'Plan (step 3)', items: [
      ['Plan · 90 days', 'A 90-day plan built from the readings. “When these feel easy, add” suggests the next steps.'],
      ['Food plan', 'Opens from the plan: the food behind it.'],
      ['Custom plan', 'Write a plan for this visitor, or start from the plan they were shown. You can also import a plan file (JSON) and download a blank template. Remove custom plan returns them to the generated plan.', 'admin'] ] },
    { name: 'Send home (step 4)', items: [
      ['Send the plan on WhatsApp', 'Shows a preview, then sends it to their number. If no number is saved, you pick their contact.'],
      ['Email the plan', 'Shows a preview, then opens your email app with it. If no email is saved, you type one first. The email is sent from that app, not from here.'],
      ['Print the take-home card', 'An A6 card with their numbers and three actions.'],
      ['Finish visit', 'In the WhatsApp preview, Finish visit marks the visit complete, takes the visitor out of their queue lines and returns to Home, without sending.'],
      ['Reserve the R25 co-op starter pouch', 'Always listed. Reserves bulk staples for 21 days, ready at the exit table. Once reserved, the button reads “Co-op starter pouch reserved”.'],
      ['Follow-up for the team', 'A summary of what they asked for, a Change link back to Check, and the follow-up tick boxes.'] ] } ] },

 { title: 'Queue', tab: 'queue',
   what: 'The live line at each station. Every desk sees the same line, updated as people are called, finished or removed.',
   sections: [
    { name: 'Status line', items: [
      ['Live — every desk sees this same line', 'Connected. Changes appear on every desk as they happen.'],
      ['Reconnecting…', 'The connection dropped. Numbers may be a few seconds behind.'],
      ['Offline — the line is paused', 'No connection. Queue changes are refused until you reconnect.'],
      ['Practice mode', 'Signed out. The queue runs on this device only. Nothing is sent to the shared database; the demo data stays on this phone until you tap Reset demo.'] ] },
    { name: 'Totals', items: [
      ['Waiting, Being served', 'Counts across all stations.'],
      ['Finished', 'Visits finished in the last 18 hours, the period the queue loads.'],
      ['Longest wait', 'The longest anyone has waited, across all stations.'],
      ['Clear finished & removed · N', 'Appears when there are finished or removed entries. It asks first, then deletes them for every desk, including older ones this screen no longer loads. People still waiting or being served stay, but the Finished count and the average time per person start again from estimates. This phone keeps only the latest 150 finished or removed queue entries; older ones drop off on their own. That limit is only for the queue list: visitor records and care notes are kept for their own POPIA retention period.', 'admin'] ] },
    { name: 'The queue and the passport', items: [
      ['Registering', 'A newly registered visitor joins the Blood Pressure line straight away (the first check), when the queue can take changes.'],
      ['The Start and Done row', 'On the Check screen, in the footer above the buttons. A volunteer who works one station sees one row for that station; a volunteer doing every check sees a row for each line the visitor is in. It is not shown on the other steps, or for the paper-record extras, which have no line.'],
      ['Start at Blood Pressure', 'The visitor is now with you. If they are waiting in that line they are called now, even ahead of others; if they are not in the line yet (a walk-up) they are added and started. The row then reads “Being served at Blood Pressure”.'],
      ['Done at Blood Pressure ✓', 'Marks that line done and puts the visitor in their next line, with one message. Lines whose readings are already in (for example typed on the one-at-a-time screen) are skipped and named in the message; turn this off on the Queue tab with Skip lines whose readings are in. It does not call anyone. When all of the station’s readings are in, the button lights up and the row says “readings in ✓”; nothing finishes by itself. The readings are: Vitals & BMI, weight and height (so the BMI can be worked out); Blood Pressure, the top and bottom numbers; Sugar & Chol., blood sugar and cholesterol; Fruit & Veg, the servings of fruit and veg; Exercise, the minutes of exercise; Water, the glasses of water; Sleep, the hours of sleep.'],
      ['The question and Undo', 'If readings for that station are missing, Done asks “Done at Blood Pressure?” and names what is missing; Done anyway goes on, Keep going stays. When nothing is missing it just finishes. Either way a message with Undo stays for 6 seconds: Undo puts the visitor back with you, takes back the “confirmed” mark if Done anyway made one, and leaves the line they were put in, unless someone has already called them there.'],
      ['Checks not filled in', 'On the Start and Done row, and for the person with you in the queue panel, each line says what state its checks are in: “readings in ✓”; “not filled in: top number, bottom number” (nothing in, or only some); or “not filled in · confirmed”. Confirmed means a volunteer accepted the gap on the Check page: by choosing Done anyway at that line, or by confirming the results (Next: Results, Yes, that is right), which confirms every check still empty as skipped. The mark is kept on the passport, so every desk sees the same state, and filling the check in later turns it back into “readings in ✓”. Answering Edit to the results question marks nothing.'],
      ['In the queue panel', 'Someone waiting shows nothing about empty checks, because that is normal; a waiting person whose checks are all in shows “readings in ✓”. The note at the bottom counts how many finished here with checks not filled in, and how many of those were confirmed.'],
      ['Cancel, for an abrupt stop', 'On the row of the person being served. It asks “Stop at Blood Pressure?” with three choices. Put back in line: they will be back, same place, readings kept. They left: out of every line they are in; the visit is not marked complete, and Undo stays for 6 seconds. Keep going: nothing changes. On the Queue screen, ↩ Put back and ✕ Remove do the same for one line.'],
      ['Undo for Start', 'Starting someone also offers Undo for 6 seconds: back in line (same place), or out of the line again if they were a walk-up.'],
      ['Done earlier', 'After a finish the row says “Done at Blood Pressure ✓”, with Start again.'],
      ['No connection', 'The buttons, including Cancel, are greyed out. Starting, finishing and cancelling need the connection so that every desk sees the same line.'],
      ['Finish visit', 'Takes the visitor out of every line they are in. With no connection the visit still finishes, and the lines are left as soon as the queue can change again, in the same church.'],
      ['Open passport', 'On the person with you: opens their passport. The passport’s header shows their place in line.'],
      ['Results and Send home', 'Confirming the results and sending the plan do not change the queue.'],
      ['Remove visitor', 'Takes them out of every line, and deletes the visitor.', 'lead'],
      ['Still needs a tap', 'Calling the next person, finishing Counselling, Kitchen Pharmacy or Prayer from the Queue screen, and ↩ Put back.'] ] },
    { name: 'Station cards', items: [
      ['Ten lines', 'Vitals & BMI, Blood Pressure, Sugar & Chol., Fruit & Veg, Exercise, Water, Sleep, Kitchen Pharmacy, Counselling and Prayer. Each of the 8 health-age checks has its own line (Sugar & Chol. covers blood sugar and cholesterol together); Kitchen Pharmacy, Counselling and Prayer are the others. These are the app’s own lines until your church’s admins set their own (see Stations · order & lines below).'],
      ['The route', 'Blood Pressure → Sugar & Chol. → Vitals & BMI → Fruit & Veg → Exercise → Water → Sleep → Counselling. Done at a line puts the visitor in the next one they have not finished or whose readings are not in yet. Kitchen Pharmacy and Prayer are not on it: add people to them by hand. When the church sets its own order, the route follows that order instead.'],
      ['Stations · order & lines', 'A button for church admins and the app owner, under the totals. It changes which lines are on the board and their order — for every desk and the big screen — and the route visitors walk after Done follows the same order; a newly registered visitor starts at the first line of it. − Off takes a line off the board (anyone still in it is taken out of the line), + On puts it back, ↑ ↓ move a line, Usual order returns to the app’s ten lines. Needs a connection, and the latest database update (schema.sql).', 'admin'],
      ['Card contents', 'The checks done at that line, how many are waiting, who is being served (by badge number), whether anyone has been called yet, and how long the longest waiter has waited. Once 3 visits have finished there, it also gives the estimated wait. Tap a card to open its panel.'],
      ['Which checks belong to which line', 'Vitals & BMI: Weight · Height · Waist. Blood Pressure: Blood pressure. Sugar & Chol.: Blood sugar · Cholesterol. Fruit & Veg: Fruit & Veg. Exercise: Exercise. Water: Water. Sleep: Sleep. Kitchen Pharmacy and Prayer have no checks and are optional stops; Counselling has none and is the 90-day plan. The same is written under the line’s name on each card, as “Checks: …” in the panel, and on each tile of the big screen. A line named after its one check says what is recorded instead of repeating its name: Top and bottom number, Servings a day, Minutes of brisk exercise a day, Glasses a day, Hours a night. The Check screen’s “Your station” chips follow the same grouping.'],
      ['Colour', 'A card turns amber when someone has waited 10 minutes or more, or people wait and nobody is being served. It turns red at 20 minutes.'] ] },
    { name: 'Station panel', items: [
      ['With you now', 'The people you are helping. Open passport opens that visitor’s passport. The big button under each one is your whole turn: Done · call next → finishes them, sends them to their next station and calls the person who has waited longest here. When nobody else is waiting it reads Done ✓. Underneath, ↩ Put back returns them to the line and ✕ Remove, then Remove?, takes them out.'],
      ['Call next →', 'Shown when a place is free. Calls the person who has waited longest at this station into the free place.'],
      ['People served at once', 'Set with − and + above With you now (or Profile → Settings & help → Queue: people served at once). 1 is the usual one-at-a-time station. With 2 or more, for example 3 blood-pressure nurses or 2 prayer partners, each place gets its own card with the person, their place, the time they started and how long they have been with you; a free place shows Call next → Place 2. Done on one card frees only that place. ⇄ moves a person to the next place (swapping if it is taken). Name places gives each place a label such as Nurse A or Room 2. The setting is kept on this phone.'],
      ['Serving 2 of 3', 'How many places are in use. If you Call someone from Next up while every place is busy they show as Extra and take the first place that frees up.'],
      ['+ Add visitor', 'Adds someone from the visitor list to this station.'],
      ['Next up', 'The line in order. Call serves that person now (for a second desk); ✕ removes them.'],
      ['Average time', 'Shown once 3 visits have finished at that line, never before: the average minutes per person, from the last 15 finished. Until then the note says “No average yet” and the app promises no time, because it does not guess.'] ] },
    { name: 'Big screen', items: [
      ['Big screen', 'A full-screen board for a TV. For each station: who is being served and the next four waiting, by badge number. A station with more than one place lists each place (Place 1, Nurse A…) with its badge or free, and Now serving · 2 of 3. ✕ or Escape closes it.'] ] } ] },

 { title: 'Care', tab: 'care',
   what: 'Ministry follow-up: the lists the team works from after the screenings.',
   sections: [
    { name: 'Lists', items: [
      ['Urgent', 'Visitors in the danger range: blood pressure 160/100 or more, blood sugar 15 or more, or blood sugar under 3. The red number on Care counts the ones nobody has attended to yet.'],
      ['Called / attended to ✓', 'Once someone has phoned the visitor or sent them to a clinic, tap it on their card. They stay on the list, greyed, with who marked it and when, and drop out of the red number. Undo takes the mark back. A new danger reading for the same visitor counts again.'],
      ['48-hour follow-up calls', 'Visitors who asked for a follow-up call.'],
      ['Seminar & co-op interests', 'Visitors who asked for Cooking school, Stress & peace or the R25 pouch.'],
      ['Sorted automatically', 'The lists fill in as visitors are registered and checked. Nothing is written on paper cards.'] ] },
    { name: 'Export CSV', items: [
      ['Export CSV', 'Downloads a spreadsheet file of every visitor: names, phone, email, readings, health age, flags, follow-up choices, consent and guardian details. It holds personal details, so keep the file private.'] ] } ] },

 { title: 'Team', tab: 'serve',
   what: 'Volunteers: who has pledged, who is standing where, booth coverage, and each helper’s expo history.',
   sections: [
    { name: 'Tabs', items: [
      ['Pledge', 'The upcoming expo, whether pledges or registration are open, and the form to pledge to help.'],
      ['Muster', 'Who is standing where: the team totals and the booth coverage.'],
      ['Booth', 'A helper’s booth assignment, and the booths they asked for.'],
      ['Record', 'A helper’s expo history, with Log an expo.'] ] },
    { name: 'Switch', items: [
      ['Switch', 'Chooses whose view this device shows, and switches between Visitors and Volunteers.'] ] },
    { name: 'Team for this expo', items: [
      ['Confirmed of needed', 'Helpers confirmed out of the number needed.'],
      ['Pledged, Registered, Booths short', 'How many have pledged, how many are registered, and how many booths still need people.'],
      ['Export volunteer roster CSV', 'Downloads a spreadsheet file of the roster: ID, name, phone, email, status, team leader, badge, expos served, hours, booth, shift, availability, skills, shirt size, emergency contact, notes and expo history.'] ] },
    { name: 'Booth coverage', items: [
      ['Each booth', 'How many helpers it needs, who leads it, and who is in it. “No leader yet” means nobody leads it.'] ] },
    { name: 'Pledged — registration pending', items: [
      ['Tap a name', 'Registers that pledged helper.'] ] },
    { name: 'Add a volunteer', items: [
      ['Started from', 'The Pledge & Booth Registration banner on Home, which opens the volunteer sheet.'],
      ['Details', 'Name, phone, email, shirt size, emergency contact and notes.'],
      ['Booths', 'The first and backup booth they would like.'],
      ['Availability and skills', 'Where the form asks for them.'] ] },
    { name: 'Record: Log an expo', items: [
      ['Log an expo', 'Adds a past expo for a helper: name, date, booth worked and hours. Remove deletes an entry.'] ] },
    { name: 'Placement board', role: 'lead', items: [
      ['Opening it', 'With placement mode on, tap a volunteer in the Team list to open the placement board.'],
      ['Move, Swap, Release', 'Move a helper to another booth, swap two helpers, or release a helper from a booth.'],
      ['Lead', 'Makes you the leader of a booth.', 'admin'],
      ['Deregister', 'Takes a registered or checked-in volunteer off the expo: their station, shift and check-in are cleared and their pledge stays on the team list. It asks first, and warns when they are already checked in.', 'admin'],
      ['Remove pledge', 'Takes the pledge back for good: the volunteer comes off the team list. They can pledge again later.', 'admin'],
      ['Block', 'Shown when the volunteer pledged from an account. Blocks that account from your church (see My church → Blocked).', 'admin'] ] },
    { name: 'A team leader’s team', role: 'lead', items: [
      ['Add, release, shift', 'A leader can add a helper to their team, release one, and set their shift.'] ] } ] },

 { title: 'Profile', tab: 'me',
   what: 'Your account, your details, the expos you are committed to, the sync status and the settings.',
   sections: [
    { name: 'Who you are', items: [
      ['Name, email and roles', 'Your roles (for example Health Department Leader) and your church.'],
      ['My church', 'Members, invitations, expos, church plans and follow-up people.', 'admin'],
      ['All churches', 'Every church.', 'owner'] ] },
    { name: 'Sync', items: [
      ['Status', 'For example “Up to date · synced just now”.'],
      ['Visitors, Volunteers, To upload', 'Counts held on this device. To upload is what is still waiting to be sent.'],
      ['Sync now', 'Sends what is waiting and fetches the latest changes.'],
      ['Details', 'Opens the full sync status.'] ] },
    { name: 'The three sections', items: [
      ['The bar under Sync', 'Three buttons: Pledge (Pledge & registration), My details (My details & results) and Account (Account & security). One section shows at a time, and the app remembers the one you used last on this device. Someone who is not in a church sees only the account part, with no bar.'],
      ['Pledge & registration', 'Everything about helping at an expo: where you stand, your pledge, Unpledge and Deregister, the open expos, and your team if you lead a station.'],
      ['My details & results', 'Your details form and your screening results.'],
      ['Account & security', 'Password, installing the app, Help & tutorial, the guided tour, Sign out and Delete my account. In practice mode, Settings & help at the top of Profile has Help & tutorial and the guided tour.'] ] },
    { name: 'Pledge & registration', items: [
      ['What you can do now', 'A line at the top says where you stand: not committed yet; pledged (you can edit or unpledge); registered (you can edit or deregister); or checked in (it can’t be changed here).'],
      ['My pledge', 'Your status, your name, the station and shift you were given, which expo, how many expos you pledged to out of the programme, when you pledged and, once registered, when you were registered.'],
      ['Edit my pledge', 'Changes what you pledged.'],
      ['Unpledge', 'Only while you are pledged and not yet registered. It asks “Unpledge from the expo?”, then your name comes off the team list and your pledge is removed. You can pledge again at any time.'],
      ['Deregister', 'Only once you are registered. It asks “Deregister from the expo?”, then takes you off the expo plan and releases your station; a station leader hands the station back. Your pledge stays on the team list, so you can be registered again later, and the app says “Deregistered — your pledge still stands”.'],
      ['Checked in', 'There is no button: once you are checked in for an expo, it is changed for you if needed.'],
      ['Health expos', 'The open expos, each with “Pledge to help at this expo”.'],
      ['My team', 'Add people who asked for your station, take your own people off it and set their shifts.', 'lead'] ] },
    { name: 'My details & results', items: [
      ['Full name, phone, area, date of birth', 'Only you and your church’s admins see these. Save my details keeps them.'],
      ['My screening results', 'Appear once a church admin links your expo badge to this account.'] ] },
    { name: 'Account & security', items: [
      ['Change password', 'At least 8 characters, with a letter and a number.'],
      ['Help & tutorial', 'Opens this guide. It is also on the ? button in the header of every tab, in practice mode too.'],
      ['Take the guided tour', 'Starts the interactive tour of the whole app with demo data. You can leave it at any time and pick it up again here.'],
      ['Sign out', 'Asks you to confirm, then clears the visitor and volunteer data on this device. Changes not yet uploaded are lost, and you are warned first.'],
      ['Delete my account', 'Deletes your login and your details (name, phone, area, pledge and the position you asked for). Visitor and volunteer records stay with your church. Type DELETE to confirm.'] ] },
    { name: 'Notifications (the bell)', items: [
      ['Bell', 'In the header, when signed in (practice mode has no notifications). Shows new notifications for your account, such as a change to the roster. Open it to read them, and mark them read.'] ] } ] },

 { title: 'My church', tab: 'me', role: 'admin',
   what: 'Reached from Profile → My church. The places where a church is run.',
   sections: [
    { name: 'Members', items: [
      ['Approve', 'Lets someone who asked to join the church in.'],
      ['Role', 'Sets a member’s role: Member, Volunteer, Team member, Team leader, Assistant Health Department Leader, or Health Department Leader (the admin).'],
      ['Link', 'Ties a member to a volunteer record or a visitor badge.'],
      ['Remove, Step down, Leave', 'Removes a member, steps you down as admin, or leaves the church.'],
      ['Block', 'Removes the member and their pledge, and stops the account asking to join your church again. The Health Department Leader blocks admins.'],
      ['Block from app', 'The app owner only: the account loses every church and cannot join or register one.', 'owner'],
      ['Blocked', 'The accounts blocked from your church, with Unblock. Every block and unblock is kept in the change log.'] ] },
    { name: 'Staff approval', items: [
      ['Approve staff', 'Lets a staff account see the queue and the church’s data.'] ] },
    { name: 'Invitations', items: [
      ['Make an invite', 'Creates an invite link for a chosen role. Copy or share it. Cancel all invite links ends them.'] ] },
    { name: 'Expos', items: [
      ['New expo, Edit', 'Creates or changes an expo: its name, dates, times, venue, deadline, volunteers needed, stations and clinic.'],
      ['Status', 'Sets the expo’s status.'],
      ['Delete', 'Deletes an expo.'],
      ['Manage', 'Opens the church screen for admins, or the admin screen for other members.'] ] },
    { name: 'Church plans and follow-up people', items: [
      ['Church plans', 'Write, edit or delete the church’s plans. Each visitor’s plan can be set to follow one of them.'],
      ['Follow-up people', 'The members who receive the follow-up lists.'] ] },
    { name: 'All churches', role: 'owner', items: [
      ['Search and status', 'Finds a church and changes its status.'] ] } ] }
];

/** @type {{title:string, steps:(string|[string,string])[]}[]} */
export const HELP_TUTORIALS = [
 { title: 'Your first time', steps: [
    'Sign in with your email. If you are new, sign up, then wait for a church admin to approve you.',
    'Check the status line on Home. “Up to date” means your data is saved.',
    'Ask an admin to set up the expo (Profile → My church → Expos) and invite your staff.' ] },
 { title: 'Register a visitor and take their checks', steps: [
    'Visitor → Register a new visitor. Fill in Full name, Age (12 to 105) and Sex.',
    'Add WhatsApp, height and email if you have them. Height is needed for the BMI and the health age.',
    'Tick “Yes, they consent”, then tap Register & start the checks.',
    'On Check, answer the 8 checks one at a time (Next → or Enter), or tap Show all 8 checks to see them on one screen. Fill in the paper record and the survey where you can.',
    'Tap Next: Results, then Plan, then Send home.',
    'Tap Finish visit ✓. The visitor leaves any queue line they are still in.' ] },
 { title: 'Run the queue at the expo', steps: [
    'Open Queue and check the status line says Live.',
    'Tap a station card, then Call next to bring the first person up. Or open a visitor’s passport and tap Start at your station.',
    'If several volunteers serve at one station (blood pressure with 3 nurses, 2 prayer partners), set People served at once with + so each gets a place and Call next fills the next free place.',
    'When they finish, tap the big Done · call next → button. They move to the next station on their route and the next person in your line is called. On their passport (Open passport) the footer has Done at your station instead, which also moves them on without calling anyone.',
    'If someone steps out, ↩ Put back returns them to the line. ✕ Remove and then Remove? takes them out.',
    ['Tap Clear finished & removed at the top of Queue, at the end of the day or after practice, to empty the history.', 'admin'],
    'For Kitchen Pharmacy or Prayer, use + Add visitor.',
    'Use Big screen on a TV to show the lines to the room.' ] },
 { title: 'Remove a visitor', steps: [
    'Visitor → open the visitor (Change, or tap them in Visitors today).',
    'Tap Remove visitor under their name bar.',
    'Read the question, then tap Remove. Tap Cancel to keep them.',
    'The visitor disappears from every desk and from every queue line.' ] },
 { title: 'A visitor stops part-way', steps: [
    'Open their passport (Open passport on the Queue screen) and find the Start and Done row for your station.',
    'Tap Cancel. Choose Put back in line if they will come back, or They left if they have gone.',
    'Put back keeps their place and readings. They left takes them out of every line; use Undo within 6 seconds if you tapped it by mistake.',
    'If you only started them by mistake, tap Undo on the message that appears.' ] },
 { title: 'Send a visitor’s plan home', steps: [
    'Visitor → Send home.',
    'Preview the WhatsApp or email message, then send it. Or print the take-home card.' ] },
 { title: 'Deregister, or unpledge', steps: [
    'Profile → Pledge & registration.',
    'Read “What you can do now” at the top.',
    'Pledged, not yet registered: tap Unpledge and confirm. Your name leaves the team list and you can pledge again at any time.',
    'Registered: tap Deregister and confirm. You come off the expo plan and your station is released; your pledge stays, so you can be registered again.',
    'Checked in: there is no button for it; it is changed for you if needed.' ] },
 { title: 'Register a volunteer and place them', steps: [
    'Home → tap the Pledge & Booth Registration banner. Start a new volunteer and fill in the details, booth choices and availability.',
    'In Team → Muster, tap a name under “Pledged — registration pending” to register them.',
    ['Use the placement board to fill booths.', 'lead'] ] },
 { title: 'After the expo', steps: [
    'Care: review Urgent, 48-hour follow-up calls and Seminar & co-op interests.',
    'Care → Export CSV for the records. Keep the file private.',
    'Team → Record → Log an expo for any helper hours to add.' ] }
];

/** topics that cut across the pages; each has the same shape as a page */
/** @type {{title:string, what:string, sections:{name:string, role?:string, items:HelpRow[]}[]}[]} */
export const HELP_TOPICS = [
 { title: 'Working offline and keeping in sync',
   what: 'What the app does when the connection drops, and how the desks stay in step.',
   sections: [
    { name: 'Offline first', items: [
      ['Visitors and volunteers', 'They are saved on this device first and uploaded when there is a connection. With none, you can keep registering and recording; the status line says “Offline — changes are kept on this device and upload when you reconnect.”'],
      ['The queue is the exception', 'It needs a connection, so that every desk sees the same line. Without one, queue changes are refused. Registering a visitor still works; add them to the line by hand when you are back online.'],
      ['To upload', 'On Profile → Sync, the number of changes still waiting to go up.'] ] },
    { name: 'The status line', items: [
      ['Up to date', 'Everything on this device is saved to the shared database. The dot is green.'],
      ['Connecting… / Syncing…', 'Working on it. The dot is amber, and while uploading it says which row of how many.'],
      ['Offline — changes are kept on this device…', 'No connection. The dot is amber.'],
      ['Sync problem', 'The last sync failed. The dot is red; open the sync sheet (the cloud button in the header) for details, or tap Sync now.'],
      ['Not signed in', 'Practice mode. The dot is grey.'],
      ['Cloud sync could not load (no internet?)', 'The sync code could not be fetched. This device keeps working on its own.'] ] },
    { name: 'How the desks stay in step', items: [
      ['Straight after a change', 'When you are online, a saved change is uploaded about a second later.'],
      ['Live updates', 'Changes made on other desks appear as they happen. After the app has been out of sight for 2 minutes, live updates pause; they reconnect when you come back, and the app fetches what changed meanwhile.'],
      ['If live updates are not working', 'The app asks for changes every 20 seconds. When they are working, it still checks about once a minute while the app is open.'],
      ['The full check', 'On sign-in, on Sync now, and every 10 minutes, the app also checks for visitors and volunteers that were removed on other desks.'],
      ['Coming back to the app', 'Returning to the app starts a sync, at most once every 15 seconds.'] ] } ] },

 { title: 'Updates and installing the app',
   what: 'How a new version reaches the phone, and how to put the app on the home screen.',
   sections: [
    { name: 'A new version', items: [
      ['The update bar', 'When a new version is ready, a bar appears at the top: “A new version is ready · Tap Update — it takes a few seconds.” Update reloads the app on the new version.'],
      ['× (Not now)', 'Hides the bar until the next version. It does not ask again for the same one.'],
      ['The Android app', 'It says “A new app version is ready · Tap Update to download and install it.” Update opens the download in the phone’s own browser, which hands the file to the phone’s installer.'],
      ['Offline', 'With no connection the app looks for no update and stays quiet.'] ] },
    { name: 'Install on a phone', items: [
      ['Install the app on this phone', 'In a browser that allows it, tap the cloud button in the header. The sheet that opens (“Sync & sign-in” in practice mode) has the Install button at the bottom. The Android app has no install button.'],
      ['iPhone', 'Open the page in Safari, tap the Share button, then Add to Home Screen.'],
      ['Already installed', 'The cloud sheet says “Installed on this phone ✓”.'] ] } ] },

 { title: 'Your data: what is kept and what is deleted',
   what: 'Visitors’ health information is kept no longer than it is needed (POPIA). These are all the ways data leaves the app.',
   sections: [
    { name: 'Deleted automatically', items: [
      ['Readings and prayer requests', 'Cleared 7 days after the visit. The app does the same on the device, judged on the database’s clock, so a phone with a wrong date does not clear anything early.'],
      ['Visitors who did not agree to follow-up', 'Deleted, with their readings, after 7 days.'],
      ['Visitors who agreed to follow-up', 'Only the name and contact details stay, for up to 2 years after the last visit. Then the whole record goes.'],
      ['Queue entries', 'They hold only a badge number and times. Finished and removed ones can be cleared at any time; the daily clean-up deletes any that are older than 30 days.'],
      ['The daily clean-up', 'Runs on the server at 03:00 each day. If it is not switched on for your church, the app’s support team runs it by hand.'] ] },
    { name: 'Deleted by a person', items: [
      ['Remove visitor', 'A team leader only for a visitor at their own station. See Visitor.', 'lead'],
      ['Clear finished & removed', 'On the Queue page.', 'admin'],
      ['Sign out', 'Clears the visitor and volunteer data on this device. The shared database keeps it.'],
      ['Delete my account', 'Deletes your login and your details. Visitor and volunteer records stay with your church.'] ] },
    { name: 'Behind the scenes', items: [
      ['A copy for mistakes', 'When a visitor is removed, the database keeps a copy in its audit log so that a mistake can be put right by whoever manages the database. The daily clean-up empties that copy after 90 days, or on its next run for a visit that is already past its 7 days.'],
      ['The audit log', 'Lines saying who did what, with no health data, are kept for 2 years.'],
      ['The visitor’s rights', 'The consent notice tells the visitor they may see, correct or ask for deletion of their information at any time, and gives the Information Regulator for complaints.'] ] } ] }
];

/** @type {HelpRow[]} */
export const HELP_MESSAGES = [
 ['The live queue isn’t switched on for your church yet', 'Your church’s queue has not been set up on the shared database. Ask your church admin to contact the app’s support. Meanwhile you can still register and check visitors.'],
 ['This sign-in is not approved for the queue', 'Ask a church admin to approve your staff account.'],
 ['This account can’t join this church. Contact the church if you think this is a mistake.', 'The account cannot join that church. Speak to someone at the church.'],
 ['No connection — the queue cannot change', 'Queue changes need a connection. Reconnect, then try again.'],
 ['Deregistered — your pledge still stands', 'Deregister worked: your station is released and your pledge stays on the team list.'],
 ['Your pledge is withdrawn', 'Unpledge worked: your name is off the team list.'],
 ['One moment — the last queue change is still saving', 'Wait a moment, then tap again.'],
 ['Someone else just changed that one', 'Another desk changed the same person. The line has been refreshed; check it.'],
 ['… is already in this line', 'That person is already waiting or being served at that station.'],
 ['Nobody is waiting here', 'Call next found nobody waiting at that station.'],
 ['… visit is complete ✓ · taken out of the … line', 'Finish visit also took the visitor out of the lines they were in.'],
 ['… the lines could not be updated (no connection), they will be when you are back online', 'The visit finished on the passport, but the queue could not change. The app remembers it on this device and takes the visitor out of their lines when the queue is reachable again.'],
 ['… the lines could not be updated yet, it will be tried again', 'Some lines did not change. The app tries again at the next sync.'],
 ['…: Blood Pressure started', 'Start put the visitor with you at that station. Undo stays for 6 seconds.'],
 ['Stop at Blood Pressure?', 'Cancel on the row of the person being served: Put back in line, They left, or Keep going.'],
 ['… left · taken out of the … lines', 'They left took the visitor out of every line they were in. Undo stays for 6 seconds.'],
 ['…: start cancelled', 'Undo took a walk-up out of the line they were added to when you started them.'],
 ['…: Blood Pressure done ✓ · now in the … line', 'Done marked that station’s line done and put the visitor in the next one. Undo stays for 6 seconds.'],
 ['Done at Blood Pressure?', 'Some of that station’s readings are missing, and the question names them. Done anyway goes on; Keep going stays.'],
 ['… is back with you at Blood Pressure', 'Undo put the visitor back with you.'],
 ['… finished ✓ · now in the … line · Next: …', 'Done · call next finished the person, put them in their next line (say where to go) and called the next one.'],
 ['This can’t be done from this account.', 'The action is not open to this sign-in, so nothing was changed.'],
 ['Nothing was cleared. This can’t be done from this account.', 'The database refused the delete for this sign-in.'],
 ['This visitor can’t be removed from this account.', 'Nothing was removed.'],
 ['Removing a visitor needs a connection — try again when you are online.', 'The visitor is on the shared database, so it has to be removed there first. Reconnect and try again.'],
 ['The database did not remove them. This visitor can’t be removed from this account.', 'The database refused, so nothing was removed.'],
 ['Custom plans are not available on this account.', 'Nothing was changed.'],
 ['Saved copy is nearly full — sync now and remove old visitors', 'This device holds about 10,000 visitors. Sync, then remove visitors you no longer need.'],
 ['That email address does not look right', 'Check the address, for example name@example.com. Leave it empty where it is optional.'],
 ['Could not reach the server yet — retrying', 'Wait. The app retries when the connection returns.']
];

/** @type {HelpRow[]} */
export const HELP_TERMS = [
 ['Badge number (EXPO-123)', 'The visitor’s number, printed on their lanyard.'],
 ['Station', 'One place in the expo, and its line in the queue: Vitals & BMI, Blood Pressure, Sugar & Chol., Fruit & Veg, Exercise, Water, Sleep, Kitchen Pharmacy, Counselling, Prayer.'],
 ['Waiting, Being served, Finished, Left', 'The four queue states. See Queue.'],
 ['Health age', 'The age the 8 checks and the height point to. It needs all 8 checks and a height. The survey and the paper record do not change it.'],
 ['BMI', 'Body mass index: weight in kilograms divided by height in metres, squared.'],
 ['Consent (POPIA)', 'The visitor’s permission to record and use their results.'],
 ['Pledge', 'A volunteer’s commitment to help at an expo.'],
 ['Booth', 'The team and station a volunteer works at.'],
 ['Leader', 'The person in charge of a booth.'],
 ['Church admin', 'A member who approves people, changes roles, manages expos, writes custom plans and clears the queue.', 'admin'],
 ['Practice mode', 'Not signed in. Three made-up visitors and a queue on this device only. Nothing is sent to the shared database and other phones cannot see it; it stays on this phone until you tap Reset demo. Never enter real visitors in practice mode.'],
 ['Sync', 'Sending this device’s changes to the shared database and fetching other desks’ changes. See “Working offline and keeping in sync”.'],
 ['Team leader', 'A volunteer who leads a booth.']
];

/** the queue's phases, in the order a visit moves through them */
export const HELP_QUEUE_PHASES = [
 ['1. Joined (waiting)', 'Added to a station: automatically when they register (Blood Pressure, the first check), or by hand with + Add visitor. The line keeps the order people joined.'],
 ['2. Called (being served)', 'Call next takes the person who has waited longest at that station into a free place. Call on a waiting person serves them now, and so does Start on the passport; if every place is busy they are an Extra until a place frees up.'],
 ['3. Finished (done)', 'Done · call next → (or Done ✓ when nobody else is waiting) marks them finished at this station. If their route has another station left, they join it automatically. Done on the passport’s footer does the same.'],
 ['4. Put back (waiting again)', '↩ Put back, or Cancel then Put back in line on the passport, returns them to their old place in the line, keeping their join time.'],
 ['5. Left (removed)', '✕ Remove, then Remove? within three seconds, takes them out of the line; Cancel then They left on the passport takes them out of every line. Finish visit on the passport takes them out of every line they are in.'],
 ['Clearing history', 'Finished and removed entries stay on record until they are cleared (the database’s daily clean-up also removes entries older than 30 days, where it is switched on).'],
 ['Optional stops', 'Kitchen Pharmacy and Prayer are not on the automatic route. Add people to them by hand.'],
 ['The wait estimate', 'The app invents no times. Until 3 visits have finished at a line there is no estimate: cards show only how long the longest waiter has waited, and the big screen only how many wait. From then on the estimate is the average minutes per person (from the last 15 finished visits) times the people ahead, plus the time left on visits in progress, divided by the number of people being served there.']
];

/* The built page is the same until the app changes, so it is kept in the shared memory cache (src/memory.js). */
const helpCache = window.NSMem ? new window.NSMem.Cache('help', { max: 4, ttl: 300000 }) : null;

/** the page as text */
export function helpHTML() {
 return helpCache ? helpCache.memo('all' + helpKey(), helpPageHTML) : helpPageHTML();   /* one copy per set of roles */
}

function helpPageHTML() {
 const list = (rows) => `<dl class="help-list">${rows.filter(r => helpSees(r[2])).map(([k, v, r]) => `<dt>${esc(k)}${r ? roleTag(r) : ''}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
 const secs = (ss) => ss.filter(x => helpSees(x.role)).map(x => `<h4 class="microlabel mt-3">${esc(x.name)}${x.role ? roleTag(x.role) : ''}</h4>${list(x.items)}`).join('');
 const pages = HELP_PAGES.filter(p => helpSees(p.role)).map(p => `<section class="help-page" data-tab="${esc(p.tab)}">
  <h3 class="display text-base font-extrabold">${esc(p.title)}${p.role ? roleTag(p.role) : ''}</h3>
  <p class="help-what">${esc(p.what)}</p>
  ${secs(p.sections)}
 </section>`).join('');
 const start = HELP_START.map(p => `<section class="help-page help-start"><h3 class="display text-base font-extrabold">${esc(p.title)}</h3>
  <p class="help-what">${esc(p.what)}</p>
  ${secs(p.sections)}
 </section>`).join('');
 const phases = `<section class="help-page"><h3 class="display text-base font-extrabold">How the queue works</h3>
  <p class="help-what">Each visit moves through the queue in these phases.</p>${list(HELP_QUEUE_PHASES)}</section>`;
 const topics = HELP_TOPICS.map(p => `<section class="help-page"><h3 class="display text-base font-extrabold">${esc(p.title)}</h3>
  <p class="help-what">${esc(p.what)}</p>
  ${secs(p.sections)}
 </section>`).join('');
 const tutorials = `<section class="help-page"><h3 class="display text-base font-extrabold">Step by step</h3>
  ${HELP_TUTORIALS.map(t => `<h4 class="microlabel mt-3">${esc(t.title)}</h4><ol class="help-steps">${t.steps.filter(x => typeof x === 'string' || helpSees(x[1])).map(x => typeof x === 'string' ? `<li>${esc(x)}</li>` : `<li>${esc(x[0])}${roleTag(x[1])}</li>`).join('')}</ol>`).join('')}</section>`;
 const messages = `<section class="help-page"><h3 class="display text-base font-extrabold">Messages you may see</h3>${list(HELP_MESSAGES)}</section>`;
 const terms = `<section class="help-page"><h3 class="display text-base font-extrabold">Words used in the app</h3>${list(HELP_TERMS)}</section>`;
 return `<div class="help-intro"><div class="display text-base font-extrabold">Help &amp; tutorial</div>
  <p class="help-what">What the app is for, how a visit works, and then every page of the app, in the order of the bottom bar: Home, Visitor, Queue, Care, Team, Profile.</p>
  <button data-action="startTour" data-tour="help-tour" class="btn btn-primary mt-2 w-full py-3 text-xs ns-tap">Take the guided tour</button></div>
  ${start}${pages}${phases}${topics}${tutorials}${messages}${terms}`;
}

export function openHelp() {
  const body = $('#helpBody');
  body.innerHTML = helpHTML();
  body.scrollTop = 0;
  showModal('#helpModal', closeHelp);
}

export function closeHelp() {
  hideModal('#helpModal');
}

/* The header's ? button: the guide, scrolled to the page for the tab in view (the visit steps share one page). */
export function openHelpHere() {
  openHelp();
  let tab = state.tab;
  if (JOURNEY.includes(tab)) tab = 'visit';
  const sec = $('#helpBody').querySelector(`.help-page[data-tab="${esc(tab)}"]`);
  if (sec) setTimeout(() => {
    sec.scrollIntoView({ block: 'start' });
    sec.setAttribute('tabindex', '-1');
    sec.focus({ preventScroll: true });
  }, 30);
}

/* Profile → Settings & help → Take the guided tour (tutorial/tour.js); the guide has the same steps if it failed to load. */
export function startTour() {
  closeHelp();
  if (window.NSTour) window.NSTour.start();
  else toast('The guided tour could not load. Help & tutorial has the same steps.');
}
