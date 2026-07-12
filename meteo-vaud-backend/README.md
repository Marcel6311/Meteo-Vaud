[README.md](https://github.com/user-attachments/files/29939271/README.md)
# Meteo-Vaud backend v1

Backend d'ingestion et de normalisation des donnees SwissMetNet (MeteoSwiss
Open Government Data) pour le projet Meteo-Vaud.

## Ce que fait ce backend

- Toutes les 10 minutes, telecharge `VQHA80.csv` (valeurs actuelles, toutes
  stations suisses confondues) publie par MeteoSwiss.
- Filtre sur les stations suivies (`config/stations.js`, Vaud + proches).
- Traduit les codes parametres cryptiques (`tre200s0`, `dkl010z0`, ...) en
  champs lisibles (`temperature`, `vent_direction`, ...).
- Expose ces donnees via une API REST simple, en JSON normalise.

## Installation locale

```bash
npm install
npm start
```

Le serveur demarre sur `http://localhost:3000` (ou `$PORT` si defini).

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /health` | Etat du service, derniere mise a jour, erreurs eventuelles |
| `GET /stations` | Metadonnees des stations suivies (nom, coordonnees, altitude) |
| `GET /stations/current` | Dernieres valeurs pour toutes les stations suivies |
| `GET /stations/:code` | Derniere valeur pour une station (ex: `/stations/PUY`) |

## Deploiement sur Render

1. Push ce dossier dans un repo GitHub (ex: `Marcel6311/Meteo-Vaud`).
2. Sur Render : New Web Service, connecter le repo.
3. **Root Directory** : `meteo-vaud-backend`
4. **Build Command** : `npm install`
5. **Start Command** : `npm start`
6. Deployer, puis verifier l'onglet Events jusqu'a "Live".
7. Tester : `https://<ton-service>.onrender.com/health`

## Licence des donnees

Les donnees proviennent de MeteoSwiss sous licence CC-BY. Toute utilisation
affichee (frontend, export, etc.) doit mentionner : **"Source: MeteoSwiss"**.

## Ajouter une station

Ajouter une entree dans `config/stations.js` avec le code 3 lettres officiel
(voir `ogd-smn_meta_stations.csv`), le nom, les coordonnees et l'altitude.
Aucune autre modification necessaire.

## Prochaines etapes (v2)

- `sources/netatmo.js` : source complementaire citoyenne, meme interface que
  `sources/swissmetnet.js`, alimentant le meme schema normalise
  (`normalize.js`) avec `fiabilite: "citoyenne"`.
- Endpoint de comparaison mesure reelle vs prevision modele (Open-Meteo /
  Aurora).
