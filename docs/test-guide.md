# Test Guide — test.html

Stap-voor-stap handleiding om alle features te testen via `test.html`.

## Vereisten

- Server draait (`npm run dev`)
- MongoDB is bereikbaar
- Open `http://localhost:{port}/test.html`

---

## Stap 1: Account aanmaken (Auth)

De Auth & API Key sectie staat bovenaan de sidebar.

1. Vul in: **Username** `testuser`, **Email** `test@test.nl`, **Password** `Test1234!`
2. Klik **1. Signup**
3. Verwacht: `Signup ok: testuser (userId)` in de log
4. User ID wordt automatisch ingevuld in de header

> Als de user al bestaat, krijg je "Username or email already exists". Kies een andere username of ga direct naar Login.

## Stap 2: Inloggen

1. Zelfde username + password als bij signup
2. Klik **2. Login**
3. Verwacht: `Login ok: testuser` + JWT token wordt getoond
4. User ID wordt automatisch ingevuld

## Stap 3: API Key aanmaken

1. Klik **3. API Key** (alleen mogelijk na login)
2. Verwacht: key wordt aangemaakt en automatisch ingevuld in het API Key veld (header)
3. De pagina verbindt automatisch opnieuw — status dot wordt groen, track count verschijnt

> De key wordt opgeslagen in localStorage. Bij volgende bezoeken hoef je niet opnieuw in te loggen.

---

## Stap 4: Tracks toevoegen (Ingest)

Open de "Track toevoegen" sectie in de sidebar.

### Enkele track

1. Vul **Artist** `Radiohead` en **Title** `Creep` in
2. Klik **+**
3. Verwacht: `created` of `exists` in de log

### Batch

1. Klik **Quick batch (5)**
2. Verwacht: `5+ 0= 0x` (5 created, 0 skipped, 0 failed)
3. Track count in de header update

### Enrichment

1. Klik **Enrich CF** — verrijkt tracks met collaborative filtering data van Last.fm
2. Klik **Enrich Spotify** — vereist Spotify credentials in `.env` (SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET)
3. Verwacht: `Enriched: X, skipped: Y` in de log

---

## Stap 5: Bereken & Recommend

1. Stel genre weights in via de sliders (of klik **Rock** / **Electronic** / **Random**)
2. Klik **Bereken & recommend**
3. Verwacht:
   - Profielvector verschijnt in de sidebar
   - Recommendations verschijnen in het hoofdpaneel met score, titel, artist en genre tags

### Filters

- **Min score** slider — filtert tracks onder de drempelwaarde
- **Limit** dropdown — beperkt het aantal resultaten (10/20/40/Alles)

Beide filters herberekenen live.

---

## Stap 6: Dial testen

De dial staat onder de genre weights in de sidebar.

1. Zorg dat je **eerst** recommendations hebt (stap 5)
2. Klik op een andere dial stand (1-5)
3. Verwacht: recommendations worden herladen met andere gewichten
   - **Stand 1**: genre-zwaar (voorspelbaar, dicht bij je profiel)
   - **Stand 5**: CF-zwaar (verrassend, cross-genre)
4. Let op verschil in scores en track volgorde

> De dial info toont de actieve genreWeight/cfWeight verhouding.

---

## Stap 7: Feedback

Feedback knoppen verschijnen op elke track card (alleen als User ID is ingevuld).

### Per track

- **&#9829;** (hart) — Like
- **&#10007;** (kruis rood) — Blacklist track
- **&#9654;** (play) — Play count +1
- **&#9747;** — Dislike

### Feedback overzicht

1. Open "Feedback overzicht" in de sidebar
2. Klik **Laden**
3. Verwacht: lijst met al je feedback (action, trackId, playCount)

### Effect testen

1. Like een paar tracks
2. Klik opnieuw **Bereken & recommend**
3. Gelikete tracks krijgen een hogere score (feedback multiplier)

---

## Stap 8: Sliders opslaan/laden

De knoppen staan onder de genre weights.

### Opslaan

1. Stel genre weights in
2. Klik **Opslaan**
3. Verwacht: `Sliders opgeslagen voor {userId}` in de log

### Laden

1. Klik **Reset** om sliders lokaal te resetten
2. Klik **Laden**
3. Verwacht: sliders worden hersteld naar de opgeslagen waarden

### Server reset

1. Klik **Server reset**
2. Verwacht: alle sliders worden gereset naar defaults (zowel server als lokaal)

---

## Stap 9: Blacklist

Open de "Blacklist" sectie in de sidebar.

### Entry toevoegen

1. Kies **Type**: `artist`, `track` of `genre`
2. Vul **Value** in (bijv. `Metallica` voor artist, `rock` voor genre)
3. Klik **Toevoegen**
4. Verwacht: entry verschijnt in de lijst

### Laden

1. Klik **Laden** om bestaande blacklist te zien

### Verwijderen

1. Klik **x** naast een entry
2. Verwacht: entry verdwijnt

### Effect testen

1. Blacklist een artist (bijv. `Metallica`)
2. Klik opnieuw **Bereken & recommend**
3. Verwacht: tracks van die artist verschijnen niet meer in recommendations

---

## Stap 10: Onboarding

Open de "Onboarding" sectie in de sidebar. Dit simuleert het eerste gebruik van de app.

1. Vul **Genres** in: `rock, electronic, jazz`
2. Optioneel **Artists**: `Radiohead, Daft Punk`
3. Kies **App**: SonarPop of Poppy
4. Klik **Start onboarding**
5. Verwacht: `Onboarding voltooid` + slider data in de log

> Onboarding maakt een profiel + sliders aan op basis van de gekozen genres/artists. Na onboarding kun je de sliders laden (stap 8) om het resultaat te zien.

---

## Samenvatting test flow

```
Signup → Login → API Key aanmaken
    → Tracks toevoegen (batch)
    → Enrich CF
    → Genre weights instellen
    → Bereken & recommend
    → Dial wijzigen (effect op scores)
    → Feedback geven (like/dislike)
    → Opnieuw recommend (feedback effect)
    → Sliders opslaan → reset → laden
    → Blacklist artist → recommend (gefilterd)
    → Onboarding testen
```
