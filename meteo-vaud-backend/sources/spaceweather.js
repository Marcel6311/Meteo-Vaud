// sources/spaceweather.js
//
// Recupere l'indice Kp planetaire (activite geomagnetique) via le NOAA
// SWPC. Gratuit, sans cle. Le Kp mesure les perturbations du champ
// magnetique terrestre sur une echelle 0-9, mis a jour toutes les 3h.
//
// A partir du Kp, on derive :
//   - le niveau de tempete geomagnetique (echelle G0 a G5 du NOAA)
//   - une estimation de visibilite des aurores boreales depuis la Suisse

const https = require("https");

function httpGet(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      var data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        if (res.statusCode !== 200) {
          reject(new Error("NOAA SWPC HTTP " + res.statusCode + ": " + data.slice(0, 200)));
        } else {
          resolve(data);
        }
      });
    }).on("error", reject);
  });
}

// Kp -> echelle G du NOAA (niveau de tempete geomagnetique)
function kpToGScale(kp) {
  if (kp >= 9) return { level: "G5", label: "Extrême" };
  if (kp >= 8) return { level: "G4", label: "Sévère" };
  if (kp >= 7) return { level: "G3", label: "Forte" };
  if (kp >= 6) return { level: "G2", label: "Modérée" };
  if (kp >= 5) return { level: "G1", label: "Mineure" };
  return { level: "G0", label: "Calme" };
}

// Estimation de visibilite des aurores depuis la Suisse (~46-47°N).
// A ces latitudes, il faut generalement un Kp tres eleve pour voir
// quoi que ce soit, et seulement dans des conditions ideales (ciel
// degage, sans pollution lumineuse, horizon nord degage).
function auroraVisibilitySwitzerland(kp) {
  if (kp >= 8) return "Possible, même en plaine si le ciel est dégagé — événement rare";
  if (kp >= 7) return "Possible depuis les hauteurs/Jura par ciel très clair — improbable mais pas exclu";
  if (kp >= 6) return "Peu probable depuis la Suisse, visible plus au nord (Scandinavie, Écosse)";
  return "Non visible depuis la Suisse à ce niveau";
}

async function fetchSpaceWeather() {
  var url = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
  var raw = await httpGet(url);
  var data = JSON.parse(raw);

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Format Kp inattendu (tableau vide)");
  }

  var last = data[data.length - 1];
  var kp = parseFloat(last.Kp);

  if (isNaN(kp)) throw new Error("Valeur Kp invalide : " + last.Kp);

  var gScale = kpToGScale(kp);

  // Historique des 24 dernieres periodes de 3h (3 jours), pour une eventuelle mini-courbe
  var history = data.slice(-24).map(function (d) {
    return { time: d.time_tag, kp: parseFloat(d.Kp) };
  });

  return {
    kp: kp,
    timeTag: last.time_tag,
    gScale: gScale.level,
    gScaleLabel: gScale.label,
    auroraSwitzerland: auroraVisibilitySwitzerland(kp),
    history: history
  };
}

module.exports = { fetchSpaceWeather };
