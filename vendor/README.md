# vendor/

Copies the Android app carries so it works with no internet. The web site still loads the same files from their CDNs.
`tools/build-app.js` refuses to build the app if any library here differs from the integrity hash (SRI) pinned in
`index.html`.

| File | Source | License |
| --- | --- | --- |
| `supabase.min.js` | https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js | MIT |
| `fonts.css`, `fonts/*.woff2` | Google Fonts: Inter and Plus Jakarta Sans, latin and latin-ext subsets, from the same CSS URL `index.html` uses | SIL Open Font License 1.1 |

To change a library version: change its address and hash in `index.html` (see the comment above `SRI`), download the
new file here under the same name, and run `node tools/build-app.js`.
