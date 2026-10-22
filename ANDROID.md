# Android app (APK)

`android/` builds a small Android app that opens the live website full-screen (a *Trusted Web Activity*). It is the same
app as the website: the screens, sign-in, offline mode and camera scanning all come from the site, so **updating the app
for everyone is just re-uploading `dist/`** — you do not rebuild or re-install the APK for normal changes.

> iPhones cannot run an APK. iPhone users install from Safari (*Share → Add to Home Screen*, see `HOSTING.md`).

## What you get

| File | What it is |
| --- | --- |
| `android/app-release-signed.apk` | the app, signed with your key — install this on Android phones |
| `android/signing/newstart.jks` | **your signing key** (passwords are in Windows Credential Manager, not in this folder) |
| `android/assetlinks.json` | proof (published at `/.well-known/assetlinks.json`) that this app belongs to your website |

## Back up the signing key now

Copy `android/signing/newstart.jks` somewhere private, and keep the store and key passwords in a password manager
(this PC also has them as Windows credentials `NEWSTART-Expo/keystore-store` and `NEWSTART-Expo/keystore-key`).
**If the key or the passwords are lost you can never ship an update that installs over the existing app**; everyone
would have to uninstall and reinstall. Never upload the key or send it to anyone. (`build.js` never copies it into `dist/`.)

## One-time: publish the verification file

1. `node tools/build.js` (it copies `android/assetlinks.json` into `dist/.well-known/`).
2. Re-upload `dist/` to Cloudflare.
3. Check `https://YOUR-ADDRESS/.well-known/assetlinks.json` opens in a browser and shows the JSON.

Until that file is live the app still works, but Android shows a small address bar at the top. After it is live,
reinstall (or just reopen after a minute) and the bar disappears.

## Install on a phone (outside the Play Store)

1. Put `newstart.apk` online: `node tools/build.js` also copies the built APK into `dist/newstart.apk`, so after the
   upload it downloads from `https://YOUR-ADDRESS/newstart.apk`. (Or send the file over WhatsApp / USB.)
2. On the phone open that link in Chrome → download → open the file.
3. Android asks to allow *Install unknown apps* for Chrome (or Files) once → allow → **Install**.
4. Open **NEWSTART**, sign in. Open it once with data/Wi-Fi so the offline copy is saved.

Android may show "Play Protect" warnings for apps not from the store; choose *Install anyway* — the app is signed with
your own key and only opens your site.

## Rebuilding the APK

You only need a new APK if you change the app's name/icon/package, move to a different web address, or want a new version
number. From a terminal in the project folder:

```powershell
cd android
$env:JAVA_HOME="C:\Program Files\Eclipse Adoptium\jdk-17.0.17.10-hotspot"
.\gradlew.bat assembleRelease
```

then zip-align and sign (`tools/sign-apk.ps1` does both). If the web address changes, edit `host` and the URLs in
`android/twa-manifest.json`, run `npx @bubblewrap/cli update --skipVersionUpgrade` inside `android/`, update
`assetlinks.json` if the key changed, and rebuild.

## Google Play (optional)

The same project builds an `.aab` for the Play Store (`.\gradlew.bat bundleRelease`). Publishing needs a Google Play
developer account (one-time US$25) and health-app declarations; sideloading the APK needs none of that.
