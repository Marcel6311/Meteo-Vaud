// sources/swissmetnet.js
//
// Source de donnees "officielle" : valeurs actuelles (toutes les 10 min,
// toutes stations confondues) publiees par MeteoSwiss.
//
// Fichier source : VQHA80.csv
// https://data.geo.admin.ch/ch.meteoschweiz.messwerte-aktuell/VQHA80.csv
// Format : lignes separees par "|", encodage ISO-8859-1, une ligne d'entete
// suivie d'une ligne par station. Exemple :
//   stn|time|tre200s0|sre000z0|rre150z0|dkl010z0|fu3010z0|pp0qnhs0|fu3010z1|ure200s0|prestas0|pp0qffs0
//   PUY|202607121420|18.2|0|0.0|210|12.0|1013.1|18.4|64|951.2|1013.5
//
// Licence : CC-BY. Toute utilisation affichee doit mentionner "Source: MeteoSwiss".

const fetch = require("node-fetch");
const { translateRow } = require("../parseParameters");
const { normalizeReading } = require("../normalize");
const STATIONS = require("../config/stations");

const CURRENT_VALUES_URL =
  "https://data.geo.admin.ch/ch.meteoschweiz.messwerte-aktuell/VQHA80.csv";

// Index rapide code -> metadonnees station suivie
const STATIONS_BY_CODE = Object.fromEntries(
  STATIONS.map((s) => [s.code, s])
);

/**
 * Convertit un timestamp MeteoSwiss "YYYYMMDDHHmm" (heure locale Suisse)
 * en chaine ISO 8601 approximative (sans conversion de fuseau horaire,
 * a affiner si une precision UTC stricte est necessaire).
 */
function parseTimestamp(raw) {
  if (!raw || raw.length !== 12) return null;
  const y = raw.slice(0, 4);
  const mo = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  const h = raw.slice(8, 10);
  const mi = raw.slice(10, 12);
  return `${y}-${mo}-${d}T${h}:${mi}:00`;
}

/**
 * Parse le CSV brut (pipe-separated) en tableau d'objets bruts { stn, time, ...codes }
 */
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = lines[0].split("|");
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("|");
    if (cols.length !== header.length) continue; // ligne malformee, ignoree
    const row = {};
    header.forEach((key, idx) => {
      row[key] = cols[idx];
    });
    rows.push(row);
  }
  return rows;
}

/**
 * Recupere et normalise les dernieres valeurs pour les stations suivies.
 * @returns {Promise<Array<Object>>} lectures normalisees (voir normalize.js)
 */
async function fetchCurrentReadings() {
  const res = await fetch(CURRENT_VALUES_URL);
  if (!res.ok) {
    throw new Error(
      `Echec recuperation VQHA80.csv : ${res.status} ${res.statusText}`
    );
  }
  const text = await res.text();
  const rows = parseCsv(text);

  const readings = [];

  for (const row of rows) {
    const station = STATIONS_BY_CODE[row.stn];
    if (!station) continue; // station non suivie, on ignore

    const mesures = translateRow(row);
    const timestamp = parseTimestamp(row.time);

    readings.push(
      normalizeReading({
        source: "swissmetnet",
        fiabilite: "officielle",
        station_id: station.code,
        station_name: station.name,
        lat: station.lat,
        lon: station.lon,
        altitude_m: station.altitude_m,
        timestamp,
        mesures
      })
    );
  }

  return readings;
}

module.exports = { fetchCurrentReadings, CURRENT_VALUES_URL };
