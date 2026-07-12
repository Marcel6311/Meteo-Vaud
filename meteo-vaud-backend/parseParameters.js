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
  dkl010z0: { field: "vent_direction", label: "Direction du vent (moy. 10min)", unit: "°" },
  fu3010z0: { field: "vent_vitesse", label: "Vitesse du vent (moy. 10min)", unit: "km/h" },
  fu3010z1: { field: "vent_rafale", label: "Rafale maximale (10min)", unit: "km/h" },
  rre150z0: { field: "precipitation", label: "Precipitations (10min)", unit: "mm" },
  sre000z0: { field: "duree_ensoleillement", label: "Duree d'ensoleillement (10min)", unit: "min" },
  prestas0: { field: "pression_station", label: "Pression au niveau de la station", unit: "hPa" },
  pp0qffs0: { field: "pression_mer", label: "Pression reduite au niveau de la mer (QFF)", unit: "hPa" },
  pp0qnhs0: { field: "pression_qnh", label: "Pression QNH", unit: "hPa" },
  gre000z0: { field: "radiation_globale", label: "Radiation globale", unit: "W/m²" }
};

/**
 * Convertit une ligne brute { tre200s0: "18.2", ure200s0: "64", ... }
 * en objet normalise avec noms de champs lisibles.
 */
function translateRow(rawRow) {
  const out = {};
  for (const [code, value] of Object.entries(rawRow)) {
    if (code === "stn" || code === "time") continue;
    const def = PARAMETERS[code];
    if (!def) continue; // parametre inconnu : ignore proprement plutot que de planter
    const num = parseFloat(value);
    out[def.field] = Number.isNaN(num) ? null : num;
  }
  return out;
}

module.exports = { PARAMETERS, translateRow };
