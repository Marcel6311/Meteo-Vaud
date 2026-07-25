// sources/heatwave.js
//
// Indicateur "maison" de canicule - PAS le plan canicule officiel
// (celui-ci necessiterait un compte API Meteo-France separe, avec ses
// propres seuils par departement). Ici, on applique une regle simple et
// transparente sur les previsions a 5 jours d'OpenWeatherMap (meme cle
// que le reste de l'app, aucun nouveau compte) :
//
//   Episode de canicule = au moins CONSECUTIVE_DAYS_THRESHOLD jours
//   consecutifs avec une temperature maximale prevue >= TEMP_THRESHOLD_C
//
// Ce seuil est ajustable ci-dessous. Ce n'est pas une donnee officielle
// et ne doit pas remplacer les vigilances des autorites competentes.

const fetch = require("node-fetch");

const OWM_API_KEY = "40e0a05ac561c2b71d1f2610cae0012d";
const TEMP_THRESHOLD_C = 30;
const CONSECUTIVE_DAYS_THRESHOLD = 3;

function buildForecastUrl(station) {
  return "https://api.openweathermap.org/data/2.5/forecast" +
    "?lat=" + station.lat +
    "&lon=" + station.lon +
    "&appid=" + OWM_API_KEY +
    "&units=metric&lang=fr";
}

/**
 * Regroupe les points de prevision 3h par date (YYYY-MM-DD) et calcule
 * la temperature maximale prevue pour chaque jour.
 */
function dailyMaxFromForecastList(list) {
  const byDate = {};
  list.forEach((point) => {
    const date = point.dt_txt.slice(0, 10); // "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DD"
    const temp = point.main ? point.main.temp_max : null;
    if (temp === null) return;
    if (!(date in byDate) || temp > byDate[date]) {
      byDate[date] = temp;
    }
  });
  return byDate; // { "2026-07-15": 32.1, "2026-07-16": 33.4, ... }
}

/**
 * Detecte la plus longue sequence de jours consecutifs >= seuil, dans
 * l'ordre chronologique des dates disponibles.
 */
function detectHeatwave(dailyMax) {
  const dates = Object.keys(dailyMax).sort(); // tri chronologique (format YYYY-MM-DD trie naturellement)

  let bestStart = null;
  let bestEnd = null;
  let bestLength = 0;

  let runStart = null;
  let runLength = 0;

  dates.forEach((date, i) => {
    const isHot = dailyMax[date] >= TEMP_THRESHOLD_C;
    if (isHot) {
      if (runLength === 0) runStart = date;
      runLength++;
      if (runLength > bestLength) {
        bestLength = runLength;
        bestStart = runStart;
        bestEnd = date;
      }
    } else {
      runLength = 0;
    }
  });

  if (bestLength < CONSECUTIVE_DAYS_THRESHOLD) {
    return null; // pas d'episode detecte dans l'horizon de prevision (5 jours)
  }

  const lastForecastDate = dates[dates.length - 1];

  return {
    start_date: bestStart,
    end_date: bestEnd,
    days_count: bestLength,
    threshold_c: TEMP_THRESHOLD_C,
    ongoing: bestEnd === lastForecastDate, // l'episode continue peut-etre au-dela de l'horizon de 5 jours
    daily_max: dailyMax
  };
}

/**
 * Recupere la prevision et detecte un episode de canicule "maison" pour
 * une station donnee. Ne rejette jamais : renvoie heatwave:null avec un
 * champ erreur en cas d'echec plutot que de faire planter le lot.
 */
async function fetchHeatwaveForStation(station) {
  try {
    const res = await fetch(buildForecastUrl(station));
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (!data.list) throw new Error("Reponse OpenWeatherMap sans liste de prevision");

    const dailyMax = dailyMaxFromForecastList(data.list);
    const heatwave = detectHeatwave(dailyMax);

    return {
      station_id: station.code,
      station_name: station.name,
      heatwave,
      erreur: null
    };
  } catch (err) {
    return {
      station_id: station.code,
      station_name: station.name,
      heatwave: null,
      erreur: err.message
    };
  }
}

/**
 * Recupere l'indicateur de canicule pour une liste de stations (meme
 * format que config/stations.js : code, name, lat, lon).
 * @returns {Promise<Array<Object>>}
 */
async function fetchHeatwaveForStations(stationsList) {
  return Promise.all(stationsList.map(fetchHeatwaveForStation));
}

module.exports = { fetchHeatwaveForStations, TEMP_THRESHOLD_C, CONSECUTIVE_DAYS_THRESHOLD };
