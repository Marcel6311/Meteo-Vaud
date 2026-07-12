// server.js
//
// Meteo-Vaud backend v1
// Ingestion SwissMetNet + endpoints REST pour le frontend.
//
// Root Directory sur Render : meteo-vaud-backend
// Start command : npm start

const express = require("express");
const cors = require("cors");
const STATIONS = require("./config/stations");
const { fetchCurrentReadings } = require("./sources/swissmetnet");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes, aligne sur la cadence SwissMetNet

// Cache en memoire : { updatedAt: ISOString, readings: [...] }
let cache = { updatedAt: null, readings: [] };
let lastError = null;

async function refreshCache() {
  try {
    const readings = await fetchCurrentReadings();
    cache = { updatedAt: new Date().toISOString(), readings };
    lastError = null;
    console.log(
      `[refresh] ${readings.length} lectures mises a jour (${cache.updatedAt})`
    );
  } catch (err) {
    lastError = err.message;
    console.error("[refresh] echec :", err.message);
    // on garde l'ancien cache plutot que de servir du vide
  }
}

// GET /health - verification rapide de l'etat du service
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    lastUpdated: cache.updatedAt,
    stationsTracked: STATIONS.length,
    lastError
  });
});

// GET /stations - metadonnees des stations suivies (statique)
app.get("/stations", (req, res) => {
  res.json({
    source: "MeteoSwiss (SwissMetNet, OGD)",
    licence: "CC-BY - Source: MeteoSwiss",
    stations: STATIONS
  });
});

// GET /stations/current - dernieres valeurs pour toutes les stations suivies
app.get("/stations/current", (req, res) => {
  res.json({
    source: "MeteoSwiss (SwissMetNet, OGD)",
    licence: "CC-BY - Source: MeteoSwiss",
    updatedAt: cache.updatedAt,
    count: cache.readings.length,
    readings: cache.readings
  });
});

// GET /stations/:code - derniere valeur pour une station precise
app.get("/stations/:code", (req, res) => {
  const code = req.params.code.toUpperCase();
  const reading = cache.readings.find((r) => r.station_id === code);

  if (!reading) {
    const known = STATIONS.some((s) => s.code === code);
    return res.status(known ? 404 : 400).json({
      error: known
        ? "Aucune donnee recente pour cette station (cache pas encore rempli ?)"
        : "Code station inconnu ou non suivi"
    });
  }

  res.json({
    source: "MeteoSwiss (SwissMetNet, OGD)",
    licence: "CC-BY - Source: MeteoSwiss",
    reading
  });
});

app.listen(PORT, async () => {
  console.log(`Meteo-Vaud backend demarre sur le port ${PORT}`);
  await refreshCache(); // premier chargement immediat au demarrage
  setInterval(refreshCache, REFRESH_INTERVAL_MS);
});
