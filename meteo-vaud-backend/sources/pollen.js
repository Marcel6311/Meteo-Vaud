// sources/pollen.js
//
// Recupere les concentrations de pollen (grains/m3) pour la station de
// Lausanne (PLS) du reseau national MeteoSwiss, gratuit et sans cle.
//
// Prudence : le format exact des colonnes du fichier horaire n'a pas pu
// etre verifie a l'avance (source non accessible depuis l'environnement
// de developpement). Le parsing est donc dynamique (lecture de l'en-tete,
// pas de position codee en dur) et les 2 dernieres lignes brutes sont
// loggees pour verification manuelle apres deploiement, comme cela a ete
// fait avec succes pour l'indice ENSO le 01.08.

const https = require("https");

var STATION = "pls"; // Lausanne
var DATA_URL = "https://data.geo.admin.ch/ch.meteoschweiz.ogd-pollen/" + STATION + "/ogd-pollen_" + STATION + "_h_now.csv";
var PARAMS_META_URL = "https://data.geo.admin.ch/ch.meteoschweiz.ogd-pollen/ogd-pollen_meta_parameters.csv";

// Traduction francaise des types de pollen (les codes MeteoSwiss varient,
// on matche sur des mots-cles presents dans la description du parametre).
var POLLEN_KEYWORDS = [
  { key: "aulne", match: /alder|erle|aun/i },
  { key: "frene", match: /ash|esche|fren/i },
  { key: "bouleau", match: /birch|birke|boul/i },
  { key: "hetre", match: /beech|buche|het/i },
  { key: "noisetier", match: /hazel|hasel|noiset/i },
  { key: "chene", match: /oak|eiche|chen/i },
  { key: "graminees", match: /grass|graser|gramin/i }
];

function httpGet(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      var data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        if (res.statusCode !== 200) {
          reject(new Error("MeteoSwiss HTTP " + res.statusCode + ": " + data.slice(0, 200)));
        } else {
          resolve(data);
        }
      });
    }).on("error", reject);
  });
}

function parseCsv(text) {
  var lines = text.trim().split("\n").filter(function (l) { return l.trim().length > 0; });
  return lines.map(function (l) { return l.split(";"); });
}

// Recupere la table de correspondance code parametre -> description francaise
async function fetchParameterMeta() {
  var raw = await httpGet(PARAMS_META_URL);
  var rows = parseCsv(raw);
  if (rows.length < 2) return {};

  var header = rows[0].map(function (h) { return h.trim().toLowerCase(); });
  var shortnameIdx = header.indexOf("parameter_shortname");
  var descIdx = header.indexOf("parameter_description_fr");
  if (descIdx === -1) descIdx = header.indexOf("parameter_description_en");

  var meta = {};
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (shortnameIdx === -1 || !row[shortnameIdx]) continue;
    meta[row[shortnameIdx].trim()] = descIdx !== -1 ? (row[descIdx] || "").trim() : "";
  }
  return meta;
}

function classifyLevel(value) {
  // Seuils indicatifs generaux (grains/m3), varient legerement selon le type de pollen
  if (value === null || isNaN(value)) return null;
  if (value === 0) return "Absent";
  if (value < 10) return "Faible";
  if (value < 50) return "Moyen";
  if (value < 150) return "Fort";
  return "Très fort";
}

async function fetchPollen() {
  var meta = {};
  try {
    meta = await fetchParameterMeta();
  } catch (err) {
    console.error("[pollen] echec recuperation metadonnees parametres :", err.message);
  }

  var raw = await httpGet(DATA_URL);
  var rows = parseCsv(raw);

  if (rows.length < 2) throw new Error("Fichier pollen vide ou format inattendu");

  var header = rows[0].map(function (h) { return h.trim(); });
  var lastRow = rows[rows.length - 1];

  console.log("[pollen] en-tete detecte : " + header.join(" | "));
  console.log("[pollen] derniere ligne brute : " + lastRow.join(" | "));

  var timestampIdx = header.findIndex(function (h) { return /reference_timestamp|date/i.test(h); });
  var timestamp = timestampIdx !== -1 ? lastRow[timestampIdx] : null;

  // Pour chaque colonne de donnee (hors station/date), on tente de l'associer
  // a un type de pollen connu via son code + la description recuperee des metadonnees.
  var readings = [];
  header.forEach(function (colName, idx) {
    if (idx === timestampIdx) return;
    if (/station/i.test(colName)) return;

    var description = meta[colName] || "";
    var matchedType = null;
    POLLEN_KEYWORDS.forEach(function (p) {
      if (p.match.test(colName) || p.match.test(description)) matchedType = p.key;
    });
    if (!matchedType) return; // colonne non reconnue comme un type de pollen

    var rawValue = lastRow[idx];
    var value = rawValue !== undefined && rawValue !== "" ? parseFloat(rawValue.replace(",", ".")) : null;

    readings.push({
      type: matchedType,
      column: colName,
      value: value,
      level: classifyLevel(value)
    });
  });

  console.log("[pollen] " + readings.length + " types de pollen identifies pour Lausanne");

  return {
    station: "Lausanne (PLS)",
    timestamp: timestamp,
    readings: readings
  };
}

module.exports = { fetchPollen };
