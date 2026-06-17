function formatTimestampToEastern(ts) {
  if (!ts) return "Never";
  const date = (ts && ts.toDate) ? ts.toDate() : new Date(ts);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short"
  }).format(date);
}

/* =========================
   UI SHARED FUNCTIONS
========================= */
function renderTopbar(titleText, buttonsHTML) {
  const host = document.getElementById("topbar");
  if (!host) return;

  host.innerHTML = `
    <div class="topbar">
      <div class="title">${titleText}</div>
      <div class="top-buttons">
        ${buttonsHTML}
      </div>
    </div>
  `;
}

/* =========================
   SESSION / NAV
========================= */
function logout() {
  localStorage.removeItem("session_" + GAME_ID);
  window.location.href = "index.html";
}

/* =========================
   SERVER TIME
========================= */
async function fetchServerTime(db) {
  const ref = db.collection("__meta").doc("serverTime");

  await ref.set({
    now: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const snap = await ref.get();
  return snap.data().now.toDate().getTime();
}

/* =========================
   TIME HELPERS
========================= */
function getEasternDateKey(utc) {
  const d = new Date(utc);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(d);

  const map = {};
  parts.forEach(p => map[p.type] = p.value);

  return `${map.year}-${map.month}-${map.day}`;
}

function formatPrettyDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);

  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function formatEasternTime(utc) {
  const d = new Date(utc);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d) + " EDT";
}

/* =========================
   MATCH HELPERS
========================= */
function groupMatches(matches) {
  const map = {};

  matches.forEach(m => {
    const dateKey = getEasternDateKey(m.kickoffUtc);

    if (!map[dateKey]) map[dateKey] = [];
    map[dateKey].push(m);
  });

  return map;
}

function isLocked(match, serverNow) {
  const kickoff = new Date(match.kickoffUtc).getTime();
  return serverNow >= kickoff - 3600000;
}

function isStarted(match, serverNow) {
  const kickoff = new Date(match.kickoffUtc).getTime();
  return serverNow >= kickoff;
}

function pickIntToChoice(v) {
  return v === 1 ? "team1" : v === 2 ? "team2" : v === 3 ? "tie" : null;
}

function choiceToPickInt(c) {
  return c === "team1" ? 1 : c === "team2" ? 2 : c === "tie" ? 3 : 0;
}

function getMatchIndex(matches, id) {
  return matches.findIndex(m => m.id === id);
}

function getPickLabel(match, choice) {
  if (choice === "team1") return match.team1;
  if (choice === "team2") return match.team2;
  return "Tie";
}

function lockedMsg(match, pick) {
  return `Your Pick: ${getPickLabel(match, pick)} <span style="color:red;font-weight:bold;">*LOCKED*</span>`;
}

/* =========================
   DATA HELPERS
========================= */
async function loadUserPredictions(db, userId) {
  const doc = await db.collection("users").doc(userId).get();
  return doc.exists ? doc.data().picks : new Array(73).fill(0);
}

async function saveUserPick(db, userId, matches, matchId, choice) {
  const docRef = db.collection("users").doc(userId);
  const doc = await docRef.get();

  let picks = new Array(73).fill(0);
  if (doc.exists) picks = [...doc.data().picks];

  picks[getMatchIndex(matches, matchId)] = choiceToPickInt(choice);

  await docRef.set({ picks }, { merge: true });
}


/* =========================
   PICK PERCENTAGE UTILITY
========================= */

/**
 * Calculate pick distribution for a match
 * 
 * @param {string} matchId
 * @param {Array} matches
 * @param {QuerySnapshot} usersSnap
 * @returns {Object} { t1, tie, t2, np }
 */
window.getPickPercentages = function (matchId, matches, usersSnap) {
  let t1 = 0, t2 = 0, tie = 0, np = 0;

  const idx = matches.findIndex(m => m.id === matchId);
  if (idx === -1) {
    console.warn("Match not found:", matchId);
    return { t1: 0, tie: 0, t2: 0, np: 0 };
  }

  const total = usersSnap.size; // ✅ total players

  usersSnap.forEach(doc => {
    const picks = doc.data().picks || [];
    const pick = picks[idx];

    if (pick === 1) t1++;
    else if (pick === 2) t2++;
    else if (pick === 3) tie++;
    else np++; // ✅ count no-pick
  });

  if (total === 0) {
    return { t1: 0, tie: 0, t2: 0, np: 0 };
  }

  return { t1, tie, t2, np };
};



/* =========================
   EXPOSE GLOBALS
========================= */
window.formatTimestampToEastern = formatTimestampToEastern;
window.renderTopbar = renderTopbar;
window.logout = logout;
window.fetchServerTime = fetchServerTime;
window.getEasternDateKey = getEasternDateKey;
window.formatPrettyDate = formatPrettyDate;
window.formatEasternTime = formatEasternTime;
window.groupMatches = groupMatches;
window.isLocked = isLocked;
window.isStarted = isStarted;
window.pickIntToChoice = pickIntToChoice;
window.choiceToPickInt = choiceToPickInt;
window.getMatchIndex = getMatchIndex;
window.getPickLabel = getPickLabel;
window.lockedMsg = lockedMsg;
window.loadUserPredictions = loadUserPredictions;
window.savePrediction = savePrediction;
``
