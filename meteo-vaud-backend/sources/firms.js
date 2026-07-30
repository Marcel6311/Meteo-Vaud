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
// Couverture mondiale, decoupee en 6 zones continentales pour rester dans
// les limites de taille de reponse de l'API FIRMS.
//
// La cle API (MAP_KEY) est lue depuis la variable d'environnement FIRMS_MAP_KEY.
// Limite : 5000 transactions / 10 min. Avec 6 zones x 2 satellites = 12 appels
// toutes les 2h, on est tres loin du plafond.

const https = require("https");

// Zones continentales (ouest,sud,est,nord) — ensemble elles couvrent le monde
var ZONES = {
  europe:         { bbox: "-25,25,55,72",    label: "Europe" },
  north_america:  { bbox: "-170,10,-50,75",  label: "Amerique du Nord" },
  south_america:  { bbox: "-85,-60,-30,15",  label: "Amerique du Sud" },
  africa:         { bbox: "-20,-40,55,40",    label: "Afrique" },
  asia:           { bbox: "25,-10,180,75",    label: "Asie" },
  oceania:        { bbox: "100,-50,180,-5",   label: "Oceanie" }
};

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
  var zoneKeys = Object.keys(ZONES);

  for (var z = 0; z < zoneKeys.length; z++) {
    var zone = ZONES[zoneKeys[z]];
    for (var i = 0; i < SOURCES.length; i++) {
      var url = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/" +
        mapKey + "/" + SOURCES[i] + "/" + zone.bbox + "/" + DAY_RANGE;

      console.log("[firms] " + zone.label + " / " + SOURCES[i] + "...");
      try {
        var csv = await httpGet(url);
        var detections = parseCsv(csv, SOURCES[i]);
        allDetections = allDetections.concat(detections);
        console.log("[firms] " + zone.label + " / " + SOURCES[i] + " : " + detections.length + " detections");
      } catch (err) {
        // En cas d'echec sur une zone, on continue les autres plutot que de tout planter
        console.error("[firms] echec " + zone.label + " / " + SOURCES[i] + " : " + err.message);
      }
    }
  }

  console.log("[firms] total mondial : " + allDetections.length + " detections");
  return allDetections;
}

module.exports = { fetchFirmsData };
