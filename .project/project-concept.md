# SonarPoppy

Shared muziek-aanbevelingsbackend die twee apps (SonarPop & Poppy) voedt met gepersonaliseerde track recommendations.

## Wat doet het?

SonarPoppy is een REST API die muziekaanbevelingen genereert op basis van drie pijlers:

1. **Genre Vectors** — Elke track heeft een 20-dimensionale genre vector (berekend uit Last.fm tags). Cosine similarity tussen een gebruikersprofiel en track vectors bepaalt hoe goed een track past.
2. **Collaborative Filtering** — Last.fm's `track.getSimilar` en `artist.getSimilar` als aanvullend signaal. Tracks die lijken op wat je al luistert scoren hoger.
3. **User Feedback** — Likes, dislikes, library-adds en skips beïnvloeden scores via multipliers. Het systeem leert van je gedrag.

## Hoe werkt het?

```
[Gebruiker kiest genres + artiesten]
        ↓
[Onboarding → Genre Sliders → Profielvector (20-dim)]
        ↓
[Profielvector × Track genreVectors → cosine similarity score]
        ↓
[Hybride scoring: (genre × α + CF × β) × feedback multiplier]
        ↓
[Dial bubbel-filter: stand 1-5 bepaalt welke tracks erdoor komen]
        ↓
[Blacklist filter → Paginatie → Response met scores + breakdown]
```

## Kernconcepten

### Dial System

5 standen die bepalen hoe avontuurlijk de aanbevelingen zijn. Scoring is altijd 50/50 (genre + CF), maar de dial filtert tracks op genre-match drempel en bepaalt de sortering:

- **Stand 1-2**: Strikt — alleen hoge genre-match (in-bubble)
- **Stand 3**: Gebalanceerd — geen filter
- **Stand 4**: Ontdekken — genre-inversie, alleen onbeluisterde tracks
- **Stand 5**: Anti-bubbel — pure random

### Genre Sliders

Per-user gewichten voor de 20 genres. Evolueren automatisch met feedback (like op rock-track → rock slider omhoog). Lock-optie per genre om controle te houden. Presets voor opgeslagen snapshots.

### Dual Auth

- **API Key** (X-API-Key) — identificeert de app, developer bakt dit in de frontend
- **JWT** (Bearer token) — identificeert de gebruiker, userId wordt automatisch geëxtraheerd

## Twee apps, één backend

|            | SonarPop                   | Poppy        |
| ---------- | -------------------------- | ------------ |
| Onboarding | Min 3 genres + 3 artiesten | Min 3 genres |
| Sliders    | Ja (genre finetuning)      | Nee          |
| Presets    | Ja (5 slots)               | Nee          |

## Tech Stack

- **Runtime**: Node.js (ES modules)
- **Framework**: Express 5
- **Database**: MongoDB / Mongoose 9
- **Externe data**: Last.fm API (tags, similarity, artist info), Spotify API (metadata)
- **Testing**: node:test + mongodb-memory-server
