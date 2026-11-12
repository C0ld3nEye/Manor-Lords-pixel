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
| Carte | ✅ Étape 6 bis : 256 × 192 cases (31 fois l'ancienne), continentale : rivière et gués, lacs, massifs forestiers ; une vingtaine de régions aux frontières naturelles, réclamées de proche en proche ; sol peint par morceaux à la demande. |
| Interface mobile | ✅ Étape 2 : barre compacte, construction par catégories, panneaux en bas d'écran. |
| Maisons et chantiers | ✅ Étape 3 : zones tracées point par point, parcelles, jardins et clôtures, chantiers en quatre étapes, départ au campement. |
| Villageois | ✅ Étape 4 : chaque habitant a un prénom, un âge, une santé, une humeur et un savoir-faire ; un métier par adulte, apprentis, mariages, naissances, vieillesse, décès. |
| Logistique | ✅ Étape 5 bis : le bois et la pierre sont réservés à la pose et sortent du stock à la livraison ; un journalier mène le bœuf, qui traîne trois troncs (la pierre se porte une à une), depuis le campement, l'entrepôt, le camp de bûcherons ou la carrière ; le chantier ne progresse qu'avec ce qui est livré ; chantier prioritaire. |
| Nourriture | ✅ Étape 6 : moulin (farine), boulangerie, laiterie (fromage), fumoir ; les artisans vont chercher leurs ingrédients à pied ; chaque denrée se gâte à son rythme (froid, chaleur, grange qui abrite 200 denrées) ; repas comptés en cinq sortes d'aliments, foyer par foyer, le plus périssable mangé d'abord ; disette, bouillie de grain, soudure annoncée, marchand de grain. |
| Agriculture et élevage | ✅ Étape 5 : 8 cultures et leur calendrier, fumure, labour, semailles, moisson en gerbes, battage, rotation, météo, prévision de récolte ; pâturages tracés, moutons, vaches, porcs, foin d'hiver, maladies, bœufs de trait. |
| Simulation | 20 bâtiments, 8 cultures, 3 espèces de bétail, 11 denrées en 5 sortes, routes, comptoir, une vingtaine de régions, un baron rival, brigands, milice, 5 modes, 3 difficultés. 207 tests. |
| Administration | ✅ (gros tests à faire) Étape 7a : taille levée à Pâques et à la Saint-Michel, dîme en nature, péages, corvée (les ouvriers rejoignent les chantiers), changeur et dettes, livre de comptes avec prévision jusqu'au printemps. Étape 7b : traits de caractère, mémoire et opinion de chaque famille, réputation du seigneur (généreux, avare, craint), aumône et fête, conseil facultatif de quatre sièges. Étape 7c : serfs, bourgeois et nobles ; coutumier de huit lois. Étape 7d : affaires à juger avant les plaids, enquête, peines et précédents, pétitions et faveurs dues. Étape 7e : factions de mécontents (grève, ultimatum, jacquerie), informateurs et secrets, chronique du domaine. |
| Vassaux, dynastie | ❌ À construire. |
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

**Étape 5 bis — Logistique et chantiers livrés** ✅
Les matériaux ne sortent plus du stock par magie : le chantier réclame son bois et sa pierre, des porteurs et l'attelage de bœufs les amènent depuis le camp ou l'entrepôt, et la construction ne progresse qu'une fois la livraison arrivée (troncs traînés sur la carte, tas déposés au pied du chantier). Entrepôts, trajets réels, priorité des livraisons. Placée ici parce que le bœuf et le bétail ont alors un vrai rôle (étape 5) et avant les chaînes de transformation (étape 6), qui se brancheront directement sur ces transports au lieu d'être reprises. Numéros des étapes suivantes inchangés.

**Étape 6 — Nourriture et transformation** ✅
Moulin (grain → farine), boulangerie (farine → pain), laiterie (lait → fromage), fumoir (viande → viande fumée) ; les artisans vont chercher leurs ingrédients au plus proche et les portent à l'atelier. Pourrissement denrée par denrée, ralenti par le froid et la grange. Variété des repas comptée en cinq sortes d'aliments, foyer par foyer. Disettes : bouillie de grain, soudure annoncée, marchand de grain. La brasserie reste un agrandissement de cour (orge → ale).

**Étape 6 bis — Une vraie carte** ✅
La carte passe de 46 × 34 à 256 × 192 cases, sans forme géométrique imposée : un pays continental (rivière avec gués, lacs, massifs forestiers, prairies) découpé en une vingtaine de régions aux frontières naturelles. On commence au centre, dans une région bien plus grande qu'avant, et on s'étend de proche en proche. Plus tard (étape 11), ce pays ne sera qu'une partie du royaume, avec ses vassaux et ses voisins. Les anciennes sauvegardes (petite carte) ne se chargent plus.

**Étape 7 — Administration** (inspiration Crusader Kings, à l'échelle du village)
Découpée en cinq livraisons jouables :

- **7a — Le fisc et les comptes** ✅ : la taille court chaque mois mais se lève à Pâques et à la Saint-Michel (une seigneurie mécontente en cache une partie) ; la dîme prend en octobre une part des céréales et des pois récoltés, contre de l'influence chaque mois (il faut une église ; l'ancien décret de dîme devient une dîme au dixième) ; les péages se lèvent sur les marchands du marché et du comptoir ; la corvée appelle, certains jours, les ouvriers des postes sur les chantiers ; le changeur prête à 2 % par mois et saisit des biens après trois échéances manquées ; livre de comptes poste par poste, douze mois d'historique, prévision jusqu'au printemps et calendrier fiscal.
- **7b — L'opinion et le conseil** ✅ : chaque adulte a deux ou trois traits (honnête ou cupide, zélé ou paresseux, pieux, brave, avisé) ; chaque famille se souvient de ce que le seigneur lui a fait (maison rasée, mort de faim ou de froid, taille lourde, corvée, aumône, fête, siège au conseil…), souvenirs qui s'estompent et dont les jeunes foyers héritent à moitié ; son opinion, c'est l'approbation plus cette mémoire ; la plus fâchée part la première, et une famille rancunière trois mois de suite s'en va même si le village va bien. Réputation du seigneur (généreux, avare, craint) faite de ses choix ; aumône et fête au village. Conseil **facultatif** de quatre sièges (intendant, bailli, chapelain, maître d'armes) : aucun malus quand un siège est vide ; chaque conseiller quitte son poste, touche des gages, a une compétence (savoir-faire, traits, expérience) et une mission au choix ; un intendant cupide détourne une part des recettes, que le bailli ou un contrôle des comptes peut démasquer.
- **7c — Le coutumier et les ordres** ✅ : trois ordres à la façon de *Foundation*. Les familles arrivent **serves** (tâches de base, chantiers, corvée) ; quand leur maison atteint le niveau 2, elles entrent dans la **bourgeoisie**, seule à tenir les métiers d'artisan (moulin, boulangerie, laiterie, fumoir, marché, comptoir) et exemptée de corvée ; une famille d'une maison de niveau 3 peut être **anoblie** (30 d'influence) : elle ne travaille plus, sert comme courtisan, clerc ou lettré, siège au conseil avec plus de compétence, ne paie pas la taille et veut chaque mois vêtements et bonne table. Coutumier de huit lois en quatre chapitres (droit de chasse, bois mort, port d'armes, couvre-feu, mainmorte, charte du bourg, taille des nobles, succession verrouillée jusqu'à l'étape 10) : chaque proclamation coûte 15 d'influence, prend effet le mois suivant et ne se change pas avant un an. Les parties d'avant gardent leurs artisans (leurs familles deviennent bourgeoises).
- **7d — Justice et audiences** ✅ : des affaires surgissent entre les familles (bornage, vol, braconnage quand la chasse est réservée, dette, rixe) ; on les juge quand on veut, au plus tard aux plaids de la saison (mars, juin, septembre, décembre), sinon les deux familles en gardent rancune. Sans bailli, les preuves sont incertaines et l'on peut condamner un innocent, ce que sa famille n'oublie pas ; un bailli compétent rend l'enquête fiable. Peines : amende, pilori, bannissement ; la pendaison (haute justice) attend le titre de baron (étape 9). Un revirement brutal par rapport au dernier précédent choque le village. Réputation de justice (juste, inique). Pétitions (prêt, exemption de taille, affranchissement d'une famille de serfs, dispense de corvée, mariage au dehors) : une faveur accordée rend la famille redevable, et une famille redevable avale un verdict contre elle ou reste au lieu de partir. Un bouton « Audiences » apparaît sur la carte quand quelqu'un attend.
- **7e — Les intrigues** ✅ : quand plusieurs familles vous en veulent, elles forment une faction autour d'un meneur, avec une revendication tirée de leurs griefs (baisser la taille, alléger la corvée ou les péages, abolir la mainmorte, une fête). Elle grossit chaque mois : grève de la corvée et de la moitié de la taille, puis ultimatum (céder, faire arrêter le meneur, refuser), puis jacquerie, matée si la milice est assez nombreuse, sinon pillage et familles en fuite. Un bailli ou un chapelain au conseil sert d'informateur : il démasque le meneur et apprend les secrets des villageois (vol, braconnage, fraude à la taille), dont on fait un levier (pression qui crée une faveur due, dénonciation, pardon). Les serfs ne partent pas : ils s'enfuient. La chronique du domaine garde les grands moments du règne.

**Reste à faire pour clore l'étape 7** : une série de gros tests et de parties sur téléphone sur l'ensemble 7a → 7e (équilibrage des redevances, fréquence des affaires, des pétitions et des factions, lisibilité des panneaux).

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
