# Het Dial Systeem

De dial is een knop met 5 standen die bepaalt **welke tracks** de gebruiker te zien krijgt. Hoe hoger de stand, hoe verder buiten de muziekbubbel.

## Hoe het werkt

Elke track krijgt altijd een score op basis van genre-match en collaborative filtering (50/50). De dial verandert die score **niet** — hij bepaalt wat er daarna mee gebeurt:

1. **Filteren** — sommige tracks worden weggegooid op basis van hun genre-score
2. **Sorteren** — de overgebleven tracks worden gerangschikt op een bepaald signaal
3. **Unplayed filter** — optioneel: alleen tracks die de gebruiker nog niet heeft gehoord

## De 5 standen

| Stand | Naam         | Filter                   | Sortering                    | Onbeluisterd |
| ----- | ------------ | ------------------------ | ---------------------------- | ------------ |
| **1** | Strikt       | genre-score >= 0.6       | genre-score (hoog naar laag) | nee          |
| **2** | Dichtbij     | genre-score >= 0.3       | genre-score (hoog naar laag) | nee          |
| **3** | Gebalanceerd | geen (alles komt erdoor) | genre-score (hoog naar laag) | nee          |
| **4** | Ontdekking   | geen                     | CF-score (hoog naar laag)    | **ja**       |
| **5** | Anti-bubbel  | geen                     | **random**                   | nee          |

### Wat betekent dit?

- **Stand 1-2**: Alleen tracks die qua genre goed matchen. Stand 1 is strenger (>= 0.6) dan stand 2 (>= 0.3).
- **Stand 3**: Default. Alles komt erdoor, gesorteerd op hoe goed het genre matcht.
- **Stand 4**: Focust op ontdekking. Sorteert op wat andere luisteraars leuk vinden (CF) en toont alleen tracks die je nog niet hebt gehoord.
- **Stand 5**: Compleet willekeurig. Elke request geeft een andere volgorde.

## API gebruik

### Presets ophalen

```
GET /api/v1/dial
```

Response:

```json
{
  "presets": [
    {
      "position": 1,
      "name": "Strikt",
      "description": "Blijft dicht bij je smaak. Alleen tracks met hoge genre-match.",
      "filter": { "type": "minGenreSim", "threshold": 0.6 },
      "sortSignal": "genreSim",
      "unplayedOnly": false
    },
    {
      "position": 2,
      "name": "Dichtbij",
      "description": "Herkenbaar met lichte variatie.",
      "filter": { "type": "minGenreSim", "threshold": 0.3 },
      "sortSignal": "genreSim",
      "unplayedOnly": false
    },
    {
      "position": 3,
      "name": "Gebalanceerd",
      "description": "Alles komt erdoor. Gesorteerd op genre-match.",
      "filter": { "type": "none", "threshold": null },
      "sortSignal": "genreSim",
      "unplayedOnly": false
    },
    {
      "position": 4,
      "name": "Ontdekking",
      "description": "Alleen onbeluisterde tracks. Gesorteerd op CF-score.",
      "filter": { "type": "none", "threshold": null },
      "sortSignal": "cf",
      "unplayedOnly": true
    },
    {
      "position": 5,
      "name": "Anti-bubbel",
      "description": "Pure random. Maximaal buiten de bubbel.",
      "filter": { "type": "none", "threshold": null },
      "sortSignal": "random",
      "unplayedOnly": false
    }
  ],
  "default": 3
}
```

### Recommendations met dial

Stuur `dial` mee in je POST body:

```
POST /api/v1/recommendations
```

```json
{
  "profileVector": [0.4, 0.1, 0.8, ...],
  "dial": 3
}
```

De response bevat `meta.dialPosition` zodat je weet welke stand actief is:

```json
{
  "tracks": [ ... ],
  "total": 42,
  "meta": {
    "dialPosition": 3,
    "avgScore": 0.45,
    "scoreRange": { "min": 0.12, "max": 0.92 },
    "activeSignals": ["genre", "cf"]
  }
}
```

## Frontend tips

### Simpelste implementatie

Een rij van 5 knoppen. Sla de geselecteerde stand op en stuur mee bij elke recommendation request.

```js
let currentDial = 3; // default

// Presets ophalen voor labels
const { presets } = await fetch("/api/v1/dial").then((r) => r.json());

// Recommendations ophalen
const recs = await fetch("/api/v1/recommendations", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    profileVector: userVector,
    dial: currentDial,
  }),
}).then((r) => r.json());
```

### Wat je NIET hoeft te doen

- Geen gewichten berekenen — de backend doet alles
- Geen filtering zelf doen — de response bevat al de gefilterde + gesorteerde tracks
- Geen aparte request per stand — wissel gewoon de `dial` waarde en doe een nieuwe request

### Preset data gebruiken voor UI

Je kunt de preset info uit `GET /api/v1/dial` gebruiken om tooltips of labels te tonen:

```js
presets.forEach((p) => {
  // p.name        → "Strikt", "Dichtbij", etc.
  // p.description → Uitleg voor de gebruiker
  // p.position    → 1-5
});
```

## Verschil met het oude systeem

Voorheen verschoof de dial de **gewichten** tussen genre en CF (bijv. stand 1 = 70% genre / 30% CF). Nu is de scoring altijd 50/50 en bepaalt de dial welke tracks **erdoor komen** en hoe ze **gesorteerd** worden. Dit geeft meer controle en maakt stand 4 en 5 veel nuttiger.
