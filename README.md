# La Grada

A football clubhouse for exploring Spanish football: discover memorable players, follow the stories connecting them, and test your knowledge with a daily guessing game.

## Features

- **Daily player challenge:** identify a player through up to six clues, with practice rounds available.
- **Player collection:** 30 historical profiles, selected career statistics, club filters, and search.
- **Football stories:** six connected stories from the Spanish game, with links to related players.
- **Personal collection:** save favourites and a preferred club; progress stays in your browser.
- **Responsive design:** spacious layouts, bold typography, and interactive navigation and buttons.
- **Content backend:** published profiles and stories load from Supabase, with bundled content available if the connection fails.

The collection describes historical careers and featured club spells. It is not a live squad, matchday, or market-value service.

## Run locally

Requirements: Python 3 for the preview server. Node.js 18 or newer is needed for the maintenance and verification scripts.

```sh
git clone https://github.com/bhone101/la-grada.git
cd la-grada
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:4173 in your browser. No package installation or build step is required.

## Project structure

```text
dist/                 Website files, served directly
  index.html          Page shell
  style.css           Responsive styles and interactions
  app.js              Navigation, game, search, and profile rendering
  data.js             Bundled historical collection
  content-backend.js  Content loading, validation, and fallback
  supabase-config.js  Public browser connection settings
scripts/              Content export and verification utilities
supabase/             Database migration, seed data, and access checks
```

## Content and backend

The frontend uses plain HTML, CSS, and JavaScript. Supabase supplies published player profiles and stories; the guessing game keeps a fixed bundled roster so editorial changes do not alter an ongoing round.

See [the backend guide](supabase/README.md) for the schema, content workflow, and access model. For a separate installation, apply the migration and seed to your own project, then update `dist/supabase-config.js` with its URL and publishable key. Never put a secret or service-role key in browser code.

Favourites and game progress use browser storage. There are no user accounts or cross-device syncing.

## Verification

```sh
node scripts/check-backend.cjs
```

This checks live published content as well as fallback and rendering behaviour. It needs network access and a configured, available backend for the live checks.

After intentionally updating the bundled collection, regenerate the database seed:

```sh
node scripts/export-supabase-seed.cjs
```

Database access checks are provided in `supabase/access-check.sql`. Read the backend guide before running them.

## Hosting

Serve `dist/` using any static web host. Navigation uses URL fragments, so server-side route rewrites are not required. The website needs no application server or build service. External fonts, archival imagery, and remote content require network access; the bundled collection provides a fallback for remote content failures.

## Sources and credits

Player profiles and stories include source links. The website’s **Sources & about** panel contains additional attribution, including the Camp Nou archival photograph by Javierito92 via Wikimedia Commons, licensed under CC BY 3.0. Barlow Condensed and DM Sans are loaded through Google Fonts. Third-party assets retain their respective licenses.
