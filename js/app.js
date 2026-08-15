/**
 * app.js
 * ---------------------------------------------------------------------------
 * DOM layer. Owns the content data, renders cards in whatever order the
 * AdaptiveEngine currently recommends, applies presentation changes to
 * <body>, and writes human-readable entries to the on-screen adaptation
 * log so the adaptation is visible while it happens (useful for both
 * grading and for taking report screenshots).
 */

const CONTENT = [
  {
    id: "c1",
    category: "AI & Machine Learning",
    title: "How Reinforcement Learning Powers Recommendation Feeds",
    excerpt: "A short walkthrough of how systems learn what you like from clicks, not surveys.",
    full: "Reinforcement learning treats every click, skip, and pause as a signal. Instead of asking users what they want, a bandit algorithm tries options, observes the outcome, and slowly shifts toward whatever earns a better response — the same idea driving this dashboard's own content ordering.",
    readTime: "3 min",
  },
  {
    id: "c2",
    category: "Design",
    title: "Designing Interfaces That Don't Wait to Be Told",
    excerpt: "Static layouts assume every user is the same user. Adaptive layouts don't.",
    full: "Traditional interface design freezes decisions at design time: one font size, one layout, for everyone. Adaptive UI pushes some of those decisions to runtime, letting the system respond to how a specific person is actually behaving right now.",
    readTime: "4 min",
  },
  {
    id: "c3",
    category: "Productivity",
    title: "Why Fewer Options Sometimes Move Faster",
    excerpt: "A compact, dense layout helps once someone already knows what they're doing.",
    full: "Novice users benefit from spacing, explanation, and larger targets. Expert users, moving fast and confident, are often better served by density — more information per screen, fewer clicks to get there.",
    readTime: "2 min",
  },
  {
    id: "c4",
    category: "Data Science",
    title: "Reading a Live Preference Estimate Without a Dashly Chart",
    excerpt: "Small, honest bar charts can say more than a polished dashboard.",
    full: "The preference bars in this demo update after every interaction. They are a direct, literal view into the bandit's internal state, which matters for a school project: an adaptive system should be explainable, not just effective.",
    readTime: "3 min",
  },
  {
    id: "c5",
    category: "AI & Machine Learning",
    title: "The Difference Between 'Adaptive' and 'Intelligent'",
    excerpt: "One responds to context. The other reasons about what you probably want.",
    full: "An adaptive interface changes its presentation in response to context or state. An intelligent interface goes a step further: it builds and reasons over a model of the user, task, or domain to decide what change would actually help. This dashboard tries to demonstrate both in one small system.",
    readTime: "3 min",
  },
  {
    id: "c6",
    category: "Design",
    title: "Accessibility Is an Adaptation Trigger Too",
    excerpt: "Hesitation, not just disability status, is a legitimate signal to increase contrast.",
    full: "Accessibility adaptation doesn't require a declared disability. Behavioral signals such as slow decisions, repeated re-reading, or misclicks are reasonable, privacy-respecting proxies a system can use to offer a more readable layout.",
    readTime: "2 min",
  },
  {
    id: "c7",
    category: "Productivity",
    title: "Skips Are Data Too",
    excerpt: "What a user avoids is often a cleaner signal than what they click.",
    full: "Negative feedback is easy to ignore in interface design because it's passive. But a fast skip is a real, low-noise signal, arguably more honest than a click made out of curiosity rather than genuine interest.",
    readTime: "2 min",
  },
  {
    id: "c8",
    category: "Data Science",
    title: "Cold Start: What a System Does Before It Knows You",
    excerpt: "Every adaptive system starts with a guess. This one starts with a shuffle.",
    full: "Before any interaction data exists, this dashboard's bandit has no basis for a ranking, so it explores near-randomly at first. That 'cold start' period is a known, unavoidable phase in almost every personalization system.",
    readTime: "3 min",
  },
];

const CATEGORY_ORDER_SEED = [...new Set(CONTENT.map((c) => c.category))];

const els = {
  grid: document.getElementById("cardGrid"),
  log: document.getElementById("adaptationLog"),
  prefBars: document.getElementById("prefBars"),
  signalStats: document.getElementById("signalStats"),
  resetBtn: document.getElementById("resetBtn"),
};

let cardsOpenState = {}; // cardId -> bool

function logEvent(message, kind) {
  const li = document.createElement("li");
  li.className = kind === "ai" ? "ai-event" : "ui-event";
  const time = new Date().toLocaleTimeString([], { hour12: false });
  li.innerHTML = `<span class="log-time">${time}</span>${message}`;
  els.log.appendChild(li);
  els.log.scrollTop = els.log.scrollHeight;
}

function renderPreferenceBars() {
  const snapshot = AdaptiveEngine.getPreferenceSnapshot();
  els.prefBars.innerHTML = "";
  if (snapshot.length === 0) {
    els.prefBars.innerHTML = '<p class="log-empty">No interactions yet — read or skip a card to begin.</p>';
    return;
  }
  const maxAbs = Math.max(1, ...snapshot.map((s) => Math.abs(s.q)));
  snapshot.forEach((s) => {
    const pct = Math.max(4, Math.round(((s.q + maxAbs) / (2 * maxAbs)) * 100));
    const row = document.createElement("div");
    row.className = "pref-row";
    row.innerHTML = `
      <div class="pref-label"><span>${s.name}</span><span>${s.q.toFixed(2)} (n=${s.n})</span></div>
      <div class="pref-track"><div class="pref-fill" style="width:${pct}%"></div></div>
    `;
    els.prefBars.appendChild(row);
  });
}

function renderSignalStats() {
  const st = AdaptiveEngine._debugState;
  const rec = AdaptiveEngine.getPresentationRecommendation();
  els.signalStats.innerHTML = "";
  const rows = [
    ["Total interactions", st.totalInteractions],
    ["Avg. decision time", st.decisionTimes.length ? Math.round(st.decisionTimes.reduce((a, b) => a + b, 0) / st.decisionTimes.length) + " ms" : "—"],
    ["Current density", document.body.dataset.density],
    ["Current contrast", document.body.dataset.contrast],
  ];
  rows.forEach(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    els.signalStats.appendChild(dt); els.signalStats.appendChild(dd);
  });
}

function applyPresentationIfChanged() {
  const rec = AdaptiveEngine.getPresentationRecommendation();
  const bodyEl = document.body;
  let changed = false;

  if (rec.density !== bodyEl.dataset.density) {
    bodyEl.dataset.density = rec.density;
    changed = true;
  }
  if (rec.contrast !== bodyEl.dataset.contrast) {
    bodyEl.dataset.contrast = rec.contrast;
    changed = true;
  }
  if (changed && rec.reason) {
    logEvent(
      `Adaptive UI: switched <strong>${rec.reason.type}</strong> to <strong>${rec.reason.value}</strong> — detected ${rec.reason.cause}.`,
      "ui"
    );
  }
}

function renderCards() {
  AdaptiveEngine.noteRender();
  const { order, mode } = AdaptiveEngine.orderCategories(CATEGORY_ORDER_SEED);

  const grouped = order.flatMap((cat) => CONTENT.filter((c) => c.category === cat));

  els.grid.innerHTML = "";
  grouped.forEach((item) => {
    const card = document.createElement("article");
    card.className = "card";
    card.id = "card-" + item.id;
    card.innerHTML = `
      <span class="card-tag">${item.category}</span>
      <h3>${item.title}</h3>
      <p class="excerpt">${item.excerpt}</p>
      <p class="meta">${item.readTime} read</p>
      <div class="full-text">${item.full}</div>
      <div class="card-actions">
        <button class="btn-read" data-id="${item.id}" data-cat="${item.category}">Read</button>
        <button class="btn-skip" data-id="${item.id}" data-cat="${item.category}">Skip</button>
      </div>
    `;
    els.grid.appendChild(card);
  });

  if (mode === "explore") {
    logEvent("AI layer: exploring — trying a fresh order to keep learning, not just repeating past winners.", "ai");
  } else {
    logEvent("AI layer: exploiting current preference estimates to order the feed.", "ai");
  }

  renderPreferenceBars();
  renderSignalStats();
}

function handleRead(id, category) {
  const card = document.getElementById("card-" + id);
  const isOpen = cardsOpenState[id];

  if (!isOpen) {
    card.classList.add("is-open");
    cardsOpenState[id] = true;
    AdaptiveEngine.noteCardOpened(id);
    card.querySelector(".btn-read").textContent = "Close";
  } else {
    card.classList.remove("is-open");
    cardsOpenState[id] = false;
    const reward = AdaptiveEngine.noteCardClosed(id, category);
    AdaptiveEngine.noteOutcomeForStreak(false);
    card.querySelector(".btn-read").textContent = "Read";
    logEvent(
      `AI layer: reading "${category}" produced reward ${reward.toFixed(2)} — preference estimate updated.`,
      "ai"
    );
    applyPresentationIfChanged();
    renderPreferenceBars();
    renderSignalStats();
    // Re-rank after a short delay so the user can see the reorder happen.
    setTimeout(renderCards, 700);
  }
}

function handleSkip(id, category) {
  AdaptiveEngine.noteCardSkipped(category);
  AdaptiveEngine.noteOutcomeForStreak(true);
  logEvent(`AI layer: skipped "${category}" — preference estimate lowered.`, "ai");
  applyPresentationIfChanged();
  renderPreferenceBars();
  renderSignalStats();
  setTimeout(renderCards, 500);
}

els.grid.addEventListener("click", (e) => {
  const readBtn = e.target.closest(".btn-read");
  const skipBtn = e.target.closest(".btn-skip");
  if (readBtn) handleRead(readBtn.dataset.id, readBtn.dataset.cat);
  if (skipBtn) handleSkip(skipBtn.dataset.id, skipBtn.dataset.cat);
});

els.resetBtn.addEventListener("click", () => {
  AdaptiveEngine.reset();
  cardsOpenState = {};
  document.body.dataset.density = "comfortable";
  document.body.dataset.contrast = "normal";
  els.log.innerHTML = "";
  logEvent("Session reset. Starting a fresh cold-start exploration phase.", "ai");
  renderCards();
});

// Initial render
renderCards();
