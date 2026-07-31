// sources/lightning.js
//
// Proxy WebSocket pour les eclairs Blitzortung.org.
//
// Le serveur se connecte a Blitzortung depuis Node.js (pas de probleme
// de certificat SSL cote serveur), maintient un buffer des eclairs
// recents (20 min), et relaye en temps reel aux clients frontend
// connectes via leur propre WebSocket.
//
// Architecture :
//   Blitzortung WS --> Node.js (ce module) --> clients navigateur
//
// Usage : appeler attachToServer(httpServer) au demarrage, apres app.listen().

const WebSocket = require("ws");

var BUFFER_MAX_AGE_MS = 20 * 60 * 1000; // 20 minutes
var CLEANUP_INTERVAL_MS = 30 * 1000;    // nettoyage buffer toutes les 30s
var RECONNECT_DELAY_MS = 5000;

// Serveurs Blitzortung (certains ont des certificats invalides, on ignore)
var BO_SERVERS = ["ws1", "ws3", "ws5", "ws7", "ws8"];

// Buffer des eclairs recents (partage entre tous les clients)
var strikeBuffer = [];

// Connexion a Blitzortung
var boWs = null;
var boConnected = false;
var boReconnectTimer = null;

// Serveur WebSocket pour les clients frontend
var wss = null;

function connectToBlitzortung() {
  var server = BO_SERVERS[Math.floor(Math.random() * BO_SERVERS.length)];
  var url = "wss://" + server + ".blitzortung.org:443/";

  console.log("[lightning] connexion a " + server + "...");

  try {
    boWs = new WebSocket(url, {
      rejectUnauthorized: false // ignore les certificats invalides cote serveur
    });
  } catch (err) {
    console.error("[lightning] echec creation WS :", err.message);
    scheduleReconnect();
    return;
  }

  boWs.on("open", function () {
    boConnected = true;
    console.log("[lightning] connecte a " + server);
    // S'abonner a l'Europe elargie
    boWs.send(JSON.stringify({ west: -25, east: 55, north: 72, south: 25 }));
  });

  boWs.on("message", function (raw) {
    try {
      var data = JSON.parse(raw.toString());
      if (data.lat === undefined || data.lon === undefined) return;

      var strike = {
        lat: data.lat,
        lon: data.lon,
        time: data.time ? Math.round(data.time / 1000000) : Date.now() // ns -> ms
      };

      // Ajouter au buffer
      strikeBuffer.push(strike);

      // Relayer a tous les clients connectes
      if (wss) {
        var msg = JSON.stringify(strike);
        wss.clients.forEach(function (client) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
          }
        });
      }
    } catch (e) {
      // Messages de controle Blitzortung, ignorer
    }
  });

  boWs.on("error", function (err) {
    console.error("[lightning] erreur WS :", err.message);
  });

  boWs.on("close", function () {
    boConnected = false;
    console.log("[lightning] deconnecte");
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (boReconnectTimer) return;
  boReconnectTimer = setTimeout(function () {
    boReconnectTimer = null;
    connectToBlitzortung();
  }, RECONNECT_DELAY_MS);
}

function cleanupBuffer() {
  var cutoff = Date.now() - BUFFER_MAX_AGE_MS;
  strikeBuffer = strikeBuffer.filter(function (s) { return s.time > cutoff; });
}

// Attacher le serveur WebSocket au serveur HTTP Express
function attachToServer(httpServer) {
  wss = new WebSocket.Server({ server: httpServer, path: "/lightning" });

  wss.on("connection", function (client) {
    console.log("[lightning] nouveau client (" + wss.clients.size + " connectes)");

    // Envoyer le buffer d'eclairs recents au nouveau client
    if (strikeBuffer.length > 0) {
      client.send(JSON.stringify({ type: "buffer", strikes: strikeBuffer }));
    }

    client.on("close", function () {
      console.log("[lightning] client deconnecte (" + wss.clients.size + " restants)");
    });
  });

  // Demarrer la connexion a Blitzortung
  connectToBlitzortung();

  // Nettoyage periodique du buffer
  setInterval(cleanupBuffer, CLEANUP_INTERVAL_MS);

  console.log("[lightning] proxy WebSocket pret sur /lightning");
}

module.exports = { attachToServer };
