/* =========================================================
   R32_fetchScores.js
   Knockout-stage-only data loading / refresh helpers
   Client-side scoreboard sync only
   No dependency on fetchScores.js or utils.js
========================================================= */
(function () {
  const DEFAULT_REFRESH_MS = 10 * 60 * 1000;
  const SNAPSHOT_COLLECTION = "__live";
  const SNAPSHOT_DOC_ID = "knockoutBracket";
  const SCOREBOARD_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
  const SYNC_THROTTLE_KEY = "r32_knockout_sync_last_attempt_utc";

  function toIsoNow() {
    return new Date().toISOString();
  }

  function safeNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function safeString(value) {
    return typeof value === "string" ? value : null;
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeKey(value) {
    return normalizeText(value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function normalizeMatchStatus(status) {
    const s = String(status || "").trim().toLowerCase();
    if (s === "in_play") return "in_play";
    if (s === "complete") return "complete";
    return "scheduled";
  }

  function normalizeSnapshotMatch(raw) {
    const data = raw || {};
    return {
      team1: safeString(data.team1),
      team2: safeString(data.team2),
      score1: safeNumber(data.score1),
      score2: safeNumber(data.score2),
      status: normalizeMatchStatus(data.status),
      winner: safeString(data.winner),
      gameTime: safeString(data.gameTime),
      updatedAtUtc: safeString(data.updatedAtUtc),
      player1Name: safeString(data.player1Name),
      player2Name: safeString(data.player2Name)
    };
  }

  function normalizeKnockoutSnapshot(raw) {
    const data = raw || {};
    const rawMatches = data.matches || {};
    const matches = {};

    Object.keys(rawMatches).forEach(function (key) {
      matches[String(key)] = normalizeSnapshotMatch(rawMatches[key]);
    });

    return {
      source: safeString(data.source),
      updatedAtUtc: safeString(data.updatedAtUtc),
      fetchedAtUtc: safeString(data.fetchedAtUtc),
      status: safeString(data.status) || "ok",
      matches: matches
    };
  }

  async function loadKnockoutSnapshot(db) {
    if (!db) throw new Error("loadKnockoutSnapshot: db is required");

    const snap = await db.collection(SNAPSHOT_COLLECTION).doc(SNAPSHOT_DOC_ID).get();
    if (!snap.exists) return normalizeKnockoutSnapshot({});

    return normalizeKnockoutSnapshot(snap.data());
  }

  function getSnapshotMatch(snapshot, matchNumber) {
    if (!snapshot || !snapshot.matches) return null;
    return snapshot.matches[String(matchNumber)] || null;
  }

  function shouldTriggerSync(options) {
    const opts = options || {};
    const minGapMs = opts.minGapMs || 30 * 1000;

    try {
      const last = Number(localStorage.getItem(SYNC_THROTTLE_KEY) || "0");
      const now = Date.now();

      if (!last || now - last >= minGapMs) {
        localStorage.setItem(SYNC_THROTTLE_KEY, String(now));
        return true;
      }

      return false;
    } catch (err) {
      return true;
    }
  }

  async function requestKnockoutSync(syncUrl, payload, options) {
    const opts = options || {};
    const minGapMs = opts.minGapMs || 30 * 1000;
    const force = opts.force === true;
    const bodyPayload = payload || {};

    if (!syncUrl) return null;

    if (!force && !shouldTriggerSync({ minGapMs: minGapMs })) {
      return { skipped: true, reason: "throttled" };
    }

    const res = await fetch(syncUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ requestedAtUtc: toIsoNow() }, bodyPayload))
    });

    if (!res.ok) throw new Error("requestKnockoutSync failed: " + res.status);

    try {
      return await res.json();
    } catch (err) {
      return { ok: true };
    }
  }

  function getServerTimestampValue() {
    try {
      if (window.firebase && firebase.firestore && firebase.firestore.FieldValue) {
        return firebase.firestore.FieldValue.serverTimestamp();
      }
    } catch (err) {}

    return toIsoNow();
  }

  function getStaticMatches() {
    return Array.isArray(window.R32matches) ? window.R32matches.slice() : [];
  }

  function toDateKey(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return String(y) + m + d;
  }

  function getCandidateDateKeys(kickoffUtc) {
    if (!kickoffUtc) return [];

    const kickoff = new Date(kickoffUtc);
    if (Number.isNaN(kickoff.getTime())) return [];

    const sameDay = new Date(kickoff);
    const prevDay = new Date(kickoff);
    prevDay.setUTCDate(prevDay.getUTCDate() - 1);

    return [toDateKey(sameDay), toDateKey(prevDay)];
  }

  async function fetchScoreboardByDate(dateKey) {
    const url = SCOREBOARD_BASE_URL + "?dates=" + encodeURIComponent(dateKey);
    const res = await fetch(url);

    if (!res.ok) throw new Error("fetchScoreboardByDate failed: " + res.status);

    const data = await res.json();
    return Array.isArray(data && data.events) ? data.events : [];
  }

  async function fetchScoreboardEventsForMatch(match) {
    const dateKeys = getCandidateDateKeys(match && match.kickoffUtc);

    for (let i = 0; i < dateKeys.length; i++) {
      const dateKey = dateKeys[i];

      try {
        const events = await fetchScoreboardByDate(dateKey);
        if (events.length) return events;
      } catch (err) {
        console.error("fetchScoreboardEventsForMatch failed for " + (match && match.matchNumber) + ":", err);
      }
    }

    return [];
  }

  function findEventByKickoff(events, match) {
    const target = String((match && match.kickoffUtc) || "");
    if (!target) return null;

    const targetMs = new Date(target).getTime();
    if (!Number.isFinite(targetMs)) return null;

    for (let i = 0; i < (events || []).length; i++) {
      const event = events[i];
      const comp = event && Array.isArray(event.competitions) ? event.competitions[0] : null;
      const eventUtc = String((comp && comp.date) || event.date || "");
      if (!eventUtc) continue;

      const eventMs = new Date(eventUtc).getTime();
      if (Number.isFinite(eventMs) && eventMs === targetMs) return event;
    }

    return null;
  }

  function isPlaceholderLike(value) {
    const raw = normalizeText(value).toUpperCase();

    if (!raw) return true;
    if (raw === "TBD") return true;
    if (/^(1|2)[A-L]$/.test(raw)) return true;
    if (/^3RD\b/.test(raw)) return true;
    if (/^RD32\b/.test(raw)) return true;
    if (/^RD16\b/.test(raw)) return true;
    if (/^QF\b/.test(raw)) return true;
    if (/^SF\b/.test(raw)) return true;
    if (/^(W|L)\d+$/.test(raw)) return true;

    return false;
  }

  function canonicalizeTeamName(value) {
    const raw = normalizeText(value);
    if (!raw) return null;
    if (isPlaceholderLike(raw)) return null;

    const key = normalizeKey(raw);
    const source = window.teams;

    if (source) {
      if (Array.isArray(source)) {
        for (let i = 0; i < source.length; i++) {
          const team = source[i];
          if (!team) continue;

          const canonical = normalizeText(team.name || team.fullName || team.teamName);
          const aliases = [canonical, team.shortName, team.abbreviation, team.code, team.espn]
            .map(normalizeText)
            .filter(Boolean);

          if (aliases.some(function (alias) { return normalizeKey(alias) === key; })) {
            return canonical || raw;
          }
        }
      } else if (typeof source === "object") {
        const teamKeys = Object.keys(source);

        for (let i = 0; i < teamKeys.length; i++) {
          const teamKey = teamKeys[i];
          const team = source[teamKey];
          if (!team) continue;

          if (typeof team === "string") {
            if (normalizeKey(team) === key || normalizeKey(teamKey) === key) return team;
            continue;
          }

          const canonical = normalizeText(team.name || team.fullName || team.teamName || teamKey);
          const aliases = [canonical, team.shortName, team.abbreviation, team.code, team.espn, teamKey]
            .map(normalizeText)
            .filter(Boolean);

          if (aliases.some(function (alias) { return normalizeKey(alias) === key; })) {
            return canonical || raw;
          }
        }
      }
    }

    if (key === normalizeKey("South Korea") || key === normalizeKey("Republic of Korea")) return "Korea Republic";
    if (key === normalizeKey("United States") || key === normalizeKey("United States of America")) return "USA";

    return raw;
  }

  function getCompetitorsFromEvent(event) {
    const comp = event && Array.isArray(event.competitions) ? event.competitions[0] : null;
    return comp && Array.isArray(comp.competitors) ? comp.competitors : [];
  }

  function orderCompetitors(competitors) {
    if (!Array.isArray(competitors) || competitors.length < 2) return competitors || [];

    const home = competitors.find(function (c) {
      return String((c && c.homeAway) || "").toLowerCase() === "home";
    });

    const away = competitors.find(function (c) {
      return String((c && c.homeAway) || "").toLowerCase() === "away";
    });

    if (home && away) return [home, away];
    return competitors.slice(0, 2);
  }

  function getCompetitorCanonicalName(competitor) {
    return canonicalizeTeamName(
      competitor &&
      competitor.team &&
      (competitor.team.displayName || competitor.team.shortDisplayName || competitor.team.name)
    );
  }

  function mapEspnStatus(event) {
    const comp = event && Array.isArray(event.competitions) ? event.competitions[0] : null;
    const state = String((comp && comp.status && comp.status.type && comp.status.type.state) || "").toLowerCase();

    if (state === "post") return "complete";
    if (state === "in") return "in_play";

    return "scheduled";
  }

  function getEspnGameTime(event) {
    const comp = event && Array.isArray(event.competitions) ? event.competitions[0] : null;
    const status = comp && comp.status;

    if (!status || !status.type) return "";

    const state = String(status.type.state || "").toLowerCase();

    if (state === "in") {
      return safeString(status.displayClock) || safeString(status.type.shortDetail) || safeString(status.type.detail) || "";
    }

    return safeString(status.type.shortDetail) || safeString(status.type.detail) || "";
  }

  function chooseWinnerNameFromSides(side1, side2, side1Name, side2Name) {
    if (!side1 || !side2) return null;

    if (side1.winner) return side1Name || getCompetitorCanonicalName(side1);
    if (side2.winner) return side2Name || getCompetitorCanonicalName(side2);

    const s1 = Number(side1.score);
    const s2 = Number(side2.score);

    if (Number.isFinite(s1) && Number.isFinite(s2)) {
      if (s1 > s2) return side1Name || getCompetitorCanonicalName(side1);
      if (s2 > s1) return side2Name || getCompetitorCanonicalName(side2);
    }

    return null;
  }

  function extractEventDataForMatch(event, snapshotMatch) {
    const ordered = orderCompetitors(getCompetitorsFromEvent(event));
    if (ordered.length < 2) return null;

    const currentTeam1 = canonicalizeTeamName(snapshotMatch && snapshotMatch.team1);
    const currentTeam2 = canonicalizeTeamName(snapshotMatch && snapshotMatch.team2);

    let side1 = ordered[0];
    let side2 = ordered[1];

    const orderedNames = ordered.map(getCompetitorCanonicalName);

    if (currentTeam1 || currentTeam2) {
      const idx1 = currentTeam1
        ? orderedNames.findIndex(function (n) { return normalizeKey(n) === normalizeKey(currentTeam1); })
        : -1;

      const idx2 = currentTeam2
        ? orderedNames.findIndex(function (n) { return normalizeKey(n) === normalizeKey(currentTeam2); })
        : -1;

      if (idx1 === 1 && idx2 !== 0) {
        side1 = ordered[1];
        side2 = ordered[0];
      } else if (idx2 === 0 && idx1 !== 1) {
        side1 = ordered[1];
        side2 = ordered[0];
      }
    }

    const team1 = getCompetitorCanonicalName(side1);
    const team2 = getCompetitorCanonicalName(side2);
    const score1 = Number.isFinite(Number(side1 && side1.score)) ? Number(side1.score) : null;
    const score2 = Number.isFinite(Number(side2 && side2.score)) ? Number(side2.score) : null;
    const status = mapEspnStatus(event);
    const gameTime = getEspnGameTime(event);
    const winner = chooseWinnerNameFromSides(side1, side2, team1, team2);

    return {
      team1: team1,
      team2: team2,
      score1: score1,
      score2: score2,
      status: status,
      gameTime: gameTime,
      winner: winner
    };
  }

  function shouldFetchScore(match, snapshotMatch, nowUtcMs) {
    const kickoff = new Date(match.kickoffUtc).getTime();

    if (!Number.isFinite(kickoff)) return false;
    if (nowUtcMs < kickoff) return false;

    if (
      snapshotMatch &&
      snapshotMatch.status === "complete" &&
      snapshotMatch.score1 != null &&
      snapshotMatch.score2 != null
    ) {
      return false;
    }

    return true;
  }

  async function fetchEventDataForMatch(match, snapshotMatch, nowUtcMs) {
    const shouldFetch = shouldFetchScore(match, snapshotMatch, nowUtcMs);

    if (!shouldFetch) return null;

    const events = await fetchScoreboardEventsForMatch(match);
    if (!events.length) return null;

    const event = findEventByKickoff(events, match);
    if (!event) return null;

    return extractEventDataForMatch(event, snapshotMatch);
  }

  function buildMatchPatch(snapshotMatch, espnData, nowIso) {
    if (!espnData) return null;

    const current = snapshotMatch || {};
    const patch = {};

    if (!current.team1 && espnData.team1) patch.team1 = espnData.team1;
    if (!current.team2 && espnData.team2) patch.team2 = espnData.team2;

    if (espnData.status && espnData.status !== "scheduled") {
      if (espnData.score1 !== null && espnData.score1 !== current.score1) patch.score1 = espnData.score1;
      if (espnData.score2 !== null && espnData.score2 !== current.score2) patch.score2 = espnData.score2;
      if (espnData.status !== current.status) patch.status = espnData.status;
      if (espnData.winner && espnData.winner !== current.winner) patch.winner = espnData.winner;
      if (espnData.gameTime && espnData.gameTime !== current.gameTime) patch.gameTime = espnData.gameTime;
    }

    if (!Object.keys(patch).length) return null;

    patch.updatedAtUtc = nowIso;
    return patch;
  }

  function applyNestedMatchPatch(updates, matchNumber, patch) {
    if (!updates.matches || typeof updates.matches !== "object") {
      updates.matches = {};
    }

    const key = String(matchNumber);

    if (!updates.matches[key] || typeof updates.matches[key] !== "object") {
      updates.matches[key] = {};
    }

    Object.keys(patch || {}).forEach(function (field) {
      updates.matches[key][field] = patch[field];
    });
  }

  async function syncKnockoutSnapshotClient(db, options) {
    if (!db) throw new Error("syncKnockoutSnapshotClient: db is required");

    const opts = options || {};
    const staticMatches = opts.staticMatches || getStaticMatches();
    const snapshot = await loadKnockoutSnapshot(db);
    const nowIso = toIsoNow();
    const nowUtcMs = Date.now();

    const updates = {
      source: "ESPN",
      status: "ok",
      fetchedAtUtc: nowIso,
      updatedAtUtc: getServerTimestampValue(),
      matches: {}
    };

    let changedMatchCount = 0;

    for (let i = 0; i < staticMatches.length; i++) {
      const match = staticMatches[i];
      const matchNumber = String(match.matchNumber);
      const snapshotMatch = getSnapshotMatch(snapshot, matchNumber) || null;

      try {
        const espnData = await fetchEventDataForMatch(match, snapshotMatch, nowUtcMs);
        const patch = buildMatchPatch(snapshotMatch, espnData, nowIso);

        if (!patch) continue;

        applyNestedMatchPatch(updates, matchNumber, patch);
        changedMatchCount += 1;
      } catch (err) {
        console.error("syncKnockoutSnapshotClient match " + matchNumber + " error:", err);
      }
    }

    if (changedMatchCount > 0) {
      console.log("[R32FetchScores] Writing nested match updates", updates);
      await db.collection(SNAPSHOT_COLLECTION).doc(SNAPSHOT_DOC_ID).set(updates, { merge: true });
    }

    return {
      ok: true,
      changedMatchCount: changedMatchCount,
      fetchedAtClientUtc: toIsoNow()
    };
  }

  async function loadR32Snapshot(db, options) {
    const opts = options || {};
    const syncUrl = opts.syncUrl || "";
    const triggerSyncFirst = opts.triggerSyncFirst === true;
    const syncPayload = opts.syncPayload || {};
    const syncOptions = opts.syncOptions || {};

    if (triggerSyncFirst) {
      try {
        if (syncUrl) {
          await requestKnockoutSync(syncUrl, syncPayload, syncOptions);
        } else {
          await syncKnockoutSnapshotClient(db, { staticMatches: getStaticMatches() });
        }
      } catch (err) {
        console.error("loadR32Snapshot sync trigger failed:", err);
      }
    }

    const snapshot = await loadKnockoutSnapshot(db);

    return {
      snapshot: snapshot,
      fetchedAtClientUtc: toIsoNow()
    };
  }

  function startR32AutoRefresh(config) {
    const cfg = config || {};
    const db = cfg.db;
    const syncUrl = cfg.syncUrl || "";
    const refreshMs = cfg.refreshMs || DEFAULT_REFRESH_MS;
    const triggerSyncOnStart = cfg.triggerSyncOnStart === true;
    const triggerSyncOnRefresh = cfg.triggerSyncOnRefresh === true;
    const syncPayload = cfg.syncPayload || {};
    const syncOptions = cfg.syncOptions || {};
    const onUpdate = cfg.onUpdate;
    const onError = cfg.onError;

    if (!db) throw new Error("startR32AutoRefresh: db is required");

    let timer = null;
    let stopped = false;

    async function refresh(runOptions) {
      const opts = runOptions || {};

      if (stopped) return null;

      const useSync =
        opts.forceSync === true ||
        (!!syncUrl && ((opts.isInitial && triggerSyncOnStart) || (!opts.isInitial && triggerSyncOnRefresh))) ||
        (!syncUrl && ((opts.isInitial && triggerSyncOnStart) || (!opts.isInitial && triggerSyncOnRefresh)));

      try {
        const result = await loadR32Snapshot(db, {
          syncUrl: syncUrl,
          triggerSyncFirst: useSync,
          syncPayload: syncPayload,
          syncOptions: syncOptions
        });

        if (typeof onUpdate === "function") await onUpdate(result);

        return result;
      } catch (err) {
        console.error("startR32AutoRefresh refresh error:", err);
        if (typeof onError === "function") onError(err);
        throw err;
      }
    }

    refresh({ isInitial: true }).catch(function () {});

    timer = setInterval(function () {
      refresh({ isInitial: false }).catch(function () {});
    }, refreshMs);

    return {
      stop: function () {
        stopped = true;
        if (timer) clearInterval(timer);
      },
      refreshNow: async function (forceSync) {
        return refresh({ isInitial: false, forceSync: forceSync === true });
      }
    };
  }

  window.R32FetchScores = {
    DEFAULT_REFRESH_MS: DEFAULT_REFRESH_MS,
    SNAPSHOT_COLLECTION: SNAPSHOT_COLLECTION,
    SNAPSHOT_DOC_ID: SNAPSHOT_DOC_ID,
    SCOREBOARD_BASE_URL: SCOREBOARD_BASE_URL,
    normalizeSnapshotMatch: normalizeSnapshotMatch,
    normalizeKnockoutSnapshot: normalizeKnockoutSnapshot,
    loadKnockoutSnapshot: loadKnockoutSnapshot,
    getSnapshotMatch: getSnapshotMatch,
    shouldTriggerSync: shouldTriggerSync,
    requestKnockoutSync: requestKnockoutSync,
    syncKnockoutSnapshotClient: syncKnockoutSnapshotClient,
    loadR32Snapshot: loadR32Snapshot,
    startR32AutoRefresh: startR32AutoRefresh
  };
})();
