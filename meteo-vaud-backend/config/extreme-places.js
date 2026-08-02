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
//
// Liste elargie le 02.08 (10 -> 15 lieux) pour une meilleure couverture
// des continents (Australie, Ameriques, Asie du Sud ajoutes).

module.exports = [
  // --- Chaud ---
  { country: "Etats-Unis", capital: "Death Valley (Furnace Creek)", lat: 36.4622, lon: -116.8958 },
  { country: "Ethiopie", capital: "Dallol", lat: 14.2417, lon: 40.3000 },
  { country: "Koweit", capital: "Mitribah", lat: 29.6367, lon: 47.1467 },
  { country: "Soudan", capital: "Wadi Halfa", lat: 21.7943, lon: 31.3492 },
  { country: "Mali", capital: "Tombouctou", lat: 16.7666, lon: -3.0026 },
  { country: "Tunisie", capital: "Kebili", lat: 33.7044, lon: 8.9690 },
  { country: "Pakistan", capital: "Jacobabad", lat: 28.2769, lon: 68.4514 },
  { country: "Australie", capital: "Marble Bar", lat: -21.1758, lon: 119.7447 },
  { country: "Argentine", capital: "Rivadavia", lat: -24.1833, lon: -62.8833 },

  // --- Froid ---
  { country: "Antarctique", capital: "Station Vostok", lat: -78.4645, lon: 106.8339 },
  { country: "Antarctique", capital: "Pole Sud (Amundsen-Scott)", lat: -89.9968, lon: -139.2666 },
  { country: "Russie", capital: "Oymyakon", lat: 63.4610, lon: 142.7864 },
  { country: "Russie", capital: "Verkhoiansk", lat: 67.5447, lon: 133.3850 },
  { country: "Russie", capital: "Iakoutsk", lat: 62.0355, lon: 129.6755 },
  { country: "Canada", capital: "Snag (Yukon)", lat: 62.3728, lon: -140.3717 }
];
