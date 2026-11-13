// @ts-check
import { SEED } from './data.js';
/* POPIA s14: kept no longer than needed. A visitor takes their results home on the printed card or by WhatsApp on the
   day, so the church has no reason to hold the readings: they are deleted GRACE_DAYS after the visit, and a visitor who
   did not agree to follow-up is deleted with them. Only name and contact details of a follow-up stay, for
   RETENTION_YEARS after the last visit. supabase/schema.sql applies the same rule in the database (the daily purge and
   the trigger on attendees) and the notice the visitor reads says it too (noticeRows in visitor.js): change the
   three together. */
export const GRACE_DAYS=7;
export const RETENTION_YEARS=2;

/* The phone's clock can be wrong by days; a phone a week fast would clear another desk's fresh readings and upload the
   empty copy. So the age of a visit is judged on the database's clock: my_account() returns server_now, and the
   difference to this phone's clock (taken at the middle of the request) is added to Date.now(). Until that is known
   (an offline boot) the phone clears by its own clock only with OFFLINE_SLACK_DAYS of margin (retentionDue), so a
   phone up to that many days fast still clears nothing fresh; the daily purge on the server applies the exact rule. */
export const OFFLINE_SLACK_DAYS=7;
let clockSkew=0,skewKnown=false;
export function noteServerTime(iso,sentAt,gotAt){
 const t=Date.parse(iso||'');
 if(isNaN(t))return;
 clockSkew=t-(sentAt+gotAt)/2;skewKnown=true;
}
export const clockKnown=()=>skewKnown;
export const serverNow=()=>Date.now()+clockSkew;
/* the visit's date, as the database holds it; a record without one falls back to the consent date — the same
   fallback the database uses (consent_is_old in schema.sql), and every version of the app sends that date. The
   built-in demo visitors are exempt: their consent dates are fixtures from a past expo, and practice must keep
   showing their readings. */
const olderThan=(a,days,now)=>{
 const t=Date.parse((a&&a.created_at)||'');
 if(!isNaN(t))return now-t>days*86400000;
 if(SEED.some(x=>x.id===(a&&a.id)))return false;
 const c=(a&&a.interests&&a.interests.consentOn)||'';
 return /^\d{4}-\d{2}-\d{2}$/.test(c)&&c<new Date(now-days*86400000).toISOString().slice(0,10);
};
export const visitIsOld=a=>olderThan(a,GRACE_DAYS,serverNow());
/* may the phone clear this visit now? On the database's clock the exact rule; without it, only with the margin */
export const retentionDue=a=>skewKnown?visitIsOld(a):olderThan(a,GRACE_DAYS+OFFLINE_SLACK_DAYS,Date.now());
/* the app always carries the eight reading keys (null until measured), so emptiness is "no value in any of them" */
export const hasReadings=a=>{
 const s=(a&&a.s)||{};
 return Object.keys(s).some(k=>s[k]!=null)||!!(a&&(a.prayer||a.chronicList||a.heightCm!=null));
};
/* an old record with no readings at all did not "not get measured yet": its readings were deleted */
export const readingsGone=a=>visitIsOld(a)&&!((a&&a.s)&&Object.keys(a.s).some(k=>a.s[k]!=null));
export const followedUp=a=>!!(a&&a.interests&&a.interests.optin);
/* the parts of interests that come from the readings (the plan chosen or written for them, the urgent-reading mark).
   The notice promises that only name and contact details stay, so they go with the readings; the follow-up answers
   (classes, seminars, the follow-up call) stay, because follow-up is what they are kept for. */
export const VISIT_KEYS=['customPlan','churchPlan','attended'];
const hasVisitKeys=a=>!!(a&&a.interests&&typeof a.interests==='object'&&VISIT_KEYS.some(k=>k in a.interests));
export const hasVisitDetails=a=>hasReadings(a)||hasVisitKeys(a);
/* what the database keeps of a visit past the grace period: nothing about the visit itself */
export function clearReadings(a){
 const s=(a&&a.s)||{};
 for(const k of Object.keys(s))s[k]=null;
 a.prayer='';a.chronicList='';a.heightCm=null;
 if(a.interests&&typeof a.interests==='object')for(const k of VISIT_KEYS)delete a.interests[k];
 return a;
}
/* The visitor's copy: the same rule on a record shown on screen, whether or not it has synced yet, so a phone that was
   offline does not keep showing readings that are past the grace period. The record itself is left alone (the server
   clears it); this returns what a screen should draw. */
export function withoutOldReadings(a){
 if(!a||!visitIsOld(a)||!hasVisitDetails(a))return a;
 return clearReadings({...a,s:{...(a.s||{})},interests:{...(a.interests||{})}});
}
