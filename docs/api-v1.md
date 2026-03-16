# SonarPoppy API Endpoints

Zie [getting-started.md](getting-started.md) voor account aanmaken, API key ophalen en headers.

---

## Overzicht

| Method | Pad                                | Wat doet het?                                |
|--------|------------------------------------|----------------------------------------------|
| GET    | `/api/v1/genres`                   | 20 genres ophalen                            |
| GET    | `/api/v1/tracks`                   | Alle tracks ophalen                          |
| POST   | `/api/v1/onboarding`               | Cold start: genres + artiesten kiezen        |
| POST   | `/api/v1/profile/compute`          | Profielvector berekenen                      |
| POST   | `/api/v1/recommendations`          | Aanbevelingen ophalen                        |
| GET    | `/api/v1/dial`                     | 5 dial standen bekijken                      |
| GET    | `/api/v1/sliders`                  | Genre sliders ophalen (Onboarding required)  |
| PUT    | `/api/v1/sliders`                  | Sliders aanpassen (Onboarding required)      |
| POST   | `/api/v1/sliders/reset`            | Sliders resetten (Onboarding required)       |
| GET    | `/api/v1/slider-presets`           | Alle presets ophalen (Onboarding required)   |
| POST   | `/api/v1/slider-presets`           | Preset aanmaken (Onboarding required)        |
| PATCH  | `/api/v1/slider-presets/:id`       | Preset updaten (Onboarding required)         |
| DELETE | `/api/v1/slider-presets/:id`       | Preset verwijderen (Onboarding required)     |
| POST   | `/api/v1/slider-presets/:id/apply` | Preset toepassen op sliders (Onboard req)    |
| POST   | `/api/v1/feedback`                 | Like/dislike/skip (Onboarding required)      |
| GET    | `/api/v1/feedback`                 | Alle feedback van user (Onboarding required) |
| GET    | `/api/v1/feedback/:trackId`        | Feedback voor 1 track (Onboarding required)  |
| DELETE | `/api/v1/feedback/:trackId`        | Feedback verwijderen (Onboarding required)   |
| POST   | `/api/v1/feedback/:trackId/play`   | Play count +1 (Onboarding required)          |
| GET    | `/api/v1/blacklist`                | Geblokkeerde items (Onboarding required)     |
| POST   | `/api/v1/blacklist`                | Track/artiest/genre blokkeren (Onboard req)  |
| DELETE | `/api/v1/blacklist/:entryId`       | Blokkering opheffen (Onboarding required)    |
| POST   | `/api/v1/tracks/ingest`            | Enkele track importeren (beheer)             |
| POST   | `/api/v1/tracks/ingest-batch`      | Batch track import (beheer)                  |
| POST   | `/api/v1/tracks/enrich-spotify`    | Spotify metadata toevoegen (beheer)          |
| POST   | `/api/v1/tracks/enrich-deezer`     | Deezer previewUrl toevoegen (beheer)         |
| POST   | `/api/v1/tracks/enrich-cf`         | CF data toevoegen (beheer)                   |

Alle endpoints (behalve auth) vereisen twee headers:

- **`Authorization: Bearer <token>`** — JWT token van de ingelogde gebruiker (per user, uit login response)
- **`X-API-Key: sk_live_...`** — API key van de app (per app, door developer eenmalig aangemaakt)

De API key identificeert de **app**, niet de gebruiker. Eén key wordt gedeeld door alle eindgebruikers van dezelfde
frontend. De server haalt `userId` automatisch uit het JWT token — je hoeft dit niet mee te sturen.
Zie [getting-started.md](getting-started.md).

> **Let op: Onboarding is verplicht.** Endpoints voor personalisatie (zoals aanbevelingen, sliders, feedback en
> blacklist) vereisen dat de gebruiker de onboarding heeft voltooid. Als dit niet zo is, retourneren deze routes een **403
Forbidden** met de melding `Onboarding is nog niet voltooid`. Je kunt controleren of een gebruiker onboarding heeft
> voltooid door het `hasCompletedOnboarding` veld in de `/auth/me` response (of na login) te bekijken.

---

## Genres & Tracks

### GET /api/v1/genres

Retourneert de 20 genres. Gebruik dit om genre-keuzes te tonen (onboarding, sliders).

```json
{
  "items": [
    {
      "index": 0,
      "name": "rock"
    },
    {
      "index": 1,
      "name": "pop"
    },
    {
      "index": 2,
      "name": "electronic"
    }
  ],
  "_links": {
    "self": {
      "href": "/api/v1/genres"
    }
  }
}
```

De `index` is de positie in genre-vectors (0-19). Je hebt dit normaal niet direct nodig.

---

### GET /api/v1/tracks

Alle tracks uit de database. Let op: dit kan een grote response zijn.

```json
{
  "items": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "title": "Bohemian Rhapsody",
      "artist": "Queen",
      "genreVector": [
        0.45,
        0.12,
        0.0
      ],
      "lastfmTags": [
        "classic rock",
        "rock"
      ],
      "imageUrl": "https://...",
      "previewUrl": "https://cdns-preview-d.dzcdn.net/..."
    }
  ],
  "_links": {
    "self": {
      "href": "/api/v1/tracks"
    }
  }
}
```

---

## Profiel & Recommendations

### POST /api/v1/onboarding

Cold start voor nieuwe gebruikers. Laat de gebruiker genres kiezen en optioneel artiesten. Het systeem maakt dan een
profiel + sliders aan.

**Request:**

```json
{
  "genres": [
    "rock",
    "electronic",
    "jazz"
  ],
  "artists": [
    "Radiohead",
    "Daft Punk"
  ],
  "app": "sonarpop"
}
```

| Veld      | Type     | Verplicht | Beschrijving                                                |
|-----------|----------|-----------|-------------------------------------------------------------|
| `genres`  | string[] | ja        | Gekozen genres (min 3 voor SonarPop, min 3 voor Poppy)      |
| `artists` | string[] | nee       | Favoriete artiesten — hun Last.fm tags boosten genres extra |
| `app`     | string   | nee       | `"sonarpop"` of `"poppy"` — bepaalt validatieregels         |

> `userId` wordt automatisch uit het JWT token gehaald. Niet meesturen.

**Response (201):**

De database wordt bijgewerkt en de flag `hasCompletedOnboarding` op het User object wordt op `true` gezet.

```json
{
  "profile": {
    "vector": [
      0.4,
      0.1,
      0.35,
      "..."
    ],
    "meta": {
      "activeGenres": 3,
      "topGenre": "rock"
    }
  },
  "sliders": {
    "rock": 1.5,
    "electronic": 1.3,
    "jazz": 1.2,
    "pop": 1.0
  },
  "_links": {
    "self": {
      "href": "/api/v1/onboarding"
    },
    "sliders": {
      "href": "/api/v1/sliders"
    },
    "recommendations": {
      "href": "/api/v1/recommendations"
    }
  }
}
```

| Fout | Wanneer                                                    |
|------|------------------------------------------------------------|
| 400  | Verplichte velden missen, te weinig genres, ongeldig genre |

---

### POST /api/v1/profile/compute

Berekent een profielvector. Dit is de input voor `/recommendations`.

**Request:**

```json
{}
```

| Veld      | Type   | Verplicht | Beschrijving                                                                                                  |
|-----------|--------|-----------|---------------------------------------------------------------------------------------------------------------|
| `weights` | object | nee       | Handmatige genre weights, bijv. `{"rock": 0.8, "jazz": 0.3}`. Fallback als geen sliders gevonden voor de user |

> `userId` wordt automatisch uit het JWT token gehaald. Zonder sliders en zonder `weights` → cold start vector (alle
> genres gelijk).

**Response:**

```json
{
  "vector": [
    0.5,
    0.0,
    0.3125,
    0.0,
    0.0,
    0.1875
  ],
  "meta": {
    "activeGenres": 3,
    "topGenre": "rock"
  },
  "_links": {
    "self": {
      "href": "/api/v1/profile/compute"
    },
    "recommendations": {
      "href": "/api/v1/recommendations"
    }
  }
}
```

---

### POST /api/v1/recommendations

Het hoofdendpoint. Retourneert gepersonaliseerde track-aanbevelingen gesorteerd op score.

**Request:**

```json
{
  "profileVector": [
    0.5,
    0.0,
    0.3125,
    0.0,
    0.0,
    0.1875,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0
  ],
  "limit": 10,
  "offset": 0,
  "dial": 3
}
```

| Veld                 | Type     | Verplicht | Beschrijving                                                                                                          |
|----------------------|----------|-----------|-----------------------------------------------------------------------------------------------------------------------|
| `profileVector`      | number[] | ja        | 20-dim vector uit `/profile/compute`                                                                                  |
| `limit`              | number   | nee       | Max resultaten (default: alle)                                                                                        |
| `offset`             | number   | nee       | Skip eerste N (voor paginatie)                                                                                        |
| `dial`               | number   | nee       | Stand 1-5. 1=voorspelbaar, 5=verrassend                                                                               |
| `weights`            | object   | nee       | Custom `{"genre": 0.6, "cf": 0.4}` (wordt genegeerd als `dial` is meegegeven)                                         |
| `filters.minScore`   | number   | nee       | Minimum score (0.0-1.0)                                                                                               |
| `filters.excludeIds` | string[] | nee       | Track IDs om over te slaan                                                                                            |
| `filters.genre`      | string   | nee       | Filter op dominant genre, bijv. `"rock"`. Retourneert alleen tracks waarvan het hoogste genre in genreVector matcht   |
| `filters.artist`     | string   | nee       | Filter op artiest (case-insensitive exact match)                                                                      |
| `filters.sort`       | string   | nee       | Sort-override: `"genreSim"`, `"cf"`, `"random"`, of `"recent"`. Vervangt dial sortSignal, bubbel-filter blijft actief |
| `filters.explicit`   | boolean  | nee       | `true` = alleen explicit, `false` = geen explicit, `null`/ontbrekend = geen filter                                    |
| `filters.unplayed`   | boolean  | nee       | `true` = alleen tracks zonder feedback/plays                                                                          |
| `filters.recentDays` | number   | nee       | Alleen tracks geïngest in de laatste N dagen                                                                          |

> `userId` wordt automatisch uit het JWT token gehaald (voor feedback multiplier + blacklist filtering).

> **Prioriteit:** `dial` > `weights` > default (stand 3)

**Response:**

```json
{
  "tracks": [
    {
      "track": {
        "_id": "507f1f77bcf86cd799439011",
        "title": "Bohemian Rhapsody",
        "artist": "Queen",
        "genreVector": [
          0.45,
          0.12
        ]
      },
      "finalScore": 0.87,
      "signals": {
        "genre": 0.82,
        "cf": 0.91
      },
      "appliedWeights": {
        "genre": 0.5,
        "cf": 0.5
      },
      "feedbackMultiplier": 1.1
    }
  ],
  "total": 42,
  "meta": {
    "scoredAt": "2026-03-10T12:00:00.000Z",
    "avgScore": 0.45,
    "scoreRange": {
      "min": 0.12,
      "max": 0.92
    },
    "activeSignals": [
      "genre",
      "cf"
    ],
    "dialPosition": 3
  }
}
```

| Veld                          | Wat is het?                                               |
|-------------------------------|-----------------------------------------------------------|
| `tracks[].finalScore`         | De uiteindelijke score (0-1). Hoger = beter match         |
| `tracks[].signals.genre`      | Hoe goed de track qua genre past (cosine similarity)      |
| `tracks[].signals.cf`         | Collaborative filtering score (null als niet beschikbaar) |
| `tracks[].feedbackMultiplier` | Boost/penalty van eerdere likes/dislikes (default 1.0)    |
| `total`                       | Totaal aantal resultaten (voor paginatie)                 |
| `meta.dialPosition`           | Welke dial stand is gebruikt                              |

---

### GET /api/v1/dial

Toont de 5 dial standen. Gebruik dit om een slider/keuze UI te bouwen.

**Response:**

```json
{
  "presets": [
    {
      "position": 1,
      "name": "Strikt",
      "description": "Blijft dicht bij je smaak. Alleen tracks met hoge genre-match.",
      "filter": {
        "type": "minGenreSim",
        "threshold": 0.6
      },
      "sortSignal": "genreSim",
      "unplayedOnly": false
    },
    {
      "position": 3,
      "name": "Gebalanceerd",
      "filter": {
        "type": "none",
        "threshold": null
      },
      "sortSignal": "genreSim",
      "unplayedOnly": false
    },
    {
      "position": 5,
      "name": "Anti-bubbel",
      "filter": {
        "type": "none",
        "threshold": null
      },
      "sortSignal": "random",
      "unplayedOnly": false
    }
  ],
  "default": 3
}
```

De dial is een bubbel-filter: scoring is altijd 50/50 (genre/CF), de dial bepaalt welke tracks erdoor komen en hoe ze
gesorteerd worden. Zie [docs/dial-system.md](dial-system.md) voor de volledige uitleg.

---

## Sliders

> `userId` wordt automatisch uit het JWT token gehaald bij alle slider endpoints.

### GET /api/v1/sliders

Retourneert de genre slider waarden voor de ingelogde gebruiker. (Onboarding required)

**Response:**

```json
{
  "sliders": {
    "rock": 1.5,
    "pop": 1.0,
    "electronic": 1.3,
    "jazz": 0.5
  },
  "locked": [
    "rock"
  ],
  "updatedAt": "2026-03-10T12:00:00.000Z"
}
```

| Veld        | Beschrijving                                                      |
|-------------|-------------------------------------------------------------------|
| `sliders`   | Object met genre→gewicht. Hogere waarde = genre telt zwaarder mee |
| `locked`    | Genres die niet automatisch mee-evolueren met feedback            |
| `updatedAt` | Laatste wijziging (null als cold start defaults)                  |

Als de gebruiker nog geen sliders heeft → cold start: alle genres op 1.0, locked leeg.

---

### PUT /api/v1/sliders

Update slider waarden en/of locked genres voor de ingelogde gebruiker. (Onboarding required) Je hoeft niet alle genres
mee te sturen — alleen de gewijzigde.

**Request:**

```json
{
  "sliders": {
    "rock": 2.0,
    "pop": 0.3
  },
  "locked": [
    "rock"
  ]
}
```

**Response:** zelfde shape als GET.

| Fout | Wanneer                                            |
|------|----------------------------------------------------|
| 400  | Onbekend genre in `sliders` keys of `locked` array |
| 401  | Geen geldig JWT token                              |

---

### POST /api/v1/sliders/reset

Reset alle sliders naar 1.0 en maakt locked leeg voor de ingelogde gebruiker. (Onboarding required)

**Response:** zelfde shape als GET, alle sliders op 1.0.

| Fout | Wanneer                                  |
|------|------------------------------------------|
| 404  | Gebruiker heeft nog geen slider document |
| 401  | Geen geldig JWT token                    |

---

## Slider Presets

5 preset slots per user voor slider snapshots (weights + locked genres). Bij de eerste GET worden 3 defaults
aangemaakt (Balanced, Chill Vibes, High Energy). Alle presets zijn vrij aanpasbaar en verwijderbaar. Max 5 per user,
unieke naam.

> `userId` wordt automatisch uit het JWT token gehaald. Onboarding required voor alle preset endpoints.

### GET /api/v1/slider-presets

Retourneert alle presets voor de ingelogde gebruiker. Bij eerste aanroep worden 3 defaults aangemaakt.

**Response:**

```json
[
  {
    "_id": "preset-id-1",
    "userId": "user123",
    "name": "Balanced",
    "sliders": {
      "rock": 1.0,
      "pop": 1.0,
      "electronic": 1.0
    },
    "locked": [],
    "isDefault": true
  },
  {
    "_id": "preset-id-2",
    "userId": "user123",
    "name": "Chill Vibes",
    "sliders": {
      "jazz": 1.5,
      "soul": 1.3,
      "electronic": 1.2
    },
    "locked": [],
    "isDefault": true
  }
]
```

---

### POST /api/v1/slider-presets

Maak een nieuwe preset aan.

**Request:**

```json
{
  "name": "Mijn Rock Preset",
  "sliders": {
    "rock": 2.0,
    "metal": 1.5,
    "pop": 0.3
  },
  "locked": [
    "rock"
  ]
}
```

| Veld      | Type     | Verplicht | Beschrijving                                  |
|-----------|----------|-----------|-----------------------------------------------|
| `name`    | string   | ja        | Unieke naam voor de preset                    |
| `sliders` | object   | nee       | Genre→gewicht mapping (default: `{}`)         |
| `locked`  | string[] | nee       | Genres die niet mee-evolueren (default: `[]`) |

**Response (201):** de aangemaakte preset.

| Fout | Wanneer                         |
|------|---------------------------------|
| 400  | Naam ontbreekt of max 5 bereikt |
| 409  | Naam bestaat al voor deze user  |

---

### PATCH /api/v1/slider-presets/:presetId

Update een bestaande preset. Alleen meegegeven velden worden overschreven.

**Request:**

```json
{
  "name": "Nieuwe naam",
  "sliders": {
    "rock": 1.8
  },
  "locked": [
    "rock",
    "jazz"
  ]
}
```

**Response:** de geüpdatete preset.

| Fout | Wanneer                        |
|------|--------------------------------|
| 404  | Preset niet gevonden           |
| 409  | Naam bestaat al voor deze user |

---

### DELETE /api/v1/slider-presets/:presetId

Verwijdert een preset. **204** No Content bij succes.

| Fout | Wanneer              |
|------|----------------------|
| 404  | Preset niet gevonden |

---

### POST /api/v1/slider-presets/:presetId/apply

Past een preset toe op de actieve genre sliders. Overschrijft de huidige sliders en locked genres volledig.

**Response:** de geüpdatete sliders (zelfde shape als GET /sliders).

```json
{
  "sliders": {
    "rock": 2.0,
    "metal": 1.5,
    "pop": 0.3
  },
  "locked": [
    "rock"
  ],
  "updatedAt": "2026-03-16T12:00:00.000Z"
}
```

| Fout | Wanneer              |
|------|----------------------|
| 404  | Preset niet gevonden |

---

## Feedback

### POST /api/v1/feedback

Registreert een like, dislike, library-add of skip. Upsert: maakt nieuw aan of update bestaand.

**Request:**

```json
{
  "trackId": "507f1f77bcf86cd799439011",
  "action": "like"
}
```

| Veld      | Type   | Verplicht | Beschrijving                                    |
|-----------|--------|-----------|-------------------------------------------------|
| `trackId` | string | ja        | Track `_id`                                     |
| `action`  | string | nee       | `"like"`, `"dislike"`, `"library"`, of `"skip"` |

> `userId` wordt automatisch uit het JWT token gehaald.

**Response (201):**

```json
{
  "_id": "...",
  "userId": "user123",
  "trackId": "507f1f77bcf86cd799439011",
  "action": "like",
  "playCount": 0,
  "lastPlayedAt": null
}
```

> Feedback beinvloedt de `feedbackMultiplier` in recommendations. Like = hogere score, dislike = lagere score.

---

### GET /api/v1/feedback

Alle feedback van de ingelogde gebruiker. (Onboarding required) Response is een array.

```json
[
  {
    "_id": "...",
    "userId": "user123",
    "trackId": "...",
    "action": "like",
    "playCount": 5,
    "lastPlayedAt": "..."
  },
  {
    "_id": "...",
    "userId": "user123",
    "trackId": "...",
    "action": "dislike",
    "playCount": 0,
    "lastPlayedAt": null
  }
]
```

---

### GET /api/v1/feedback/:trackId

Feedback voor een specifiek user-track paar. (Onboarding required) **404** als niet gevonden.

---

### DELETE /api/v1/feedback/:trackId

Verwijdert feedback. (Onboarding required) **204** No Content bij succes, **404** als niet gevonden.

---

### POST /api/v1/feedback/:trackId/play

Verhoogt de play count met 1 en update `lastPlayedAt`. (Onboarding required) Maakt feedback aan als die nog niet
bestaat.

---

## Blacklist

> `userId` wordt automatisch uit het JWT token gehaald bij alle blacklist endpoints. (Onboarding required)

### GET /api/v1/blacklist

Retourneert alle geblokkeerde items voor de ingelogde gebruiker. (Onboarding required)

**Response:**

```json
{
  "userId": "<jwt-user-id>",
  "entries": [
    {
      "_id": "entry-id-1",
      "type": "artist",
      "value": "Nickelback"
    },
    {
      "_id": "entry-id-2",
      "type": "genre",
      "value": "metal"
    },
    {
      "_id": "entry-id-3",
      "type": "track",
      "value": "507f1f77bcf86cd799439011"
    }
  ],
  "_links": {
    "self": "/api/v1/blacklist",
    "add": "/api/v1/blacklist"
  }
}
```

Geen blacklist? → `entries: []` (geen 404).

---

### POST /api/v1/blacklist

Blokkeer een track, artiest of genre voor de ingelogde gebruiker. (Onboarding required)

**Request:**

```json
{
  "type": "artist",
  "value": "Nickelback"
}
```

| Veld    | Type   | Verplicht | Opties                                 |
|---------|--------|-----------|----------------------------------------|
| `type`  | string | ja        | `"track"`, `"artist"`, of `"genre"`    |
| `value` | string | ja        | Track `_id`, artiestnaam, of genrenaam |

> Genre aliassen worden automatisch omgezet: `"classic rock"` → `"rock"`.

**Response (201):** volledige blacklist (zelfde shape als GET).

| Fout | Wanneer                                                |
|------|--------------------------------------------------------|
| 400  | Type of value ontbreekt, ongeldig type, ongeldig genre |
| 401  | Geen geldig JWT token                                  |
| 409  | Entry bestaat al                                       |

---

### DELETE /api/v1/blacklist/:entryId

Verwijder een specifieke blokkering. Gebruik het `_id` veld uit de entries array. (Onboarding required)

**Response:** volledige blacklist na verwijdering (zelfde shape als GET).

| Fout | Wanneer                                           |
|------|---------------------------------------------------|
| 401  | Geen geldig JWT token                             |
| 404  | Blacklist niet gevonden, of entryId niet gevonden |

---

## Backend/Beheer Endpoints

> Deze endpoints zijn voor het vullen en verrijken van de database. Als frontend-developer heb je deze normaal niet
> nodig.

### POST /api/v1/tracks/ingest

Importeert een track via Last.fm (haalt tags op, berekent genre-vector).

```json
{
  "artist": "Queen",
  "title": "Bohemian Rhapsody",
  "force": false
}
```

### POST /api/v1/tracks/ingest-batch

Importeert meerdere tracks.

```json
{
  "tracks": [
    {
      "artist": "Queen",
      "title": "Bohemian Rhapsody"
    },
    {
      "artist": "Radiohead",
      "title": "Creep"
    }
  ],
  "force": false
}
```

### POST /api/v1/tracks/enrich-spotify

Verrijkt tracks met Spotify metadata (spotifyId, uri, duration, albumImages). **503** als Spotify credentials niet
geconfigureerd.

```json
{
  "batchSize": 50
}
```

### POST /api/v1/tracks/enrich-deezer

Verrijkt tracks met Deezer metadata (previewUrl).

```json
{
  "batchSize": 50
}
```

### POST /api/v1/tracks/enrich-cf

Verrijkt tracks met Last.fm collaborative filtering data (similarTracks, similarArtists).

```json
{
  "batchSize": 50
}
```

---

## Voorbeelden (JavaScript)

### Helper functie

```js
const TOKEN = "eyJhbG..."; // JWT uit login response
const API_KEY = "sk_live_..."; // API key uit api-keys response
const BASE = "http://145.24.237.95:8000/api/v1";

async function api(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${TOKEN}`,
            "X-API-Key": API_KEY,
            ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    if (res.status === 204) return null;
    return res.json();
}
```

### Onboarding

```js
// userId wordt automatisch uit JWT gehaald — niet meesturen
const {profile, sliders} = await api("/onboarding", {
    method: "POST",
    body: {
        genres: ["rock", "electronic", "jazz"],
        artists: ["Radiohead"],
        app: "sonarpop",
    },
});
```

### Recommendations ophalen

```js
// Profiel berekenen (userId uit JWT, sliders uit DB)
const {vector} = await api("/profile/compute", {
    method: "POST",
    body: {},
});

// Aanbevelingen ophalen (userId uit JWT voor feedback/blacklist filtering)
const {tracks, total} = await api("/recommendations", {
    method: "POST",
    body: {
        profileVector: vector,
        limit: 10,
        dial: 3,
    },
});

// Met filters: "Rock for You" playlist
const rockTracks = await api("/recommendations", {
    method: "POST",
    body: {
        profileVector: vector,
        limit: 20,
        filters: {
            genre: "rock",
            explicit: false,
            sort: "recent",
        },
    },
});

// Toon tracks
tracks.forEach(({track, finalScore}) => {
    console.log(`${track.artist} - ${track.title} (${(finalScore * 100).toFixed(0)}%)`);
});
```

### Like/dislike

```js
await api("/feedback", {
    method: "POST",
    body: {trackId: tracks[0].track._id, action: "like"},
});
```

### Artiest blokkeren

```js
// userId wordt automatisch uit het JWT token gehaald
await api("/blacklist", {
    method: "POST",
    body: {type: "artist", value: "Nickelback"},
});
```

### Feedback voor track ophalen

```js
// userId wordt automatisch uit het JWT token gehaald
const feedback = await api(`/feedback/${trackId}`);
```

---

## Endpoint toevoegen

Volg dit template wanneer je een nieuw endpoint documenteert:

```markdown
### METHOD /api/v1/pad

Korte beschrijving van wat het endpoint doet.

**Request body:** (of **Query parameters:** voor GET)

| Veld   | Type | Verplicht | Beschrijving |
| ------ | ---- | --------- | ------------ |
| `veld` | type | ja/nee    | Wat het doet |

**Response:**

| Veld   | Type | Beschrijving  |
| ------ | ---- | ------------- |
| `veld` | type | Wat het bevat |
```

Voeg het nieuwe endpoint toe in de juiste sectie.
