# Hush Music Show Games

A modern React (Vite + TypeScript) mobile game show hub featuring **16 classic TV game shows**, built with vs-computer play, online PvP rooms, text chat, live voice talk, friends system, and a Top 50 leaderboard — styled with the signature bronze/dark theme.

## The 16 Game Shows

| Game | Features & Content |
|---|---|
| 🧠 **Jeopardy!** | 4 full board sets (6 categories × 5 clues = 30 clues per board), Daily Double wagering, 12s timer, bot buzzing & accuracy, Final Jeopardy |
| 🎡 **Wheel of Fortune** | 48 puzzle banks, 24-segment wheel (Bankrupt / Lose a Turn), buying vowels ($250), consonant calling, solving, bot rivals |
| 💰 **Who Wants to Be a Millionaire** | 60 questions across 3 tiers, 15-rung money ladder ($100 to $1,000,000), 50:50, Phone a Friend, Ask the Audience, safe havens at $1,000 & $32,000 |
| 🏷️ **The Price Is Right** | Contestant's Row one-bid, Plinko pegboard drop, Showcase Showdown wheel, The Showcase bidding |
| 👪 **Family Feud** | 26 real survey questions with points, 3 strikes, steal rounds, Fast Money (5 rapid questions, 15s timer, 120-pt goal) |
| 🏃 **The Chase** | 60-second Cash Builder, Head-to-Head chase board vs Chaser, Final Chase sprint |
| ✏️ **Match Game** | 60 fill-in-the-blank prompts, 6 celebrity panel bots, rival matching |
| 🔑 **Password** | 85 words with 3 clues each, 10→1 point ladder, reveal clues or guess, bot rival steal |
| 💼 **Deal or No Deal** | 26 cases ($0.01–$1,000,000), EV-based Banker offers every round, Keep or Swap finale |
| 🍀 **Press Your Luck** | Trivia-earned spins, Big Board with cash & Big Bucks, Whammies (4 = out), Pass or Spin |
| 🔺 **The $100,000 Pyramid** | 42 Winner's Circle subject lists, 60-second timed rounds, fuzzy matching, skip option |
| 🔗 **Weakest Link** | Chain ladder ($1k to $200k), banking button, strategic bot voting, 5-question Head-to-Head shootout with Sudden Death |
| 💯 **1 vs 100** | You vs the Mob of 100, tiered questions ($1k, $2.5k, $5k), mob elimination, Poll/Ask/Double lifelines |
| 🎒 **Are You Smarter Than a 5th Grader?** | Grades 1–5 ladder ($1k to $25k), subject selection, Peek / Copy / Save cheats, Drop Out option |
| 🕵️ **What's My Line?** | 20 yes/no questions, 50 mystery occupations with answer matrices, panel bots, scoring by fewest questions |
| 🎬 **Hollywood Game Night** | 3-phase medley: Celebrity Clues + In Other Words (60s) + Quick Fire Trivia (60s), target 250 points |

## Systems & Architecture

- **Framework**: React 19 + Vite 6 + TypeScript.
- **Audio**: WebAudio synthesis engine for clicks, wins, losses, and buzzer sounds.
- **Points & Wallet**: 1,000 starting points, 500 daily bonus (claimable every 20 hours), CPU win payouts, PvP win bonuses (+200 ⭐).
- **Authentication**: Local demo accounts out of the box; seamless Firebase Authentication support when keys are provided.
- **Online PvP**: Create and join rooms via 4-digit codes with simultaneous question syncing and real-time settlement via `QuizPVP`.
- **Friends**: Player search and add by 6-character player code, request approval, online presence, and direct messaging.
- **Voice Chat**: LiveKit WebRTC connection powered by your Cloudflare Worker token server.
- **Leaderboard**: Top 50 point rankings, seeded with bots in demo mode and synced across accounts.
