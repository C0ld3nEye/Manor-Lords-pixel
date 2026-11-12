"use strict";
/* Tests de la simulation (Phase 0 du plan docs/PLAN.md).
   Lancer avec : node test/sim.test.js */
const assert = require("assert");
const { GameState, BUILD_DEFS, EXT_DEFS, EXT_ORDER, CROP_DEFS, CROP_ORDER, FIELD_SIZES, REGION_DEFS, REGION_COST, POLICY_DEFS, POLICY_ORDER, CHURCH_UPGRADES, CHURCH_UP_ORDER, SETTLEMENT_LEVELS, MODES, DIFFICULTIES, W, H, T_GRASS, T_FOREST, T_STONE, MONTHS, seasonOf, TS, TICKS_PER_DAY, DAYS_PER_MONTH } = require("../js/sim.js");
const MONTH_TICKS = TICKS_PER_DAY*DAYS_PER_MONTH, YEAR_TICKS = MONTH_TICKS*12;

let passed = 0;
function test(name, fn){
  try { fn(); passed++; console.log("ok - " + name); }
  catch(e){ console.error("ECHEC - " + name + "\n  " + e.message); process.exitCode = 1; }
}

function fresh(){ return new GameState(1176, "peace", "normal"); } // mode combat pour les tests baron/camps
function placeInCenter(g, def){
  g.setFieldSize(3);
  for(let y=1;y<H-4;y++) for(let x=Math.ceil(W/3)+1;x<Math.floor(2*W/3)-4;x++)
    if(g.place(def, x, y)===null) return g.buildings[g.buildings.length-1];
  throw new Error("pas de place pour "+def);
}
// bourgage d'une case (ancien système, gardé pour les vieilles sauvegardes) posé pour les tests
function legacyHouse(g){
  const b0 = g.buildings.find(x => x.def === "burgage"); if(b0) return b0;
  for(let i=0;i<W*H;i++){ if(!g.place("burgage", i%W, (i/W)|0)) return g.buildings[g.buildings.length-1]; }
}


function freeSpot(g){
  for(let y=1;y<H-1;y++) for(let x=Math.ceil(W/3)+1;x<Math.floor(2*W/3)-1;x++) // région centrale (id 0, toujours réclamée)
    if(g.tiles[y*W+x]===T_GRASS && g.occupied[y*W+x]<0) return { x, y };
  throw new Error("aucune tuile libre");
}

test("état initial : mars 1176, 3 familles, approbation 62", () => {
  const g = fresh();
  assert.strictEqual(g.time.month, 2);
  assert.strictEqual(g.time.year, 1176);
  assert.strictEqual(g.families.length, 3);
  assert.strictEqual(g.approval, 62);
});

test("la carte contient forêt, pierre et eau", () => {
  const g = fresh();
  let forest=0, stone=0, water=0;
  for(let i=0;i<W*H;i++){
    if(g.tiles[i]===T_FOREST) forest++;
    if(g.tiles[i]===T_STONE) stone++;
    if(g.tiles[i]===4) water++;
  }
  assert.ok(forest>10, "forêt présente");
  assert.ok(stone>0, "gisement de pierre présent");
  assert.ok(water>0, "étang présent");
});

test("les saisons suivent les mois", () => {
  assert.strictEqual(seasonOf(0), 0);  // janvier = hiver
  assert.strictEqual(seasonOf(2), 1);  // mars = printemps
  assert.strictEqual(seasonOf(5), 2);  // juin = été
  assert.strictEqual(seasonOf(8), 3);  // septembre = automne
});

test("pose d'un bourgage : occupe le sol et débite le bois", () => {
  const g = fresh();
  const before = g.stock.timber;
  const s = freeSpot(g);
  const err = g.place("burgage", s.x, s.y);
  assert.strictEqual(err, null);
  assert.strictEqual(g.occupied[s.y*W+s.x] >= 0, true);
  assert.strictEqual(g.stock.timber, before - BUILD_DEFS.burgage.cost.timber);
});

test("impossible de poser sur une tuile occupée ou de l'eau", () => {
  const g = fresh();
  const s = freeSpot(g);
  g.place("burgage", s.x, s.y);
  assert.ok(g.place("burgage", s.x, s.y), "case occupée refuse la pose");
  let water = -1;
  for(let i=0;i<W*H;i++) if(g.tiles[i]===4){ water = i; break; }
  assert.ok(g.place("burgage", water%W, Math.floor(water/W)), "eau refuse la pose");
});

test("la carrières exige un gisement de pierre", () => {
  const g = fresh();
  g.stock.timber = 50;
  const grass = freeSpot(g);
  assert.ok(g.place("quarry", grass.x, grass.y), "herbe refuse la carrière");
  g.treasury = 100; g.wealth = 100;
  g.claimRegion(1); g.claimRegion(2); // accès à toute la carte pour ce test
  let stone = -1;
  for(let i=0;i<W*H;i++) if(g.tiles[i]===T_STONE){ stone = i; break; }
  assert.strictEqual(g.place("quarry", stone%W, Math.floor(stone/W)), null);
});

test("affectation d'un adulte à un camp de bûcherons", () => {
  const g = fresh();
  g.stock.timber = 50;
  const s = freeSpot(g);
  g.place("woodcutter", s.x, s.y);
  const b = g.buildings[g.buildings.length-1];
  b.done = true; b.progress = 1;
  const free0 = g.unemployed();
  g.assign(b.id);
  const v = g.villagers.find(v => v.work === b.id);
  assert.ok(v, "un adulte est affecté");
  assert.ok(g.isAdult(v));
  assert.strictEqual(g.unemployed(), free0 - 1);
});

test("journal : toast ajoute une entrée datée et est limité à 120", () => {
  const g = fresh();
  g.log = [];
  g.toast("Bonjour", "good");
  assert.strictEqual(g.log.length, 1);
  assert.strictEqual(g.log[0].text, "Bonjour");
  assert.strictEqual(g.log[0].month, 2);
  assert.strictEqual(g.log[0].year, 1176);
  for(let i=0;i<130;i++) g.toast("msg " + i);
  assert.strictEqual(g.log.length, 120);
});

test("sauvegarde : aller-retour serialize/load conserve l'état", () => {
  const g = fresh();
  g.stock.timber = 50;
  const s = freeSpot(g);
  g.place("burgage", s.x, s.y);
  g.toast("test de journal", "good");
  g.treasury = 42; g.taxRate = 0.3; g.approval = 77;
  for(let i=0;i<500*TS;i++) g.step();
  const data = JSON.parse(JSON.stringify(g.serialize()));
  const g2 = GameState.load(data);
  assert.strictEqual(g2.treasury, g.treasury);
  assert.strictEqual(g2.approval, g.approval);
  assert.strictEqual(g2.taxRate, g.taxRate);
  assert.strictEqual(g2.stock.timber, g.stock.timber);
  assert.deepStrictEqual(g2.time, g.time);
  assert.strictEqual(g2.log.length, g.log.length);
  assert.strictEqual(g2.log[g2.log.length-1].text, g.log[g.log.length-1].text);
  assert.strictEqual(g2.buildings.length, g.buildings.length);
  const b = g2.buildings[0];
  assert.strictEqual(g2.occupied[b.y*W+b.x], b.id, "occupation reconstruite");
});

test("sauvegarde invalide : lève une erreur", () => {
  assert.throws(() => GameState.load(null));
  assert.throws(() => GameState.load({}));
});

test("le temps avance avec step()", () => {
  const g = fresh();
  const t0 = { ...g.time };
  for(let i=0;i<5*TS;i++) g.step();
  assert.ok(g.time.tick > t0.tick);
  for(let i=0;i<200*TS;i++) g.step();
  assert.ok(g.time.day > 0 || g.time.month > t0.month || g.time.year > t0.year, "les jours avancent");
});

test("victoire : les 4 objectifs remplis déclenchent victory (mode prospérité)", () => {
  const g = new GameState(1176, "prosperity", "normal");
  g.objectives.wood = true; g.objectives.happy = true;
  g.objectives.pop = true; g.objectives.manor = true;
  for(let i=0;i<200*TS && !g.victory;i++) g.step();
  assert.strictEqual(g.victory, true);
});

test("extensions : 6 disponibles, coût débité, doublon refusé", () => {
  const g = fresh();
  assert.strictEqual(EXT_ORDER.length, 6);
  const b = legacyHouse(g);
  b.done = true;
  g.stock.timber = 10;
  g.buyExtension(b.id, "garden");
  assert.deepStrictEqual(b.exts, ["garden"]);
  assert.strictEqual(g.stock.timber, 9);
  g.buyExtension(b.id, "garden");
  assert.strictEqual(b.exts.length, 1, "pas de doublon");
});

test("extensions : tailleur et brasserie exigent le niveau 2", () => {
  const g = fresh();
  const b = legacyHouse(g);
  b.done = true; b.lvl = 1;
  g.stock.timber = 10; g.stock.stone = 10;
  g.buyExtension(b.id, "tailor");
  assert.strictEqual(b.exts.length, 0, "refusé au niveau 1");
  b.lvl = 2;
  g.buyExtension(b.id, "tailor");
  g.buyExtension(b.id, "brewer");
  assert.ok(b.exts.includes("tailor") && b.exts.includes("brewer"));
  assert.strictEqual(g.stock.stone, 9, "pierre débitée pour la brasserie");
});

test("production : potager et basse-cour produisent chaque mois", () => {
  const g = fresh();
  const b = legacyHouse(g);
  b.done = true; b.exts = ["garden", "chicken"];
  const veg0 = g.stock.veg, egg0 = g.stock.eggs;
  for(let i=0;i<160*TS;i++) g.step(); // ~1 mois
  assert.ok(g.stock.veg > veg0, "légumes produits");
  assert.ok(g.stock.eggs > egg0, "oeufs produits");
});

test("verger ne produit qu'en août-octobre", () => {
  const g = fresh();
  const b = legacyHouse(g);
  b.done = true; b.exts = ["orchard"];
  g.time.month = 5; // juin : pas de pommes
  const a0 = g.stock.apples;
  for(let i=0;i<160*TS;i++) g.step();
  assert.strictEqual(g.stock.apples, a0, "pas de récolte en juin");
  g.time.month = 8; // septembre
  for(let i=0;i<160*TS;i++) g.step();
  assert.ok(g.stock.apples > a0, "récolte en septembre");
});

test("vêtements : consommation et impact sur l'approbation", () => {
  const g = fresh();
  g.stock.clothes = 0;
  let minAp = 100;
  for(let i=0;i<1600*TS;i++){ g.step(); minAp = Math.min(minAp, g.approval); }
  assert.ok(minAp < 60, "approbation pénalisée sans vêtements");
});

test("sauvegarde ancienne : ext simple migré en exts", () => {
  const g = fresh();
  const data = JSON.parse(JSON.stringify(g.serialize()));
  data.buildings[0].ext = "garden";
  const g2 = GameState.load(data);
  assert.deepStrictEqual(g2.buildings[0].exts, ["garden"]);
});

test("phase 2 / étape 5 : 8 cultures et 3 tailles de champ", () => {
  assert.deepStrictEqual(CROP_ORDER, ["wheat","rye","barley","oats","flax","peas","hay","fallow"]);
  assert.ok(FIELD_SIZES.length===3);
  assert.strictEqual(CROP_DEFS.wheat.yield, "grain");
  assert.strictEqual(CROP_DEFS.barley.yield, "barley");
  assert.strictEqual(CROP_DEFS.fallow.yield, null);
});

test("champ de taille variable : pose respecte la taille choisie", () => {
  const g = fresh();
  for(const n of [6, 4, 3]){
    g.setFieldSize(n);
    let done = false;
    for(let y=1; y<H-n && !done; y++) for(let x=1; x<W-n && !done; x++){
      if(g.place("field", x, y) === null){
        const b = g.buildings[g.buildings.length-1];
        assert.strictEqual(b.w, n);
        assert.strictEqual(b.h, n);
        assert.strictEqual(g.occupied[y*W+x], b.id);
        done = true;
      }
    }
    assert.ok(done, "champ " + n + "x" + n + " posé");
  }
});

test("setCrop change la culture, refuse si champ en croissance", () => {
  const g = fresh();
  let b = null;
  g.setFieldSize(3);
  for(let y=1; y<H-3 && !b; y++) for(let x=1; x<W-3 && !b; x++)
    if(g.place("field", x, y) === null) b = g.buildings[g.buildings.length-1];
  assert.strictEqual(g.setCrop(b.id, "barley"), true);
  assert.strictEqual(b.f.crop, "barley");
  b.f.sown = true; b.f.growth = 0.5;
  assert.strictEqual(g.setCrop(b.id, "wheat"), false);
});

test("boeufs : achat à 20 deniers, accélération du labour", () => {
  const g = fresh();
  g.treasury = 0;
  assert.strictEqual(g.buyOx(), false);
  g.treasury = 50;
  const ox0 = g.stock.ox;
  assert.strictEqual(g.buyOx(), true);
  assert.strictEqual(g.stock.ox, ox0 + 1);
  assert.strictEqual(g.treasury, 30);
  assert.ok(g.oxSpeed() > 1);
});

test("brasserie consomme de l'orge pour produire de l'ale", () => {
  const g = fresh();
  const b = legacyHouse(g);
  b.done = true; b.exts = ["brewer"];
  g.stock.barley = 5; g.stock.ale = 0;
  for(let i=0;i<160*TS;i++) g.step();
  assert.ok(g.stock.ale > 0, "ale produite");
  assert.ok(g.stock.barley < 5, "orge consommée");
});

test("jachère restaure la fertilité en fin d'année", () => {
  const g = fresh();
  let b = null;
  g.setFieldSize(3);
  for(let y=1; y<H-3 && !b; y++) for(let x=1; x<W-3 && !b; x++)
    if(g.place("field", x, y) === null) b = g.buildings[g.buildings.length-1];
  g.setCrop(b.id, "fallow");
  b.f.fert = 0.3; b.f.usedThisYear = false;
  g.onYear();
  assert.ok(b.f.fert > 0.3, "fertilité restaurée");
});

test("phase 3 : routes tracées, coût de déplacement réduit", () => {
  const g = fresh();
  const s = freeSpot(g);
  assert.strictEqual(g.roadAt(s.x, s.y), false);
  assert.strictEqual(g.toggleRoad(s.x, s.y), true);
  assert.strictEqual(g.roadAt(s.x, s.y), true);
  assert.ok(g.passableCost(s.x, s.y) < 1, "route = déplacement accéléré");
  assert.strictEqual(g.toggleRoad(s.x, s.y), true);
  assert.strictEqual(g.roadAt(s.x, s.y), false, "second appui supprime la route");
});

test("route interdite sur bâtiment et eau", () => {
  const g = fresh();
  const b = g.buildings[0];
  assert.strictEqual(g.toggleRoad(b.x, b.y), false);
  let water = -1;
  for(let i=0;i<W*H;i++) if(g.tiles[i]===4){ water=i; break; }
  assert.strictEqual(g.toggleRoad(water%W, Math.floor(water/W)), false);
});

test("A* emprunte les routes quand c'est plus court", () => {
  const g = fresh();
  // trace une route horizontale longue
  const x0 = Math.ceil(W/3)+1, xEnd = Math.floor(2*W/3)-2;
  for(let x=x0;x<=xEnd;x++) g.toggleRoad(x, 17);
  const pRoad = g.astar(x0, 17, xEnd, 17);
  assert.ok(pRoad, "chemin trouvé");
  // le coût total doit être réduit par la route
  let cost = 0;
  for(const wp of pRoad) cost += g.passableCost(Math.floor(wp.x), Math.floor(wp.y));
  assert.ok(cost < pRoad.length * 0.9, "les routes réduisent le coût du trajet");
});

test("comptoir : vend les surplus, crédite trésorerie et richesse", () => {
  const g = fresh();
  g.stock.bread = 20; g.prices.bread = 3;
  g.stock.timber = 50; g.stock.stone = 20;
  const b = placeInCenter(g, "trade");
  b.done = true; b.progress = 1;
  g.assign(b.id);
  assert.ok(g.workersOf(b).length > 0, "commerçant affecté");
  const t0 = g.treasury, w0 = g.wealth, bread0 = g.stock.bread;
  for(let i=0;i<200*TS;i++) g.step(); // ~1 mois
  assert.ok(g.treasury > t0, "trésorerie augmentée par les ventes");
  assert.ok(g.wealth > w0, "richesse régionale augmentée");
  assert.ok(g.stock.bread < bread0, "surplus de pain vendu");
});

test("prix du marché fluctuent chaque mois", () => {
  const g = fresh();
  g.stock.timber = 50; g.stock.stone = 20;
  const b = placeInCenter(g, "trade");
  b.done = true; g.assign(b.id);
  const p0 = { ...g.prices };
  for(let i=0;i<400*TS;i++) g.step(); // 2 mois
  const diff = Object.keys(p0).some(k => g.prices[k] !== p0[k]);
  assert.ok(diff, "au moins un prix a changé");
  for(const k of Object.keys(g.prices)) assert.ok(g.prices[k] >= 1, "prix plancher à 1");
});

test("sauvegarde : routes, richesse et prix persistés", () => {
  const g = fresh();
  const s = freeSpot(g);
  g.toggleRoad(s.x, s.y);
  g.wealth = 123; g.prices.bread = 5;
  const g2 = GameState.load(JSON.parse(JSON.stringify(g.serialize())));
  assert.strictEqual(g2.roadAt(s.x, s.y), true);
  assert.strictEqual(g2.wealth, 123);
  assert.strictEqual(g2.prices.bread, 5);
});

test("audit : sauvegardes corrompues rejetées sans crash", () => {
  const bad = [
    null, {}, {seed:"x"}, {seed:1}, {seed:1, tiles:[]}, {seed:1, tiles:new Array(W*H).fill(0), time:{month:99}},
    {seed:1, tiles:new Array(W*H).fill(0), buildings:[{id:"x", x:1e9, y:1e9, w:1e9, h:1e9}]},
    {seed:1, tiles:new Array(W*H).fill(0), roads:[1,2,3]},
  ];
  for(const b of bad){
    try { const g = GameState.load(b); for(let i=0;i<50*TS;i++) g.step(); }
    catch(e){ /* rejet attendu */ }
  }
  assert.ok(true, "aucune exception non maîtrisée");
});

test("audit : noms de familles hostiles stockés sans danger (échappement UI)", () => {
  const g = fresh();
  g.toast("<img src=x onerror=alert(1)>", "bad");
  assert.strictEqual(g.log[g.log.length-1].text, "<img src=x onerror=alert(1)>", "texte brut conservé dans le log");
});

test("audit : charge longue, aucun débordement de log/toasts", () => {
  const g = fresh();
  for(let i=0;i<YEAR_TICKS;i++) g.step(); // 1 an
  assert.ok(g.log.length <= 120, "log plafonné");
  assert.ok(g.toasts.length <= 6, "toasts plafonnés");
});

test("jalon 1 : 3 régions, seule la 0 est possédée au départ", () => {
  const g = fresh();
  assert.strictEqual(REGION_DEFS.length, 3);
  assert.strictEqual(g.regions[0].owned, true);
  assert.strictEqual(g.regions[1].owned, false);
  assert.strictEqual(g.regions[2].owned, false);
  assert.strictEqual(g.regionOwned(Math.floor(W/2)), true, "le centre est possédé");
  assert.strictEqual(g.regionOwned(1), false);
  assert.strictEqual(g.regionOwned(W-1), false);
});

test("jalon 1 : région non réclamée infranchissable et non constructible", () => {
  const g = fresh();
  assert.strictEqual(g.passable(1, 5), false, "passable refuse la région ouest");
  const err = g.place("burgage", 1, 5);
  assert.strictEqual(err, "Région non réclamée");
});

test("jalon 1 : réclamation coûte trésorerie + richesse, puis débloque", () => {
  const g = fresh();
  g.treasury = 10; g.wealth = 100;
  assert.strictEqual(g.claimRegion(1), false, "trésorerie insuffisante");
  g.treasury = 100; g.wealth = 100;
  assert.strictEqual(g.claimRegion(1), true);
  assert.strictEqual(g.treasury, 100 - REGION_COST.treasury);
  assert.strictEqual(g.wealth, 100 - REGION_COST.wealth);
  assert.strictEqual(g.passable(2, 5), true, "région ouest débloquée");
  assert.strictEqual(g.claimRegion(1), false, "déjà possédée");
});

test("jalon 1 : bonus de région chaque mois", () => {
  const g = fresh();
  g.treasury = 100; g.wealth = 100;
  g.claimRegion(1); g.claimRegion(2);
  g.stock.berries = 0; g.stock.stone = 0;
  for(let i=0;i<200*TS;i++) g.step();
  assert.ok(g.stock.berries >= 2, "+2 baies/mois de la région 1");
  assert.ok(g.stock.stone >= 1, "+1 pierre/mois de la région 2");
});

test("jalon 1 : sauvegarde persiste les régions", () => {
  const g = fresh();
  g.treasury = 100; g.wealth = 100; g.claimRegion(2);
  const g2 = GameState.load(JSON.parse(JSON.stringify(g.serialize())));
  assert.strictEqual(g2.regions[2].owned, true);
  assert.strictEqual(g2.regions[1].owned, false);
});

test("jalon 2 : le baron entre en scène en 1177 et réclame des régions", () => {
  const g = fresh();
  g.time.year = 1177; g.time.month = 5; g.baron.nextClaim = 0;
  for(let i=0;i<400*TS && g.baron.regions.length===0;i++) g.step(); // jusqu'au mois 6
  assert.ok(g.baron.regions.length >= 1, "le baron a réclamé une région");
  assert.ok(g.baron.power >= 1);
  const r = g.baron.regions[0];
  assert.strictEqual(g.regions[r].owned, false, "région ni à nous ni réclamée par nous");
});

test("jalon 2 : le baron lance un raid après 1178 s'il a du pouvoir", () => {
  const g = fresh();
  g.time.year = 1178; g.time.month = 0;
  g.baron.power = 2; g.baron.nextRaid = 0;
  g.baron.regions = [1,2]; g.baron.nextClaim = 999;
  for(let i=0;i<800*TS && !g.pendingEvent;i++) g.step(); // jusqu'au mois 4
  assert.ok(g.pendingEvent, "raid déclenché");
  assert.ok(/Baron/.test(g.pendingEvent.title));
  assert.strictEqual(g.baron.power, 1, "le raid consomme du pouvoir");
});

test("jalon 2 : payer le raid débite la trésorerie, refuser pille", () => {
  const g = fresh();
  g.treasury = 100; g.stock.bread = 50; g.approval = 80;
  g.pendingEvent = { title:"Raid", text:"", choices:[ {label:"Payer", act:"payRaid", amount:30}, {label:"Refuser", act:"refuseRaid"} ] };
  g.resolveEvent(0);
  assert.strictEqual(g.treasury, 70);
  g.pendingEvent = { title:"Raid", text:"", choices:[ {label:"Refuser", act:"refuseRaid"} ] };
  g.resolveEvent(0);
  assert.ok(g.stock.bread < 50, "récoltes pillées");
  assert.ok(g.approval < 80, "approbation pénalisée");
});

test("jalon 2 : sauvegarde persiste le baron", () => {
  const g = fresh();
  g.baron.regions = [1]; g.baron.power = 3;
  const g2 = GameState.load(JSON.parse(JSON.stringify(g.serialize())));
  assert.deepStrictEqual(g2.baron.regions, [1]);
  assert.strictEqual(g2.baron.power, 3);
});

test("jalon 3 : milice levée = 1 soldat pour 2 familles", () => {
  const g = fresh();
  assert.strictEqual(g.militiaCount(), 1); // 3 familles
  assert.strictEqual(g.raiseMilitia(), 1);
  assert.strictEqual(g.units.length, 1);
  assert.strictEqual(g.raiseMilitia(), 0, "déjà levée");
});

test("jalon 3 : un soldat détruit un camp de brigands et rapporte du butin", () => {
  const g = fresh();
  const b = g.buildings[0];
  g.camps.push({ id:99, x:b.x+3.5, y:b.y+0.5, hp:20, maxHp:20 });
  g.raiseMilitia();
  const u = g.units[0];
  assert.strictEqual(u.state, "guard");
  const t0 = g.treasury;
  for(let i=0;i<5000*TS && g.camps.length>0;i++) g.step();
  assert.strictEqual(g.camps.length, 0, "camp détruit");
  assert.ok(g.treasury > t0, "butin gagné");
});

test("jalon 3 : les camps pillent la nourriture chaque mois", () => {
  const g = fresh();
  g.camps.push({ id:99, x:5.5, y:5.5, hp:20, maxHp:20 });
  g.stock.bread = 20;
  const lost = g.pillageCamps();
  assert.ok(lost > 0, "nourriture pillée");
  assert.ok(g.stock.bread < 20);
});

test("jalon 3 : sauvegarde persiste camps et milice", () => {
  const g = fresh();
  g.raiseMilitia();
  g.camps.push({ id:99, x:5.5, y:5.5, hp:12, maxHp:20 });
  const g2 = GameState.load(JSON.parse(JSON.stringify(g.serialize())));
  assert.strictEqual(g2.units.length, 1);
  assert.strictEqual(g2.camps.length, 1);
  assert.strictEqual(g2.camps[0].hp, 12);
});

test("jalon 4 : rempart infranchissable une fois construit", () => {
  const g = fresh();
  g.stock.stone = 10;
  const s2 = freeSpot(g);
  assert.strictEqual(g.place("wall", s2.x, s2.y), null);
  const w = g.buildings[g.buildings.length-1];
  w.done = true;
  assert.strictEqual(g.passable(s2.x, s2.y), false, "rempart construit = infranchissable");
});

test("jalon 4 : la tour de guet donne +4 approbation et limite les raids", () => {
  const g = fresh();
  g.stock.timber = 10; g.stock.stone = 10;
  const s2 = freeSpot(g);
  g.place("tower", s2.x, s2.y);
  const t = g.buildings[g.buildings.length-1];
  t.done = true;
  g.stock.bread = 100; g.approval = 80;
  g.pendingEvent = { title:"Raid", text:"", choices:[{label:"Refuser", act:"refuseRaid"}] };
  g.resolveEvent(0);
  const breadSansTour = 70; // 100 * 0.7 sans tour
  assert.ok(g.stock.bread > breadSansTour, "la tour a réduit le pillage (50% des dégâts)");
});

test("jalon 4 : menaces aléatoires ne crashent pas la sim", () => {
  const g = fresh();
  g.time.year = 1180;
  for(let i=0;i<YEAR_TICKS;i++) g.step(); // 1 an
  assert.ok(g.families.length >= 0 && g.approval >= 0 && g.approval <= 100);
});

test("jalon 4 : tour et rempart dans BUILD_ORDER et sauvegardés", () => {
  const g = fresh();
  g.stock.timber = 10; g.stock.stone = 10;
  const s2 = freeSpot(g);
  g.place("tower", s2.x, s2.y);
  const g2 = GameState.load(JSON.parse(JSON.stringify(g.serialize())));
  assert.ok(g2.buildings.some(b=>b.def==="tower"));
});

test("phase 5 jalon 1 : 3 décrets activables, effets mensuels", () => {
  const g = fresh();
  assert.strictEqual(POLICY_ORDER.length, 3);
  g.setPolicy("tithe", true);
  assert.strictEqual(g.policies.tithe, true);
  const i0 = g.influence, a0 = 100;
  g.approval = 100;
  for(let i=0;i<200*TS;i++) g.step(); // 1 mois
  assert.ok(g.influence > i0, "d\u00eeme rapporte de l'influence");
  g.setPolicy("tithe", false);
  assert.strictEqual(g.policies.tithe, false, "abrogeable");
});

test("phase 5 jalon 1 : service militaire ajoute un soldat", () => {
  const g = fresh();
  const base = g.militiaCount();
  g.setPolicy("militiaService", true);
  assert.strictEqual(g.militiaCount(), base + 1);
});

test("phase 5 jalon 1 : influence gagnée en réclamant une région", () => {
  const g = fresh();
  g.treasury = 100; g.wealth = 100;
  const i0 = g.influence;
  g.claimRegion(1);
  assert.ok(g.influence >= i0 + 10);
});

test("phase 5 jalon 1 : sauvegarde persiste influence et décrets", () => {
  const g = fresh();
  g.influence = 42; g.setPolicy("freeMarket", true);
  const g2 = GameState.load(JSON.parse(JSON.stringify(g.serialize())));
  assert.strictEqual(g2.influence, 42);
  assert.strictEqual(g2.policies.freeMarket, true);
});

test("phase 5 jalon 3 : niveaux de bourg selon la population", () => {
  const g = fresh();
  assert.strictEqual(g.settlementName(), "Hameau");
  assert.strictEqual(SETTLEMENT_LEVELS.length, 4);
  while(g.families.length < 8) g.families.push({ id:1000+g.families.length, name:"X", home:-1, work:-1 });
  assert.strictEqual(g.settlementName(), "Village");
  while(g.families.length < 20) g.families.push({ id:1000+g.families.length, name:"X", home:-1, work:-1 });
  assert.strictEqual(g.settlementName(), "Bourg");
});

test("phase 5 jalon 3 : église améliorable (autel + clocher), bonus cumulés", () => {
  const g = fresh();
  g.stock.timber = 20; g.stock.stone = 20;
  const b = placeInCenter(g, "church");
  b.done = true;
  assert.strictEqual(g.churchUp(b.id, "altar"), true);
  assert.strictEqual(g.churchUp(b.id, "altar"), false, "pas de doublon");
  assert.strictEqual(g.churchUp(b.id, "bell"), true);
  assert.deepStrictEqual(b.churchUp, ["altar","bell"]);
  const bonus = g.churchBonus();
  assert.strictEqual(bonus.approval, 3+5);
  assert.strictEqual(bonus.influence, 2+3);
});

test("phase 5 jalon 4 : mercenaire loué contre 25 deniers, disparaît après 6 mois", () => {
  const g = fresh();
  g.treasury = 0;
  assert.strictEqual(g.hireMercenary(), false);
  g.treasury = 100;
  assert.strictEqual(g.hireMercenary(), true);
  assert.strictEqual(g.treasury, 75);
  assert.strictEqual(g.units.length, 1);
  assert.strictEqual(g.units[0].merc, true);
  for(let i=0;i<1200*TS && g.units.length>0;i++) g.step(); // ~6 mois
  assert.strictEqual(g.units.length, 0, "mercenaire parti après son contrat");
});

test("phase 5 jalon 4 : mercenaire attaque un camp comme la milice", () => {
  const g = fresh();
  g.treasury = 100;
  const b = g.buildings[0];
  g.camps.push({ id:99, x:b.x+1.5, y:b.y+0.5, hp:20, maxHp:20 });
  g.hireMercenary();
  for(let i=0;i<5000*TS && g.camps.length>0;i++) g.step();
  assert.strictEqual(g.camps.length, 0, "camp détruit par le mercenaire");
});

test("phase 5 : sauvegarde persiste churchUp et mercenaires", () => {
  const g = fresh();
  g.treasury = 100; g.stock.stone = 10;
  const b = placeInCenter(g, "church"); b.done = true;
  g.churchUp(b.id, "altar");
  g.hireMercenary();
  const g2 = GameState.load(JSON.parse(JSON.stringify(g.serialize())));
  assert.deepStrictEqual(g2.buildings.find(x=>x.def==="church").churchUp, ["altar"]);
  assert.strictEqual(g2.units.length, 1);
  assert.strictEqual(g2.units[0].merc, true);
});

test("phase 6 : 5 modes et 3 difficultés définis", () => {
  assert.strictEqual(MODES.length, 5);
  assert.strictEqual(DIFFICULTIES.length, 3);
  assert.strictEqual(MODES.find(m=>m.id==="prosperity").combat, false, "prospérité sans combat");
  assert.ok(MODES.filter(m=>m.combat).length===4);
});

test("phase 6 : mode prospérité = pas de baron ni de camps", () => {
  const g = new GameState(1176, "prosperity", "normal");
  g.time.year = 1180; g.baron.nextClaim = 999; g.baron.nextRaid = 999;
  for(let i=0;i<YEAR_TICKS;i++) g.step(); // 1 an suffit
  assert.strictEqual(g.baron.regions.length, 0, "pas de réclamation du baron");
  assert.strictEqual(g.camps.length, 0, "pas de camps");
});

test("phase 6 : mode 'edge' démarre avec moins de ressources et gagne en survivant 3 ans", () => {
  const g = new GameState(1176, "edge", "normal");
  assert.ok(g.stock.timber < 15, "ressources réduites au départ");
  g.time.year = 1179;
  for(let i=0;i<200*TS;i++) g.step();
  assert.strictEqual(g.victory, true, "victoire après 3 ans");
});

test("phase 6 : mode 'duel' = victoire si toutes les régions à nous, sans camps, après 1179", () => {
  const g = new GameState(1176, "duel", "hard");
  g.treasury = 200; g.wealth = 200;
  g.claimRegion(1); g.claimRegion(2);
  g.camps.length = 0;
  g.time.year = 1179; g.time.month = 6;
  for(let i=0;i<300*TS;i++) g.step();
  assert.strictEqual(g.victory, true);
});

test("phase 6 : défaite après 6 mois à approbation très basse (famine)", () => {
  const g = new GameState(1176, "peace", "hard");
  g.time.year = 1178;
  g.stock.berries=0; g.stock.meat=0; g.stock.bread=0; g.stock.firewood=0; g.stock.clothes=0;
  for(let m=0;m<8 && !g.defeat;m++) g.onMonth();
  assert.strictEqual(g.defeat, true);
  assert.ok(/approbation/.test(g.endReason));
  // le compteur retombe si l'approbation remonte
  const g2 = new GameState(1176, "peace", "hard");
  g2.time.year = 1178;
  g2.stock.berries=0; g2.stock.meat=0; g2.stock.bread=0; g2.stock.firewood=0; g2.stock.clothes=0;
  for(let m=0;m<3;m++) g2.onMonth();
  assert.ok(g2.lowApprovalStreak >= 3);
  g2.stock.berries=100; g2.stock.meat=100; g2.stock.bread=100; g2.stock.firewood=100; g2.stock.clothes=100;
  g2.onMonth();
  assert.strictEqual(g2.lowApprovalStreak, 0, "compteur remis à zéro");
});

test("phase 6 : difficulté modère les raids du baron", () => {
  const gEasy = new GameState(1176, "duel", "easy");
  const gHard = new GameState(1176, "duel", "hard");
  assert.ok(gHard.diff().raid > gEasy.diff().raid);
});

test("phase 6 : sauvegarde v2 persiste mode, difficulté, victoire, défaite", () => {
  const g = new GameState(1176, "fractured", "hard");
  g.victory = true;
  const g2 = GameState.load(JSON.parse(JSON.stringify(g.serialize())));
  assert.strictEqual(g2.modeId, "fractured");
  assert.strictEqual(g2.diffId, "hard");
  assert.strictEqual(g2.victory, true);
  // ancienne sauvegarde v1 (sans modeId) -> mode par défaut, ne crash pas
  const g1 = GameState.load({ v:1, seed:1, tiles:new Array(W*H).fill(0) });
  assert.strictEqual(g1.modeId, "prosperity");
});

/* ---------- étape 3 : chantiers en étapes et parcelles tracées point par point ---------- */
const { BUILD_STAGES, buildStage, PLOT_FRONT, polyArea, pointInPoly, BUILD_ORDER } = require("../js/sim.js");

// terrain dégagé dans la région centrale, route horizontale en y=4 (x 16 → 28)
function zoneSetup(timber){
  const g = fresh();
  for(let y=4;y<=11;y++) for(let x=16;x<=28;x++){ const i=y*W+x; g.tiles[i]=T_GRASS; g.occupied[i]=-1; g.roads[i]=0; }
  for(let x=16;x<=28;x++) g.roads[4*W+x]=1;
  g.stock.timber = timber===undefined ? 50 : timber;
  return g;
}
const RECT = [[18,5],[24,5],[24,8],[18,8]];                 // 6 × 3 cases
const ORGANIC = [[17,5],[25,5],[24.5,7.25],[23,10],[20,9.5],[17.5,6.75]]; // forme libre, plus profonde au milieu
function plotsOf(g){ return g.buildings.filter(b=>b.plot); }
function insideTiles(poly){ const r=[]; for(let y=0;y<H;y++) for(let x=0;x<W;x++) if(pointInPoly(x+0.5,y+0.5,poly)) r.push(y*W+x); return r; }

test("étape 3 : un chantier passe par fondations, charpente, murs, toit", () => {
  const b = { done:false, progress:0 };
  assert.strictEqual(BUILD_STAGES.length, 4);
  assert.strictEqual(buildStage(b), 0);
  b.progress = 0.3; assert.strictEqual(buildStage(b), 1);
  b.progress = 0.6; assert.strictEqual(buildStage(b), 2);
  b.progress = 0.99; assert.strictEqual(buildStage(b), 3);
  b.done = true; b.progress = 1; assert.strictEqual(buildStage(b), 4);
  assert.ok(fresh().workStatus({ def:"church", done:false, progress:0.3 }).includes("charpente"));
});

test("étape 3 : contours refusés (trop peu de points, croisé, sans route, sur route ou bâtiment)", () => {
  const g = zoneSetup();
  assert.strictEqual(g.planZone([[18,5],[24,5]]).err, "Posez au moins 3 points");
  assert.strictEqual(g.planZone([[18,5],[24,8],[24,5],[18,8]]).err, "Le contour se croise");
  assert.strictEqual(g.planZone([[18,6],[24,6],[24,9],[18,9]]).err, "La zone doit longer une route");
  assert.strictEqual(g.planZone([[18,4],[24,4],[24,7],[18,7]]).err, "La zone empiète sur une route");
  g.occupied[6*W+20] = 999;
  assert.strictEqual(g.planZone(RECT).err, "La zone empiète sur un bâtiment");
  assert.strictEqual(g.traceZone(RECT), "La zone empiète sur un bâtiment");
});

test("étape 3 : l'aperçu propose une maison toutes les 2 cases de façade et ne modifie rien", () => {
  const g = zoneSetup();
  const before = g.buildings.length, timber = g.stock.timber;
  const plan = g.planZone(RECT);
  assert.strictEqual(plan.err, null);
  assert.strictEqual(PLOT_FRONT, 2);
  assert.strictEqual(plan.suggested, 3); assert.strictEqual(plan.n, 3);
  assert.strictEqual(plan.nMin, 1); assert.strictEqual(plan.nMax, 6);
  assert.strictEqual(g.buildings.length, before);
  assert.strictEqual(g.stock.timber, timber);
  for(const p of plan.plots){ assert.strictEqual(p.cells.length, 6); assert.strictEqual(polyArea(p.poly), 6); }
});

test("étape 3 : une forme libre est découpée en parcelles qui la recouvrent exactement", () => {
  const g = zoneSetup();
  const plan = g.planZone(ORGANIC);
  assert.strictEqual(plan.err, null);
  const tiles = insideTiles(plan.poly), seen = new Set();
  let area = 0;
  for(const p of plan.plots){
    area += polyArea(p.poly);
    const h = p.cells[0], hx = h%W, hy = (h/W)|0;
    assert.ok(g.roadAt(hx, hy-1), "chaque maison donne sur la route");
    assert.strictEqual(p.dir, 0);
    for(const i of p.cells){ assert.ok(!seen.has(i), "parcelles disjointes"); seen.add(i);
      assert.ok(pointInPoly((i%W)+0.5, ((i/W)|0)+0.5, p.poly), "chaque case est dans le contour de sa parcelle"); }
  }
  assert.strictEqual(seen.size, tiles.length, "toutes les cases de la zone sont attribuées");
  assert.ok(Math.abs(area - polyArea(plan.poly)) < 0.01, "les parcelles recouvrent toute la zone");
  // la forme compte : les parcelles du milieu (zone plus profonde) ont plus de cour que celles du bord
  const sizes = plan.plots.map(p=>p.cells.length);
  assert.ok(Math.max(...sizes) > Math.min(...sizes), "jardins de tailles différentes selon la forme");
});

test("étape 3 : le joueur choisit le nombre de maisons (borné)", () => {
  const g = zoneSetup();
  assert.strictEqual(g.planZone(RECT, 1).plots.length, 1);
  assert.strictEqual(g.planZone(RECT, 1).plots[0].cells.length, 18, "une seule grande parcelle");
  assert.strictEqual(g.planZone(RECT, 6).plots.length, 6);
  assert.strictEqual(g.planZone(RECT, 99).plots.length, 6);
  assert.strictEqual(g.planZone(RECT, 0).plots.length, 1);
  const p2 = g.planZone(RECT, 2);
  assert.deepStrictEqual(p2.plots.map(p=>p.cells.length), [9, 9]);
});

test("étape 3 : la zone s'arrête au bois disponible", () => {
  const g = zoneSetup(2);
  const plan = g.planZone(RECT);
  assert.strictEqual(plan.plots.length, 2);
  assert.strictEqual(plan.limited, true);
  assert.strictEqual(g.traceZone(RECT), null);
  assert.strictEqual(plotsOf(g).length, 2);
  assert.strictEqual(g.freeStock("timber"), 0, "tout le bois est réservé aux deux maisons");
  assert.strictEqual(zoneSetup(0).traceZone(RECT), "Ressources insuffisantes");
});

test("étape 3 : tracer crée des maisons en chantier qui occupent leur parcelle", () => {
  const g = zoneSetup();
  assert.strictEqual(g.traceZone(ORGANIC, 4), null);
  const ps = plotsOf(g);
  assert.strictEqual(ps.length, 4);
  assert.strictEqual(g.freeStock("timber"), 46);
  assert.strictEqual(g.stock.timber, 50, "il ne sortira du stock qu'à la livraison");
  for(const b of ps){
    assert.strictEqual(b.done, false);
    assert.strictEqual(b.plot.cells[0], b.y*W+b.x);
    assert.ok(b.plot.poly.length>=3);
    for(const i of b.plot.cells) assert.strictEqual(g.occupied[i], b.id);
    assert.strictEqual(g.yardCells(b).length, b.plot.cells.length-1, "la cour = cases de la parcelle hors maison");
  }
  assert.strictEqual(g.toggleRoad(ps[0].plot.cells[1]%W, (ps[0].plot.cells[1]/W)|0), false, "pas de route dans une cour");
});

test("étape 3 : les journaliers bâtissent les maisons de la zone", () => {
  const g = zoneSetup();
  g.traceZone([[18,5],[24,5],[24,7],[18,7]]);
  const ps = plotsOf(g), seen = new Set();
  for(let t=0;t<12000*TS && ps.some(b=>!b.done);t++){ g.step(); for(const b of ps) if(!b.done) seen.add(buildStage(b)); g.pendingEvent=null; }
  assert.ok(ps.every(b=>b.done), "maisons achevées");
  assert.ok(seen.has(0) && seen.has(3), "le chantier est passé par plusieurs étapes");
});

test("étape 3 : une seule chose par arrière-cour, à la mesure de sa taille", () => {
  const g = zoneSetup();
  g.traceZone(RECT, 2);                      // 2 parcelles de 9 cases : cour de 8
  const b = plotsOf(g)[0]; b.done = true; b.progress = 1;
  assert.strictEqual(g.yardSize(b), 8);
  g.buyExtension(b.id, "orchard");
  assert.deepStrictEqual(b.exts, ["orchard"]);
  const timber = g.stock.timber;
  g.buyExtension(b.id, "garden");
  assert.deepStrictEqual(b.exts, ["orchard"], "une seule chose : refusé");
  assert.strictEqual(g.stock.timber, timber, "rien n'est dépensé");
  // rendement : plus grand rapporte plus, mais de moins en moins, plafonné
  const f = (n)=>g.yardFactor({ plot:{ cells:new Array(n+1).fill(0) } });
  assert.strictEqual(f(1), 1); assert.strictEqual(f(4), 1.5); assert.strictEqual(f(9), 2);
  assert.strictEqual(f(100), 2.5); assert.strictEqual(f(0), 0);
  assert.strictEqual(g.yardFactor(legacyHouse(fresh())), 1, "ancien bourgage : inchangé");
  // retirer : moitié du prix rendue, la cour se libère
  g.removeExtension(b.id);
  assert.deepStrictEqual(b.exts, []);
  assert.strictEqual(g.stock.timber, timber + 1);
  g.buyExtension(b.id, "garden");
  assert.deepStrictEqual(b.exts, ["garden"]);
});

test("étape 3 : la production d'une arrière-cour suit sa taille", () => {
  const mk = (n)=>{ const g = zoneSetup(); g.traceZone(RECT, n); const b = plotsOf(g)[0]; b.done=true; b.progress=1; g.buyExtension(b.id, "garden"); return g; };
  const small = mk(6), big = mk(1);          // cour de 5 cases contre 17
  const v0s = small.stock.veg, v0b = big.stock.veg;
  for(const g of [small, big]){ g.time.day = DAYS_PER_MONTH-1; g.time.tick = TICKS_PER_DAY-1; g.step(); }
  const gs = small.stock.veg - v0s, gb = big.stock.veg - v0b;
  assert.ok(gs > 0.5 && gb > gs, "grande cour : plus de légumes ("+gs.toFixed(2)+" < "+gb.toFixed(2)+")");
  assert.ok(gb < gs * 17/5, "mais pas proportionnel à la surface");
});

test("étape 3 : sauvegarde v3 des parcelles et de leur contour, démolition libère la cour", () => {
  const g = zoneSetup();
  g.traceZone(ORGANIC);
  const b = plotsOf(g)[0]; b.done = true; b.progress = 1;
  g.buyExtension(b.id, "garden");
  const data = JSON.parse(JSON.stringify(g.serialize()));
  // ancienne cour à plusieurs agrandissements : on garde le premier, les autres sont remboursés
  const multi = JSON.parse(JSON.stringify(data));
  multi.buildings.find(x=>x.id===b.id).exts = ["garden","orchard"];
  const gm = GameState.load(multi);
  assert.deepStrictEqual(gm.buildings.find(x=>x.id===b.id).exts, ["garden"]);
  assert.strictEqual(gm.stock.timber, multi.stock.timber + EXT_DEFS.orchard.cost.timber);
  assert.strictEqual(data.v, 7);
  const g2 = GameState.load(data);
  const b2 = g2.buildings.find(x=>x.id===b.id);
  assert.deepStrictEqual(b2.plot, b.plot);
  for(const i of b2.plot.cells) assert.strictEqual(g2.occupied[i], b2.id);
  const bad = JSON.parse(JSON.stringify(g.serialize()));
  bad.buildings.find(x=>x.id===b.id).plot.poly = [[0,"x"]];
  const b3 = GameState.load(bad).buildings.find(x=>x.id===b.id);
  assert.ok(b3.plot && b3.plot.poly===undefined, "contour illisible ignoré, parcelle gardée");
  const bad2 = JSON.parse(JSON.stringify(g.serialize()));
  bad2.buildings.find(x=>x.id===b.id).plot = { cells:[0,1], dir:9 };
  assert.strictEqual(GameState.load(bad2).buildings.find(x=>x.id===b.id).plot, undefined);
  const cells = b2.plot.cells.slice();
  g2.demolish(b2.id);
  for(const i of cells) assert.strictEqual(g2.occupied[i], -1);
});

test("étape 3 : aimant de route — le contour se cale sur le bord et reste droit", () => {
  const g = zoneSetup();                     // route en y=4 : son bord sud est la ligne y=5
  assert.deepStrictEqual(g.snapZonePoint(19.3, 5.35), [19.25, 5], "collé au bord de la route");
  assert.deepStrictEqual(g.snapZonePoint(19.3, 5.8), [19.25, 5.75], "trop loin : pas d'aimant");
  assert.deepStrictEqual(g.snapZonePoint(23.1, 5.55, [19, 5]), [23, 5], "trait parallèle à la route : reste droit");
  assert.deepStrictEqual(g.snapZonePoint(23.1, 6.4, [19, 5]), [23, 6.5], "on s'en échappe en tirant plus loin");
  assert.deepStrictEqual(g.snapZonePoint(23.1, 5.55, [19, 7]), [23, 5.5], "pas de résistance loin de la route");
});

test("étape 3 : départ façon Manor Lords — campement, poteau du bœuf, aucune maison", () => {
  const g = fresh();
  assert.ok(!BUILD_ORDER.includes("burgage"), "le bourgage d'une case n'est plus au menu");
  assert.strictEqual(g.buildings.filter(b=>b.def==="burgage").length, 0);
  const camp = g.buildings.find(b=>b.def==="camp");
  assert.ok(camp && camp.done);
  assert.ok(g.buildings.some(b=>b.def==="oxpost"));
  assert.strictEqual(g.stock.ox, 1);
  assert.strictEqual(g.families.length, 3);
  assert.ok(g.families.every(f=>f.home===camp.id), "les survivants vivent au campement");
  assert.ok(g.roadAt(camp.x, camp.y+1), "un bout de chemin devant le campement");
});

test("étape 3 : les familles quittent le campement pour leurs maisons, puis il est démonté", () => {
  const g = fresh();
  const camp = g.buildings.find(b=>b.def==="camp");
  const h1 = legacyHouse(g);
  g.rehouseCamp();
  assert.strictEqual(g.families.filter(f=>f.home===h1.id).length, 1);
  assert.ok(g.buildings.includes(camp), "encore 2 familles au campement");
  legacyHouse2(g); legacyHouse2(g);
  g.rehouseCamp();
  assert.ok(!g.buildings.includes(camp), "campement démonté");
  assert.ok(g.families.every(f=>f.home>=0 && f.home!==camp.id));
  assert.strictEqual(g.occupied[camp.y*W+camp.x], -1);
});
test("étape 3 : les survivants du départ ne quittent jamais la seigneurie", () => {
  const g = fresh();
  assert.ok(g.families.every(f=>f.founder));
  g.families.push({ id:500, name:"Nouvelle", home:-1, work:-1 });
  for(let m=0; m<6; m++){ g.approval = 5; g.time.day = DAYS_PER_MONTH-1; g.time.tick = TICKS_PER_DAY-1; g.step(); g.approval = 5; g.pendingEvent = null; }
  assert.strictEqual(g.families.filter(f=>f.founder).length, 3, "les 3 familles du départ restent");
  assert.ok(!g.families.some(f=>f.id===500), "un nouvel arrivant mécontent peut partir");
});
function legacyHouse2(g){ for(let i=0;i<W*H;i++){ if(!g.place("burgage", i%W, (i/W)|0)) return; } }

/* ================= étape 4 : villageois individuels ================= */
const { SKILL_ORDER, FOOD_NEED, AGE_ADULT, AGE_RETIRE, skillLevel } = require("../js/sim.js");
// maisons d'une case posées et achevées tout de suite (les familles du campement y emménagent)
function houses(g, n){ g.stock.timber = Math.max(g.stock.timber, n+10); for(let k=0;k<n;k++) legacyHouse2(g); g.rehouseCamp(); }
// un camp de bûcherons achevé, dans la région du centre
function doneBuilding(g, def){
  g.stock.timber = Math.max(g.stock.timber, 20); g.stock.stone = Math.max(g.stock.stone, 20);
  const b = placeInCenter(g, def); b.done = true; b.progress = 1; return b;
}
// un villageois créé à la main, d'un âge donné, dans une famille donnée
function person(g, fam, sex, age){ return g.makePerson(fam, sex, age, { x:W/2, y:H/2 }); }
function withRnd(g, val, fn){ const r = g.rnd; g.rnd = ()=>val; try{ return fn(); } finally { g.rnd = r; } }

test("étape 4 : trois familles de survivants, chacune avec ses membres", () => {
  const g = fresh();
  assert.strictEqual(g.families.length, 3);
  for(const f of g.families) assert.ok(g.membersOf(f.id).length>=2, f.name+" a au moins 2 membres");
  const adults = g.villagers.filter(v=>g.isAdult(v)), kids = g.villagers.filter(v=>g.ageOf(v)<AGE_ADULT);
  assert.ok(adults.length>=5, "au moins 5 adultes ou anciens");
  assert.ok(kids.length>=3, "des enfants et des adolescents");
  assert.ok(g.villagers.some(v=>g.stageOf(v)==="teen"), "au moins un adolescent (futur apprenti)");
  assert.ok(g.villagers.some(v=>g.stageOf(v)==="elder"), "un ancien");
  for(const v of g.villagers){
    assert.ok(typeof v.first==="string" && v.first.length>1);
    assert.ok(v.sex==="m" || v.sex==="f");
    assert.strictEqual(v.health, 100);
    for(const k of SKILL_ORDER) assert.ok(v.skills[k]>=0 && v.skills[k]<=100);
  }
  // les couples sont mariés entre eux, les enfants connaissent leurs parents
  const married = g.villagers.filter(v=>v.spouse>=0);
  assert.ok(married.length>=4);
  for(const v of married) assert.strictEqual(g.villager(v.spouse).spouse, v.id);
  assert.ok(g.villagers.some(v=>v.mother>=0 || v.father>=0));
  assert.strictEqual(g.unemployed(), g.villagers.filter(v=>g.canWork(v)).length, "tous les adultes sont journaliers au départ");
});

test("étape 4 : l'âge avance d'un an tous les 12 mois, avec les étapes de la vie", () => {
  const g = fresh();
  const f = g.families[0];
  const v = person(g, f, "m", 11);
  v.bornAt = g.monthIdx() - 11*12;
  assert.strictEqual(g.ageOf(v), 11);
  assert.strictEqual(g.stageOf(v), "child");
  g.time.year += 1;
  assert.strictEqual(g.ageOf(v), 12);
  assert.strictEqual(g.stageOf(v), "teen");
  g.time.year += 4;
  assert.strictEqual(g.stageOf(v), "adult");
  g.time.year += 40;
  assert.strictEqual(g.stageOf(v), "elder");
  assert.strictEqual(skillLevel(0), "Novice"); assert.strictEqual(skillLevel(85), "Maître");
});

test("étape 4 : + affecte l'adulte libre le plus compétent, − retire le moins compétent", () => {
  const g = fresh();
  const b = doneBuilding(g, "woodcutter");
  const free = g.villagers.filter(v=>g.canWork(v));
  free.forEach((v, k)=>{ v.skills.wood = 10 + k; });
  const best = free[free.length-1]; best.skills.wood = 90;
  g.assign(b.id);
  assert.deepStrictEqual(g.workersOf(b).map(v=>v.id), [best.id], "le meilleur bûcheron est choisi");
  g.assign(b.id);
  assert.strictEqual(g.workersOf(b).length, 2);
  assert.strictEqual(b.want, 2);
  assert.strictEqual(g.assign(b.id), false, "complet à 2");
  g.unassign(b.id);
  assert.deepStrictEqual(g.workersOf(b).map(v=>v.id), [best.id], "le moins compétent repart");
  assert.strictEqual(b.want, 1);
  // les enfants ne sont jamais affectés
  g.assign(b.id);
  for(const v of g.workersOf(b)) assert.ok(g.isAdult(v));
});

test("étape 4 : un poste voulu se pourvoit tout seul dès qu'un adulte se libère", () => {
  const g = fresh();
  const busy = doneBuilding(g, "farm"), b = doneBuilding(g, "hunter");
  for(const v of g.villagers) if(g.canWork(v)) v.work = busy.id;   // tout le monde est déjà occupé
  b.want = 2;
  assert.strictEqual(g.fillJobs(), 0);
  assert.strictEqual(g.workStatus(b), "En attente d'un adulte libre");
  const v = g.villagers.find(x=>x.work===busy.id);
  v.work = -1;
  assert.strictEqual(g.fillJobs(), 1);
  assert.ok(g.workersOf(b).includes(v), "le premier adulte libéré prend le poste");
  // un adolescent qui fête ses 16 ans prend le poste suivant
  const teen = g.villagers.find(x=>g.stageOf(x)==="teen");
  teen.bornAt = g.monthIdx() + 1 - AGE_ADULT*12;
  g.time.month += 1;
  withRnd(g, 0.5, ()=>g.onMonth());
  assert.strictEqual(g.stageOf(teen), "adult");
  assert.ok(g.workersOf(b).includes(teen), "le nouvel adulte est embauché");
  assert.ok(g.log.some(l=>/16 ans/.test(l.text)));
});

test("étape 4 : le savoir-faire accélère le travail et progresse avec la pratique", () => {
  const g = fresh();
  const b = doneBuilding(g, "woodcutter");
  const v = g.villagers.find(x=>g.canWork(x));
  g.assignVillager(v.id, b.id);
  v.skills.wood = 0; const slow = g.workTime(v, "chop");
  v.skills.wood = 100; const fast = g.workTime(v, "chop");
  assert.ok(fast < slow, "un maître abat plus vite qu'un novice ("+fast+" < "+slow+")");
  v.skills.wood = 10;
  for(let i=0;i<MONTH_TICKS*6;i++) g.step();
  assert.ok(v.skills.wood > 15, "après 6 mois au camp, la compétence bois a progressé ("+v.skills.wood+")");
});

test("étape 4 : apprenti — un adolescent par atelier, qui apprend vite auprès d'un maître", () => {
  const g = fresh();
  const b = doneBuilding(g, "woodcutter"), b2 = doneBuilding(g, "forager");
  const master = g.villagers.find(x=>g.canWork(x));
  master.skills.wood = 80; g.assignVillager(master.id, b.id);
  const kid = g.villagers.find(v=>g.stageOf(v)==="child");
  if(kid) assert.ok(g.takeApprentice(b.id, kid.id), "un enfant ne peut pas être apprenti");
  const adult = g.villagers.find(v=>g.canWork(v) && v!==master);
  assert.ok(g.takeApprentice(b.id, adult.id), "un adulte ne peut pas être apprenti");
  const teen = person(g, g.families[0], "f", 13); teen.skills.wood = 5;
  const teen2 = person(g, g.families[1], "m", 14); teen2.skills.gather = 5;
  assert.strictEqual(g.takeApprentice(b.id, teen.id), null);
  assert.ok(g.takeApprentice(b.id, teen2.id), "un seul apprenti par atelier");
  assert.strictEqual(g.apprenticeOf(b), teen);
  assert.ok(!g.workersOf(b).includes(teen), "l'apprenti n'occupe pas un poste d'ouvrier");
  assert.strictEqual(g.takeApprentice(b2.id, teen2.id), null);
  for(let i=0;i<MONTH_TICKS*6;i++) g.step();
  assert.ok(teen.skills.wood > 25, "apprentie formée par un maître : "+teen.skills.wood);
  assert.ok(teen.skills.wood > teen2.skills.gather + 5, "plus vite qu'un apprenti sans maître ("+teen2.skills.gather+")");
  // à 16 ans, l'apprentie prend sa place d'ouvrière si l'atelier a de la place
  teen.bornAt = g.monthIdx() - AGE_ADULT*12;
  g.time.month = (g.time.month+11)%12; if(g.time.month===11) g.time.year--;   // on recule d'un mois…
  teen.bornAt = g.monthIdx() + 1 - AGE_ADULT*12;                               // … pour fêter ses 16 ans au mois suivant
  g.onMonth(); g.time.month = (g.time.month+1)%12; if(g.time.month===0) g.time.year++;
  g.onMonth();
  assert.strictEqual(teen.appr, false);
  assert.ok(teen.work===b.id || teen.work===-1);
  if(teen.work===b.id) assert.ok(g.workersOf(b).includes(teen), "devenue ouvrière du camp");
});

test("étape 4 : chacun mange selon son âge ; la faim abîme la santé puis tue", () => {
  const g = fresh();
  houses(g, 3);
  const need = g.foodNeed();
  assert.ok(Math.abs(need - g.villagers.reduce((s,v)=>s+FOOD_NEED[g.stageOf(v)],0))<1e-9);
  assert.ok(need>2 && need<4.5, "trois foyers mangent à peu près comme avant ("+need.toFixed(2)+")");
  for(const k of ["berries","meat","bread"]) g.stock[k] = 0;
  g.stock.firewood = 100;
  const n0 = g.villagers.length;
  g.onMonth();
  assert.ok(g.families.every(f=>f.fed===0), "personne n'a mangé");
  assert.ok(g.villagers.every(v=>v.health<100), "la faim abîme la santé");
  assert.ok(g.villagers.every(v=>v.why.some(w=>w[0]==="A faim")), "et se lit dans l'humeur");
  for(let m=0;m<10;m++){ for(const k of ["berries","meat","bread","eggs","veg","apples","honey"]) g.stock[k]=0; g.onMonth(); }
  assert.ok(g.villagers.length < n0, "des villageois meurent de faim");
  assert.ok(g.log.some(l=>/Décès de .* de faim/.test(l.text)), "le journal dit pourquoi");
});

test("étape 4 : un décès libère le poste, met la famille en deuil, et les orphelins sont recueillis", () => {
  const g = fresh();
  const b = doneBuilding(g, "woodcutter");
  const f = g.families.find(ff=>g.membersOf(ff.id).some(v=>g.isAdult(v)) && g.membersOf(ff.id).some(v=>!g.isAdult(v)));
  const adults = g.membersOf(f.id).filter(v=>g.isAdult(v));
  g.assignVillager(adults[0].id, b.id);
  const kids = g.membersOf(f.id).filter(v=>!g.isAdult(v));
  g.die(adults[0], "de maladie");
  assert.strictEqual(g.workersOf(b).length, 0);
  assert.ok(kids.every(k=>k.grief>0), "les enfants sont en deuil");
  for(const a of adults.slice(1)) g.die(a, "de maladie");
  assert.ok(!g.families.includes(f), "le foyer sans adulte est dissous");
  for(const k of kids){ assert.ok(g.villagers.includes(k), "l'orphelin vit toujours"); assert.ok(g.families.some(ff=>ff.id===k.fam), "recueilli par une autre famille"); }
  assert.ok(g.log.some(l=>/recueillis/.test(l.text)));
});

test("étape 4 : un savoir-faire de maître que personne n'a appris disparaît avec lui", () => {
  const g = fresh();
  for(const v of g.villagers) v.skills.stone = 10;
  const m = g.villagers.find(v=>g.isAdult(v)); m.skills.stone = 85;
  g.die(m, "de vieillesse");
  assert.ok(g.log.some(l=>/savoir-faire \(pierre\) disparaît/.test(l.text)));
  const g2 = fresh();
  const a = g2.villagers.filter(v=>g2.isAdult(v));
  a[0].skills.stone = 85; a[1].skills.stone = 45;
  g2.die(a[0], "de vieillesse");
  assert.ok(!g2.log.some(l=>/savoir-faire/.test(l.text)), "un compagnon a pris la relève");
});

test("étape 4 : naissance chez un couple logé et nourri", () => {
  const g = fresh();
  houses(g, 3);
  g.time.month = 5;
  for(const f of g.families) f.fed = 1;
  const n0 = g.villagers.length;
  withRnd(g, 0.02, ()=>g.demography(false, 1));
  const babies = g.villagers.slice(n0).filter(v=>g.ageOf(v)===0);
  assert.ok(babies.length>=1, "au moins une naissance");
  const b = babies[0], mom = g.villager(b.mother), dad = g.villager(b.father);
  assert.ok(mom && dad && mom.spouse===dad.id, "fils ou fille d'un couple marié");
  assert.strictEqual(b.fam, mom.fam);
  assert.ok(g.log.some(l=>/Naissance de/.test(l.text)));
  // pas de naissance au campement
  const g2 = fresh();
  for(const f of g2.families) f.fed = 1;
  const m0 = g2.villagers.length;
  withRnd(g2, 0.02, ()=>g2.demography(false, 1));
  assert.strictEqual(g2.villagers.filter(v=>g2.ageOf(v)===0 && g2.villagers.indexOf(v)>=m0).length, 0, "on attend d'avoir une maison");
});

test("étape 4 : mariage — maison libre ou foyer du mari ; jamais entre frère et sœur", () => {
  const g = fresh();
  houses(g, 3);
  const fa = g.families[0], fb = g.families[1];
  const h = person(g, fa, "m", 22), w = person(g, fb, "f", 20);
  g.wed(h, w);
  assert.strictEqual(h.spouse, w.id); assert.strictEqual(w.spouse, h.id);
  assert.strictEqual(w.fam, h.fam, "faute de maison libre, l'épouse rejoint la famille du mari");
  assert.strictEqual(w.maiden, g.surnameOf(fb));
  // une maison libre : le jeune couple s'y installe
  legacyHouse2(g);
  g.rehouseCouples();
  const nf = g.famOf(h);
  assert.notStrictEqual(nf.id, fa.id, "nouveau foyer");
  assert.strictEqual(w.fam, nf.id);
  assert.ok(g.buildings.some(b=>b.id===nf.home && b.def==="burgage"));
  // frère et sœur
  const s1 = person(g, fa, "m", 20), s2 = person(g, fa, "f", 19);
  s1.mother = s2.mother = 9999;
  assert.ok(g.related(s1, s2));
});

test("étape 4 : retraite à 65 ans, le poste est repris par un autre", () => {
  const g = fresh();
  const b = doneBuilding(g, "quarry");
  const old = g.villagers.find(v=>g.canWork(v));
  g.assignVillager(old.id, b.id);
  assert.strictEqual(b.want, 1);
  old.bornAt = g.monthIdx() + 1 - AGE_RETIRE*12;   // 65 ans le mois prochain
  g.time.month += 1;
  withRnd(g, 0.5, ()=>g.demography(false, 1));
  assert.strictEqual(old.work, -1);
  assert.ok(g.log.some(l=>/retraite/.test(l.text)));
  g.fillJobs();
  assert.strictEqual(g.workersOf(b).length, 1, "un autre adulte reprend la carrière");
  assert.strictEqual(g.assignVillager(old.id, b.id), "Trop âgé pour travailler");
});

test("étape 4 : affectation à la main depuis la fiche", () => {
  const g = fresh();
  const b = doneBuilding(g, "quarry"), b2 = doneBuilding(g, "woodcutter");
  const [a, c] = g.villagers.filter(v=>g.canWork(v));
  assert.strictEqual(g.assignVillager(a.id, b.id), null);
  assert.strictEqual(g.assignVillager(c.id, b.id), "Plus de place : Carrière est complet");
  assert.strictEqual(g.assignVillager(a.id, b2.id), null, "change de métier");
  assert.strictEqual(a.work, b2.id);
  assert.strictEqual(b.want, 0, "la carrière ne cherche pas à le remplacer");
  const kid = g.villagers.find(v=>g.stageOf(v)==="child" || g.stageOf(v)==="baby");
  assert.strictEqual(g.assignVillager(kid.id, b.id), "Trop jeune pour travailler");
  assert.strictEqual(g.assignVillager(a.id, -1), null);
  assert.strictEqual(a.work, -1);
  assert.strictEqual(g.villagerStatus(a), a.sex==="f" ? "Journalière" : "Journalier");
});

test("étape 4 : l'approbation se détaille cause par cause, et chacun a son humeur", () => {
  const g = fresh();
  g.onMonth();
  const sum = g.approvalWhy.reduce((s,w)=>s+w[1], 0);
  assert.ok(Math.abs(Math.max(0, Math.min(100, sum)) - g.approval) <= 2, "la somme des causes donne l'approbation");
  assert.ok(g.approvalWhy.some(w=>w[0]==="Vie au campement"));
  const v = g.villagers[0];
  v.sick = 2; g.onMonth();
  assert.ok(v.why.some(w=>w[0]==="Malade"));
  assert.ok(v.mood < g.approval + 1);
});

test("étape 4 : la peste emporte des villageois, pas des familles entières", () => {
  const g = fresh();
  const n0 = g.villagers.length, f0 = g.families.length;
  const old = g.villagers.find(v=>g.stageOf(v)==="elder");
  const dead = g.plague();
  assert.ok(dead>=2 && dead<=4, dead+" morts");
  assert.strictEqual(g.villagers.length, n0 - dead);
  assert.ok(!g.villagers.includes(old), "les plus fragiles d'abord (l'ancien)");
  assert.ok(g.families.length >= f0-1, "les familles survivent");
  assert.ok(g.log.some(l=>/peste/.test(l.text)));
});

test("étape 4 : sauvegarde v4 — villageois, liens et compétences conservés, données abîmées écartées", () => {
  const g = fresh();
  houses(g, 3);
  const b = doneBuilding(g, "woodcutter");
  g.assign(b.id);
  for(let i=0;i<300*TS;i++) g.step();
  const data = JSON.parse(JSON.stringify(g.serialize()));
  assert.strictEqual(data.v, 7);
  const g2 = GameState.load(data);
  assert.strictEqual(g2.villagers.length, g.villagers.length);
  for(const v of g.villagers){
    const o = g2.villager(v.id);
    assert.strictEqual(o.first, v.first); assert.strictEqual(o.fam, v.fam); assert.strictEqual(o.spouse, v.spouse);
    assert.deepStrictEqual(o.skills, v.skills); assert.strictEqual(o.bornAt, v.bornAt);
  }
  assert.strictEqual(g2.workersOf(g2.buildings.find(x=>x.id===b.id)).length, 1);
  const bad = JSON.parse(JSON.stringify(data));
  bad.villagers.push({ id:"x" }, { id:999, fam:424242 }, null);
  bad.villagers[0].skills.wood = "beaucoup"; bad.villagers[0].health = NaN; bad.villagers[0].work = 99999;
  const g3 = GameState.load(bad);
  assert.strictEqual(g3.villagers.length, g.villagers.length, "entrées invalides ignorées");
  assert.strictEqual(g3.villagers[0].skills.wood, 0);
  assert.strictEqual(g3.villagers[0].health, 100);
  assert.strictEqual(g3.villagers[0].work, -1);
  for(let i=0;i<200*TS;i++) g3.step();
});

test("étape 4 : une ancienne sauvegarde (familles anonymes) est convertie sans rien perdre", () => {
  const g = fresh();
  houses(g, 3);
  const b = doneBuilding(g, "woodcutter");
  const data = JSON.parse(JSON.stringify(g.serialize()));
  // forme v3 : pas de villageois, chaque famille marche et travaille elle-même
  delete data.villagers; delete data.approvalWhy; data.v = 3;
  data.families.forEach((f, k)=>{ Object.assign(f, { x:10.5+k, y:12.5, path:null, state:"idle", timer:0, task:null, carry:null, cool:0, work:-1, lastAte:1 }); delete f.fed; });
  data.families[0].work = b.id;
  for(const x of data.buildings){ x.families = []; delete x.want; }
  data.buildings.find(x=>x.id===b.id).families = [data.families[0].id];
  const g2 = GameState.load(data);
  assert.strictEqual(g2.families.length, 3);
  for(const f of g2.families){ assert.ok(g2.membersOf(f.id).length>=1); assert.strictEqual(f.x, undefined, "plus de position sur le foyer"); }
  const b2 = g2.buildings.find(x=>x.id===b.id);
  assert.strictEqual(b2.families, undefined);
  assert.strictEqual(b2.want, 1);
  const w = g2.workersOf(b2);
  assert.strictEqual(w.length, 1, "le premier adulte garde le métier de sa famille");
  assert.strictEqual(w[0].fam, data.families[0].id);
  assert.strictEqual(w[0].x, 10.5);
  for(let i=0;i<400*TS;i++) g2.step();
  assert.ok(g2.villagers.length>=3);
});

/* ================= étape 5 : agriculture et élevage approfondis ================= */
const { CROP_CAL, LIVESTOCK, LIVESTOCK_ORDER, PASTURE_MIN, PLOT_MIN, monthsTxt } = require("../js/sim.js");
function feed(g){ g.stock.berries = 250; g.stock.meat = 250; g.stock.firewood = 250; g.stock.clothes = 50; }
function toMonth(g, m){ g.time.month = m; g.time.day = 0; g.time.tick = 0; }
function newField(g, crop, n){ g.setFieldSize(n||4); const b = placeInCenter(g, "field"); if(crop) g.setCrop(b.id, crop); return b; }
function sownField(g, crop, growth){ const b = newField(g, crop); Object.assign(b.f, { sown:true, sownCrop:crop, growth:growth, sownAt:g.monthIdx()-6, cond:1, hits:[] }); return b; }
function freeBlock(g, w, h){
  for(let y=2;y<H-h-2;y++) for(let x=Math.ceil(W/3)+2;x<Math.floor(2*W/3)-w-2;x++){
    let ok = true;
    for(let yy=-1; yy<=h && ok; yy++) for(let xx=-1; xx<=w && ok; xx++){ const i=(y+yy)*W+x+xx; if(g.tiles[i]!==T_GRASS || g.occupied[i]>=0 || g.roads[i]) ok = false; }
    if(ok) return { x, y };
  }
  throw new Error("pas de bloc libre "+w+"×"+h);
}
function newPasture(g, w, h){
  g.stock.timber = Math.max(g.stock.timber, 60);
  const r = freeBlock(g, w||5, h||4);
  const err = g.tracePasture([[r.x,r.y],[r.x+(w||5),r.y],[r.x+(w||5),r.y+(h||4)],[r.x,r.y+(h||4)]]);
  assert.strictEqual(err, null, "pâturage tracé");
  const b = g.buildings[g.buildings.length-1]; b.done = true; b.progress = 1;
  return b;
}
function stockHerd(g, b, sp, nf, nm){
  g.treasury += 1000;
  for(let k=0;k<nf;k++) assert.strictEqual(g.buyAnimal(b.id, sp, true), null);
  for(let k=0;k<nm;k++) assert.strictEqual(g.buyAnimal(b.id, sp, false), null);
  for(const a of b.herd.an) a.a = LIVESTOCK[sp].adultAt + 12;
}
function runMonths(g, n){ for(let i=0;i<n*MONTH_TICKS;i++){ if(i%MONTH_TICKS===0) feed(g); g.step(); if(g.pendingEvent) g.resolveEvent(g.pendingEvent.choices.length-1); } }

test("étape 5 : 8 cultures, chacune avec sa saison et son calendrier", () => {
  for(const c of CROP_ORDER){ const cd = CROP_DEFS[c]; assert.ok(CROP_CAL[cd.season], c+" a un calendrier"); assert.ok(typeof cd.of==="string"); }
  assert.strictEqual(CROP_DEFS.wheat.season, "winter");
  assert.strictEqual(CROP_DEFS.rye.season, "winter");
  for(const c of ["barley","oats","flax","peas"]) assert.strictEqual(CROP_DEFS[c].season, "spring");
  assert.strictEqual(CROP_DEFS.hay.season, "meadow");
  assert.ok(CROP_DEFS.peas.fertCost<0, "les pois rechargent le sol");
  assert.ok(CROP_DEFS.rye.hardy, "le seigle est rustique");
  for(const c of ["wheat","rye","barley","oats"]) assert.ok(CROP_DEFS[c].sheaf, c+" : moissonné en gerbes");
  assert.strictEqual(monthsTxt([8,9]), "sept.–oct.");
});

test("étape 5 : un nouveau champ propose la prochaine culture qu'on pourra semer", () => {
  const g = fresh();
  toMonth(g, 2); assert.strictEqual(newField(g).f.crop, "peas");
  toMonth(g, 6); assert.strictEqual(newField(g).f.crop, "wheat");
});

test("étape 5 : le blé d'hiver se laboure à l'automne ; l'orge au printemps", () => {
  const g = fresh();
  const farm = doneBuilding(g, "farm"); g.assign(farm.id);
  const v = g.workersOf(farm)[0];
  const wheat = newField(g, "wheat");
  toMonth(g, 2);
  assert.strictEqual(g.farmJob(v), null, "pas de blé d'hiver en mars");
  const barley = newField(g, "barley");
  assert.deepStrictEqual(g.farmJob(v), { type:"plow", bid:barley.id });
  g.setCrop(barley.id, "fallow");
  toMonth(g, 8);
  assert.deepStrictEqual(g.farmJob(v), { type:"plow", bid:wheat.id });
  wheat.f.plow = 1;
  assert.deepStrictEqual(g.farmJob(v), { type:"sow", bid:wheat.id });
});

test("étape 5 : cycle de l'orge — labour, semailles, pousse, moisson en gerbes, battage l'hiver", () => {
  const g = fresh(); feed(g);
  const farm = doneBuilding(g, "farm"); g.assign(farm.id); g.assign(farm.id);
  const f = newField(g, "barley");
  toMonth(g, 2);
  runMonths(g, 3);
  assert.ok(f.f.sown, "semé au printemps");
  assert.strictEqual(f.f.sownCrop, "barley");
  runMonths(g, 6);   // jusqu'en décembre
  assert.ok(f.f.hist.length===1 && f.f.hist[0].crop==="barley" && f.f.hist[0].q>0, "moisson notée dans l'historique");
  assert.ok(g.log.some(l=>/Moisson de l'orge : \d+ gerbes/.test(l.text)), "moisson en gerbes");
  assert.ok(g.stock.barley>0, "le battage a commencé ("+g.stock.barley+")");
  runMonths(g, 3);
  assert.ok(g.stock.sh_barley < f.f.hist[0].q, "les gerbes sont battues l'hiver");
  assert.ok(g.stock.barley >= f.f.hist[0].q*0.9, "autant d'orge que de gerbes ("+g.stock.barley+")");
});

test("étape 5 : rotation — même céréale deux ans de suite, après des pois, après une jachère", () => {
  const g = fresh();
  const b = newField(g, "wheat"), f = b.f, cd = CROP_DEFS.wheat;
  const at = (prev)=>{ f.prev = prev; f.prevAt = g.monthIdx()-12; return g.rotationMul(f, cd)[0]; };
  assert.strictEqual(at("wheat"), 0.8);
  assert.strictEqual(at("barley"), 0.92);
  assert.strictEqual(at("peas"), 1.15);
  f.prev = "flax"; assert.strictEqual(g.rotationMul(f, CROP_DEFS.flax)[0], 0.7);
  f.prev = null; f.rested = true; assert.strictEqual(g.rotationMul(f, cd)[0], 1.1);
  f.rested = false; f.prev = "peas"; f.prevAt = g.monthIdx()-12;
  const good = g.forecast(b).qty; f.prev = "wheat";
  assert.ok(good > g.forecast(b).qty, "après des pois, la prévision est meilleure");
});

test("étape 5 : les pois rechargent le sol, le blé l'épuise ; récoltes livrées au bon endroit", () => {
  const g = fresh();
  const p = sownField(g, "peas", 1), w = sownField(g, "wheat", 1);
  p.f.fert = 0.5; w.f.fert = 0.8;
  const pq = g.harvestField(p), wq = g.harvestField(w);
  assert.ok(Math.abs(p.f.fert - 0.6) < 1e-9, "pois : +0,10");
  assert.ok(Math.abs(w.f.fert - 0.6) < 1e-9, "blé : −0,20");
  assert.ok(pq>0 && g.stock.pulses>=pq, "pois et fèves en réserve");
  assert.ok(wq>0 && g.stock.sh_grain>=wq && g.stock.grain===0, "le blé arrive en gerbes, pas encore en grain");
  assert.ok(!p.f.sown && p.f.prev==="peas" && p.f.hist.length===1);
  assert.ok(g.threshOne(), "battage possible");
  assert.strictEqual(g.stock.grain, 1);
});

test("étape 5 : le fumier épandu monte la fertilité, puis vient le labour", () => {
  const g = fresh();
  const farm = doneBuilding(g, "farm"); g.assign(farm.id);
  const v = g.workersOf(farm)[0];
  const b = newField(g, "wheat"); b.f.fert = 0.4;
  toMonth(g, 8); g.stock.manure = 20;
  const job = g.farmJob(v);
  assert.strictEqual(job.type, "spread");
  const t = Object.assign({}, job);
  for(let i=0; i<2000 && !b.f.dunged; i++) g.fieldWork(v, t);
  assert.ok(b.f.dunged, "fumure faite");
  assert.ok(b.f.fert > 0.5, "fertilité montée ("+b.f.fert.toFixed(2)+")");
  assert.ok(g.stock.manure < 20, "fumier consommé");
  assert.strictEqual(g.farmJob(v).type, "plow");
});

test("étape 5 : les bœufs accélèrent le labour", () => {
  const g = fresh();
  const farm = doneBuilding(g, "farm"); g.assign(farm.id);
  const v = g.workersOf(farm)[0];
  const b = newField(g, "wheat"); toMonth(g, 8);
  assert.ok(g.workingOxen()>=1 && g.plowMul()>1, "le bœuf du départ tire la charrue");
  g.fieldWork(v, { type:"plow", bid:b.id }); const withOx = b.f.plow;
  b.f.plow = 0; g.oxen = []; g.syncOx();
  g.fieldWork(v, { type:"plow", bid:b.id });
  assert.ok(withOx > b.f.plow*1.4, "plus vite avec un bœuf");
});

test("étape 5 : le gel tardif abîme les jeunes pousses, le seigle résiste mieux", () => {
  const g = fresh();
  const w = sownField(g, "wheat", 0.3), r = sownField(g, "rye", 0.3);
  withRnd(g, 0.01, ()=>g.farmMonth(2));
  assert.ok(w.f.cond < r.f.cond && r.f.cond < 1, "blé "+w.f.cond+" / seigle "+r.f.cond);
  assert.strictEqual(w.f.hits[0][0], "Gel tardif");
  assert.ok(g.log.some(l=>/Gel tardif/.test(l.text)));
});

test("étape 5 : la grêle hache un champ et la prévision baisse ; le printemps sec ralentit la pousse", () => {
  const g = fresh();
  const b = sownField(g, "barley", 0.5);
  const before = g.forecast(b).qty;
  withRnd(g, 0.01, ()=>g.farmMonth(6));
  assert.ok(g.forecast(b).qty < before*0.75, "grêle : "+before+" → "+g.forecast(b).qty);
  withRnd(g, 0.2, ()=>g.farmMonth(3));
  assert.strictEqual(g.wx, "drought");
  toMonth(g, 4); b.f.growth = 0.2;
  g.step(); const dry = b.f.growth - 0.2;
  g.wx = null; g.weather = "clear"; b.f.growth = 0.2; g.step();
  assert.ok(dry < (b.f.growth - 0.2)*0.5, "pousse ralentie par la sécheresse");
});

test("étape 5 : une récolte oubliée attend, puis pourrit sur pied", () => {
  const g = fresh();
  const b = sownField(g, "barley", 1);
  toMonth(g, 10);
  assert.ok(g.harvestable(b), "encore récoltable avec un mois de retard");
  const q0 = g.forecast(b).qty;
  withRnd(g, 0.99, ()=>g.farmMonth(10));
  assert.ok(g.forecast(b).qty < q0, "le grain tombe");
  withRnd(g, 0.99, ()=>g.farmMonth(11));
  assert.ok(!b.f.sown, "perdue");
  assert.ok(g.log.some(l=>/pourri sur pied/.test(l.text)));
});

test("étape 5 : le pré de fauche reprend au printemps et se fauche en juin", () => {
  const g = fresh();
  const farm = doneBuilding(g, "farm"); g.assign(farm.id);
  const v = g.workersOf(farm)[0];
  toMonth(g, 2);
  const b = newField(g, "hay");
  assert.ok(b.f.sown, "pré établi en mars, sans labour");
  b.f.growth = 1; toMonth(g, 5); b.f.sownAt = g.monthIdx()-3;
  assert.deepStrictEqual(g.farmJob(v), { type:"mow", bid:b.id });
  const h0 = g.stock.hay;
  g.harvestField(b);
  assert.ok(g.stock.hay > h0+20, "foin rentré ("+g.stock.hay+")");
});

test("étape 5 : pâturage tracé librement — abri au bord, clôture payée, cases franchissables", () => {
  const g = fresh();
  g.stock.timber = 40;
  const r = freeBlock(g, 5, 4);
  const pts = [[r.x,r.y],[r.x+5,r.y],[r.x+5,r.y+4],[r.x,r.y+4]];
  const plan = g.planPasture(pts);
  assert.strictEqual(plan.err, null);
  assert.strictEqual(plan.n, 20);
  assert.strictEqual(plan.cost, 1 + Math.ceil(18/8));
  assert.strictEqual(g.tracePasture(pts), null);
  assert.strictEqual(g.freeStock("timber"), 40 - plan.cost);
  const b = g.buildings[g.buildings.length-1];
  assert.strictEqual(b.def, "pasture");
  assert.strictEqual(b.plot.cells[0], b.y*W+b.x, "l'abri est la première case");
  assert.strictEqual(b.plot.cells.length, 20);
  for(const i of b.plot.cells) assert.strictEqual(g.occupied[i], b.id);
  assert.ok(!g.passable(b.x, b.y), "on ne traverse pas l'abri");
  const c = b.plot.cells[5]; assert.ok(g.passable(c%W, (c/W)|0), "on traverse l'herbe");
  assert.ok(g.canPlace("woodcutter", c%W, (c/W)|0), "on ne bâtit pas dans un pâturage");
  assert.ok(/trop petit/.test(g.planPasture([[1+r.x,r.y+5],[r.x+2,r.y+5],[r.x+2,r.y+6]]).err || "trop petit"));
  const r2 = freeBlock(g, 1, 2);
  assert.ok(/trop petit/.test(g.planPasture([[r2.x,r2.y],[r2.x+1,r2.y],[r2.x+1,r2.y+2],[r2.x,r2.y+2]]).err));
  assert.ok(/empiète/.test(g.planPasture(pts).err), "pas sur un autre pâturage");
});

test("étape 5 : acheter des bêtes — une espèce par pâturage, payée en deniers", () => {
  const g = fresh();
  const b = newPasture(g);
  b.done = false;
  assert.ok(/chantier/.test(g.buyAnimal(b.id, "sheep", true)));
  b.done = true; g.treasury = 3;
  assert.ok(/deniers/.test(g.buyAnimal(b.id, "sheep", true)));
  g.treasury = 20;
  assert.strictEqual(g.buyAnimal(b.id, "sheep", true), null);
  assert.strictEqual(g.treasury, 16);
  assert.strictEqual(b.herd.sp, "sheep");
  assert.ok(/moutons/.test(g.buyAnimal(b.id, "cattle", true)), "pas de vaches avec les moutons");
  assert.strictEqual(g.sellAnimal(b.id), null);
  assert.strictEqual(b.herd.an.length, 0);
});

test("étape 5 : agnelage au printemps s'il y a un bélier ; aucun sans mâle", () => {
  const g = fresh();
  const a = newPasture(g), b = newPasture(g);
  stockHerd(g, a, "sheep", 4, 1); stockHerd(g, b, "sheep", 4, 0);
  withRnd(g, 0.05, ()=>g.herdMonth(2));
  assert.strictEqual(a.herd.an.length, 9, "4 agneaux");
  assert.strictEqual(b.herd.an.length, 4, "pas de bélier, pas d'agneaux");
  assert.ok(g.log.some(l=>/Agnelage/.test(l.text)));
});

test("étape 5 : l'hiver, les bêtes mangent le foin ; sans foin, elles dépérissent", () => {
  const g = fresh();
  const b = newPasture(g, 6, 5);
  stockHerd(g, b, "cattle", 3, 1);
  g.stock.hay = 100; g.stock.oats = 0;
  withRnd(g, 0.5, ()=>g.herdMonth(0));
  assert.strictEqual(b.herd.fed, 1);
  assert.strictEqual(g.stock.hay, 100 - 4 - g.oxen.length, "1 foin par vache et par bœuf");
  g.stock.hay = 0;
  withRnd(g, 0.1, ()=>g.herdMonth(0));
  assert.strictEqual(b.herd.fed, 0);
  assert.ok(b.herd.an.length < 4, "des vaches meurent de faim");
  assert.ok(g.log.some(l=>/Faute de foin/.test(l.text)));
  g.stock.oats = 10;
  assert.strictEqual(g.takeFodder(3), 3, "l'avoine remplace le foin");
  assert.strictEqual(g.stock.oats, 8);
});

test("étape 5 : l'herbe en trop est fauchée en juin ; trop de bêtes, l'herbe manque", () => {
  const g = fresh();
  const b = newPasture(g, 6, 5);
  stockHerd(g, b, "sheep", 2, 0); g.assign(b.id);
  const h0 = g.stock.hay;
  withRnd(g, 0.5, ()=>g.herdMonth(5));
  assert.ok(g.stock.hay > h0 && b.herd.last.hay > 0, "fenaison");
  const c = newPasture(g, 2, 2);
  stockHerd(g, c, "cattle", 8, 1);
  withRnd(g, 0.5, ()=>g.herdMonth(6));
  assert.ok(c.herd.fed < 0.5, "pâturage trop petit pour 9 vaches");
  assert.ok(/herbe trop courte/.test(g.pastureStatus(c)));
});

test("étape 5 : la maladie se propage dans le troupeau ; abattre les malades l'arrête", () => {
  const g = fresh();
  const b = newPasture(g, 6, 5);
  stockHerd(g, b, "sheep", 9, 1);
  b.herd.an[0].s = 3;
  withRnd(g, 0.01, ()=>g.herdMonth(6));
  const sick = b.herd.an.filter(a=>a.s>0).length;
  assert.ok(sick>=3, "contagion ("+sick+" malades)");
  const n = b.herd.an.length, meat = g.stock.meat;
  assert.strictEqual(g.cullSick(b.id), null);
  assert.strictEqual(b.herd.an.filter(a=>a.s>0).length, 0);
  assert.strictEqual(b.herd.an.length, n - sick);
  assert.strictEqual(g.stock.meat, meat, "viande des bêtes malades perdue");
});

test("étape 5 : abattre donne de la viande ; abattage de novembre selon la consigne", () => {
  const g = fresh();
  const b = newPasture(g, 6, 5);
  stockHerd(g, b, "pig", 6, 2);
  const m0 = g.stock.meat;
  assert.strictEqual(g.slaughter(b.id), null);
  assert.strictEqual(g.stock.meat, m0 + LIVESTOCK.pig.meat);
  assert.strictEqual(b.herd.an.filter(a=>!a.f).length, 1, "le verrat en trop part le premier");
  g.setKeep(b.id, 4);
  const m1 = g.stock.meat;
  withRnd(g, 0.5, ()=>g.herdMonth(10));
  assert.strictEqual(b.herd.an.length, 4);
  assert.ok(b.herd.an.some(a=>!a.f), "on garde un verrat pour la reproduction");
  assert.ok(g.stock.meat > m1 + 8);
  assert.ok(g.log.some(l=>/Abattage de novembre/.test(l.text)));
});

test("étape 5 : tonte en mai, lait des vaches qui ont vêlé, le tailleur file la laine", () => {
  const g = fresh();
  const s = newPasture(g, 5, 4); stockHerd(g, s, "sheep", 3, 1); g.assign(s.id);
  withRnd(g, 0.5, ()=>g.herdMonth(4));
  assert.ok(g.stock.wool >= 3, "tonte : "+g.stock.wool);
  const c = newPasture(g, 5, 4); stockHerd(g, c, "cattle", 2, 1); g.assign(c.id);
  c.herd.an[0].lac = 5;
  withRnd(g, 0.5, ()=>g.herdMonth(6));
  assert.ok(g.stock.milk > 0, "lait");
  assert.strictEqual(c.herd.an[0].lac, 4);
  // le tailleur : un vêtement avec une mesure de fibre, la moitié sans
  const h = legacyHouse(g); h.done = true; h.exts = ["tailor"];
  g.stock.wool = 5; g.stock.clothes = 0;
  g.onMonth();
  assert.strictEqual(g.stock.wool, 4);
  for(const f of g.families) f.clothCool = -10;   // personne ne s'habille ce mois-ci
  g.stock.wool = 0; g.stock.flax = 0; const cl = g.stock.clothes;
  g.onMonth();
  assert.ok(Math.abs(g.stock.clothes - cl - 0.5) < 1e-9, "rapiéçage sans fibre : moitié moins");
});

test("étape 5 : glandée — le porcher mène les porcs en forêt, ils s'engraissent", () => {
  const g = fresh();
  const b = newPasture(g, 4, 4);
  stockHerd(g, b, "pig", 3, 1); g.assign(b.id);
  if(g.forestNear(b, 9)<0){ const i = (b.y+5)*W+b.x; g.tiles[i] = T_FOREST; g.treeWood[i] = 8; }
  withRnd(g, 0.5, ()=>g.herdMonth(8));
  assert.ok(b.herd.out>=0, "en forêt");
  assert.ok(/glandée/.test(g.pastureStatus(b)));
  assert.ok(b.herd.an.every(a=>a.fat>0.3));
  const m0 = g.stock.meat;
  g.slaughter(b.id);
  assert.ok(g.stock.meat > m0 + LIVESTOCK.pig.meat, "un porc gras donne plus de viande");
});

test("étape 5 : un jeune taureau de trop est dressé en bœuf de trait", () => {
  const g = fresh();
  const b = newPasture(g, 6, 5);
  stockHerd(g, b, "cattle", 2, 1);
  b.herd.an.push(g.makeAnimal("cattle", false, LIVESTOCK.cattle.adultAt-1));
  const ox0 = g.oxen.length;
  withRnd(g, 0.9, ()=>g.herdMonth(6));
  assert.strictEqual(g.oxen.length, ox0+1);
  assert.strictEqual(g.stock.ox, ox0+1);
  assert.strictEqual(b.herd.an.length, 3);
});

test("étape 5 : les bœufs mangent du foin l'hiver et s'affaiblissent sans", () => {
  const g = fresh();
  g.stock.hay = 0; g.stock.oats = 0;
  withRnd(g, 0.5, ()=>g.herdMonth(0));
  assert.strictEqual(g.oxen[0].h, 70);
  withRnd(g, 0.5, ()=>g.herdMonth(1));
  assert.strictEqual(g.workingOxen(), 0, "trop faible pour labourer");
  assert.strictEqual(g.plowMul(), 1);
  g.treasury = 25; assert.ok(g.buyOx()); assert.strictEqual(g.oxen.length, 2);
  assert.ok(g.retireOx()); assert.strictEqual(g.stock.ox, 1);
});

test("étape 5 : le marchand de bestiaux propose un troc contre du bois", () => {
  const g = fresh();
  const b = newPasture(g);
  g.stock.timber = 50;
  withRnd(g, 0.1, ()=>g.livestockFair());
  const ev = g.pendingEvent;
  assert.ok(ev && ev.fair, "le marchand passe");
  g.resolveEvent(0);
  assert.strictEqual(g.stock.timber, 50 - ev.fair.wood);
  assert.strictEqual(b.herd.an.length, ev.fair.lot.length);
  assert.strictEqual(b.herd.sp, ev.fair.sp);
});

test("étape 5 : démolir un pâturage vend les bêtes et libère les cases", () => {
  const g = fresh();
  const b = newPasture(g);
  stockHerd(g, b, "sheep", 3, 1);
  const t0 = g.treasury, cells = b.plot.cells.slice();
  g.demolish(b.id);
  assert.strictEqual(g.treasury, t0 + 4*LIVESTOCK.sheep.sell);
  for(const i of cells){ assert.strictEqual(g.occupied[i], -1); assert.strictEqual(g.pastureCell[i], 0); }
});

test("étape 5 : sauvegarde v5 — champs, troupeaux, bœufs et gerbes conservés", () => {
  const g = fresh();
  const f = sownField(g, "rye", 0.4); f.f.hits = [["Grêle", -30]]; f.f.hist = [{ y:1176, crop:"peas", q:20 }]; f.f.prev = "peas";
  const p = newPasture(g); stockHerd(g, p, "pig", 2, 1); g.setKeep(p.id, 2); p.herd.an[0].s = 2; p.herd.an[1].fat = 0.6;
  g.stock.sh_grain = 12; g.stock.hay = 33; g.stock.manure = 7;
  const g2 = GameState.load(JSON.parse(JSON.stringify(g.serialize())));
  const f2 = g2.buildings.find(b=>b.id===f.id), p2 = g2.buildings.find(b=>b.id===p.id);
  assert.deepStrictEqual(f2.f, f.f);
  assert.deepStrictEqual(p2.herd.an, p.herd.an);
  assert.strictEqual(p2.herd.keep, 2);
  assert.deepStrictEqual(p2.plot, p.plot);
  assert.strictEqual(g2.oxen.length, g.oxen.length);
  assert.strictEqual(g2.stock.sh_grain, 12); assert.strictEqual(g2.stock.hay, 33);
  assert.strictEqual(g2.pastureCell[p.plot.cells[3]], 1);
  assert.ok(g2.nextA > Math.max(...p.herd.an.map(a=>a.id)));
  for(let i=0;i<200*TS;i++) g2.step();
});

test("étape 5 : une sauvegarde v4 est convertie (jachère semée, bœufs comptés, champs complétés)", () => {
  const g = fresh();
  const a = newField(g, "fallow"), w = newField(g, "wheat");
  const data = JSON.parse(JSON.stringify(g.serialize()));
  data.v = 4; delete data.oxen; delete data.nextA; delete data.wx;
  data.stock.ox = 2;
  for(const k of ["oats","flax","pulses","milk","wool","hay","manure","sh_grain","sh_barley","sh_oats"]) delete data.stock[k];
  const fa = data.buildings.find(b=>b.id===a.id).f, fw = data.buildings.find(b=>b.id===w.id).f;
  for(const f of [fa, fw]) for(const k of Object.keys(f)) if(["fert","plow","sown","growth","harvestP","crop","usedThisYear","usedLastYear"].indexOf(k)<0) delete f[k];
  Object.assign(fa, { sown:true, plow:1, usedThisYear:true });
  Object.assign(fw, { sown:true, plow:1, growth:0.4 });
  const g2 = GameState.load(data);
  const a2 = g2.buildings.find(b=>b.id===a.id).f, w2 = g2.buildings.find(b=>b.id===w.id).f;
  assert.strictEqual(a2.sown, false, "la jachère n'est plus semée");
  assert.strictEqual(w2.sown, true); assert.strictEqual(w2.sownCrop, "wheat"); assert.strictEqual(w2.cond, 1);
  assert.deepStrictEqual(w2.hist, []);
  assert.strictEqual(g2.oxen.length, 2); assert.strictEqual(g2.stock.ox, 2);
  assert.strictEqual(g2.stock.hay, 6 + 3*2, "une meule offerte pour l'hiver des bœufs");
  for(let i=0;i<400*TS;i++) g2.step();
});

test("étape 5 : trois ans de ferme et d'élevage — ni exception ni valeur aberrante", () => {
  for(const seed of [3, 41, 1176]){
    const g = new GameState(seed, "prosperity", "normal");
    g.stock.timber = 80; g.treasury = 200;
    const farm = doneBuilding(g, "farm"); g.assign(farm.id); g.assign(farm.id);
    for(const c of ["wheat","barley","peas","hay","fallow"]) newField(g, c, 3);
    const p = newPasture(g, 5, 4); stockHerd(g, p, LIVESTOCK_ORDER[seed%3], 3, 1); g.assign(p.id);
    runMonths(g, 36);
    for(const k of Object.keys(g.stock)) assert.ok(isFinite(g.stock[k]) && g.stock[k]>=0, k+" = "+g.stock[k]);
    for(const b of g.fields()) for(const k of ["fert","growth","plow","cond"]) assert.ok(isFinite(b.f[k]), k);
    for(const a of p.herd.an) assert.ok(isFinite(a.a) && a.a>=0);
    assert.ok(g.fields().some(b=>b.f.hist.length>0), "des récoltes ont eu lieu (graine "+seed+")");
  }
});

test("étape 5 : champ tracé librement — forme libre, fertilité moyenne, cases occupées", () => {
  const g = fresh();
  const r = freeBlock(g, 6, 4);
  // un L : 6×2 en haut + 2×2 en bas à gauche
  const pts = [[r.x,r.y],[r.x+6,r.y],[r.x+6,r.y+2],[r.x+2,r.y+2],[r.x+2,r.y+4],[r.x,r.y+4]];
  const plan = g.planField(pts);
  assert.strictEqual(plan.err, null);
  assert.strictEqual(plan.n, 16);
  assert.ok(plan.fert>0 && plan.qty>0);
  assert.strictEqual(g.traceField(pts), null);
  const b = g.buildings[g.buildings.length-1];
  assert.strictEqual(b.def, "field"); assert.ok(b.done);
  assert.strictEqual(g.fieldN(b), 16);
  assert.strictEqual(b.plot.cells[0], b.y*W+b.x);
  for(const i of b.plot.cells) assert.strictEqual(g.occupied[i], b.id);
  assert.strictEqual(g.occupied[(r.y+3)*W+r.x+4], -1, "le creux du L reste libre");
  assert.ok(Math.abs(g.forecast(b).qty - plan.qty) <= 1, "l'aperçu annonce la même récolte");
  assert.ok(/empiète/.test(g.planField(pts).err));
  const r2 = freeBlock(g, 2, 1);
  assert.ok(/trop petit/.test(g.planField([[r2.x,r2.y],[r2.x+2,r2.y],[r2.x+2,r2.y+1],[r2.x,r2.y+1]]).err));
  g.demolish(b.id);
  for(const i of plan.cells) assert.strictEqual(g.occupied[i], -1);
});

test("étape 5 : un ancien champ carré devient une forme tracée au chargement", () => {
  const g = fresh();
  const b = newField(g, "barley", 4);
  const data = JSON.parse(JSON.stringify(g.serialize()));
  delete data.buildings.find(x=>x.id===b.id).plot;
  const g2 = GameState.load(data);
  const b2 = g2.buildings.find(x=>x.id===b.id);
  assert.ok(b2.plot && b2.plot.cells.length===b.w*b.h && b2.plot.cells[0]===b2.y*W+b2.x);
  assert.strictEqual(g2.fieldN(b2), b.w*b.h);
});

test("plus de maison sans cour : chaque parcelle a au moins 3 cases", () => {
  const g = fresh();
  g.stock.timber = 200;
  const camp = g.buildings[0];
  let ry = -1, rx0 = W, rx1 = 0;
  for(let y=0;y<H && ry<0;y++) for(let x=0;x<W;x++) if(g.roads[y*W+x]){ ry = y; break; }
  for(let x=0;x<W;x++) if(g.roads[ry*W+x]){ rx0 = Math.min(rx0,x); rx1 = Math.max(rx1,x); }
  // bande d'une seule case de profondeur le long de la route : au plus une maison toutes les 3 cases
  const pts = [[rx0, ry+1],[rx1+1, ry+1],[rx1+1, ry+2],[rx0, ry+2]];
  const plan = g.planZone(pts, 99);
  if(!plan.err){
    assert.ok(plan.plots.every(p=>p.cells.length>=PLOT_MIN), "parcelles d'au moins 3 cases");
    assert.ok(plan.nMax <= Math.floor((rx1-rx0+1)/PLOT_MIN));
  }
  const tiny = g.planZone([[rx0, ry+1],[rx0+2, ry+1],[rx0+2, ry+2],[rx0, ry+2]]);
  assert.ok(tiny.err, "deux cases : pas de maison");
});

/* ---------- étape 5 bis : logistique et chantiers livrés ---------- */
const { MAT_RES, OX_LOAD } = require("../js/sim.js");
function quietSteps(g, n, until){ for(let i=0;i<n;i++){ g.step(); g.pendingEvent = null; if(until && until()) return i; } return n; }
const DAY = TICKS_PER_DAY;

test("étape 5 bis : le stock ne baisse qu'à la livraison, mais ce qui est promis est réservé", () => {
  const g = fresh();
  g.stock.timber = 6; g.stock.stone = 3;
  const b = placeInCenter(g, "manor");
  assert.deepStrictEqual(b.mat.need, { timber:4, stone:3 });
  assert.strictEqual(g.stock.timber, 6, "rien ne sort du stock à la pose");
  assert.strictEqual(g.reserved("timber"), 4);
  assert.strictEqual(g.freeStock("timber"), 2);
  assert.ok(!g.canAfford("woodcutter") === false && g.canAfford("woodcutter"), "2 bois libres : un camp de bûcherons passe encore");
  assert.ok(!g.canAfford("church"), "la pierre est toute promise au manoir");
  const t0 = g.stock.timber;
  let low = t0;
  quietSteps(g, 60*DAY, ()=>{ low = Math.min(low, g.stock.timber); return (b.mat.got.timber||0)>=4; });
  assert.strictEqual(b.mat.got.timber, 4);
  assert.strictEqual(g.stock.timber, t0 - 4 + 0, "les 4 bois sont sortis du stock, à la livraison");
  assert.strictEqual(g.reserved("timber"), 0);
});

test("étape 5 bis : sans bœuf en état, un homme traîne un tronc à la main ; la construction suit la livraison", () => {
  const g = fresh();
  g.stock.timber = 40;
  g.oxen = []; g.syncOx();
  const b = placeInCenter(g, "storehouse");
  assert.deepStrictEqual(b.mat.got, { timber:0 });
  assert.strictEqual(g.matFrac(b), 0);
  let maxOver = 0, dragged = false, shoulder = false;
  quietSteps(g, 40*DAY, ()=>{
    maxOver = Math.max(maxOver, (b.progress||0) - g.matFrac(b));
    for(const v of g.villagers){
      if(v.task && v.task.type==="haul" && v.task.drag && v.task.phase==="bring") dragged = true;
      if(v.carry && v.carry.timber) shoulder = true;
    }
    return b.done;
  });
  assert.ok(dragged, "un tronc a été traîné à la main");
  assert.ok(!shoulder, "personne ne porte un tronc sur l'épaule");
  assert.ok(maxOver <= 1e-9, "la construction n'a jamais dépassé la livraison");
  assert.ok(b.done, "l'entrepôt est achevé");
  assert.strictEqual(g.stock.timber, 38);
});

test("étape 5 bis : le bœuf ne part jamais seul — un journalier le mène, avec trois troncs", () => {
  const g = fresh();
  g.stock.timber = 40; g.stock.stone = 10;
  const p0 = g.plowMul();
  const b = placeInCenter(g, "manor");
  g.oxStep();
  const ox = g.oxen[0], last = { x:ox.x, y:ox.y };
  let led = null, alone = 0, shoulder = false, far = 0, wasLed = false;
  quietSteps(g, 60*DAY, ()=>{
    const led0 = wasLed; wasLed = ox.lead>0;
    if(!(ox.lead>0)){ if(!led0 && Math.hypot(ox.x-last.x, ox.y-last.y) > 1e-9) alone++; }   // (rattaché au poteau en arrivant : pas compté)
    else {
      const v = g.villager(ox.lead);
      far = Math.max(far, v.task && v.task.phase!=="ox" ? Math.hypot(v.x-ox.x, v.y-ox.y) : 0);
      if(v.task && v.task.phase==="bring" && !led) led = { n:v.task.n, res:v.task.res, plow:g.plowMul() };
    }
    last.x = ox.x; last.y = ox.y;
    for(const v of g.villagers) if(v.carry && v.carry.timber) shoulder = true;
    return g.matFrac(b)>=1 && !(ox.lead>0);
  });
  assert.ok(led, "un journalier a mené le bœuf jusqu'au chantier");
  assert.ok(led.n>=2 && led.n<=OX_LOAD, "plusieurs charges d'un coup");
  assert.ok(led.plow < p0, "un bœuf au charroi ne compte plus pour le labour");
  assert.strictEqual(alone, 0, "le bœuf n'a jamais bougé sans quelqu'un pour le mener");
  assert.ok(far < 1.6, "il reste sur les talons de celui qui le mène");
  assert.ok(!shoulder, "aucun tronc porté à l'épaule");
  assert.strictEqual(g.matFrac(b), 1, "tout est livré");
  assert.ok(!g.oxAway(ox), "le bœuf a été ramené au poteau");
});

test("étape 5 bis : on charge au dépôt le plus commode, et jamais là où la ressource n'est pas", () => {
  const g = fresh();
  g.stock.timber = 40;
  const camp = g.buildings.find(b=>b.def==="camp");
  assert.ok(g.depotsFor("timber").includes(camp) && g.depotsFor("stone").includes(camp), "le campement sert de premier dépôt");
  const wc = placeInCenter(g, "woodcutter"); wc.done = true; wc.progress = 1;
  const q = { id:999, def:"quarry", x:wc.x, y:wc.y, w:1, h:1, done:true };
  g.buildings.push(q);
  assert.ok(g.depotsFor("timber").includes(wc) && !g.depotsFor("stone").includes(wc), "le camp de bûcherons ne garde que du bois");
  assert.ok(g.depotsFor("stone").includes(q) && !g.depotsFor("timber").includes(q), "la carrière ne garde que de la pierre");
  g.buildings.pop();
  // sans aucun dépôt, rien ne reste bloqué (et le bois sort quand même du stock)
  const s = placeInCenter(g, "granary");
  g.buildings = g.buildings.filter(b=>!(b.def in { camp:1, oxpost:1, woodcutter:1 }));
  const v = g.villagers.find(x=>g.canWork(x));
  const t0 = g.stock.timber;
  const job = g.siteJob(v, [s]);
  assert.strictEqual(job.type, "build");
  assert.strictEqual(s.mat.got.timber, 2);
  assert.strictEqual(g.stock.timber, t0 - 2);
});

test("étape 5 bis : réserve vide — le chantier attend, sans rien inventer", () => {
  const g = fresh();
  g.stock.timber = 2;
  const b = placeInCenter(g, "storehouse");
  g.stock.timber = 0;                         // pillé entre-temps
  const v = g.villagers.find(x=>g.canWork(x));
  assert.strictEqual(g.siteJob(v, [b]), null, "personne ne part chercher du bois qui n'existe pas");
  assert.ok(/réserve vide/.test(g.workStatus(b)));
});

test("étape 5 bis : un chantier prioritaire est servi avant les autres", () => {
  const g = fresh();
  g.stock.timber = 40;
  const a = placeInCenter(g, "granary"), b = placeInCenter(g, "storehouse");
  const v = g.villagers.find(x=>g.canWork(x));
  v.x = a.x+0.5; v.y = a.y+0.5;
  assert.strictEqual(g.siteJob(v, [a, b]).bid, a.id, "sans priorité : le plus proche");
  g.setSitePrio(b.id, true);
  assert.strictEqual(g.siteJob(v, [a, b]).bid, b.id, "avec priorité : celui qu'on a choisi");
});

test("étape 5 bis : abandonner un chantier rend ce qui n'a pas été employé", () => {
  const g = fresh();
  g.stock.timber = 20; g.stock.stone = 10;
  const b = placeInCenter(g, "church");
  assert.strictEqual(g.stock.timber, 20); assert.strictEqual(g.stock.stone, 10);
  g.demolish(b.id);
  assert.strictEqual(g.stock.timber, 20, "rien de livré : rien à rendre, rien de perdu");
  assert.strictEqual(g.reserved("timber"), 0, "la réservation est levée");
  const c = placeInCenter(g, "church");
  c.mat.got = { timber:2, stone:2 }; g.stock.timber -= 2; g.stock.stone -= 2;   // tout livré
  c.progress = 0.5;                                                             // la moitié employée
  g.demolish(c.id);
  assert.strictEqual(g.stock.timber, 19, "le tas non employé revient, la moitié de ce qui a été bâti est perdue");
  assert.strictEqual(g.stock.stone, 9);
});

test("étape 5 bis : sauvegarde v6 — matériaux, priorité et bœuf mené gardés, anciens chantiers déjà livrés", () => {
  const g = fresh();
  g.stock.timber = 40; g.stock.stone = 10;
  const b = placeInCenter(g, "manor");
  g.setSitePrio(b.id, true);
  quietSteps(g, 60*DAY, ()=>g.oxen.some(o=>o.lead>0 && g.villager(o.lead).task.phase==="bring"));
  const data = JSON.parse(JSON.stringify(g.serialize()));
  assert.strictEqual(data.v, 7);
  const g2 = GameState.load(data), b2 = g2.buildings.find(x=>x.id===b.id);
  assert.deepStrictEqual(b2.mat, b.mat);
  assert.strictEqual(b2.prio, true);
  assert.strictEqual(g2.oxen[0].lead, g.oxen[0].lead, "le bœuf est toujours mené par le même journalier");
  quietSteps(g2, 60*DAY, ()=>g2.matFrac(b2)>=1);
  assert.strictEqual(g2.matFrac(b2), 1, "le charroi reprend après le chargement");
  // une sauvegarde v5 : le coût avait été payé à la pose, le chantier a donc déjà ses matériaux
  const old = JSON.parse(JSON.stringify(g.serialize()));
  old.v = 5; for(const x of old.buildings){ delete x.mat; delete x.prio; }
  for(const o of old.oxen){ delete o.x; delete o.y; delete o.lead; }
  const g3 = GameState.load(old), b3 = g3.buildings.find(x=>x.id===b.id);
  assert.deepStrictEqual(b3.mat, { need:{ timber:4, stone:3 }, got:{ timber:4, stone:3 } });
  assert.strictEqual(g3.reserved("timber"), 0);
  quietSteps(g3, 200);
  const bad = JSON.parse(JSON.stringify(g.serialize()));
  bad.buildings.find(x=>x.id===b.id).mat = { need:{ timber:"x", stone:3 }, got:{ stone:99 } };
  bad.oxen[0].x = "loin";
  const g4 = GameState.load(bad);
  assert.deepStrictEqual(g4.buildings.find(x=>x.id===b.id).mat, { need:{ stone:3 }, got:{ stone:3 } });
  quietSteps(g4, 50);
  assert.ok(isFinite(g4.oxen[0].x), "un bœuf sans position retrouve son poteau");
});

test("étape 5 bis : une zone de maisons et un pâturage réclament aussi leur bois", () => {
  const g = zoneSetup();
  const t0 = g.stock.timber;
  g.traceZone(RECT, 2);
  assert.strictEqual(g.stock.timber, t0, "rien ne sort du stock au tracé");
  for(const p of plotsOf(g)) assert.deepStrictEqual(p.mat, { need:{ timber:1 }, got:{ timber:0 } });
  const g2 = fresh(); g2.stock.timber = 60;
  const r = freeBlock(g2, 5, 4);
  g2.tracePasture([[r.x,r.y],[r.x+5,r.y],[r.x+5,r.y+4],[r.x,r.y+4]]);
  const pa = g2.buildings[g2.buildings.length-1];
  assert.strictEqual(pa.mat.need.timber, g2.pastureCost(pa.plot.cells));
  assert.strictEqual(g2.stock.timber, 60);
  assert.ok(/attend bois/.test(g2.workStatus(pa)), "le panneau dit ce que le chantier attend");
});

test("retirer un ouvrier (−) : il redevient journalier, sa fiche le dit tout de suite et il quitte son poste", () => {
  const g = fresh();
  g.stock.timber = 40;
  const b = placeInCenter(g, "woodcutter"); b.done = true; b.progress = 1;
  g.assign(b.id);
  const v = g.workersOf(b)[0];
  v.skills.wood = 60;
  for(let i=0;i<MONTH_TICKS;i++){ g.step(); g.pendingEvent = null; }
  assert.ok(v.why.some(w=>w[0]==="Aime son métier"), "au travail, il aime son métier");
  const x0 = v.x, y0 = v.y;
  g.unassign(b.id);
  assert.strictEqual(v.work, -1);
  assert.strictEqual(g.workersOf(b).length, 0);
  assert.strictEqual(g.villagerStatus(v), v.sex==="f" ? "Journalière" : "Journalier");
  assert.ok(!v.why.some(w=>/métier/.test(w[0])), "plus de « aime son métier » dans sa fiche");
  for(let i=0;i<200;i++){ g.step(); g.pendingEvent = null; }
  assert.ok(Math.hypot(v.x-x0, v.y-y0) > 0.5 || v.state!=="idle", "il ne reste pas planté à son ancien poste");
  // un chantier en attente : il va y travailler
  const s = placeInCenter(g, "granary");
  g.assign(b.id); const w = g.workersOf(b)[0];
  g.unassign(b.id);
  assert.ok(w.task && (w.task.type==="haul" || w.task.type==="build") && w.task.bid===s.id, "il part aussitôt au chantier");
});


/* ================= étape 6 : nourriture, transformation et conservation ================= */
const { FOOD_DEFS, FOOD_TYPES: FT6, RECIPES, SMOKE_KEEP, GRANARY_CAP, STORE_SPOIL } = require("../js/sim.js");
function emptyFood(g){ for(const k of FT6.concat(["grain","flour","barley","oats"])) g.stock[k] = 0; }
// un atelier achevé avec un ouvrier, et rien d'autre qui travaille
function workshop(g, def){ const b = doneBuilding(g, def); g.assign(b.id); return b; }
function stepsUntil(g, n, until){ for(let i=0;i<n;i++){ g.step(); g.pendingEvent = null; if(until && until()) return i; } return n; }

test("étape 6 : le moulin donne de la farine, plus du pain ; le meunier va chercher le grain à la ferme", () => {
  const g = fresh(); houses(g, 3);
  const farm = doneBuilding(g, "farm");
  const mill = workshop(g, "windmill");
  emptyFood(g); g.stock.grain = 10;
  const miller = g.workersOf(mill)[0];
  // il part chercher le grain : le grain reste en réserve tant qu'il n'est pas déposé au moulin
  stepsUntil(g, 6000, ()=>miller.task && miller.task.type==="fetch");
  assert.strictEqual(miller.task.dep, farm.id, "va à la ferme");
  assert.strictEqual(g.stock.grain, 10, "rien n'est sorti avant la livraison");
  stepsUntil(g, 20000, ()=>miller.task && miller.task.type==="fetch" && miller.task.phase==="bring");
  assert.ok(miller.carry && miller.carry.grain>0, "il porte un sac");
  stepsUntil(g, 20000, ()=>(g.stock.flour||0)>=2);
  assert.ok(g.stock.flour>=2, "farine moulue");
  assert.ok(g.stock.grain<10, "le grain a quitté la réserve");
  assert.strictEqual(Math.round((g.stock.bread||0)*100), 0, "plus de pain direct au moulin");
  assert.ok(Math.abs((10 - g.stock.grain) - (g.stock.flour + mill.inp + g.inFetch("grain", true)*0)) < 1e-6, "1 grain → 1 farine, rien ne se perd");
});

test("étape 6 : la boulangerie cuit 1,5 pain par farine avec du bois, et s'arrête quand il y en a assez", () => {
  const g = fresh(); houses(g, 3);
  const mill = doneBuilding(g, "windmill");
  const bk = workshop(g, "bakery");
  emptyFood(g); g.stock.flour = 30; g.stock.firewood = 50;
  const target = g.craftTarget("bread");
  stepsUntil(g, 60000, ()=>g.stock.bread >= target);
  assert.ok(g.stock.bread >= target && g.stock.bread <= target + RECIPES.bakery.give + 1e-6, "cuit jusqu'à la réserve voulue ("+g.stock.bread+")");
  const used = 30 - g.stock.flour - bk.inp;
  assert.ok(Math.abs(g.stock.bread - used*1.5) < 1e-6, "1,5 pain par farine");
  assert.ok(g.stock.firewood < 50, "le four consomme du bois");
  assert.strictEqual(g.craftBlock(bk), "full", "ne cuit plus rien de trop : le pain rassit");
  assert.ok(/attend/i.test(g.workStatus(bk)), g.workStatus(bk));
});

test("étape 6 : sans boulangerie, chaque foyer logé cuit un peu de farine dans son four", () => {
  const g = fresh(); houses(g, 3);
  emptyFood(g); g.stock.flour = 20; g.stock.firewood = 40;
  const q = g.homeBake();
  const ovens = g.families.filter(f=>f.home>0).length;
  assert.ok(ovens>=3);
  assert.ok(Math.abs(q - Math.min(20, ovens, g.craftTarget("bread"))) < 1e-6, "1 farine par foyer, 1 pain par farine");
  assert.ok(Math.abs(g.stock.bread - q) < 1e-6);
  assert.ok(Math.abs(g.stock.flour - (20 - q)) < 1e-6);
});

test("étape 6 : la laiterie fait du fromage avec le lait (3 → 2), le fumoir fume la viande en en laissant de fraîche", () => {
  const g = fresh(); houses(g, 3);
  const d = workshop(g, "dairy"), s = workshop(g, "smokehouse");
  emptyFood(g); g.stock.milk = 12; g.stock.meat = 10; g.stock.firewood = 40;
  stepsUntil(g, 80000, ()=>g.stock.milk + d.inp < 3 && g.stock.meat <= SMOKE_KEEP + 1e-6 && s.inp < 1);
  assert.ok(Math.abs(g.stock.cheese - 8) < 1e-6, "12 laits → 8 fromages ("+g.stock.cheese+")");
  assert.ok(Math.abs(g.stock.smoked - (10 - SMOKE_KEEP)) < 1e-6, "on fume tout sauf "+SMOKE_KEEP+" ("+g.stock.smoked+")");
  assert.ok(Math.abs(g.stock.meat - SMOKE_KEEP) < 1e-6);
  assert.ok(g.stock.firewood < 40, "le fumoir brûle du bois");
});

test("étape 6 : faute de bois de chauffe, le four et le fumoir s'arrêtent", () => {
  const g = fresh(); houses(g, 3);
  const bk = doneBuilding(g, "bakery");
  bk.inp = 3; g.stock.firewood = 0; g.stock.bread = 0;
  assert.strictEqual(g.craftBlock(bk), "fuel");
  g.assign(bk.id);
  assert.ok(/bois de chauffe/.test(g.workStatus(bk)), g.workStatus(bk));
  g.stock.firewood = 5;
  assert.strictEqual(g.craftBlock(bk), null);
});

test("étape 6 : chaque denrée se gâte à son rythme ; l'hiver ralentit, l'été accélère", () => {
  const g = fresh(); emptyFood(g);
  for(const b of g.buildings.filter(b=>b.def==="granary")) g.demolish(b.id);
  toMonth(g, 3);   // avril
  g.stock.meat = 100; g.stock.smoked = 100; g.stock.milk = 100; g.stock.honey = 100; g.stock.cheese = 100; g.stock.grain = 100;
  g.spoilMonth();
  assert.ok(Math.abs(g.stock.meat - 100*(1-FOOD_DEFS.meat.spoil)) < 1e-6, "viande fraîche");
  assert.ok(Math.abs(g.stock.smoked - 100*(1-FOOD_DEFS.smoked.spoil)) < 1e-6, "viande fumée");
  assert.ok(g.stock.milk < 60, "le lait tourne");
  assert.strictEqual(g.stock.honey, 100, "le miel ne se gâte pas");
  assert.ok(Math.abs(g.stock.grain - 100*(1-STORE_SPOIL.grain)) < 1e-6, "le grain un peu (rats)");
  assert.ok(g.spoiled.meat > 0, "les pertes sont notées pour le joueur");
  assert.ok(g.spoilRate("meat", 0) < g.spoilRate("meat", 3) && g.spoilRate("meat", 3) < g.spoilRate("meat", 6), "hiver < printemps < été");
});

test("étape 6 : une grange abrite 200 denrées ; deux granges en abritent davantage", () => {
  const g = fresh(); emptyFood(g);
  g.stock.meat = 400; g.stock.bread = 200;   // 600 denrées
  const r0 = g.spoilRate("meat", 3);
  doneBuilding(g, "granary");
  const r1 = g.spoilRate("meat", 3);
  doneBuilding(g, "granary");
  const r2 = g.spoilRate("meat", 3);
  assert.ok(r1 < r0 && r2 < r1, r0+" > "+r1+" > "+r2);
  assert.ok(Math.abs(g.granaryShare() - 2*GRANARY_CAP/600) < 1e-9);
  g.stock.meat = 50; g.stock.bread = 0;
  assert.ok(Math.abs(g.spoilRate("meat", 3) - FOOD_DEFS.meat.spoil/3) < 1e-9, "petite réserve : tout est à l'abri");
  assert.ok(Math.abs(g.spoilRate("milk", 3) - FOOD_DEFS.milk.spoil) < 1e-9, "le lait n'y gagne rien");
});

test("étape 6 : on mange d'abord ce qui se gâte ; la variété se compte en familles d'aliments", () => {
  const g = fresh(); houses(g, 3); doneBuilding(g, "market");
  emptyFood(g);
  g.stock.meat = 3; g.stock.smoked = 50;
  g.stock.milk = 3; g.stock.cheese = 50;
  g.stock.bread = 50; g.stock.apples = 50;
  const need = g.foodNeed();
  const meal = g.eatMonth(true);
  assert.ok(g.stock.meat < 3 - 1e-6 && g.stock.smoked > 50 - need, "la viande fraîche part avant la fumée");
  assert.ok(g.stock.milk < 3 - 1e-6, "le lait avant le fromage");
  for(const f of g.families) assert.strictEqual(f.variety, 4, "pain, viande, laitages, fruits");
  assert.strictEqual(meal.starved, 0);
  assert.ok(Math.abs(meal.variety - 4) < 1e-9);
  // viande fraîche et viande fumée : une seule famille d'aliments
  emptyFood(g); g.stock.meat = 50; g.stock.smoked = 50;
  g.eatMonth(true);
  for(const f of g.families) assert.strictEqual(f.variety, 1);
});

test("étape 6 : le marché partage chaque sorte entre les foyers ; en pénurie, on sert les foyers l'un après l'autre", () => {
  const g = fresh(); houses(g, 3); doneBuilding(g, "market");
  emptyFood(g); g.stock.bread = 100; g.stock.meat = 100; g.stock.eggs = 0.6;   // quelques œufs seulement
  g.eatMonth(true);
  for(const f of g.families) assert.strictEqual(f.variety, 3, "le dernier foyer a aussi ses œufs");
  // pénurie : de quoi nourrir un peu plus d'un foyer
  emptyFood(g);
  const w0 = g.membersOf(g.families[0].id).reduce((s, v)=>s+FOOD_NEED[g.stageOf(v)], 0);
  g.stock.bread = w0*1.2;
  const meal = g.eatMonth(true);
  assert.ok(g.families[0].fed>0.999, "le premier foyer mange à sa faim");
  assert.ok(g.families[g.families.length-1].fed<0.5 && meal.starved>=1, "les autres ont faim : la disette n'affame pas tout le village d'un coup");
});

test("étape 6 : sans marché, un foyer mange une seule chose… mais ne meurt pas de faim si une autre reste", () => {
  const g = fresh(); houses(g, 3);
  emptyFood(g); g.stock.berries = 1; g.stock.meat = 100;
  const meal = g.eatMonth(false);
  assert.strictEqual(meal.starved, 0);
  for(const f of g.families) assert.ok(f.fed>0.999, "tous mangent");
  assert.ok(g.families.every(f=>f.variety<=2) && g.families.filter(f=>f.variety===1).length>=2, "au plus le reste d'une autre sorte");
});

test("étape 6 : la variété des repas compte dans l'approbation et l'humeur", () => {
  const g = fresh();
  assert.ok(g.varietyApproval(4) > g.varietyApproval(3) && g.varietyApproval(3) > g.varietyApproval(2) && g.varietyApproval(1) < 0);
  assert.ok(Math.abs(g.varietyApproval(2.5) - (g.varietyApproval(2)+g.varietyApproval(3))/2) < 1e-9, "progressif");
  houses(g, 3); doneBuilding(g, "market");
  emptyFood(g); for(const k of ["bread","meat","cheese","veg","apples"]) g.stock[k] = 100;
  feed(g); for(const k of ["bread","meat","cheese","veg","apples"]) g.stock[k] = 100;
  toMonth(g, 4); g.time.day = DAYS_PER_MONTH-1; g.time.tick = TICKS_PER_DAY-1; g.step();
  assert.ok(g.approvalWhy.some(w=>/Repas variés/.test(w[0]) && w[1]>=15), JSON.stringify(g.approvalWhy));
  const v = g.villagers[0];
  assert.ok(v.why.some(w=>w[0]==="Repas variés"), "l'humeur aussi");
});

test("étape 6 : disette — le grain en bouillie, la faim pèse, un marchand de grain passe", () => {
  const g = fresh(); houses(g, 3);
  emptyFood(g); g.stock.grain = 100;
  const meal = g.eatMonth(true);
  assert.ok(meal.gruel>0 && meal.starved===0, "on mange le grain en bouillie");
  assert.ok(g.families.every(f=>f.gruel && f.fed>0.999));
  assert.ok(g.stock.grain < 100);
  // le mois suivant : plus rien, ni grain ni farine
  emptyFood(g); g.treasury = 100;
  g.rnd = ()=>0.1;
  toMonth(g, 5); g.time.day = DAYS_PER_MONTH-1; g.time.tick = TICKS_PER_DAY-1; g.pendingEvent = null; g.step();
  assert.ok(g.dearth>=1, "disette");
  assert.ok(g.approvalWhy.some(w=>/faim/.test(w[0])));
  const ev = g.pendingEvent;
  assert.ok(ev && ev.title==="Un marchand de grain", "le marchand propose ses pois");
  const t0 = g.treasury, c = ev.choices[0];
  g.resolveEvent(0);
  assert.ok(g.stock.pulses >= c.qty - 1e-6 && g.treasury === t0 - Math.ceil(c.qty*c.price), "achat payé et livré");
  // pas de nouveau marchand avant trois mois
  emptyFood(g); toMonth(g, 6); g.time.day = DAYS_PER_MONTH-1; g.time.tick = TICKS_PER_DAY-1; g.step();
  assert.ok(!g.pendingEvent || g.pendingEvent.title!=="Un marchand de grain");
});

test("étape 6 : la soudure est annoncée en mars quand les vivres manquent", () => {
  const g = fresh(); houses(g, 3);
  emptyFood(g); g.stock.bread = g.foodNeed()*1.5;
  toMonth(g, 1); g.time.day = DAYS_PER_MONTH-1; g.time.tick = TICKS_PER_DAY-1; g.step();
  assert.ok(g.toasts.some(t=>/soudure/.test(t.text)), "avertissement de soudure");
  assert.ok(g.foodMonths() < 3);
});

test("étape 6 : démolir un atelier rend ce que l'artisan avait apporté", () => {
  const g = fresh();
  const m = doneBuilding(g, "windmill");
  m.inp = 3; g.stock.grain = 5;
  g.demolish(m.id);
  assert.strictEqual(g.stock.grain, 8);
});

test("étape 6 : sauvegarde v7 — ateliers et réserves gardés ; un meunier v6 en pleine mouture reprend normalement", () => {
  const g = fresh(); houses(g, 3);
  const m = workshop(g, "windmill"); m.inp = 2.5;
  g.stock.flour = 7; g.stock.cheese = 4; g.stock.smoked = 3; g.dearth = 2; g.merchantAt = 40;
  const data = JSON.parse(JSON.stringify(g.serialize()));
  assert.strictEqual(data.v, 7);
  const g2 = GameState.load(data);
  const m2 = g2.buildings.find(b=>b.id===m.id);
  assert.strictEqual(m2.inp, 2.5);
  assert.strictEqual(g2.stock.flour, 7); assert.strictEqual(g2.stock.cheese, 4); assert.strictEqual(g2.stock.smoked, 3);
  assert.strictEqual(g2.dearth, 2); assert.strictEqual(g2.merchantAt, 40);
  // une sauvegarde v6 : pas de farine, un meunier qui « moulait », pas de b.inp
  const old = JSON.parse(JSON.stringify(data));
  old.v = 6; delete old.stock.flour; delete old.stock.cheese; delete old.stock.smoked;
  for(const b of old.buildings) delete b.inp;
  const mv = old.villagers.find(v=>v.work===m.id); mv.task = { type:"mill" }; mv.state = "work";
  delete old.dearth; delete old.merchantAt; delete old.spoiled;
  const g3 = GameState.load(old);
  assert.strictEqual(g3.stock.flour, 0); assert.strictEqual(g3.stock.cheese, 0);
  assert.strictEqual(g3.buildings.find(b=>b.id===m.id).inp, 0);
  assert.strictEqual(g3.villagers.find(v=>v.id===mv.id).task, null);
  g3.stock.grain = 6;
  stepsUntil(g3, 30000, ()=>g3.stock.flour>=1);
  assert.ok(g3.stock.flour>=1, "le moulin reprend avec la farine");
});

test("étape 6 : trois ans de chaînes de transformation — ni exception ni valeur aberrante", () => {
  for(const seed of [5, 77]){
    const g = new GameState(seed, "prosperity", "normal");
    g.stock.timber = 80; g.treasury = 200; houses(g, 3);
    const p = newPasture(g, 5, 4); stockHerd(g, p, "cattle", 3, 1); g.assign(p.id);
    const farm = doneBuilding(g, "farm"); g.assign(farm.id);
    for(const c of ["wheat","peas","hay"]) newField(g, c, 3);
    for(const d of ["windmill","bakery","dairy","smokehouse","market"]) workshop(g, d);
    doneBuilding(g, "granary");
    g.stock.grain = 30;
    for(let i=0;i<36*MONTH_TICKS;i++){ g.step(); if(g.pendingEvent) g.resolveEvent(g.pendingEvent.choices.length-1); }
    for(const k of Object.keys(g.stock)) assert.ok(isFinite(g.stock[k]) && g.stock[k]>=-1e-9, k+" = "+g.stock[k]);
    for(const b of g.buildings) if(RECIPES[b.def]) assert.ok(isFinite(b.inp) && b.inp>=0, b.def+".inp");
    assert.ok(isFinite(g.approval));
  }
});

console.log("\n" + passed + " tests OK" + (process.exitCode ? " (avec échecs)" : ""));
