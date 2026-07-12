// parseParameters.js
//
// Traduit les codes parametres cryptiques de MeteoSwiss (ex: tre200s0)
// en champs lisibles. Liste basee sur le fichier officiel
// ogd-smn_meta_parameters.csv et sur le format du flux "valeurs actuelles"
// (VQHA80.csv), qui contient un sous-ensemble de parametres frequents.
//
// Si MeteoSwiss ajoute/retire une colonne, seule cette table doit etre mise
// a jour ; le reste du pipeline reste inchange.

const PARAMETERS = {
  tre200s0: { field: "temperature", label: "Temperature 2m", unit: "°C" },
  ure200s0: { field: "humidite", label: "Humidite relative 2m", unit: "%" },
  tde200s0: { field: "point_de_rosee", label: "Point de rosee 2m", unit: "°C" },
  dkl010z0: { field: "vent_direction", label: "Direction du vent (moy. 10min)", unit: "°" },
  fu3010z0: { field: "vent_vitesse", label: "Vitesse du vent (moy. 10min)", unit: "km/h" },
  fu3010z1: { field: "vent_rafale", label: "Rafale maximale (10min)", unit: "km/h" },
  rre150z0: { field: "precipitation", label: "Precipitations (10min)", unit: "mm" },
  sre000z0: { field: "duree_ensoleillement", label: "Duree d'ensoleillement (10min)", unit: "min" },
  gre000z0: { field: "radiation_globale", label: "Radiation globale (10min)", unit: "W/m²" },
  prestas0: { field: "pression_station", label: "Pression au niveau de la station (QFE)", unit: "hPa" },
  pp0qffs0: { field: "pression_mer", label: "Pression reduite au niveau de la mer (QFF)", unit: "hPa" },
  pp0qnhs0: { field: "pression_qnh", label: "Pression QNH", unit: "hPa" },
  // Parametres des stations-tours (mesures en altitude, suffixe "tow")
  dv1towz0: { field: "tour_vent_direction", label: "Direction du vent (tour)", unit: "°" },
  fu3towz0: { field: "tour_vent_vitesse", label: "Vitesse du vent (tour)", unit: "km/h" },
  fu3towz1: { field: "tour_vent_rafale", label: "Rafale maximale (tour)", unit: "km/h" },
  ta1tows0: { field: "tour_temperature", label: "Temperature (tour)", unit: "°C" },
  uretows0: { field: "tour_humidite", label: "Humidite relative (tour)", unit: "%" },
  tdetows0: { field: "tour_point_de_rosee", label: "Point de rosee (tour)", unit: "°C" }
};

/**
 * Convertit une ligne brute { tre200s0: "18.2", ure200s0: "64", ... }
 * en objet normalise avec noms de champs lisibles.
 */
function translateRow(rawRow) {
  const out = {};
  for (const [code, value] of Object.entries(rawRow)) {
    if (code === "Station/Location" || code === "Date") continue;
    const def = PARAMETERS[code];
    if (!def) continue; // parametre inconnu : ignore proprement plutot que de planter
    if (value === "-" || value === "" || value === undefined) {
      out[def.field] = null; // valeur manquante, notee "-" par MeteoSwiss
      continue;
    }
    const num = parseFloat(value);
    out[def.field] = Number.isNaN(num) ? null : num;
  }
  return out;
}

module.exports = { PARAMETERS, translateRow };
