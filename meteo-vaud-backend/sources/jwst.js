// sources/jwst.js
//
// Recupere les dernieres images publiees du telescope James Webb (JWST)
// via la NASA Image and Video Library (images-api.nasa.gov).
//
// Cette API est gratuite, sans cle, et donne acces aux belles images
// traitees et publiees par la NASA (pas les donnees brutes du telescope).
// On cherche les images les plus recentes taguees "james webb space telescope".
//
// Chaque image renvoyee contient : titre, description, date, URL de l'image,
// et URL de la vignette.

const https = require("https");

function httpGet(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      // Suivre les redirections (la NASA Image Library en fait parfois)
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

async function fetchJwstImages() {
  // Recherche les 20 images les plus recentes du JWST
  var url = "https://images-api.nasa.gov/search?q=james%20webb%20space%20telescope&media_type=image&page_size=20";
  var raw = await httpGetWithRetry(url, 3);
  var data = JSON.parse(raw);

  if (!data.collection || !data.collection.items) {
    throw new Error("Format de reponse inattendu de la NASA Image Library");
  }

  var images = [];

  for (var i = 0; i < data.collection.items.length; i++) {
    var item = data.collection.items[i];
    var meta = item.data && item.data[0];
    if (!meta) continue;

    // Trouver l'URL de la vignette (thumb) et de l'image moyenne
    var thumb = "";
    var imageUrl = "";
    if (item.links) {
      for (var j = 0; j < item.links.length; j++) {
        if (item.links[j].rel === "preview") {
          thumb = item.links[j].href || "";
        }
      }
    }

    // L'URL de l'image en taille moyenne est derivee du href de la collection
    // Format typique : https://images-assets.nasa.gov/image/{nasa_id}/{nasa_id}~medium.jpg
    if (meta.nasa_id) {
      imageUrl = "https://images-assets.nasa.gov/image/" + meta.nasa_id + "/" + meta.nasa_id + "~medium.jpg";
    }

    images.push({
      title: meta.title || "",
      description: (meta.description || "").slice(0, 500), // tronquer les longues descriptions
      date: meta.date_created ? meta.date_created.slice(0, 10) : "",
      nasa_id: meta.nasa_id || "",
      center: meta.center || "",
      thumb: thumb,
      image: imageUrl || thumb, // fallback sur la vignette si pas d'image moyenne
      keywords: (meta.keywords || []).slice(0, 8)
    });
  }

  console.log("[jwst] " + images.length + " images JWST recuperees");
  return images;
}

module.exports = { fetchJwstImages };
