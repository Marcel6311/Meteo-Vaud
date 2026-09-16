// sources/googleweather.js
//
// Source de donnees complementaire : conditions actuelles via l'API
// Google Maps Platform Weather (WeatherNext 3, Google DeepMind),
// utilisee UNIQUEMENT a des fins de comparaison avec les mesures
// officielles SwissMetNet.
//
// Remplace l'ancienne integration Azure Maps Weather (Microsoft) -
// meme role, meme forme de donnees renvoyees, pour ne rien casser
// cote server.js / frontend au-dela du renommage.
//
// Endpoint : Current Conditions
// https://weather.googleapis.com/v1/currentConditions:lookup?key={key}&location.latitude={lat}&location.longitude={lon}&unitsSystem=METRIC
//
// IMPORTANT : la cle est un secret de facturation Google Cloud
// (10 000 appels gratuits / mois, puis facture). Elle est lue depuis
// la variable d'environnement GOOGLE_WEATHER_KEY (a definir dans
// Render > Environment), jamais codee en dur ni exposee au frontend.
//
// Note : contrairement a Azure Maps, l'API Google Weather ne renvoie
// pas de tendance de pression (hausse/baisse) - le champ
// tendance_pression est donc toujours null ici, conserve uniquement
// pour garder la meme forme d'objet que l'ancienne integration.

const fetch = require("node-fetch");

const GOOGLE_WEATHER_KEY = process.env.GOOGLE_WEATHER_KEY;

function buildUrl(lat, lon) {
  return "https://weather.googleapis.com/v1/currentConditions:lookup" +
    "?key=" + GOOGLE_WEATHER_KEY +
    "&location.latitude=" + lat +
    "&location.longitude=" + lon +
    "&unitsSystem=METRIC";
}

/**
 * Recupere les conditions actuelles Google Weather pour un point donne.
 * Ne rejette jamais : renvoie des valeurs null en cas d'echec plutot que
 * de faire planter tout le lot.
 */
async function fetchOnePoint(station) {
  const empty = {
    station_id: station.code,
    station_name: station.name,
    temperature: null,
    ressenti: null,
    humidite: null,
    description: null,
    point_de_rosee: null,
    indice_uv: null,
    couverture_nuageuse: null,
    visibilite: null,
    pression: null,
    tendance_pression: null,
    erreur: null
  };

  if (!GOOGLE_WEATHER_KEY) {
    return { ...empty, erreur: "GOOGLE_WEATHER_KEY non definie (variable d'environnement Render manquante)" };
  }

  try {
    const res = await fetch(buildUrl(station.lat, station.lon));
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();

    if (!data || !data.temperature) throw new Error("Reponse Google Weather vide");

    return {
      station_id: station.code,
      station_name: station.name,
      temperature: data.temperature ? data.temperature.degrees : null,
      ressenti: data.feelsLikeTemperature ? data.feelsLikeTemperature.degrees : null,
      humidite: data.relativeHumidity !== undefined ? data.relativeHumidity : null,
      description: data.weatherCondition && data.weatherCondition.description
        ? data.weatherCondition.description.text
        : null,
      point_de_rosee: data.dewPoint ? data.dewPoint.degrees : null,
      indice_uv: data.uvIndex !== undefined ? data.uvIndex : null,
      couverture_nuageuse: data.cloudCover !== undefined ? data.cloudCover : null,
      visibilite: data.visibility ? data.visibility.distance : null,
      pression: data.airPressure ? data.airPressure.meanSeaLevelMillibars : null,
      tendance_pression: null,
      erreur: null
    };
  } catch (err) {
    return { ...empty, erreur: err.message };
  }
}

/**
 * Recupere Google Weather pour une liste de stations (meme format que
 * config/stations.js : code, name, lat, lon).
 * @returns {Promise<Array<Object>>}
 */
async function fetchGoogleWeatherForStations(stationsList) {
  return Promise.all(stationsList.map(fetchOnePoint));
}

module.exports = { fetchGoogleWeatherForStations };
