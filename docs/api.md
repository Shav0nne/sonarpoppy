# SonarPoppy API

## Quick Start

**Base URL:** `http://localhost:3000/api`

**Headers:** alle requests met een body vereisen:

```
Content-Type: application/json
```

**Typische flow:**

1. **Genres ophalen** — `GET /api/genres` om de 20 beschikbare genres te zien
2. **Profiel berekenen** — `POST /api/profile/compute` met genre weights om een profielvector te krijgen
3. **Recommendations ophalen** — `POST /api/recommendations` met de profielvector voor gepersonaliseerde aanbevelingen

Tracks komen in de database via de ingest endpoints (voor backend-beheer, niet voor eindgebruikers).

---

## Endpoints

### GET /api/genres

Retourneert de 20 gestandaardiseerde genres met hun index (positie in de genre-vector).

**Response:**

```json
{
  "items": [
    { "index": 0, "name": "rock" },
    { "index": 1, "name": "pop" },
    { "index": 2, "name": "electronic" }
  ],
  "_links": {
    "self": { "href": "/api/genres" }
  }
}
```

`items` bevat alle 20 genres. De `index` correspondeert met de positie in genre-vectors en profielvectors.

---

### GET /api/tracks

Retourneert alle tracks in de database.

**Response:**

```json
{
  "items": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "title": "Bohemian Rhapsody",
      "artist": "Queen",
      "album": "A Night at the Opera",
      "duration": 354,
      "genreVector": [0.45, 0.12, 0.0, ...],
      "lastfmUrl": "https://www.last.fm/music/Queen/_/Bohemian+Rhapsody",
      "lastfmTags": ["classic rock", "rock", "queen"],
      "mbid": "...",
      "imageUrl": "https://..."
    }
  ],
  "_links": {
    "self": { "href": "/api/tracks" },
    "ingest": { "href": "/api/tracks/ingest" }
  }
}
```

| Veld          | Type     | Beschrijving                                 |
| ------------- | -------- | -------------------------------------------- |
| `title`       | string   | Tracknaam                                    |
| `artist`      | string   | Artiestnaam                                  |
| `album`       | string?  | Albumnaam (optioneel)                        |
| `duration`    | number?  | Duur in seconden (optioneel)                 |
| `genreVector` | number[] | Array van 20 floats (0.0-1.0), een per genre |
| `lastfmUrl`   | string?  | Link naar Last.fm pagina                     |
| `lastfmTags`  | string[] | Ruwe Last.fm tags                            |
| `mbid`        | string?  | MusicBrainz ID                               |
| `imageUrl`    | string?  | Album/track artwork URL                      |

---

### POST /api/tracks/ingest

Importeert een enkele track via Last.fm. Haalt metadata en tags op, berekent de genre-vector, en slaat op in MongoDB.

**Request body:**

```json
{
  "artist": "Queen",
  "title": "Bohemian Rhapsody",
  "force": false
}
```

| Veld     | Type    | Verplicht | Beschrijving                                           |
| -------- | ------- | --------- | ------------------------------------------------------ |
| `artist` | string  | ja        | Artiestnaam                                            |
| `title`  | string  | ja        | Tracknaam                                              |
| `force`  | boolean | nee       | `true` overschrijft bestaande track (default: `false`) |

**Response** (201 bij created, 200 bij skipped/updated):

```json
{
  "status": "created",
  "track": { ... },
  "_links": {
    "self": { "href": "/api/tracks/ingest" },
    "tracks": { "href": "/api/tracks" }
  }
}
```

`status` is `"created"`, `"updated"`, `"skipped"`, of `"failed"`.

---

### POST /api/tracks/ingest-batch

Importeert meerdere tracks in een keer.

**Request body:**

```json
{
  "tracks": [
    { "artist": "Queen", "title": "Bohemian Rhapsody" },
    { "artist": "Radiohead", "title": "Creep" }
  ],
  "force": false
}
```

| Veld     | Type    | Verplicht | Beschrijving                                    |
| -------- | ------- | --------- | ----------------------------------------------- |
| `tracks` | array   | ja        | Array van `{ artist, title }` objecten          |
| `force`  | boolean | nee       | Overschrijf bestaande tracks (default: `false`) |

**Response:**

```json
{
  "results": [
    { "artist": "Queen", "title": "Bohemian Rhapsody", "status": "created", "track": { ... } },
    { "artist": "Radiohead", "title": "Creep", "status": "created", "track": { ... } }
  ],
  "summary": {
    "created": 2,
    "skipped": 0,
    "failed": 0
  },
  "_links": {
    "self": { "href": "/api/tracks/ingest-batch" },
    "tracks": { "href": "/api/tracks" }
  }
}
```

---

### POST /api/profile/compute

Berekent een profielvector op basis van genre weights. De profielvector is een genormaliseerde 20-dimensionale vector die aangeeft hoe sterk de gebruiker elk genre waardeert.

**Request body:**

```json
{
  "weights": {
    "rock": 0.8,
    "electronic": 0.5,
    "jazz": 0.3
  }
}
```

| Veld      | Type   | Verplicht | Beschrijving                                                                                               |
| --------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------- |
| `weights` | object | nee       | Genre-naam als key, gewicht als value. Zonder weights krijg je een cold-start vector (alle genres gelijk). |

**Response:**

```json
{
  "vector": [0.5, 0.0, 0.3125, 0.0, ...],
  "meta": {
    "activeGenres": 3,
    "topGenre": "rock"
  },
  "_links": {
    "self": { "href": "/api/profile/compute" },
    "recommendations": { "href": "/api/recommendations" }
  }
}
```

| Veld                | Type     | Beschrijving                                          |
| ------------------- | -------- | ----------------------------------------------------- |
| `vector`            | number[] | Genormaliseerde 20-dim profielvector                  |
| `meta.activeGenres` | number   | Aantal genres met gewicht > 0                         |
| `meta.topGenre`     | string?  | Genre met het hoogste gewicht (`null` bij cold start) |

---

### POST /api/recommendations

Retourneert gepersonaliseerde track-aanbevelingen gesorteerd op cosine similarity met de profielvector.

**Request body:**

```json
{
  "profileVector": [
    0.5, 0.0, 0.3125, 0.0, 0.0, 0.1875, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0
  ],
  "limit": 10,
  "offset": 0,
  "filters": {
    "minScore": 0.2,
    "excludeIds": ["507f1f77bcf86cd799439011"]
  }
}
```

| Veld                 | Type     | Verplicht | Beschrijving                                      |
| -------------------- | -------- | --------- | ------------------------------------------------- |
| `profileVector`      | number[] | ja        | 20-dim profielvector (uit `/api/profile/compute`) |
| `limit`              | number   | nee       | Max aantal resultaten (default: alle)             |
| `offset`             | number   | nee       | Skip eerste N resultaten (default: 0)             |
| `filters.minScore`   | number   | nee       | Minimum similarity score (0.0-1.0)                |
| `filters.excludeIds` | string[] | nee       | Track IDs om uit te sluiten                       |

**Response:**

```json
{
  "tracks": [
    {
      "track": { "_id": "...", "title": "...", "artist": "...", "genreVector": [...] },
      "score": 0.87
    }
  ],
  "total": 42,
  "meta": {
    "scoredAt": "2026-03-05T12:00:00.000Z",
    "avgScore": 0.45,
    "scoreRange": { "min": 0.12, "max": 0.92 }
  },
  "_links": {
    "self": { "href": "/api/recommendations" },
    "profile": { "href": "/api/profile/compute" }
  }
}
```

| Veld              | Type   | Beschrijving                                     |
| ----------------- | ------ | ------------------------------------------------ |
| `tracks[].track`  | object | Track object (zelfde velden als GET /api/tracks) |
| `tracks[].score`  | number | Cosine similarity score (0.0-1.0)                |
| `total`           | number | Totaal aantal resultaten (voor paginatie)        |
| `meta.scoredAt`   | string | ISO timestamp van de berekening                  |
| `meta.avgScore`   | number | Gemiddelde score van alle resultaten             |
| `meta.scoreRange` | object | Laagste en hoogste score                         |

---

## Endpoint toevoegen

Volg dit template wanneer je een nieuw endpoint documenteert:

```markdown
### METHOD /api/pad

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

Voeg het nieuwe endpoint toe in de "Endpoints" sectie, in dezelfde volgorde als de route files.
