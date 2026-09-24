# La Grada content backend

Project: `dxmoseamttracvzydzxs` (La Grada), existing Free organization.

## Content

- `public.lagrada_players`: 30 seeded profiles, with selected historical statistics.
- `public.lagrada_stories`: six seeded stories.
- `display_order` controls ordering and must be unique within each table.
- `published=false` hides drafts from the browser API.
- Edit the `profile`, `historical_stats`, or `story` JSON in the Supabase Table Editor. Preserve its documented keys and the matching record ID.
- Set `updated_at` when editing; it is currently editorial metadata, not a polling mechanism.

The website requests published content when the page opens. Reload to see edits. It validates records and escapes text before rendering. Malformed responses, outages, and timeouts use the bundled historical collection with a visible notice. Bundled fallback content is a historical public snapshot; unpublishing a row does not erase that snapshot. Sensitive data must never be placed in these public-content tables or the bundled files.

The daily game deliberately retains its fixed bundled roster, so profile edits cannot change an in-progress challenge. Favourites and progress remain device-local. This scope does not add user accounts, remote game results, or live football feeds.

## Access

Both tables have row-level security enabled. Anonymous and authenticated website clients have SELECT only, and policies permit only published rows. Editing uses the Supabase dashboard or authorized management access. `dist/supabase-config.js` contains a browser-safe publishable key, never a secret/service-role key.

## Reproduce and verify

The migration filename matches the version recorded by Supabase. The migration was applied remotely via Supabase's migration tool. `seed.sql` imports the existing collection without overwriting matching IDs. Generate it with `node scripts/export-supabase-seed.cjs` after intentional changes to the bundled collection.

Run `access-check.sql` through authorized SQL access to test draft invisibility, published access, and write denial. Its temporary rows and attempted changes are inside a rolled-back transaction.

Only the existing Free project is used; there are no paid branches or additional services. Supabase can pause inactive free projects. Restore it in the dashboard if needed; the site presents its saved collection while the database is unavailable.
