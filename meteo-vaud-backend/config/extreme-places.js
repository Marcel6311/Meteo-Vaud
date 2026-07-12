// config/extreme-places.js
//
// Lieux connus pour leurs conditions climatiques extremes (chaud et
// froid), suivis en temperature ACTUELLE (pas le record historique,
// qui est fixe et affiche separement cote frontend).
//
// Meme structure que config/capitals.js : { country, capital, lat, lon }
// (les noms de champs sont reutilises tels quels pour rester compatible
// avec le pipeline existant - "capital" designe ici le nom du lieu,
// "country" son pays/region).

module.exports = [
  { country: "Etats-Unis", capital: "Death Valley (Furnace Creek)", lat: 36.4622, lon: -116.8958 },
  { country: "Antarctique", capital: "Station Vostok", lat: -78.4645, lon: 106.8339 },
  { country: "Antarctique", capital: "Pole Sud (Amundsen-Scott)", lat: -89.9968, lon: -139.2666 },
  { country: "Russie", capital: "Oymyakon", lat: 63.4610, lon: 142.7864 },
  { country: "Russie", capital: "Verkhoiansk", lat: 67.5447, lon: 133.3850 },
  { country: "Russie", capital: "Iakoutsk", lat: 62.0355, lon: 129.6755 },
  { country: "Ethiopie", capital: "Dallol", lat: 14.2417, lon: 40.3000 },
  { country: "Koweit", capital: "Mitribah", lat: 29.6367, lon: 47.1467 },
  { country: "Soudan", capital: "Wadi Halfa", lat: 21.7943, lon: 31.3492 },
  { country: "Mali", capital: "Tombouctou", lat: 16.7666, lon: -3.0026 }
];
