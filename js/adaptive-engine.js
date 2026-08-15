/**
 * adaptive-engine.js
 * ---------------------------------------------------------------------------
 * The "intelligence" layer of the dashboard.
 *
 * This file has no knowledge of the DOM. It only tracks interaction
 * signals and turns them into two kinds of decisions:
 *
 *   1. CONTENT decisions  — which category of card the user probably wants
 *      to see first. This is handled by an epsilon-greedy multi-armed
 *      bandit, a standard reinforcement-learning technique (Sutton & Barto,
 *      2018). Each content category is treated as one "arm." Every time the
 *      user reads or skips a card, that action produces a reward, and the
 *      engine updates its running estimate of how good that category is.
 *
 *   2. PRESENTATION decisions — whether the interface itself should get
 *      denser, roomier, or higher-contrast, based on how quickly and
 *      confidently the user is acting. This is the "adaptive UI" half of
 *      the assignment, kept deliberately separate from the bandit so the
 *      two concepts (adaptive UI vs. intelligent/AI-driven inference) stay
 *      distinct and are each easy to point to in the report.
 *
 * Everything here lives in memory for the current page session only.
 */

const AdaptiveEngine = (function () {

  // Epsilon-greedy bandit state: one running value estimate per category.
  const EPSILON = 0.15;      // probability of exploring instead of exploiting
  const LEARNING_RATE = 0.35; // how fast Q-values move toward new rewards

  const state = {
    categories: {},          // { categoryName: { q: number, n: number } }
    totalInteractions: 0,
    openTimestamps: {},      // cardId -> time card was opened, for dwell time
    renderTimestamp: null,   // when the current card set was last shown
    decisionTimes: [],       // ms between a render and the next interaction
    interactionTimestamps: [], // for measuring interaction speed/rate
  };

  function registerCategories(categoryNames) {
    categoryNames.forEach((name) => {
      if (!state.categories[name]) {
        state.categories[name] = { q: 0, n: 0 };
      }
    });
  }

  function noteRender() {
    state.renderTimestamp = performance.now();
  }

  function noteCardOpened(cardId) {
    state.openTimestamps[cardId] = performance.now();
    _recordDecisionTime();
  }

  /** Call when a card is closed/skipped after being read. Returns the reward applied. */
  function noteCardClosed(cardId, category) {
    const openedAt = state.openTimestamps[cardId];
    const dwellMs = openedAt ? performance.now() - openedAt : 0;
    delete state.openTimestamps[cardId];

    // Reward shaping: longer engaged reading = stronger positive signal.
    // Capped so one very long dwell can't dominate the estimate forever.
    const dwellSeconds = Math.min(dwellMs / 1000, 20);
    const reward = dwellSeconds < 1.2 ? -0.3 : Math.min(1, dwellSeconds / 8);

    _updateCategory(category, reward);
    return reward;
  }

  /** Call when a card is skipped without ever being opened. */
  function noteCardSkipped(category) {
    _recordDecisionTime();
    _updateCategory(category, -0.5);
    return -0.5;
  }

  function _updateCategory(category, reward) {
    registerCategories([category]);
    const c = state.categories[category];
    c.q = c.q + LEARNING_RATE * (reward - c.q);
    c.n += 1;
    state.totalInteractions += 1;
    state.interactionTimestamps.push(performance.now());
    if (state.interactionTimestamps.length > 12) state.interactionTimestamps.shift();
  }

  function _recordDecisionTime() {
    if (state.renderTimestamp == null) return;
    const dt = performance.now() - state.renderTimestamp;
    state.decisionTimes.push(dt);
    if (state.decisionTimes.length > 8) state.decisionTimes.shift();
  }

  /**
   * Epsilon-greedy ordering: with probability EPSILON, explore with a
   * shuffled order; otherwise exploit the current best-known categories,
   * highest estimated value first. Ties keep their original relative order.
   */
  function orderCategories(categoryNames) {
    registerCategories(categoryNames);
    const explore = Math.random() < EPSILON;
    if (explore) {
      return { order: _shuffle([...categoryNames]), mode: "explore" };
    }
    const ranked = [...categoryNames].sort(
      (a, b) => (state.categories[b]?.q ?? 0) - (state.categories[a]?.q ?? 0)
    );
    return { order: ranked, mode: "exploit" };
  }

  function _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function getPreferenceSnapshot() {
    return Object.entries(state.categories)
      .map(([name, v]) => ({ name, q: v.q, n: v.n }))
      .sort((a, b) => b.q - a.q);
  }

  /**
   * Presentation heuristics, recomputed after every interaction.
   * Kept simple and explainable on purpose: this is a demonstration of the
   * *mechanism* of adaptive UI, not a production-grade user model.
   */
  function getPresentationRecommendation() {
    const avgDecision = _average(state.decisionTimes);
    const recentGapAvg = _average(_gaps(state.interactionTimestamps));

    let density = "comfortable";
    let contrast = "normal";
    let reason = null;

    if (avgDecision != null && avgDecision > 4500) {
      // Long pauses before acting: give more breathing room and bigger text.
      density = "spacious";
      reason = { type: "density", value: "spacious", cause: "hesitation (slow decisions)" };
    } else if (recentGapAvg != null && recentGapAvg < 1500 && state.totalInteractions >= 4) {
      // Fast, confident, back-to-back actions: user knows what they want, show more.
      density = "compact";
      reason = { type: "density", value: "compact", cause: "rapid, confident interaction" };
    }

    // Independent signal: a burst of skips in a row suggests the content
    // itself, not the layout, is the mismatch — bump contrast so scanning
    // is easier while the bandit catches up on category preference.
    const recentSkipStreak = _recentSkipStreak();
    if (recentSkipStreak >= 3) {
      contrast = "high";
      reason = reason || { type: "contrast", value: "high", cause: "several skips in a row" };
    }

    return { density, contrast, reason };
  }

  const skipHistory = [];
  function noteOutcomeForStreak(wasSkip) {
    skipHistory.push(wasSkip);
    if (skipHistory.length > 6) skipHistory.shift();
  }
  function _recentSkipStreak() {
    let streak = 0;
    for (let i = skipHistory.length - 1; i >= 0; i--) {
      if (skipHistory[i]) streak++; else break;
    }
    return streak;
  }

  function _average(arr) {
    if (!arr || arr.length === 0) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  function _gaps(timestamps) {
    const gaps = [];
    for (let i = 1; i < timestamps.length; i++) gaps.push(timestamps[i] - timestamps[i - 1]);
    return gaps;
  }

  function reset() {
    state.categories = {};
    state.totalInteractions = 0;
    state.openTimestamps = {};
    state.renderTimestamp = null;
    state.decisionTimes = [];
    state.interactionTimestamps = [];
    skipHistory.length = 0;
  }

  return {
    registerCategories,
    noteRender,
    noteCardOpened,
    noteCardClosed,
    noteCardSkipped,
    noteOutcomeForStreak,
    orderCategories,
    getPreferenceSnapshot,
    getPresentationRecommendation,
    reset,
    _debugState: state, // exposed for the report's screenshots / manual inspection only
  };
})();
