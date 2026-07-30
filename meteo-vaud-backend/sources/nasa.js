// sources/nasa.js
//
// Acces aux API NASA Open :
//   - APOD : Astronomy Picture of the Day (photo astronomique du jour)
//   - NEO  : Near Earth Objects (asteroides proches de la Terre, 7 jours)
//
// La cle API est lue depuis la variable d'environnement NASA_API_KEY.
// Limite : 1000 requetes/heure (largement suffisant).
//
// Retry : 3 tentatives avec delai croissant (2s, 5s, 10s) en cas d'echec.
// Traduction : si ANTHROPIC_API_KEY est configuree, le titre et l'explication
// APOD sont traduits en francais via Claude. Sinon, texte original en anglais.

const https = require("https");

// -------------------------------------------------------
// HTTP avec retry
// -------------------------------------------------------

function httpGet(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      var data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        if (res.statusCode !== 200) {
          reject(new Error("NASA API HTTP " + res.statusCode + ": " + data.slice(0, 300)));
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

async function httpGetWithRetry(url, maxRetries) {
  var delays = [2000, 5000, 10000]; // 2s, 5s, 10s
  var retries = maxRetries || 3;

  for (var attempt = 0; attempt <= retries; attempt++) {
    try {
      return await httpGet(url);
    } catch (err) {
      if (attempt === retries) throw err;
      var delay = delays[attempt] || 10000;
      console.log("[nasa] echec tentative " + (attempt + 1) + "/" + (retries + 1) + " : " + err.message + " — retry dans " + (delay / 1000) + "s");
      await sleep(delay);
    }
  }
}

// -------------------------------------------------------
// Traduction via Claude (Anthropic API)
// -------------------------------------------------------
// Traduit un texte en francais. Si la cle ANTHROPIC_API_KEY
// n'est pas configuree, renvoie le texte original.

function httpPost(hostname, path, headers, body) {
  return new Promise(function (resolve, reject) {
    var options = {
      hostname: hostname,
      path: path,
      method: "POST",
      headers: headers
    };
    var req = https.request(options, function (res) {
      var data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        if (res.statusCode !== 200) {
          reject(new Error("Anthropic HTTP " + res.statusCode + ": " + data.slice(0, 300)));
        } else {
          resolve(data);
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function translateToFrench(title, explanation) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("[nasa] ANTHROPIC_API_KEY non configuree — texte APOD en anglais");
    return { title: title, explanation: explanation };
  }

  try {
    var body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: "Traduis en français le titre et le texte suivants (astronomie). " +
          "Réponds UNIQUEMENT au format JSON : {\"title\": \"...\", \"explanation\": \"...\"}. " +
          "Pas de markdown, pas de backticks, juste le JSON.\n\n" +
          "Titre: " + title + "\n\nTexte: " + explanation
      }]
    });

    var raw = await httpPost("api.anthropic.com", "/v1/messages", {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Length": Buffer.byteLength(body)
    }, body);

    var response = JSON.parse(raw);
    var text = response.content && response.content[0] && response.content[0].text;
    if (!text) throw new Error("Reponse vide");

    // Nettoyer d'eventuels backticks markdown
    text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    var translated = JSON.parse(text);

    console.log("[nasa] APOD traduit en francais : \"" + translated.title + "\"");
    return {
      title: translated.title || title,
      explanation: translated.explanation || explanation
    };
  } catch (err) {
    console.error("[nasa] echec traduction : " + err.message + " — texte original conserve");
    return { title: title, explanation: explanation };
  }
}

// -------------------------------------------------------
// APOD - Astronomy Picture of the Day
// -------------------------------------------------------

async function fetchApod() {
  var apiKey = process.env.NASA_API_KEY;
  if (!apiKey) throw new Error("NASA_API_KEY non configuree");

  var url = "https://api.nasa.gov/planetary/apod?api_key=" + apiKey;
  var raw = await httpGetWithRetry(url, 3);
  var data = JSON.parse(raw);

  // Traduire titre et explication en francais
  var translated = await translateToFrench(data.title || "", data.explanation || "");

  return {
    title: translated.title,
    title_original: data.title || "",
    explanation: translated.explanation,
    explanation_original: data.explanation || "",
    url: data.url || "",
    hdurl: data.hdurl || "",
    media_type: data.media_type || "image",
    date: data.date || "",
    copyright: data.copyright || null
  };
}

// -------------------------------------------------------
// NEO - Near Earth Objects (asteroides, 7 jours)
// -------------------------------------------------------

async function fetchNeo() {
  var apiKey = process.env.NASA_API_KEY;
  if (!apiKey) throw new Error("NASA_API_KEY non configuree");

  var today = new Date();
  var startDate = today.toISOString().slice(0, 10);
  var endDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  var url = "https://api.nasa.gov/neo/rest/v1/feed?start_date=" + startDate +
    "&end_date=" + endDate + "&api_key=" + apiKey;

  var raw = await httpGetWithRetry(url, 3);
  var data = JSON.parse(raw);

  var asteroids = [];
  var dates = Object.keys(data.near_earth_objects || {});

  dates.forEach(function (date) {
    data.near_earth_objects[date].forEach(function (neo) {
      var approach = neo.close_approach_data && neo.close_approach_data[0];
      if (!approach) return;

      asteroids.push({
        name: neo.name,
        id: neo.id,
        diameter_min_km: Math.round(neo.estimated_diameter.kilometers.estimated_diameter_min * 1000) / 1000,
        diameter_max_km: Math.round(neo.estimated_diameter.kilometers.estimated_diameter_max * 1000) / 1000,
        is_hazardous: neo.is_potentially_hazardous_asteroid,
        close_approach_date: approach.close_approach_date_full || approach.close_approach_date,
        velocity_kmh: Math.round(parseFloat(approach.relative_velocity.kilometers_per_hour)),
        miss_distance_km: Math.round(parseFloat(approach.miss_distance.kilometers)),
        miss_distance_lunar: Math.round(parseFloat(approach.miss_distance.lunar) * 10) / 10
      });
    });
  });

  // Trier par distance (les plus proches d'abord)
  asteroids.sort(function (a, b) { return a.miss_distance_km - b.miss_distance_km; });

  return asteroids;
}

module.exports = { fetchApod, fetchNeo };
