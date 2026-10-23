# Android app (APK)

`capacitor/` builds the Android app: the same `index.html` packaged inside the app, so it opens and works with no signal.
Visitors and volunteers are saved on the phone first and shared through Supabase whenever there is signal, exactly like
the website. Because the page is inside the app, **changes to `index.html` reach Android phones only in a new APK**
(the website itself updates as soon as `dist/` is re-uploaded).

> iPhones cannot run an APK. iPhone users use the website in Safari (*Share → Add to Home Screen*, see `HOSTING.md`).

## What you get

| File | What it is |
| --- | --- |
| `capacitor/android/app-release-signed.apk` | the app, signed with your key — install this on Android phones |
| `android/signing/newstart.jks` | **your signing key** (passwords are in Windows Credential Manager, not in this folder) |

## Back up the signing key now

Copy `android/signing/newstart.jks` somewhere private, and keep the store and key passwords in a password manager
(this PC also has them as Windows credentials `NEWSTART-Expo/keystore-store` and `NEWSTART-Expo/keystore-key`).
**If the key or the passwords are lost you can never ship an update that installs over the existing app**; everyone
would have to uninstall and reinstall. Never upload the key or send it to anyone. (`build.js` never copies it into `dist/`.)

## Build and sign

```powershell
powershell -File tools\sign-app.ps1
```

It builds the app's files (`tools/build-app.js` refuses any library whose bytes differ from the integrity hash in
`index.html`), runs Capacitor and Gradle with Java 21 (the portable copy in `%LOCALAPPDATA%\expo-build-tools\jdk-21`
unless `JAVA_HOME` already points at Java 21), then zip-aligns and signs with the key above and prints the certificate.
Raise `versionCode` and `versionName` in `capacitor/android/app/build.gradle` for each release.

## Install on a phone (outside the Play Store)

1. Put `newstart.apk` online: `node tools/build.js` copies the built APK into `dist/newstart.apk`, so after the
   upload it downloads from `https://YOUR-ADDRESS/newstart.apk`. (Or send the file over WhatsApp / USB.)
2. On the phone open that link in Chrome → download → open the file.
3. Android asks to allow *Install unknown apps* for Chrome (or Files) once → allow → **Install**.
4. Open **NEWSTART** and sign in (or practise with demo visitors).

It installs over the earlier web-wrapper app (same package `org.newstart.expopassport`, same key). Android may show
"Play Protect" warnings for apps not from the store; choose *Install anyway* — the app is signed with your own key.

## Google Play (optional)

The same project builds an `.aab` for the Play Store (`.\gradlew.bat bundleRelease` inside `capacitor/android`).
Publishing needs a Google Play developer account (one-time US$25) and health-app declarations; sideloading the APK
needs none of that.
