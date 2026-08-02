// sources/wind.js
//
// Construit la grille de vent (vitesse + direction a 10m) pour l'Europe
// via OpenWeatherMap, convertie au format attendu par leaflet-velocity
// (meme format que grib2json / wind-js-server) : deux "bandes" (U et V,
// composantes est-ouest et nord-sud du vent).
//
// Portee volontairement limitee a l'Europe (fonctionnalite "Vent anime
// Europe") : c'est la seule zone ou la construction a montre un
// comportement fiable (~6-8 min, toujours terminee avant un redemarrage
// du service). Les tentatives precedentes de couvrir d'autres continents
// (grilles bien plus grandes) tombaient systematiquement en boucle sans
// jamais aboutir a cause des redemarrages Render — abandonne.
//
// Limite nord etendue a 71°N pour inclure toute la Finlande.

const https = require("https");

var OWM_API_KEY = process.env.OWM_API_KEY || "40e0a05ac561c2b71d1f2610cae0012d";

// Etat de progression partage, lisible par server.js pendant la construction
// (sans avoir a attendre la fin), pour afficher un % / temps restant a Marcel.
var progress = { inProgress: false, processed: 0, total: 0, startedAt: null };

function getProgress() {
  return progress;
}

var EUROPE_GRID = { lonMin: -12, lonMax: 32, lonStep: 2, latMin: 34, latMax: 71, latStep: 2 };

function buildGrid(cfg) {
  var lons = [];
  var lats = [];
  for (var lon = cfg.lonMin; lon <= cfg.lonMax; lon += cfg.lonStep) lons.push(lon);
  for (var lat = cfg.latMin; lat <= cfg.latMax; lat += cfg.latStep) lats.push(lat);
  return { lons: lons, lats: lats };
}

// Delai maximum par requete (ms). Sans ca, une requete qui ne repond
// jamais (probleme reseau silencieux) bloque toute la construction pour
// toujours, sans erreur ni progression - c'est ce qui s'est produit le 02.08.
var REQUEST_TIMEOUT_MS = 10000;

function httpGet(url) {
  return new Promise(function (resolve, reject) {
    var req = https.get(url, function (res) {
      var data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        if (res.statusCode !== 200) {
          reject(new Error("OpenWeatherMap HTTP " + res.statusCode + ": " + data.slice(0, 200)));
        } else {
          resolve(data);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, function () {
      req.destroy(new Error("Timeout apres " + (REQUEST_TIMEOUT_MS / 1000) + "s sans reponse"));
    });
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

function toUV(speedMs, directionDeg) {
  var towardDeg = (directionDeg + 180) % 360;
  var rad = (towardDeg * Math.PI) / 180;
  var u = speedMs * Math.sin(rad);
  var v = speedMs * Math.cos(rad);
  return { u: u, v: v };
}

async function fetchEuropeWindGrid() {
  var grid = buildGrid(EUROPE_GRID);

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

  console.log("[wind] Europe : " + allPoints.length + " points a recuperer (OpenWeatherMap, ~1 point/1.1s)...");
  progress.inProgress = true;
  progress.processed = 0;
  progress.total = allPoints.length;
  progress.startedAt = Date.now();

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
    }

    progress.processed = i + 1;

    if ((i + 1) % 50 === 0) {
      console.log("[wind] " + (i + 1) + "/" + allPoints.length + " points...");
    }

    if (i < allPoints.length - 1) {
      await sleep(1100);
    }
  }

  progress.inProgress = false;

  var nx = lonsAsc.length;
  var ny = latsDesc.length;

  var header = {
    parameterUnit: "m.s-1",
    parameterNumberName: "wind",
    dx: EUROPE_GRID.lonStep,
    dy: EUROPE_GRID.latStep,
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

  console.log("[wind] grille Europe " + nx + "x" + ny + " (" + allPoints.length + " points) construite");

  return [
    { header: uHeader, data: uData },
    { header: vHeader, data: vData }
  ];
}

module.exports = { fetchEuropeWindGrid, getProgress };
