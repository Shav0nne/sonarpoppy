# AI Algoritme — Presentatiescript

Script voor de AI-uitleg tijdens de demo. Volgt de stappen in `demo.html`.

> Ons algoritme werkt in twee lagen: eerst **scoren** (hoe goed past een track bij jou?), dan **filteren** via de dial (welke tracks komen erdoor?).

---

## Bij stap B — Data ophalen

**Actie:** Klik "Demo data laden" → wijs het genre-vector voorbeeld aan → klik "CF data verrijken"

> "Elke track krijgt een vingerafdruk: een vector van 20 genres. Die maken we door Last.fm tags — zoals 'alternative rock' of 'brit pop' — te mappen naar 20 standaard genres. Dat zie je hier: dit nummer scoort hoog op rock en indie, laag op jazz."

**Wijs aan:** de genre-vector bars die verschijnen.

> "Daarna verrijken we met collaborative filtering data. Dat is: welke andere tracks en artiesten vonden miljoenen Last.fm-luisteraars ook goed bij dit nummer? Die data hebben we straks nodig voor de tweede helft van de score."

---

## Bij stap C — Profiel instellen

**Actie:** Klik "Onboarding starten" of kies een preset (bijv. "Rock fan") → wijs de profielvector aan

> "De gebruiker heeft ook zo'n vector — dezelfde 20 dimensies als de tracks. Die ontstaat uit de onboarding: je kiest genres en artiesten, en het systeem berekent een startprofiel. Daarna kun je met de sliders fijn-tunen."

**Wijs aan:** profielvector bars die live updaten bij slider-wijzigingen.

> "Om te meten hoe goed een track bij je past, vergelijken we de twee vectoren met cosine similarity. Hoe meer ze dezelfde richting op wijzen, hoe hoger de score — van 0 tot 1."

---

## Bij stap D — Aanbevelingen

**Actie:** Bekijk de track cards met score breakdown.

### Laag 1: De score

> "Hier zie je het resultaat. Elke track heeft een score, opgebouwd uit twee signalen."

**Wijs aan:** de breakdown onder een track.

> "Groen is de genre-match: hoe goed past dit nummer bij je profiel? Blauw is collaborative filtering: vonden andere luisteraars met vergelijkbare smaak dit ook goed?"

**De formule:**

> "Score = genre-match plus CF, maal de feedback-multiplier."

### Feedback

**Actie:** Like 2 tracks, dislike 1 → wijs aan dat scores veranderen.

> "Feedback beïnvloedt twee dingen. Eén: de score. Like geeft een boost van 1.1×, save to library 1.2×, skip is 0.9×, dislike 0.5×. Twee: het past je genre-sliders aan. Like je een jazz-track? Dan schuiven je jazz-gewichten omhoog. Zo groeit je profiel mee met je smaak."

### Laag 2: De dial

**Actie:** Wissel de dial van stand 3 naar 1, dan naar 5. Wijs aan hoe de lijst verandert.

> "De dial bepaalt welke tracks je te zien krijgt en in welke volgorde. Vijf standen, van veilig tot avontuurlijk:"

- **Stand 1-3:** Filtert op genre-match — van streng naar los
- **Stand 4:** Alleen onbeluisterde tracks, gesorteerd op wat andere luisteraars goed vonden
- **Stand 5:** Willekeurig — maximaal buiten je bubbel

> "De gebruiker draait zelf aan de knop. Dat is het verschil: jij kiest hoe avontuurlijk het algoritme mag zijn."

---

## Afsluiting

> "Samengevat: laag 1 berekent de score op basis van genre-match, collaborative filtering en feedback. Laag 2 filtert en sorteert via de dial. Alles is transparant — je ziet precies waarom een nummer wordt aanbevolen, en je zit zelf aan de knoppen."
