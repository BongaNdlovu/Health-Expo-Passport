// @ts-check
/* Android app (Capacitor) detection and addresses. Split from the original single-file app; bundled back into one file by tools/build.js. */
/* ================= ANDROID APP (Capacitor) =================
   The same page also runs packaged inside the Android app, where it opens with no internet and syncs when there is
   signal. IS_APP is true only there; the few places that differ (libraries, fonts, WhatsApp, printing, email links)
   ask it. APP_SITE is the web address: sign-up and password emails must link there, not to the app. */
export const IS_APP=!!(window.Capacitor&&typeof window.Capacitor.isNativePlatform==='function'&&window.Capacitor.isNativePlatform());
export const APP_SITE='https://winter-bonus-626a.ndlovufanelesibonge8.workers.dev/';
