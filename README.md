# Adaptive Focus Dashboard

A small, self-contained demonstration of **AI-based adaptive human-computer interaction**, built for the *AI-Based Adaptive Human-Computer Interaction* assignment.

The dashboard is a content feed. As you interact with it, two separate systems adapt in real time:

1. **An intelligent (AI) layer** — an epsilon-greedy multi-armed bandit that learns which content categories you engage with and re-ranks the feed accordingly.
2. **An adaptive UI layer** — a set of heuristics that watch how quickly and confidently you act, and adjust layout density and contrast in response.

Both layers write plain-language entries to an on-screen **Adaptation Log** so the adaptation is visible while it happens, not just inferred from behavior.

No backend, no build step, no external dependencies. Everything runs client-side, in memory, for the current browser tab only.

## Running it

Open `index.html` directly in any modern browser, or serve the folder locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## How to see it adapt

- Click **Read** on two or three cards from the same category and leave them open for several seconds before closing them. Watch the **Learned Category Preferences** bars shift, and that category's cards move up the feed.
- Click **Skip** quickly on several cards in a row. Watch the log report a contrast change.
- Interact slowly and pause between actions. Watch the log report a switch to a more spacious layout.
- Interact quickly and repeatedly. Watch the log report a switch to a denser layout.
- Click **Reset Demo** at any time to clear all learned state and start over from a cold start.

## Project structure

```
adaptive-ui-hci-project/
├── index.html              Page structure and panel layout
├── css/
│   └── style.css           All visual states (density, contrast) via CSS custom properties
├── js/
│   ├── adaptive-engine.js  The AI layer: bandit + presentation heuristics, no DOM code
│   └── app.js               DOM layer: rendering, event handling, the adaptation log
└── screenshots/            Screenshots referenced in the accompanying report
```

`adaptive-engine.js` and `app.js` are deliberately split so the "intelligence" (what should change and why) is independent of the "presentation" (how it's drawn). That separation is also what the accompanying report uses to distinguish *intelligent* user interfaces from *adaptive* user interfaces conceptually, while showing both implemented in one working system.

## How the AI layer works (short version)

Each content category is treated as one arm of a multi-armed bandit (Sutton & Barto, 2018). Every read or skip produces a reward:

- A card read and left open for a while → a positive reward proportional to dwell time.
- A card opened and closed almost immediately → a small negative reward.
- A card skipped outright → a larger negative reward.

The engine keeps a running value estimate per category and updates it with each reward. When re-ranking the feed, it exploits its current best estimate most of the time, but explores a shuffled order roughly 15% of the time so it keeps learning instead of freezing on an early guess (the classic exploration/exploitation trade-off).

## How the adaptive UI layer works (short version)

Separately from the bandit, the engine tracks two raw signals: how long the user pauses before acting (decision time), and how close together consecutive actions land (interaction rate). Long pauses trigger a switch to a more spacious, larger-text layout, reasoning that hesitation is a plausible proxy for difficulty reading or deciding. Fast, back-to-back actions trigger a denser layout, on the reasoning that a confident, fast-moving user benefits from seeing more at once. A run of consecutive skips triggers a high-contrast mode, on the reasoning that if the content itself isn't landing, making everything easier to scan can help while the AI layer catches up.

## AI tool disclosure

This project's code, structure, and documentation were generated with assistance from Claude (Anthropic), an AI assistant, based on the assignment requirements provided by the author. The author reviewed, tested, and is responsible for the submitted work. See the accompanying report for the full disclosure required by the assignment.

## References

Alvarez-Cortes, V., Zarate, V. H., Ramirez Uresti, J. A., & Zayas, B. E. (2009). Current challenges and applications for adaptive user interfaces. In I. Maurtua (Ed.), *Human-computer interaction*. IntechOpen. https://doi.org/10.5772/7745

Maybury, M. T. (1999). Intelligent user interfaces: An introduction. In *Proceedings of the 4th International Conference on Intelligent User Interfaces* (pp. 3–4). Association for Computing Machinery. https://doi.org/10.1145/291080.291081

Sutton, R. S., & Barto, A. G. (2018). *Reinforcement learning: An introduction* (2nd ed.). MIT Press.
