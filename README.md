# 🏰 Manor Lords Pixel — « Seigneurie »

### 🎮 Modes de jeu (5) et difficultés (3)
Au démarrage, choisissez : **Prospérité** (sans combat), **Restaurer la paix**, **Au bord du gouffre**, **Duel** (Baron agressif), **Royaume fracturé** (défi ultime), chacun en Paisible / Normal / Difficile. Victoire et défaite avec écran récapitulatif. **3 slots de sauvegarde** sur l'appareil. — « Seigneurie »

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

Vous arrivez en mars 1176 avec trois familles. Bûcherons, cueilleuses, chasseurs, agriculture, marché, moulin… Gardez vos foyers nourris (avec de la **variété**), chauffés (l'hiver double la consommation !) et logés pour faire grimper l'approbation, attirer de nouveaux colons et faire évoluer vos bourgages. Les bourgages se dotent d'agrandissements de cour : potager, basse-cour, verger (récolte d'automne), rucher, et au niveau 2 atelier du tailleur (vêtements) et brasserie (ale, utile l'hiver). Champs de taille variable (3x3, 4x4, 6x6) avec rotation blé / orge / jachère, et bœufs ache tables (20 deniers) pour accélérer le labour. Tracez des <b>routes</b> (bouton ✈️) : les travailleurs les empruntent en priorité. Le <b>comptoir commercial</b> vend automatiquement vos surplus chaque mois à des prix qui fluctuent, et alimente la <b>richesse régionale</b> (💰) en plus de votre trésorerie. Le roi exigera son impôt en novembre, des brigands rôdent en mai. Le domaine compte <b>3 régions</b> : réclamez les Marches de l'Est et les Hautes Terres (30 deniers + 15 richesse) pour leurs bonus. À partir de 1177, le <b>Baron von Graufeld</b> réclame des régions et lance des raids de tribut ; des <b>camps de brigands</b> s'installent et pillent vos réserves — détruisez-les avec la <b>milice</b> (1 soldat pour 2 familles, bouton 🛡️). Defendez-vous avec une <b>tour de guet</b> (+4 approbation, raids amoindris) et des <b>remparts</b>. Peste, incendie et hivers précoces peuvent frapper. Le <b>manoir</b> publie des <b>décrets</b> (dime, marchés libres, service militaire). L'<b>église</b> s'améliore (autel, clocher) et fait monter l'<b>influence</b> ⭐. La seigneurie progresse de hameau à <b>ville</b> selon sa population. Louez des <b>mercenaaires</b> (25 deniers, 6 mois) pour compléter la milice. Objectifs à remplir en haut à gauche ; la victoire couronne une seigneurie prospère.

## 🛠️ Structure du projet

- `index.html` — la page (interface, styles, disposition).
- `js/sim.js` — la simulation (économie, familles, événements, sauvegarde).
- `js/render.js` — le rendu pixel-art sur canvas (carte, bâtiments, minimap).
- `js/app.js` — l'application mobile (entrées tactiles, interface, boucle de jeu).
- `test/sim.test.js` — tests automatisés de la simulation : `node test/sim.test.js`.

Le tout est du JavaScript lisible sans aucune bibliothèque. Développé avec l'agent Vibe ; la même simulation existe aussi en version React monofichier.

Amusez-vous bien ! 🏰
