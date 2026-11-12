# Roadmap — Seigneurie (Manor Lords Pixel)

Ce document fixe **l'objectif final du jeu** et le chemin pour y arriver. On le met à jour à chaque étape livrée.
Le détail technique et l'historique (audit, anciennes phases 0 à 7) restent dans [`docs/PLAN.md`](docs/PLAN.md).

---

## 1. Le jeu visé

**Un jeu de gestion médiévale en pixel-art, sur téléphone, 100 % hors-ligne, où l'on fait grandir une dynastie : d'un simple châtelain au service d'un suzerain jusqu'à la couronne.**

- **Le cœur** : ton domaine, géré dans le moindre détail. Agriculture, élevage, nourriture, villageois, taxes, lois. C'est là qu'on passe l'essentiel du temps.
- **L'ascension** : tu commences vassal d'un baron, avec des obligations envers lui. En prospérant, tu deviens baron, comte, duc, roi, voire empereur, et c'est toi qui as des vassaux.
- **La dynastie** : ton seigneur vieillit et meurt ; son héritier reprend. Les lois de succession peuvent diviser tes terres entre plusieurs enfants. La partie continue tant que ta lignée tient.

### Inspirations

| Jeu | Ce qu'on lui prend |
|---|---|
| **Manor Lords** | La magie automatique et visuelle : maisons qui épousent la zone tracée (jardin, clôture, forme de la maison), bâtiments qui se construisent étape par étape, villageois qui travaillent sous nos yeux. |
| **Medieval Dynasty** | Le plaisir de partir de peu et de bâtir son village pas à pas, l'agriculture et l'élevage au cœur du jeu, les villageois comme individus. |
| **Crusader Kings** | La dynastie, les titres, les vassaux avec leur opinion et leurs ambitions, les lois de succession, les rébellions. |

### Les piliers

| Pilier | Concrètement |
|---|---|
| **Les détails qui rendent accro** | Chaque petite décision a des conséquences visibles plus tard : un champ mal entretenu, un forgeron sans apprenti, un hiver mal anticipé, une loi impopulaire. |
| **Agriculture et élevage en profondeur** | Cultures, rotation, fertilité, fumier, météo, bétail qui se reproduit, pâturages, fourrage d'hiver, produits (lait, laine, viande, cuir). |
| **Administration** | Plusieurs taxes, lois et décrets, justice, gestion du personnel, livre de comptes. |
| **Pixel-art soigné et automatique** | Tout est dessiné en pixels nets ; le jeu met en forme seul ce que le joueur trace (parcelles, clôtures, chantiers). |
| **Mobile et local** | Jouable d'une main, sauvegarde à tout moment, aucun serveur. À terme, une APK Android. |
| **Fun avant tout** | Une mécanique réaliste mais ennuyeuse est simplifiée ou retirée. |

---

## 2. Les grands systèmes

### 2.1 Le domaine (le cœur, très détaillé)

- **Villageois individuels** : nom, âge, famille, compétences qui progressent, santé, humeur. Naissances, mariages, vieillesse, décès. Apprentissage : un artisan âgé doit former un successeur.
- **Logements automatiques** : on trace une zone le long d'une route, le jeu découpe les parcelles, dessine la maison, le jardin et la clôture adaptés à la forme. Les cours s'équipent (potager, poulailler, ruches, verger, atelier).
- **Agriculture** : champs tracés librement, plusieurs cultures (blé, orge, seigle, avoine, lin, légumes), rotation et jachère, fertilité qui varie, fumier issu du bétail, labour avec bœufs ou chevaux, semailles, moisson, battage, météo qui menace les récoltes.
- **Élevage** : vaches, moutons, cochons, poules, bœufs, chevaux. Reproduction, pâturages, enclos, fourrage à stocker pour l'hiver, maladies. Produits : lait, fromage, laine, viande, cuir, œufs.
- **Nourriture** : chaînes de transformation (grain → farine → pain, lait → fromage, orge → bière), conservation (fumage, salaison, grenier), pourrissement, variété des repas.
- **Construction visible** : chaque chantier passe par des étapes (fondations, charpente, murs, toit), matériaux livrés sur place.

### 2.2 L'administration

- **Taxes** : impôt par foyer, dîme, péages du marché, corvées (jours de travail dus au seigneur). Chacune a ses effets sur l'humeur et le trésor.
- **Lois et décrets** : droit de chasse, droits de pâture, rations en temps de disette, conscription, lois de succession.
- **Justice** : litiges entre villageois (bornage, vol de bétail, dettes) à trancher, avec un effet sur la réputation.
- **Personnel** : intendant, bailli, prêtre, maître d'armes, avec leurs compétences ; affectation des familles aux métiers.
- **Comptes** : livre des recettes et dépenses, prévisions pour l'hiver.

### 2.3 Le suzerain, les titres et les vassaux

- **Au départ, tu es vassal** : ton suzerain exige une part des récoltes, des soldats en temps de guerre, des faveurs. Le satisfaire rapporte des titres et des terres ; le décevoir coûte cher.
- **Échelle des titres** : châtelain → baron → comte → duc → roi → empereur. Chaque titre débloque des lois, des bâtiments et des droits.
- **Tes vassaux** : chacun a un caractère, une ambition et une **opinion de toi**. Tu peux leur demander des impôts, des troupes, des travaux sur leurs terres (un moulin, une route, plus de blé) qui finissent par te profiter.
- **Opinion et rébellions** : demandes trop lourdes, lois impopulaires, défaites militaires font baisser l'opinion. Un vassal mécontent intrigue, refuse d'obéir, s'allie à tes ennemis ou se révolte.
- **Les terres des vassaux ne se gèrent pas case par case** : elles apparaissent sur une carte du royaume, avec des fiches. Seul ton domaine personnel est géré en détail, ce qui garde le jeu jouable sur téléphone.

### 2.4 La dynastie

- Ton seigneur a un âge, une santé, des traits. Il se marie, a des enfants qu'il faut éduquer.
- **Lois de succession** : partage entre les enfants, primogéniture, élection. Avec le partage, les terres sont divisées ; tu continues avec l'héritier principal, et les autres deviennent des alliés ou des rivaux.
- **Fin de partie** : ta lignée s'éteint, ou tu atteins la couronne que tu visais. Une nouvelle partie démarre avec une autre dynastie.
- Ce système répond au dilemme « sans fin ou parties courtes » : la partie peut durer très longtemps, mais elle a des moments charnières (successions) et une vraie fin possible. Perdre une terre devient une histoire (« mon frère a hérité du comté et m'a trahi ») plutôt qu'une simple punition.

### 2.5 La guerre

- Levée de la milice parmi les villageois (moins de bras aux champs pendant ce temps), troupes fournies par les vassaux, mercenaires.
- Équipement à produire, moral, sièges simplifiés.
- Combats lisibles sur téléphone : quelques escouades, pas des centaines d'unités.

---

## 3. Où en est le jeu (novembre 2026)

| Domaine | État |
|---|---|
| Rendu pixel-art | ✅ Étape 1 : sprites dessinés par le code, saisons, météo, animations. |
| Interface mobile | ✅ Étape 2 : barre compacte, construction par catégories, panneaux en bas d'écran. |
| Maisons et chantiers | ✅ Étape 3 : zones tracées point par point, parcelles, jardins et clôtures, chantiers en quatre étapes, départ au campement. |
| Villageois | ✅ Étape 4 : chaque habitant a un prénom, un âge, une santé, une humeur et un savoir-faire ; un métier par adulte, apprentis, mariages, naissances, vieillesse, décès. |
| Agriculture et élevage | ✅ Étape 5 : 8 cultures et leur calendrier, fumure, labour, semailles, moisson en gerbes, battage, rotation, météo, prévision de récolte ; pâturages tracés, moutons, vaches, porcs, foin d'hiver, maladies, bœufs de trait. |
| Simulation | 17 bâtiments, 8 cultures, 3 espèces de bétail, nourriture variée, routes, comptoir, 3 régions, un baron rival, brigands, milice, 5 modes, 3 difficultés. 129 tests. |
| Logistique, transformation, administration, vassaux, dynastie | ❌ À construire. |
| Équilibrage et fun | ❓ À vérifier en jouant sur téléphone. |
| Distribution | Page web uniquement. |

---

## 4. Les étapes

Chaque étape se termine par une **version jouable**. Le cœur du domaine passe en premier, parce que c'est là que le joueur passe le plus de temps : si gérer son village n'est pas déjà passionnant, les couches au-dessus ne le sauveront pas.

### Bloc A — Le domaine vivant

**Étape 3 — Maisons automatiques et chantiers visibles** ✅
Tracé d'une zone le long d'une route → découpe en parcelles, maison, jardin et clôture adaptés à la forme. Chantiers en plusieurs étapes visibles (fondations, charpente, murs, toit). Extensions de cour posées dans la cour.

**Étape 4 — Villageois individuels** ✅
Chaque villageois a un nom, un âge, des compétences, une santé et une humeur. Familles, naissances, vieillesse, décès. Affectation aux métiers, progression des compétences, apprentissage.

**Étape 5 — Agriculture et élevage approfondis** ✅
Nouvelles cultures, rotation, fumier, labour, battage, météo. Bétail avec reproduction, pâturages, enclos, fourrage d'hiver, maladies, produits animaux.

**Étape 5 ter — Un rythme à contempler** ✅
Un mois dure environ 5 minutes à vitesse ×1 (une année : 1 heure), pour prendre son temps et regarder labourer. Vitesses pause / ×1 / ×4 / ×16 / ×60 pour faire défiler le temps. Les villageois marchent à la même allure ; leur ouvrage et leurs pauses sont étalés pour que l'économie par mois reste celle d'avant.

**Étape 5 bis — Logistique et chantiers livrés**
Les matériaux ne sortent plus du stock par magie : le chantier réclame son bois et sa pierre, des porteurs et l'attelage de bœufs les amènent depuis le camp ou l'entrepôt, et la construction ne progresse qu'une fois la livraison arrivée (troncs traînés sur la carte, tas déposés au pied du chantier). Entrepôts, trajets réels, priorité des livraisons. Placée ici parce que le bœuf et le bétail ont alors un vrai rôle (étape 5) et avant les chaînes de transformation (étape 6), qui se brancheront directement sur ces transports au lieu d'être reprises. Numéros des étapes suivantes inchangés.

**Étape 6 — Nourriture et transformation**
Moulin, boulangerie, laiterie, brasserie, fumoir. Conservation, pourrissement, variété des repas, disettes.

**Étape 7 — Administration**
Taxes multiples, corvées, lois et décrets, justice, personnel (intendant, bailli…), livre de comptes.

**Étape 8 — Premier passage d'équilibrage et de fun**
Pas de nouvelle mécanique. Parties tests sur téléphone, simulateur qui joue des centaines de parties, tutoriel par objectifs, info-bulles qui expliquent les causes, trois difficultés vraiment différentes.

### Bloc B — Le seigneur et son monde

**Étape 9 — Le suzerain**
Tu es vassal : obligations (part des récoltes, soldats, faveurs), réputation auprès du suzerain, récompenses et sanctions, premier titre à gagner (baron).

**Étape 10 — La dynastie**
Ton personnage : âge, traits, mariage, enfants, éducation. Mort et succession, lois de succession, partage des terres.

**Étape 11 — Titres et vassaux**
Carte du royaume, échelle des titres jusqu'à roi puis empereur, vassaux avec opinion et ambitions, ordres à leur donner, intrigues et rébellions.

**Étape 12 — La guerre**
Milice, troupes des vassaux, mercenaires, équipement, moral, sièges simplifiés.

**Étape 13 — Second passage d'équilibrage**
Sur l'ensemble : rythme de l'ascension, difficulté des successions, fréquence des rébellions, durée d'une partie.

### Bloc C — Le jeu fini

**Étape 14 — Rejouabilité** : cartes générées variées, dynasties de départ différentes, objectifs et succès, statistiques de fin de partie.

**Étape 15 — Application installable** : PWA (installation depuis le navigateur, jeu hors-ligne), sauvegardes robustes (IndexedDB, export en fichier), puis **APK Android** (TWA ou Capacitor). Les outils de construction de l'APK servent uniquement à l'emballage : le jeu reste en HTML/JS pur.

**Étape 16 — Finitions** : musique et ambiances par saison, animations supplémentaires, accessibilité, optimisation pour les téléphones modestes.

---

## 5. Comment on juge que c'est « fun »

1. **Toujours quelque chose à faire** : jamais plus d'une minute (en ×1) sans décision intéressante ou évolution visible.
2. **Les détails comptent** : une petite négligence a une conséquence que le joueur peut retrouver et comprendre.
3. **Les échecs sont compréhensibles** : le jeu montre pourquoi ça va mal, et on peut s'en relever.
4. **Plusieurs stratégies gagnent** : aucune construction ni aucun ordre de construction n'est obligatoire.
5. **On a envie de continuer** : chaque succession ou chaque nouveau titre donne envie de voir la suite.
6. **Ça se joue d'une main** : aucune action importante ne demande deux mains ou de la précision au pixel.

---

## 6. Règles qui ne changent pas

- **Zéro dépendance dans le jeu** : HTML, CSS et JavaScript purs, aucun fichier image externe.
- **Simulation séparée du rendu** et couverte par des tests (`node test/sim.test.js`).
- **Les sauvegardes existantes restent lisibles**, ou sont converties, à chaque nouvelle version.
- **Une étape = une branche + une pull request**, avec captures d'écran et tests qui passent.
- Ce document est mis à jour à la fin de chaque étape.
