"use strict";
// Keep the published game's roster stable when editorial content changes.
const GAME_PLAYERS = PLAYERS.slice();
window.LaGradaContent = { source: "loading", error: null };

window.LaGradaContent.ready = (async () => {
  const config = window.LA_GRADA_SUPABASE;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const text = (value, name, max = 20000) => {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw new Error(`Invalid ${name}`);
    return value;
  };
  const id = (value) => {
    if (typeof value !== "string" || !/^[a-z0-9-]+$/.test(value))
      throw new Error("Invalid content id");
    return value;
  };
  const url = (value) => {
    const parsed = new URL(text(value, "source URL", 2048));
    if (parsed.protocol !== "https:" || parsed.username || parsed.password)
      throw new Error("Invalid source URL");
    return parsed.href;
  };
  const strings = (value, name) => {
    if (!Array.isArray(value) || value.length > 100)
      throw new Error(`Invalid ${name}`);
    return value.map((v) => text(v, name));
  };
  const profile = (p) => {
    if (!p || typeof p !== "object") throw new Error("Invalid player");
    const result = {
      id: id(p.id),
      source: url(p.source),
      aliases: strings(p.aliases, "aliases"),
    };
    for (const key of [
      "name",
      "nation",
      "position",
      "club",
      "years",
      "origin",
      "fact",
      "initials",
    ])
      result[key] = text(p[key], key, 2000);
    if (!Number.isInteger(p.joined) || p.joined < 1800 || p.joined > 2200)
      throw new Error("Invalid year");
    result.joined = p.joined;
    result.color = ["", "blue", "purple", "orange"].includes(p.color)
      ? p.color
      : "";
    return result;
  };
  const stats = (s) => {
    if (s === null) return null;
    if (!s || !Array.isArray(s.values) || s.values.length > 20)
      throw new Error("Invalid statistics");
    return {
      scope: text(s.scope, "statistics scope"),
      source: url(s.source),
      values: s.values.map((pair) => {
        if (!Array.isArray(pair) || pair.length !== 2)
          throw new Error("Invalid statistic");
        return pair.map((v) => text(v, "statistic", 200));
      }),
    };
  };
  const story = (s) => {
    if (!s || typeof s !== "object") throw new Error("Invalid story");
    const result = {
      id: id(s.id),
      source: url(s.source),
      paragraphs: strings(s.paragraphs, "paragraphs"),
    };
    for (const key of [
      "category",
      "title",
      "subtitle",
      "read",
      "year",
      "sourceName",
    ])
      result[key] = text(s[key], key, 2000);
    if (!Array.isArray(s.related) || s.related.length > 30)
      throw new Error("Invalid related players");
    result.related = s.related.map(id);
    if (s.extraSource) result.extraSource = url(s.extraSource);
    return result;
  };
  try {
    if (
      !config ||
      !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey)
    )
      throw new Error("Missing publishable key");
    const origin = new URL(config.url);
    if (
      origin.protocol !== "https:" ||
      !origin.hostname.endsWith(".supabase.co") ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    )
      throw new Error("Invalid Supabase URL");
    async function load(table, columns) {
      const response = await fetch(
        `${origin.origin}/rest/v1/${table}?select=${columns}&published=eq.true&order=display_order.asc&limit=1000`,
        {
          headers: {
            apikey: config.publishableKey,
            Accept: "application/json",
          },
          signal: controller.signal,
          cache: "no-store",
        },
      );
      if (!response.ok)
        throw new Error(`Content request failed (${response.status})`);
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length >= 1000)
        throw new Error("Invalid or oversized collection");
      return rows;
    }
    const [playerRows, storyRows] = await Promise.all([
      load("lagrada_players", "profile,historical_stats"),
      load("lagrada_stories", "story"),
    ]);
    // Validate the entire response before replacing either collection.
    const players = playerRows.map((row) => profile(row.profile));
    const historical = {};
    playerRows.forEach((row, i) => {
      const value = stats(row.historical_stats);
      if (value) historical[players[i].id] = value;
    });
    const stories = storyRows.map((row) => story(row.story));
    if (
      new Set(players.map((p) => p.id)).size !== players.length ||
      new Set(stories.map((s) => s.id)).size !== stories.length
    )
      throw new Error("Duplicate content IDs");
    const playerIds = new Set(players.map((p) => p.id));
    stories.forEach(
      (s) => (s.related = s.related.filter((id) => playerIds.has(id))),
    );
    PLAYERS.splice(0, PLAYERS.length, ...players);
    STORIES.splice(0, STORIES.length, ...stories);
    Object.keys(HISTORICAL_STATS).forEach(
      (key) => delete HISTORICAL_STATS[key],
    );
    Object.assign(HISTORICAL_STATS, historical);
    window.LaGradaContent.source = "supabase";
  } catch (error) {
    // The bundled historical collection remains available if the free project
    // is paused, the network is unavailable, or a content record is malformed.
    controller.abort();
    window.LaGradaContent.source = "bundled";
    window.LaGradaContent.error =
      error.name === "AbortError" ? "timeout" : "unavailable";
  } finally {
    clearTimeout(timeout);
    document.documentElement.dataset.contentSource =
      window.LaGradaContent.source;
  }
})();
