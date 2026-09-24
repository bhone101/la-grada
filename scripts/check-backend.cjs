const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fixtures = vm.runInNewContext(
  read("dist/data.js") + "\n({PLAYERS,STORIES,HISTORICAL_STATS})",
);
function element() {
  return {
    innerHTML: "",
    textContent: "",
    style: {},
    dataset: {},
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    focus() {},
    scrollIntoView() {},
    remove() {},
    before() {},
    close() {},
    showModal() {},
  };
}
async function boot(fetcher) {
  const main = element(),
    html = element();
  const memory = new Map();
  const doc = {
    documentElement: html,
    querySelector: (s) =>
      s === "#main" ? main : s === "#content-notice" ? null : element(),
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: element,
  };
  const win = { addEventListener() {}, scrollTo() {}, __test: {} };
  const box = {
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: fetcher,
    console,
    document: doc,
    window: win,
    location: { hash: "#home" },
    localStorage: {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => memory.set(k, v),
    },
  };
  vm.createContext(box);
  vm.runInContext(read("dist/data.js"), box);
  vm.runInContext(read("dist/supabase-config.js"), box);
  vm.runInContext(read("dist/content-backend.js"), box);
  await win.LaGradaContent.ready;
  const source = read("dist/app.js").replace(
    /\}\s*\n\}\)\(\);\s*$/,
    "}\nObject.assign(window.__test, {profile, article, playerCard, submitGuess, getPlayer});\n})();",
  );
  await vm.runInContext(source, box);
  return { box, win, main, html };
}
const mock = (change) => async (url) => ({
  ok: true,
  json: async () => {
    const rows = url.includes("lagrada_players")
      ? fixtures.PLAYERS.map((p) => ({
          profile: JSON.parse(JSON.stringify(p)),
          historical_stats: fixtures.HISTORICAL_STATS[p.id] ?? null,
        }))
      : fixtures.STORIES.map((s) => ({ story: JSON.parse(JSON.stringify(s)) }));
    return change ? change(rows, url) : rows;
  },
});
(async () => {
  const live = await boot(fetch);
  assert.equal(live.win.LaGradaContent.source, "supabase");
  assert.equal(vm.runInContext("PLAYERS.length", live.box), 30);
  assert.equal(vm.runInContext("STORIES.length", live.box), 6);
  assert.match(live.main.innerHTML, /Explore all 30 players/);
  console.log(
    "PASS: live Supabase API returns 30 profiles and 6 stories; site renders remote collection.",
  );
  const failed = await boot(async () => {
    throw new Error("offline");
  });
  assert.equal(failed.win.LaGradaContent.source, "bundled");
  assert.equal(vm.runInContext("PLAYERS.length", failed.box), 30);
  console.log("PASS: network failure preserves playable bundled collection.");
  const bad = await boot(
    mock((rows, url) => {
      if (url.includes("lagrada_players"))
        rows[0].profile.source = "javascript:alert(1)";
      return rows;
    }),
  );
  assert.equal(bad.win.LaGradaContent.source, "bundled");
  console.log(
    "PASS: unsafe source URL rejected without partial data replacement.",
  );
  const changed = await boot(
    mock((rows, url) => {
      if (url.includes("lagrada_players"))
        rows[0].profile.name = "<img src=x onerror=alert(1)>";
      return rows;
    }),
  );
  assert.equal(changed.win.LaGradaContent.source, "supabase");
  assert.match(changed.main.innerHTML, /&lt;img/);
  assert.doesNotMatch(changed.main.innerHTML, /<img src=x/);
  const player = changed.win.__test.getPlayer();
  const won = changed.win.__test.submitGuess(player.name);
  assert.equal(won.status, "won");
  console.log(
    "PASS: remote text is escaped; catalogue edits do not change game answers.",
  );
  const empty = await boot(mock(() => []));
  assert.equal(empty.win.LaGradaContent.source, "supabase");
  assert.match(empty.main.innerHTML, /Explore all 0 players/);
  console.log(
    "PASS: empty published collection is respected, not replaced with old records.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
