// sources/wind.js
//
// Construit des grilles de vent (vitesse + direction a 10m) via Open-Meteo
// (gratuit, sans cle), converties au format attendu par leaflet-velocity
// (meme format que grib2json / wind-js-server) : deux "bandes" (U et V,
// composantes est-ouest et nord-sud du vent).
//
// Deux grilles sont disponibles :
//   - Europe : 1 degre d'ecart, precise, pour la vue rapprochee
//   - Monde  : 4 degres d'ecart, plus large mais moins precise, pour la vue dezoomee
//
// Open-Meteo accepte plusieurs points par requete (latitude/longitude
// en listes separees par virgules), ce qui evite de faire un appel par
// point. On decoupe en lots de 80 points pour rester prudent sur la
// taille des requetes.

const https = require("https");

var BATCH_SIZE = 300; // points par requete Open-Meteo (augmente pour reduire le nombre total d'appels)

var GRIDS = {
  europe: { lonMin: -12, lonMax: 32, lonStep: 1, latMin: 34, latMax: 62, latStep: 1 },
  world:  { lonMin: -180, lonMax: 180, lonStep: 5, latMin: -60, latMax: 75, latStep: 5 }
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
          reject(new Error("Open-Meteo HTTP " + res.statusCode + ": " + data.slice(0, 300)));
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
      var delay = is429 ? 65000 : (delays[attempt] || 10000); // 429 : attendre 65s comme demande par l'API
      console.log("[wind] echec tentative " + (attempt + 1) + " — retry dans " + (delay / 1000) + "s" + (is429 ? " (limite de requetes atteinte)" : ""));
      await sleep(delay);
    }
  }
}

// Convertit vitesse (km/h) + direction meteo (d'ou vient le vent, degres)
// en composantes U (est-ouest) et V (nord-sud) en m/s, convention vent
// "vers ou il souffle" (necessaire pour l'animation des particules).
function toUV(speedKmh, directionDeg) {
  var speedMs = speedKmh / 3.6;
  // La direction meteo indique d'ou vient le vent -> on ajoute 180 pour
  // obtenir la direction vers laquelle il souffle.
  var towardDeg = (directionDeg + 180) % 360;
  var rad = (towardDeg * Math.PI) / 180;
  var u = speedMs * Math.sin(rad); // composante est-ouest
  var v = speedMs * Math.cos(rad); // composante nord-sud
  return { u: u, v: v };
}

async function fetchWindGrid(cfg) {
  var grid = buildGrid(cfg);
  var allPoints = []; // { lat, lon } dans l'ordre lon-major (grib2json convention : ligne par latitude, du nord au sud)

  // Ordre attendu par leaflet-velocity : la1 (nord) -> la2 (sud), lo1 (ouest) -> lo2 (est)
  var latsDesc = grid.lats.slice().sort(function (a, b) { return b - a; }); // nord -> sud
  var lonsAsc = grid.lons.slice().sort(function (a, b) { return a - b; });  // ouest -> est

  latsDesc.forEach(function (lat) {
    lonsAsc.forEach(function (lon) {
      allPoints.push({ lat: lat, lon: lon });
    });
  });

  var uData = new Array(allPoints.length).fill(0);
  var vData = new Array(allPoints.length).fill(0);

  // Traiter par lots pour ne pas surcharger une seule requete, avec une
  // pause entre chaque lot pour respecter la limite de requetes/minute d'Open-Meteo
  for (var i = 0; i < allPoints.length; i += BATCH_SIZE) {
    var batch = allPoints.slice(i, i + BATCH_SIZE);
    var latStr = batch.map(function (p) { return p.lat; }).join(",");
    var lonStr = batch.map(function (p) { return p.lon; }).join(",");

    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + latStr +
      "&longitude=" + lonStr + "&current=wind_speed_10m,wind_direction_10m" +
      "&wind_speed_unit=kmh";

    console.log("[wind] lot " + (Math.floor(i / BATCH_SIZE) + 1) + "/" + Math.ceil(allPoints.length / BATCH_SIZE) + " (" + batch.length + " points)...");

    var raw = await httpGetWithRetry(url, 3);
    var data = JSON.parse(raw);

    // Reponse multi-points : un tableau d'objets (un par point) quand plusieurs lat/lon sont passes
    var responses = Array.isArray(data) ? data : [data];

    responses.forEach(function (resp, idx) {
      var globalIdx = i + idx;
      if (!resp || !resp.current) return;
      var speed = resp.current.wind_speed_10m;
      var dir = resp.current.wind_direction_10m;
      if (speed === undefined || dir === undefined) return;
      var uv = toUV(speed, dir);
      uData[globalIdx] = Math.round(uv.u * 100) / 100;
      vData[globalIdx] = Math.round(uv.v * 100) / 100;
    });

    // Pause entre les lots pour eviter le 429 (IP partagee sur Render,
    // le quota peut deja etre entame par d'autres utilisateurs du meme range d'IP)
    if (i + BATCH_SIZE < allPoints.length) {
      await sleep(4000);
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
    parameterNumber: 2, // sera ecrase par bande (2 = U, 3 = V)
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

function fetchEuropeWindGrid() {
  return fetchWindGrid(GRIDS.europe);
}

function fetchWorldWindGrid() {
  return fetchWindGrid(GRIDS.world);
}

module.exports = { fetchEuropeWindGrid, fetchWorldWindGrid };
