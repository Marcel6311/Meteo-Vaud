// sources/azuremaps.js
//
// Source de donnees complementaire : conditions actuelles via l'API
// Azure Maps Weather (Microsoft), utilisee UNIQUEMENT a des fins de
// comparaison avec les mesures officielles SwissMetNet - ce n'est PAS
// une donnee du modele Aurora 1.5 (voir discussion : Azure Maps Weather
// est un produit meteo Microsoft distinct, ses sources de donnees ne
// sont pas confirmees publiquement comme etant Aurora).
//
// Endpoint : Get Current Conditions
// https://atlas.microsoft.com/weather/currentConditions/json?api-version=1.1&query={lat},{lon}&subscription-key={key}
//
// IMPORTANT : la cle est un secret de facturation (contrairement a la
// cle "tuiles" OpenWeatherMap). Elle est lue depuis la variable
// d'environnement AZURE_MAPS_KEY (a definir dans Render > Environment),
// jamais codee en dur ni exposee au frontend. GitHub bloque
// automatiquement tout push contenant une cle Azure Maps en clair.

const fetch = require("node-fetch");

const AZURE_MAPS_KEY = process.env.AZURE_MAPS_KEY;

function buildUrl(lat, lon) {
  return "https://atlas.microsoft.com/weather/currentConditions/json" +
    "?api-version=1.1&query=" + lat + "," + lon +
    "&subscription-key=" + AZURE_MAPS_KEY;
}

/**
 * Recupere les conditions actuelles Azure Maps pour un point donne.
 * Ne rejette jamais : renvoie des valeurs null en cas d'echec plutot que
 * de faire planter tout le lot.
 */
async function fetchOnePoint(station) {
  if (!AZURE_MAPS_KEY) {
    return {
      station_id: station.code,
      station_name: station.name,
      temperature: null,
      ressenti: null,
      humidite: null,
      description: null,
      erreur: "AZURE_MAPS_KEY non definie (variable d'environnement Render manquante)"
    };
  }

  try {
    const res = await fetch(buildUrl(station.lat, station.lon));
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const result = data.results && data.results[0];

    if (!result) throw new Error("Reponse Azure Maps vide");

    return {
      station_id: station.code,
      station_name: station.name,
      temperature: result.temperature ? result.temperature.value : null,
      ressenti: result.realFeelTemperature ? result.realFeelTemperature.value : null,
      humidite: result.relativeHumidity !== undefined ? result.relativeHumidity : null,
      description: result.phrase || null,
      erreur: null
    };
  } catch (err) {
    return {
      station_id: station.code,
      station_name: station.name,
      temperature: null,
      ressenti: null,
      humidite: null,
      description: null,
      erreur: err.message
    };
  }
}

/**
 * Recupere Azure Maps pour une liste de stations (meme format que
 * config/stations.js : code, name, lat, lon).
 * @returns {Promise<Array<Object>>}
 */
async function fetchAzureMapsForStations(stationsList) {
  return Promise.all(stationsList.map(fetchOnePoint));
}

module.exports = { fetchAzureMapsForStations };
