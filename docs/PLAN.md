# 🏰 Manor Lords Pixel — Audit, comparaison & plan de développement

> Document de référence : audit du code actuel, comparaison avec Manor Lords (jeu officiel, Slavic Magic / Hooded Horse), et plan de développement en 7 phases, du plus fondamental au plus ambitieux.
> Contrainte conservée sur tout le plan : **zéro dépendance, HTML/JS pur, mobile-first, sauvegarde locale + code transposable**.

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

### 🏛️ Phase 5 — Profondeur sociale et progression (semaines 21-25)

23. **Politiques/décrets du manoir** : 2-3 choix actifs (dîme vs taxes, service militaire, marchés libres) avec avantages/inconvénients.
24. **Église améliorable** : autel, clocher, école — bonus de foi, d'approbation, de santé.
25. **Niveaux de bourg** : village → bourg → ville avec débloquage de bâtiments (hôtel de ville, bains, auberge) et nouvelles taxes.
26. **Influence et prestige** : gagnés via brigands détruits, régions réclamées, églises — débloquent réclamations et mercenaires.
27. **Mercenaires** : unités louables à prix d'or contre brigands et baron.

### 🎮 Phase 6 — Modes, rejouabilité, fin de partie (semaines 26-30)

28. **5 modes scénarisés** façon l'officiel : *Prospérité* (sans combat), *Restaurer la paix*, *Au bord du gouffre*, *Duel*, *Royaume fracturé*.
29. **Conditions de victoire/défaite par mode** + écran de fin avec statistiques (années, population max, richesse, pertes).
30. **Difficultés** (paisible / normal / difficile) + **carte aléatoire partageable par code**.
31. **Sauvegarde multiple** (3 slots) + export/import amélioré + reprise automatique.

### ✨ Phase 7 — Polissage final (semaines 31-34)

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
