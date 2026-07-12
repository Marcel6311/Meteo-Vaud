// sources/swissmetnet.js
//
// Source de donnees "officielle" : valeurs actuelles (toutes les 10 min,
// toutes stations confondues) publiees par MeteoSwiss.
//
// Fichier source : VQHA80.csv
// https://data.geo.admin.ch/ch.meteoschweiz.messwerte-aktuell/VQHA80.csv
// Format reel (verifie) : lignes separees par ";", entete avec les deux
// premieres colonnes nommees "Station/Location" et "Date". Exemple :
//   Station/Location;Date;tre200s0;rre150z0;sre000z0;gre000z0;ure200s0;tde200s0;dkl010z0;fu3010z0;fu3010z1;prestas0;pp0qffs0;pp0qnhs0;...
//   PUY;202607121420;18.2;0.0;0;326;64;11.3;210;12.0;18.4;951.2;1013.5;1013.1;-;-;-;-;-;-;-;-
// Les valeurs manquantes sont notees "-".
//
// Licence : CC-BY. Toute utilisation affichee doit mentionner "Source: MeteoSwiss".

const fetch = require("node-fetch");
const { translateRow } = require("../parseParameters");
const { normalizeReading } = require("../normalize");
const DEFAULT_STATIONS = require("../config/stations"); // curated Vaud (v1)

const CURRENT_VALUES_URL =
  "https://data.geo.admin.ch/ch.meteoschweiz.messwerte-aktuell/VQHA80.csv";

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
 * Parse le CSV brut (separateur ";") en tableau d'objets bruts
 * { "Station/Location": "PUY", "Date": "202607121420", tre200s0: "18.2", ... }
 */
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = lines[0].split(";").map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
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
 * Recupere et normalise les dernieres valeurs pour une liste de stations.
 * @param {Array<Object>} [stationsList] - par defaut, la liste vaudoise
 *   curatee (config/stations.js). Passer la liste complete issue de
 *   stationRegistry.getAllStations() pour couvrir toute la Suisse.
 * @returns {Promise<Array<Object>>} lectures normalisees (voir normalize.js)
 */
async function fetchCurrentReadings(stationsList) {
  const stations = stationsList || DEFAULT_STATIONS;
  const stationsByCode = Object.fromEntries(stations.map((s) => [s.code, s]));

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
    const stationCode = row["Station/Location"];
    const station = stationsByCode[stationCode];
    if (!station) continue; // station non suivie, on ignore

    const mesures = translateRow(row);
    const timestamp = parseTimestamp(row["Date"]);

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
