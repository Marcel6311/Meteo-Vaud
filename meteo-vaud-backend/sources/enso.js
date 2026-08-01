// sources/enso.js
//
// Recupere l'indice ONI (Oceanic Nino Index) officiel du NOAA/CPC, qui
// sert de reference pour determiner si on est en periode El Nino, La Nina,
// ou neutre. Fichier texte simple, gratuit, sans cle, mis a jour une fois
// par mois par le NOAA (autour du 5 de chaque mois).
//
// Format du fichier : "SEAS YR TOTAL ANOM" avec une ligne par periode de
// 3 mois glissante depuis 1950 (ex: "JJA 2026  27.44   0.70").

const https = require("https");

function httpGet(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      var data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        if (res.statusCode !== 200) {
          reject(new Error("NOAA HTTP " + res.statusCode + ": " + data.slice(0, 200)));
        } else {
          resolve(data);
        }
      });
    }).on("error", reject);
  });
}

function classifyEnso(anomaly) {
  var abs = Math.abs(anomaly);
  var phase, strength;

  if (anomaly >= 0.5) {
    phase = "El Niño";
    if (abs >= 1.5) strength = "Fort";
    else if (abs >= 1.0) strength = "Modéré";
    else strength = "Faible";
  } else if (anomaly <= -0.5) {
    phase = "La Niña";
    if (abs >= 1.5) strength = "Fort";
    else if (abs >= 1.0) strength = "Modéré";
    else strength = "Faible";
  } else {
    phase = "Neutre";
    strength = null;
  }

  return { phase: phase, strength: strength };
}

async function fetchEnso() {
  var url = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt";
  var raw = await httpGet(url);
  var lines = raw.trim().split("\n").filter(function (l) { return l.trim().length > 0; });

  if (lines.length < 2) throw new Error("Format ONI inattendu (fichier vide)");

  // La derniere ligne est la periode la plus recente disponible
  var lastLine = lines[lines.length - 1].trim().split(/\s+/);
  if (lastLine.length < 4) throw new Error("Format ONI inattendu (colonnes manquantes)");

  var season = lastLine[0]; // ex: "JJA"
  var year = parseInt(lastLine[1]);
  var sst = parseFloat(lastLine[2]);
  var anomaly = parseFloat(lastLine[3]);

  var classification = classifyEnso(anomaly);

  // Historique des 12 dernieres periodes, pour une eventuelle mini-courbe
  var history = lines.slice(-12).map(function (l) {
    var cols = l.trim().split(/\s+/);
    return { season: cols[0], year: parseInt(cols[1]), anomaly: parseFloat(cols[3]) };
  });

  return {
    season: season,
    year: year,
    sstAnomaly: anomaly,
    phase: classification.phase,
    strength: classification.strength,
    history: history
  };
}

module.exports = { fetchEnso };
