# Put the app on phones

The app is a **PWA**: once it is on a web address, each volunteer opens it on their phone and taps *Install* (Android) or
*Add to Home Screen* (iPhone). It gets its own icon, opens full-screen with no browser bar, can use the camera to scan
badges, and **opens even with no signal** (changes queue on the phone and upload when it reconnects). There is nothing
to download from an app store.

## 1. Build the upload folder

```bash
node tools/build.js
```

This creates `dist/` containing exactly what a host needs: `index.html`, `manifest.webmanifest`, `sw.js`, `icons/` and
`_headers`. Run it again after every change to the app, then upload the new `dist/`.

(To redraw the icons: `node tools/make-icons.js`.)

## 2. Host `dist/` over https

Phones only allow installing, offline mode and the camera on a secure (https) address. Any of these is free and takes a
few minutes — pick one:

**Cloudflare Pages** (recommended): dash.cloudflare.com → Workers & Pages → Create → Pages → *Upload assets* → drag the
`dist` folder in → Deploy. You get an address like `https://newstart-expo.pages.dev`.

**Netlify**: app.netlify.com/drop → drag the `dist` folder onto the page.

**GitHub Pages**: put the *contents* of `dist/` in a repository and turn on Pages for it.

You do **not** need Cloudflare's other products for this app: the database is Supabase, and a page this small is served
from any host without trouble, including 1,000+ people over a weekend.

## 3. Tell Supabase the new address

Supabase dashboard → Authentication → URL Configuration:

- **Site URL** = your address, e.g. `https://newstart-expo.pages.dev/`
- **Redirect URLs** = add the same address

Without this the links in the sign-up and reset-password emails point to the wrong place. See `supabase/README.md` for
the rest of the Supabase settings (email sending, approving staff).

## 4. Install it on each phone

**Android (Chrome):** open the address → sign in → tap the logo, then **Install the app on this phone** (or Chrome's
menu → *Install app*).

**iPhone (must be Safari):** open the address → tap the **Share** button → **Add to Home Screen** → Add.

Open it once **with Wi-Fi/data on** after installing — that is when the phone saves the app for offline use. After
that it launches without a connection.

## Updating the app later

Upload the new `dist/`. Phones pick the new version up the next time they open the app with a connection (the old
version keeps working offline until then). Signed-in phones stay signed in.

## Things to know

- **Same address for everyone.** Installing from a different address creates a separate copy with its own saved data.
- **On iPhone, install it to the Home Screen.** Safari deletes a website's saved data after 7 days of not opening it, but
  an app added to the Home Screen is exempt. Either way, make sure every phone is back online with a green dot at the end
  of each day so nothing is left un-uploaded.
- **Sending a report** opens WhatsApp with the message ready; the volunteer taps Send inside WhatsApp (the app cannot
  send on its own). Phone numbers saved like `082 123 4567` are converted to `+27` automatically.
- The sign-in screen and everything behind it need the database to sync; offline, a phone that was already signed in
  keeps working from its saved copy.
