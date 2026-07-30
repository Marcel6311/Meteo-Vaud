// sources/jwst.js
//
// Recupere les images du telescope James Webb via l'API jwstapi.com
// (donnees du MAST Archive du Space Telescope Science Institute).
//
// La cle API est lue depuis la variable d'environnement JWST_API_KEY.
// Header : X-API-KEY
//
// Endpoints utilises :
//   /all/type/jpg   — toutes les images JPG
//   /program/id/N   — images d'un programme specifique
//   /suffix/_thumb  — vignettes des observations

const https = require("https");

function jwstGet(path) {
  var apiKey = process.env.JWST_API_KEY;
  if (!apiKey) throw new Error("JWST_API_KEY non configuree");

  return new Promise(function (resolve, reject) {
    var options = {
      hostname: "api.jwstapi.com",
      path: path,
      method: "GET",
      headers: { "X-API-KEY": apiKey }
    };
    var req = https.request(options, function (res) {
      var data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        if (res.statusCode !== 200) {
          reject(new Error("JWST API HTTP " + res.statusCode + ": " + data.slice(0, 300)));
        } else {
          resolve(data);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function jwstGetWithRetry(path, retries) {
  var delays = [2000, 5000, 10000];
  retries = retries || 3;
  for (var attempt = 0; attempt <= retries; attempt++) {
    try {
      return await jwstGet(path);
    } catch (err) {
      if (attempt === retries) throw err;
      console.log("[jwst] echec tentative " + (attempt + 1) + " : " + err.message + " — retry dans " + (delays[attempt] / 1000) + "s");
      await sleep(delays[attempt]);
    }
  }
}

function parseJwstResponse(raw) {
  var data = JSON.parse(raw);
  if (!data || !data.body || !Array.isArray(data.body)) return [];
  return data.body;
}

// Recupere les images des programmes les plus visuels du JWST
// (Early Release Observations, commissioning, programmes publics connus)
async function fetchJwstImages() {
  // Programmes connus pour produire de belles images :
  // 2731-2734 : Early Release Observations (premieres images : Carina, Deep Field, etc.)
  // 1063 : Commissioning (premiers tests)
  // 2736 : Early Release Science
  var programs = [2731, 2732, 2733, 2734, 2736, 1063];

  var allImages = [];
  var seenIds = {};

  for (var i = 0; i < programs.length; i++) {
    try {
      var raw = await jwstGetWithRetry("/program/id/" + programs[i], 2);
      var items = parseJwstResponse(raw);

      // Ne garder que les JPG (pas les FITS/ECSV)
      items.forEach(function (item) {
        if (!item.id || !item.location) return;
        if (item.file_type !== "jpg") return;
        if (seenIds[item.id]) return;
        seenIds[item.id] = true;

        allImages.push({
          id: item.id,
          observation_id: item.observation_id || "",
          program: item.program,
          description: item.details ? item.details.description || "" : "",
          suffix: item.details ? item.details.suffix || "" : "",
          instruments: item.details && item.details.instruments
            ? item.details.instruments.map(function (inst) { return inst.instrument; })
            : [],
          location: item.location,
          thumbnail: item.thumbnail || item.location
        });
      });

      console.log("[jwst] programme " + programs[i] + " : " + items.filter(function (x) { return x.file_type === "jpg"; }).length + " JPG");
    } catch (err) {
      console.error("[jwst] echec programme " + programs[i] + " : " + err.message);
    }
  }

  // Trier : les _thumb d'abord (plus visuels), puis par id
  allImages.sort(function (a, b) {
    var aThumb = a.suffix === "_thumb" ? 0 : 1;
    var bThumb = b.suffix === "_thumb" ? 0 : 1;
    if (aThumb !== bThumb) return aThumb - bThumb;
    return b.id.localeCompare(a.id);
  });

  // Limiter
  allImages = allImages.slice(0, 60);

  console.log("[jwst] total : " + allImages.length + " images JWST (jwstapi.com)");
  return allImages;
}

// Recherche par programme ou texte libre dans les observations cachees
async function searchJwstByProgram(programId) {
  var raw = await jwstGetWithRetry("/program/id/" + programId, 2);
  var items = parseJwstResponse(raw);
  return items.filter(function (x) { return x.file_type === "jpg"; }).map(function (item) {
    return {
      id: item.id,
      observation_id: item.observation_id || "",
      program: item.program,
      description: item.details ? item.details.description || "" : "",
      suffix: item.details ? item.details.suffix || "" : "",
      location: item.location,
      thumbnail: item.thumbnail || item.location
    };
  });
}

module.exports = { fetchJwstImages, searchJwstByProgram };
