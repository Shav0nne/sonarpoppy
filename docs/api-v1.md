# SonarPoppy API Endpoints

Zie [getting-started.md](getting-started.md) voor account aanmaken, API key ophalen en headers.

---

## Hoe dit document werkt

De endpoints zijn gegroepeerd per functionaliteit. Begin bovenaan — de secties volgen de volgorde waarin je ze in je app nodig hebt.

**Headers** — alle endpoints (behalve auth) vereisen:

- **`Authorization: Bearer <token>`** — JWT token (per user, uit login response)
- **`X-API-Key: sk_live_...`** — API key (per app, eenmalig aangemaakt)

De server haalt `userId` automatisch uit het JWT token — je hoeft dit nooit mee te sturen.

> **Onboarding verplicht.** Endpoints gemarkeerd met **(OB)** vereisen dat de gebruiker onboarding heeft voltooid. Zo niet → `403` met melding `Onboarding is nog niet voltooid`. Check `hasCompletedOnboarding` in de `/auth/me` response.

---

## Overzicht per sectie

| Sectie                                   | Endpoints                                                | Wanneer nodig?                         |
|------------------------------------------|----------------------------------------------------------|----------------------------------------|
| [Data ophalen](#data-ophalen)            | genres, tracks                                           | Altijd — basisdata voor je UI          |
| [Onboarding](#onboarding)                | onboarding                                               | Eerste keer — cold start profiel       |
| [Recommendations](#recommendations)      | profile/compute, recommendations, dial                   | Kernfunctionaliteit — tracks tonen     |
| [Sliders & Presets](#sliders--presets)   | sliders, slider-presets                                  | Optioneel — genre voorkeuren finetunen |
| [Feedback](#feedback)                    | feedback, play                                           | Optioneel — likes/dislikes registreren |
| [Blacklist & Zoeken](#blacklist--zoeken) | blacklist, artists/search, tracks/search                 | Optioneel — content blokkeren          |
| [Artist Images](#artist-images)          | artists/:name/image                                      | Optioneel — artist foto's tonen        |
| [Admin](#admin-algorithm-tuning)         | admin/config, admin/explain                              | Alleen voor admins                     |
| [Beheer](#beheer-endpoints)              | ingest, enrich                                           | Niet voor frontenders                  |
| [Friend](#friends)                       | friends, friends/request, friends/:id                    | Optioneel - vriendschappen beheren     |   
| [Logging](#logging)                      | history/blacklist, history/genreslider, history/feedback | Alleen voor admin                      |

---

## Data ophalen

Basisdata die je app nodig heeft om te functioneren.

### GET /api/v1/genres

Retourneert de 20 genres. Gebruik dit om genre-keuzes te tonen (onboarding, sliders).

```json
{
  "items": [
    { "index": 0, "name": "rock" },
    { "index": 1, "name": "pop" },
    { "index": 2, "name": "electronic" }
  ],
  "_links": { "self": { "href": "/api/v1/genres" } }
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
      "genreVector": [0.45, 0.12, 0.0],
      "lastfmTags": ["classic rock", "rock"],
      "imageUrl": "https://..."
    }
  ],
  "_links": { "self": { "href": "/api/v1/tracks" } }
}
```

---

## Onboarding

Nieuwe gebruikers moeten eerst genres (en optioneel artiesten) kiezen. Pas daarna werken recommendations, sliders, feedback en blacklist.

### POST /api/v1/onboarding

**Request:**

```json
{
  "genres": ["rock", "electronic", "jazz"],
  "artists": ["Radiohead", "Daft Punk"],
  "app": "sonarpop"
}
```

| Veld      | Type     | Verplicht | Beschrijving                                                |
| --------- | -------- | --------- | ----------------------------------------------------------- |
| `genres`  | string[] | ja        | Gekozen genres (min 3 voor SonarPop, min 3 voor Poppy)      |
| `artists` | string[] | nee       | Favoriete artiesten — hun Last.fm tags boosten genres extra |
| `app`     | string   | nee       | `"sonarpop"` of `"poppy"` — bepaalt validatieregels         |

**Response (201):**

De flag `hasCompletedOnboarding` wordt op `true` gezet.

```json
{
  "profile": {
    "vector": [0.4, 0.1, 0.35, "..."],
    "meta": { "activeGenres": 3, "topGenre": "rock" }
  },
  "sliders": { "rock": 1.5, "electronic": 1.3, "jazz": 1.2, "pop": 1.0 },
  "_links": {
    "self": { "href": "/api/v1/onboarding" },
    "sliders": { "href": "/api/v1/sliders" },
    "recommendations": { "href": "/api/v1/recommendations" }
  }
}
```

| Fout | Wanneer                                                    |
| ---- | ---------------------------------------------------------- |
| 400  | Verplichte velden missen, te weinig genres, ongeldig genre |

---

## Recommendations

De kern van de app: profiel berekenen en gepersonaliseerde tracks ophalen.

### POST /api/v1/profile/compute

Berekent een profielvector. Dit is de input voor `/recommendations`.

**Request:**

```json
{}
```

| Veld      | Type   | Verplicht | Beschrijving                                                                                                  |
| --------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------- |
| `weights` | object | nee       | Handmatige genre weights, bijv. `{"rock": 0.8, "jazz": 0.3}`. Fallback als geen sliders gevonden voor de user |

> Zonder sliders en zonder `weights` → cold start vector (alle genres gelijk).

**Response:**

```json
{
  "vector": [0.5, 0.0, 0.3125, 0.0, 0.0, 0.1875],
  "meta": { "activeGenres": 3, "topGenre": "rock" },
  "_links": {
    "self": { "href": "/api/v1/profile/compute" },
    "recommendations": { "href": "/api/v1/recommendations" }
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
    0.5, 0.0, 0.3125, 0.0, 0.0, 0.1875, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0
  ],
  "limit": 10,
  "offset": 0,
  "dial": 3
}
```

**Basis parameters:**

| Veld            | Type     | Verplicht | Beschrijving                                                         |
| --------------- | -------- | --------- | -------------------------------------------------------------------- |
| `profileVector` | number[] | ja        | 20-dim vector uit `/profile/compute`                                 |
| `limit`         | number   | nee       | Max resultaten (default: alle)                                       |
| `offset`        | number   | nee       | Skip eerste N (voor paginatie)                                       |
| `dial`          | number   | nee       | Stand 1-5. 1=voorspelbaar, 5=verrassend                              |
| `weights`       | object   | nee       | Custom `{"genre": 0.6, "cf": 0.4}` (genegeerd als `dial` meegegeven) |

**Optionele filters** (in `filters` object):

| Veld         | Type     | Beschrijving                                                                |
| ------------ | -------- | --------------------------------------------------------------------------- |
| `genre`      | string   | Filter op dominant genre, bijv. `"rock"`                                    |
| `artist`     | string   | Filter op artiest (case-insensitive exact match)                            |
| `sort`       | string   | Sort-override: `"genreSim"`, `"cf"`, `"random"`, of `"recent"`              |
| `explicit`   | boolean  | `true` = alleen explicit, `false` = geen explicit, weggelaten = geen filter |
| `unplayed`   | boolean  | `true` = alleen tracks zonder feedback/plays                                |
| `recentDays` | number   | Alleen tracks geïngest in de laatste N dagen                                |
| `minScore`   | number   | Minimum score (0.0-1.0)                                                     |
| `excludeIds` | string[] | Track IDs om over te slaan                                                  |

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
        "genreVector": [0.45, 0.12]
      },
      "finalScore": 0.87,
      "signals": { "genre": 0.82, "cf": 0.91 },
      "appliedWeights": { "genre": 0.5, "cf": 0.5 },
      "feedbackMultiplier": 1.1
    }
  ],
  "total": 42,
  "meta": {
    "scoredAt": "2026-03-10T12:00:00.000Z",
    "avgScore": 0.45,
    "scoreRange": { "min": 0.12, "max": 0.92 },
    "activeSignals": ["genre", "cf"],
    "dialPosition": 3
  }
}
```

| Veld                          | Wat is het?                                               |
| ----------------------------- | --------------------------------------------------------- |
| `tracks[].finalScore`         | De uiteindelijke score (0-1). Hoger = beter match         |
| `tracks[].signals.genre`      | Hoe goed de track qua genre past (cosine similarity)      |
| `tracks[].signals.cf`         | Collaborative filtering score (null als niet beschikbaar) |
| `tracks[].feedbackMultiplier` | Boost/penalty van eerdere likes/dislikes (default 1.0)    |
| `total`                       | Totaal aantal resultaten (voor paginatie)                 |
| `meta.dialPosition`           | Welke dial stand is gebruikt                              |

---

### GET /api/v1/dial

Toont de 5 dial standen. Gebruik dit om een slider/keuze UI te bouwen.

```json
{
  "presets": [
    {
      "position": 1,
      "name": "Strikt",
      "description": "Blijft dicht bij je smaak. Alleen tracks met hoge genre-match.",
      "filter": { "type": "minGenreSim", "threshold": 0.6 },
      "sortSignal": "genreSim"
    },
    {
      "position": 3,
      "name": "Gebalanceerd",
      "filter": { "type": "none", "threshold": null },
      "sortSignal": "genreSim"
    },
    {
      "position": 5,
      "name": "Anti-bubbel",
      "filter": { "type": "none", "threshold": null },
      "sortSignal": "random"
    }
  ],
  "default": 3
}
```

De dial is een bubbel-filter: scoring is altijd 50/50 (genre/CF), de dial bepaalt welke tracks erdoor komen en hoe ze gesorteerd worden. Zie [dial-system.md](dial-system.md) voor de volledige uitleg.

---

## Sliders & Presets

Genre sliders bepalen hoe zwaar elk genre meetelt in recommendations. Presets zijn opgeslagen snapshots van slider-instellingen. **(OB)**

### GET /api/v1/sliders

Retourneert de genre slider waarden.

```json
{
  "sliders": { "rock": 1.5, "pop": 1.0, "electronic": 1.3, "jazz": 0.5 },
  "locked": ["rock"],
  "updatedAt": "2026-03-10T12:00:00.000Z"
}
```

| Veld        | Beschrijving                                                      |
| ----------- | ----------------------------------------------------------------- |
| `sliders`   | Object met genre→gewicht. Hogere waarde = genre telt zwaarder mee |
| `locked`    | Genres die niet automatisch mee-evolueren met feedback            |
| `updatedAt` | Laatste wijziging (null als cold start defaults)                  |

Geen sliders? → cold start: alle genres op 1.0, locked leeg.

---

### PUT /api/v1/sliders

Update slider waarden en/of locked genres. Je hoeft niet alle genres mee te sturen — alleen de gewijzigde.

**Request:**

```json
{
  "sliders": { "rock": 2.0, "pop": 0.3 },
  "locked": ["rock"]
}
```

**Response:** zelfde shape als GET.

| Fout | Wanneer                                            |
| ---- | -------------------------------------------------- |
| 400  | Onbekend genre in `sliders` keys of `locked` array |

---

### POST /api/v1/sliders/reset

Reset alle sliders naar 1.0 en maakt locked leeg.

**Response:** zelfde shape als GET, alle sliders op 1.0.

| Fout | Wanneer                                  |
| ---- | ---------------------------------------- |
| 404  | Gebruiker heeft nog geen slider document |

---

### Slider Presets

5 preset slots per user. Bij eerste GET worden 3 defaults aangemaakt (Balanced, Chill Vibes, High Energy). Max 5 per user, unieke naam.

| Method | Pad                                      | Wat doet het?               |
| ------ | ---------------------------------------- | --------------------------- |
| GET    | `/api/v1/slider-presets`                 | Alle presets ophalen        |
| POST   | `/api/v1/slider-presets`                 | Nieuwe preset aanmaken      |
| PATCH  | `/api/v1/slider-presets/:presetId`       | Preset updaten              |
| DELETE | `/api/v1/slider-presets/:presetId`       | Preset verwijderen (204)    |
| POST   | `/api/v1/slider-presets/:presetId/apply` | Preset toepassen op sliders |

**GET response:**

```json
[
  {
    "_id": "preset-id-1",
    "name": "Balanced",
    "sliders": { "rock": 1.0, "pop": 1.0, "electronic": 1.0 },
    "locked": [],
    "isDefault": true
  }
]
```

**POST request** (nieuwe preset):

```json
{
  "name": "Mijn Rock Preset",
  "sliders": { "rock": 2.0, "metal": 1.5, "pop": 0.3 },
  "locked": ["rock"]
}
```

| Veld      | Type     | Verplicht | Beschrijving                                  |
| --------- | -------- | --------- | --------------------------------------------- |
| `name`    | string   | ja        | Unieke naam voor de preset                    |
| `sliders` | object   | nee       | Genre→gewicht mapping (default: `{}`)         |
| `locked`  | string[] | nee       | Genres die niet mee-evolueren (default: `[]`) |

**PATCH request:** zelfde velden, alleen meegegeven velden worden overschreven.

**Apply response:** de geüpdatete sliders (zelfde shape als GET /sliders).

| Fout | Wanneer                         |
| ---- | ------------------------------- |
| 400  | Naam ontbreekt of max 5 bereikt |
| 404  | Preset niet gevonden            |
| 409  | Naam bestaat al voor deze user  |

---

## Feedback

Registreer likes, dislikes, skips en play counts. Dit beinvloedt de `feedbackMultiplier` in recommendations: like = hogere score, dislike = lagere. **(OB)**

| Method | Pad                              | Wat doet het?                      |
| ------ | -------------------------------- | ---------------------------------- |
| POST   | `/api/v1/feedback`               | Like/dislike/skip registreren      |
| GET    | `/api/v1/feedback`               | Alle feedback van user             |
| GET    | `/api/v1/feedback/:trackId`      | Feedback voor 1 track (404 = geen) |
| DELETE | `/api/v1/feedback/:trackId`      | Feedback verwijderen (204)         |
| POST   | `/api/v1/feedback/:trackId/play` | Play count +1                      |

### POST /api/v1/feedback

Upsert: maakt nieuw aan of update bestaand.

**Request:**

```json
{
  "trackId": "507f1f77bcf86cd799439011",
  "action": "like"
}
```

| Veld      | Type   | Verplicht | Beschrijving                                    |
| --------- | ------ | --------- | ----------------------------------------------- |
| `trackId` | string | ja        | Track `_id`                                     |
| `action`  | string | nee       | `"like"`, `"dislike"`, `"library"`, of `"skip"` |

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

### GET /api/v1/feedback

```json
[
  { "_id": "...", "trackId": "...", "action": "like", "playCount": 5, "lastPlayedAt": "..." },
  { "_id": "...", "trackId": "...", "action": "dislike", "playCount": 0, "lastPlayedAt": null }
]
```

### POST /api/v1/feedback/:trackId/play

Verhoogt de play count met 1 en update `lastPlayedAt`. Maakt feedback aan als die nog niet bestaat.

---

## Blacklist & Zoeken

Blokkeer tracks, artiesten of genres. De zoek-endpoints helpen bij het vinden van de juiste naam voor autocomplete. **(OB)**

### GET /api/v1/artists/search?q=

Zoek artiesten. Doorzoekt de eigen Track DB + Last.fm als aanvulling. Gededupliceerd op lowercase naam.

| Veld | Type   | Verplicht | Beschrijving                |
| ---- | ------ | --------- | --------------------------- |
| `q`  | string | ja        | Zoekterm (min 2 characters) |

```json
{ "results": [{ "name": "Radiohead" }, { "name": "Radio Moscow" }, { "name": "Thom Yorke" }] }
```

Max 10 resultaten. | Fout 400: query ontbreekt of < 2 tekens.

---

### GET /api/v1/tracks/search?q=

Zoek tracks op title of artist (case-insensitive).

| Veld | Type   | Verplicht | Beschrijving                |
| ---- | ------ | --------- | --------------------------- |
| `q`  | string | ja        | Zoekterm (min 2 characters) |

```json
{
  "results": [
    { "title": "Bohemian Rhapsody", "artist": "Queen" },
    { "title": "Creep", "artist": "Radiohead" }
  ]
}
```

Max 10 resultaten. | Fout 400: query ontbreekt of < 2 tekens.

---

---

Alle geblokkeerde items.

```json
{
  "entries": [
    { "_id": "entry-id-1", "type": "artist", "value": "Nickelback" },
    { "_id": "entry-id-2", "type": "genre", "value": "metal" },
    { "_id": "entry-id-3", "type": "track", "value": "507f1f77bcf86cd799439011" }
  ]
}
```

Geen blacklist? → `entries: []` (geen 404).

---

### POST /api/v1/blacklist

Blokkeer een track, artiest of genre.

**Request:**

```json
{ "type": "artist", "value": "Nickelback" }
```

| Veld    | Type   | Verplicht | Opties                                 |
| ------- | ------ | --------- | -------------------------------------- |
| `type`  | string | ja        | `"track"`, `"artist"`, of `"genre"`    |
| `value` | string | ja        | Track `_id`, artiestnaam, of genrenaam |

> Genre aliassen worden automatisch omgezet: `"classic rock"` → `"rock"`.

**Response (201):** volledige blacklist (zelfde shape als GET).

| Fout | Wanneer                                                |
| ---- | ------------------------------------------------------ |
| 400  | Type of value ontbreekt, ongeldig type, ongeldig genre |
| 409  | Entry bestaat al (case-insensitive voor track/artist)  |

---

### DELETE /api/v1/blacklist/:entryId

Verwijder een blokkering. Gebruik het `_id` veld uit de entries array.

**Response:** volledige blacklist na verwijdering.

| Fout | Wanneer                                           |
| ---- | ------------------------------------------------- |
| 404  | Blacklist niet gevonden, of entryId niet gevonden |

---

## Artist Images

### GET /api/v1/artists/:name/image

Haalt artist images op. Lazy cached: bij eerste request wordt Last.fm aangeroepen, daarna gecachet (TTL 30 dagen). URL-encoded namen worden correct afgehandeld.

```json
{
  "artist": "radiohead",
  "images": [
    { "url": "https://lastfm.freetls.fastly.net/i/u/34s/...", "size": "small" },
    { "url": "https://lastfm.freetls.fastly.net/i/u/64s/...", "size": "medium" },
    { "url": "https://lastfm.freetls.fastly.net/i/u/174s/...", "size": "large" },
    { "url": "https://lastfm.freetls.fastly.net/i/u/300x300/...", "size": "extralarge" }
  ],
  "fetchedAt": "2026-03-16T12:00:00.000Z"
}
```

| Fout | Wanneer                         |
| ---- | ------------------------------- |
| 404  | Artist niet gevonden op Last.fm |

---

## Admin (Algorithm Tuning)

> Alle admin endpoints vereisen `role: "admin"`. Niet-admins krijgen `403 Forbidden`. Als frontender heb je deze normaal niet nodig.

| Method | Pad                              | Wat doet het?             |
| ------ | -------------------------------- | ------------------------- |
| GET    | `/api/v1/admin/config`           | Scoring config ophalen    |
| PATCH  | `/api/v1/admin/config`           | Scoring config aanpassen  |
| POST   | `/api/v1/admin/config/reset`     | Reset naar defaults       |
| GET    | `/api/v1/admin/explain/:trackId` | Score breakdown per track |

### GET /api/v1/admin/config

```json
{
  "hybridWeights": { "genre": 0.5, "cf": 0.5 },
  "feedbackMultipliers": { "like": 1.1, "dislike": 0.5, "library": 1.2, "skip": 0.9 },
  "cfWeights": { "trackWeight": 0.7, "artistWeight": 0.3 },
  "profileEvolution": { "learningRate": 0.1, "maxShift": 0.3 },
  "playCount": { "threshold": 10, "halfLifeDays": 30 },
  "dialPresets": {},
  "updatedAt": "2026-03-16T12:00:00.000Z",
  "updatedBy": "admin-user-id"
}
```

### PATCH /api/v1/admin/config

Partial update. Alleen meegegeven velden worden overschreven.

```json
{
  "hybridWeights": { "genre": 0.6, "cf": 0.4 },
  "feedbackMultipliers": { "like": 1.2 }
}
```

Toegestane velden: `hybridWeights`, `feedbackMultipliers`, `cfWeights`, `profileEvolution`, `playCount`, `dialPresets`.

| Fout | Wanneer                       |
| ---- | ----------------------------- |
| 400  | Geen valide velden meegegeven |

### POST /api/v1/admin/config/reset

Reset alle parameters naar defaults. **Response:** de gereset config.

### GET /api/v1/admin/explain/:trackId?userId=

Per-track score breakdown: toont hoe de score berekend wordt.

| Query param | Type   | Verplicht | Beschrijving                       |
| ----------- | ------ | --------- | ---------------------------------- |
| `userId`    | string | ja        | User ID waarvoor de score berekend |

```json
{
  "track": { "_id": "...", "title": "Creep", "artist": "Radiohead" },
  "genreScore": 0.82,
  "cfScore": 0.65,
  "rawScore": 0.735,
  "feedbackMultiplier": 1.1,
  "finalScore": 0.8085,
  "bubbleFilter": { "position": 3, "passesFilter": true }
}
```

| Fout | Wanneer                          |
| ---- | -------------------------------- |
| 400  | userId query parameter ontbreekt |
| 404  | Track niet gevonden              |

---

## Beheer Endpoints

> Voor het vullen en verrijken van de database. Als frontender heb je deze niet nodig.

### POST /api/v1/tracks/ingest

Importeert een track via Last.fm (haalt tags op, berekent genre-vector).

```json
{ "artist": "Queen", "title": "Bohemian Rhapsody", "force": false }
```

### POST /api/v1/tracks/ingest-batch

Importeert meerdere tracks.

```json
{
  "tracks": [
    { "artist": "Queen", "title": "Bohemian Rhapsody" },
    { "artist": "Radiohead", "title": "Creep" }
  ],
  "force": false
}
```

### POST /api/v1/tracks/enrich-spotify

Verrijkt tracks met Spotify metadata. **503** als Spotify credentials niet geconfigureerd.

```json
{ "batchSize": 50 }
```

### POST /api/v1/tracks/enrich-cf

Verrijkt tracks met Last.fm collaborative filtering data.

```json
{ "batchSize": 50 }
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

### Onboarding + recommendations

```js
// 1. Onboarding (eenmalig)
await api("/onboarding", {
  method: "POST",
  body: { genres: ["rock", "electronic", "jazz"], artists: ["Radiohead"], app: "sonarpop" },
});

// 2. Profiel berekenen
const { vector } = await api("/profile/compute", { method: "POST", body: {} });

// 3. Aanbevelingen ophalen
const { tracks } = await api("/recommendations", {
  method: "POST",
  body: { profileVector: vector, limit: 10, dial: 3 },
});

// 4. Met filters: "Rock for You" playlist
const rockTracks = await api("/recommendations", {
  method: "POST",
  body: {
    profileVector: vector,
    limit: 20,
    filters: { genre: "rock", explicit: false, sort: "recent" },
  },
});

tracks.forEach(({ track, finalScore }) => {
  console.log(`${track.artist} - ${track.title} (${(finalScore * 100).toFixed(0)}%)`);
});
```

### Feedback + blacklist

```js
// Like een track
await api("/feedback", {
    method: "POST",
    body: { trackId: tracks[0].track._id, action: "like" },
});

// Artiest zoeken (autocomplete)
const { results } = await api("/artists/search?q=radio");

// Artiest blokkeren
await api("/blacklist", {
    method: "POST",
    body: { type: "artist", value: "Nickelback" },
});
```
### friends

Beheer vriendschappen tussen gebruikers. Je kunt vriendenlijsten bekijken, vriendschapsverzoeken sturen, accepteren, weigeren en verwijderen. Verder is er geen authentication nodig. Je moet altijd de juiste userId meesturen als query parameter of in de request body.

| Method | Pad                                      | Wat doet het?                                |
| ------ | ---------------------------------------- | -------------------------------------------- |
| GET    | `/api/v1/friends?userId={id}`            | Vriendenlijst tonen in UI                    |
| GET    | `/api/v1/friends/requests?userId={id}`   | Pending verzoeken tonen (notificaties)       |
| POST   | `/api/v1/friends/request`                | Vriendschapsverzoek sturen                   |
| PATCH  | `/api/v1/friends/{requestId}`            | Verzoek accepteren/weigeren of blokeren      |
| DELETE | `/api/v1/friends/{friendId}`             | Vriendschap verwijderen                      |

### GET /api/v1/friends

Haal alle geaccepteerde vrienden van een gebruiker op.

| Query param | Type   | Verplicht | Beschrijving        |
| ----------- | ------ | --------- | ------------------- |
| `userId`    | string | ja        | ID van de gebruiker |

de response die je terug krijgt:

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "user456",
      "username": "john_doe",
      "email": "john@example.com",
      "image": "https://...",
      "friendshipId": "9812364054123",
      "since": "2026-03-10T12:00:00.000Z",
      "status": "accepted"
    }
  ],
  "_links": {
    "self": { "href": "/api/v1/friends?userId=user123" },
    "requests": { "href": "/api/v1/friends/requests?userId=user123" }
  }
}
```
### GET /api/v1/friends/requests

Haal alle openstaande vriendschapsverzoeken op (zowel inkomend als uitgaand).

Request:
GET /api/v1/friends/requests?userId=69a828a00fd6e8d421af8e50

```json
{
    "success": true,
    "data": {
        "incoming": [
            {
                "id": "69b9235b33b09565dbc98bb4",
                "sender": {
                    "id": "69b7e1619d88bb9c38923c6f",
                    "username": "john_doe",
                    "email": "john@example.com",
                    "image": null
                },
                "status": "pending",
                "createdAt": "2026-03-17T09:48:11.293Z",
                "_links": {
                    "self": { "href": "http://localhost:8000/api/v1/friends/69b9235b33b09565dbc98bb4" },
                    "accept": { "href": "http://localhost:8000/api/v1/friends/69b9235b33b09565dbc98bb4", "method": "PATCH" },
                    "reject": { "href": "http://localhost:8000/api/v1/friends/69b9235b33b09565dbc98bb4", "method": "PATCH" }
                }
            }
        ],
        "outgoing": [
            {
                "id": "69c1234b33b09565dbc98cc5",
                "receiver": {
                    "id": "69d4567a00fd6e8d421af911",
                    "username": "jane_doe",
                    "email": "jane@example.com",
                    "image": null
                },
                "status": "pending",
                "createdAt": "2026-03-17T10:15:22.123Z",
                "_links": {
                    "self": { "href": "http://localhost:8000/api/v1/friends/69c1234b33b09565dbc98cc5" },
                    "cancel": { "href": "http://localhost:8000/api/v1/friends/69c1234b33b09565dbc98cc5", "method": "DELETE" }
                }
            }
        ]
    },
    "_links": {
        "self": { "href": "http://localhost:8000/api/v1/friends/requests?userId=69a828a00fd6e8d421af8e50" },
        "friends": { "href": "http://localhost:8000/api/v1/friends?userId=69a828a00fd6e8d421af8e50" }
    }
}
```
Dit kan alleen fout gaan als je de userId vergeet!

### POST /api/v1/friends/request

Stuur een vriendschapsverzoek naar een andere gebruiker.

voorbeeld:
```json
{
  "senderId": "user123",
  "receiverId": "user456"
}
```

|Veld	         | Type   | Verplicht	 |Beschrijving        |
|--------------|--------|------------|--------------------|
|senderId	     | string	| ja	       |ID van de verzender |
|receiverId	   | string	| ja	       |ID van de ontvange  |

De response die je terug krijgt wanneer het goed gaat:
```json
{
  "success": true,
  "message": "Friend request sent successfully",
  "data": {
    "id": "req123",
    "sender_user_id": "user123",
    "receiver_user_id": "user456",
    "status": "pending"
  },
  "_links": {
    "self": { "href": "/api/v1/friends/req123" },
    "collection": { "href": "/api/v1/friends" }
  }
}
```
|Fout	| Wanneer                                      |
|-----|----------------------------------------------|
|400	| Velden ontbreken of self-request             |
|404	| Ontvanger bestaat niet                       |
|409	| Request bestaat al of users zijn al vrienden |

### PATCH /api/v1/friends/:requestId

Accepteer of weiger een vriendschapsverzoek.

Request:
```json
{
  "userId": "user456",
  "status": "accepted"
}
```

|Veld	         | Type   | Verplicht	 |Beschrijving                         |
|--------------|--------|------------|-------------------------------------|
|userId        | string	| ja	       |ID van de ontvanger                  |
|status   	   | string	| ja	       |"accepted" , "rejected" of "blocked" |


Response: Accepteren
```json
{
  "success": true,
  "message": "Friend request accepted",
  "data": {
    "id": "req123",
    "status": "accepted",
    "accepted_at": "2026-03-10T12:00:00.000Z"
  }
}
```
Response: Weigeren
```json
{
    "success": true,
    "message": "Friend request rejected",
    "data": {
        "_id": "69b9235b33b09565dbc98bb4",
        "sender_user_id": "69b7e1619d88bb9c38923c6f",
        "receiver_user_id": "69a828a00fd6e8d421af8e50",
        "status": "rejected",
        "accepted_at": null,
        "createdAt": "2026-03-17T09:48:11.293Z",
        "updatedAt": "2026-03-17T10:30:00.000Z"
    }
}
```

Response: Blokeren
```json
{
    "success": true,
    "message": "User blocked successfully",
    "data": {
        "_id": "69b9235b33b09565dbc98bb4",
        "sender_user_id": "69b7e1619d88bb9c38923c6f",
        "receiver_user_id": "69a828a00fd6e8d421af8e50",
        "status": "blocked",
        "accepted_at": null,
        "createdAt": "2026-03-17T09:48:11.293Z",
        "updatedAt": "2026-03-17T10:30:00.000Z"
    }
}
```

Je kunt een vriend on-blokeren als je zelf een vriendschap verzoek stuurt. 

|Fout	| Wanneer                                      |
|-----|----------------------------------------------|
|400	| Ongeldige status of ontberekende velden      |
|403	| User is niet de ontvanger                    |
|404	| Request niet gevonden                        |

### DELETE /api/v1/friends/:friendId

Verwijderen van een vriendschap

|Query param	|Type	   |Verplicht	 |Beschrijving        |
|-------------|--------|-----------|--------------------|
|userId	      |string	 |ja	       |ID van de gebruiker |

Response:
```json
{
  "success": true,
  "message": "Friendship removed successfully",
  "_links": {
    "collection": { "href": "/api/v1/friends" },
    "requests": { "href": "/api/v1/friends/requests" }
  }
}
```

|Fout	| Wanneer                                      |
|-----|----------------------------------------------|
|400	| userId ontbreekt                             |
|403	| User hoort niet bij deze relatie             |
|404	| Vriendschap niet gevonden                    |

### extra notes

Een friendship is altijd tussen twee users en wordt opgeslagen als één document. De richting (sender/receiver) is alleen relevant tijdens de request fase (pending).


### logging

Veranderende data wordt in history opgeslagen om data terug te zien op een admindashboard. Let op, er wordt geen historie opgeslagen als er geen nieuwe veranderingen zijn gemaakt in de velden van blacklist, genresliders of feedback(likes dislikes).

| Method | Pad                                 | Wat doet het?                                |
|--------|-------------------------------------|----------------------------------------------|
| GET    | `/api/v1/history/blacklist`         | haalt alle veranderingen van blacklist op    |
| GET    | `/api/v1/history/genreslider` | haalt alle veranderingen van genre slider op |
| GET    | `/api/v1/history/feedback` | haalt alle veranderingen van feedback op     |

alle gets worden beantwoord met een lijst van t (time, wanneer de verandering heeft plaatsgevonden), o (op welke manier data is veranderd i: inser - u: update r: remove) en data (de daadwerkelijke verandering die heeft plaatsgevonden). Bijvoorbeeld:

```json
{
  "success": true,
  "data": [
    {
      "t": "2026-03-17T12:00:00.000Z",
      "o": "i",
      "data": {
        "type": "artist",
        "value": "Nickelback",
        "action": "added"
      }
    },
    {
      "t": "2026-03-18T15:30:00.000Z",
      "o": "u",
      "data": {
        "type": "artist",
        "value": "Nickelback",
        "action": "removed"
      }
    }
  ]
}
```
