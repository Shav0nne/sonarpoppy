# Getting Started

## Voor wie is dit?

Dit document legt uit hoe je als frontend-developer toegang krijgt tot de SonarPoppy API. Eenmalige setup — daarna gebruik je alleen je API key.

## Base URL

```
http://localhost:8000/api/v1
```

Poortnummer kan anders zijn — check `.env` → `EXPRESS_PORT`.

## Vereiste headers

```
Accept: application/json              ← altijd meesturen
Content-Type: application/json        ← alleen bij POST/PUT
X-API-Key: sk_live_jouw_key_hier      ← voor alle /api/v1/* endpoints
```

> Zonder `Accept: application/json` krijg je altijd `406 Not Acceptable`.

---

## API Key aanvragen (eenmalig)

### 1. Account aanmaken

```bash
curl -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"username": "mijnapp", "email": "dev@example.com", "password": "wachtwoord123"}'
```

### 2. Inloggen (JWT token ophalen)

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"username": "mijnapp", "password": "wachtwoord123"}'
```

Response:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "tokenType": "Bearer",
  "expiresIn": "1h",
  "user": { "id": "...", "username": "mijnapp", "role": "user" }
}
```

### 3. API key aanmaken

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

> **Bewaar de `key`!** Dit is de enige keer dat je de volledige key te zien krijgt. Max 5 keys per account.

### 4. API key gebruiken

Voeg `X-API-Key` toe aan alle data-requests:

```bash
curl http://localhost:8000/api/v1/genres \
  -H "Accept: application/json" \
  -H "X-API-Key: sk_live_1234abcd5678efgh90ijklmn12opqr"
```

In JavaScript (fetch):

```js
const API_KEY = "sk_live_...";
const BASE = "http://localhost:8000/api/v1";

const res = await fetch(`${BASE}/genres`, {
  headers: {
    Accept: "application/json",
    "X-API-Key": API_KEY,
  },
});
const data = await res.json();
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

### POST /auth/signup

Account aanmaken.

| Veld       | Type   | Verplicht | Beschrijving   |
| ---------- | ------ | --------- | -------------- |
| `username` | string | ja        | Gebruikersnaam |
| `email`    | string | ja        | E-mailadres    |
| `password` | string | ja        | Wachtwoord     |

### POST /auth/login

Inloggen, JWT token ophalen.

| Veld       | Type   | Verplicht | Beschrijving   |
| ---------- | ------ | --------- | -------------- |
| `username` | string | ja        | Gebruikersnaam |
| `password` | string | ja        | Wachtwoord     |

---

## Veelgemaakte fouten

| Fout                                  | Oorzaak                                  | Oplossing                                           |
| ------------------------------------- | ---------------------------------------- | --------------------------------------------------- |
| `406 Not Acceptable`                  | `Accept` header ontbreekt                | Voeg `Accept: application/json` toe aan elk request |
| `401 Unauthorized`                    | Geen of ongeldige API key                | Check `X-API-Key` header                            |
| `400 profileVector array is required` | Body mist of profileVector is geen array | Stuur een array van 20 getallen                     |
| `409 Entry already exists`            | Duplicate blacklist entry                | Check eerst of het item al geblokkeerd is           |
| Lege recommendations                  | Geen tracks in database                  | Vraag backend-beheerder om tracks te ingesten       |

---

## Typische app flow

```
1. GET  /api/v1/genres                → 20 genres tonen aan gebruiker
2. POST /api/v1/onboarding           → genres + artiesten kiezen (cold start)
3. POST /api/v1/profile/compute      → profielvector berekenen
4. POST /api/v1/recommendations      → aanbevelingen ophalen
5. POST /api/v1/feedback             → like/dislike/skip registreren
```

Zie [api.md](api.md) voor alle endpoint details.
