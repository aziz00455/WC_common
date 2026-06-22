<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WC 2026 - Knockout Bracket</title>

  <!-- R32 only -->
  <link rel="stylesheet" href="../WC_common/R32_styles.css">
</head>

<body>
  <div id="topbar"></div>

  <div class="page-wrap">
    <div class="bracket-wrap">
      <div id="lastUpdatedText" class="bracket-last-updated">Last Updated: —</div>

      <button id="bracketLeftBtn" class="bracket-nav-btn bracket-nav-btn-left is-hidden" onclick="scrollBracket(-1)" aria-label="Scroll bracket left" title="Previous rounds">‹</button>
      <button id="bracketRightBtn" class="bracket-nav-btn bracket-nav-btn-right" onclick="scrollBracket(1)" aria-label="Scroll bracket right" title="Next rounds">›</button>

      <div id="bracketStage" class="bracket-stage">
        <div id="bracketApp"></div>
      </div>
    </div>
  </div>

  <script>
    window.global = window;
    window.process = window.process || { env: {} };
  </script>

  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
  <script src="firebase.js"></script>

  <script src="../WC_common/matches.js"></script>
  <script src="../WC_common/teams.js"></script>
  <script src="../WC_common/R32_fetchScores.js"></script>
  <script src="../WC_common/R32_utils.js"></script>
  <script src="../WC_common/R32_matchCards.js"></script>

  <script>
    const R32_GAME_ID = "WC2026_DEV";
    const SESSION_KEY = "session_" + R32_GAME_ID;
    const userId = localStorage.getItem(SESSION_KEY);
    if (!userId) window.location.href = "index.html";

    const R32_REFRESH_MS = 10 * 60 * 1000;
    const R32_IDLE_MS = 20 * 60 * 1000;
    const KNOCKOUT_SYNC_URL = "";
    const DESKTOP_STEP_PX = 310;
    const MOBILE_STEP_PX = 176;

    // New schema refs
    const R32_MAPPING_COLLECTION = "R32mapping";
    const R32_MAPPING_DOC_ID = "main";
    const LIVE_COLLECTION = "__live";
    const LIVE_BRACKET_DOC_ID = "knockoutBracket";

    let refreshRuntime = null;
    let idleRuntime = null;
    let currentBracketWindow = 0;
    let scrollSyncTimer = null;
    let boundScrollEl = null;

    function isMobileBracketView() { return window.matchMedia("(max-width: 640px)").matches; }
    function getBracketStepPx() { return isMobileBracketView() ? MOBILE_STEP_PX : DESKTOP_STEP_PX; }
    function getMaxBracketWindow() { return isMobileBracketView() ? 3 : 2; }

    function getDbInstance() {
      try {
        if (window.firebase && firebase.apps && firebase.apps.length) return firebase.firestore();
      } catch (err) {
        console.error("Failed to create Firestore instance:", err);
      }
      return null;
    }

    function getBracketScrollEl() { return document.querySelector("#bracketApp .bracket-scroll"); }

    function getActiveLaneClasses() {
      if (isMobileBracketView()) {
        const mobileMap = [["lane-r32","lane-r16"],["lane-r16","lane-qf"],["lane-qf","lane-sf"],["lane-sf","lane-final"]];
        return mobileMap[currentBracketWindow] || mobileMap[0];
      }
      const desktopMap = [["lane-r32","lane-r16","lane-qf"],["lane-r16","lane-qf","lane-sf"],["lane-qf","lane-sf","lane-final"]];
      return desktopMap[currentBracketWindow] || desktopMap[0];
    }

    function clampBracketWindow(value) { return Math.max(0, Math.min(getMaxBracketWindow(), value)); }

    function applyBracketWindowClass() {
      document.body.classList.remove("bracket-window-0","bracket-window-1","bracket-window-2","bracket-window-3");
      document.body.classList.add("bracket-window-" + currentBracketWindow);
      document.body.classList.toggle("bracket-mobile-view", isMobileBracketView());
    }

    function updateBracketPaneHeight() {
      const scrollEl = getBracketScrollEl();
      if (!scrollEl) return;
      const activeLaneClasses = getActiveLaneClasses();
      let maxHeight = 0;
      activeLaneClasses.forEach(function (cls) {
        const laneEl = scrollEl.querySelector('.' + cls);
        if (!laneEl) return;
        maxHeight = Math.max(maxHeight, laneEl.scrollHeight);
      });
      scrollEl.style.height = maxHeight > 0 ? (maxHeight + 'px') : '';
    }

    function setBracketWindow(index) {
      currentBracketWindow = clampBracketWindow(index);
      applyBracketWindowClass();
      requestAnimationFrame(updateBracketPaneHeight);
    }

    function syncBracketWindowFromScroll() {
      const scrollEl = getBracketScrollEl();
      if (!scrollEl) return;
      const step = getBracketStepPx();
      const computedIndex = Math.round(scrollEl.scrollLeft / step);
      if (computedIndex !== currentBracketWindow) {
        setBracketWindow(computedIndex);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }

    function updateBracketNavButtons() {
      const scrollEl = getBracketScrollEl();
      const leftBtn = document.getElementById("bracketLeftBtn");
      const rightBtn = document.getElementById("bracketRightBtn");
      if (!leftBtn || !rightBtn) return;
      if (!scrollEl) { leftBtn.classList.add("is-hidden"); rightBtn.classList.add("is-hidden"); return; }
      const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
      const scrollLeft = scrollEl.scrollLeft;
      if (maxScroll <= 2) { leftBtn.classList.add("is-hidden"); rightBtn.classList.add("is-hidden"); return; }
      if (scrollLeft <= 2) leftBtn.classList.add("is-hidden"); else leftBtn.classList.remove("is-hidden");
      if (scrollLeft >= maxScroll - 2) rightBtn.classList.add("is-hidden"); else rightBtn.classList.remove("is-hidden");
    }

    function handleBracketScroll() {
      updateBracketNavButtons();
      if (scrollSyncTimer) clearTimeout(scrollSyncTimer);
      scrollSyncTimer = setTimeout(function () { syncBracketWindowFromScroll(); }, 120);
    }

    function attachBracketScrollListener() {
      const scrollEl = getBracketScrollEl();
      if (!scrollEl) return;
      if (boundScrollEl && boundScrollEl !== scrollEl) boundScrollEl.removeEventListener("scroll", handleBracketScroll);
      if (boundScrollEl !== scrollEl) {
        scrollEl.addEventListener("scroll", handleBracketScroll, { passive: true });
        boundScrollEl = scrollEl;
      }
    }

    function scrollBracket(direction) {
      const scrollEl = getBracketScrollEl();
      if (!scrollEl) return;
      const nextWindow = clampBracketWindow(currentBracketWindow + direction);
      const step = getBracketStepPx();
      setBracketWindow(nextWindow);
      scrollEl.scrollTo({ left: nextWindow * step, behavior: "smooth" });
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(function () { updateBracketNavButtons(); updateBracketPaneHeight(); }, 350);
    }

    function syncBracketToViewport() {
      const scrollEl = getBracketScrollEl();
      currentBracketWindow = clampBracketWindow(currentBracketWindow);
      applyBracketWindowClass();
      if (scrollEl) scrollEl.scrollLeft = currentBracketWindow * getBracketStepPx();
      updateBracketNavButtons();
      requestAnimationFrame(updateBracketPaneHeight);
    }

    function goToLanding() { window.location.href = "landing.html"; }
    function logout() { localStorage.removeItem(SESSION_KEY); window.location.href = "index.html"; }

    function buildTopbar() {
      if (window.R32Utils && typeof R32Utils.renderTopbar === "function" && typeof R32Utils.makeButtonHtml === "function") {
        const actionsHtml = [
          R32Utils.makeButtonHtml({ label: "Leaderboard", onClick: "goToLanding()" }),
          R32Utils.makeButtonHtml({ label: "Logout", onClick: "logout()" })
        ].join("");
        R32Utils.renderTopbar({ title: "Knockout Bracket", actionsHtml });
        return;
      }
      const topbar = document.getElementById("topbar");
      if (!topbar) return;
      topbar.innerHTML = `
        <div class="r32-topbar-inner">
          <div class="r32-topbar-title">Knockout Bracket</div>
          <div class="r32-topbar-actions">
            <button class="r32-btn" onclick="goToLanding()">Leaderboard</button>
            <button class="r32-btn" onclick="logout()">Logout</button>
          </div>
        </div>`;
    }

    function renderEmptyState(message) {
      const app = document.getElementById("bracketApp");
      if (!app) return;
      app.innerHTML = `<div class="empty-state">${message}</div>`;
      updateBracketNavButtons();
    }

    function cloneJson(value) {
      return JSON.parse(JSON.stringify(value || null));
    }

    function buildPlacementToTeamLookup(mappingData) {
      const lookup = {};
      Object.entries(mappingData || {}).forEach(function ([teamName, data]) {
        const placement = String(data && data.placement ? data.placement : "").trim();
        if (!placement) return;
        lookup[placement] = teamName;
      });
      return lookup;
    }

    function fillLiveBracketTeamsFromMapping(liveDocData, mappingData) {
      const safeLive = cloneJson(liveDocData) || {};
      safeLive.matches = safeLive.matches && typeof safeLive.matches === 'object' ? safeLive.matches : {};

      const lookup = buildPlacementToTeamLookup(mappingData);
      let didChange = false;

      Object.keys(safeLive.matches).forEach(function (matchKey) {
        const match = safeLive.matches[matchKey] || {};
        const slot1 = String(match.slot1 || "").trim();
        const slot2 = String(match.slot2 || "").trim();

        if ((match.team1 == null || match.team1 === "") && slot1 && lookup[slot1]) {
          match.team1 = lookup[slot1];
          didChange = true;
        }
        if ((match.team2 == null || match.team2 === "") && slot2 && lookup[slot2]) {
          match.team2 = lookup[slot2];
          didChange = true;
        }

        safeLive.matches[matchKey] = match;
      });

      return { liveDocData: safeLive, didChange: didChange };
    }
	

	function propagateWinners(matches) {

	  let didChange = false;

	  Object.keys(matches).forEach(function (matchKey) {

		const match = matches[matchKey] || {};

		// ---- team1 from Wxx ----
		if ((match.team1 == null || match.team1 === "") &&
			match.slot1 && match.slot1.startsWith("W")) {

		  const prevMatchNum = match.slot1.replace("W", "");
		  const prevMatch = matches[prevMatchNum] || matches[String(prevMatchNum)];

		  if (prevMatch && prevMatch.winner) {
			match.team1 = prevMatch.winner;
			didChange = true;
		  }
		}

		// ---- team2 from Wxx ----
		if ((match.team2 == null || match.team2 === "") &&
			match.slot2 && match.slot2.startsWith("W")) {

		  const prevMatchNum = match.slot2.replace("W", "");
		  const prevMatch = matches[prevMatchNum] || matches[String(prevMatchNum)];

		  if (prevMatch && prevMatch.winner) {
			match.team2 = prevMatch.winner;
			didChange = true;
		  }
		}

		matches[matchKey] = match;
	  });

	  return didChange;
	}

    function applyLiveBracketTeamsToMergedMatches(mergedMatches, liveDocData) {
      const list = Array.isArray(mergedMatches) ? cloneJson(mergedMatches) : [];
      const liveMatches = liveDocData && liveDocData.matches && typeof liveDocData.matches === 'object' ? liveDocData.matches : {};

      list.forEach(function (match) {
        const matchNumber = Number(match && (match.matchNumber != null ? match.matchNumber : match.matchNo != null ? match.matchNo : match.number != null ? match.number : match.id != null ? match.id : null));
        if (!Number.isFinite(matchNumber)) return;

        const liveMatch = liveMatches[String(matchNumber)] || liveMatches[matchNumber];
        if (!liveMatch) return;

        const team1 = liveMatch.team1 || null;
        const team2 = liveMatch.team2 || null;
        const slot1 = liveMatch.slot1 || match.slot1Label || null;
        const slot2 = liveMatch.slot2 || match.slot2Label || null;

        if (slot1 && !match.slot1Label) match.slot1Label = slot1;
        if (slot2 && !match.slot2Label) match.slot2Label = slot2;

        if (team1) {
          match.team1 = team1;
          match.slot1Team = team1;
          match.homeTeam = team1;
          match.homeName = team1;
        }
        if (team2) {
          match.team2 = team2;
          match.slot2Team = team2;
          match.awayTeam = team2;
          match.awayName = team2;
        }
      });

      return list;
    }

    async function synchronizeBracketFromNewSchema(db, context) {
      const mappingRef = db.collection(R32_MAPPING_COLLECTION).doc(R32_MAPPING_DOC_ID);
      const liveRef = db.collection(LIVE_COLLECTION).doc(LIVE_BRACKET_DOC_ID);

      const [mappingSnap, liveSnap] = await Promise.all([
        mappingRef.get(),
        liveRef.get()
      ]);

      const mappingData = mappingSnap.exists ? (mappingSnap.data() || {}) : {};
      const liveDocData = liveSnap.exists ? (liveSnap.data() || {}) : {};

      const syncResult = fillLiveBracketTeamsFromMapping(liveDocData, mappingData);
	  
	// ✅ NEW: propagate winners
	const winnerChanged = propagateWinners(syncResult.liveDocData.matches);

      if (syncResult.didChange || winnerChanged) {
        await liveRef.set({
          matches: syncResult.liveDocData.matches,
          updatedAtUtc: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      const nextContext = Object.assign({}, context || {});
      nextContext.mergedMatches = applyLiveBracketTeamsToMergedMatches(context && context.mergedMatches, syncResult.liveDocData);
      return nextContext;
    }

    function renderBracket(context) {
      const app = document.getElementById("bracketApp");
      const lastUpdatedText = document.getElementById("lastUpdatedText");
      if (!app) return;
      const mergedMatches = context && context.mergedMatches ? context.mergedMatches : [];
      if (!mergedMatches.length) {
        renderEmptyState("No knockout schedule found.");
        if (lastUpdatedText) lastUpdatedText.textContent = "Last Updated: —";
        return;
      }
      const boardSpec = [
        { title: "Round of 32", laneClass: "lane-r32", matchNumbers: [74,77,73,75,83,84,81,82,76,78,79,80,86,88,85,87] },
        { title: "Round of 16", laneClass: "lane-r16", matchNumbers: [89,90,93,94,91,92,95,96] },
        { title: "Quarter-finals", laneClass: "lane-qf", matchNumbers: [97,98,99,100] },
        { title: "Semi-finals", laneClass: "lane-sf", matchNumbers: [101,102] },
        { title: "Final", laneClass: "lane-final", matchNumbers: [104,103] }
      ];
      app.innerHTML = R32MatchCards.buildBracketBoardHtml(boardSpec, mergedMatches);
      applyBracketWindowClass();
      attachBracketScrollListener();
      requestAnimationFrame(function () { syncBracketToViewport(); });
      if (lastUpdatedText) {
        lastUpdatedText.textContent = `Last Updated: ${R32Utils.formatUpdatedAtEdt(context && context.fetchedAtClientUtc)}`;
      }
    }

    function startPage() {
      buildTopbar();
      setBracketWindow(0);
      if (!window.R32matches || !Array.isArray(window.R32matches) || !window.R32matches.length) {
        renderEmptyState("matches.js loaded, but window.R32matches is missing or empty."); return;
      }
      if (!window.R32FetchScores) { renderEmptyState("R32_fetchScores.js failed to load."); return; }
      if (!window.R32Utils) { renderEmptyState("R32_utils.js failed to load."); return; }
      if (!window.R32MatchCards) { renderEmptyState("R32_matchCards.js failed to load."); return; }

      const dbInstance = getDbInstance();
      if (!dbInstance) { renderEmptyState("firebase.js loaded, but Firestore db is not available."); return; }

      idleRuntime = R32Utils.installIdleTimeout({ sessionKey: SESSION_KEY, redirectUrl: "index.html", idleMs: R32_IDLE_MS, checkMs: 60 * 1000 });
      window.addEventListener("resize", function () { syncBracketToViewport(); });

      refreshRuntime = R32Utils.startR32PageRefresh({
        db: dbInstance,
        syncUrl: KNOCKOUT_SYNC_URL,
        refreshMs: R32_REFRESH_MS,
        triggerSyncOnStart: true,
        triggerSyncOnRefresh: true,
        onUpdate: async function (context) {
          try {
            const nextContext = await synchronizeBracketFromNewSchema(dbInstance, context || {});
            renderBracket(nextContext);
          } catch (err) {
            console.error("R32 bracket schema sync error:", err);
            renderBracket(context || {});
          }
        },
        onError: function (err) { console.error("R32 bracket refresh error:", err); renderEmptyState("Failed to load knockout bracket."); }
      });
    }

    startPage();
  </script>
</body>
</html>
