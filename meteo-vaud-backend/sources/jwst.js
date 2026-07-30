// sources/jwst.js
//
// Recupere les plus belles images du telescope James Webb
// via le flux RSS Top 100 de esawebb.org (ESA/Webb).
//
// Ce sont les vraies images traitees et publiees (nebuleuses, galaxies,
// exoplanetes en couleur), pas les donnees brutes du MAST.
//
// Gratuit, sans cle API. Les images sont hebergees sur cdn.esawebb.org.
// Rafraichi toutes les 12h.

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
          reject(new Error("ESA Webb HTTP " + res.statusCode + ": " + data.slice(0, 300)));
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
      console.log("[jwst] echec tentative " + (attempt + 1) + " — retry dans " + (delays[attempt] / 1000) + "s");
      await sleep(delays[attempt]);
    }
  }
}

// Parse le flux RSS de esawebb.org pour extraire les images
function parseRss(xml) {
  var images = [];
  // Extraire chaque <item>
  var items = xml.split("<item>");
  // Le premier element est le header du channel, on le saute
  for (var i = 1; i < items.length; i++) {
    var item = items[i];

    var title = extractTag(item, "title");
    var link = extractTag(item, "link");
    var description = extractTag(item, "description");
    var pubDate = extractTag(item, "pubDate");

    // Extraire l'ID de l'image depuis le lien (ex: /images/weic2207a/ -> weic2207a)
    var imageId = "";
    var idMatch = link.match(/\/images\/([^\/]+)/);
    if (idMatch) imageId = idMatch[1];

    // Nettoyer la description (enlever HTML)
    description = description.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
    // Tronquer
    if (description.length > 400) description = description.slice(0, 400) + "…";

    // Construire les URLs d'images via le CDN ESA
    // Tailles disponibles : thumb350x, screen, news, wallpaper1, large
    if (imageId) {
      images.push({
        id: imageId,
        title: cleanHtml(title),
        description: description,
        date: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : "",
        link: link,
        thumb: "https://cdn.esawebb.org/archives/images/thumb350x/" + imageId + ".jpg",
        image: "https://cdn.esawebb.org/archives/images/screen/" + imageId + ".jpg",
        wallpaper: "https://cdn.esawebb.org/archives/images/wallpaper1/" + imageId + ".jpg"
      });
    }
  }

  return images;
}

function extractTag(xml, tag) {
  // Gere les CDATA et le contenu normal
  var regex = new RegExp("<" + tag + ">\\s*(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?\\s*</" + tag + ">", "s");
  var match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function cleanHtml(str) {
  return str.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim();
}

async function fetchJwstImages() {
  var url = "https://esawebb.org/images/feed/top100/";
  console.log("[jwst] chargement du flux ESA Webb Top 100...");
  var xml = await httpGetWithRetry(url, 3);
  var images = parseRss(xml);
  console.log("[jwst] " + images.length + " images ESA Webb recuperees");
  return images;
}

module.exports = { fetchJwstImages };
