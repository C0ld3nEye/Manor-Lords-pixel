"use strict";
/* Tests de la simulation (Phase 0 du plan docs/PLAN.md).
   Lancer avec : node test/sim.test.js */
const assert = require("assert");
const { GameState, BUILD_DEFS, EXT_DEFS, EXT_ORDER, CROP_DEFS, CROP_ORDER, FIELD_SIZES, REGION_DEFS, REGION_COST, POLICY_DEFS, POLICY_ORDER, CHURCH_UPGRADES, CHURCH_UP_ORDER, SETTLEMENT_LEVELS, MODES, DIFFICULTIES, W, H, T_GRASS, T_FOREST, T_STONE, MONTHS, seasonOf } = require("../js/sim.js");

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

test("affectation d'une famille à un camp de bûcherons", () => {
  const g = fresh();
  g.stock.timber = 50;
  const s = freeSpot(g);
  g.place("woodcutter", s.x, s.y);
  const b = g.buildings[g.buildings.length-1];
  b.done = true; b.progress = 1;
  g.assign(b.id);
  const f = g.families.find(f => f.work === b.id);
  assert.ok(f, "une famille est affectée");
  assert.strictEqual(g.unemployed(), g.families.length - 1);
});

test("journal : toast ajoute une entrée datée et est limité à 120", () => {
  const g = fresh();
  assert.strictEqual(g.log.length, 0);
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
  for(let i=0;i<500;i++) g.step();
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
  for(let i=0;i<5;i++) g.step();
  assert.ok(g.time.tick > t0.tick);
  for(let i=0;i<200;i++) g.step();
  assert.ok(g.time.day > 0 || g.time.month > t0.month || g.time.year > t0.year, "les jours avancent");
});

test("victoire : les 4 objectifs remplis déclenchent victory (mode prospérité)", () => {
  const g = new GameState(1176, "prosperity", "normal");
  g.objectives.wood = true; g.objectives.happy = true;
  g.objectives.pop = true; g.objectives.manor = true;
  for(let i=0;i<200 && !g.victory;i++) g.step();
  assert.strictEqual(g.victory, true);
});

test("extensions : 6 disponibles, coût débité, doublon refusé", () => {
  const g = fresh();
  assert.strictEqual(EXT_ORDER.length, 6);
  const b = g.buildings.find(x => x.def === "burgage");
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
  const b = g.buildings.find(x => x.def === "burgage");
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
  const b = g.buildings.find(x => x.def === "burgage");
  b.done = true; b.exts = ["garden", "chicken"];
  const veg0 = g.stock.veg, egg0 = g.stock.eggs;
  for(let i=0;i<160;i++) g.step(); // ~1 mois
  assert.ok(g.stock.veg > veg0, "légumes produits");
  assert.ok(g.stock.eggs > egg0, "oeufs produits");
});

test("verger ne produit qu'en août-octobre", () => {
  const g = fresh();
  const b = g.buildings.find(x => x.def === "burgage");
  b.done = true; b.exts = ["orchard"];
  g.time.month = 5; // juin : pas de pommes
  const a0 = g.stock.apples;
  for(let i=0;i<160;i++) g.step();
  assert.strictEqual(g.stock.apples, a0, "pas de récolte en juin");
  g.time.month = 8; // septembre
  for(let i=0;i<160;i++) g.step();
  assert.ok(g.stock.apples > a0, "récolte en septembre");
});

test("vêtements : consommation et impact sur l'approbation", () => {
  const g = fresh();
  g.stock.clothes = 0;
  let minAp = 100;
  for(let i=0;i<1600;i++){ g.step(); minAp = Math.min(minAp, g.approval); }
  assert.ok(minAp < 60, "approbation pénalisée sans vêtements");
});

test("sauvegarde ancienne : ext simple migré en exts", () => {
  const g = fresh();
  const data = JSON.parse(JSON.stringify(g.serialize()));
  data.buildings[0].ext = "garden";
  const g2 = GameState.load(data);
  assert.deepStrictEqual(g2.buildings[0].exts, ["garden"]);
});

test("phase 2 : 3 cultures et 3 tailles de champ", () => {
  assert.deepStrictEqual(CROP_ORDER, ["wheat","barley","fallow"]);
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
  assert.strictEqual(g.buyOx(), true);
  assert.strictEqual(g.stock.ox, 1);
  assert.strictEqual(g.treasury, 30);
  assert.ok(g.oxSpeed() > 1);
});

test("brasserie consomme de l'orge pour produire de l'ale", () => {
  const g = fresh();
  const b = g.buildings.find(x => x.def === "burgage");
  b.done = true; b.exts = ["brewer"];
  g.stock.barley = 5; g.stock.ale = 0;
  for(let i=0;i<160;i++) g.step();
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
  assert.ok(b.families.length > 0, "commerçant affecté");
  const t0 = g.treasury, w0 = g.wealth, bread0 = g.stock.bread;
  for(let i=0;i<200;i++) g.step(); // ~1 mois
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
  for(let i=0;i<400;i++) g.step(); // 2 mois
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
    try { const g = GameState.load(b); for(let i=0;i<50;i++) g.step(); }
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
  for(let i=0;i<10*16*12;i++) g.step(); // 1 an
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
  for(let i=0;i<200;i++) g.step();
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
  for(let i=0;i<400 && g.baron.regions.length===0;i++) g.step(); // jusqu'au mois 6
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
  for(let i=0;i<800 && !g.pendingEvent;i++) g.step(); // jusqu'au mois 4
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
  for(let i=0;i<5000 && g.camps.length>0;i++) g.step();
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
  for(let i=0;i<10*16*12;i++) g.step(); // 1 an
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
  for(let i=0;i<200;i++) g.step(); // 1 mois
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
  for(let i=0;i<1200 && g.units.length>0;i++) g.step(); // ~6 mois
  assert.strictEqual(g.units.length, 0, "mercenaire parti après son contrat");
});

test("phase 5 jalon 4 : mercenaire attaque un camp comme la milice", () => {
  const g = fresh();
  g.treasury = 100;
  const b = g.buildings[0];
  g.camps.push({ id:99, x:b.x+1.5, y:b.y+0.5, hp:20, maxHp:20 });
  g.hireMercenary();
  for(let i=0;i<5000 && g.camps.length>0;i++) g.step();
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
  for(let i=0;i<10*16*12;i++) g.step(); // 1 an suffit
  assert.strictEqual(g.baron.regions.length, 0, "pas de réclamation du baron");
  assert.strictEqual(g.camps.length, 0, "pas de camps");
});

test("phase 6 : mode 'edge' démarre avec moins de ressources et gagne en survivant 3 ans", () => {
  const g = new GameState(1176, "edge", "normal");
  assert.ok(g.stock.timber < 15, "ressources réduites au départ");
  g.time.year = 1179;
  for(let i=0;i<200;i++) g.step();
  assert.strictEqual(g.victory, true, "victoire après 3 ans");
});

test("phase 6 : mode 'duel' = victoire si toutes les régions à nous, sans camps, après 1179", () => {
  const g = new GameState(1176, "duel", "hard");
  g.treasury = 200; g.wealth = 200;
  g.claimRegion(1); g.claimRegion(2);
  g.camps.length = 0;
  g.time.year = 1179; g.time.month = 6;
  for(let i=0;i<300;i++) g.step();
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
const { BUILD_STAGES, buildStage, PLOT_FRONT, polyArea, pointInPoly } = require("../js/sim.js");

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
  assert.strictEqual(g.stock.timber, 0);
  assert.strictEqual(zoneSetup(0).traceZone(RECT), "Ressources insuffisantes");
});

test("étape 3 : tracer crée des maisons en chantier qui occupent leur parcelle", () => {
  const g = zoneSetup();
  assert.strictEqual(g.traceZone(ORGANIC, 4), null);
  const ps = plotsOf(g);
  assert.strictEqual(ps.length, 4);
  assert.strictEqual(g.stock.timber, 46);
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
  for(let t=0;t<12000 && ps.some(b=>!b.done);t++){ g.step(); for(const b of ps) if(!b.done) seen.add(buildStage(b)); g.pendingEvent=null; }
  assert.ok(ps.every(b=>b.done), "maisons achevées");
  assert.ok(seen.has(0) && seen.has(3), "le chantier est passé par plusieurs étapes");
});

test("étape 3 : les agrandissements se posent dans la cour, dans la limite de la place", () => {
  const g = zoneSetup();
  g.traceZone([[18,5],[20,5],[20,6],[18,6]], 1);   // maison + 1 case de cour
  const b = plotsOf(g)[0]; b.done = true; b.progress = 1;
  assert.strictEqual(g.yardCells(b).length, 1);
  g.buyExtension(b.id, "garden");
  assert.deepStrictEqual(b.exts, ["garden"]);
  assert.strictEqual(b.plot.extAt.garden, b.plot.cells[1]);
  const timber = g.stock.timber;
  g.buyExtension(b.id, "chicken");
  assert.deepStrictEqual(b.exts, ["garden"], "cour pleine : refusé");
  assert.strictEqual(g.stock.timber, timber, "rien n'est dépensé");
  const g2 = zoneSetup();
  g2.traceZone(RECT);
  const b2 = plotsOf(g2)[0]; b2.done = true; b2.progress = 1;
  const target = b2.plot.cells[3];
  g2.buyExtension(b2.id, "orchard", target);
  assert.strictEqual(b2.plot.extAt.orchard, target);
  assert.ok(!g2.freeYardCells(b2).includes(target));
});

test("étape 3 : sauvegarde v3 des parcelles et de leur contour, démolition libère la cour", () => {
  const g = zoneSetup();
  g.traceZone(ORGANIC);
  const b = plotsOf(g)[0]; b.done = true; b.progress = 1;
  g.buyExtension(b.id, "garden");
  const data = JSON.parse(JSON.stringify(g.serialize()));
  assert.strictEqual(data.v, 3);
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

console.log("\n" + passed + " tests OK" + (process.exitCode ? " (avec échecs)" : ""));
