// sources/wind.js
//
// Construit une grille de vent (vitesse + direction a 10m) sur l'Europe,
// via Open-Meteo (gratuit, sans cle), et la convertit au format attendu
// par leaflet-velocity (meme format que grib2json / wind-js-server) :
// deux "bandes" (U et V, composantes est-ouest et nord-sud du vent).
//
// Open-Meteo accepte plusieurs points par requete (latitude/longitude
// en listes separees par virgules), ce qui evite de faire un appel par
// point. On decoupe en lots de 80 points pour rester prudent sur la
// taille des requetes.

const https = require("https");

// Grille : Europe elargie, un point tous les 2 degres
var LON_MIN = -12, LON_MAX = 32, LON_STEP = 2;
var LAT_MIN = 34, LAT_MAX = 62, LAT_STEP = 2;
var BATCH_SIZE = 80; // points par requete Open-Meteo

function buildGrid() {
  var lons = [];
  var lats = [];
  for (var lon = LON_MIN; lon <= LON_MAX; lon += LON_STEP) lons.push(lon);
  for (var lat = LAT_MIN; lat <= LAT_MAX; lat += LAT_STEP) lats.push(lat);
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
      if (attempt === retries) throw err;
      console.log("[wind] echec tentative " + (attempt + 1) + " — retry dans " + (delays[attempt] / 1000) + "s");
      await sleep(delays[attempt]);
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

async function fetchWindGrid() {
  var grid = buildGrid();
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

  // Traiter par lots pour ne pas surcharger une seule requete
  for (var i = 0; i < allPoints.length; i += BATCH_SIZE) {
    var batch = allPoints.slice(i, i + BATCH_SIZE);
    var latStr = batch.map(function (p) { return p.lat; }).join(",");
    var lonStr = batch.map(function (p) { return p.lon; }).join(",");

    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + latStr +
      "&longitude=" + lonStr + "&current=wind_speed_10m,wind_direction_10m" +
      "&wind_speed_unit=kmh";

    console.log("[wind] lot " + (Math.floor(i / BATCH_SIZE) + 1) + "/" + Math.ceil(allPoints.length / BATCH_SIZE) + " (" + batch.length + " points)...");

    var raw = await httpGetWithRetry(url, 2);
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
  }

  var nx = lonsAsc.length;
  var ny = latsDesc.length;

  var header = {
    parameterUnit: "m.s-1",
    parameterNumberName: "wind",
    dx: LON_STEP,
    dy: LAT_STEP,
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

module.exports = { fetchWindGrid };
