/**
 * 20 gestandaardiseerde muziekgenres voor SonarPoppy.
 * Elke genre heeft een vaste index (0-19) die correspondeert met
 * de positie in genre-vectors.
 */
export const GENRES = Object.freeze([
  "rock",
  "pop",
  "electronic",
  "hip-hop",
  "r&b",
  "jazz",
  "classical",
  "metal",
  "folk",
  "country",
  "blues",
  "punk",
  "indie",
  "soul",
  "reggae",
  "latin",
  "funk",
  "ambient",
  "dance",
  "world",
]);

export const GENRE_COUNT = GENRES.length;

export const GENRE_INDEX = Object.freeze(Object.fromEntries(GENRES.map((g, i) => [g, i])));

/**
 * Alias mapping: Last.fm freeform tags → standaard genre.
 * Alle keys zijn lowercase.
 */
export const GENRE_ALIASES = Object.freeze({
  // rock
  rock: "rock",
  "classic rock": "rock",
  "alternative rock": "rock",
  "hard rock": "rock",
  "soft rock": "rock",
  "progressive rock": "rock",
  "psychedelic rock": "rock",
  "garage rock": "rock",
  grunge: "rock",

  // pop
  pop: "pop",
  "synth pop": "pop",
  synthpop: "pop",
  "dream pop": "pop",
  "power pop": "pop",
  electropop: "pop",
  "art pop": "pop",
  "teen pop": "pop",
  "k-pop": "pop",
  "j-pop": "pop",

  // electronic
  electronic: "electronic",
  electronica: "electronic",
  edm: "electronic",
  techno: "electronic",
  house: "electronic",
  trance: "electronic",
  dubstep: "electronic",
  "drum and bass": "electronic",
  dnb: "electronic",
  idm: "electronic",
  downtempo: "electronic",
  "trip-hop": "electronic",
  "trip hop": "electronic",

  // hip-hop
  "hip-hop": "hip-hop",
  "hip hop": "hip-hop",
  hiphop: "hip-hop",
  rap: "hip-hop",
  trap: "hip-hop",
  "gangsta rap": "hip-hop",
  "conscious hip hop": "hip-hop",
  "boom bap": "hip-hop",

  // r&b
  "r&b": "r&b",
  rnb: "r&b",
  "r and b": "r&b",
  "rhythm and blues": "r&b",
  "contemporary r&b": "r&b",
  "neo-soul": "r&b",

  // jazz
  jazz: "jazz",
  "smooth jazz": "jazz",
  bebop: "jazz",
  "free jazz": "jazz",
  "acid jazz": "jazz",
  "jazz fusion": "jazz",
  swing: "jazz",
  "big band": "jazz",

  // classical
  classical: "classical",
  "classical music": "classical",
  baroque: "classical",
  romantic: "classical",
  opera: "classical",
  orchestral: "classical",
  "chamber music": "classical",
  symphony: "classical",
  "contemporary classical": "classical",

  // metal
  metal: "metal",
  "heavy metal": "metal",
  "death metal": "metal",
  "black metal": "metal",
  "thrash metal": "metal",
  "doom metal": "metal",
  "power metal": "metal",
  "nu metal": "metal",
  metalcore: "metal",
  "progressive metal": "metal",

  // folk
  folk: "folk",
  "folk rock": "folk",
  "indie folk": "folk",
  "singer-songwriter": "folk",
  acoustic: "folk",
  americana: "folk",
  "traditional folk": "folk",

  // country
  country: "country",
  "country rock": "country",
  "alt-country": "country",
  bluegrass: "country",
  "outlaw country": "country",
  nashville: "country",

  // blues
  blues: "blues",
  "blues rock": "blues",
  "delta blues": "blues",
  "electric blues": "blues",
  "chicago blues": "blues",

  // punk
  punk: "punk",
  "punk rock": "punk",
  "pop punk": "punk",
  "post-punk": "punk",
  "hardcore punk": "punk",
  hardcore: "punk",
  "ska punk": "punk",
  emo: "punk",

  // indie
  indie: "indie",
  "indie rock": "indie",
  "indie pop": "indie",
  "lo-fi": "indie",
  lofi: "indie",
  shoegaze: "indie",
  "post-rock": "indie",
  "math rock": "indie",
  "noise pop": "indie",

  // soul
  soul: "soul",
  "neo soul": "soul",
  motown: "soul",
  "northern soul": "soul",
  "southern soul": "soul",

  // reggae
  reggae: "reggae",
  ska: "reggae",
  dub: "reggae",
  dancehall: "reggae",
  "roots reggae": "reggae",
  rocksteady: "reggae",

  // latin
  latin: "latin",
  salsa: "latin",
  reggaeton: "latin",
  "bossa nova": "latin",
  samba: "latin",
  bachata: "latin",
  cumbia: "latin",
  "latin pop": "latin",

  // funk
  funk: "funk",
  "p-funk": "funk",
  disco: "funk",
  boogie: "funk",

  // ambient
  ambient: "ambient",
  "new age": "ambient",
  chillout: "ambient",
  "chill out": "ambient",
  drone: "ambient",
  "dark ambient": "ambient",
  meditation: "ambient",

  // dance
  dance: "dance",
  eurodance: "dance",
  "dance-pop": "dance",
  "hi-nrg": "dance",
  freestyle: "dance",

  // world
  world: "world",
  "world music": "world",
  afrobeat: "world",
  afrobeats: "world",
  celtic: "world",
  flamenco: "world",
  arabic: "world",
  bollywood: "world",
  african: "world",
  asian: "world",
});

/**
 * Resolves a Last.fm freeform tag naar een standaard genre.
 * Case-insensitive. Retourneert null bij onbekende tags.
 */
export function resolveAlias(tag) {
  if (tag == null || typeof tag !== "string") return null;
  return GENRE_ALIASES[tag.toLowerCase().trim()] ?? null;
}

/**
 * Genre naam → index (0-19). Retourneert null bij onbekend genre.
 */
export function genreNameToIndex(name) {
  if (name == null || typeof name !== "string") return null;
  const idx = GENRE_INDEX[name.toLowerCase().trim()];
  return idx !== undefined ? idx : null;
}

/**
 * Genre index (0-19) → naam. Retourneert null bij ongeldige index.
 */
export function genreIndexToName(index) {
  if (typeof index !== "number" || index < 0 || index >= GENRE_COUNT) {
    return null;
  }
  return GENRES[index];
}
