# 🏰 Manor Lords Pixel — « Seigneurie »

### 🎮 Modes de jeu (5) et difficultés (3)
Au démarrage, choisissez : **Prospérité** (sans combat), **Restaurer la paix**, **Au bord du gouffre**, **Duel** (Baron agressif), **Royaume fracturé** (défi ultime), chacun en Paisible / Normal / Difficile. Victoire et défaite avec écran récapitulatif. **3 slots de sauvegarde** sur l'appareil.

Un jeu de gestion médiéval en pixel-art, inspiré de Manor Lords. **Zéro dépendance, zéro serveur, zéro build** — du HTML/JS/CSS pur, jouable hors-ligne sur téléphone.

✨ **Rendu pixel-art** (chaumières, maisons à colombages, église, moulin, forêts et champs qui changent avec les saisons), **météo dynamique** (pluie, neige, brouillard), fumées et drapeaux animés, **interface mobile** pensée pour une main (barre compacte, constructions par catégories, panneaux en feuille du bas), **sons procéduraux**, 3 tailles de texte.

📍 L'objectif final et les prochaines étapes sont décrits dans [ROADMAP.md](ROADMAP.md).

## 🎮 Jouer

- **En ligne (recommandé sur mobile)** : activez GitHub Pages (voir ci-dessous) puis ouvrez
  `https://c0ld3neye.github.io/Manor-Lords-pixel/`
- **Hors-ligne** : bouton vert **Code → Download ZIP**, décompressez, puis ouvrez `index.html` dans n'importe quel navigateur (double-clic suffit).

## 📱 Installer comme une application

- **Android (Chrome)** : ouvrez l'URL → menu ⋮ → *Ajouter à l'écran d'accueil*.
- **iOS (Safari)** : ouvrez l'URL → bouton Partager → *Sur l'écran d'accueil*.

## 💾 Sauvegarde

- **Automatique** sur l'appareil, toutes les 5 secondes (stockage local du navigateur).
- **3 emplacements** de sauvegarde, gérés depuis le menu principal (menu ☰ → *Menu principal*).
- **Code de sauvegarde** : menu ☰ → *Copier un code de sauvegarde*, puis *Charger un code* sur un autre appareil. Pratique pour changer de téléphone ou de navigateur.

## 🕹️ Commandes

| Action | Mobile | Desktop |
|---|---|---|
| Déplacer la carte | glisser | glisser / ZQSD / WASD / flèches |
| Zoomer | pincer | molette, + / − |
| Recentrer | toucher la minimap (en haut à droite) | clic sur la minimap |
| Construire | barre du bas → catégorie → bâtiment → toucher la carte | idem |
| Ouvrir un bâtiment | le toucher | clic |
| Vitesse | boutons pause et ×1 / ×2 / ×4 en haut | Espace = pause, 1/2/3 |
| Annuler (pose, route, panneau) | appui long ou bouton ✕ | clic droit / Échap |

### L'interface

- **En haut** : la date et la saison, le trésor, l'approbation, les habitants (touchez-les pour la liste ; pastille rouge = familles sans logis), puis la vitesse et le menu. Juste dessous, le **bandeau des réserves** ; touchez-le pour le détail avec la capacité de stockage. Touchez la date ou les chiffres pour la vue d'ensemble de la seigneurie.
- **En bas**, comme dans Manor Lords, les constructions sont rangées par catégories : *Maisons*, *Récolte*, *Terres*, *Stocks*, *Domaine*, *Défense*, *Routes*. Chaque catégorie ouvre un tiroir de cartes (miniature, coût, ouvriers nécessaires).
- **Sur la carte** : objectifs repliables et notifications discrètes en haut à gauche, minimap et calques (forêts, pierre, baies, fertilité) en haut à droite.
- Les panneaux s'ouvrent en **feuille du bas** sur téléphone et en panneau latéral sur grand écran. Toutes les icônes sont dessinées en pixel-art (plus d'emojis qui changent d'un téléphone à l'autre).

## 🧠 Le jeu

Vous arrivez en mars 1176 avec trois familles de survivants. Chaque villageois a un prénom, un âge, une santé, une humeur et un savoir-faire par métier : touchez-le sur la carte pour ouvrir sa fiche (pourquoi il est content ou non, son métier, sa famille). Chaque adulte a son propre poste ; le jeu embauche l'adulte libre le plus doué, et vous pouvez changer à la main. Les adolescents entrent en apprentissage auprès d'un maître ; les couples se marient, ont des enfants, vieillissent, prennent leur retraite à 65 ans. Bûcherons, cueilleuses, chasseurs, agriculture, marché, moulin… Gardez vos foyers nourris (avec de la **variété**), chauffés (l'hiver double la consommation !) et logés pour faire grimper l'approbation, attirer de nouveaux colons et faire évoluer vos bourgages. Les bourgages se dotent d'agrandissements de cour : potager, basse-cour, verger (récolte d'automne), rucher, et au niveau 2 atelier du tailleur (vêtements) et brasserie (ale, utile l'hiver). Les champs se tracent à la forme que vous voulez, comme les zones de maisons, et suivent les saisons : **blé d'hiver** et **seigle** semés à l'automne, **orge**, **avoine**, **lin**, **pois et fèves** au printemps, **pré de fauche** pour le foin, **jachère** ; les fermiers fument, labourent (plus vite avec un bœuf), sèment, moissonnent en **gerbes** et les battent l'hiver. La rotation, la fertilité et la météo (gel, sécheresse, grêle, été pourri) font le rendement, annoncé dans le panneau du champ. Tracez des **pâturages** pour des moutons (laine), des vaches (lait, fumier, futurs bœufs) ou des porcs (glandée en forêt) : un gardien les soigne, il leur faut du foin l'hiver, les maladies se propagent, et l'abattage de novembre ne garde que ce que vous pourrez nourrir. Tracez des <b>routes</b> (onglet Routes) : les travailleurs les empruntent en priorité. Le <b>comptoir commercial</b> vend automatiquement vos surplus chaque mois à des prix qui fluctuent, et alimente la <b>richesse régionale</b> (💰) en plus de votre trésorerie. Le roi exigera son impôt en novembre, des brigands rôdent en mai. Le domaine compte <b>3 régions</b> : réclamez les Marches de l'Ouest et les Hautes Terres (30 deniers + 15 richesse) pour leurs bonus. À partir de 1177, le <b>Baron von Graufeld</b> réclame des régions et lance des raids de tribut ; des <b>camps de brigands</b> s'installent et pillent vos réserves — détruisez-les avec la <b>milice</b> (1 soldat pour 2 familles, onglet Défense). Défendez-vous avec une <b>tour de guet</b> (+4 approbation, raids amoindris) et des <b>remparts</b>. Peste, incendie et hivers précoces peuvent frapper. Le <b>manoir</b> publie des <b>décrets</b> (dime, marchés libres, service militaire). L'<b>église</b> s'améliore (autel, clocher) et fait monter l'<b>influence</b> ⭐. La seigneurie progresse de hameau à <b>ville</b> selon sa population. Louez des <b>mercenaires</b> (25 deniers, 6 mois) pour compléter la milice. Objectifs à remplir en haut à gauche ; la victoire couronne une seigneurie prospère.

## 🛠️ Structure du projet

- `index.html` — la page (interface, styles, disposition).
- `js/sim.js` — la simulation (économie, villageois et familles, événements, sauvegarde).
- `js/sprites.js` — tous les sprites pixel-art, dessinés par le code au démarrage (aucun fichier image) puis rangés dans un atlas unique.
- `js/icons.js` — les icônes d'interface en pixel-art (12 × 12) et les miniatures de bâtiments tirées de l'atlas.
- `js/render.js` — le rendu : sol mis en cache, objets triés en profondeur, ombres, météo, minimap.
- `js/app.js` — l'application mobile (entrées tactiles, interface, boucle de jeu).
- `test/sim.test.js` — tests automatisés de la simulation : `node test/sim.test.js`.
- `dev/planche.html` — planche de tous les sprites (pratique pour retoucher le dessin).
- `dev/icones.html` — planche des icônes et des miniatures.

### Comment marche le rendu

La scène est dessinée dans un petit tampon à la résolution de l'art (1 tuile = 16 × 16 pixels), puis agrandie d'un facteur **entier** sans lissage : les pixels restent nets à tous les zooms et le téléphone a 4 à 16 fois moins de pixels à remplir. Le sol (herbe, eau, routes, lisières) est peint une fois et repeint seulement là où la carte change ; au changement de saison, il est repeint par bandes sur plusieurs images pour éviter tout à-coup. Le zoom avance donc par paliers.

Le tout est du JavaScript lisible sans aucune bibliothèque. Développé avec l'agent Vibe puis repris avec Claude ; la même simulation existe aussi en version React monofichier.

Amusez-vous bien ! 🏰
