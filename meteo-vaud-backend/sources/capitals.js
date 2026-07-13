// sources/capitals.js
//
// Recupere la temperature actuelle pour chaque capitale europeenne
// (config/capitals.js) via l'API "Current Weather Data" d'OpenWeatherMap
// (offre gratuite : https://openweathermap.org/current).
//
// Une requete HTTP par capitale ; execute en parallele. A ~45 capitales
// rafraichies toutes les 30 minutes, le volume reste tres largement sous
// les limites de l'offre gratuite (60 appels/min, tres large quota mensuel).

const fetch = require("node-fetch");
const CAPITALS = require("../config/capitals");

// Meme cle "tuiles" que celle utilisee cote frontend pour les calques
// carte - pas un secret critique pour ce produit OpenWeatherMap.
const OWM_API_KEY = "40e0a05ac561c2b71d1f2610cae0012d";

function buildUrl(capital) {
  return "https://api.openweathermap.org/data/2.5/weather" +
    "?lat=" + capital.lat +
    "&lon=" + capital.lon +
    "&appid=" + OWM_API_KEY +
    "&units=metric&lang=fr";
}

/**
 * Recupere la meteo actuelle pour une capitale. Ne rejette jamais : en cas
 * d'echec, renvoie un objet avec des valeurs null plutot que de faire
 * echouer tout le lot (une capitale indisponible ne doit pas bloquer les 44 autres).
 */
async function fetchOneCapital(capital) {
  const base = {
    country: capital.country,
    capital: capital.capital,
    lat: capital.lat,
    lon: capital.lon
  };
  const empty = {
    ...base,
    temperature: null,
    ressenti: null,
    temp_min: null,
    temp_max: null,
    humidite: null,
    pression: null,
    vent_vitesse: null,
    couverture_nuageuse: null,
    visibilite: null,
    lever_soleil: null,
    coucher_soleil: null,
    description: null,
    icone: null,
    erreur: null
  };

  try {
    const res = await fetch(buildUrl(capital));
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();

    return {
      ...base,
      temperature: data.main ? data.main.temp : null,
      ressenti: data.main ? data.main.feels_like : null,
      temp_min: data.main ? data.main.temp_min : null,
      temp_max: data.main ? data.main.temp_max : null,
      humidite: data.main ? data.main.humidity : null,
      pression: data.main ? data.main.pressure : null,
      vent_vitesse: data.wind ? Math.round(data.wind.speed * 3.6) : null, // m/s -> km/h
      couverture_nuageuse: data.clouds ? data.clouds.all : null,
      visibilite: data.visibility !== undefined ? data.visibility : null, // metres
      lever_soleil: data.sys && data.sys.sunrise ? new Date(data.sys.sunrise * 1000).toISOString() : null,
      coucher_soleil: data.sys && data.sys.sunset ? new Date(data.sys.sunset * 1000).toISOString() : null,
      description: data.weather && data.weather[0] ? data.weather[0].description : null,
      icone: data.weather && data.weather[0] ? data.weather[0].icon : null,
      erreur: null
    };
  } catch (err) {
    return { ...empty, erreur: err.message };
  }
}

/**
 * Recupere la meteo actuelle pour une liste de capitales donnee.
 * @param {Array<Object>} capitalsList - liste au format config/capitals*.js
 * @returns {Promise<Array<Object>>}
 */
async function fetchCapitalsList(capitalsList) {
  return Promise.all(capitalsList.map(fetchOneCapital));
}

module.exports = { fetchCapitalsList, CAPITALS };
