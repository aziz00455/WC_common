/* =========================================================
   R32_matchCards.js
   Knockout-stage-only match-card rendering helpers
========================================================= */

(function () {
  function getStatusClass(status) {
    const s = String(status || "").toLowerCase();
    if (s === "in_play") return "status-in_play";
    if (s === "complete") return "status-complete";
    return "status-scheduled";
  }

  function getStatusText(status) {
    const s = String(status || "").toLowerCase();
    if (s === "in_play") return "LIVE";
    if (s === "complete") return "FINAL";
    return "SCHEDULED";
  }

  function getTeamsSource() {
    if (Array.isArray(window.teams)) return window.teams;
    if (window.teams && typeof window.teams === "object") return window.teams;
    return null;
  }

  function normalizeName(value) {
    return String(value || "").trim().toLowerCase();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function findTeamMeta(teamName) {
    const source = getTeamsSource();
    if (!source || !teamName) return null;

    const normalized = normalizeName(teamName);

    if (Array.isArray(source)) {
      for (const team of source) {
        const candidates = [
          team && team.name,
          team && team.team,
          team && team.teamName,
          team && team.fullName,
          team && team.displayName
        ].map(normalizeName);

        if (candidates.includes(normalized)) {
          return team;
        }
      }
      return null;
    }

    if (source[teamName]) return source[teamName];

    for (const key of Object.keys(source)) {
      if (normalizeName(key) === normalized) {
        return source[key];
      }
    }

    return null;
  }

  function getTeamFlagValue(teamName) {
    const meta = findTeamMeta(teamName);
    if (!meta) return "";

    return (
      meta.flag ||
      meta.flagUrl ||
      meta.flagImage ||
      meta.image ||
      meta.img ||
      ""
    );
  }

  function isImageLike(value) {
    const v = String(value || "");
    return (
      v.startsWith("http://") ||
      v.startsWith("https://") ||
      v.startsWith("data:image/") ||
      v.startsWith("../") ||
      v.startsWith("./") ||
      v.startsWith("/")
    );
  }

  function buildFlagHtml(teamName, hasRealTeam) {
    if (!hasRealTeam || !teamName) {
      return '<span class="team-flag-placeholder" aria-hidden="true"></span>';
    }

    const flagValue = getTeamFlagValue(teamName);

    if (!flagValue) {
      return '<span class="team-flag-placeholder" aria-hidden="true"></span>';
    }

    if (isImageLike(flagValue)) {
      return `<img class="team-flag" src="${flagValue}" alt="">`;
    }

    return `<span class="team-flag-text" aria-hidden="true">${escapeHtml(flagValue)}</span>`;
  }

  function buildPlayerLine(playerName) {
    if (playerName) {
      return `<div class="player-line assigned">Player: ${escapeHtml(playerName)}</div>`;
    }
    return `<div class="player-line">Player: TBD</div>`;
  }

  function buildTeamNameHtml(match, side) {
    const isReal = side === 1 ? match.hasRealTeam1 : match.hasRealTeam2;
    const displayName = side === 1 ? match.displayTeam1 : match.displayTeam2;
    const playerName = side === 1 ? match.player1Name : match.player2Name;
    const flagHtml = buildFlagHtml(displayName, isReal);

    return `
      <div class="team-main">
        ${flagHtml}
        <div class="team-text">
          <div class="team-name ${isReal ? "" : "placeholder"}">
            ${displayName || "—"}
          </div>
          ${buildPlayerLine(playerName)}
        </div>
      </div>
    `;
  }

  function formatScheduledLine(utc) {
    if (!utc) return "TBD";

    const date = new Date(utc);
    if (Number.isNaN(date.getTime())) return "TBD";

    const datePart = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "long",
      month: "long",
      day: "numeric"
    }).format(date);

    const timePart = R32Utils.formatKickoffUtc(utc);

    return `${datePart} ${timePart}`;
  }

  function buildMatchCardHtml(match) {
    const score1 = Number.isFinite(match.score1) ? match.score1 : "—";
    const score2 = Number.isFinite(match.score2) ? match.score2 : "—";

    const isLive = match.status === "in_play";
    const isComplete = match.status === "complete";

    const statusText = getStatusText(match.status);
    const liveTimeHtml = isLive && match.gameTime
      ? `<span class="match-live-time"> - ${match.gameTime}</span>`
      : "";

    const scheduledLine = (!isLive && !isComplete)
      ? formatScheduledLine(match.kickoffUtc)
      : "";
	  
    const cardClass =
      match.status === "in_play" ? "match-card live-match" :
      match.status === "complete" ? "match-card complete-match" :
     "match-card";
    return `
      <div class="${cardClass}">
        <div class="match-head">
          <div class="match-head-left">
            <div class="match-num">Match ${match.matchNumber}</div>
          </div>
          <div class="match-head-right">
            <div class="match-status-wrap">
              <span class="match-status ${getStatusClass(match.status)}">${statusText}</span>${liveTimeHtml}
            </div>
            ${scheduledLine ? `<div class="match-scheduled-time">${scheduledLine}</div>` : ""}
          </div>
        </div>

        <div class="team-row">
          ${buildTeamNameHtml(match, 1)}
          <div class="score-box ${Number.isFinite(match.score1) ? "" : "empty"}">${score1}</div>
        </div>

        <div class="team-row">
          ${buildTeamNameHtml(match, 2)}
          <div class="score-box ${Number.isFinite(match.score2) ? "" : "empty"}">${score2}</div>
        </div>
      </div>
    `;
  }

  function buildLaneHtml(title, matches, laneClass) {
    return `
      <section class="bracket-lane ${laneClass}">
        <h2 class="bracket-lane-title">${title}</h2>
        <div class="bracket-lane-cards">
          ${matches.map(buildMatchCardHtml).join("")}
        </div>
      </section>
    `;
  }

  function buildBracketBoardHtml(boardSpec, mergedMatches) {
    return `
      <div class="bracket-scroll">
        <div class="bracket-board">
          ${boardSpec.map(item => {
            const laneMatches = item.matchNumbers
              .map(num => R32Utils.getMergedMatchByNumber(mergedMatches, num))
              .filter(Boolean);

            return buildLaneHtml(item.title, laneMatches, item.laneClass);
          }).join("")}
        </div>
      </div>
    `;
  }

  window.R32MatchCards = {
    getStatusClass,
    getStatusText,
    buildMatchCardHtml,
    buildLaneHtml,
    buildBracketBoardHtml
  };
})();
``