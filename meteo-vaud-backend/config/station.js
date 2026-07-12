// config/stations.js
//
// Stations SwissMetNet suivies par Meteo-Vaud.
// Codes, noms et coordonnees extraits de ogd-smn_meta_stations.csv
// (https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/ogd-smn_meta_stations.csv)
//
// Pour ajouter une station : recuperer son code 3 lettres dans le fichier
// meta_stations officiel et ajouter une entree ici. Aucune autre modification
// n'est necessaire, le reste du pipeline (fetch, parse, normalize) est generique.

module.exports = [
  {
    code: "PUY",
    name: "Pully",
    canton: "VD",
    lat: 46.512283,
    lon: 6.667517,
    altitude_m: 456,
    note: "Station de reference, agglomeration lausannoise"
  },
  {
    code: "PRE",
    name: "St-Prex",
    canton: "VD",
    lat: 46.483683,
    lon: 6.443,
    altitude_m: 425
  },
  {
    code: "MAH",
    name: "Mathod",
    canton: "VD",
    lat: 46.736978,
    lon: 6.567983,
    altitude_m: 435
  },
  {
    code: "CGI",
    name: "Nyon / Changins",
    canton: "VD",
    lat: 46.401053,
    lon: 6.227722,
    altitude_m: 458
  },
  {
    code: "PAY",
    name: "Payerne",
    canton: "VD",
    lat: 46.811581,
    lon: 6.942469,
    altitude_m: 490
  },
  {
    code: "AIG",
    name: "Aigle",
    canton: "VD",
    lat: 46.326647,
    lon: 6.924472,
    altitude_m: 381
  },
  {
    code: "DOL",
    name: "La Dole",
    canton: "VD",
    lat: 46.424794,
    lon: 6.099453,
    altitude_m: 1670,
    note: "Sommet du Jura, relief"
  },
  {
    code: "FRE",
    name: "Bullet / La Fretaz",
    canton: "VD",
    lat: 46.840622,
    lon: 6.576369,
    altitude_m: 1205
  },
  {
    code: "CDM",
    name: "Col des Mosses",
    canton: "VD",
    lat: 46.391525,
    lon: 7.098239,
    altitude_m: 1412
  },
  {
    code: "CHD",
    name: "Chateau-d'Oex",
    canton: "VD",
    lat: 46.479819,
    lon: 7.139656,
    altitude_m: 1028
  },
  {
    code: "DIA",
    name: "Les Diablerets",
    canton: "VD",
    lat: 46.32675,
    lon: 7.203781,
    altitude_m: 2964
  },
  {
    code: "ORO",
    name: "Oron",
    canton: "VD",
    lat: 46.572269,
    lon: 6.858239,
    altitude_m: 828
  },
  {
    code: "CHB",
    name: "Les Charbonnieres",
    canton: "VD",
    lat: 46.67015,
    lon: 6.312428,
    altitude_m: 1045,
    note: "Vallee de Joux"
  },
  {
    code: "BIE",
    name: "Biere",
    canton: "VD",
    lat: 46.524908,
    lon: 6.342386,
    altitude_m: 684
  }
];
