# Temps vécu — application web locale (FR)

Un espace doux, simple et inspirant pour ressentir l’équilibre de ses journées, sans jugement. L’application fonctionne localement (navigateur) et peut, en option, persister vos données dans un fichier `data.json` via un petit serveur Node sans dépendances.

## Objectif
- Observer la répartition de son temps (travail, création, repos, présence, etc.).
- Relier quantitatif et sensible (émotion, note libre).
- Garder un rituel léger, poétique et tactile.

## Fonctionnalités
- Saisie quotidienne: glisser des « galets de temps » sur des thèmes personnalisables.
- Galets: tailles configurables (ex: 15m, 30m, 1h), couleur du plateau et des galets dans les thèmes (séparées), contraste automatique.
- Notes & émotions: une émotion et une note libres par jour.
- Vue statistiques: donut doux + légende, filtres (7j, 30j, ce mois, tout).
- Navigation: boutons jour précédent/suivant et bandeau hebdomadaire (lun→dim).
- Avertissement 24h: reste/dépassement affiché.
- Radial slider: cercle par thème pour régler rapidement le total (épaisseur réglable).
- Thèmes: liste entièrement éditable (nom, couleur, icône) + réorganisation ▲/▼.
- Multi‑utilisateur: sélecteur en en‑tête (Seb/Soaz par défaut), données séparées.
- Export/Import JSON: sauvegarde/restauration manuelles.

## Lancer en local
Prérequis: Node.js ≥ 16 (aucune dépendance à installer).

- Démarrer le serveur local (sert les fichiers et persiste les données):
  - `node server.js`
  - Ouvrir: `http://localhost:3000`
- Ou, sans serveur: ouvrir directement `index.html` dans le navigateur.
  - Dans ce mode, tout est stocké en `localStorage` (Export/Import possibles). Le fichier `data.json` n’est pas utilisé.

## Persistance des données
- Avec serveur: les données sont écrites dans `data.json` à la racine du projet.
- Par utilisateur: thèmes, entrées (journées), tailles de galets, couleurs de galets (plateau + thèmes), épaisseur du cercle.
- API (simple):
  - `GET /api/ping` — disponibilité
  - `GET /api/load?user=<nom>` — charger les données d’un utilisateur
  - `POST /api/save` — sauvegarder `{ user, themes, entries, sizes, pebbleColorTray, pebbleColorChip, ringThickness }`

## Structure des fichiers
- `index.html` — structure de l’interface (Aujourd’hui / Statistiques / Thèmes)
- `styles.css` — styles doux (clair), contraste et mise en page
- `app.js` — logique (stockage, drag & drop, rendu, stats, serveur)
- `server.js` — mini serveur Node (statique + `/api/*`), persiste `data.json`
- `data.json` — fichier de données (ignoré par Git)

## Conseils d’utilisation
- Saisir votre journée depuis l’onglet Aujourd’hui (galets glissés sur les thèmes).
- Ajuster rapidement avec le cercle (glisser pour régler le total d’un thème).
- Personnaliser les thèmes (couleur/nom/emoji) et l’ordre dans l’onglet Thèmes.
- Ajuster les tailles de galets et l’épaisseur du cercle selon vos habitudes.
- Exporter régulièrement un JSON (et garder des sauvegardes si vous n’utilisez pas le serveur).

## Licence
Projet personnel; aucun en-tête de licence ajouté par défaut. Utilisation libre dans votre contexte local.

