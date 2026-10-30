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
   the phone clears nothing by date (clockKnown); the daily purge on the server still does. */
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
export const visitIsOld=a=>{
 const t=Date.parse((a&&a.created_at)||'');
 if(!isNaN(t))return serverNow()-t>GRACE_DAYS*86400000;
 if(SEED.some(x=>x.id===(a&&a.id)))return false;
 const c=(a&&a.interests&&a.interests.consentOn)||'';
 return /^\d{4}-\d{2}-\d{2}$/.test(c)&&c<new Date(serverNow()-GRACE_DAYS*86400000).toISOString().slice(0,10);
};
/* the app always carries the eight reading keys (null until measured), so emptiness is "no value in any of them" */
export const hasReadings=a=>{
 const s=(a&&a.s)||{};
 return Object.keys(s).some(k=>s[k]!=null)||!!(a&&(a.prayer||a.chronicList||a.heightCm!=null));
};
/* an old record with no readings at all did not "not get measured yet": its readings were deleted */
export const readingsGone=a=>visitIsOld(a)&&!((a&&a.s)&&Object.keys(a.s).some(k=>a.s[k]!=null));
export const followedUp=a=>!!(a&&a.interests&&a.interests.optin);
/* what the database keeps of a visit past the grace period: nothing about the visit itself */
export function clearReadings(a){
 const s=(a&&a.s)||{};
 for(const k of Object.keys(s))s[k]=null;
 a.prayer='';a.chronicList='';a.heightCm=null;
 return a;
}
/* The visitor's copy: the same rule on a record shown on screen, whether or not it has synced yet, so a phone that was
   offline does not keep showing readings that are past the grace period. The record itself is left alone (the server
   clears it); this returns what a screen should draw. */
export function withoutOldReadings(a){
 if(!a||!visitIsOld(a)||!hasReadings(a))return a;
 return clearReadings({...a,s:{...(a.s||{})}});
}
