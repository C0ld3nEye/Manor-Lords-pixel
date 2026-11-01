"use strict";
/* Tests de la simulation (Phase 0 du plan docs/PLAN.md).
   Lancer avec : node test/sim.test.js */
const assert = require("assert");
const { GameState, BUILD_DEFS, EXT_DEFS, EXT_ORDER, CROP_DEFS, CROP_ORDER, FIELD_SIZES, W, H, T_GRASS, T_FOREST, T_STONE, MONTHS, seasonOf } = require("../js/sim.js");

let passed = 0;
function test(name, fn){
  try { fn(); passed++; console.log("ok - " + name); }
  catch(e){ console.error("ECHEC - " + name + "\n  " + e.message); process.exitCode = 1; }
}

function fresh(){ return new GameState(1176); }
function freeSpot(g){
  for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++)
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

test("victoire : les 4 objectifs remplis déclenchent victory", () => {
  const g = fresh();
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
  for(let x=2;x<W-2;x++) g.toggleRoad(x, 17);
  const pRoad = g.astar(2, 17, W-3, 17);
  assert.ok(pRoad, "chemin trouvé");
  // le coût total doit être réduit par la route
  let cost = 0;
  for(const wp of pRoad) cost += g.passableCost(Math.floor(wp.x), Math.floor(wp.y));
  assert.ok(cost < pRoad.length * 0.9, "les routes réduisent le coût du trajet");
});

test("comptoir : vend les surplus, crédite trésorerie et richesse", () => {
  const g = fresh();
  g.stock.timber = 50;
  g.stock.bread = 20; g.prices.bread = 3;
  const s = freeSpot(g);
  g.stock.timber = 50; g.stock.stone = 20;
  assert.strictEqual(g.place("trade", s.x, s.y), null);
  const b = g.buildings[g.buildings.length-1];
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
  const s = freeSpot(g);
  g.place("trade", s.x, s.y);
  const b = g.buildings[g.buildings.length-1];
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

console.log("\n" + passed + " tests OK" + (process.exitCode ? " (avec échecs)" : ""));
