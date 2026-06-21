/* =========================================================
   R32_fetchScores.js
   Knockout-stage-only data loading / refresh helpers
   No dependency on fetchScores.js or utils.js
========================================================= */

(function () {
  const DEFAULT_REFRESH_MS = 10 * 60 * 1000;

  // Firestore doc that stores the latest normalized knockout snapshot
  const SNAPSHOT_COLLECTION = "__live";
  const SNAPSHOT_DOC_ID = "knockoutBracket";

  // Local throttle key for optional sync trigger
  const SYNC_THROTTLE_KEY = "r32_knockout_sync_last_attempt_utc";

  function toIsoNow() {
    return new Date().toISOString();
  }

  function safeNumber(value) {
    return Number.isFinite(value) ? value : null;
  }

  function safeString(value) {
    return typeof value === "string" ? value : null;
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
      updatedAtUtc: safeString(data.updatedAtUtc)
    };
  }

  function normalizeKnockoutSnapshot(raw) {
    const data = raw || {};
    const rawMatches = data.matches || {};
    const matches = {};

    Object.keys(rawMatches).forEach(key => {
      matches[String(key)] = normalizeSnapshotMatch(rawMatches[key]);
    });

    return {
      source: safeString(data.source),
      updatedAtUtc: safeString(data.updatedAtUtc),
      fetchedAtUtc: safeString(data.fetchedAtUtc),
      status: safeString(data.status) || "ok",
      matches
    };
  }

  async function loadKnockoutSnapshot(db) {
    if (!db) {
      throw new Error("loadKnockoutSnapshot: db is required");
    }

    const snap = await db.collection(SNAPSHOT_COLLECTION).doc(SNAPSHOT_DOC_ID).get();

    if (!snap.exists) {
      return normalizeKnockoutSnapshot({});
    }

    return normalizeKnockoutSnapshot(snap.data());
  }

  function getSnapshotMatch(snapshot, matchNumber) {
    if (!snapshot || !snapshot.matches) return null;
    return snapshot.matches[String(matchNumber)] || null;
  }

  function shouldTriggerSync({ minGapMs = 30 * 1000 } = {}) {
    try {
      const last = Number(localStorage.getItem(SYNC_THROTTLE_KEY) || "0");
      const now = Date.now();

      if (!last || now - last >= minGapMs) {
        localStorage.setItem(SYNC_THROTTLE_KEY, String(now));
        return true;
      }

      return false;
    } catch (err) {
      // If localStorage fails for any reason, do not block sync.
      return true;
    }
  }

  async function requestKnockoutSync(syncUrl, payload = {}, options = {}) {
    const {
      minGapMs = 30 * 1000,
      force = false
    } = options || {};

    if (!syncUrl) return null;

    if (!force && !shouldTriggerSync({ minGapMs })) {
      return {
        skipped: true,
        reason: "throttled"
      };
    }

    const res = await fetch(syncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requestedAtUtc: toIsoNow(),
        ...payload
      })
    });

    if (!res.ok) {
      throw new Error(`requestKnockoutSync failed: ${res.status}`);
    }

    try {
      return await res.json();
    } catch (err) {
      return { ok: true };
    }
  }

  async function loadR32Snapshot(db, options = {}) {
    const {
      syncUrl = "",
      triggerSyncFirst = false,
      syncPayload = {},
      syncOptions = {}
    } = options || {};

    if (triggerSyncFirst && syncUrl) {
      try {
        await requestKnockoutSync(syncUrl, syncPayload, syncOptions);
      } catch (err) {
        console.error("loadR32Snapshot sync trigger failed:", err);
      }
    }

    const snapshot = await loadKnockoutSnapshot(db);

    return {
      snapshot,
      fetchedAtClientUtc: toIsoNow()
    };
  }

  function startR32AutoRefresh(config) {
    const {
      db,
      syncUrl = "",
      refreshMs = DEFAULT_REFRESH_MS,
      triggerSyncOnStart = false,
      triggerSyncOnRefresh = false,
      syncPayload = {},
      syncOptions = {},
      onUpdate,
      onError
    } = config || {};

    if (!db) {
      throw new Error("startR32AutoRefresh: db is required");
    }

    let timer = null;
    let stopped = false;

    async function refresh(runOptions = {}) {
      if (stopped) return null;

      const useSync = !!runOptions.forceSync ||
        (!!syncUrl && (
          (runOptions.isInitial && triggerSyncOnStart) ||
          (!runOptions.isInitial && triggerSyncOnRefresh)
        ));

      try {
        const result = await loadR32Snapshot(db, {
          syncUrl,
          triggerSyncFirst: useSync,
          syncPayload,
          syncOptions
        });

        if (typeof onUpdate === "function") {
          await onUpdate(result);
        }

        return result;
      } catch (err) {
        console.error("startR32AutoRefresh refresh error:", err);

        if (typeof onError === "function") {
          onError(err);
        }

        throw err;
      }
    }

    refresh({ isInitial: true }).catch(() => {});

    timer = setInterval(() => {
      refresh({ isInitial: false }).catch(() => {});
    }, refreshMs);

    return {
      stop() {
        stopped = true;
        if (timer) clearInterval(timer);
      },

      async refreshNow(forceSync = false) {
        return refresh({ isInitial: false, forceSync });
      }
    };
  }

  window.R32FetchScores = {
    DEFAULT_REFRESH_MS,
    SNAPSHOT_COLLECTION,
    SNAPSHOT_DOC_ID,

    normalizeSnapshotMatch,
    normalizeKnockoutSnapshot,

    loadKnockoutSnapshot,
    getSnapshotMatch,

    shouldTriggerSync,
    requestKnockoutSync,

    loadR32Snapshot,
    startR32AutoRefresh
  };
})();
