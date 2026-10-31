# 🏰 Manor Lords Pixel — « Seigneurie »

Un jeu de gestion médiévale en pixel-art, inspiré de Manor Lords. **Zéro dépendance, zéro serveur, zéro build** — du HTML/JS/CSS pur, jouable hors-ligne sur téléphone.

## 🎮 Jouer

- **En ligne (recommandé sur mobile)** : activez GitHub Pages (voir ci-dessous) puis ouvrez
  `https://c0ld3eneye.github.io/manor-lords-pixel/`
- **Hors-ligne** : bouton vert **Code → Download ZIP**, décompressez, puis ouvrez `index.html` dans n'importe quel navigateur (double-clic suffit).

## 📱 Installer comme une application

- **Android (Chrome)** : ouvrez l'URL → menu ⋮ → *Ajouter à l'écran d'accueil*.
- **iOS (Safari)** : ouvrez l'URL → bouton Partager → *Sur l'écran d'accueil*.

## 💾 Sauvegarde

- **Automatique** sur l'appareil, toutes les 5 secondes (stockage local du navigateur).
- **Code de sauvegarde** : le bouton 💾 génère un code copiable, transférable sur n'importe quel autre appareil via le bouton 📥. Pratique pour changer de téléphone ou de navigateur.

## 🕹️ Commandes

| Action | Mobile | Desktop |
|---|---|---|
| Déplacer la carte | glisser | glisser / ZQSD / WASD / flèches |
| Zoomer | pincer | molette |
| Recentrer | tap sur la minimap (bas droite) | clic sur la minimap |
| Vitesse | ⏸ ▶ ⏩ | Espace = pause, 1/2/3 |
| Annuler une pose | appui long | clic droit / Échap |

## 🧠 Le jeu

Vous arrivez en mars 1176 avec trois familles. Bûcherons, cueilleuses, chasseurs, agriculture, marché, moulin… Gardez vos foyers nourris (avec de la **variété**), chauffés (l'hiver double la consommation !) et logés pour faire grimper l'approbation, attirer de nouveaux colons et faire évoluer vos bourgages. Le roi exigera son impôt en novembre, des brigands rôdent en mai. Objectifs à remplir en haut à gauche ; la victoire couronne une seigneurie prospère.

## 🛠️ Structure du projet

- `index.html` — la page (interface, styles, disposition).
- `js/sim.js` — la simulation (économie, familles, événements, sauvegarde).
- `js/render.js` — le rendu pixel-art sur canvas (carte, bâtiments, minimap).
- `js/app.js` — l'application mobile (entrées tactiles, interface, boucle de jeu).
- `test/sim.test.js` — tests automatisés de la simulation : `node test/sim.test.js`.

Le tout est du JavaScript lisible sans aucune bibliothèque. Développé avec l'agent Vibe ; la même simulation existe aussi en version React monofichier.

Amusez-vous bien ! 🏰
