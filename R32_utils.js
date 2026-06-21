(function () {
  function safeString(value) {
    return typeof value === "string" ? value : "";
  }

  function normalizeText(value) {
    return safeString(value).trim();
  }

  function normalizeRound(value) {
    return normalizeText(value).toUpperCase();
  }

  function getStaticR32Matches() {
    return (window.R32matches || [])
      .slice()
      .sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
  }

  function getMatchByNumber(matchNumber) {
    return getStaticR32Matches().find(m => m.matchNumber === matchNumber) || null;
  }

  function getMatchesByRound(round) {
    const target = normalizeRound(round);
    return getStaticR32Matches().filter(m => normalizeRound(m.round) === target);
  }

  function formatKickoffUtc(utc) {
    if (!utc) return "TBD";

    const date = new Date(utc);
    if (Number.isNaN(date.getTime())) return "TBD";

    const hhmm = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);

    return `${hhmm} EDT`;
  }

  function formatShortDate(utc) {
    if (!utc) return "TBD";

    const date = new Date(utc);
    if (Number.isNaN(date.getTime())) return "TBD";

    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric"
    });
  }

  function formatUpdatedAt(utc) {
    if (!utc) return "—";

    const date = new Date(utc);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function formatUpdatedAtEdt(utc) {
    if (!utc) return "—";

    const date = new Date(utc);
    if (Number.isNaN(date.getTime())) return "—";

    const mmdd = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "2-digit",
      day: "2-digit"
    }).format(date);

    const hhmm = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);

    return `${mmdd} ${hhmm} EDT`;
  }

  function getStatusClass(status) {
    const s = normalizeText(status).toLowerCase();

    if (s === "in_play") return "status-in_play";
    if (s === "complete") return "status-complete";
    return "status-scheduled";
  }

  function getStatusText(status) {
    const s = normalizeText(status).toLowerCase();

    if (s === "in_play") return "Live";
    if (s === "complete") return "Final";
    return "Scheduled";
  }

  function isComplete(status) {
    return normalizeText(status).toLowerCase() === "complete";
  }

  function isInPlay(status) {
    return normalizeText(status).toLowerCase() === "in_play";
  }

  function getSnapshotMatch(snapshot, matchNumber) {
    if (!window.R32FetchScores) return null;
    return window.R32FetchScores.getSnapshotMatch(snapshot, matchNumber);
  }

  function getDisplayTeamName(snapshotMatch, slotLabel, side) {
    if (snapshotMatch) {
      const teamName = side === 1 ? snapshotMatch.team1 : snapshotMatch.team2;
      if (teamName) return teamName;
    }
    return slotLabel || "";
  }

  function getDisplayScore(snapshotMatch, side) {
    if (!snapshotMatch) return null;

    const score = side === 1 ? snapshotMatch.score1 : snapshotMatch.score2;
    return Number.isFinite(score) ? score : null;
  }

  function isRealTeamFilled(snapshotMatch, side) {
    if (!snapshotMatch) return false;

    const teamName = side === 1 ? snapshotMatch.team1 : snapshotMatch.team2;
    return !!normalizeText(teamName);
  }

  function isWinner(snapshotMatch, side) {
    if (!snapshotMatch || !snapshotMatch.winner) return false;

    const winner = normalizeText(snapshotMatch.winner);
    const teamName = normalizeText(side === 1 ? snapshotMatch.team1 : snapshotMatch.team2);

    return !!winner && !!teamName && winner === teamName;
  }

  function mergeMatch(staticMatch, snapshotMatch) {
    const live = snapshotMatch || null;

    return {
      ...staticMatch,

      live,

      team1: live?.team1 || null,
      team2: live?.team2 || null,

      displayTeam1: getDisplayTeamName(live, staticMatch.slot1Label, 1),
      displayTeam2: getDisplayTeamName(live, staticMatch.slot2Label, 2),

      score1: getDisplayScore(live, 1),
      score2: getDisplayScore(live, 2),

      status: live?.status || "scheduled",
      winner: live?.winner || null,
      gameTime: live?.gameTime || "",
      player1Name: live?.player1Name || "",
      player2Name: live?.player2Name || "",

      hasRealTeam1: isRealTeamFilled(live, 1),
      hasRealTeam2: isRealTeamFilled(live, 2),

      team1IsWinner: isWinner(live, 1),
      team2IsWinner: isWinner(live, 2)
    };
  }

  function mergeR32Matches(staticMatches, snapshot) {
    return (staticMatches || []).map(match => {
      const live = getSnapshotMatch(snapshot, match.matchNumber);
      return mergeMatch(match, live);
    });
  }

  function buildR32Context(snapshot) {
    const staticMatches = getStaticR32Matches();
    const mergedMatches = mergeR32Matches(staticMatches, snapshot);

    return {
      staticMatches,
      snapshot,
      mergedMatches
    };
  }

  function getMergedMatchByNumber(mergedMatches, matchNumber) {
    return (mergedMatches || []).find(m => m.matchNumber === matchNumber) || null;
  }

  function getMergedMatchesByRound(mergedMatches, round) {
    const target = normalizeRound(round);
    return (mergedMatches || []).filter(m => normalizeRound(m.round) === target);
  }

  function countFilledSlots(mergedMatches) {
    let filled = 0;

    (mergedMatches || []).forEach(match => {
      if (match.hasRealTeam1) filled++;
      if (match.hasRealTeam2) filled++;
    });

    return filled;
  }

  function countOpenSlots(mergedMatches) {
    let open = 0;

    (mergedMatches || []).forEach(match => {
      if (!match.hasRealTeam1) open++;
      if (!match.hasRealTeam2) open++;
    });

    return open;
  }

  function getAllRealTeams(mergedMatches) {
    const set = new Set();

    (mergedMatches || []).forEach(match => {
      if (match.team1) set.add(match.team1);
      if (match.team2) set.add(match.team2);
    });

    return Array.from(set);
  }

  function teamAppearsInMatch(match, teamName) {
    const target = normalizeText(teamName);
    if (!target || !match) return false;

    return normalizeText(match.team1) === target || normalizeText(match.team2) === target;
  }

  function getTeamMatches(mergedMatches, teamName) {
    return (mergedMatches || []).filter(m => teamAppearsInMatch(m, teamName));
  }

  function getLatestTeamMatch(mergedMatches, teamName) {
    const matches = getTeamMatches(mergedMatches, teamName);
    if (!matches.length) return null;

    return matches
      .slice()
      .sort((a, b) => new Date(a.kickoffUtc) - new Date(b.kickoffUtc))
      .slice(-1)[0];
  }

  function didTeamWin(match, teamName) {
    if (!match || !teamName || !isComplete(match.status) || !match.winner) return false;
    return normalizeText(match.winner) === normalizeText(teamName);
  }

  function didTeamLose(match, teamName) {
    if (!match || !teamName || !isComplete(match.status) || !match.winner) return false;
    return normalizeText(match.winner) !== normalizeText(teamName);
  }

  function isTeamAlive(mergedMatches, teamName) {
    const latest = getLatestTeamMatch(mergedMatches, teamName);

    if (!latest) return false;
    if (didTeamLose(latest, teamName)) return false;
    return true;
  }

  function getTeamCurrentRound(mergedMatches, teamName) {
    const latest = getLatestTeamMatch(mergedMatches, teamName);
    return latest?.round || null;
  }

  function renderTopbar({ title = "", actionsHtml = "" } = {}) {
    const topbar = document.getElementById("topbar");
    if (!topbar) return;

    topbar.innerHTML = `
      <div class="r32-topbar-inner">
        <div class="r32-topbar-title">${title}</div>
        <div class="r32-topbar-actions">${actionsHtml}</div>
      </div>
    `;
  }

  function makeButtonHtml({ label, onClick, primary = false, id = "" }) {
    const cls = primary ? "r32-btn r32-btn-primary" : "r32-btn";
    const idAttr = id ? ` id="${id}"` : "";
    const clickAttr = onClick ? ` onclick="${onClick}"` : "";

    return `<button${idAttr} class="${cls}"${clickAttr}>${label}</button>`;
  }

  function installIdleTimeout({
    sessionKey,
    redirectUrl = "index.html",
    idleMs = 20 * 60 * 1000,
    checkMs = 60 * 1000
  }) {
    let lastActivityTime = Date.now();

    function updateActivity() {
      lastActivityTime = Date.now();
    }

    ["click", "mousemove", "keydown", "scroll", "touchstart"].forEach(evt => {
      document.addEventListener(evt, updateActivity, { passive: true });
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        lastActivityTime = Date.now();
      }
    });

    const timer = setInterval(() => {
      const now = Date.now();

      if (now - lastActivityTime > idleMs) {
        try {
          if (sessionKey) {
            localStorage.removeItem(sessionKey);
          }
        } catch (err) {}

        window.location.href = redirectUrl;
      }
    }, checkMs);

    return {
      stop() {
        clearInterval(timer);
      }
    };
  }

  async function loadR32PageContext(db, options = {}) {
    if (!window.R32FetchScores) {
      throw new Error("R32FetchScores is required before calling loadR32PageContext");
    }

    const { snapshot, fetchedAtClientUtc } = await window.R32FetchScores.loadR32Snapshot(db, options);
    const context = buildR32Context(snapshot);

    return {
      ...context,
      fetchedAtClientUtc
    };
  }

  function startR32PageRefresh(config) {
    if (!window.R32FetchScores) {
      throw new Error("R32FetchScores is required before calling startR32PageRefresh");
    }

    const {
      db,
      syncUrl = "",
      refreshMs = 10 * 60 * 1000,
      triggerSyncOnStart = false,
      triggerSyncOnRefresh = false,
      syncPayload = {},
      syncOptions = {},
      onUpdate,
      onError
    } = config || {};

    return window.R32FetchScores.startR32AutoRefresh({
      db,
      syncUrl,
      refreshMs,
      triggerSyncOnStart,
      triggerSyncOnRefresh,
      syncPayload,
      syncOptions,
      onUpdate: async ({ snapshot, fetchedAtClientUtc }) => {
        const context = buildR32Context(snapshot);

        if (typeof onUpdate === "function") {
          await onUpdate({
            ...context,
            fetchedAtClientUtc
          });
        }
      },
      onError
    });
  }

  window.R32Utils = {
    safeString,
    normalizeText,
    normalizeRound,

    getStaticR32Matches,
    getMatchByNumber,
    getMatchesByRound,

    formatKickoffUtc,
    formatShortDate,
    formatUpdatedAt,
    formatUpdatedAtEdt,

    getStatusClass,
    getStatusText,
    isComplete,
    isInPlay,

    getDisplayTeamName,
    getDisplayScore,
    mergeMatch,
    mergeR32Matches,
    buildR32Context,

    getMergedMatchByNumber,
    getMergedMatchesByRound,

    countFilledSlots,
    countOpenSlots,

    getAllRealTeams,
    teamAppearsInMatch,
    getTeamMatches,
    getLatestTeamMatch,
    didTeamWin,
    didTeamLose,
    isTeamAlive,
    getTeamCurrentRound,

    renderTopbar,
    makeButtonHtml,

    installIdleTimeout,

    loadR32PageContext,
    startR32PageRefresh
  };
})();