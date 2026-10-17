# Hush Music Show Games

A single-file mobile game hub (no build step) with **16 TV game shows**, built just like the
hand-game hub: vs-computer play, online PvP rooms, text chat, voice talk, friends, and a Top 50
leaderboard. **Bronze/dark theme** (per your correction — not the hand hub's gold).

**File:** `index.html` (4,081 lines, ~255 KB, one file — open it anywhere)

## The 16 games (all vs computer with real rules + real content banks)

| Game | What's inside |
|---|---|
| 🧠 Jeopardy | 4 full board sets (6 categories × 5 clues = 120 clues), Daily Double, Final Jeopardy, 2 bot opponents |
| 🎡 Wheel of Fortune | 48 puzzles, 24-segment wheel (Bankrupt / Lose a Turn), buy vowels, solve |
| 💰 Who Wants to Be a Millionaire | 60 questions across 3 tiers, 15-rung money ladder, 50:50 / Phone a Friend / Ask the Audience, safe havens |
| 🏷️ The Price Is Right | Contestant's Row one-bid, Plinko, Showcase Showdown wheel, Showcase bid |
| 👪 Family Feud | 26 surveys with point values, strikes, steal, Fast Money |
| 🏃 The Chase | 65-question cash builder, head-to-head board vs Chaser bot, Final Chase |
| ✏️ Match Game | 60 fill-in-the-blanks, 6 celebrity bots to match |
| 🔑 Password | 85 words with clue lists, 10→1 point ladder |
| 🕵️ What's My Line? | 20 yes/no questions, 50 mystery occupations, panel bots |
| 🎬 Hollywood Game Night | 3-phase medley: Celebrity Clues + In Other Words + 60s Quick Fire |
| 💼 Deal or No Deal | 26 cases ($0.01–$1M), banker offers every round, keep/swap finale |
| 🍀 Press Your Luck | Trivia-earned spins, Whammies, pass option |
| 🔺 The $100,000 Pyramid | 42 Winner's Circle lists, 60-second timed rounds |
| 🔗 Weakest Link | Answer-chain bank building, vote-off rounds, head-to-head final |
| 💯 1 vs 100 | 100-bot mob, tiered questions, Poll/Ask/Double helps |
| 🎒 5th Grader | Grades 1–5 ladder (50 questions), Peek / Copy / Save cheats |

**Points:** 1,000 starting points + 500 daily bonus, same as the hand games. Wins pay per-game
payouts; PvP wins pay 200.

## Online systems (mirror the hand hub)

- **Auth:** demo mode (accounts on this device) until Firebase keys are pasted; then real
  email/password accounts via Firebase.
- **PvP rooms:** create/join by 4-digit code; quiz games share the SAME question set through the
  room, higher score wins. Realtime sync over Firebase RTDB.
- **Friends:** add by 6-digit player code (shown in Profile), requests accept/decline, online status.
- **Chat:** room chat + friend DMs.
- **Voice:** LiveKit via your Cloudflare Worker token server — paste the worker URL once in
  Profile → Setup; tap 🎤 in a room to auto-connect. Room names are `shg-<code>`.
  **No API secret is baked into the app** (the secret lives only in your worker).
- **Top 50:** points leaderboard, synced to Firebase when connected; demo bots seed it offline.
- All database paths are namespaced `shg_*` — nothing collides with the hand-game or board-game hubs.

## Phone-only launch steps

1. **GitHub:** create a new repo (e.g. `hush-music-show-games`), upload `index.html` to it
   (GitHub phone app or mobile site → Add file → Upload).
2. **Google AI Studio:** open [aistudio.google.com](https://aistudio.google.com), open your app
   project, **Step 1 pull** the new repo so the app serves this file.
3. **Firebase (Profile → Setup in the app):** paste your 5 Firebase web-config keys
   (apiKey, authDomain, databaseURL, projectId, appId) → Save → Reload. Same free Spark-plan
   project style as the hand games; you can reuse the same Firebase project.
4. **Voice (Profile → Setup):** paste your Cloudflare Worker LiveKit token-URL → Save.
   The worker must answer `GET <url>?room=<room>&identity=<name>` with `{token, url}`
   (you can reuse the board-games worker from 2026-10-17 if it returns the LiveKit URL too).
5. **Database rules:** in Firebase console → Realtime Database → Rules, add the `shg_*` paths:

```json
{
  "rules": {
    "shg_users":      { ".read": true, ".write": true },
    "shg_usernames":  { ".read": true, ".write": true },
    "shg_codes":      { ".read": true, ".write": true },
    "shg_friends":    { ".read": true, ".write": true },
    "shg_requests":   { ".read": true, ".write": true },
    "shg_presence":   { ".read": true, ".write": true },
    "shg_chat":       { ".read": true, ".write": true },
    "shg_rooms":      { ".read": true, ".write": true }
  }
}
```

Then Publish the rules. Without this, friends/PvP/leaderboard get permission-denied.

## Tests

`node tests/test.js` — **133 passed, 0 failed.** Covers: bank integrity (counts, no empty
strings, index ranges, feud point sums, pyramid 7-clue lists, password clue counts, What's My
Line boolean arrays), pure game logic (banker-offer math, wheel segments/spins, millionaire
ladder & 50:50, Price bid-winner logic, Jeopardy fuzzy grading, password 10→1 ladder, whammy
odds, mob elimination scaling, weakest-link chain, 5th-grader ladder, normalizers against the
real bank shapes), and static checks (all 16 games registered + in GAME_ORDER, masthead text,
`shg_` namespacing, no secrets baked in, bronze theme, no leftover inject markers).

Rebuild after editing parts: `node assemble.js` (re-injects the 4 part files into a fresh
`index.html`; re-run tests after).

## Build notes

- Built from `parts/`: `shell.html` (app framework) + `banks1.js` + `banks2.js` (content) +
  `games1.js` + `games2.js` (game logic).
- Two integration bugs were found and fixed during assembly: the What's My Line / Pyramid /
  Hollywood normalizers vs the real bank shapes, and the PvP settle flow vs the shell's
  QuizPVP contract. Both are covered by tests now.
- Trademark note (same as the Candy Land → Sugar Trail situation): all 16 titles are real
  show trademarks — rename decision is yours.
