# Demo Script — SonarPoppy

Back-end demo van 10 minuten. Tool: `demo.html` (geen Postman nodig).

**Opstart:** `npm run dev` + open `http://localhost:<port>/demo.html`

---

## Intro (0:00 — 0:30)

> "SonarPoppy is een muziek-aanbevelingsengine waar de gebruiker zelf controle heeft over het algoritme. Geen black box — je ziet precies waarom een nummer wordt aanbevolen."

**Benoem:**

- Shared backend voor twee apps (SonarPop & Poppy)
- REST API met Express, MongoDB, Last.fm als databron

---

## A. Authenticatie (0:30 — 1:00)

**Actie:** Klik "Alles in 1 klik" (quick setup) of loop de 3 stappen handmatig door.

> "Twee lagen beveiliging. Stap 1 en 2 zijn voor de **eindgebruiker**: account aanmaken en inloggen met een JWT token. Stap 3 is voor de **ontwikkelaar**: een API key per applicatie. In productie maakt de ontwikkelaar van SonarPop of Poppy die key aan, niet de eindgebruiker. Beide lagen zijn nodig om endpoints aan te spreken."

**Let op:** Groene vinkjes verschijnen per stap. Labels "Gebruiker" (blauw) en "Applicatie" (geel) maken het rolonderscheid visueel.

---

## B. Data ophalen (1:00 — 2:00)

**Actie:** Klik "Demo data laden (45 tracks)" → wacht → klik "CF data verrijken"

> "We halen tracks op van Last.fm. Per track berekenen we een genre-vector: 20 dimensies, gebaseerd op Last.fm tags die we mappen naar standaard genres via 230+ aliassen."

**Wijs aan:** Het voorbeeld van een genre-vector dat verschijnt (barchart).

> "Daarna verrijken we met collaborative filtering data — welke nummers vonden andere luisteraars ook goed? Dit komt van Last.fm's similar tracks en similar artists."

---

## C. Profiel instellen (2:00 — 2:30)

**Actie:** Klik "Rock fan" preset → toon sliders → klik "Bereken & recommend"

> "De gebruiker stelt zelf in welke genres zwaarder wegen. Dit wordt een profielvector — dezelfde 20 dimensies als de tracks."

**Wijs aan:** Profielvector barchart die verschijnt.

---

## D. Aanbevelingen + Dial (2:30 — 3:30)

**Actie:** Bekijk de track cards met score breakdown.

> "Elke aanbeveling toont de opbouw: genre-similarity in groen, collaborative filtering in blauw, de gewichtverdeling, en de feedback-multiplier in paars."

**Formule benoemen:**

> "Score = alpha maal genre-match plus beta maal CF, maal feedback. Alpha en beta worden bepaald door de dial."

**Actie:** Klik dial van 3 naar 5 (Anti-bubbel).

> "Kijk wat er gebeurt: dezelfde tracks, maar een andere ranking. Bij Anti-bubbel weegt collaborative filtering zwaarder — je krijgt meer verrassingen buiten je comfortzone."

---

## E. Feedback (3:30 — 4:00)

**Actie:** Like 2 tracks, dislike 1 track → klik "Opnieuw berekenen"

> "Like geeft een boost van 1.1x, dislike een penalty van 0.5x. Het systeem leert van je gedrag. Kijk: de scores zijn verschoven."

**Wijs aan:** feedbackMultiplier in de breakdown is nu anders dan 1.00.

---

## F. Robuustheid (4:00 — 4:30)

**Actie:** Ga naar tab E. Klik op 3-4 error cards.

> "Wat als er iets misgaat? Elke fout geeft een duidelijke HTTP status code en een beschrijvende melding."

**Benoem per test:**

- "Zonder auth → 401, je moet ingelogd zijn"
- "Verkeerde API key → 401, ongeldige key"
- "Ongeldig genre → 400, we valideren tegen onze 20 standaard genres"
- "Andere gebruiker → 403, je mag alleen bij je eigen data"

---

## AI Uitleg / Afsluiting (4:30 — 5:00)

> "We werken met 4 pijlers:"

1. **Genre vectors** — content-based, cosine similarity op 20-dimensionale vectoren
2. **Collaborative filtering** — Last.fm similar tracks/artists. Wij hebben niet genoeg eigen gebruikersdata, Last.fm heeft miljoenen scrobbles. Spotify deed hetzelfde in hun beginfase — ze kochten The Echo Nest en stapten pas over op eigen data toen ze genoeg hadden.
3. **Feedback** — eigen data die meegroeit met gebruik
4. **Spotify audio features** — tempo, energy, etc. — wilden we gebruiken maar de endpoints zijn alleen beschikbaar voor apps met veel gebruikers. Bewuste trade-off.

> "Het resultaat: een transparant aanbevelingssysteem waar de gebruiker zelf aan de knoppen zit."

---

## Veelgestelde vragen (backup)

**"Waarom geen echte ML?"**

> "Onze aanpak is transparant en interpreteerbaar. Je ziet precies waarom een nummer wordt aanbevolen. Met een neuraal netwerk zou dat een black box zijn."

**"Waarom Last.fm en niet Spotify?"**

> "Spotify's audio features zijn alleen beschikbaar voor grote apps. Last.fm biedt open toegang tot genre tags en similarity data."

**"Hoe schaalt dit?"**

> "De genre-vectoren en CF data worden per track opgeslagen. Het scoren is een simpele cosine similarity berekening — dat schaalt prima."
