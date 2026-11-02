# vendor/

Copies the app and the web site load (v1.6.2: the site no longer uses CDNs; the CSP allows only same-origin scripts, styles and fonts).
`tools/build-app.js` refuses to build the app if any library here differs from the integrity hash (SRI) pinned in
`index.html`.

| File | Source | License |
| --- | --- | --- |
| `supabase.min.js` | https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.min.js (sha384-UagCvVPT5XXA0Hx+nJYUAGBFseHT9zBgpJMSebsAxl9lciTwbT+39j5VfRjdP5Tp) | MIT |
| `fonts.css`, `fonts/*.woff2` | Google Fonts: Inter and Plus Jakarta Sans, latin and latin-ext subsets, from the same CSS URL `index.html` uses | SIL Open Font License 1.1 |

To change a library version: change its hash in `src/cloud.js` (see the comment above `SRI`), download the
new file here under the same name, and run `node tools/build-app.js`.
