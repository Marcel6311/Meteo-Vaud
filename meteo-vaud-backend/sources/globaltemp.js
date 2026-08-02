// sources/globaltemp.js
//
// Recupere l'anomalie de temperature globale mensuelle du NASA GISS
// (GISTEMP v4), par rapport a la moyenne de reference 1951-1980.
// Gratuit, sans cle, mis a jour environ une fois par mois (autour du
// milieu du mois pour le mois precedent).
//
// Prudence : meme approche que l'indice ENSO (01.08) - le format exact
// des valeurs (degres directs ou centiemes de degre) n'a pas pu etre
// verifie a l'avance depuis cet environnement. Log des lignes brutes
// + controle de coherence avant d'accepter la valeur.

const https = require("https");

function httpGet(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      var data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        if (res.statusCode !== 200) {
          reject(new Error("NASA GISS HTTP " + res.statusCode + ": " + data.slice(0, 200)));
        } else {
          resolve(data);
        }
      });
    }).on("error", reject);
  });
}

var MONTH_NAMES_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

// Verifie qu'une anomalie de temperature globale est plausible (en °C).
// Les anomalies modernes tournent autour de +0.5 a +1.5°C ; on garde une
// marge large (-1 a +3°C) pour rester valide sur toute la periode recente
// sans pour autant accepter une valeur clairement mal parsee (ex: 85 au
// lieu de 0.85 si le fichier est en centiemes de degre).
function isPlausible(anomaly) {
  return !isNaN(anomaly) && anomaly > -1 && anomaly < 3;
}

async function fetchGlobalTemp() {
  var url = "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv";
  var raw = await httpGet(url);
  var lines = raw.trim().split("\n").filter(function (l) { return l.trim().length > 0; });

  if (lines.length < 3) throw new Error("Fichier GISTEMP vide ou format inattendu");

  console.log("[globaltemp] ligne d'en-tete 1 : " + lines[0]);
  console.log("[globaltemp] ligne d'en-tete 2 (colonnes) : " + lines[1]);

  var columns = lines[1].split(",").map(function (c) { return c.trim(); });
  var monthCols = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // On cherche la derniere ligne de donnees valide (annee numerique en premiere colonne)
  var dataLines = lines.slice(2).filter(function (l) { return /^\d{4},/.test(l); });
  if (dataLines.length === 0) throw new Error("Aucune ligne de donnees numeriques trouvee");

  var lastLine = dataLines[dataLines.length - 1].split(",").map(function (c) { return c.trim(); });
  console.log("[globaltemp] derniere ligne de donnees : " + dataLines[dataLines.length - 1]);

  var year = parseInt(lastLine[0]);

  // Trouve le dernier mois avec une valeur numerique valide (pas "***" qui
  // marque les mois futurs pas encore mesures dans l'annee en cours)
  var lastMonthIdx = -1;
  var lastValue = null;
  for (var i = 0; i < monthCols.length; i++) {
    var colIdx = columns.indexOf(monthCols[i]);
    if (colIdx === -1 || colIdx >= lastLine.length) continue;
    var val = parseFloat(lastLine[colIdx]);
    if (!isNaN(val)) {
      lastMonthIdx = i;
      lastValue = val;
    }
  }

  if (lastMonthIdx === -1 || lastValue === null) {
    throw new Error("Aucun mois avec une valeur numerique trouve sur la derniere ligne");
  }

  if (!isPlausible(lastValue)) {
    throw new Error("Anomalie implausible : " + lastValue + "°C (annee=" + year + ", mois=" + monthCols[lastMonthIdx] + ")");
  }

  var period = MONTH_NAMES_FR[lastMonthIdx] + " " + year;

  console.log("[globaltemp] retenu : " + period + " — anomalie " + lastValue + "°C (base 1951-1980)");

  return {
    period: period,
    anomaly: lastValue,
    baseline: "1951-1980"
  };
}

module.exports = { fetchGlobalTemp };
