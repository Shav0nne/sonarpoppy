# AI Algoritme — Presentatiescript

Script voor de AI-uitleg tijdens de demo. Volgt de stappen in `demo.html`.

> Ons algoritme werkt in twee lagen: eerst **scoren** (hoe goed past een track bij jou?), dan **filteren** via de dial (welke tracks komen erdoor?).

---

## Bij stap A — Authenticatie

> "Twee lagen beveiliging. De eerste twee stappen zijn voor de eindgebruiker: account aanmaken en inloggen met een JWT token. De derde stap is voor de ontwikkelaar: een API key per applicatie. In productie maakt de ontwikkelaar van SonarPop of Poppy die key aan, niet de eindgebruiker. Beide lagen zijn nodig om de API aan te spreken."

---

## Bij stap B — Data ophalen

> "Elke track krijgt een array van 20 genres — een genre-vector. Die maken we door Last.fm tags — zoals 'alternative rock' of 'brit pop' — te mappen naar 20 standaard genres. Dat zie je hier: dit nummer scoort hoog op rock en indie, laag op jazz."

> "Daarna verrijken we met collaborative filtering data. Dat is: welke andere tracks en artiesten vonden miljoenen Last.fm-luisteraars ook goed bij dit nummer? Die data hebben we straks nodig voor de tweede helft van de score."

---

## Bij stap C — Profiel instellen

> "De gebruiker heeft ook zo'n vector — dezelfde 20 dimensies als de tracks. Die ontstaat uit de onboarding: je kiest genres en artiesten, en het systeem berekent een startprofiel. Daarna kun je met de sliders fijn-tunen."

> "Slider presets laten je snel wisselen tussen smaken. Er zijn 3 defaults, en je kunt je huidige instellingen opslaan als een nieuwe preset. Handig als je afwisselend naar rock en jazz luistert."

> "Om te meten hoe goed een track bij je past, vergelijken we de twee vectoren met cosine similarity. Hoe meer ze dezelfde richting op wijzen, hoe hoger de score — van 0 tot 1."

---

## Bij stap D — Aanbevelingen

### Laag 1: De score

> "Hier zie je het resultaat. Elke track heeft een score, opgebouwd uit twee signalen."

> "Groen is de genre-match: hoe goed past dit nummer bij je profiel? Blauw is collaborative filtering: als andere luisteraars dit nummer vaak samen met jouw gelikete tracks beluisterden, stijgt de score."

> "Score = genre-match plus CF, maal de feedback-multiplier."

### Feedback

> "Feedback beïnvloedt twee dingen. Eén: de score. Like geeft een boost van 1.1×, save to library 1.2×, skip is 0.9×, dislike 0.5×. Twee: het past je genre-sliders aan. Like je een jazz-track? Dan schuiven je jazz-gewichten omhoog. Zo groeit je profiel mee met je smaak."

### Filters

> "De filterbalk laat de frontend gerichte playlists samenstellen. Filter op genre — bijvoorbeeld 'alleen rock' — of op artiest, sorteer op nieuwste eerst, verberg explicit content, of toon alleen onbeluisterde tracks. Alle filters zijn combineerbaar: 'rock tracks van deze week die ik nog niet heb gehoord'. De backend past de filters toe ná de scoring, zodat de scores zuiver blijven."

### Laag 2: De dial

> "De dial bepaalt welke tracks je te zien krijgt en in welke volgorde. Vijf standen, van veilig tot avontuurlijk:"

- **Stand 1-3:** Filtert op genre-match — van streng naar los
- **Stand 4:** Alleen onbeluisterde tracks, gesorteerd op wat andere luisteraars goed vonden
- **Stand 5:** Willekeurig — maximaal buiten je bubbel

> "De gebruiker draait zelf aan de knop. Dat is het verschil: jij kiest hoe avontuurlijk het algoritme mag zijn."

---

## Bij stap E — Robuustheid

> "Wat als er iets misgaat? Elke knop stuurt een bewust verkeerd request. Zonder JWT token krijg je een 401 — je moet ingelogd zijn. Een verkeerde API key: ook 401. Een ongeldig genre zoals 'reggaeton' geeft een 400 — we valideren tegen onze 20 standaard genres. En als je probeert bij data van een andere gebruiker te komen: 403, je mag alleen bij je eigen data."
