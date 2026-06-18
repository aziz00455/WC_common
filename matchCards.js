(function () {
  const STYLE_ID = "match-card-style";

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
      .match-card {
        width: 100%;
        max-width: none;
        margin: 10px 0;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 10px;
        padding: 12px 14px;
      }

      .match-card.correct {
        background: #eef9f0;
        border-color: #2e7d32;
      }

      .match-card.incorrect {
        background: #fff3f3;
        border-color: #c62828;
      }
	  
	  .match-card.in-play {
	    background: #e3f2fd;   /* light blue */
	    border-color: #64b5f6; /* slightly stronger blue border */
	  }

      .match-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
        font-size: 12px;
        font-weight: 600;
      }

      .match-top-left,
      .match-top-right {
        min-width: 0;
      }

      .match-top-right {
        text-align: right;
        white-space: nowrap;
      }

      .in-play-label {
        color: #1976d2;
        font-weight: 700;
      }

      .teams-row {
        display: grid;
        grid-template-columns: 1fr auto auto auto 1fr;
        align-items: center;
        column-gap: 4px;
        margin-bottom: 8px;
        padding: 0 10px;
      }

      .match-card.no-score .teams-row {
        grid-template-columns: 1fr auto 1fr;
      }

      .match-card.no-score .score {
        display: none;
      }

      .team {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        font-size: 12px;
        white-space: nowrap;
      }

      .team.left {
        justify-content: flex-start;
      }

      .team.right {
        justify-content: flex-end;
      }

      .flag {
        width: 16px;
        height: 12px;
        object-fit: cover;
        border: 1px solid #ccc;
      }

      .score,
      .vs {
        min-width: 14px;
        text-align: center;
        font-size: 12px;
        font-weight: 600;
      }

      .hidden {
        visibility: hidden;
      }

      .actions {
        display: flex;
        justify-content: center;
        gap: 12px;
        margin-top: 4px;
      }

      .pick-btn {
        width: 40px;
        padding: 4px 0;
        font-size: 10px;
        font-weight: 600;
        border-radius: 6px;
        border: 1px solid #ccc;
        background: white;
        cursor: pointer;
      }

      .pick-btn.selected {
        background: #1976d2;
        color: white;
      }

      .pick-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .status-line {
        margin-top: 6px;
        font-size: 12px;
        text-align: center;
      }
    `;

    document.head.appendChild(style);
  }

  function isCompletedResult(resultDoc) {
    return !!resultDoc && (
      resultDoc.status === "complete" ||
      resultDoc.status === "completed"
    );
  }

  function isInPlay(match, resultDoc, serverNow) {
    return isStarted(match, serverNow) && !isCompletedResult(resultDoc);
  }

  function buildTopLeft(matchId, locked, inPlay) {
    let text = "";

    if (locked) {
      text += "🔒 ";
    }

    text += matchId;

    if (inPlay) {
      text += ` - <span class="in-play-label">IN PLAY</span>`;
    }

    return text;
  }

  async function fetchMatchCardContext(userId) {
    const [serverNow, summaryDoc, usersSnap, saved] = await Promise.all([
      fetchServerTime(db),
      db.collection("matchResults").doc("main").get(),
      db.collection("users").get(),
      userId ? loadUserPredictions(db, userId) : Promise.resolve([])
    ]);

    const results = summaryDoc.exists ? (summaryDoc.data().results || {}) : {};

    return {
      serverNow,
      results,
      usersSnap,
      saved
    };
  }

  function buildMatchCardDataFromContext(match, context) {
    const { results, serverNow, usersSnap, saved } = context;

    const idx = getMatchIndex(matches, match.id);
    const resultDoc = results[match.id];
    const myPick = pickIntToChoice(saved?.[idx]);

    const locked = isLocked(match, serverNow);
    const completed = isCompletedResult(resultDoc);
    const inPlay = isInPlay(match, resultDoc, serverNow);

    let topRight = "";
    let scores = null;
    let bottom = "";
    let result = null;

    const p = getPickPercentages(match.id, matches, usersSnap);
    const t1 = getTeam(match.team1)?.short || match.team1;
    const t2 = getTeam(match.team2)?.short || match.team2;

    const myPickLabel =
      myPick === "team1" ? t1 :
      myPick === "team2" ? t2 :
      myPick === "tie" ? "Tie" :
      "NP";

    // completed / in-play / scheduled top-right + scores + result status
    if (completed) {
      topRight = "FINAL";

      if (resultDoc.score1 != null && resultDoc.score2 != null) {
        scores = {
          score1: resultDoc.score1,
          score2: resultDoc.score2
        };

        let outcome;
        if (resultDoc.score1 > resultDoc.score2) outcome = "team1";
        else if (resultDoc.score1 < resultDoc.score2) outcome = "team2";
        else outcome = "tie";

        if (!myPick) {
          result = "incorrect";
        } else {
          result = myPick === outcome ? "correct" : "incorrect";
        }
      }

    } else if (inPlay) {
      if (resultDoc?.lastUpdatedUtc) {
        topRight = `Last Update: ${formatEasternTime(resultDoc.lastUpdatedUtc)}`;
      } else {
        topRight = `Kickoff at ${formatEasternTime(match.kickoffUtc)}`;
      }

      if (resultDoc?.score1 != null && resultDoc?.score2 != null) {
        scores = {
          score1: resultDoc.score1,
          score2: resultDoc.score2
        };
      }

    } else {
      topRight = `Kickoff at ${formatEasternTime(match.kickoffUtc)}`;
    }

    // bottom message for game.html and landing.html
    const picksText = `${t1} ${p.t1}, Tie ${p.tie}, ${t2} ${p.t2}, NP ${p.np}`;

	let resultMark = "";
	if (completed) {
	  if (!myPick) resultMark = " ❌";
	  else if (result === "correct") resultMark = " ✅";
	  else resultMark = " ❌";
	}

    if (!locked) {
      bottom = `<b>My Pick:</b> ${myPickLabel}`;
    } else if (!completed) {
      bottom = `<b>Picks:</b> ${picksText}&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;<b>My Pick:</b> ${myPickLabel}`;
    } else {
      bottom = `<b>Picks:</b> ${picksText}&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;<b>My Pick:</b> ${myPickLabel}${resultMark}`;
    }

    return {
      matchId: match.id,
      topLeft: buildTopLeft(match.id, locked, inPlay),
      topRight,
      scores,
      myPick,
      bottomMessage: bottom,
      result,
      locked
    };
  }

  /* =========================
     PUBLIC: DB-BACKED DATA BUILDER
  ========================= */
  window.buildMatchCardData = async function (match, userId, context = null) {
    const resolvedContext = context || await fetchMatchCardContext(userId);
    return buildMatchCardDataFromContext(match, resolvedContext);
  };

  /* =========================
     PUBLIC: PRELOAD CONTEXT ONCE
     Use this when rendering many cards on a page.
  ========================= */
  window.loadMatchCardContext = async function (userId) {
    return await fetchMatchCardContext(userId);
  };

  function createMatchCardElement({
    matchId,
    topLeft,
    topRight,
    scores,
    myPick,
    bottomMessage,
    result,
    locked = false,
    showActions = false,
    onPick = null
  }) {
    injectStyles();

    const match = matches.find(m => m.id === matchId);
    if (!match) return document.createElement("div");

    const t1Short = teams[match.team1]?.short || match.team1;
    const t2Short = teams[match.team2]?.short || match.team2;

    let score1 = null;
    let score2 = null;

    if (scores && typeof scores === "object") {
      score1 = scores.score1;
      score2 = scores.score2;
    }

    const showScores = score1 !== null && score2 !== null;

    const card = document.createElement("div");
    card.className = "match-card";

    if (!showScores) {
      card.classList.add("no-score");
    }

    if (result === "correct") card.classList.add("correct");
    else if (result === "incorrect") card.classList.add("incorrect");
	
	if (topLeft && topLeft.includes("IN PLAY")) {
	  card.classList.add("in-play");
	}

    card.innerHTML = `
      <div class="match-top">
        <div class="match-top-left">${topLeft || matchId}</div>
        <div class="match-top-right">${topRight || ""}</div>
      </div>

      <div class="teams-row">
        <div class="team left">
          <img class="flag" src="${teams[match.team1]?.flag || ""}">
          ${match.team1}
        </div>

        <div class="score ${showScores ? "" : "hidden"}">${score1 ?? ""}</div>
        <div class="vs">${showScores ? ":" : "vs"}</div>
        <div class="score ${showScores ? "" : "hidden"}">${score2 ?? ""}</div>

        <div class="team right">
          ${match.team2}
          <img class="flag" src="${teams[match.team2]?.flag || ""}">
        </div>
      </div>

      ${
        showActions ? `
        <div class="actions">
          <button class="pick-btn ${myPick === "team1" ? "selected" : ""}" ${locked ? "disabled" : ""} data-choice="team1">${t1Short}</button>
          <button class="pick-btn ${myPick === "tie" ? "selected" : ""}" ${locked ? "disabled" : ""} data-choice="tie">TIE</button>
          <button class="pick-btn ${myPick === "team2" ? "selected" : ""}" ${locked ? "disabled" : ""} data-choice="team2">${t2Short}</button>
        </div>
        ` : ""
      }

      <div class="status-line">${bottomMessage || ""}</div>
    `;

    if (!locked && showActions && onPick) {
      card.querySelectorAll(".pick-btn").forEach(btn => {
        btn.onclick = async () => {
          const choice = btn.getAttribute("data-choice");

          // update selected button immediately
          card.querySelectorAll(".pick-btn").forEach(b => {
            b.classList.toggle("selected", b === btn);
          });

          // update bottom line immediately
          const msg = card.querySelector(".status-line");
          if (msg) {
            let pickLabel = "";
            if (choice === "team1") pickLabel = t1Short;
            else if (choice === "team2") pickLabel = t2Short;
            else pickLabel = "Tie";

            msg.innerHTML = `<b>My Pick</b> ${pickLabel}`;
          }

          // save
          await onPick({ matchId, choice });
        };
      });
    }

    return card;
  }

  /* =========================
     PUBLIC: SYNC CARD CREATOR
     Backward compatible for existing callers
  ========================= */
  window.createMatchCard = function ({
    matchId,
    topLeft,
    topRight,
    scores,
    myPick,
    bottomMessage,
    result,
    locked = false,
    showActions = false,
    onPick = null
  }) {
    return createMatchCardElement({
      matchId,
      topLeft,
      topRight,
      scores,
      myPick,
      bottomMessage,
      result,
      locked,
      showActions,
      onPick
    });
  };

  /* =========================
     PUBLIC: DB-BACKED CARD CREATOR
     New simpler API for pages
  ========================= */
  window.createMatchCardFromDb = async function ({
    matchId,
    userId = null,
    showActions = false,
    onPick = null,
    context = null
  }) {
    const match = matches.find(m => m.id === matchId);
    if (!match) return document.createElement("div");

    const resolvedContext = context || await fetchMatchCardContext(userId);
    const data = buildMatchCardDataFromContext(match, resolvedContext);

    return createMatchCardElement({
      ...data,
      showActions,
      onPick
    });
  };
})();