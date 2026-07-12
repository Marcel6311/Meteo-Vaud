// normalize.js
//
// Schema commun a TOUTES les sources (SwissMetNet aujourd'hui, Netatmo ou
// autres demain). Toute nouvelle source doit produire des objets via
// normalizeReading() pour rester compatible avec le frontend et les futurs
// endpoints de comparaison, sans casser l'existant.

/**
 * @param {Object} params
 * @param {"swissmetnet"|"netatmo"|"model"} params.source
 * @param {"officielle"|"citoyenne"|"modele"} params.fiabilite
 * @param {string} params.station_id
 * @param {string} params.station_name
 * @param {number} params.lat
 * @param {number} params.lon
 * @param {string} params.timestamp - ISO 8601
 * @param {Object} params.mesures - champs traduits (temperature, humidite, ...)
 */
function normalizeReading({
  source,
  fiabilite,
  station_id,
  station_name,
  lat,
  lon,
  altitude_m,
  timestamp,
  mesures
}) {
  return {
    source,
    fiabilite,
    station_id,
    station_name,
    lat,
    lon,
    altitude_m: altitude_m ?? null,
    timestamp,
    ...mesures
  };
}

module.exports = { normalizeReading };
