// ====================================================
// fetchScores.js (DB-BACKED SCORE FETCH MODULE)
// ====================================================
(function () {
  const SCOREBOARD_BASE_URL =
    "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

  // ✅ bump this whenever you deploy a schema / writer logic change
  const SCORE_WRITER_VERSION = 2;

  function normalize(str) {
    return (str || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();
  }

  // ✅ find matching ESPN event
  function findMatch(event, match) {
    const comp = event.competitions?.[0];
    if (!comp) return false;

    const teamsInEvent = comp.competitors || [];
    if (teamsInEvent.length < 2) return false;

    const names = teamsInEvent.map(t => normalize(t.team.displayName));

    const espn1 = normalize(teams[match.team1]?.espn || match.team1);
    const espn2 = normalize(teams[match.team2]?.espn || match.team2);

    return names.includes(espn1) && names.includes(espn2);
  }

  // ✅ extract result from ESPN event
  function extractScores(event, match) {
    const comp = event.competitions?.[0];
    if (!comp) return null;

    const teamsInEvent = comp.competitors || [];

    const espn1 = normalize(teams[match.team1]?.espn || match.team1);
    const espn2 = normalize(teams[match.team2]?.espn || match.team2);

    let score1 = null;
    let score2 = null;

    teamsInEvent.forEach(t => {
      const nameNorm = normalize(t.team.displayName);

      if (nameNorm === espn1) score1 = Number(t.score);
      if (nameNorm === espn2) score2 = Number(t.score);
    });

    return {
      score1,
      score2,
      status: event.status?.type?.completed ? "complete" : "in_play"
    };
  }

  // ✅ helper: YYYYMMDD from Date
  function toDateKey(d) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }

  // ✅ helper: use kickoff UTC date + previous UTC date
  function getCandidateDateKeys(kickoffUtc) {
    const kickoff = new Date(kickoffUtc);

    const sameDay = new Date(kickoff);
    const prevDay = new Date(kickoff);
    prevDay.setUTCDate(prevDay.getUTCDate() - 1);

    return [toDateKey(sameDay), toDateKey(prevDay)];
  }

  // ✅ fetch raw result from ESPN for one match
  async function fetchScoreForMatch(match) {
    try {
      const dateKeys = getCandidateDateKeys(match.kickoffUtc);

      for (const dateKey of dateKeys) {
        const url = `${SCOREBOARD_BASE_URL}?dates=${dateKey}`;

        const res = await fetch(url);
        if (!res.ok) {
          console.error(`fetchScoreForMatch HTTP error ${res.status} for ${match.id}`);
          continue;
        }

        const data = await res.json();
        const events = data.events || [];

        for (const event of events) {
          if (findMatch(event, match)) {
            return extractScores(event, match);
          }
        }
      }

      return null;
    } catch (err) {
      console.error(`fetchScoreForMatch error for ${match.id}:`, err);
      return null;
    }
  }

  // ✅ load current match results doc
  async function loadMatchResultsDoc() {
    try {
      const doc = await db.collection("matchResults").doc("main").get();
      return doc.exists ? doc.data() : {};
    } catch (err) {
      console.error("loadMatchResultsDoc error:", err);
      return {};
    }
  }

  // ✅ load current match results map only
  async function loadMatchResults() {
    try {
      const docData = await loadMatchResultsDoc();
      return docData.results || {};
    } catch (err) {
      console.error("loadMatchResults error:", err);
      return {};
    }
  }

  // ✅ save results with version gate
  async function saveMatchResults(results) {
    try {
      const docRef = db.collection("matchResults").doc("main");
      const snap = await docRef.get();
      const currentData = snap.exists ? snap.data() : {};

      const currentWriterVersion = currentData.writerVersion || 0;

      // ✅ block stale cached clients
      if (currentWriterVersion > SCORE_WRITER_VERSION) {
        console.warn(
          `Blocked write from stale client. Current writerVersion=${currentWriterVersion}, this client=${SCORE_WRITER_VERSION}`
        );
        return false;
      }

      await docRef.set({
        writerVersion: SCORE_WRITER_VERSION,
        results
      });

      return true;
    } catch (err) {
      console.error("saveMatchResults error:", err);
      throw err;
    }
  }

  // ✅ should we fetch this match?
  function shouldFetchScore(match, resultDoc, serverNow) {
    const kickoff = new Date(match.kickoffUtc).getTime();

    // do not fetch before kickoff
    if (serverNow < kickoff) return false;

    // already completed with scores saved
    if (
      resultDoc &&
      (resultDoc.status === "complete" || resultDoc.status === "completed") &&
      resultDoc.score1 != null &&
      resultDoc.score2 != null
    ) {
      return false;
    }

    return true;
  }

  // ✅ backward-compatible function
  async function maybeFetchScore(match, resultDoc = null, serverNow = null) {
    try {
      const resolvedServerNow =
        serverNow != null ? serverNow : await fetchServerTime(db);

      let resolvedResultDoc = resultDoc;
      if (resolvedResultDoc == null) {
        const results = await loadMatchResults();
        resolvedResultDoc = results[match.id] || null;
      }

      if (!shouldFetchScore(match, resolvedResultDoc, resolvedServerNow)) {
        return null;
      }

      return await fetchScoreForMatch(match);
    } catch (err) {
      console.error(`maybeFetchScore error for ${match.id}:`, err);
      return null;
    }
  }

  // ✅ main DB-backed API for pages
  async function ensureScoresUpToDate(matchesList = matches) {
    try {
      const serverNow = await fetchServerTime(db);
      const results = await loadMatchResults();

      let updated = false;

      for (const match of matchesList) {
        const resultDoc = results[match.id] || null;

        if (!shouldFetchScore(match, resultDoc, serverNow)) {
          continue;
        }

        const fetched = await fetchScoreForMatch(match);

        if (!fetched) continue;

        const prevScore1 = resultDoc?.score1 ?? null;
        const prevScore2 = resultDoc?.score2 ?? null;
        const prevStatus = resultDoc?.status ?? null;

        const changed =
          prevScore1 !== fetched.score1 ||
          prevScore2 !== fetched.score2 ||
          prevStatus !== fetched.status;

        if (!changed) {
          continue;
        }

        // ✅ write ONLY the current schema — do NOT preserve legacy fields
        results[match.id] = {
          score1: fetched.score1,
          score2: fetched.score2,
          status: fetched.status,
          lastUpdatedUtc: new Date().toISOString()
        };

        updated = true;
      }

      if (updated) {
        await saveMatchResults(results);
      }

      return {
        results,
        serverNow
      };
    } catch (err) {
      console.error("ensureScoresUpToDate error:", err);
      return {
        results: {},
        serverNow: Date.now()
      };
    }
  }

  // ✅ optional helper if page just wants one map read
  async function getResultsWithServerTime() {
    const [results, serverNow] = await Promise.all([
      loadMatchResults(),
      fetchServerTime(db)
    ]);

    return { results, serverNow };
  }

  // expose public API
  window.fetchScoreForMatch = fetchScoreForMatch;
  window.maybeFetchScore = maybeFetchScore;
  window.loadMatchResults = loadMatchResults;
  window.saveMatchResults = saveMatchResults;
  window.ensureScoresUpToDate = ensureScoresUpToDate;
  window.getResultsWithServerTime = getResultsWithServerTime;
})();