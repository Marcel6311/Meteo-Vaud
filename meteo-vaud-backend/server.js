// server.js
//
// Meteo-Vaud backend v4
// Ingestion SwissMetNet + capitales mondiales par region + endpoints REST.
//
// Scopes stations disponibles :
//   - "vd" (par defaut) : les 14 stations vaudoises curatees (config/stations.js)
//   - "ch" : toutes les stations SwissMetNet de Suisse (~150), decouvertes
//            automatiquement via sources/stationRegistry.js
//
// GET /capitals/current?region=... expose la temperature actuelle des
// capitales pour une region donnee (source OpenWeatherMap) :
//   europe (defaut), north_america, south_america, africa, asia, oceania
//
// Root Directory sur Render : meteo-vaud-backend
// Start command : npm start

const express = require("express");
const cors = require("cors");
const VD_STATIONS = require("./config/stations");
const EUROPE_CAPITALS = require("./config/capitals");
const WORLD_CAPITALS = require("./config/capitals-world");
const EXTREME_PLACES = require("./config/extreme-places");
const FRANCE_BORDER = require("./config/france-border");
const { fetchCurrentReadings } = require("./sources/swissmetnet");
const { getAllStations } = require("./sources/stationRegistry");
const { fetchCapitalsList } = require("./sources/capitals");
const { fetchAzureMapsForStations } = require("./sources/azuremaps");
const { fetchHeatwaveForStations, TEMP_THRESHOLD_C, CONSECUTIVE_DAYS_THRESHOLD } = require("./sources/heatwave");
const { fetchEpicFrames } = require("./sources/epic");
const { fetchFirmsData } = require("./sources/firms");
const { fetchApod, fetchNeo } = require("./sources/nasa");
const { fetchJwstImages } = require("./sources/jwst");
const { fetchEuropeWindGrid } = require("./sources/wind");
const { fetchAllEarthquakes } = require("./sources/earthquakes");
const { fetchEnso } = require("./sources/enso");
const { fetchSpaceWeather } = require("./sources/spaceweather");
const { fetchPollen } = require("./sources/pollen");
const { fetchGlobalTemp } = require("./sources/globaltemp");

const app = express();
app.use(cors());

// Empeche le navigateur (Safari mobile en particulier, connu pour etre
// agressif) de mettre en cache les reponses JSON de l'API. Sans ca, un
// bouton "rafraichir" cote frontend peut ne rien changer si le navigateur
// sert une reponse deja en cache sans meme recontacter le serveur.
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  next();
});

const PORT = process.env.PORT || 3000;
const DATA_REFRESH_MS = 10 * 60 * 1000; // 10 minutes, aligne sur la cadence SwissMetNet
const CAPITALS_REFRESH_MS = 30 * 60 * 1000; // 30 minutes, largement suffisant pour des capitales

// Regions de capitales disponibles. La liste des stations est chargee
// une seule fois ici ; le cache de mesures est construit dans REGION_CACHES.
const CAPITAL_REGIONS = {
  europe: EUROPE_CAPITALS,
  north_america: WORLD_CAPITALS.NORTH_AMERICA,
  south_america: WORLD_CAPITALS.SOUTH_AMERICA,
  africa: WORLD_CAPITALS.AFRICA,
  asia: WORLD_CAPITALS.ASIA,
  oceania: WORLD_CAPITALS.OCEANIA,
  extremes: EXTREME_PLACES,
  france: FRANCE_BORDER
};

// Un cache separe par scope station, meme forme pour les deux :
// { updatedAt: ISOString, readings: [...], lastError: string|null }
let caches = {
  vd: { updatedAt: null, readings: [], lastError: null },
  ch: { updatedAt: null, readings: [], lastError: null }
};

let chStationsCount = null; // rempli au premier refresh du scope "ch"

// Cache par region de capitales, meme forme.
let capitalCaches = {};
Object.keys(CAPITAL_REGIONS).forEach((region) => {
  capitalCaches[region] = { updatedAt: null, readings: [], lastError: null };
});

let heatwaveCache = { updatedAt: null, readings: [], lastError: null };
let epicCache = { updatedAt: null, frames: [], lastError: null };
let firmsCache = { updatedAt: null, detections: [], lastError: null };
let apodCache = { updatedAt: null, apod: null, lastError: null };
let neoCache = { updatedAt: null, asteroids: [], lastError: null };
let jwstCache = { updatedAt: null, images: [], lastError: null };
let windCache = { updatedAt: null, grid: null, lastError: null };
let earthquakeCache = { updatedAt: null, earthquakes: [], lastError: null };
let ensoCache = { updatedAt: null, enso: null, lastError: null };
let spaceWeatherCache = { updatedAt: null, spaceWeather: null, lastError: null };
let pollenCache = { updatedAt: null, pollen: null, lastError: null };
let globalTempCache = { updatedAt: null, globalTemp: null, lastError: null };

function pickScope(req) {
  const scope = (req.query.scope || "vd").toLowerCase();
  return scope === "ch" ? "ch" : "vd";
}

function pickRegion(req) {
  const region = (req.query.region || "europe").toLowerCase();
  return CAPITAL_REGIONS[region] ? region : "europe";
}

async function refreshScope(scope) {
  try {
    const stationsList = scope === "ch" ? await getAllStations() : VD_STATIONS;
    if (scope === "ch") chStationsCount = stationsList.length;

    const readings = await fetchCurrentReadings(stationsList);
    caches[scope] = {
      updatedAt: new Date().toISOString(),
      readings,
      lastError: null
    };
    console.log(
      `[refresh:${scope}] ${readings.length} lectures mises a jour (${caches[scope].updatedAt})`
    );
  } catch (err) {
    caches[scope].lastError = err.message;
    console.error(`[refresh:${scope}] echec :`, err.message);
    // on garde l'ancien cache plutot que de servir du vide
  }
}

async function refreshAll() {
  await refreshScope("vd");
  await refreshScope("ch");
}

async function refreshCapitalRegion(region) {
  try {
    const readings = await fetchCapitalsList(CAPITAL_REGIONS[region]);
    capitalCaches[region] = {
      updatedAt: new Date().toISOString(),
      readings,
      lastError: null
    };
    console.log(
      `[refresh:capitals:${region}] ${readings.length} capitales mises a jour (${capitalCaches[region].updatedAt})`
    );
  } catch (err) {
    capitalCaches[region].lastError = err.message;
    console.error(`[refresh:capitals:${region}] echec :`, err.message);
  }
}

async function refreshAllCapitalRegions() {
  // Sequentiel plutot qu'en parallele : evite d'envoyer ~200 requetes
  // simultanees a OpenWeatherMap et de risquer un plafond par minute.
  for (const region of Object.keys(CAPITAL_REGIONS)) {
    await refreshCapitalRegion(region);
  }
}

async function refreshHeatwave() {
  try {
    const readings = await fetchHeatwaveForStations(VD_STATIONS);
    heatwaveCache = {
      updatedAt: new Date().toISOString(),
      readings,
      lastError: null
    };
    console.log(
      `[refresh:heatwave] ${readings.length} stations analysees (${heatwaveCache.updatedAt})`
    );
  } catch (err) {
    heatwaveCache.lastError = err.message;
    console.error("[refresh:heatwave] echec :", err.message);
  }
}

async function refreshEpic() {
  try {
    const frames = await fetchEpicFrames();
    epicCache = {
      updatedAt: new Date().toISOString(),
      frames,
      lastError: null
    };
    console.log(`[refresh:epic] ${frames.length} images recuperees (${epicCache.updatedAt})`);
  } catch (err) {
    epicCache.lastError = err.message;
    console.error("[refresh:epic] echec :", err.message);
  }
}

async function refreshFirms() {
  try {
    const detections = await fetchFirmsData();
    firmsCache = {
      updatedAt: new Date().toISOString(),
      detections,
      lastError: null
    };
    console.log(`[refresh:firms] ${detections.length} detections recuperees (${firmsCache.updatedAt})`);
  } catch (err) {
    firmsCache.lastError = err.message;
    console.error("[refresh:firms] echec :", err.message);
  }
}

async function refreshApod() {
  try {
    const apod = await fetchApod();
    apodCache = {
      updatedAt: new Date().toISOString(),
      apod,
      lastError: null
    };
    console.log(`[refresh:apod] "${apod.title}" (${apodCache.updatedAt})`);
  } catch (err) {
    apodCache.lastError = err.message;
    console.error("[refresh:apod] echec :", err.message);
  }
}

async function refreshNeo() {
  try {
    const asteroids = await fetchNeo();
    neoCache = {
      updatedAt: new Date().toISOString(),
      asteroids,
      lastError: null
    };
    console.log(`[refresh:neo] ${asteroids.length} asteroides recuperes (${neoCache.updatedAt})`);
  } catch (err) {
    neoCache.lastError = err.message;
    console.error("[refresh:neo] echec :", err.message);
  }
}

async function refreshJwst() {
  try {
    const images = await fetchJwstImages();
    jwstCache = {
      updatedAt: new Date().toISOString(),
      images,
      lastError: null
    };
    console.log(`[refresh:jwst] ${images.length} images recuperees (${jwstCache.updatedAt})`);
  } catch (err) {
    jwstCache.lastError = err.message;
    console.error("[refresh:jwst] echec :", err.message);
  }
}

async function refreshWindEurope() {
  try {
    const grid = await fetchEuropeWindGrid();
    windCache = {
      updatedAt: new Date().toISOString(),
      grid,
      lastError: null
    };
    console.log(`[refresh:wind:europe] grille mise a jour (${windCache.updatedAt})`);
  } catch (err) {
    windCache.lastError = err.message;
    console.error("[refresh:wind:europe] echec :", err.message);
  }
}

async function refreshEarthquakes() {
  try {
    const earthquakes = await fetchAllEarthquakes();
    earthquakeCache = {
      updatedAt: new Date().toISOString(),
      earthquakes,
      lastError: null
    };
    console.log(`[refresh:earthquakes] ${earthquakes.length} seismes recuperes (${earthquakeCache.updatedAt})`);
  } catch (err) {
    earthquakeCache.lastError = err.message;
    console.error("[refresh:earthquakes] echec :", err.message);
  }
}

async function refreshEnso() {
  try {
    const enso = await fetchEnso();
    ensoCache = {
      updatedAt: new Date().toISOString(),
      enso,
      lastError: null
    };
    console.log(`[refresh:enso] ${enso.phase}${enso.strength ? " (" + enso.strength + ")" : ""} — anomalie ${enso.sstAnomaly}°C (${ensoCache.updatedAt})`);
  } catch (err) {
    ensoCache.lastError = err.message;
    console.error("[refresh:enso] echec :", err.message);
  }
}

async function refreshSpaceWeather() {
  try {
    const spaceWeather = await fetchSpaceWeather();
    spaceWeatherCache = {
      updatedAt: new Date().toISOString(),
      spaceWeather,
      lastError: null
    };
    console.log(`[refresh:spaceweather] Kp=${spaceWeather.kp} (${spaceWeather.gScale}) — ${spaceWeatherCache.updatedAt}`);
  } catch (err) {
    spaceWeatherCache.lastError = err.message;
    console.error("[refresh:spaceweather] echec :", err.message);
  }
}

async function refreshPollen() {
  try {
    const pollen = await fetchPollen();
    pollenCache = {
      updatedAt: new Date().toISOString(),
      pollen,
      lastError: null
    };
    console.log(`[refresh:pollen] ${pollen.readings.length} types recuperes pour ${pollen.station} (${pollenCache.updatedAt})`);
  } catch (err) {
    pollenCache.lastError = err.message;
    console.error("[refresh:pollen] echec :", err.message);
  }
}

async function refreshGlobalTemp() {
  try {
    const globalTemp = await fetchGlobalTemp();
    globalTempCache = {
      updatedAt: new Date().toISOString(),
      globalTemp,
      lastError: null
    };
    console.log(`[refresh:globaltemp] ${globalTemp.period} — anomalie ${globalTemp.anomaly}°C (${globalTempCache.updatedAt})`);
  } catch (err) {
    globalTempCache.lastError = err.message;
    console.error("[refresh:globaltemp] echec :", err.message);
  }
}

// GET /health - verification rapide de l'etat du service
app.get("/health", (req, res) => {
  const capitalsHealth = {};
  Object.keys(capitalCaches).forEach((region) => {
    capitalsHealth[region] = {
      lastUpdated: capitalCaches[region].updatedAt,
      capitalsTracked: capitalCaches[region].readings.length,
      lastError: capitalCaches[region].lastError
    };
  });

  res.json({
    status: "ok",
    vd: {
      lastUpdated: caches.vd.updatedAt,
      stationsTracked: VD_STATIONS.length,
      lastError: caches.vd.lastError
    },
    ch: {
      lastUpdated: caches.ch.updatedAt,
      stationsTracked: chStationsCount,
      lastError: caches.ch.lastError
    },
    capitals: capitalsHealth
  });
});

// GET /stations?scope=vd|ch - metadonnees des stations (statique-ish)
app.get("/stations", async (req, res) => {
  const scope = pickScope(req);
  try {
    const stations = scope === "ch" ? await getAllStations() : VD_STATIONS;
    res.json({
      source: "MeteoSwiss (SwissMetNet, OGD)",
      licence: "CC-BY - Source: MeteoSwiss",
      scope,
      count: stations.length,
      stations
    });
  } catch (err) {
    res.status(502).json({ error: "Echec recuperation liste des stations", detail: err.message });
  }
});

// GET /stations/current?scope=vd|ch - dernieres valeurs
app.get("/stations/current", (req, res) => {
  const scope = pickScope(req);
  const cache = caches[scope];
  res.json({
    source: "MeteoSwiss (SwissMetNet, OGD)",
    licence: "CC-BY - Source: MeteoSwiss",
    scope,
    updatedAt: cache.updatedAt,
    count: cache.readings.length,
    readings: cache.readings
  });
});

// GET /stations/compare - SwissMetNet vs Azure Maps sur les stations vaudoises
// IMPORTANT : cette route doit rester declaree AVANT /stations/:code,
// sinon Express interprete "compare" comme un code de station et cette
// route n'est jamais atteinte.
app.get("/stations/compare", async (req, res) => {
  try {
    const azureReadings = await fetchAzureMapsForStations(VD_STATIONS);
    const azureByCode = Object.fromEntries(azureReadings.map((r) => [r.station_id, r]));

    const comparison = caches.vd.readings.map((swiss) => {
      const azure = azureByCode[swiss.station_id];
      const diff =
        swiss.temperature !== null && swiss.temperature !== undefined &&
        azure && azure.temperature !== null && azure.temperature !== undefined
          ? Math.round((azure.temperature - swiss.temperature) * 10) / 10
          : null;

      return {
        station_id: swiss.station_id,
        station_name: swiss.station_name,
        lat: swiss.lat,
        lon: swiss.lon,
        swissmetnet_temperature: swiss.temperature,
        azuremaps_temperature: azure ? azure.temperature : null,
        azuremaps_description: azure ? azure.description : null,
        azuremaps_ressenti: azure ? azure.ressenti : null,
        azuremaps_point_de_rosee: azure ? azure.point_de_rosee : null,
        azuremaps_indice_uv: azure ? azure.indice_uv : null,
        azuremaps_couverture_nuageuse: azure ? azure.couverture_nuageuse : null,
        azuremaps_visibilite: azure ? azure.visibilite : null,
        azuremaps_pression: azure ? azure.pression : null,
        azuremaps_tendance_pression: azure ? azure.tendance_pression : null,
        ecart: diff
      };
    });

    res.json({
      sources: {
        swissmetnet: "MeteoSwiss (SwissMetNet, OGD) - mesure officielle",
        azuremaps: "Azure Maps Weather (Microsoft) - produit meteo commercial"
      },
      note: "Azure Maps Weather n'est pas confirme comme utilisant le modele Aurora en interne.",
      updatedAt: new Date().toISOString(),
      comparison
    });
  } catch (err) {
    res.status(502).json({ error: "Echec de la comparaison", detail: err.message });
  }
});

// GET /stations/heatwave - indicateur "maison" de canicule (voir sources/heatwave.js)
// IMPORTANT : cette route doit rester declaree AVANT /stations/:code,
// sinon Express interprete "heatwave" comme un code de station.
app.get("/stations/heatwave", (req, res) => {
  res.json({
    source: "Indicateur maison (previsions OpenWeatherMap)",
    note: "Ce n'est PAS le plan canicule officiel. Seuil applique : " +
      TEMP_THRESHOLD_C + "\u00b0C sur au moins " + CONSECUTIVE_DAYS_THRESHOLD +
      " jours consecutifs, sur un horizon de prevision de 5 jours.",
    updatedAt: heatwaveCache.updatedAt,
    lastError: heatwaveCache.lastError,
    readings: heatwaveCache.readings
  });
});

// GET /firms - detections d'incendies actifs avec FRP (NASA FIRMS)
// Cache global Europe, rafraichi toutes les 2h.
app.get("/firms", (req, res) => {
  res.json({
    source: "NASA FIRMS (VIIRS NOAA-20 + NOAA-21)",
    licence: "NASA Open Data",
    bbox: "mondial (6 zones continentales)",
    dayRange: 2,
    note: "FRP (Fire Radiative Power) en megawatts. Confiance : h = haute, n = nominale (basse filtree).",
    updatedAt: firmsCache.updatedAt,
    lastError: firmsCache.lastError,
    count: firmsCache.detections.length,
    detections: firmsCache.detections
  });
});

// GET /apod - Photo astronomique du jour (NASA APOD)
// Rafraichi toutes les 6h (la photo change une fois par jour, vers minuit EST).
app.get("/apod", (req, res) => {
  res.json({
    source: "NASA Astronomy Picture of the Day",
    updatedAt: apodCache.updatedAt,
    lastError: apodCache.lastError,
    apod: apodCache.apod
  });
});

// GET /neo - Asteroides proches de la Terre (NASA NeoWs), 7 jours
// Rafraichi toutes les 6h.
app.get("/neo", (req, res) => {
  res.json({
    source: "NASA Near Earth Object Web Service (NeoWs)",
    note: "Asteroides tries par distance minimale. miss_distance_lunar = distance en unites lunaires (1 = distance Terre-Lune).",
    updatedAt: neoCache.updatedAt,
    lastError: neoCache.lastError,
    count: neoCache.asteroids.length,
    asteroids: neoCache.asteroids
  });
});

// GET /jwst - Top 100 images du telescope James Webb (ESA Webb / STScI)
// Rafraichi toutes les 12h.
app.get("/jwst", (req, res) => {
  res.json({
    source: "ESA/Webb (esawebb.org) — images traitees et publiees",
    updatedAt: jwstCache.updatedAt,
    lastError: jwstCache.lastError,
    count: jwstCache.images.length,
    images: jwstCache.images
  });
});

// GET /wind-europe - grille de vent Europe (vitesse/direction 10m), au format
// leaflet-velocity. Source : OpenWeatherMap (grille construite cote serveur).
app.get("/wind-europe", (req, res) => {
  res.json({
    source: "OpenWeatherMap (grille Europe, 2 degres, construite cote serveur)",
    updatedAt: windCache.updatedAt,
    lastError: windCache.lastError,
    grid: windCache.grid
  });
});

// GET /wind-europe/refresh - declenche manuellement la (re)construction de la
// grille Europe. AUCUN declenchement automatique ailleurs dans le code :
// seul un appel explicite a cette route lance la construction (~7-8 min).
let windEuropeRefreshInProgress = false;
app.get("/wind-europe/refresh", (req, res) => {
  if (windEuropeRefreshInProgress) {
    return res.json({ status: "deja_en_cours", message: "Une construction est deja en cours, patientez." });
  }
  windEuropeRefreshInProgress = true;
  refreshWindEurope().finally(() => { windEuropeRefreshInProgress = false; });
  res.json({ status: "demarre", message: "Construction de la grille Europe lancee (~7-8 minutes). Consultez /wind-europe pour verifier l'avancement (updatedAt)." });
});

// GET /earthquakes - seismes recents (USGS mondial + SED Suisse combines)
// Rafraichi toutes les 15 minutes.
app.get("/earthquakes", (req, res) => {
  res.json({
    source: "USGS (mondial, 7 derniers jours) + SED/ETH Zurich (Suisse, 30 derniers jours)",
    licence: "Domaine public (USGS) / SED ETH Zurich",
    updatedAt: earthquakeCache.updatedAt,
    lastError: earthquakeCache.lastError,
    count: earthquakeCache.earthquakes.length,
    earthquakes: earthquakeCache.earthquakes
  });
});

// GET /enso - indice ONI (El Nino / La Nina / Neutre), NOAA/CPC, mis a jour mensuellement
app.get("/enso", (req, res) => {
  res.json({
    source: "NOAA/CPC — Oceanic Niño Index (ONI)",
    updatedAt: ensoCache.updatedAt,
    lastError: ensoCache.lastError,
    enso: ensoCache.enso
  });
});

// GET /spaceweather - indice Kp (activite geomagnetique) et alerte aurores boreales
// Source : NOAA SWPC. Rafraichi toutes les 3h (cadence native de la donnee).
app.get("/spaceweather", (req, res) => {
  res.json({
    source: "NOAA Space Weather Prediction Center (SWPC)",
    updatedAt: spaceWeatherCache.updatedAt,
    lastError: spaceWeatherCache.lastError,
    spaceWeather: spaceWeatherCache.spaceWeather
  });
});

// GET /pollen - concentrations de pollen (grains/m3), station Lausanne (PLS)
// Source : MeteoSwiss reseau national de pollen. Rafraichi toutes les heures.
app.get("/pollen", (req, res) => {
  res.json({
    source: "MeteoSwiss — réseau national de pollen (station Lausanne PLS)",
    licence: "CC-BY — Source: MeteoSwiss",
    updatedAt: pollenCache.updatedAt,
    lastError: pollenCache.lastError,
    pollen: pollenCache.pollen
  });
});

// GET /globaltemp - anomalie de temperature globale mensuelle (NASA GISS)
// Rafraichi toutes les 24h (le NASA ne publie qu'1x/mois environ).
app.get("/globaltemp", (req, res) => {
  res.json({
    source: "NASA GISS — GISTEMP v4 (anomalie vs moyenne 1951-1980)",
    updatedAt: globalTempCache.updatedAt,
    lastError: globalTempCache.lastError,
    globalTemp: globalTempCache.globalTemp
  });
});

// GET /epic - photos NASA EPIC/DSCOVR de la Terre entiere (proxy backend car l'API NASA ne supporte pas CORS)
app.get("/epic", (req, res) => {
  res.json({
    source: "NASA EPIC / DSCOVR",
    updatedAt: epicCache.updatedAt,
    lastError: epicCache.lastError,
    frames: epicCache.frames
  });
});

// GET /stations/:code?scope=vd|ch - derniere valeur pour une station precise
app.get("/stations/:code", (req, res) => {
  const scope = pickScope(req);
  const code = req.params.code.toUpperCase();
  const cache = caches[scope];
  const reading = cache.readings.find((r) => r.station_id === code);

  if (!reading) {
    return res.status(404).json({
      error: "Aucune donnee recente pour cette station dans ce scope (code inconnu, ou cache pas encore rempli)"
    });
  }

  res.json({
    source: "MeteoSwiss (SwissMetNet, OGD)",
    licence: "CC-BY - Source: MeteoSwiss",
    scope,
    reading
  });
});

// GET /capitals/regions - liste des regions disponibles
app.get("/capitals/regions", (req, res) => {
  res.json({
    regions: Object.keys(CAPITAL_REGIONS).map((region) => ({
      key: region,
      count: CAPITAL_REGIONS[region].length
    }))
  });
});

// GET /capitals/current?region=... - temperature actuelle des capitales
app.get("/capitals/current", (req, res) => {
  const region = pickRegion(req);
  const cache = capitalCaches[region];
  res.json({
    source: "OpenWeatherMap (Current Weather Data)",
    licence: "Voir conditions OpenWeatherMap",
    region,
    updatedAt: cache.updatedAt,
    count: cache.readings.length,
    readings: cache.readings
  });
});

var httpServer = app.listen(PORT, async () => {
  console.log(`Meteo-Vaud backend demarre sur le port ${PORT}`);
  await refreshAll(); // premier chargement immediat au demarrage (vd + ch)
  await refreshAllCapitalRegions();
  await refreshHeatwave();
  await refreshEpic();
  await refreshFirms();
  await refreshApod();
  await refreshNeo();
  await refreshJwst();
  await refreshEarthquakes();
  await refreshEnso();
  await refreshSpaceWeather();
  await refreshPollen();
  await refreshGlobalTemp();
  // Vent Europe : PAS de refresh automatique au demarrage. Marcel controle
  // lui-meme quand la grille se (re)construit, via GET /wind-europe/refresh.
  setInterval(refreshAll, DATA_REFRESH_MS);
  setInterval(refreshFirms, 2 * 60 * 60 * 1000); // 2h : le satellite passe ~2 fois/jour, pas besoin de plus
  setInterval(refreshApod, 6 * 60 * 60 * 1000); // 6h : la photo change 1x/jour
  setInterval(refreshNeo, 6 * 60 * 60 * 1000); // 6h : les donnees NEO bougent lentement
  setInterval(refreshJwst, 12 * 60 * 60 * 1000); // 12h : les publications NASA ne changent pas souvent
  setInterval(refreshEarthquakes, 15 * 60 * 1000); // 15 min : les seismes sont un evenement rapide
  setInterval(refreshEnso, 24 * 60 * 60 * 1000); // 24h : le NOAA ne publie qu'1x/mois
  setInterval(refreshSpaceWeather, 3 * 60 * 60 * 1000); // 3h : cadence native du Kp
  setInterval(refreshPollen, 60 * 60 * 1000); // 1h : cadence native de la donnee pollen
  setInterval(refreshGlobalTemp, 24 * 60 * 60 * 1000); // 24h : le NASA ne publie qu'1x/mois environ
  // Pas de setInterval automatique pour le vent Europe : uniquement sur demande (voir /wind-europe/refresh)
  setInterval(refreshHeatwave, 3 * 60 * 60 * 1000); // 3h : la prevision OWM ne change pas assez vite pour justifier plus frequent
  setInterval(refreshEpic, 60 * 60 * 1000); // 1h : cadence proche de celle des vraies prises de vue EPIC
  setInterval(refreshAllCapitalRegions, CAPITALS_REFRESH_MS);
});
