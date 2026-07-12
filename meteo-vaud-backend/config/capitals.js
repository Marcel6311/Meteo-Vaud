// config/capitals.js
//
// Capitales des Etats souverains d'Europe, avec coordonnees WGS84.
// Utilise par sources/capitals.js pour interroger l'API "Current Weather"
// d'OpenWeatherMap (une requete par capitale, mise en cache cote serveur).
//
// Pour ajouter/retirer une capitale, modifier uniquement cette liste ;
// aucune autre partie du pipeline n'a besoin de changer.

module.exports = [
  { country: "Albanie", capital: "Tirana", lat: 41.3275, lon: 19.8189 },
  { country: "Andorre", capital: "Andorre-la-Vieille", lat: 42.5063, lon: 1.5218 },
  { country: "Autriche", capital: "Vienne", lat: 48.2082, lon: 16.3738 },
  { country: "Belarus", capital: "Minsk", lat: 53.9006, lon: 27.5590 },
  { country: "Belgique", capital: "Bruxelles", lat: 50.8503, lon: 4.3517 },
  { country: "Bosnie-Herzegovine", capital: "Sarajevo", lat: 43.8563, lon: 18.4131 },
  { country: "Bulgarie", capital: "Sofia", lat: 42.6977, lon: 23.3219 },
  { country: "Croatie", capital: "Zagreb", lat: 45.8150, lon: 15.9819 },
  { country: "Chypre", capital: "Nicosie", lat: 35.1856, lon: 33.3823 },
  { country: "Tchequie", capital: "Prague", lat: 50.0755, lon: 14.4378 },
  { country: "Danemark", capital: "Copenhague", lat: 55.6761, lon: 12.5683 },
  { country: "Estonie", capital: "Tallinn", lat: 59.4370, lon: 24.7536 },
  { country: "Finlande", capital: "Helsinki", lat: 60.1699, lon: 24.9384 },
  { country: "France", capital: "Paris", lat: 48.8566, lon: 2.3522 },
  { country: "Allemagne", capital: "Berlin", lat: 52.5200, lon: 13.4050 },
  { country: "Grece", capital: "Athenes", lat: 37.9838, lon: 23.7275 },
  { country: "Hongrie", capital: "Budapest", lat: 47.4979, lon: 19.0402 },
  { country: "Islande", capital: "Reykjavik", lat: 64.1466, lon: -21.9426 },
  { country: "Irlande", capital: "Dublin", lat: 53.3498, lon: -6.2603 },
  { country: "Italie", capital: "Rome", lat: 41.9028, lon: 12.4964 },
  { country: "Kosovo", capital: "Pristina", lat: 42.6629, lon: 21.1655 },
  { country: "Lettonie", capital: "Riga", lat: 56.9496, lon: 24.1052 },
  { country: "Liechtenstein", capital: "Vaduz", lat: 47.1410, lon: 9.5209 },
  { country: "Lituanie", capital: "Vilnius", lat: 54.6872, lon: 25.2797 },
  { country: "Luxembourg", capital: "Luxembourg", lat: 49.6116, lon: 6.1319 },
  { country: "Malte", capital: "La Valette", lat: 35.8989, lon: 14.5146 },
  { country: "Moldavie", capital: "Chisinau", lat: 47.0105, lon: 28.8638 },
  { country: "Monaco", capital: "Monaco", lat: 43.7384, lon: 7.4246 },
  { country: "Montenegro", capital: "Podgorica", lat: 42.4304, lon: 19.2594 },
  { country: "Pays-Bas", capital: "Amsterdam", lat: 52.3676, lon: 4.9041 },
  { country: "Macedoine du Nord", capital: "Skopje", lat: 41.9973, lon: 21.4280 },
  { country: "Norvege", capital: "Oslo", lat: 59.9139, lon: 10.7522 },
  { country: "Pologne", capital: "Varsovie", lat: 52.2297, lon: 21.0122 },
  { country: "Portugal", capital: "Lisbonne", lat: 38.7223, lon: -9.1393 },
  { country: "Roumanie", capital: "Bucarest", lat: 44.4268, lon: 26.1025 },
  { country: "Russie", capital: "Moscou", lat: 55.7558, lon: 37.6173 },
  { country: "Saint-Marin", capital: "Saint-Marin", lat: 43.9424, lon: 12.4578 },
  { country: "Serbie", capital: "Belgrade", lat: 44.7866, lon: 20.4489 },
  { country: "Slovaquie", capital: "Bratislava", lat: 48.1486, lon: 17.1077 },
  { country: "Slovenie", capital: "Ljubljana", lat: 46.0569, lon: 14.5058 },
  { country: "Espagne", capital: "Madrid", lat: 40.4168, lon: -3.7038 },
  { country: "Suede", capital: "Stockholm", lat: 59.3293, lon: 18.0686 },
  { country: "Suisse", capital: "Berne", lat: 46.9480, lon: 7.4474 },
  { country: "Ukraine", capital: "Kiev", lat: 50.4501, lon: 30.5234 },
  { country: "Royaume-Uni", capital: "Londres", lat: 51.5074, lon: -0.1278 },
  { country: "Vatican", capital: "Vatican", lat: 41.9029, lon: 12.4534 }
];
