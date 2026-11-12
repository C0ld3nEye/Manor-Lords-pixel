# 🏰 Manor Lords Pixel — Audit, comparaison & plan de développement

> Document de référence : audit du code actuel, comparaison avec Manor Lords (jeu officiel, Slavic Magic / Hooded Horse), et plan de développement en 7 phases, du plus fondamental au plus ambitieux.
> Contrainte conservée sur tout le plan : **zéro dépendance, HTML/JS pur, mobile-first, sauvegarde locale + code transposable**.

---

## 0. Refonte (novembre 2026)

Constat après la première version : le jeu était fonctionnel en simulation mais **visuellement trop pauvre** (bâtiments en rectangles, sol uni) et la page ne démarrait plus (frontmatter YAML dans `index.html`, fonction `menuHtml` mal placée). La refonte garde la simulation testée et refait ce que le joueur voit, par étapes.

| Étape | Contenu | État |
|---|---|---|
| 1 | **Moteur de rendu pixel-art** : sprites dessinés par le code (`js/sprites.js`), atlas unique, vue 3/4, 4 saisons, neige sur les toits, sol peint en cache (berges, routes à ornières, prairies, lisières), ombres, chantiers avec échafaudage, villageois animés avec outils et charges, fumées, drapeaux, météo, minimap ; rendu basse résolution agrandi par paliers entiers (pixels nets, léger sur mobile) | ✅ |
| 2 | **Interface mobile** : barre du haut sur 2 lignes (la carte passe d'environ 60 % à 84 % de l'écran), icônes pixel-art à la place des emojis (`js/icons.js`), dock de construction par catégories avec tiroir de cartes, panneaux en feuille du bas (bâtiment, réserves avec capacité, seigneurie, menu), objectifs repliables, notifications discrètes, minimap et calques en haut à droite, appui long pour annuler, mise à jour de l'interface sur place (un toucher n'est plus perdu quand un chiffre change), nouvel écran d'accueil (mode, difficulté, emplacement) ; correctif : le choix de taille des champs n'était jamais proposé | ✅ |
| 3 | **Maisons automatiques et chantiers visibles** : zones tracées point par point, parcelles, cours, clôtures, chantiers en étapes (détail en section 6) | ✅ |
| 4 | **Villageois individuels** : âge, santé, humeur, savoir-faire, un métier par adulte, apprentis, mariages, naissances, décès (détail en section 7) | ✅ |
| 5 | **Agriculture et élevage approfondis** : 8 cultures avec leur calendrier, travaux des champs en étapes, gerbes et battage, rotation, météo, fumier ; pâturages tracés, troupeaux (moutons, vaches, porcs), foin d'hiver, maladies, bœufs de trait (détail en section 8) | ✅ (PR à valider) |
| 5 bis et suite | Logistique et chantiers livrés, transformation, administration, suzerain, dynastie, vassaux… : voir [`ROADMAP.md`](../ROADMAP.md) | à faire |

Note : l'audit ci-dessous (sections 1 à 3) décrit l'état **avant** les phases 1 à 7 ; il est conservé comme historique.

---

## 1. Audit de l'application actuelle

### Architecture (~1 817 lignes, zéro dépendance)

| Fichier | Rôle | Lignes |
|---|---|---|
| `index.html` | Page + CSS inline + HUD | 132 |
| `js/sim.js` | Simulation pure (économie, familles, événements, sauvegarde) | 1 035 |
| `js/render.js` | Rendu pixel-art canvas (carte, bâtiments, travailleurs, minimap) | 377 |
| `js/app.js` | Entrées tactiles/clavier, UI, boucle de jeu, localStorage | 405 |

### Ce qui fonctionne déjà bien

- **Boucle économique de base** : 13 bâtiments (`BUILD_DEFS`, `js/sim.js:43`), ressources (timber, firewood, stone, grain, bread, baies, viande…), stockage avec capacité et pourrissement (grange/entrepôt).
- **Familles et besoins** : nourriture avec variété (marché requis pour plus d'un type), combustible doublé l'hiver, approbation dynamique, évolution des bourgages (niveaux 1→3, église requise au niveau 3).
- **Saisons et cycle agricole** : labour/semailles au printemps, moisson en septembre, rendement selon fertilité du sol, jachère.
- **Événements scriptés** : impôt du roi en novembre (`js/sim.js:932`), brigands en mai avec choix payer/piller (`js/sim.js:941`).
- **Objectifs + victoire** : bois, bonheur (streak ≥ 50 d'approbation), population ≥ 10, manoir (`js/sim.js:917-925`).
- **Mobile-first solide** : pinch, drag, minimap, sauvegardes auto + code base64 transposable, HUD compact.
- **Séparation sim/rendu propre** : la sim est testable et sérialisable indépendamment du canvas.

### Faiblesses identifiées

1. **Carte fixe et petite** : 46×34 tuiles (`js/sim.js:11-12`), une seule région, pas d'expansion territoriale.
2. **Pas de routes** : les travailleurs marchent en ligne droite ; pas de logistique ni de temps de trajet.
3. **Pas de commerce** : aucune route commerciale, import/export, prix dynamiques, ni richesse régionale.
4. **Pas de militaire** : brigands = simple popup à choix ; aucune levée de milice, unité, garnison, château/fortifications.
5. **Pas de hiérarchie territoriale** : pas de baron rival, pas de réclamations de régions, pas de conquête.
6. **Bourgages simplifiés** : pas de parcelles avec extensions de cour (poulailler, verger, jardin) — le cœur du jeu officiel.
7. **Pas de météo ni d'événements aléatoires riches** : sécheresse, peste, incendie, marchands itinérants absents.
8. **Construction peu réaliste** : bâtiments instantanés ou timer simple, pas de chantiers avec matériaux déposés, pas de bœufs.
9. **UI limitée** : pas de filtres de carte dédiés, pas de statistiques/graphiques, pas de journal d'événements.
10. **Carte procédurale basique** : un seul type de biome, pas de variété de cartes/scénarios ni de difficulté.
11. **Pas de tutoriel guidé, peu de rejouabilité** : objectif unique, pas de modes.

---

## 2. Comparaison avec Manor Lords (jeu officiel)

| Domaine | Manor Lords officiel | Manor Lords Pixel actuel | Écart |
|---|---|---|---|
| Construction | Sans grille, placement libre + rotation, chantiers réalistes avec matériaux | Grille fixe 1×1 à 4×4, timer de construction | ⚠️ Important |
| Parcelles résidentielles | **Burgage plots** avec extensions de cour (poulailler, verger, potager) produisant passivement | Bourgage = 1 bâtiment = 1 famille | 🔴 Majeur (mécanique signature absente) |
| Agriculture | Rotation triennale, bœufs, labour/semailles/moisson saisonniers, fertilité | Saisons + fertilité présentes, pas de rotation ni de bœufs | 🟡 Partiel |
| Économie | Chaînes d'approvisionnement multi-étapes (blé → moulin → pain), entrepôts logistiques | Chaînes 1 niveau (grain → pain) | 🟡 |
| Commerce | Routes commerciales, achat/vente, prix régionaux, richesse régionale | Aucun | 🔴 Majeur |
| Territoire | Plusieurs régions à réclamer, baron rival qui s'étend, influence | 1 région | 🔴 Majeur |
| Guerre | Combats tactiques temps réel, milice levée, mercenaires, châteaux/murailles | Événement brigand à choix binaire | 🔴 Majeur |
| Social | Approbation, taxes, dîme, niveaux de bourg, églises améliorables, politiques/décrets | Approbation + taxe + niveaux 1-3 | 🟡 |
| Événements | Aléatoires riches (marchands, bandits, maladies, météo) | 2 événements scriptés | 🟡 |
| Modes/campagne | 5 modes scénarisés, cartes variées, difficulté | Sandbox unique, carte procédurale simple | 🔴 |
| Météo | Dynamique (pluie, neige, brouillard) | Saisons seules (palette de couleurs) | 🟡 |

**En résumé** : le pixel conserve l'ADN (saisons, besoins, approbation, impôts, brigands) mais il manque les 4 piliers qui font la profondeur de l'officiel : **parcelles à extensions**, **commerce**, **multi-régions/conquête**, et **guerre**.

---

## 3. Plan de développement étape par étape

Chaque étape est livrable et testable seule. Ordre conseillé = du plus fondamental au plus ambitieux.

### 🧱 Phase 0 — Fondations & qualité (semaines 1-2)

1. **Tests automatisés de la sim** : harnais de test en Node (la sim est déjà pure) couvrant économie, saisons, sauvegarde/restauration.
2. **Journal d'événements (log)** + **graphiques d'historique** (population, approbation, trésorerie sur 12 mois).
3. **Filtres de carte (overlays)** : chasse, forêts, gisements, fertilité, rayon des bâtiments — un bouton par couche.
4. **Amélioration de la carte** : biomes variés (vallée, plateau, rivière), 3 tailles de carte + graines partageables, écran de sélection de scénario/difficulté.
5. **Tutoriel guidé** : objectifs contextuels en chaîne (poser X → nourrir → hiver → impôt).

### 🏘️ Phase 1 — Le cœur manoir : parcelles et extensions (semaines 3-6) ✅ extensions de cour livrées

6. **Système de burgage plots** : la parcelle devient l'unité résidentielle ; la maison se construit seule (chantier réaliste avec dépôt de matériaux).
7. **Extensions de cour** : poulailler (œufs), potager (légumes), verger (pommes), rucher (miel) — production passive selon la saison, améliorables.
8. **Artisans de cour** (niveaux 2/3) : tailleur, forgeron, brasseur produisant des biens de consommation (vêtements, outils, ale) qui boostent l'approbation et les taxes.
9. **Besoins enrichis** : vêtements, outils, mobilier en plus de nourriture/feu/logement, chacun avec impact sur l'approbation et le niveau de la maison.

### 🌾 Phase 2 — Agriculture réaliste (semaines 7-9) ✅ rotation blé/orge/jachère, bœufs, tailles variables livrés

10. **Rotation des cultures** : blé / orge / jachère avec épuisement et restauration de fertilité ; choix de la culture par champ.
11. **Bœufs et attelage** : achat de bœufs (coûteux), accélèrent labour et transport ; gestion d'écurie.
12. **Champs de taille variable** (voire forme libre) : rendement proportionnel à la surface labourée.

### 🛣️ Phase 3 — Routes, logistique, commerce (semaines 10-14) ✅ routes tracées + A* pondéré, comptoir avec prix fluctuants et richesse régionale livrés

13. **Routes tracées par le joueur** : les travailleurs empruntent le réseau ; temps de trajet réel, entrepôts intermédiaires, brouettes.
14. **Main-d'œuvre dynamique** : assignation manuelle des familles aux emplois, priorité des tâches par bâtiment.
15. **Commerce régional** : routes commerciales vers des marchés extérieurs (achat de bœufs, vente de surplus), prix fluctuants, **richesse régionale** vs **trésorerie du seigneur**.
16. **Nouvelles ressources et chaînes** : planches (scierie), charbon de bois, ale (brasserie), lin, outils, armes, chevaux.

### ⚔️ Phase 4 — Guerre, territoires et menaces (semaines 15-20) ✅ 3 régions + réclamation, Baron rival (réclamations + raids), milice + camps de brigands avec combats, tour/remparts, peste/incendie/hiver rude — 50 tests

17. **Carte multi-régions** : 3-6 régions adjacentes, réclamables (coût en trésorerie/influence) avec bonus de ressources par région.
18. **Baron rival (IA)** : il réclame des régions, fonde des colonies, progresse — il faut le devancer ou le combattre.
19. **Milice et levée** : chaque famille fournit un soldat ; unités (lanciers, archers, arbalétriers) avec morale, fatigue, équipement produit localement.
20. **Combats tactiques simplifiés** : déploiement sur la carte, formations, corps-à-corps, morale ; garnisons dans les manoirs.
21. **Fortifications** : murailles, tours, portes, château améliorable (défense contre les sièges).
22. **Menaces variées** : camps de brigands à détruire physiquement (récompense en deniers), raids, sièges du baron, hiver rude aléatoire, peste/incendie.

### 🏛️ Phase 5 — Profondeur sociale et progression (semaines 21-25) ✅ influence ⭐, 3 décrets du manoir, église améliorable (autel/clocher), niveaux hameau→ville, mercenaires louables — 59 tests

23. **Politiques/décrets du manoir** : 2-3 choix actifs (dîme vs taxes, service militaire, marchés libres) avec avantages/inconvénients.
24. **Église améliorable** : autel, clocher, école — bonus de foi, d'approbation, de santé.
25. **Niveaux de bourg** : village → bourg → ville avec débloquage de bâtiments (hôtel de ville, bains, auberge) et nouvelles taxes.
26. **Influence et prestige** : gagnés via brigands détruits, régions réclamées, églises — débloquent réclamations et mercenaires.
27. **Mercenaires** : unités louables à prix d'or contre brigands et baron.

### 🎮 Phase 6 — Modes, rejouabilité, fin de partie (semaines 26-30) ✅ 5 modes scénarisés, 3 difficultés, victoire/défaite + écran de fin, 3 slots de sauvegarde — 66 tests — Modes, rejouabilité, fin de partie (semaines 26-30)

28. **5 modes scénarisés** façon l'officiel : *Prospérité* (sans combat), *Restaurer la paix*, *Au bord du gouffre*, *Duel*, *Royaume fracturé*.
29. **Conditions de victoire/défaite par mode** + écran de fin avec statistiques (années, population max, richesse, pertes).
30. **Difficultés** (paisible / normal / difficile) + **carte aléatoire partageable par code**.
31. **Sauvegarde multiple** (3 slots) + export/import amélioré + reprise automatique.

### ✨ Phase 7 — Polissage final (semaines 31-34) ✅ météo dynamique + effets, jour/nuit + fumées/drapeaux animés, sons WebAudio procéduraux (M), accessibilité (+/− zoom, T taille texte), équilibrage (5/8 victoires, 0 défaites en test), défaite par famine 6 mois — 66 tests — PROJET TERMINÉ

32. **Météo dynamique** : pluie, neige, brouillard avec effets sur rendements et combats.
33. **Animations pixel-art** : travailleurs en action, fumée, drapeaux, jour/nuit, saisons visuelles sur les arbres.
34. **Sons et musique** (WebAudio procédural, zéro fichier externe) + option muet.
35. **Accessibilité & perfs** : support clavier complet, tailles de texte, pause, perf sur vieux mobiles.
36. **Équilibrage global** : courbe de difficulté testée sur 3 parties complètes par mode.
37. **README + page d'aide in-game** documentant chaque mécanique.

---

## 4. Ordre de priorité recommandé (si ressources limitées)

Impact maximal / effort minimal d'abord :

1. Burgage plots + extensions de cour (Phase 1) — la mécanique signature
2. Routes + commerce (Phase 3) — la profondeur économique
3. Multi-régions + baron (Phase 4, début) — la dimension stratégique
4. Milice + combats simples (Phase 4) — le frisson tactique
5. Le reste selon l'envie

## 5. Règles d'architecture à respecter

- `js/sim.js` reste **100 % pur et testable** : toute la logique métier y vit (y compris plus tard l'IA du baron et les combats).
- `js/render.js` ne fait qu'afficher l'état de la sim.
- `js/app.js` ne fait que brancher les entrées et l'UI.
- **Aucune dépendance externe** : le « zéro build » est un atout du projet.

## 6. Étape 3 — Maisons automatiques et chantiers visibles ✅

- **Tracé libre, point par point (façon Manor Lords)** : le joueur pose les points du contour le long d'une route (calés au quart de case), touche le premier point pour fermer, glisse un point pour ajuster. `planZone(points, n)` repère la façade, propose une maison toutes les 2 cases (réglable avec − / +), coupe la zone perpendiculairement à la route ; chaque parcelle garde son contour (`plot.poly`) et sa cour = ses cases hors maison, donc la forme décide de la taille des jardins et du nombre d'agrandissements.
- **Aimant de route** : `snapZonePoint` colle un point au bord d'une route à moins d'une demi-case, et un trait presque parallèle à la route reste bien droit ; on peut tirer un trait depuis le dernier point.
- **Arrière-cour** : une seule chose par cour (potager, verger, ruches, poules…), dessinée sur toute la cour (≈ 1 élément pour 2 cases, 5 au plus) ; production ×(0,5 + 0,5·√cases), plafonnée à ×2,5 ; « Retirer » rend la moitié du prix.
- **Nouveau départ** : campement de survivants, poteau du bœuf (1 bœuf), bout de chemin, aucune maison ; les familles emménagent dès qu'une maison est prête, puis le campement est démonté. Le bourgage d'une case n'est plus au menu (gardé pour les vieilles sauvegardes).
- **Retours du premier essai sur téléphone** : appui long (0,28 s) sur un point pour l'attraper, il suit ensuite le doigt en relatif ; glisser tout de suite déplace la vue (ou tire un trait depuis le dernier point) ; les 3 familles du départ ne partent jamais ; plus de bande noire en haut dans un onglet de navigateur.
- **Chantiers** : `buildStage` (fondations, charpente, murs, toit), dessinés étape par étape ; les journaliers bâtissent.
- **Rendu** : clôtures en lignes pixel qui suivent le contour exact (côté rue ouvert), cour teintée, agrandissements posés sur leur case (choix de la case verte ou « Auto »).
- **Sauvegarde v3** : champ `plot` optionnel, anciennes sauvegardes compatibles (cour à plusieurs agrandissements : le premier est gardé, les autres remboursés). 80 tests. Vérifié en Chrome mobile émulé 390×844, pas encore sur un vrai téléphone.

## 7. Étape 4 — Villageois individuels ✅

- **Des personnes plutôt que des familles anonymes** : `g.villagers` (prénom, sexe, date de naissance `bornAt` en mois, compétences 0-100 dans 8 savoir-faire, santé, maladie, humeur et ses causes, conjoint, parents). Les familles (`g.families`) deviennent des foyers : une maison, une marmite, un nom. Âges : enfant < 12 ≤ adolescent < 16 ≤ adulte < 55 ≤ ancien ; retraite à 65 ans. Un an de jeu fait vieillir d'un an.
- **Un métier par adulte** : `b.want` = ouvriers voulus ; + embauche l'adulte libre le plus doué dans le métier du lieu, − renvoie le moins doué. Un poste voulu se pourvoit tout seul dès qu'un adulte se libère (adolescent devenu adulte, retraite, décès, nouvel arrivant). Affectation à la main depuis la fiche (`assignVillager`). Les journaliers (adultes sans poste) bâtissent les chantiers.
- **Savoir-faire** : vitesse de travail ×0,75 (novice) à ×1,25 (maître), moins pour un ancien ou un malade ; on progresse en travaillant (bilan mensuel du temps passé à l'ouvrage). Niveaux : novice, initié, compagnon, confirmé, maître. Le négociant du comptoir vend de −10 % à +10 %.
- **Apprentissage** : un adolescent (12-15 ans) par atelier ; il apprend vite auprès d'un maître compagnon ou mieux, lentement sinon. À 16 ans, il prend un poste dans l'atelier s'il y a de la place. Les enfants apprennent aussi un peu le métier de leurs parents. Si un savoir-faire de 60 ou plus meurt avec son détenteur sans que personne n'ait atteint 40, le journal le signale.
- **La vie** : chacun mange selon son âge (un foyer type mange à peu près autant qu'une famille de l'ancienne version) ; la faim, le froid et la maladie abîment la santé, on se remet quand tout va bien ; décès de faim, de froid, de maladie ou de vieillesse ; deuil des proches ; orphelins recueillis par une autre famille. Mariages entre célibataires d'âge voisin sans lien de parenté ; le jeune couple prend une maison libre (avant les nouveaux venus), sinon vit chez les parents du mari. Naissances chez les couples logés dans une maison et nourris. La peste emporte les plus fragiles au lieu de familles entières. Les nouveaux venus arrivent en familles de 1 à 4 personnes.
- **Humeur et approbation** : l'approbation est détaillée cause par cause (`g.approvalWhy`, panneau de la seigneurie) ; chaque villageois a son humeur = approbation + ce qui le touche (faim, maladie, deuil, naissance, mariage, métier aimé ou non…), visible dans sa fiche ; la moyenne compte un peu dans l'approbation.
- **Interface** : toucher un villageois sur la carte ouvre sa fiche (humeur et causes, santé, métier, savoir-faire, famille, « Voir sur la carte » avec une flèche dorée au-dessus de lui) ; compteur d'habitants en haut → liste par foyer avec filtres (journaliers, adolescents, enfants, malades) ; panneau d'un bâtiment : ses ouvriers avec leur niveau, son apprenti ; panneau d'une maison : les membres de la famille.
- **Rendu** : femmes en robe, anciens aux cheveux gris, enfants plus petits qui jouent près de la maison ; les nourrissons restent à la maison.
- **Sauvegarde v4** : `villagers`, `approvalWhy`, `b.want` ; les sauvegardes v3 et plus anciennes sont converties (chaque famille reçoit ses membres, le premier adulte reprend la place et le métier de l'ancienne famille). 98 tests.
- **Équilibrage** : un robot qui joue la même stratégie simple sur 48 cartes (4 ans, mode Prospérité) gagne 17 parties contre 11 avant l'étape 4 (approbation moyenne 41 % contre 38 %) : deux adultes par foyer donnent plus de bras. En contrepartie, une famine prolongée tue désormais (aucun village éteint sur ces 48 cartes, mais c'est arrivé sur d'autres réglages pendant la mise au point). Le vrai passage d'équilibrage reste l'étape 8.
- Vérifié en Chrome mobile émulé 390×844 (touchers simulés) ; pas encore sur un vrai téléphone.

## 8. Étape 5 — Agriculture et élevage approfondis ✅ (PR à valider)

- **Huit cultures, chacune avec son calendrier** (`CROP_DEFS`, `CROP_CAL`) : blé d'hiver et seigle semés en septembre-octobre et moissonnés l'été suivant ; orge, avoine, lin, pois et fèves semés en mars-avril ; pré de fauche (pas de labour, l'herbe reprend en mars, fauche en juin-juillet) ; jachère. Le seigle supporte le gel et les sols pauvres ; l'avoine nourrit les bêtes ; le lin va au tailleur ; les pois sont une nourriture qui se garde et rechargent le sol. Un nouveau champ propose la prochaine culture qu'on pourra semer.
- **Travaux en étapes** (`farmJob`, `fieldWork`) : fumure (si du fumier attend), labour (plus rapide avec un bœuf : ×1,5, ×2 avec deux), semailles, pousse, moisson ou fauche ; la vitesse dépend désormais de la taille du champ. Les céréales sont moissonnées en **gerbes** (réserves `sh_grain`, `sh_barley`, `sh_oats`), battues au fléau à la ferme quand les champs laissent du temps, surtout l'hiver ; le battage donne aussi un peu de paille, comptée avec le foin. Une récolte qui attend un mois de trop perd du grain, puis pourrit sur pied ; une culture qui n'a pas mûri à temps se récolte maigre ou se perd.
- **Rotation et historique** : chaque champ garde ses 4 dernières récoltes ; même céréale deux ans de suite ×0,8, céréale après céréale ×0,92, lin après lin ×0,7, après des pois ×1,15, après une jachère ×1,1. Le blé prend 0,20 de fertilité, les pois en rendent 0,10, la jachère 0,12 par an (davantage si un troupeau pâture à côté). Le fumier épandu monte la fertilité.
- **Météo des champs** (`farmMonth`) : gel tardif (mars-avril, le seigle résiste), printemps sec (la pousse ralentit, lumière plus chaude), grêle sur un ou deux champs (juin-août), été pourri (la moisson traîne), hiver rigoureux (le blé d'hiver souffre). La pluie aide désormais la pousse. Chaque dégât est noté sur le champ ; en juin, une prévision de moisson.
- **Prévision de récolte** (`forecast`) : quantité attendue et ses raisons (fertilité, rotation, état de la culture, maturité) dans le panneau du champ ; la ferme liste tous ses champs avec leur état et leur rendement attendu.
- **Pâturages tracés librement** (`planPasture`, `tracePasture`), comme les zones de maisons mais sans route obligatoire : 4 à 90 cases, la clôture coûte 1 bois + 1 par 8 bords de case, un abri se pose au bord, côté route ; chantier bâti par les journaliers. On traverse l'herbe d'un pâturage (pas son abri) ; on n'y bâtit rien.
- **Troupeaux** (`b.herd`, une espèce par pâturage, bêtes anonymes avec âge, sexe, maladie, engraissement, lactation) : moutons (laine à la tonte de mai), vaches (lait pendant 10 mois après un vêlage, beaucoup de fumier ; un jeune taureau de trop devient un bœuf de trait), porcs (prolifiques, deux mises bas par an ; glandée en forêt de septembre à novembre avec un porcher, ils s'engraissent). Naissances au printemps s'il y a un mâle et de quoi manger ; vieillesse ; faim (herbe trop courte ou pas de foin) ; maladies contagieuses (gale, fièvre aphteuse, rouget), qui passent aussi aux troupeaux voisins de la même espèce. Gardien (berger, vacher, porcher, compétence « Élevage ») : sans lui, ni lait ni tonte, moins de naissances, plus de maladies.
- **Hiver et fourrage** : de décembre à février, chaque bête mange du foin (vache et bœuf 1 par mois, porc 0,4, mouton 0,25) ; l'avoine compte 1,5. Foin du pré de fauche, de l'herbe en trop fauchée en juin-juillet par le gardien, et de la paille du battage. Avertissement en octobre si les réserves ne suffiront pas. **Abattage de novembre** : on choisit combien de bêtes garder, le reste part à la boucherie (un porc gras donne plus de viande).
- **Commerce** : achat d'un mâle ou d'une femelle en deniers, vente, abattage, abattage des malades (viande perdue, contagion arrêtée) ; au printemps, un **marchand de bestiaux** propose parfois un lot contre du bois ou des deniers.
- **Produits** : lait (nourriture fraîche, tourne vite), pois et fèves (se gardent), laine et lin (le tailleur en fait des vêtements, moitié moins sans fibre), fumier, foin. La laine se vend au comptoir.
- **Interface** : tiroir *Terres* (champs, ferme, moulin, « Tracer un pâturage », bœuf) ; panneau du champ (choix parmi 8 cultures, calendrier, rotation et historique, fumure, labour, semailles, pousse, récolte attendue et dégâts) ; panneau de la ferme (bœufs, gerbes à battre, fumier, liste des champs) ; panneau du pâturage (choix et achat des bêtes, composition du troupeau, herbe ou foin, produits du mois, commerce, abattage de novembre) ; réserves (gerbes, fibres, fourrage et besoin d'hiver, bétail) ; foin et gerbes dans le bandeau ; aide mise à jour.
- **Rendu** : tuiles propres à chaque culture et à chaque stade (fleurs bleues du lin, pois en fleurs, pré fleuri puis fauché en andains), fumier sur le chaume, pousses de blé d'hiver sous la neige, gerbes et meules jusqu'au labour suivant ; pâturages teintés selon l'herbe qui reste, clôture qui suit le tracé, abri selon l'espèce (bergerie, étable, soue) ; moutons, vaches, porcs et leurs petits qui broutent, marchent, se couchent quand ils sont malades, se serrent près de l'abri et d'une meule l'hiver, vont en forêt pour la glandée ; berger à la houlette ; outils (fourche, sac de semences, faux, fléau).
- **Champs tracés librement** (`planField`, `traceField`), comme les zones : 4 à 64 cases, gratuits ; l'aperçu affiche le calque de fertilité, la fertilité moyenne et la récolte estimée. Plus de tailles fixes (3×3, 4×4, 6×6) dans l'interface ; les champs carrés des anciennes parties deviennent des formes tracées au chargement. Talus et piquets suivent le contour.
- **Plus de maison sans cour** : chaque parcelle d'une zone de maisons garde au moins 3 cases (`PLOT_MIN`) ; une zone trop étroite propose moins de maisons ou est refusée. Les maisons d'une case des anciennes parties restent en place.
- **Rythme du temps** : 190 ticks par jour, 16 jours par mois, 10 ticks par seconde à ×1 → environ 5 minutes par mois. `TS` (=19) est le rapport avec l'ancien rythme. Les déplacements restent en temps réel ; l'ouvrage, les pauses (`workGate`, un tick sur `WORK_DIV`=30), la pousse des cultures, l'apparition des brigands, le contrat des mercenaires et le retour des cerfs sont ramenés à l'échelle. Calibrage : 6 parties de test sur 12 mois (bois, baies, chantiers) donnent la même production par mois qu'avant, à quelques % près. Le réglage fin reste pour l'étape 8. Vitesses de l'interface : ×1, ×4, ×16, ×60 (touches 1 à 4) et pause.
- **Sauvegarde v5** : `b.f` détaillé, `b.herd`, `oxen`, nouvelles réserves. Les v4 sont converties : la jachère n'est plus labourée ni semée, les bœufs comptés deviennent des bœufs avec un âge, les champs sont complétés, une meule de foin est offerte (6 + 3 par bœuf) pour que les bœufs passent l'hiver. 129 tests.
- **Équilibrage** : un robot simple qui joue la même stratégie sur 40 cartes (4 ans, Prospérité) obtient les mêmes résultats qu'avant l'étape 5 (approbation moyenne 40,6 % contre 40,8 %, un peu moins de morts de faim) ; les cultures sont semées et récoltées normalement. Ce robot joue mal (il perd souvent sur les deux versions) : le vrai passage d'équilibrage reste l'étape 8, en particulier la reproduction des porcs et le besoin en foin.
- Vérifié en Chrome mobile émulé 390×844 (touchers simulés : panneaux, tracé d'un pâturage, achat de bêtes, vieille sauvegarde v4, hiver), sans erreur dans la console ; pas encore sur un vrai téléphone.

## 9. Étape 5 bis — Logistique et chantiers livrés ✅ (PR à valider)

- **Le stock baisse à la livraison** : poser un chantier ne retire rien du stock. Son coût est noté sur le chantier (`b.mat = { need, got }`) et **réservé** : `freeStock(r) = stock − reserved(r)` décide de ce qu'on peut encore poser ou acheter (bâtiments, zones de maisons, pâturages, agrandissements de cour, église, troc au marchand de bestiaux, montée de niveau des bourgages). Chaque charge sort du stock quand elle est **déposée au pied du chantier**. Le chantier ne peut pas dépasser la part livrée (`matFrac`) : sans rien de livré, il reste à 0 %.
- **Réserve vide** (pillage, incendie…) : personne ne part chercher ce qui n'existe pas (`pickable`), le chantier affiche « attend bois (réserve vide) ».
- **Dépôts** (`DEPOT_DEFS`) : campement, poteau du bœuf et entrepôt (bois et pierre), camp de bûcherons (bois seulement), carrière (pierre seulement). On choisit le dépôt qui fait le trajet le plus court (jusqu'au dépôt, puis jusqu'au chantier). Sans aucun dépôt, un marchand livre pour qu'aucun chantier ne reste bloqué (le bois sort quand même du stock).
- **Un bœuf ne part jamais seul** : un tronc est trop lourd pour un homme, donc un journalier va chercher le bœuf (là où il est), le mène au dépôt, puis au chantier avec trois troncs (ou un traîneau de trois pierres), et le ramène au poteau. Le bœuf suit à un pas derrière lui (`oxStep`), au pas lent de l'attelage ; s'il n'est plus mené (journalier mort ou réaffecté), il reste où il est jusqu'à ce qu'un autre vienne le chercher. Le labour passe avant : pas de charroi pendant qu'un fermier laboure, et un bœuf mené ne compte pas pour le labour.
- **Sans bœuf en état** (aucun, trop jeune, malade), un homme traîne un tronc à la main, très lentement, pour qu'aucun chantier ne reste bloqué. La pierre se porte une à une, ou en traîneau derrière le bœuf quand il en reste au moins deux.
- **Porteurs** : les journaliers (et les ouvriers affectés à un chantier) vont d'abord chercher ce qui manque (`siteJob`, tâche `haul` : bœuf, dépôt, chantier, retour), puis bâtissent avec ce qui est arrivé. Ce qui est en route se recalcule à partir des tâches (`inTransit`) : rien ne se perd ni ne se compte deux fois.
- **Priorité** : « Livrer en priorité » dans le panneau d'un chantier ; il est servi avant les autres (sinon, le plus proche d'abord).
- **Abandonner un chantier** : ce qui n'a pas été livré n'avait rien coûté ; le tas non employé revient au stock, la moitié de ce qui a été bâti est perdue. Un bâtiment achevé rend toujours la moitié de son coût.
- **Rendu** : journalier qui mène le bœuf, troncs liés ou traîneau de pierres derrière la bête, homme qui traîne un tronc faute de bœuf, porteur avec une pierre sur l'épaule ; tas au pied du chantier (1 à 4 troncs, 1 à 3 pierres) qui diminuent à mesure qu'on bâtit ; un bœuf parti ou laissé en chemin n'est plus dessiné au poteau ni à la ferme.
- **Interface** : panneau du chantier (livré, en route, « avec le bœuf », « le bœuf est pris », « plus rien en réserve », dépôts, priorité) ; détail des réserves avec la part réservée aux chantiers ; coûts en rouge selon le stock libre ; page d'aide « Chantiers et matériaux ».
- **Sauvegarde v6** : `b.mat`, `b.prio`, position du bœuf et qui le mène. Les chantiers des sauvegardes v5 et plus anciennes avaient déjà payé leur coût à la pose : ils ont tous leurs matériaux sur place. 138 tests.
- **Équilibrage** : sur 6 cartes (entrepôt, camp de bûcherons, manoir, église, grange posés d'un coup près du campement), tout est fini en 2,8 à 3 mois contre 2,4 à 2,6 avant : tout le bois passe par l'unique bœuf. Un deuxième bœuf (20 deniers à la ferme) ou des entrepôts près des chantiers accélèrent les choses ; c'est voulu.
- **Corrections (retours du premier essai)** : retirer un ouvrier avec « − » met sa fiche à jour tout de suite (plus de « aime son métier » jusqu'à la fin du mois, `refreshMood`), un message le confirme, et il quitte son ancien poste pour un chantier ou sa maison (`freeWorker`) au lieu d'y rester planté. Liste des habitants : filtre **Adultes**, rangés par poste (journaliers en tête) avec leur niveau dans le métier, et un avertissement quand plus personne n'est libre pour bâtir ; le même avertissement dans le panneau d'un chantier. 139 tests.
- Vérifié dans le navigateur intégré en 375×812 (manoir loin du campement, bœuf mené à l'aller et au retour, tas, stock qui baisse à la livraison, panneau), sans erreur dans la console ; pas encore sur un vrai téléphone.

## 10. Étape 6 — Nourriture et transformation ✅ (PR à valider)

- **Ateliers** (`RECIPES`, tiroir *Vivres*) : **moulin** (1 grain → 1 farine, 2 ouvriers), **boulangerie** (1 farine → 1,5 pain, ¼ de bois de chauffe par fournée), **laiterie** (3 laits → 2 fromages), **fumoir** (1 viande → 1 viande fumée, ½ bois de chauffe ; il laisse `SMOKE_KEEP` = 4 viandes fraîches pour la table). Compétence « Artisanat ». Métiers : meunier, boulanger, fromager, charcutier.
- **Les artisans vont chercher leurs ingrédients** (tâche `fetch`, branchée sur la logistique de l'étape 5 bis) : l'artisan va au lieu le plus commode qui en a (ferme, grange, entrepôt ou campement pour le grain ; moulin, grange ou entrepôt pour la farine ; pâturage des vaches ou grange pour le lait ; camp de chasse, pâturage, grange, entrepôt ou campement pour la viande), charge jusqu'à 3-4 mesures et les porte à l'atelier (`b.inp`). Comme pour les chantiers, l'ingrédient ne sort de la réserve qu'à la livraison, et ce qui est en route n'est pas promis deux fois (`inFetch`, `fetchable`). Sans aucun lieu de dépôt, on le lui apporte. Démolir l'atelier rend ce qu'il avait sur place.
- **On produit à la mesure des besoins** (`craftTarget`) : le pain rassit vite, la boulangerie cuit jusqu'à environ 1,2 mois de besoins ; le moulin moud d'avance pour 2 mois. Fromage et viande fumée : jusqu'à la capacité. Statut de l'atelier : « Va chercher du grain », « Cuisson du pain en cours », « Réserve suffisante, l'atelier attend », « Manque de bois de chauffe », « En attente de lait (plus rien en réserve) ».
- **Four des foyers** (`homeBake`) : faute de boulangerie, chaque foyer logé cuit jusqu'à 1 farine par mois (1 farine → 1 pain, un peu de bois). Les parties d'avant l'étape 6, où le moulin faisait directement le pain, gardent ainsi leur pain.
- **Pourrissement denrée par denrée** (`FOOD_DEFS.spoil`, `spoilMonth`) : lait 50 % par mois, viande fraîche 15 %, pain, baies et œufs 12 %, légumes 10 %, pommes 5 %, pois 3 %, fromage et viande fumée 2 %, miel 0 ; grain et orge 2 %, farine 3 % (`STORE_SPOIL`). L'hiver ×0,5, l'été ×1,3. Chaque **grange** met `GRANARY_CAP` = 200 denrées à l'abri, où elles se gâtent trois fois moins vite (le lait n'y gagne rien) : une grande réserve en demande plusieurs. Les pertes du mois sont notées (`g.spoiled`).
- **Repas** (`eatMonth`) : cinq sortes d'aliments (`FOOD_GROUPS` : pain, viande, laitages et œufs, légumes et pois, fruits et miel). Avec un marché, le village prend une part égale dans chaque sorte disponible, et dans chaque sorte ce qui se gâte le plus vite d'abord (le lait avant le fromage, la viande fraîche avant la fumée) : les conserves restent pour l'hiver. Chaque sorte est partagée entre les foyers au prorata de leurs besoins (quelques œufs vont à tous, pas aux premiers servis) ; mais quand la nourriture manque, les foyers sont servis l'un après l'autre, comme avant : une disette laisse des affamés sans affamer tout le village d'un coup. Sans marché, on mange la sorte la plus abondante (puis la suivante si elle s'épuise : on ne meurt plus de faim à côté d'une réserve pleine). La variété de chaque foyer (`f.variety`, `f.menu`) remplace celle du village : approbation de −8 à +18 selon le nombre moyen de sortes par foyer (`VARIETY_APPROVAL`, progressif), humeur « Repas variés » (+3) ou « Toujours la même chose » (−3), et un bourgage ne monte de niveau que si son foyer mange au moins deux sortes. Panneau d'une maison : « Au menu le mois dernier ».
- **Disette** (`dearthMonth`) : faute de tout, on mange le grain, la farine ou l'orge en **bouillie** (pas l'avoine des bêtes) : on n'a pas faim, mais approbation −4 et humeur « Bouillie de disette ». Mois de disette d'affilée (`g.dearth`), avertissement de **soudure** en mars (moins de 3 mois de vivres) et d'**hiver maigre** en octobre (moins de 4 mois). En disette, un **marchand de grain** passe parfois (au plus une fois par trimestre) et vend des pois et fèves secs, 2 deniers la mesure (3 si la disette dure). Vivres en mois dans la vue d'ensemble de la seigneurie (`foodMonths`, le grain et la farine comptent).
- **Interface** : tiroir *Stocks* devenu *Vivres* (moulin, boulangerie, laiterie, fumoir, grange, entrepôt) ; panneau d'atelier (recette, ingrédient sur place, réserves, production du mois, d'où vient l'ingrédient) ; panneau de la grange (part des réserves à l'abri, pertes du mois) ; réserves rangées par sorte d'aliments avec ce qui se gâtera ce mois-ci, farine dans le bandeau ; aide « Transformer et conserver ».
- **Rendu** : boulangerie à colombages avec son four à pain en dôme (braises) et sa cheminée qui fume, laiterie chaulée avec baratte et seaux, fumoir de planches noircies qui fume par le faîte, jambons sous l'auvent ; tenues des boulangers, fromagers et charcutiers ; seau de lait porté ; icônes de la farine, du fromage et de la viande fumée.
- **Sauvegarde v7** : `b.inp`, `b.made`, farine, fromage, viande fumée, disette. Les v6 sont converties : un meunier qui « moulait » reprend comme les autres, les ateliers démarrent vides. 155 tests.
- **Équilibrage** : un robot simple (32 cartes, 4 ans, Prospérité ; cueilleuses, chasseurs, ferme et 4 champs, moulin, marché, grange, maisons d'une case avec un agrandissement de cour) donne, avant → après l'étape 6 : approbation moyenne 37,8 → 38,9 %, population finale 36,7 → 36,1, morts de faim 12,9 → 9,4 par partie, aucune défaite. On mange d'abord ce qui se gâte, et la bouillie évite la famine tant qu'il reste du grain. Un premier essai où tout le village partageait aussi la pénurie à parts égales affamait tous les foyers d'un coup (10 villages éteints sur 16) : d'où le service foyer par foyer quand la nourriture manque. Ce robot ne gère ni le bois de chauffe ni les vêtements : le vrai passage d'équilibrage reste l'étape 8.
- Vérifié dans Chromium en 390×844 (ateliers posés, artisans qui vont chercher et portent, panneaux, réserves, marchand de grain), sans erreur dans la console ; pas encore sur un vrai téléphone.

### Petits détails ajoutés après l'étape 6

- **Le fermier travaille case par case** : les cases d'un champ sont rangées en serpentin (`fieldCells`, une rangée dans un sens, la suivante dans l'autre, toujours des cases voisines), et l'affichage des cases labourées, semées, fumées ou moissonnées suit déjà cet ordre. Le fermier se tient maintenant sur la case qu'il est en train de travailler (`fieldAim`, `fieldGlide`) : il avance d'une case à la suivante à mesure que le travail progresse, marche entre deux coups de bêche (outil sur l'épaule) puis se remet à creuser. À deux sur le même travail, le second prend la case d'après. Comme le chemin ne traverse pas un champ, un villageois resté au milieu d'une parcelle sans case libre à côté en sort tout seul avant de repartir (`unstick`).
- **Habitants / capacité des maisons** (`HOUSE_CAP` = 6, 8, 10 selon le niveau : chaumière, colombages, pierre) : le panneau d'une maison affiche « Habitants 4 / 6 » avec une jauge, et ce que gagne le niveau suivant. Une maison **pleine** n'a plus de naissances ; un foyer qui s'entasse faute d'autre maison (jeune couple chez ses parents, orphelins recueillis) peut dépasser la capacité, la maison est alors marquée « surpeuplée ». Sur 10 ans simulés, 96 % des foyers ont 5 membres ou moins : la limite ne joue presque jamais en partie normale, elle donne surtout une raison de faire monter les maisons de niveau. 158 tests.
