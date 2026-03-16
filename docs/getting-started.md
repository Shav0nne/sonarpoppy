# Getting Started

## Voor wie is dit?

Dit document legt uit hoe je als frontend-developer de SonarPoppy API gebruikt vanuit een React app. Het beschrijft de volledige flow: van account aanmaken tot recommendations ophalen.

## Base URL

```
http://145.24.237.95:8000/api/v1
```

Poortnummer kan anders zijn — check `.env` → `EXPRESS_PORT`.

## Authenticatie

SonarPoppy gebruikt **twee lagen** authenticatie:

| Laag          | Header                          | Doel                           | Wanneer nodig          |
| ------------- | ------------------------------- | ------------------------------ | ---------------------- |
| **JWT token** | `Authorization: Bearer <token>` | Identificeert de **gebruiker** | Alle beschermde routes |
| **API key**   | `X-API-Key: sk_live_...`        | Identificeert de **app**       | Alle beschermde routes |

### Waarom twee lagen?

- **JWT** → wie is de gebruiker? De server haalt `userId` uit het token. Je hoeft userId nooit zelf mee te sturen.
- **API key** → welke app maakt het request? Handig voor rate limiting, key rotation en als je later externe toegang wilt bieden.

### Welke routes zijn publiek?

| Route                           | Bescherming    |
| ------------------------------- | -------------- |
| `POST /api/v1/auth/signup`      | Geen (publiek) |
| `POST /api/v1/auth/login`       | Geen (publiek) |
| `POST /api/v1/api-keys`         | Alleen JWT     |
| `GET /api/v1/api-keys`          | Alleen JWT     |
| `DELETE /api/v1/api-keys/:id`   | Alleen JWT     |
| Alle overige `/api/v1/*` routes | JWT + API key  |

---

## Vereiste headers

**Publieke routes** (auth):

```
Content-Type: application/json
```

**Key management** (api-keys):

```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Beschermde routes** (genres, onboarding, recommendations, etc.):

```
Content-Type: application/json        ← alleen bij POST/PUT
Authorization: Bearer <jwt-token>
X-API-Key: sk_live_jouw_key_hier
```

> `Accept: application/json` of `*/*` (de default van `fetch()`) worden beide geaccepteerd.

---

## Developer setup (eenmalig, via Postman)

Dit doe je als frontend-developer, niet de eindgebruiker. Je maakt een account en API key aan die je in je React app configureert.

### 1. Developer account aanmaken

```bash
curl -X POST http://145.24.237.95:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username": "dev-sonarpop", "email": "dev@sonarpop.nl", "password": "devwachtwoord"}'
```

### 2. Inloggen (JWT token ophalen)

```bash
curl -X POST http://145.24.237.95:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "dev-sonarpop", "password": "devwachtwoord"}'
```

Response: `{ "token": "eyJhbG...", "user": { "id": "...", ... } }`

### 3. API key aanmaken

```bash
curl -X POST http://145.24.237.95:8000/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer JOUW_JWT_TOKEN" \
  -d '{"name": "SonarPop Web App"}'
```

Response: `{ "key": "sk_live_1234abcd5678efgh90ijklmn12opqr", ... }`

> **Bewaar de `key`!** Dit is de enige keer dat je de volledige key te zien krijgt.

### 4. Key in je React app configureren

Zet de key in je `.env` of config — deze is voor de hele app, niet per gebruiker:

```
# .env (React app)
REACT_APP_API_KEY=sk_live_1234abcd5678efgh90ijklmn12opqr
```

---

## Eindgebruiker flow (in de React app)

De eindgebruiker maakt een eigen account aan en logt in. De API key is al in de app ingebakken — daar merkt de gebruiker niks van.

### 1. Account aanmaken

De app stuurt:

```
POST /api/v1/auth/signup
Body: { "username": "lisa", "email": "lisa@email.com", "password": "..." }
```

Response (201): `{ "id": "user456", "username": "lisa", ... }`

### 2. Inloggen

De app stuurt:

```
POST /api/v1/auth/login
Body: { "username": "lisa", "password": "..." }
```

Response (200): `{ "token": "eyJhbG...", "user": { "id": "user456", ... } }`

> Sla `token` en `user.id` op (localStorage, state, etc.). De API key zit al in de app config.

---

## User identity (automatisch)

De server bepaalt automatisch wie je bent op basis van je **JWT token**. Je hoeft **geen `userId` mee te sturen** in request bodies of URL parameters.

Hoe het werkt:

- Bij elke request naar een beschermde route haalt de server `userId` uit het JWT token
- `req.body.userId` wordt automatisch overschreven — zelfs als je het meestuurt, wordt het genegeerd
- Routes met `:userId` in het pad (bijv. `/sliders/:userId`) valideren dat het pad matcht met de ingelogde user — een mismatch geeft `403 Forbidden`

Dit betekent dat je frontend bij onboarding, feedback, profile/compute, en recommendations **geen userId hoeft mee te sturen**. De server regelt het.

---

## Typische app flow

**Developer (eenmalig, via Postman):**

```
1. POST /api/v1/auth/signup    → Developer account aanmaken
2. POST /api/v1/auth/login     → JWT token ophalen
3. POST /api/v1/api-keys       → API key aanmaken → in app .env zetten
```

**Eindgebruiker (in de React app):**

```
1. POST /api/v1/auth/signup          → Account aanmaken
2. POST /api/v1/auth/login           → JWT token ophalen
3. GET  /api/v1/genres               → 20 genres tonen
4. POST /api/v1/onboarding           → Genres + artiesten kiezen (cold start)
5. POST /api/v1/profile/compute      → Profielvector berekenen
6. POST /api/v1/recommendations      → Aanbevelingen ophalen (met optionele filters)
7. POST /api/v1/feedback             → Like/dislike/skip registreren
8. GET  /api/v1/slider-presets       → Slider presets ophalen/toepassen
```

---

## React voorbeeld

### Helper functie

```js
const BASE = "http://145.24.237.95:8000/api/v1";
const API_KEY = process.env.REACT_APP_API_KEY; // vaste key, door developer ingesteld

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY, // altijd dezelfde key voor alle users
    ...options.headers,
  };

  const token = localStorage.getItem("token");
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    return;
  }

  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  if (res.status === 204) return null;
  return res.json();
}
```

### Login (eindgebruiker)

```js
const { token, user } = await api("/auth/login", {
  method: "POST",
  body: { username: "lisa", password: "wachtwoord123" },
});
localStorage.setItem("token", token);
localStorage.setItem("userId", user.id);
```

### Onboarding

```js
// userId wordt NIET meegestuurd — de server haalt het uit het JWT token
const { profile, sliders } = await api("/onboarding", {
  method: "POST",
  body: {
    genres: ["rock", "electronic", "jazz"],
    artists: ["Radiohead", "Daft Punk", "Beyonce"],
    app: "sonarpop",
  },
});
```

### Recommendations ophalen

```js
const { vector } = await api("/profile/compute", {
  method: "POST",
  body: {}, // userId komt uit JWT
});

const { tracks, total } = await api("/recommendations", {
  method: "POST",
  body: {
    profileVector: vector,
    limit: 10,
    dial: 3,
    // userId komt uit JWT — niet meesturen
    // optioneel: filters toevoegen
    filters: {
      genre: "rock", // alleen rock tracks
      explicit: false, // geen explicit content
      sort: "recent", // nieuwste eerst
    },
  },
});
```

### Feedback geven

```js
await api("/feedback", {
  method: "POST",
  body: { trackId: tracks[0].track._id, action: "like" },
});
```

### Sliders ophalen

```js
const userId = localStorage.getItem("userId");
const sliders = await api(`/sliders/${userId}`);
```

### Artiest blokkeren

```js
const userId = localStorage.getItem("userId");
await api(`/blacklist/${userId}`, {
  method: "POST",
  body: { type: "artist", value: "Nickelback" },
});
```

---

## Key management

### POST /api/v1/api-keys

Nieuwe key aanmaken. Vereist JWT `Authorization: Bearer` header.

| Veld   | Type   | Verplicht | Beschrijving     |
| ------ | ------ | --------- | ---------------- |
| `name` | string | ja        | Naam voor de key |

Max 5 actieve keys. Bij overschrijding: `409`.

### GET /api/v1/api-keys

Lijst van je keys. Vereist JWT. De volledige key wordt niet getoond (alleen `prefix`).

### DELETE /api/v1/api-keys/:id

Key intrekken (soft delete → `active: false`). Vereist JWT.

---

## Auth endpoints

### POST /api/v1/auth/signup

Account aanmaken. Publiek — geen headers vereist.

| Veld       | Type   | Verplicht | Beschrijving   |
| ---------- | ------ | --------- | -------------- |
| `username` | string | ja        | Gebruikersnaam |
| `email`    | string | ja        | E-mailadres    |
| `password` | string | ja        | Wachtwoord     |

### POST /api/v1/auth/login

Inloggen, JWT token ophalen. Publiek — geen headers vereist.

| Veld       | Type   | Verplicht | Beschrijving   |
| ---------- | ------ | --------- | -------------- |
| `username` | string | ja        | Gebruikersnaam |
| `password` | string | ja        | Wachtwoord     |

---

## Veelgemaakte fouten

| Fout                                  | Oorzaak                                   | Oplossing                                                            |
| ------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| `401 Missing Authorization header`    | JWT token ontbreekt                       | Voeg `Authorization: Bearer <token>` toe                             |
| `401 Invalid or expired token`        | JWT verlopen                              | Login opnieuw, sla nieuw token op                                    |
| `401 Missing X-API-Key header`        | API key ontbreekt                         | Voeg `X-API-Key` header toe                                          |
| `401 Invalid API key`                 | Key ongeldig of ingetrokken               | Check of de key actief is via `GET /api/v1/api-keys`                 |
| `403 Forbidden`                       | `:userId` in URL matcht niet met JWT user | Gebruik je eigen userId (uit login response `user.id`)               |
| `406 Not Acceptable`                  | `Accept` header is ongeldig               | Gebruik `Accept: application/json` of laat weg (default `*/*` werkt) |
| `400 profileVector array is required` | Body mist profileVector                   | Stuur een array van 20 getallen (uit `/profile/compute`)             |
| `409 Entry already exists`            | Duplicate blacklist entry                 | Check eerst of het item al geblokkeerd is                            |

---

Zie [api-v1.md](api-v1.md) voor alle endpoint details.
