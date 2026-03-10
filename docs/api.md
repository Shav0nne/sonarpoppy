# SonarPoppy API

## Quick Start

**Base URL:** `http://localhost:{EXPRESS_PORT}/api/v1` (zie `.env` voor je poortnummer)

**Headers:** alle requests met een body vereisen:

```
Content-Type: application/json
```

**Typische flow:**

1. **Account aanmaken** — `POST /auth/signup` met username, email, password
2. **Inloggen** — `POST /auth/login` → ontvang JWT token
3. **API key aanmaken** — `POST /api/v1/api-keys` met JWT Bearer token → ontvang je API key (eenmalig!)
4. **API gebruiken** — alle `/api/v1/*` endpoints met `X-API-Key` header

Tracks komen in de database via de ingest endpoints (voor backend-beheer, niet voor eindgebruikers).

---

## API Keys

Alle `/api/v1/*` data-endpoints (genres, tracks, recommendations, etc.) vereisen een geldige API key. Auth endpoints (`/auth/*`) en key management (`/api/v1/api-keys`) zijn uitgesloten — die gebruiken JWT.

### Stap 1: Account aanmaken

```bash
curl -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"username": "mijnapp", "email": "dev@example.com", "password": "wachtwoord123"}'
```

### Stap 2: Inloggen (JWT token ophalen)

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"username": "mijnapp", "password": "wachtwoord123"}'
```

Response bevat je `token`. Bewaar deze — je hebt hem nodig voor stap 3.

### Stap 3: API key aanmaken

```bash
curl -X POST http://localhost:8000/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer JOUW_JWT_TOKEN" \
  -d '{"name": "Mijn Frontend App"}'
```

Response (201):

```json
{
  "id": "...",
  "name": "Mijn Frontend App",
  "prefix": "sk_live_1234abcd",
  "key": "sk_live_1234abcd5678efgh90ijklmn12opqr",
  "active": true,
  "createdAt": "2026-03-10T12:00:00.000Z"
}
```

**Bewaar de `key` waarde!** Dit is de enige keer dat je de volledige key te zien krijgt.

### Stap 4: API key gebruiken

Voeg de `X-API-Key` header toe aan alle data-requests:

```bash
curl http://localhost:8000/api/v1/genres \
  -H "Accept: application/json" \
  -H "X-API-Key: sk_live_1234abcd5678efgh90ijklmn12opqr"
```

Zonder geldige key krijg je `401 Unauthorized`.

### Key management endpoints

#### POST /api/v1/api-keys

Maak een nieuwe API key aan. Vereist JWT Bearer token.

| Veld   | Type   | Verplicht | Beschrijving    |
| ------ | ------ | --------- | --------------- |
| `name` | string | ja        | Naam van de key |

**Limieten:** maximaal 5 actieve keys per account. Bij overschrijding: `409`.

#### GET /api/v1/api-keys

Lijst van al je API keys. Vereist JWT Bearer token. Keys worden getoond zonder de volledige key of hash.

#### DELETE /api/v1/api-keys/:id

Revoke (deactiveer) een API key. Vereist JWT Bearer token. De key wordt op `active: false` gezet en werkt niet meer voor API requests.

---

## Endpoints

### GET /api/v1/genres

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
    "self": { "href": "/api/v1/genres" }
  }
}
```

`items` bevat alle 20 genres. De `index` correspondeert met de positie in genre-vectors en profielvectors.

---

### GET /api/v1/tracks

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
    "self": { "href": "/api/v1/tracks" },
    "ingest": { "href": "/api/v1/tracks/ingest" }
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

### POST /api/v1/tracks/ingest

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
    "self": { "href": "/api/v1/tracks/ingest" },
    "tracks": { "href": "/api/v1/tracks" }
  }
}
```

`status` is `"created"`, `"updated"`, `"skipped"`, of `"failed"`.

---

### POST /api/v1/tracks/ingest-batch

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
    "self": { "href": "/api/v1/tracks/ingest-batch" },
    "tracks": { "href": "/api/v1/tracks" }
  }
}
```

---

### POST /api/v1/profile/compute

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
    "self": { "href": "/api/v1/profile/compute" },
    "recommendations": { "href": "/api/v1/recommendations" }
  }
}
```

| Veld                | Type     | Beschrijving                                          |
| ------------------- | -------- | ----------------------------------------------------- |
| `vector`            | number[] | Genormaliseerde 20-dim profielvector                  |
| `meta.activeGenres` | number   | Aantal genres met gewicht > 0                         |
| `meta.topGenre`     | string?  | Genre met het hoogste gewicht (`null` bij cold start) |

---

### POST /api/v1/recommendations

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

| Veld                 | Type     | Verplicht | Beschrijving                                         |
| -------------------- | -------- | --------- | ---------------------------------------------------- |
| `profileVector`      | number[] | ja        | 20-dim profielvector (uit `/api/v1/profile/compute`) |
| `limit`              | number   | nee       | Max aantal resultaten (default: alle)                |
| `offset`             | number   | nee       | Skip eerste N resultaten (default: 0)                |
| `filters.minScore`   | number   | nee       | Minimum similarity score (0.0-1.0)                   |
| `filters.excludeIds` | string[] | nee       | Track IDs om uit te sluiten                          |

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
    "self": { "href": "/api/v1/recommendations" },
    "profile": { "href": "/api/v1/profile/compute" }
  }
}
```

| Veld              | Type   | Beschrijving                                        |
| ----------------- | ------ | --------------------------------------------------- |
| `tracks[].track`  | object | Track object (zelfde velden als GET /api/v1/tracks) |
| `tracks[].score`  | number | Cosine similarity score (0.0-1.0)                   |
| `total`           | number | Totaal aantal resultaten (voor paginatie)           |
| `meta.scoredAt`   | string | ISO timestamp van de berekening                     |
| `meta.avgScore`   | number | Gemiddelde score van alle resultaten                |
| `meta.scoreRange` | object | Laagste en hoogste score                            |

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
