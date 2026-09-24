// Export only the existing public football content. No credentials required.
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const content = vm.runInNewContext(
  fs.readFileSync(path.join(root, "dist/data.js"), "utf8") +
    "\n({PLAYERS, STORIES, HISTORICAL_STATS})",
);
const sqlString = (value) => "'" + String(value).replace(/'/g, "''") + "'";
const json = (value) => sqlString(JSON.stringify(value)) + "::jsonb";
const rows = [
  "-- Generated from the current La Grada historical collection.",
  "-- Existing rows are preserved: rerunning this seed never overwrites edits.",
  "begin;",
];
content.PLAYERS.forEach((player, index) =>
  rows.push(
    `insert into public.lagrada_players (id, display_order, profile, historical_stats, published) values (${sqlString(player.id)}, ${index}, ${json(player)}, ${content.HISTORICAL_STATS[player.id] ? json(content.HISTORICAL_STATS[player.id]) : "null"}, true) on conflict (id) do nothing;`,
  ),
);
content.STORIES.forEach((story, index) =>
  rows.push(
    `insert into public.lagrada_stories (id, display_order, story, published) values (${sqlString(story.id)}, ${index}, ${json(story)}, true) on conflict (id) do nothing;`,
  ),
);
rows.push("commit;");
fs.writeFileSync(path.join(root, "supabase/seed.sql"), rows.join("\n") + "\n");
console.log(
  `Prepared ${content.PLAYERS.length} players and ${content.STORIES.length} stories. No database was contacted.`,
);
