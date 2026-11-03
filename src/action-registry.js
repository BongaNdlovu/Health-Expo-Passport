// @ts-check
import { acctRetry, manageExpos, removeVisitorAsk, closeAcct, cloudInit, cloudSignIn, cloudSignOut, cloudSync, gateBack, joinChurch, leaveChurch, linkMember, linkVolunteer, manageChurch, markNotifsRead, myField, myPickPledge, myPledgeEdit, myPledgeSave, mySecondBooth, myToggleBooth, myToggleList, notifClose, notifOpen, openAcct, openNotifs, profDeleteAsk, profDeleteGo, profDeleteTyped, profGate, profPassword, quarantineDiscard, quarantineExport, registerChurch, removeMember, renderAcct, saveChurch, saveMyDetails, setChurchStatus, setMember, teamAdd, teamRelease, teamShift, withdrawMyPledge } from './account.js';
import { addPlatformAdmin, approveAssistant, cancelExpo, churchSearchSoon, deleteExpoAsk, editExpo, expoField, expoStation, expoType, newExpo, openChurchData, pickExpo, pickWant, pickWantBooth, pledgeToExpo, saveExpoForm, setAdminPost, setExpoStatus, stepDown } from './account.js';
import { deregisterMyPledge, setProfSection } from './account.js';
import { answer } from './feedback.js';
import { updateLater, updateNow } from './update.js';
import { cancelInvites, chooseChurchPlan, chooseFollowup, deleteChurchPlan, editChurchPlan, makeInvite, saveChurchPlan, setFollowup } from './churchPlans.js';
import { copyInvite, shareInvite } from './churchPlans.js';
import { closeCloud, cloudForgot, cloudNewPassword, cloudResend, cloudSignUp, gateDemo, gateView, healthTest, installApp, openCloud, renderCloudBody, renderGate, togglePass } from './cloud.js';
import { approveStaff } from './cloud.js';
import { state } from './data.js';
import { queueBack, queueCallNext, queueClearHistory, queueDone, queueCancelHere, queueDoneNext, queueFinishHere, queueNextInLine, queueRemove, queueServe, queueStart } from './queue.js';
import { qCapSet, qNamesToggle, qPlacesOpen, qSkipFilledToggle, qSlotCall, qSlotMove, qSlotNameSet } from './queue.js';
import { closeBigScreen, closeQueuePick, openBigScreen, openQueuePick, qFilterPick, qPickAdd, qSelect, queueSync } from './queue.js';
import { closeFood, exportCSV, exportPrayerCSV, exportXLSX, openFood, showAllCare } from './results.js';
import { closeHelp, openHelp, openHelpHere, startTour } from './help.js';
import { onSim, setFoodPlan, toggleFood } from './results.js';
import { isServe, render, toggleTheme } from './shell.js';
import { cloud } from './state.js';
import { tfBack, tfGo, tfMode, tfNext, tfSkip } from './visitor.js';
import { clearVisitorSearch, filterVisitors, onPrayer, onStationCommit, onStationInput, onStep, registerSubmit, reservePouch, resetDemo, resetDemoAsk, switchTab, toggleInterest, toggleReg } from './visitor.js';
import { applyReading, cancelReg, confirmResults, editReadings, finishVisit, goVisit, metricBack, newVisitFrom, onChronicList, onHeight, openMetric, pickSex, recordConsent, setAnswer, setMyStation, showGuardian, switchTo, toggleOptin, toggleTick } from './visitor.js';
import { customPlanClear, customPlanEdit, customPlanFromCurrent, customPlanImport, customPlanSave, customPlanTemplate } from './customPlan.js';
import { closeVolReg, closeWhatsApp, exportVolCSV, logExpoEntry, openEmail, openSwitcher, openVolModal, openVolReg, openVolSwitcher, openWhatsApp, pickSecondBooth, pickVolunteer, printCard, removeExpoEntry, saveExpoEntry, saveVolunteer, sendEmail, sendWhatsApp, setVol, setVolTab, startNewVolunteer, switchToVol, toggleDraftBooth, toggleDraftList, toggleShift } from './volunteer.js';
import { closeSwitcher, closeVolModal, closePlaceSheet, filterSwitcher, filterVolSwitcher, openWAFor, openPlaceSheet, pickAttendee, pickPledge, placeLead, placeMove, placeRelease, placeSwap, recycleBadge, registerNew, setSwitchMode, showAllVol } from './volunteer.js';


/* The action registry: one entry per data-action name. Plain functions are called with (element, event)
   and ignore both; adapters pull their arguments off the element's data-* attributes (numbers through
   Number(), because data attributes are strings and the arithmetic behind them needs numbers).
   main.js registers this map at boot, then calls initActions(). */

export const ACTION_MAP = {
  /* -- plain functions (no arguments) -- */
  openHelpHere, startTour,
  cancelReg, closeAcct, closeBigScreen, closeCloud, closeFood, closeQueuePick, closeSwitcher,
  closeVolModal, closeVolReg, closeWhatsApp, cloudInit, cloudResend, copyInvite,
  editReadings, exportCSV, exportVolCSV, finishVisit, gateBack, gateDemo, goVisit, healthTest, installApp, leaveChurch,
  logExpoEntry, metricBack, queueClearHistory, openBigScreen, openCloud, openEmail, openFood, openSwitcher, openVolModal,
  openVolReg, openVolSwitcher, openWhatsApp, profDeleteAsk, profDeleteGo, recycleBadge, registerNew, resetDemo,
  saveExpoEntry, saveVolunteer, sendEmail, sendWhatsApp, shareInvite, startNewVolunteer, stepDown,
  switchToVol, toggleReg, closeHelp, openHelp, deregisterMyPledge, resetDemoAsk, updateLater, updateNow,

  /* -- the confirmation sheet (src/feedback.js): these answer a question, they do not perform an action -- */
  confirmYes: () => answer(true),
  confirmNo: () => answer(false),
  confirmAlt: () => answer('alt'),

  /* -- single argument, on the element as data-args -- */
  cancelInvites: el => cancelInvites(el.dataset.args),
  chooseChurchPlan: el => chooseChurchPlan(el.dataset.args),
  chooseFollowup: el => chooseFollowup(el.dataset.args),
  gateView: el => gateView(el.dataset.args),
  manageChurch: el => manageChurch(el.dataset.args),
  openAcct: el => openAcct(el.dataset.args),
  openChurchData: el => openChurchData(el.dataset.args),
  openMetric: el => openMetric(el.dataset.args),
  openQueuePick: el => openQueuePick(el.dataset.args),
  openWAFor: el => openWAFor(el.dataset.args),
  pickAttendee: el => pickAttendee(el.dataset.args),
  pickVolunteer: el => pickVolunteer(el.dataset.args),
  profGate: el => profGate(el.dataset.args),
  profSection: el => setProfSection(el.dataset.args),
  qPickAdd: el => qPickAdd(el.dataset.args),
  qSelect: el => qSelect(el.dataset.args),
  queueBack: el => queueBack(el.dataset.args),
  queueCallNext: el => queueCallNext(el.dataset.args),
  /* one check at a time (visitor.js) */
  tfNext: () => tfNext(),
  tfBack: () => tfBack(),
  tfSkip: () => tfSkip(),
  tfGo: el => tfGo(Number(el.dataset.args)),
  tfMode: el => tfMode(el.dataset.args),
  /* several people served at once (queue.js) */
  qSlotCall: el => qSlotCall(el.dataset.args),
  qSlotMove: el => qSlotMove(el.dataset.args),
  qCapSet: el => qCapSet(el.dataset.args),
  qNamesToggle: el => qNamesToggle(el.dataset.args),
  qSlotName: el => qSlotNameSet(el.dataset.args, /** @type {HTMLInputElement} */ (el).value),
  qPlacesOpen: () => qPlacesOpen(),
  qSkipFilledToggle: () => qSkipFilledToggle(),
  /* the memory diagnostics panel exists only in practice mode */
  nsDiag: () => { if (!cloud.user && !cloud.mode && window.NSMem) window.NSMem.openDiag(true); },
  exportCSVMin: () => exportCSV('minimal'),
  exportXLSX: () => exportXLSX(),
  exportPrayerCSV: () => exportPrayerCSV(),
  queueDone: el => queueDone(el.dataset.args),
  queueDoneNext: el => queueDoneNext(el.dataset.args),
  queueCancelHere: el => queueCancelHere(...el.dataset.args.split('|')),
  queueFinishHere: el => queueFinishHere(...el.dataset.args.split('|')),
  queueNextInLine: el => queueNextInLine(el.dataset.args),
  queueStart: el => queueStart(...el.dataset.args.split('|')),
  queueRemove: el => queueRemove(el.dataset.args),
  queueServe: el => queueServe(el.dataset.args),
  recordConsent: el => recordConsent(el.dataset.args),
  removeMember: el => removeMember(el.dataset.args),
  setFoodPlan: el => setFoodPlan(el.dataset.args),
  setMyStation: el => setMyStation(el.dataset.args),
  setSwitchMode: el => setSwitchMode(el.dataset.args),
  setVol: el => setVol(el.dataset.args),
  setVolTab: el => setVolTab(el.dataset.args),
  showAllCare: el => showAllCare(el.dataset.args),
  showAllVol: el => showAllVol(el.dataset.args),
  switchTab: el => switchTab(el.dataset.args),
  switchTo: el => switchTo(el.dataset.args),
  toggleFood: el => toggleFood(el.dataset.args),
  toggleShift: el => toggleShift(el.dataset.args),

  /* -- forms: the submit event goes straight through (each handler preventDefaults itself) -- */
  cloudForgot: (el, ev) => cloudForgot(ev),
  cloudNewPassword: (el, ev) => cloudNewPassword(ev),
  cloudSignIn: (el, ev) => cloudSignIn(ev),
  cloudSignUp: (el, ev) => cloudSignUp(ev),
  profPassword: (el, ev) => profPassword(ev),
  registerChurch: (el, ev) => registerChurch(ev),
  registerSubmit: (el, ev) => registerSubmit(ev),
  saveMyDetails: (el, ev) => saveMyDetails(ev),
  myPledgeSave: (el, ev) => myPledgeSave(ev),

  /* -- account hub -- */
  'sync-now': () => cloudSync(true),
  cloudSignOut: () => cloudSignOut(),   /* adapter: the real function reads its first argument as `force`; dispatch passes the button (BUG-B) */
  'quarantine-export': () => quarantineExport(),
  'quarantine-discard': () => quarantineDiscard(),
  'church-search': el => churchSearchSoon(el.value),
  'join-church': el => joinChurch(el.dataset.args, el),
  'hub-open': el => { closeCloud(); openAcct(el.dataset.args); },
  'prof-delete-typed': el => profDeleteTyped(el),
  'back-to-churches': el => { cloud.adminChurch = ''; openAcct('admin'); },
  'member-approve': el => setMember(el.dataset.user, el.dataset.role, 'approved'),
  'member-role': el => setMember(el.dataset.user, el.value, el.dataset.status),
  'member-link': el => linkMember(el.dataset.user, el.dataset.cur),
  'member-vol-link': el => linkVolunteer(el.dataset.user, el.dataset.cur),
  'followup-toggle': el => setFollowup(el.dataset.user, el.dataset.on === '1'),
  'my-pledge-edit': () => myPledgeEdit(),
  'my-pledge-withdraw': () => withdrawMyPledge(),
  'my-pledge-deregister': () => deregisterMyPledge(),
  'my-name': el => myField('name', el.value),
  'my-phone': el => myField('phone', el.value),
  'my-shirt': el => myField('shirt', el.value),
  'my-email': el => myField('email', el.value),
  'my-pledge-pick': el => myPickPledge(Number(el.dataset.args)),
  'my-draft-toggle': el => myToggleList(el.dataset.list, el.dataset.args),
  'my-draft-booth': el => myToggleBooth(el.dataset.args),
  'my-second-booth': el => mySecondBooth(el.dataset.args),

  /* -- placement board (admins and station leaders) -- */
  openPlaceSheet: el => openPlaceSheet(el.dataset.args),
  'place-close': () => closePlaceSheet(),
  'place-move': el => placeMove(el.dataset.args),
  'place-swap': el => placeSwap(el.dataset.args),
  'place-release': () => placeRelease(),
  'place-lead': () => placeLead(),

  /* -- a team leader's own team (account panel) -- */
  'team-add': el => teamAdd(el.dataset.args),
  'team-release': el => teamRelease(el.dataset.args),
  'team-shift': el => teamShift(el.dataset.vol, el.value),

  /* -- notifications (the bell) -- */
  openNotifs: () => openNotifs(),
  'notif-close': () => notifClose(),
  'notif-mark-read': el => markNotifsRead(el.dataset.args),
  'notif-open': el => notifOpen(el.dataset.args),
  'church-save': (el, ev) => saveChurch(ev, el.dataset.args),
  'church-status': el => setChurchStatus(el.dataset.args, el.dataset.status),
  'padmin-add': (el, ev) => addPlatformAdmin(ev),
  'expo-new': el => newExpo(el.dataset.args),
  'expo-edit': el => editExpo(el.dataset.args),
  'expo-field': el => expoField(el.dataset.k, el.value),
  'expo-check': el => expoField('clinic', el.checked),
  'expo-station': el => expoStation(el.dataset.k, el.value),
  'expo-type': el => expoType(el.dataset.args),
  'expo-save': el => saveExpoForm(el.dataset.status),
  'expo-cancel': () => cancelExpo(),
  'expo-status': el => setExpoStatus(el.dataset.args, el.dataset.status),
  'expo-delete': el => deleteExpoAsk(el.dataset.args),
  'acct-retry': el => { if (el.dataset.args === 'plans') { cloud.plans = null; cloud.plansErr = null; } acctRetry(el.dataset.args); },   /* acctRetry (account.js) has no plans branch: clear the failed state so the redraw pulls again (E11) */
  'vq-clear': () => clearVisitorSearch(),
  'visitor-remove': el => removeVisitorAsk(el.dataset.args),
  'expo-manage': () => manageExpos(),
  'expo-pledge': el => pledgeToExpo(el.dataset.args),
  'expo-pick': el => pickExpo(el.value),
  'want-pick': el => pickWant(el.dataset.args),
  'want-booth': el => pickWantBooth(el.dataset.args),
  'member-post': el => setAdminPost(el.dataset.user, el.value),
  'member-approve-assistant': el => approveAssistant(el.dataset.user),
  'all-churches-back': el => { cloud.adminData = ''; renderAcct(); },
  'staff-approve': el => approveStaff(el.dataset.args, el),
  'approvals-clear': el => { cloud.isAdmin = undefined; renderCloudBody(); },
  'reg-church-list': el => { cloud.regChurch = false; cloud.acctV++; renderGate(); },
  'reg-church-form': el => { cloud.regChurch = true; cloud.acctV++; renderGate(); },

  /* -- church plans and invites -- */
  'plan-edit': el => editChurchPlan(el.dataset.church, el.dataset.plan),
  'plan-delete': el => deleteChurchPlan(el.dataset.church, el.dataset.plan),
  'plan-save': (el, ev) => saveChurchPlan(ev, el.dataset.args),
  'plan-edit-cancel': el => { cloud.planEdit = null; renderAcct(); },
  'invite-make': el => makeInvite(el.dataset.args, el.dataset.role),
  'select-self': el => el.select(),

  /* -- a plan written for one visitor (items 5 and 6) -- */
  customPlanEdit: () => customPlanEdit(),
  customPlanSave: (el, ev) => customPlanSave(ev),
  customPlanImport: el => customPlanImport(el),
  customPlanClear: () => customPlanClear(),
  customPlanTemplate: () => customPlanTemplate(),
  customPlanFromCurrent: () => customPlanFromCurrent(),

  /* -- live queue, sim, shell nav -- */
  'queue-sync': () => queueSync(true),
  'queue-filter': el => qFilterPick(el.value),
  'sim-set': el => onSim(el.dataset.args, el.value),
  'sim-open': el => { state.simOpen = el.open; },
  'nav-go': el => el.dataset.tab === 'visit' ? goVisit() : switchTab(el.dataset.tab),
  'switcher-open': el => isServe() ? openVolSwitcher() : openSwitcher(),
  confirmResults: () => confirmResults(),

  /* -- visitor journey -- */
  'guardian-show': el => showGuardian(el.dataset.args, el.value),
  'pick-sex': el => pickSex(el),
  'visitors-filter': el => filterVisitors(el.value),
  'switch-visitor': el => { state.regOpen = false; switchTo(el.dataset.args); },
  'register-again': () => registerSubmit(null, true),
  'new-visit': el => newVisitFrom(el.dataset.args),
  toggleOptin: el => toggleOptin(el.dataset.args),
  'step': el => onStep(el.dataset.id, el.dataset.k, Number(el.dataset.dir), Number(el.dataset.min),
    Number(el.dataset.max), Number(el.dataset.step), Number(el.dataset.def)),
  'station-input': el => onStationInput(el.dataset.id, el.dataset.k, el, Number(el.dataset.min), Number(el.dataset.max)),
  'station-commit': el => onStationCommit(el.dataset.id, el.dataset.k, el, Number(el.dataset.min),
    Number(el.dataset.max), Number(el.dataset.step)),
  'height-set': el => onHeight(el.dataset.args, el),
  'answer-set': el => setAnswer(el.dataset.id, el.dataset.k, Number(el.dataset.val)),
  'chronic-list': el => onChronicList(el.dataset.args, el.value),
  'interest-toggle': el => toggleInterest(el, el.dataset.id, el.dataset.k),
  'prayer-set': el => onPrayer(el.dataset.args, el.value),
  'tick-toggle': el => toggleTick(el, el.dataset.id, el.dataset.k),
  'reading-apply': el => applyReading(el.dataset.args, Number(el.dataset.fix)),

  /* -- volunteers -- */
  toggleDraftBooth: el => toggleDraftBooth(el.dataset.args),
  pickSecondBooth: el => pickSecondBooth(el.dataset.args),
  'expo-remove': el => removeExpoEntry(Number(el.dataset.ix)),
  'log-close': el => { state.logOpen = false; render(); },
  'vf-name': el => { state.vf.name = el.value; },
  'vf-phone': el => { state.vf.phone = el.value; },
  'vf-shirt': el => { state.vf.shirt = el.value; },
  'vf-email': el => { state.vf.email = el.value; },
  'vf-emergency': el => { state.vf.emergency = el.value; },
  'vf-notes': el => { state.vf.notes = el.value; },
  'pledge-pick': el => pickPledge(Number(el.dataset.args)),
  'draft-toggle': el => toggleDraftList(el.dataset.list, el.dataset.args),
  'vol-switcher-filter': el => filterVolSwitcher(el.value),
  'switcher-filter': el => filterSwitcher(el.value),

  /* -- send home -- */
  'vol-modal-team': el => { closeVolModal(); setVolTab('muster'); },
  'vol-modal-new': el => { closeVolModal(); startNewVolunteer(); },
  printCard: el => printCard(),
  reservePouch: el => reservePouch(),
  /* -- shared password boxes -- */
  'toggle-pass': el => togglePass(el),
  toggleTheme: () => toggleTheme(),
};
