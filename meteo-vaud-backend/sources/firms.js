// sources/firms.js
//
// Recupere les detections d'incendies actifs via l'API NASA FIRMS.
// Renvoie un tableau de points avec FRP (Fire Radiative Power), confiance,
// date/heure de detection, etc.
//
// Deux satellites VIIRS sont interroges (NOAA-20 et NOAA-21) pour maximiser
// la couverture spatiale et temporelle. Les detections a basse confiance
// sont filtrees pour eviter les faux positifs (reflets solaires, sol chaud).
//
// La cle API (MAP_KEY) est lue depuis la variable d'environnement FIRMS_MAP_KEY.
// Limite : 5000 transactions / 10 min (largement suffisant pour un refresh
// toutes les 2h avec 2 appels).

const https = require("https");

// Europe elargie : couvre du Portugal a la Turquie, de l'Islande au Sahara nord
var BBOX = "-25,25,55,72";
var DAY_RANGE = 2; // 2 jours : permet de voir la propagation (hier vs aujourd'hui)
var SOURCES = ["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"];

function httpGet(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      var data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        if (res.statusCode !== 200) {
          reject(new Error("FIRMS HTTP " + res.statusCode + ": " + data.slice(0, 200)));
        } else {
          resolve(data);
        }
      });
    }).on("error", reject);
  });
}

function parseCsv(csv, sourceName) {
  var lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  var headers = lines[0].split(",");
  var idx = {
    lat: headers.indexOf("latitude"),
    lon: headers.indexOf("longitude"),
    brightness: headers.indexOf("bright_ti4") !== -1 ? headers.indexOf("bright_ti4") : headers.indexOf("brightness"),
    frp: headers.indexOf("frp"),
    confidence: headers.indexOf("confidence"),
    date: headers.indexOf("acq_date"),
    time: headers.indexOf("acq_time"),
    daynight: headers.indexOf("daynight")
  };

  var detections = [];
  for (var i = 1; i < lines.length; i++) {
    var cols = lines[i].split(",");
    if (cols.length < headers.length) continue;

    var confidence = cols[idx.confidence];
    // Filtrer les detections basse confiance (faux positifs probables)
    if (confidence === "l" || confidence === "low") continue;

    detections.push({
      lat: parseFloat(cols[idx.lat]),
      lon: parseFloat(cols[idx.lon]),
      frp: parseFloat(cols[idx.frp]) || 0,
      brightness: parseFloat(cols[idx.brightness]) || 0,
      confidence: confidence, // "n" (nominal) ou "h" (high)
      acq_date: cols[idx.date],
      acq_time: cols[idx.time],
      daynight: cols[idx.daynight],
      source: sourceName
    });
  }

  return detections;
}

async function fetchFirmsData() {
  var mapKey = process.env.FIRMS_MAP_KEY;
  if (!mapKey) throw new Error("FIRMS_MAP_KEY non configuree dans les variables d'environnement");

  var allDetections = [];

  for (var i = 0; i < SOURCES.length; i++) {
    var url = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/" +
      mapKey + "/" + SOURCES[i] + "/" + BBOX + "/" + DAY_RANGE;

    console.log("[firms] appel " + SOURCES[i] + "...");
    var csv = await httpGet(url);
    var detections = parseCsv(csv, SOURCES[i]);
    allDetections = allDetections.concat(detections);
    console.log("[firms] " + SOURCES[i] + " : " + detections.length + " detections (confiance nominale ou haute)");
  }

  return allDetections;
}

module.exports = { fetchFirmsData };
