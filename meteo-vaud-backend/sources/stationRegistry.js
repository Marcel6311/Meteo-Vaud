// sources/stationRegistry.js
//
// Recupere et met en cache la liste COMPLETE des stations SwissMetNet
// (Suisse entiere, ~150 stations) directement depuis les metadonnees
// officielles MeteoSwiss, plutot que de la coder en dur.
//
// Fichier source : ogd-smn_meta_stations.csv
// https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/ogd-smn_meta_stations.csv
// Format : separateur ";", encodage attendu UTF-8. Colonnes utiles :
//   station_abbr, station_name, station_canton,
//   station_height_masl, station_coordinates_wgs84_lat, station_coordinates_wgs84_lon
//
// Le registre est rafraichi une fois par jour (la liste des stations change
// tres rarement) ; separement du cycle de rafraichissement des mesures
// (toutes les 10 minutes) gere par sources/swissmetnet.js.

const fetch = require("node-fetch");

const META_STATIONS_URL =
  "https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/ogd-smn_meta_stations.csv";

let cache = { fetchedAt: null, stations: [] };

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
 * Convertit une ligne brute de ogd-smn_meta_stations.csv en objet station
 * au meme format que config/stations.js, pour rester compatible avec le
 * reste du pipeline (sources/swissmetnet.js, normalize.js).
 */
function toStationObject(row) {
  const lat = parseFloat(row.station_coordinates_wgs84_lat);
  const lon = parseFloat(row.station_coordinates_wgs84_lon);
  const altitude = parseFloat(row.station_height_masl);

  if (!row.station_abbr || Number.isNaN(lat) || Number.isNaN(lon)) {
    return null; // ligne incomplete, ignoree proprement
  }

  return {
    code: row.station_abbr,
    name: row.station_name || row.station_abbr,
    canton: row.station_canton || null,
    lat,
    lon,
    altitude_m: Number.isNaN(altitude) ? null : Math.round(altitude)
  };
}

/**
 * Retourne la liste complete des stations (depuis le cache si disponible
 * et recent, sinon la telecharge).
 * @param {boolean} forceRefresh
 * @returns {Promise<Array<Object>>}
 */
async function getAllStations(forceRefresh) {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const isStale =
    !cache.fetchedAt || Date.now() - cache.fetchedAt > ONE_DAY_MS;

  if (!forceRefresh && !isStale && cache.stations.length > 0) {
    return cache.stations;
  }

  const res = await fetch(META_STATIONS_URL);
  if (!res.ok) {
    if (cache.stations.length > 0) {
      // Echec du refresh : on garde l'ancien cache plutot que de tout casser
      return cache.stations;
    }
    throw new Error(
      `Echec recuperation ogd-smn_meta_stations.csv : ${res.status} ${res.statusText}`
    );
  }

  // Le fichier MeteoSwiss contient des caracteres accentues (Grachen,
  // Chateau-d'Oex...) qui ne sont pas toujours servis en UTF-8 propre.
  // On decode d'abord en UTF-8 ; si des caracteres de remplacement (U+FFFD)
  // apparaissent, on re-decode le buffer brut en latin1 a la place.
  const buffer = await res.buffer();
  let text = buffer.toString("utf8");
  if (text.indexOf("\uFFFD") !== -1) {
    text = buffer.toString("latin1");
  }
  const rows = parseCsv(text);
  const stations = rows.map(toStationObject).filter(Boolean);

  cache = { fetchedAt: Date.now(), stations };
  return stations;
}

module.exports = { getAllStations, META_STATIONS_URL };
