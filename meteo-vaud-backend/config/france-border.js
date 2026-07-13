// config/france-border.js
//
// Couverture francaise elargie : grandes villes de toutes les regions
// metropolitaines, plus les villes frontalieres proches du Leman/Jura
// deja utiles comme "signal avance" de la meteo qui approche la Suisse
// romande (la plupart des perturbations arrivent d'ouest/sud-ouest).
//
// Meme structure que config/capitals.js : { country, capital, lat, lon }.
// Le nom du fichier est conserve tel quel pour eviter de casser
// l'import existant dans server.js (FRANCE_BORDER).

module.exports = [
  // --- Villes frontalieres (signal avance meteo Leman/Jura) ---
  { country: "France (Haute-Savoie)", capital: "Annemasse", lat: 46.1936, lon: 6.2358 },
  { country: "France (Haute-Savoie)", capital: "Thonon-les-Bains", lat: 46.3708, lon: 6.4794 },
  { country: "France (Haute-Savoie)", capital: "Evian-les-Bains", lat: 46.4010, lon: 6.5891 },
  { country: "France (Haute-Savoie)", capital: "Annecy", lat: 45.8992, lon: 6.1294 },
  { country: "France (Haute-Savoie)", capital: "Chamonix-Mont-Blanc", lat: 45.9237, lon: 6.8694 },
  { country: "France (Haute-Savoie)", capital: "Saint-Julien-en-Genevois", lat: 46.1444, lon: 6.0836 },
  { country: "France (Ain)", capital: "Gex", lat: 46.3339, lon: 6.0592 },
  { country: "France (Ain)", capital: "Divonne-les-Bains", lat: 46.3600, lon: 6.1372 },
  { country: "France (Ain)", capital: "Bourg-en-Bresse", lat: 46.2057, lon: 5.2255 },
  { country: "France (Doubs)", capital: "Pontarlier", lat: 46.9058, lon: 6.3552 },
  { country: "France (Doubs)", capital: "Besancon", lat: 47.2378, lon: 6.0241 },
  { country: "France (Savoie)", capital: "Chambery", lat: 45.5646, lon: 5.9178 },

  // --- Ile-de-France ---
  { country: "France (Ile-de-France)", capital: "Paris", lat: 48.8566, lon: 2.3522 },

  // --- Auvergne-Rhone-Alpes ---
  { country: "France (Auvergne-Rhone-Alpes)", capital: "Lyon", lat: 45.7640, lon: 4.8357 },
  { country: "France (Auvergne-Rhone-Alpes)", capital: "Grenoble", lat: 45.1885, lon: 5.7245 },
  { country: "France (Auvergne-Rhone-Alpes)", capital: "Clermont-Ferrand", lat: 45.7772, lon: 3.0870 },

  // --- Bourgogne-Franche-Comte ---
  { country: "France (Bourgogne-Franche-Comte)", capital: "Dijon", lat: 47.3220, lon: 5.0415 },

  // --- Bretagne ---
  { country: "France (Bretagne)", capital: "Rennes", lat: 48.1173, lon: -1.6778 },
  { country: "France (Bretagne)", capital: "Brest", lat: 48.3904, lon: -4.4861 },

  // --- Centre-Val de Loire ---
  { country: "France (Centre-Val de Loire)", capital: "Orleans", lat: 47.9029, lon: 1.9047 },
  { country: "France (Centre-Val de Loire)", capital: "Tours", lat: 47.3941, lon: 0.6848 },

  // --- Corse ---
  { country: "France (Corse)", capital: "Ajaccio", lat: 41.9192, lon: 8.7386 },
  { country: "France (Corse)", capital: "Bastia", lat: 42.6976, lon: 9.4509 },

  // --- Grand Est ---
  { country: "France (Grand Est)", capital: "Strasbourg", lat: 48.5734, lon: 7.7521 },
  { country: "France (Grand Est)", capital: "Reims", lat: 49.2583, lon: 4.0317 },
  { country: "France (Grand Est)", capital: "Metz", lat: 49.1193, lon: 6.1757 },
  { country: "France (Grand Est)", capital: "Nancy", lat: 48.6921, lon: 6.1844 },
  { country: "France (Grand Est)", capital: "Mulhouse", lat: 47.7508, lon: 7.3359 },

  // --- Hauts-de-France ---
  { country: "France (Hauts-de-France)", capital: "Lille", lat: 50.6292, lon: 3.0573 },
  { country: "France (Hauts-de-France)", capital: "Amiens", lat: 49.8941, lon: 2.2958 },

  // --- Normandie ---
  { country: "France (Normandie)", capital: "Rouen", lat: 49.4431, lon: 1.0993 },
  { country: "France (Normandie)", capital: "Caen", lat: 49.1829, lon: -0.3707 },

  // --- Nouvelle-Aquitaine ---
  { country: "France (Nouvelle-Aquitaine)", capital: "Bordeaux", lat: 44.8378, lon: -0.5792 },
  { country: "France (Nouvelle-Aquitaine)", capital: "Poitiers", lat: 46.5802, lon: 0.3404 },
  { country: "France (Nouvelle-Aquitaine)", capital: "Limoges", lat: 45.8336, lon: 1.2611 },
  { country: "France (Nouvelle-Aquitaine)", capital: "La Rochelle", lat: 46.1603, lon: -1.1511 },

  // --- Occitanie ---
  { country: "France (Occitanie)", capital: "Toulouse", lat: 43.6047, lon: 1.4442 },
  { country: "France (Occitanie)", capital: "Montpellier", lat: 43.6108, lon: 3.8767 },
  { country: "France (Occitanie)", capital: "Nimes", lat: 43.8367, lon: 4.3601 },
  { country: "France (Occitanie)", capital: "Perpignan", lat: 42.6887, lon: 2.8948 },

  // --- Pays de la Loire ---
  { country: "France (Pays de la Loire)", capital: "Nantes", lat: 47.2184, lon: -1.5536 },
  { country: "France (Pays de la Loire)", capital: "Angers", lat: 47.4784, lon: -0.5632 },
  { country: "France (Pays de la Loire)", capital: "Le Mans", lat: 48.0061, lon: 0.1996 },

  // --- Provence-Alpes-Cote d'Azur ---
  { country: "France (PACA)", capital: "Marseille", lat: 43.2965, lon: 5.3698 },
  { country: "France (PACA)", capital: "Nice", lat: 43.7102, lon: 7.2620 },
  { country: "France (PACA)", capital: "Toulon", lat: 43.1242, lon: 5.9280 },
  { country: "France (PACA)", capital: "Avignon", lat: 43.9493, lon: 4.8055 },
  { country: "France (PACA)", capital: "Aix-en-Provence", lat: 43.5297, lon: 5.4474 }
];
