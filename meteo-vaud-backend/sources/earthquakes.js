// sources/earthquakes.js
//
// Recupere les seismes recents depuis deux sources complementaires :
//   - USGS (mondial) : flux GeoJSON pret a l'emploi, mis a jour en continu
//   - SED (Suisse, ETH Zurich) : service FDSN Event, format texte
//
// Les deux sont gratuits, sans cle API.

const https = require("https");
const http = require("http");

function httpGet(url) {
  var client = url.startsWith("https") ? https : http;
  return new Promise(function (resolve, reject) {
    client.get(url, function (res) {
      var data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        if (res.statusCode !== 200) {
          reject(new Error("HTTP " + res.statusCode + ": " + data.slice(0, 200)));
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
  retries = retries || 2;
  for (var attempt = 0; attempt <= retries; attempt++) {
    try {
      return await httpGet(url);
    } catch (err) {
      if (attempt === retries) throw err;
      console.log("[seismes] echec tentative " + (attempt + 1) + " — retry dans " + (delays[attempt] / 1000) + "s : " + err.message);
      await sleep(delays[attempt]);
    }
  }
}

// -------------------------------------------------------
// USGS - mondial, flux GeoJSON "toute la semaine, toutes magnitudes"
// -------------------------------------------------------

async function fetchUSGS() {
  var url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson";
  var raw = await httpGetWithRetry(url, 2);
  var data = JSON.parse(raw);

  if (!data.features) return [];

  return data.features.map(function (f) {
    var p = f.properties || {};
    var coords = (f.geometry && f.geometry.coordinates) || [null, null, null];
    return {
      id: "usgs_" + f.id,
      source: "USGS",
      mag: p.mag,
      place: p.place || "Lieu inconnu",
      lon: coords[0],
      lat: coords[1],
      depth_km: coords[2],
      time: p.time, // epoch ms
      url: p.url || null,
      tsunami: p.tsunami === 1
    };
  }).filter(function (q) {
    return q.mag !== null && q.lat !== null && q.lon !== null;
  });
}

// -------------------------------------------------------
// SED - Suisse, service FDSN Event (ETH Zurich), format texte
// -------------------------------------------------------
// Colonnes (format texte FDSN standard) :
// EventID|Time|Latitude|Longitude|Depth/km|Author|Catalog|Contributor|
// ContributorID|MagType|Magnitude|MagAuthor|EventLocationName

async function fetchSED() {
  var end = new Date();
  var start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 derniers jours

  var url = "http://arclink.ethz.ch/fdsnws/event/1/query?" +
    "starttime=" + start.toISOString().slice(0, 19) +
    "&endtime=" + end.toISOString().slice(0, 19) +
    "&format=text";

  var raw = await httpGetWithRetry(url, 2);
  var lines = raw.trim().split("\n");
  if (lines.length < 2) return []; // juste l'en-tete ou vide

  var quakes = [];
  for (var i = 1; i < lines.length; i++) {
    var cols = lines[i].split("|");
    if (cols.length < 13) continue;

    var lat = parseFloat(cols[2]);
    var lon = parseFloat(cols[3]);
    var depth = parseFloat(cols[4]);
    var mag = parseFloat(cols[10]);
    var timeStr = cols[1];
    var place = cols[12] || "Suisse";

    if (isNaN(lat) || isNaN(lon) || isNaN(mag)) continue;

    quakes.push({
      id: "sed_" + cols[0],
      source: "SED",
      mag: mag,
      place: place,
      lon: lon,
      lat: lat,
      depth_km: isNaN(depth) ? null : depth,
      time: Date.parse(timeStr) || null,
      url: "https://www.seismo.ethz.ch/en/earthquakes/switzerland/",
      tsunami: false
    });
  }

  return quakes;
}

async function fetchAllEarthquakes() {
  var usgs = [];
  var sed = [];

  try {
    usgs = await fetchUSGS();
    console.log("[seismes] USGS : " + usgs.length + " seismes");
  } catch (err) {
    console.error("[seismes] echec USGS :", err.message);
  }

  try {
    sed = await fetchSED();
    console.log("[seismes] SED : " + sed.length + " seismes");
  } catch (err) {
    console.error("[seismes] echec SED :", err.message);
  }

  // Deduplication grossiere : si un seisme suisse notable est deja dans USGS
  // (meme lieu/heure approximatifs), on garde les deux quand meme — les
  // magnitudes different parfois legerement entre agences, utile a comparer.
  var all = usgs.concat(sed);
  all.sort(function (a, b) { return (b.time || 0) - (a.time || 0); });

  return all;
}

module.exports = { fetchAllEarthquakes };
