# Roadmap — Seigneurie (Manor Lords Pixel)

Ce document fixe **l'objectif final du jeu** et le chemin pour y arriver. Il sert de boussole : chaque étape doit rapprocher du jeu visé, et on le met à jour à chaque étape livrée.

Le détail technique et l'historique (audit, anciennes phases 0 à 7) restent dans [`docs/PLAN.md`](docs/PLAN.md).

---

## 1. Le jeu visé

**Un Manor Lords en pixel-art, jouable sur téléphone, entièrement hors-ligne.**

On fonde un village médiéval à partir de quelques familles et on le fait grandir saison après saison jusqu'à une ville prospère et défendue. Les familles doivent être logées, nourries, chauffées et habillées. Un réseau de production et de commerce se met en place, puis vient la rivalité avec un baron voisin pour le contrôle des régions.

### Les six piliers

| Pilier | Ce que ça veut dire concrètement |
|---|---|
| **Pixel-art soigné** | Tout est dessiné en pixels nets, cohérents, vivants (saisons, météo, villageois au travail). Aucun visuel « placeholder ». |
| **Mobile d'abord** | Jouable d'une main en portrait, boutons assez grands pour un pouce, parties courtes possibles (5 à 15 min) et sauvegarde à tout moment. |
| **100 % local** | Aucun serveur, aucun compte, aucune connexion requise. Sauvegardes sur l'appareil, exportables. À terme, une **APK Android** installable. |
| **Gameplay profond** | Des chaînes de production, une logistique qui compte, des décisions qui se répondent (impôts ↔ approbation, champs ↔ fertilité, armée ↔ main-d'œuvre). |
| **Difficultés réglables** | De « Paisible » (on construit tranquillement) à « Difficile » (chaque hiver est une menace), plus des scénarios aux règles différentes. |
| **Fun avant tout** | Chaque minute de jeu donne quelque chose à décider ou à regarder. Une mécanique qui n'est pas amusante est retravaillée ou retirée, même si elle est « réaliste ». |

### Ce qu'on garde de Manor Lords

- Les **bourgages en parcelles** le long des routes, avec une **arrière-cour** qui se spécialise (potager, poulailler, verger, ruches, ateliers).
- Les **familles** comme unité de main-d'œuvre : chaque famille employée quelque part n'est pas disponible ailleurs.
- **Approbation**, **trésor du seigneur** et **richesse régionale** comme trois ressources distinctes.
- La **logistique** : les biens sont transportés à pied, en charrette, par bœuf ; les distances comptent.
- Les **saisons** qui rythment tout : semailles, moisson, réserves pour l'hiver.
- Les **chaînes de production** (lin → toile → vêtements, peaux → cuir, minerai → outils, argile → tuiles…).
- Le **développement** du village par niveaux, qui débloque des bâtiments et des améliorations.
- La **dimension militaire** : milice tirée des familles, équipement à produire, brigands, baron rival, régions à réclamer.

### Ce qu'on adapte pour le mobile

- Moins de micro-gestion : réglages par bâtiment simples, files de production automatiques.
- Une carte plus petite mais dense, et plusieurs régions plutôt qu'une immense carte.
- Des combats lisibles (escouades, pas de centaines d'unités).
- Le temps accélérable (×1, ×2, ×4) et une pause qui permet de tout planifier.

---

## 2. Où en est le jeu (novembre 2026)

| Domaine | État |
|---|---|
| Simulation | Complète en version simple : 16 bâtiments, familles, nourriture variée, chauffage, champs avec fertilité, routes, comptoir, 3 régions, baron, brigands, milice, 5 modes, 3 difficultés, 3 sauvegardes. 66 tests. |
| Rendu | ✅ Étape 1 : moteur pixel-art (sprites dessinés par le code, saisons, météo, animations). |
| Interface mobile | ✅ Étape 2 : barre compacte, construction par catégories, panneaux en bas d'écran, icônes pixel-art. |
| Profondeur | ⚠️ Faible : peu de chaînes de production, logistique invisible, combat abstrait. |
| Équilibrage | ⚠️ Non revérifié depuis la refonte ; jamais testé en jouant réellement sur téléphone. |
| Fun | ❓ À mesurer : il faut jouer, noter ce qui ennuie et ce qui frustre. |
| Distribution | Page web uniquement. Pas encore installable hors-ligne ni en APK. |

---

## 3. Les étapes

Chaque étape doit se terminer par **une version jouable**. Les étapes 3 à 7 alternent volontairement « ajouter de la profondeur » et « vérifier que c'est amusant ».

### Étape 3 — Bourgages en parcelles
*La mécanique signature de Manor Lords.*
- Le joueur trace une parcelle le long d'une route ; elle se découpe en lots étroits (maison sur rue, cour derrière).
- Les extensions de cour sont **posées et visibles** dans la cour : potager, poulailler, verger, ruches, puis ateliers.
- Taille de cour qui compte : une grande cour permet plus d'extensions.
- Niveaux de bourgage 1 → 3 avec besoins croissants (nourriture variée, bois, vêtements, église, puits).

### Étape 4 — Logistique visible et stockage
*Les distances deviennent une vraie décision.*
- Les biens existent physiquement : tas devant les bâtiments, transport jusqu'à la grange ou l'entrepôt.
- Charrettes et bœufs pour les gros transports ; le chemin le plus court passe par les routes.
- Marché avec étals : les familles vont s'approvisionner, le placement du marché compte.
- Indicateurs clairs : « bois de chauffe insuffisant pour l'hiver », « marché trop loin ».

### Étape 5 — Chaînes de production et commerce
*L'économie qui fait tenir une partie longue.*
- Nouvelles chaînes : lin → toile → vêtements, peaux → cuir → chaussures, argile → tuiles (toits des bourgages niveau 3), minerai → fer → outils et armes, orge → malt → bière.
- Spécialisations par région (une région riche en argile, une autre en fer).
- Routes commerciales vers l'extérieur : importer ce qui manque, exporter les surplus, prix qui réagissent.
- Arbre de **points de développement** : chaque niveau de village débloque un choix (meilleurs champs, commerce, armée…).

### Étape 6 — Équilibrage et fun (premier passage)
*Jouer, mesurer, corriger. Pas de nouvelle mécanique.*
- Parties tests sur téléphone dans chaque mode et difficulté ; journal de ce qui ennuie, frustre ou paraît trop facile.
- Simulateur automatique qui joue des centaines de parties pour repérer les stratégies dominantes et les spirales de défaite injustes.
- Courbe de difficulté : les 10 premières minutes guidées, puis les vrais défis (premier hiver, premier raid).
- Tutoriel intégré par objectifs, et info-bulles qui expliquent *pourquoi* l'approbation baisse.
- Réglage des trois difficultés pour qu'elles soient vraiment différentes à jouer.

### Étape 7 — Guerre et territoires
*Le frisson tactique, sans micro-gestion.*
- Milice levée parmi les familles (moins de main-d'œuvre pendant ce temps), équipement à produire (lances, boucliers, armures).
- Escouades déplaçables sur la carte, formations simples, moral.
- Brigands avec camps à détruire, baron qui lance de vraies attaques, régions à défendre et à conquérir.
- Fortifications qui ont un effet réel sur les combats (murs, tours, palissade).

### Étape 8 — Rejouabilité et fin de partie
- Cartes générées avec des reliefs, rivières et ressources variés.
- Scénarios avec objectifs propres (survie, prospérité, conquête), victoire et défaite claires.
- Succès, statistiques de fin de partie, graphiques d'évolution du village.
- Deuxième passage d'équilibrage sur l'ensemble.

### Étape 9 — Application installable (PWA puis APK)
*Jouer hors-ligne comme une vraie application.*
- **PWA** : manifeste et service worker, le jeu s'installe depuis le navigateur et fonctionne sans réseau.
- Sauvegardes plus robustes (IndexedDB au lieu de localStorage), export et import en fichier.
- **APK Android** : emballage du jeu tel quel dans une application (TWA ou Capacitor). Les outils de construction de l'APK ne servent qu'à l'emballage ; le jeu lui-même reste en HTML/JS pur.
- Réglages : son, vibrations, taille du texte, économie de batterie (images par seconde réduites).

### Étape 10 — Finitions
- Musique et sons d'ambiance par saison.
- Animations supplémentaires (fêtes, incendies, marchés animés).
- Accessibilité : contrastes, daltonisme, texte agrandi partout.
- Optimisation pour les téléphones modestes.

---

## 4. Comment on juge que c'est « fun »

Avant de valider une étape, on vérifie :

1. **Toujours quelque chose à faire** : jamais plus d'une minute (en ×1) sans décision intéressante ou évolution visible.
2. **Les échecs sont compréhensibles** : quand ça va mal, le jeu montre pourquoi, et on peut s'en relever.
3. **Plusieurs stratégies gagnent** : aucune construction ou ordre de construction n'est obligatoire.
4. **On a envie de relancer** : une partie terminée donne envie d'essayer un autre mode, une autre carte ou une autre stratégie.
5. **Ça se joue d'une main** : aucune action importante ne demande deux mains ou de la précision au pixel.

---

## 5. Règles qui ne changent pas

- **Zéro dépendance dans le jeu** : HTML, CSS et JavaScript purs, aucun fichier image externe.
- **Simulation séparée du rendu** et couverte par des tests (`node test/sim.test.js`).
- **Les sauvegardes existantes restent lisibles** à chaque nouvelle version.
- **Une étape = une branche + une pull request**, avec captures d'écran et tests qui passent.
- Ce document est mis à jour à la fin de chaque étape.
