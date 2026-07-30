// sources/nasa.js
//
// Acces aux API NASA Open :
//   - APOD : Astronomy Picture of the Day (photo astronomique du jour)
//   - NEO  : Near Earth Objects (asteroides proches de la Terre, 7 jours)
//
// La cle API est lue depuis la variable d'environnement NASA_API_KEY.
// Limite : 1000 requetes/heure (largement suffisant).

const https = require("https");

function httpGet(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      var data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        if (res.statusCode !== 200) {
          reject(new Error("NASA API HTTP " + res.statusCode + ": " + data.slice(0, 300)));
        } else {
          resolve(data);
        }
      });
    }).on("error", reject);
  });
}

// -------------------------------------------------------
// APOD - Astronomy Picture of the Day
// -------------------------------------------------------
// Renvoie un objet avec : title, explanation, url, hdurl,
// media_type ("image" ou "video"), date, copyright (si applicable).

async function fetchApod() {
  var apiKey = process.env.NASA_API_KEY;
  if (!apiKey) throw new Error("NASA_API_KEY non configuree");

  var url = "https://api.nasa.gov/planetary/apod?api_key=" + apiKey;
  var raw = await httpGet(url);
  var data = JSON.parse(raw);

  return {
    title: data.title || "",
    explanation: data.explanation || "",
    url: data.url || "",
    hdurl: data.hdurl || "",
    media_type: data.media_type || "image",
    date: data.date || "",
    copyright: data.copyright || null
  };
}

// -------------------------------------------------------
// NEO - Near Earth Objects (asteroides, 7 jours)
// -------------------------------------------------------
// Renvoie un tableau d'asteroides tries par distance minimale
// (les plus proches en premier), avec :
//   name, id, diameter_min_km, diameter_max_km,
//   is_hazardous, close_approach_date, velocity_kmh,
//   miss_distance_km, miss_distance_lunar

async function fetchNeo() {
  var apiKey = process.env.NASA_API_KEY;
  if (!apiKey) throw new Error("NASA_API_KEY non configuree");

  var today = new Date();
  var startDate = today.toISOString().slice(0, 10);
  var endDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  var url = "https://api.nasa.gov/neo/rest/v1/feed?start_date=" + startDate +
    "&end_date=" + endDate + "&api_key=" + apiKey;

  var raw = await httpGet(url);
  var data = JSON.parse(raw);

  var asteroids = [];
  var dates = Object.keys(data.near_earth_objects || {});

  dates.forEach(function (date) {
    data.near_earth_objects[date].forEach(function (neo) {
      var approach = neo.close_approach_data && neo.close_approach_data[0];
      if (!approach) return;

      asteroids.push({
        name: neo.name,
        id: neo.id,
        diameter_min_km: Math.round(neo.estimated_diameter.kilometers.estimated_diameter_min * 1000) / 1000,
        diameter_max_km: Math.round(neo.estimated_diameter.kilometers.estimated_diameter_max * 1000) / 1000,
        is_hazardous: neo.is_potentially_hazardous_asteroid,
        close_approach_date: approach.close_approach_date_full || approach.close_approach_date,
        velocity_kmh: Math.round(parseFloat(approach.relative_velocity.kilometers_per_hour)),
        miss_distance_km: Math.round(parseFloat(approach.miss_distance.kilometers)),
        miss_distance_lunar: Math.round(parseFloat(approach.miss_distance.lunar) * 10) / 10
      });
    });
  });

  // Trier par distance (les plus proches d'abord)
  asteroids.sort(function (a, b) { return a.miss_distance_km - b.miss_distance_km; });

  return asteroids;
}

module.exports = { fetchApod, fetchNeo };
