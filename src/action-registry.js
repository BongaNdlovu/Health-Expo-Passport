// @ts-check
import { closeAcct, cloudInit, cloudSignIn, cloudSignOut, cloudSync, gateBack, joinChurch, leaveChurch, linkMember, linkVolunteer, manageChurch, myField, myPickPledge, myPledgeEdit, myPledgeSave, mySecondBooth, myToggleBooth, myToggleList, openAcct, profDeleteAsk, profDeleteGo, profDeleteTyped, profGate, profPassword, registerChurch, removeMember, renderAcct, saveChurch, saveMyDetails, setChurchStatus, setMember, teamAdd, teamRelease, teamShift, withdrawMyPledge } from './account.js';
import { churchSearchSoon, openChurchData, stepDown } from './account.js';
import { cancelInvites, chooseChurchPlan, chooseFollowup, deleteChurchPlan, editChurchPlan, makeInvite, saveChurchPlan, setFollowup } from './churchPlans.js';
import { copyInvite, shareInvite } from './churchPlans.js';
import { closeCloud, cloudForgot, cloudNewPassword, cloudResend, cloudSignUp, gateDemo, gateView, healthTest, installApp, openCloud, renderCloudBody, renderGate, togglePass } from './cloud.js';
import { approveStaff } from './cloud.js';
import { state } from './data.js';
import { queueBack, queueCallNext, queueDone, queueRemove, queueServe } from './queue.js';
import { closeBigScreen, closeQueuePick, openBigScreen, openQueuePick, qFilterPick, qPickAdd, qSelect, queueSync } from './queue.js';
import { closeFood, exportCSV, openFood, showAllCare } from './results.js';
import { onSim, selectProtocol, setFoodMetric, setFoodPlan, toggleFood } from './results.js';
import { render } from './shell.js';
import { isServe } from './shell.js';
import { cloud } from './state.js';
import { filterVisitors, onPrayer, onStationCommit, onStationInput, onStep, registerSubmit, reservePouch, resetDemo, switchTab, toggleInterest, toggleReg } from './visitor.js';
import { applyReading, finishVisit, goVisit, newVisitFrom, onChronicList, onHeight, pickSex, recordConsent, setAnswer, setMyStation, showGuardian, switchTo, toggleOptin, toggleTick } from './visitor.js';
import { closeVolReg, closeWhatsApp, exportVolCSV, logExpoEntry, openEmail, openSwitcher, openVolModal, openVolReg, openVolSwitcher, openWhatsApp, pickSecondBooth, pickVolunteer, printCard, removeExpoEntry, saveExpoEntry, saveVolunteer, sendEmail, sendWhatsApp, setVol, setVolTab, startNewVolunteer, switchToVol, toggleDraftBooth, toggleDraftList, toggleShift } from './volunteer.js';
import { closeSwitcher, closeVolModal, closePlaceSheet, filterSwitcher, filterVolSwitcher, openWAFor, openPlaceSheet, pickAttendee, pickPledge, placeLead, placeMove, placeRelease, placeSwap, recycleBadge, registerNew, setSwitchMode, showAllVol } from './volunteer.js';


/* The action registry: one entry per data-action name. Plain functions are called with (element, event)
   and ignore both; adapters pull their arguments off the element's data-* attributes (numbers through
   Number(), because data attributes are strings and the arithmetic behind them needs numbers).
   main.js registers this map at boot, then calls initActions(). */

export const ACTION_MAP = {
  /* -- plain functions (no arguments) -- */
  closeAcct, closeBigScreen, closeCloud, closeFood, closeQueuePick, closeSwitcher,
  closeVolModal, closeVolReg, closeWhatsApp, cloudInit, cloudResend, cloudSignOut, copyInvite,
  exportCSV, exportVolCSV, finishVisit, gateBack, gateDemo, goVisit, healthTest, installApp, leaveChurch,
  logExpoEntry, openBigScreen, openCloud, openEmail, openFood, openSwitcher, openVolModal,
  openVolReg, openVolSwitcher, openWhatsApp, profDeleteAsk, profDeleteGo, recycleBadge, registerNew, resetDemo,
  saveExpoEntry, saveVolunteer, sendEmail, sendWhatsApp, shareInvite, startNewVolunteer, stepDown,
  switchToVol, toggleReg,

  /* -- single argument, on the element as data-args -- */
  cancelInvites: el => cancelInvites(el.dataset.args),
  chooseChurchPlan: el => chooseChurchPlan(el.dataset.args),
  chooseFollowup: el => chooseFollowup(el.dataset.args),
  gateView: el => gateView(el.dataset.args),
  manageChurch: el => manageChurch(el.dataset.args),
  openAcct: el => openAcct(el.dataset.args),
  openChurchData: el => openChurchData(el.dataset.args),
  openQueuePick: el => openQueuePick(el.dataset.args),
  openWAFor: el => openWAFor(el.dataset.args),
  pickAttendee: el => pickAttendee(el.dataset.args),
  pickVolunteer: el => pickVolunteer(el.dataset.args),
  profGate: el => profGate(el.dataset.args),
  qPickAdd: el => qPickAdd(el.dataset.args),
  qSelect: el => qSelect(el.dataset.args),
  queueBack: el => queueBack(el.dataset.args),
  queueCallNext: el => queueCallNext(el.dataset.args),
  queueDone: el => queueDone(el.dataset.args),
  queueRemove: el => queueRemove(el.dataset.args),
  queueServe: el => queueServe(el.dataset.args),
  recordConsent: el => recordConsent(el.dataset.args),
  removeMember: el => removeMember(el.dataset.args),
  selectProtocol: el => selectProtocol(el.dataset.args),
  setFoodMetric: el => setFoodMetric(el.dataset.args),
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
  'church-save': (el, ev) => saveChurch(ev, el.dataset.args),
  'church-status': el => setChurchStatus(el.dataset.args, el.dataset.status),
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

  /* -- live queue, sim, shell nav -- */
  'queue-sync': () => queueSync(true),
  'queue-filter': el => qFilterPick(el.value),
  'sim-set': el => onSim(el.dataset.args, el.value),
  'sim-open': el => { state.simOpen = el.open; },
  'nav-go': el => el.dataset.tab === 'visit' ? goVisit() : switchTab(el.dataset.tab),
  'switcher-open': el => isServe() ? openVolSwitcher() : openSwitcher(),

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
};
