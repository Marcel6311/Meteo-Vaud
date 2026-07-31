// sources/wind.js
//
// Construit des grilles de vent (vitesse + direction a 10m) via OpenWeatherMap,
// converties au format attendu par leaflet-velocity (meme format que
// grib2json / wind-js-server) : deux "bandes" (U et V, composantes
// est-ouest et nord-sud du vent).
//
// OpenWeatherMap (contrairement a Open-Meteo) n'accepte qu'un point par
// requete, mais fonctionne par cle API (pas par IP partagee) -> pas de
// probleme de quota partage avec d'autres utilisateurs de Render.
// Limite gratuite : 60 requetes/minute, 1 million/mois. On espace les
// appels a ~1.1s pour rester bien en dessous.
//
// Une grille par continent (meme decoupage que les zones FIRMS), 2 degres
// d'ecart. Chaque continent (~300-500 points) prend plusieurs minutes a
// construire, mais ca se passe en arriere-plan au refresh (toutes les 3-6h).

const https = require("https");

// Meme cle que celle deja utilisee cote client pour les tuiles/capitales
// (cle publique, sans risque a reutiliser cote serveur)
var OWM_API_KEY = process.env.OWM_API_KEY || "40e0a05ac561c2b71d1f2610cae0012d";

var DELAY_BETWEEN_CALLS_MS = 1100; // ~54 appels/minute, sous la limite de 60/min

var GRIDS = {
  europe:        { lonMin: -12, lonMax: 32,  lonStep: 2, latMin: 34,  latMax: 62, latStep: 2 },
  north_america: { lonMin: -170, lonMax: -50, lonStep: 2, latMin: 10,  latMax: 75, latStep: 2 },
  south_america: { lonMin: -85,  lonMax: -30, lonStep: 2, latMin: -60, latMax: 15, latStep: 2 },
  africa:        { lonMin: -20,  lonMax: 55,  lonStep: 2, latMin: -40, latMax: 40, latStep: 2 },
  asia:          { lonMin: 25,   lonMax: 180, lonStep: 2, latMin: -10, latMax: 75, latStep: 2 },
  oceania:       { lonMin: 100,  lonMax: 180, lonStep: 2, latMin: -50, latMax: -5, latStep: 2 }
};

function buildGrid(cfg) {
  var lons = [];
  var lats = [];
  for (var lon = cfg.lonMin; lon <= cfg.lonMax; lon += cfg.lonStep) lons.push(lon);
  for (var lat = cfg.latMin; lat <= cfg.latMax; lat += cfg.latStep) lats.push(lat);
  return { lons: lons, lats: lats };
}

function httpGet(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      var data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        if (res.statusCode !== 200) {
          reject(new Error("OpenWeatherMap HTTP " + res.statusCode + ": " + data.slice(0, 200)));
        } else {
          resolve(data);
        }
      });
    }).on("error", reject);
  });
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function httpGetWithRetry(url, retries) {
  var delays = [2000, 5000, 10000];
  retries = retries || 2;
  for (var attempt = 0; attempt <= retries; attempt++) {
    try {
      return await httpGet(url);
    } catch (err) {
      var is429 = err.message.indexOf("429") !== -1;
      if (attempt === retries) throw err;
      var delay = is429 ? 60000 : (delays[attempt] || 10000);
      console.log("[wind] echec tentative " + (attempt + 1) + " — retry dans " + (delay / 1000) + "s" + (is429 ? " (limite atteinte)" : ""));
      await sleep(delay);
    }
  }
}

// Convertit vitesse (m/s, unite native OpenWeatherMap) + direction meteo
// (d'ou vient le vent, degres) en composantes U/V, convention "vers ou
// le vent souffle" (necessaire pour l'animation des particules).
function toUV(speedMs, directionDeg) {
  var towardDeg = (directionDeg + 180) % 360;
  var rad = (towardDeg * Math.PI) / 180;
  var u = speedMs * Math.sin(rad); // composante est-ouest
  var v = speedMs * Math.cos(rad); // composante nord-sud
  return { u: u, v: v };
}

async function fetchWindGrid(cfg) {
  var grid = buildGrid(cfg);

  // Ordre attendu par leaflet-velocity : la1 (nord) -> la2 (sud), lo1 (ouest) -> lo2 (est)
  var latsDesc = grid.lats.slice().sort(function (a, b) { return b - a; });
  var lonsAsc = grid.lons.slice().sort(function (a, b) { return a - b; });

  var allPoints = [];
  latsDesc.forEach(function (lat) {
    lonsAsc.forEach(function (lon) {
      allPoints.push({ lat: lat, lon: lon });
    });
  });

  var uData = new Array(allPoints.length).fill(0);
  var vData = new Array(allPoints.length).fill(0);

  console.log("[wind] " + allPoints.length + " points a recuperer (OpenWeatherMap, ~1 point/1.1s)...");

  for (var i = 0; i < allPoints.length; i++) {
    var p = allPoints[i];
    var url = "https://api.openweathermap.org/data/2.5/weather?lat=" + p.lat +
      "&lon=" + p.lon + "&units=metric&appid=" + OWM_API_KEY;

    try {
      var raw = await httpGetWithRetry(url, 2);
      var data = JSON.parse(raw);
      if (data.wind && data.wind.speed !== undefined && data.wind.deg !== undefined) {
        var uv = toUV(data.wind.speed, data.wind.deg);
        uData[i] = Math.round(uv.u * 100) / 100;
        vData[i] = Math.round(uv.v * 100) / 100;
      }
    } catch (err) {
      console.error("[wind] echec point " + p.lat + "," + p.lon + " : " + err.message);
      // On continue avec les autres points (0,0 = pas de vent pour celui-ci)
    }

    if ((i + 1) % 50 === 0) {
      console.log("[wind] " + (i + 1) + "/" + allPoints.length + " points...");
    }

    if (i < allPoints.length - 1) {
      await sleep(DELAY_BETWEEN_CALLS_MS);
    }
  }

  var nx = lonsAsc.length;
  var ny = latsDesc.length;

  var header = {
    parameterUnit: "m.s-1",
    parameterNumberName: "wind",
    dx: cfg.lonStep,
    dy: cfg.latStep,
    parameterCategory: 2,
    la1: latsDesc[0],
    la2: latsDesc[latsDesc.length - 1],
    parameterNumber: 2,
    lo2: lonsAsc[lonsAsc.length - 1],
    lo1: lonsAsc[0],
    nx: nx,
    ny: ny,
    refTime: new Date().toISOString()
  };

  var uHeader = Object.assign({}, header, { parameterNumber: 2 });
  var vHeader = Object.assign({}, header, { parameterNumber: 3 });

  console.log("[wind] grille " + nx + "x" + ny + " (" + allPoints.length + " points) construite");

  return [
    { header: uHeader, data: uData },
    { header: vHeader, data: vData }
  ];
}

function fetchWindGridFor(region) {
  var cfg = GRIDS[region];
  if (!cfg) throw new Error("Region de vent inconnue : " + region);
  return fetchWindGrid(cfg);
}

module.exports = {
  fetchWindGridFor,
  REGIONS: Object.keys(GRIDS)
};
