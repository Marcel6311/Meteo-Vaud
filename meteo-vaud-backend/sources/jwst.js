// sources/jwst.js
//
// Recupere les images scientifiques du telescope James Webb (JWST)
// via la NASA Image and Video Library (images-api.nasa.gov).
//
// On utilise des requetes ciblees sur les noms d'instruments (NIRCam, MIRI)
// et les types d'objets (nebula, galaxy, deep field) pour recuperer les
// vraies images scientifiques, pas les photos de construction du telescope.

const https = require("https");

function httpGet(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location).then(resolve).catch(reject);
      }
      var data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        if (res.statusCode !== 200) {
          reject(new Error("NASA Image Library HTTP " + res.statusCode + ": " + data.slice(0, 300)));
        } else {
          resolve(data);
        }
      });
    }).on("error", reject);
  });
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function httpGetWithRetry(url, retries) {
  var delays = [2000, 5000, 10000];
  retries = retries || 3;
  for (var attempt = 0; attempt <= retries; attempt++) {
    try {
      return await httpGet(url);
    } catch (err) {
      if (attempt === retries) throw err;
      console.log("[jwst] echec tentative " + (attempt + 1) + " : " + err.message + " — retry dans " + (delays[attempt] / 1000) + "s");
      await sleep(delays[attempt]);
    }
  }
}

function parseNasaImages(data) {
  if (!data.collection || !data.collection.items) return [];
  var images = [];
  var seenIds = {};

  for (var i = 0; i < data.collection.items.length; i++) {
    var item = data.collection.items[i];
    var meta = item.data && item.data[0];
    if (!meta || !meta.nasa_id) continue;
    if (seenIds[meta.nasa_id]) continue; // deduplication
    seenIds[meta.nasa_id] = true;

    var thumb = "";
    if (item.links) {
      for (var j = 0; j < item.links.length; j++) {
        if (item.links[j].rel === "preview") {
          thumb = item.links[j].href || "";
        }
      }
    }

    var imageUrl = "";
    if (meta.nasa_id) {
      imageUrl = "https://images-assets.nasa.gov/image/" + meta.nasa_id + "/" + meta.nasa_id + "~medium.jpg";
    }

    images.push({
      title: meta.title || "",
      description: (meta.description || "").slice(0, 500),
      date: meta.date_created ? meta.date_created.slice(0, 10) : "",
      nasa_id: meta.nasa_id,
      center: meta.center || "",
      thumb: thumb,
      image: imageUrl || thumb,
      keywords: (meta.keywords || []).slice(0, 8)
    });
  }

  return images;
}

async function fetchJwstImages() {
  // Requetes ciblees pour recuperer les VRAIES images scientifiques du Webb :
  // les noms d'instruments (NIRCam, MIRI) n'apparaissent que dans les images prises par le telescope
  var queries = [
    "NIRCam+nebula",
    "NIRCam+galaxy",
    "MIRI+webb",
    "webb+deep+field",
    "webb+NIRCam+cluster",
    "webb+pillars+creation"
  ];

  var allImages = [];
  var seenIds = {};

  for (var q = 0; q < queries.length; q++) {
    var url = "https://images-api.nasa.gov/search?q=" + queries[q] + "&media_type=image&page_size=8";
    try {
      var raw = await httpGetWithRetry(url, 2);
      var data = JSON.parse(raw);
      var images = parseNasaImages(data);
      // Deduplication inter-requetes
      images.forEach(function (img) {
        if (!seenIds[img.nasa_id]) {
          seenIds[img.nasa_id] = true;
          allImages.push(img);
        }
      });
      console.log("[jwst] requete \"" + queries[q] + "\" : " + images.length + " images");
    } catch (err) {
      console.error("[jwst] echec requete \"" + queries[q] + "\" : " + err.message);
    }
  }

  // Trier par date (plus recentes en premier)
  allImages.sort(function (a, b) { return b.date.localeCompare(a.date); });

  // Limiter a 20 images
  allImages = allImages.slice(0, 20);

  console.log("[jwst] total : " + allImages.length + " images scientifiques");
  return allImages;
}

module.exports = { fetchJwstImages };
