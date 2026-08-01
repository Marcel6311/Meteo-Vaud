// sources/enso.js
//
// Recupere deux indicateurs ENSO du NOAA/CPC (gratuit, sans cle) :
//   1. Nino 3.4 mensuel NON lisse — reagit plus vite (retard ~1-2 mois)
//   2. ONI (moyenne glissante 3 mois) — reference officielle, mais accuse
//      un retard plus important en cas d'evolution rapide (comme actuellement)
//
// Le mensuel est utilise en priorite pour l'affichage "temps reel", l'ONI
// reste disponible en secours et pour reference.

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

// Verifie que la valeur/annee extraites sont plausibles avant de les utiliser.
// Anomalie SST realiste : entre -4 et +4°C. Annee : proche de l'annee actuelle.
function isPlausible(anomaly, year) {
  var currentYear = new Date().getFullYear();
  if (isNaN(anomaly) || Math.abs(anomaly) > 4) return false;
  if (isNaN(year) || Math.abs(year - currentYear) > 2) return false;
  return true;
}

async function fetchOni() {
  var url = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt";
  var raw = await httpGet(url);
  var lines = raw.trim().split("\n").filter(function (l) { return l.trim().length > 0; });

  if (lines.length < 2) throw new Error("Format ONI inattendu (fichier vide)");

  var lastLine = lines[lines.length - 1].trim().split(/\s+/);
  if (lastLine.length < 4) throw new Error("Format ONI inattendu (colonnes manquantes)");

  var season = lastLine[0];
  var year = parseInt(lastLine[1]);
  var anomaly = parseFloat(lastLine[3]);

  if (!isPlausible(anomaly, year)) {
    throw new Error("ONI : valeurs implausibles (season=" + season + " year=" + year + " anomaly=" + anomaly + ")");
  }

  var history = lines.slice(-12).map(function (l) {
    var cols = l.trim().split(/\s+/);
    return { label: cols[0] + " " + cols[1], anomaly: parseFloat(cols[3]) };
  });

  return { period: season + " " + year, sstAnomaly: anomaly, history: history, unsmoothed: false };
}

// Tente de lire le fichier mensuel NON lisse (plus reactif que l'ONI).
// Format confirme le 01.08 via les logs de production (10 colonnes) :
//   YR  MON  Nino1+2_SST  Nino1+2_ANOM  Nino3_SST  Nino3_ANOM  Nino3.4_SST  Nino3.4_ANOM  Nino4_SST  Nino4_ANOM
// On veut Nino3.4 (indice standard El Nino/La Nina), colonnes 6 et 7.
async function fetchMonthlyNino34() {
  var url = "https://www.cpc.ncep.noaa.gov/data/indices/ersst5.nino.mth.91-20.ascii";
  var raw = await httpGet(url);
  var lines = raw.trim().split("\n").filter(function (l) { return l.trim().length > 0; });

  if (lines.length < 2) throw new Error("Fichier mensuel Nino3.4 vide");

  // Derniere ligne de donnees (en ignorant un eventuel en-tete non numerique)
  var dataLines = lines.filter(function (l) { return /^\s*\d{4}\s+\d{1,2}\s/.test(l); });
  if (dataLines.length === 0) throw new Error("Aucune ligne de donnees numeriques trouvee dans le fichier mensuel");

  var lastLine = dataLines[dataLines.length - 1].trim().split(/\s+/);
  if (lastLine.length < 8) throw new Error("Ligne mensuelle incomplete : \"" + dataLines[dataLines.length - 1] + "\"");

  var year = parseInt(lastLine[0]);
  var month = parseInt(lastLine[1]);
  var nino34Sst = parseFloat(lastLine[6]);
  var anomaly = parseFloat(lastLine[7]); // Nino3.4 ANOM = colonne 7 (indice 0-based)

  if (!isPlausible(anomaly, year)) {
    throw new Error("Mensuel Nino3.4 : valeurs implausibles (ligne=\"" + dataLines[dataLines.length - 1] + "\" -> anomaly=" + anomaly + " year=" + year + ")");
  }

  var MONTH_NAMES = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  var period = (MONTH_NAMES[month] || month) + " " + year;

  console.log("[enso] mensuel Nino3.4 retenu : " + period + " — SST " + nino34Sst + "°C, anomalie " + anomaly + "°C");

  return { period: period, sstAnomaly: anomaly, unsmoothed: true };
}

async function fetchEnso() {
  var oni = null;
  var monthly = null;
  var errors = [];

  try {
    oni = await fetchOni();
  } catch (err) {
    errors.push("ONI: " + err.message);
    console.error("[enso] echec ONI :", err.message);
  }

  try {
    monthly = await fetchMonthlyNino34();
  } catch (err) {
    errors.push("Mensuel: " + err.message);
    console.error("[enso] echec mensuel :", err.message);
  }

  // Priorite au mensuel (plus reactif) s'il est disponible et coherent,
  // sinon on retombe sur l'ONI officiel.
  var primary = monthly || oni;
  if (!primary) {
    throw new Error("Aucune source ENSO disponible : " + errors.join(" | "));
  }

  var classification = classifyEnso(primary.sstAnomaly);

  return {
    period: primary.period,
    sstAnomaly: primary.sstAnomaly,
    unsmoothed: primary.unsmoothed,
    phase: classification.phase,
    strength: classification.strength,
    oniReference: oni ? { period: oni.period, sstAnomaly: oni.sstAnomaly } : null,
    history: oni ? oni.history : []
  };
}

module.exports = { fetchEnso };
