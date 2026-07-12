// server.js
//
// Meteo-Vaud backend v3
// Ingestion SwissMetNet + capitales europeennes + endpoints REST.
//
// Scopes stations disponibles :
//   - "vd" (par defaut) : les 14 stations vaudoises curatees (config/stations.js)
//   - "ch" : toutes les stations SwissMetNet de Suisse (~150), decouvertes
//            automatiquement via sources/stationRegistry.js
//
// Nouveau : GET /capitals/current expose la temperature actuelle d'environ
// 45 capitales europeennes (source OpenWeatherMap, config/capitals.js).
//
// Root Directory sur Render : meteo-vaud-backend
// Start command : npm start

const express = require("express");
const cors = require("cors");
const VD_STATIONS = require("./config/stations");
const { fetchCurrentReadings } = require("./sources/swissmetnet");
const { getAllStations } = require("./sources/stationRegistry");
const { fetchAllCapitals } = require("./sources/capitals");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const DATA_REFRESH_MS = 10 * 60 * 1000; // 10 minutes, aligne sur la cadence SwissMetNet
const CAPITALS_REFRESH_MS = 30 * 60 * 1000; // 30 minutes, largement suffisant pour des capitales

// Un cache separe par scope station, meme forme pour les deux :
// { updatedAt: ISOString, readings: [...], lastError: string|null }
let caches = {
  vd: { updatedAt: null, readings: [], lastError: null },
  ch: { updatedAt: null, readings: [], lastError: null }
};

let capitalsCache = { updatedAt: null, readings: [], lastError: null };
let chStationsCount = null; // rempli au premier refresh du scope "ch"

function pickScope(req) {
  const scope = (req.query.scope || "vd").toLowerCase();
  return scope === "ch" ? "ch" : "vd";
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

async function refreshCapitals() {
  try {
    const readings = await fetchAllCapitals();
    capitalsCache = {
      updatedAt: new Date().toISOString(),
      readings,
      lastError: null
    };
    console.log(
      `[refresh:capitals] ${readings.length} capitales mises a jour (${capitalsCache.updatedAt})`
    );
  } catch (err) {
    capitalsCache.lastError = err.message;
    console.error("[refresh:capitals] echec :", err.message);
  }
}

// GET /health - verification rapide de l'etat du service
app.get("/health", (req, res) => {
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
    capitals: {
      lastUpdated: capitalsCache.updatedAt,
      capitalsTracked: capitalsCache.readings.length,
      lastError: capitalsCache.lastError
    }
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

// GET /capitals/current - temperature actuelle des capitales europeennes
app.get("/capitals/current", (req, res) => {
  res.json({
    source: "OpenWeatherMap (Current Weather Data)",
    licence: "Voir conditions OpenWeatherMap",
    updatedAt: capitalsCache.updatedAt,
    count: capitalsCache.readings.length,
    readings: capitalsCache.readings
  });
});

app.listen(PORT, async () => {
  console.log(`Meteo-Vaud backend demarre sur le port ${PORT}`);
  await refreshAll(); // premier chargement immediat au demarrage (vd + ch)
  await refreshCapitals();
  setInterval(refreshAll, DATA_REFRESH_MS);
  setInterval(refreshCapitals, CAPITALS_REFRESH_MS);
});
