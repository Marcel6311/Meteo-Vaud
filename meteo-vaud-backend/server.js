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

const app = express();
app.use(cors());

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

app.listen(PORT, async () => {
  console.log(`Meteo-Vaud backend demarre sur le port ${PORT}`);
  await refreshAll(); // premier chargement immediat au demarrage (vd + ch)
  await refreshAllCapitalRegions();
  setInterval(refreshAll, DATA_REFRESH_MS);
  setInterval(refreshAllCapitalRegions, CAPITALS_REFRESH_MS);
});
