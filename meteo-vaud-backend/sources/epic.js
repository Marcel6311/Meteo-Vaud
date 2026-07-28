// sources/epic.js
//
// NASA EPIC/DSCOVR - photos de la Terre entiere depuis 1,5 million de km
// (point de Lagrange L1). L'API EPIC ne supporte pas CORS (confirme par
// un rapport officiel NASA : github.com/nasa/api-docs/issues/100), donc
// impossible de l'appeler directement depuis le navigateur - on passe
// par le backend, exactement comme pour Azure Maps.
//
// Les images elles-memes (PNG statiques) restent chargees directement
// depuis les serveurs NASA cote frontend (une balise <img> classique
// n'est pas soumise a la meme restriction CORS qu'un fetch() de donnees).

const fetch = require("node-fetch");

const EPIC_API_KEY = "DEMO_KEY"; // cle publique de demonstration NASA (30/h, 50/jour) - remplacable par une cle personnelle gratuite via api.nasa.gov si besoin

/**
 * Recupere la liste des images EPIC "vraies couleurs" disponibles pour
 * la journee la plus recente, et construit l'URL complete de chaque
 * image (le serveur EPIC exige year/month/day dans le chemin, pas
 * seulement dans la reponse JSON brute).
 */
async function fetchEpicFrames() {
  const url = "https://epic.gsfc.nasa.gov/api/natural/images?api_key=" + EPIC_API_KEY;
  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();

  if (!data || data.length === 0) throw new Error("Aucune image EPIC disponible");

  return data.map((item) => {
    const datePart = item.date.split(" ")[0]; // "2026-07-28 00:31:12" -> "2026-07-28"
    const [year, month, day] = datePart.split("-");
    return {
      date: item.date,
      url: "https://epic.gsfc.nasa.gov/archive/natural/" + year + "/" + month + "/" + day +
        "/png/" + item.image + ".png"
    };
  });
}

module.exports = { fetchEpicFrames };
