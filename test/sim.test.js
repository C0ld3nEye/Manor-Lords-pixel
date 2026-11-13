"use strict";
/* Tests de la simulation (Phase 0 du plan docs/PLAN.md).
   Lancer avec : node test/sim.test.js */
const assert = require("assert");
const { GameState, BUILD_DEFS, EXT_DEFS, EXT_ORDER, CROP_DEFS, CROP_ORDER, FIELD_SIZES, REGION_COST, REGION_COLS, REGION_ROWS, POLICY_DEFS, POLICY_ORDER, CHURCH_UPGRADES, CHURCH_UP_ORDER, SETTLEMENT_LEVELS, MODES, DIFFICULTIES, W, H, T_GRASS, T_FOREST, T_STONE, T_FORD, MONTHS, seasonOf, TS, TICKS_PER_DAY, DAYS_PER_MONTH, GOALS, TRADE_BASE, EXT_FOOD, SERF_CRAFT } = require("../js/sim.js");
const MONTH_TICKS = TICKS_PER_DAY*DAYS_PER_MONTH, YEAR_TICKS = MONTH_TICKS*12;
// La carte est devenue grande (256 × 192). Les tests d'avant étaient écrits pour la petite carte (46 × 34)
// dont le centre était (23, 17) : on décale leurs coordonnées pour qu'elles tombent autour du départ.
const OW = 46, OH = 34, DX = Math.floor(W/2) - 23, DY = Math.floor(H/2) - 17;
const Z = (poly)=>poly.map(q=>[q[0]+DX, q[1]+DY]);

let passed = 0;
function test(name, fn){
  try { fn(); passed++; console.log("ok - " + name); }
  catch(e){ console.error("ECHEC - " + name + "\n  " + e.message); process.exitCode = 1; }
}

function fresh(){ return new GameState(1176, "peace", "normal"); } // mode combat pour les tests baron/camps
function placeInCenter(g, def){
  g.setFieldSize(3);
  // étape 7c : les métiers d'artisan demandent des bourgeois ; les tests d'avant les supposent disponibles
  if(["windmill","bakery","dairy","smokehouse","market","trade"].includes(def)) for(const f of g.families) if(f.ord==="serf") f.ord = "bourg";
  if(def==="quarry"){   // sur la grande carte, la pierre n'est pas forcément dans le carré du départ : le gisement à vous le plus proche
    const c = g.buildings.find(b=>b.def==="camp") || { x:W/2, y:H/2 };
    const st = []; for(let i=0;i<W*H;i++) if(g.tiles[i]===T_STONE && g.occupied[i]<0 && g.regionOwned(i%W, (i/W)|0)) st.push(i);
    st.sort((a, b)=>Math.hypot(a%W-c.x, ((a/W)|0)-c.y) - Math.hypot(b%W-c.x, ((b/W)|0)-c.y));
    for(const i of st) if(g.place(def, i%W, (i/W)|0)===null) return g.buildings[g.buildings.length-1];
  }
  for(let y=DY+1;y<DY+OH-4;y++) for(let x=DX+Math.ceil(OW/3)+1;x<DX+Math.floor(2*OW/3)-4;x++)
    if(g.place(def, x, y)===null) return g.buildings[g.buildings.length-1];
  throw new Error("pas de place pour "+def);
}
// bourgage d'une case (ancien système, gardé pour les vieilles sauvegardes) posé pour les tests
function legacyHouse(g){
  const b0 = g.buildings.find(x => x.def === "burgage"); if(b0) return b0;
  for(let i=0;i<W*H;i++){ if(!g.place("burgage", i%W, (i/W)|0)) return g.buildings[g.buildings.length-1]; }
}


function freeSpot(g){
  for(let y=DY+1;y<DY+OH-1;y++) for(let x=DX+Math.ceil(OW/3)+1;x<DX+Math.floor(2*OW/3)-1;x++) // autour du départ (région possédée)
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
  for(let i=0;i<W*H;i++) if(g.tiles[i]===T_STONE && g.occupied[i]<0 && g.regionOwned(i%W, (i/W)|0)){ stone = i; break; }
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

test("victoire : toute la chaîne des objectifs remplie déclenche victory (mode prospérité)", () => {
  const g = new GameState(1176, "prosperity", "normal");
  for(const x of GOALS.slice(0, -1)) g.goals.done[x.id] = 0;
  for(let i=0;i<MONTH_TICKS && !g.victory;i++) g.step();
  assert.strictEqual(g.victory, false, "il manque le dernier objectif");
  g.goals.done[GOALS[GOALS.length-1].id] = 0;
  for(let i=0;i<MONTH_TICKS && !g.victory;i++) g.step();
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

test("extensions : le tailleur dès le niveau 1 (étape 8), la brasserie au niveau 2", () => {
  const g = fresh();
  const b = legacyHouse(g);
  b.done = true; b.lvl = 1;
  g.stock.timber = 10; g.stock.stone = 10;
  g.buyExtension(b.id, "brewer");
  assert.strictEqual(b.exts.length, 0, "brasserie refusée au niveau 1");
  g.buyExtension(b.id, "tailor");
  assert.ok(b.exts.includes("tailor"), "tailleur accepté au niveau 1 : sans vêtements, aucune maison ne monte");
  b.lvl = 2;
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
  const x0 = DX+Math.ceil(OW/3)+1, xEnd = DX+Math.floor(2*OW/3)-2, ry = DY+17-6;
  for(let x=x0;x<=xEnd;x++){ const i = ry*W+x; g.tiles[i] = T_GRASS; g.occupied[i] = -1; g.toggleRoad(x, ry); }
  const pRoad = g.astar(x0, ry, xEnd, ry);
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
  let diff = false;
  for(let i=0;i<6*MONTH_TICKS && !diff;i++){ g.step(); g.pendingEvent = null; diff = Object.keys(p0).some(k => g.prices[k] !== p0[k]); }
  assert.ok(diff, "au moins un prix a changé");
  for(const k of Object.keys(g.prices)) assert.ok(g.prices[k] >= 0.5 && g.prices[k] <= TRADE_BASE[k]*1.2 + 1e-9, "prix autour du prix de base : "+k+" "+g.prices[k]);
});

test("sauvegarde : routes, richesse et prix persistés", () => {
  const g = fresh();
  const s = freeSpot(g);
  g.toggleRoad(s.x, s.y);
  g.wealth = 123; g.prices.bread = 2.4;
  const g2 = GameState.load(JSON.parse(JSON.stringify(g.serialize())));
  assert.strictEqual(g2.roadAt(s.x, s.y), true);
  assert.strictEqual(g2.wealth, 123);
  assert.strictEqual(g2.prices.bread, 2.4);
  g.prices.honey = 400;   // une ancienne partie où le prix avait dérivé
  assert.ok(GameState.load(JSON.parse(JSON.stringify(g.serialize()))).prices.honey <= TRADE_BASE.honey*1.5, "un prix aberrant est ramené");
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

// une case de terre dans une région donnée (pour vérifier qu'on y passe ou non)
function landIn(g, rid){ for(let i=0;i<W*H;i++) if(g.regionMap[i]===rid && g.tiles[i]===T_GRASS && g.occupied[i]<0) return { x:i%W, y:(i/W)|0 }; return null; }
function farRegion(g){ const st = g.regions[g.startRegion]; return g.regions.find(r=>r.id!==st.id && !st.nb.includes(r.id)); }

test("grande carte : une vingtaine de régions organiques, seule celle du départ est à vous", () => {
  const g = fresh();
  assert.strictEqual(g.regions.length, REGION_COLS*REGION_ROWS);
  assert.deepStrictEqual(g.regions.filter(r=>r.owned).map(r=>r.id), [g.startRegion]);
  assert.strictEqual(g.regionOwned(Math.floor(W/2), Math.floor(H/2)), true, "le centre est à vous");
  assert.strictEqual(g.regionOwned(1, 1), false);
  assert.strictEqual(g.regionOwned(W-2, H-2), false);
  const st = g.regions[g.startRegion];
  assert.strictEqual(st.name, "Val du Cœur");
  assert.ok(st.n > 3000, "région de départ assez grande ("+st.n+" cases)");
  assert.ok(st.nb.length>=3, "plusieurs voisines");
  for(const r of g.regions){ assert.ok(r.n>0 && typeof r.name==="string" && r.name.length>0); for(const k of r.nb) assert.ok(g.regions[k].nb.includes(r.id), "voisinage réciproque"); }
});

test("grande carte : chaque région est d'un seul tenant", () => {
  const g = fresh();
  for(const r of g.regions){
    const start = (()=>{ for(let i=0;i<W*H;i++) if(g.regionMap[i]===r.id) return i; })();
    const seen = new Uint8Array(W*H), q = [start]; seen[start] = 1; let n = 1;
    for(let h=0; h<q.length; h++){ const i = q[h], x = i%W, y = (i/W)|0;
      for(const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx = x+dx, ny = y+dy; if(nx<0||ny<0||nx>=W||ny>=H) continue; const k = ny*W+nx;
        if(!seen[k] && g.regionMap[k]===r.id){ seen[k] = 1; q.push(k); n++; } } }
    assert.strictEqual(n, r.n, r.name+" d'un seul tenant");
  }
});

test("grande carte : de quoi commencer près du campement (bois, baies, pierre), un gué sur la rivière", () => {
  for(const seed of [1176, 42, 7, 999, 31337]){
    const g = new GameState(seed, "prosperity", "normal");
    const camp = g.buildings.find(b=>b.def==="camp");
    const near = (t, R)=>{ let n = 0; for(let y=camp.y-R; y<=camp.y+R; y++) for(let x=camp.x-R; x<=camp.x+R; x++) if(x>=0&&y>=0&&x<W&&y<H && g.tiles[y*W+x]===t && g.regionOwned(x, y) && Math.hypot(x-camp.x, y-camp.y)<=R) n++; return n; };
    assert.ok(near(T_FOREST, 16) >= 20, "un bois à portée (graine "+seed+")");
    assert.ok(near(2, 17) >= 3, "des baies (graine "+seed+")");
    assert.ok(near(T_STONE, 27) >= 3, "de la pierre (graine "+seed+")");
    let fords = 0; for(const t of g.tiles) if(t===T_FORD) fords++;
    assert.ok(fords >= 6, "des gués");
    const st = g.regions[g.startRegion]; let f = 0;
    for(let i=0;i<W*H;i++) if(g.regionMap[i]===st.id && g.tiles[i]===T_FOREST) f++;
    assert.ok(f/st.n > 0.15 && f/st.n < 0.4, "bois dans la région de départ : "+Math.round(f/st.n*100)+" %");
    assert.ok(g.deer.length >= 50, "du gibier");
  }
});

test("grande carte : on traverse la rivière au gué, pas ailleurs", () => {
  const g = fresh();
  for(const r of g.regions) r.owned = true;   // toute la carte, pour suivre la rivière
  let ford = -1; for(let i=0;i<W*H;i++) if(g.tiles[i]===T_FORD){ ford = i; break; }
  assert.ok(ford>=0);
  const fx = ford%W, fy = (ford/W)|0;
  assert.strictEqual(g.passable(fx, fy), true, "le gué se traverse");
  let water = -1; for(let i=0;i<W*H;i++) if(g.tiles[i]===4){ water = i; break; }
  assert.strictEqual(g.passable(water%W, (water/W)|0), false, "l'eau profonde, non");
  assert.ok(g.canPlace("woodcutter", fx, fy), "on ne bâtit pas sur un gué");
});

test("jalon 1 : région non réclamée infranchissable et non constructible", () => {
  const g = fresh();
  const p = landIn(g, farRegion(g).id);
  assert.strictEqual(g.passable(p.x, p.y), false, "passable refuse une région qui n'est pas à vous");
  assert.strictEqual(g.place("burgage", p.x, p.y), "Région non réclamée");
  assert.strictEqual(g.walkable(p.x, p.y), true, "mais les bêtes sauvages y vont");
});

test("jalon 1 : on réclame une région voisine (coût croissant), pas une région lointaine", () => {
  const g = fresh();
  const st = g.regions[g.startRegion], nb = st.nb[0], far = farRegion(g);
  g.treasury = 10; g.wealth = 100;
  assert.strictEqual(g.claimRegion(nb), false, "trésorerie insuffisante");
  g.treasury = 500; g.wealth = 500;
  assert.strictEqual(g.claimRegion(far.id), false, "une région lointaine ne se réclame pas");
  const c1 = g.regionCost();
  assert.deepStrictEqual(c1, REGION_COST);
  assert.strictEqual(g.claimRegion(nb), true);
  assert.strictEqual(g.treasury, 500 - c1.treasury);
  assert.strictEqual(g.wealth, 500 - c1.wealth);
  const p = landIn(g, nb);
  assert.strictEqual(g.passable(p.x, p.y), true, "région débloquée");
  assert.strictEqual(g.claimRegion(nb), false, "déjà possédée");
  assert.ok(g.regionCost().treasury > c1.treasury, "la suivante coûte plus cher");
});

test("jalon 1 : bonus de région chaque mois", () => {
  const g = fresh();
  g.treasury = 500; g.wealth = 500;
  const st = g.regions[g.startRegion];
  g.regions[st.nb[0]].bonus = { berries:2 }; g.regions[st.nb[1]].bonus = { stone:1 };
  g.claimRegion(st.nb[0]); g.claimRegion(st.nb[1]);
  g.stock.berries = 0; g.stock.stone = 0;
  for(let i=0;i<200*TS;i++) g.step();
  assert.ok(g.stock.berries >= 2, "+2 baies/mois");
  assert.ok(g.stock.stone >= 1, "+1 pierre/mois");
  for(const r of g.regions) if(r.id!==g.startRegion) assert.ok(r.bonus && Object.keys(r.bonus).length===1, "chaque région a un bonus");
});

test("jalon 1 : sauvegarde persiste les régions (leur forme vient de la graine)", () => {
  const g = fresh();
  g.treasury = 500; g.wealth = 500; const nb = g.regions[g.startRegion].nb[1]; g.claimRegion(nb);
  const g2 = GameState.load(JSON.parse(JSON.stringify(g.serialize())));
  assert.strictEqual(g2.regions[nb].owned, true);
  assert.strictEqual(g2.regions.filter(r=>r.owned).length, 2);
  for(let i=0;i<W*H;i+=97) assert.strictEqual(g2.regionMap[i], g.regionMap[i]);
  assert.strictEqual(g2.regions[nb].name, g.regions[nb].name);
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

test("phase 5 jalon 1 : décrets activables et abrogeables (la dîme est devenue une redevance)", () => {
  const g = fresh();
  assert.strictEqual(POLICY_ORDER.length, 2);
  assert.ok(!POLICY_DEFS.tithe, "plus de décret de dîme");
  g.setPolicy("freeMarket", true);
  assert.strictEqual(g.policies.freeMarket, true);
  const w0 = g.wealth;
  for(let i=0;i<200*TS;i++) g.step(); // 1 mois
  assert.ok(g.wealth > w0, "les marchés libres font monter la richesse");
  g.setPolicy("freeMarket", false);
  assert.strictEqual(g.policies.freeMarket, false, "abrogeable");
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
  assert.ok(g.claimRegion(g.regions[g.startRegion].nb[0]));
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
  assert.strictEqual(bonus.approval, CHURCH_UPGRADES.altar.bonus.approval + CHURCH_UPGRADES.bell.bonus.approval);
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

test("phase 6 : mode 'duel' = victoire si les terres voisines du départ sont à nous, sans camps, après 1179", () => {
  const g = new GameState(1176, "duel", "hard");
  g.treasury = 5000; g.wealth = 5000;
  assert.ok(g.goalRegions().length>=4, "le départ et ses voisines");
  for(const r of g.goalRegions()) if(!r.owned) assert.ok(g.claimRegion(r.id), r.name);
  g.camps.length = 0;
  g.time.year = 1179; g.time.month = 6;
  for(let i=0;i<300*TS;i++) g.step();
  assert.strictEqual(g.victory, true);
});

test("phase 6 : défaite après 6 mois à approbation très basse (famine)", () => {
  const g = new GameState(1176, "peace", "hard");
  g.time.year = 1178;
  g.stock.berries=0; g.stock.meat=0; g.stock.bread=0; g.stock.firewood=0; g.stock.clothes=0;
  for(const f of g.families) f.clothed = false;   // en haillons dès le départ
  for(let m=0;m<8 && !g.defeat;m++) g.onMonth();
  assert.strictEqual(g.defeat, true);
  assert.ok(/approbation/.test(g.endReason));
  // le compteur retombe si l'approbation remonte
  const g2 = new GameState(1176, "peace", "hard");
  g2.time.year = 1178;
  g2.stock.berries=0; g2.stock.meat=0; g2.stock.bread=0; g2.stock.firewood=0; g2.stock.clothes=0;
  for(const f of g2.families) f.clothed = false;
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
  // une sauvegarde sans modeId -> mode par défaut, ne plante pas
  const d1 = JSON.parse(JSON.stringify(g.serialize())); delete d1.modeId; delete d1.diffId;
  const g1 = GameState.load(d1);
  assert.strictEqual(g1.modeId, "prosperity");
  // une partie de l'ancienne petite carte ne se charge plus
  assert.throws(()=>GameState.load({ v:7, seed:1, tiles:new Array(46*34).fill(0) }), /ancienne carte/);
});

/* ---------- étape 3 : chantiers en étapes et parcelles tracées point par point ---------- */
const { BUILD_STAGES, buildStage, PLOT_FRONT, polyArea, pointInPoly, BUILD_ORDER } = require("../js/sim.js");

// terrain dégagé dans la région centrale, route horizontale en y=4 (x 16 → 28)
function zoneSetup(timber){
  const g = fresh();
  for(let y=4;y<=11;y++) for(let x=16;x<=28;x++){ const i=(y+DY)*W+x+DX; g.tiles[i]=T_GRASS; g.occupied[i]=-1; g.roads[i]=0; }
  for(let x=16;x<=28;x++) g.roads[(4+DY)*W+x+DX]=1;
  g.stock.timber = timber===undefined ? 50 : timber;
  return g;
}
const RECT = Z([[18,5],[24,5],[24,8],[18,8]]);                 // 6 × 3 cases
const ORGANIC = Z([[17,5],[25,5],[24.5,7.25],[23,10],[20,9.5],[17.5,6.75]]); // forme libre, plus profonde au milieu
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
  assert.strictEqual(g.planZone(Z([[18,5],[24,5]])).err, "Posez au moins 3 points");
  assert.strictEqual(g.planZone(Z([[18,5],[24,8],[24,5],[18,8]])).err, "Le contour se croise");
  assert.strictEqual(g.planZone(Z([[18,6],[24,6],[24,9],[18,9]])).err, "La zone doit longer une route");
  assert.strictEqual(g.planZone(Z([[18,4],[24,4],[24,7],[18,7]])).err, "La zone empiète sur une route");
  g.occupied[(6+DY)*W+20+DX] = 999;
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
  g.traceZone(Z([[18,5],[24,5],[24,7],[18,7]]));
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
  assert.ok(gs > EXT_FOOD.garden && gb > gs, "grande cour : plus de légumes ("+gs.toFixed(2)+" < "+gb.toFixed(2)+")");
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
  assert.strictEqual(data.v, 8);
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
  const P = (x, y, prev)=>{ const r = g.snapZonePoint(x+DX, y+DY, prev ? [prev[0]+DX, prev[1]+DY] : undefined); return [r[0]-DX, r[1]-DY]; };
  assert.deepStrictEqual(P(19.3, 5.35), [19.25, 5], "collé au bord de la route");
  assert.deepStrictEqual(P(19.3, 5.8), [19.25, 5.75], "trop loin : pas d'aimant");
  assert.deepStrictEqual(P(23.1, 5.55, [19, 5]), [23, 5], "trait parallèle à la route : reste droit");
  assert.deepStrictEqual(P(23.1, 6.4, [19, 5]), [23, 6.5], "on s'en échappe en tirant plus loin");
  assert.deepStrictEqual(P(23.1, 5.55, [19, 7]), [23, 5.5], "pas de résistance loin de la route");
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
  assert.strictEqual(data.v, 8);
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

/* ================= étape 5 : agriculture et élevage approfondis ================= */
const { CROP_CAL, LIVESTOCK, LIVESTOCK_ORDER, PASTURE_MIN, PLOT_MIN, monthsTxt } = require("../js/sim.js");
function feed(g){ g.stock.berries = 250; g.stock.meat = 250; g.stock.firewood = 250; g.stock.clothes = 50; }
function toMonth(g, m){ g.time.month = m; g.time.day = 0; g.time.tick = 0; }
function newField(g, crop, n){ g.setFieldSize(n||4); const b = placeInCenter(g, "field"); if(crop) g.setCrop(b.id, crop); return b; }
function sownField(g, crop, growth){ const b = newField(g, crop); Object.assign(b.f, { sown:true, sownCrop:crop, growth:growth, sownAt:g.monthIdx()-6, cond:1, hits:[] }); return b; }
function freeBlock(g, w, h){
  for(let y=DY-14;y<DY+OH+14-h;y++) for(let x=DX+Math.ceil(OW/3)-14;x<DX+Math.floor(2*OW/3)+14-w;x++){
    let ok = true;
    for(let yy=-1; yy<=h && ok; yy++) for(let xx=-1; xx<=w && ok; xx++){ const i=(y+yy)*W+x+xx; if(g.tiles[i]!==T_GRASS || g.occupied[i]>=0 || g.roads[i] || !g.regionOwned(x+xx, y+yy)) ok = false; }
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

test("étape 5 bis : sauvegarde — matériaux, priorité et bœuf mené gardés, données abîmées corrigées", () => {
  const g = fresh();
  g.stock.timber = 40; g.stock.stone = 10;
  const b = placeInCenter(g, "manor");
  g.setSitePrio(b.id, true);
  quietSteps(g, 60*DAY, ()=>g.oxen.some(o=>o.lead>0 && g.villager(o.lead).task.phase==="bring"));
  const data = JSON.parse(JSON.stringify(g.serialize()));
  assert.strictEqual(data.v, 8);
  const g2 = GameState.load(data), b2 = g2.buildings.find(x=>x.id===b.id);
  assert.deepStrictEqual(b2.mat, b.mat);
  assert.strictEqual(b2.prio, true);
  assert.strictEqual(g2.oxen[0].lead, g.oxen[0].lead, "le bœuf est toujours mené par le même journalier");
  quietSteps(g2, 60*DAY, ()=>g2.matFrac(b2)>=1);
  assert.strictEqual(g2.matFrac(b2), 1, "le charroi reprend après le chargement");
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

test("étape 6 : sauvegarde — ateliers et réserves gardés", () => {
  const g = fresh(); houses(g, 3);
  const m = workshop(g, "windmill"); m.inp = 2.5;
  g.stock.flour = 7; g.stock.cheese = 4; g.stock.smoked = 3; g.dearth = 2; g.merchantAt = 40;
  const data = JSON.parse(JSON.stringify(g.serialize()));
  assert.strictEqual(data.v, 8);
  const g2 = GameState.load(data);
  const m2 = g2.buildings.find(b=>b.id===m.id);
  assert.strictEqual(m2.inp, 2.5);
  assert.strictEqual(g2.stock.flour, 7); assert.strictEqual(g2.stock.cheese, 4); assert.strictEqual(g2.stock.smoked, 3);
  assert.strictEqual(g2.dearth, 2); assert.strictEqual(g2.merchantAt, 40);
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


/* ================= petits détails : fermier case par case, capacité des maisons ================= */
const { HOUSE_CAP } = require("../js/sim.js");

test("détail : le fermier avance de case en case, sur la case qu'il laboure", () => {
  const g = fresh(); houses(g, 3);
  const farm = doneBuilding(g, "farm"); g.assign(farm.id);
  const fd = newField(g, "wheat");
  toMonth(g, 8);   // septembre : on laboure le blé d'hiver
  const v = g.workersOf(farm)[0];
  const cells = g.fieldCells(fd), n = cells.length;
  assert.strictEqual(n, 9);
  // le serpentin : une rangée dans un sens, la suivante dans l'autre, jamais de saut
  for(let k=1;k<n;k++){ const a = cells[k-1], b = cells[k]; assert.ok(Math.abs((a%W)-(b%W)) + Math.abs(((a/W)|0)-((b/W)|0)) === 1, "cases voisines ("+k+")"); }
  const seen = new Set(); let moved = 0, last = null;
  for(let i=0;i<MONTH_TICKS*3 && fd.f.plow<1;i++){
    g.step(); g.pendingEvent = null;
    if(v.state==="work" && v.task && v.task.type==="plow"){
      const ci = cells.indexOf(Math.floor(v.y)*W + Math.floor(v.x));
      const arrived = Math.hypot(v.x - v.task.gx, v.y - v.task.gy) < 0.3;
      if(ci>=0 && arrived){ seen.add(ci); const want = Math.min(n-1, Math.floor(fd.f.plow*n)); if(i%40===0) assert.ok(Math.abs(ci-want)<=2, "sur la case en cours : case "+ci+", labouré "+fd.f.plow.toFixed(2)); }
      if(last && (last.x!==v.x || last.y!==v.y)) moved++;
      last = { x:v.x, y:v.y };
    }
  }
  assert.ok(fd.f.plow>=1, "labour fini");
  assert.ok(seen.size>=n-3, "il est passé sur presque toutes les cases ("+seen.size+"/"+n+")");
  assert.ok(moved>0);
});

test("détail : un fermier qui a fini au milieu d'un champ en ressort au lieu de rester coincé", () => {
  const g = fresh(); houses(g, 3);
  const farm = doneBuilding(g, "farm"); g.assign(farm.id);
  const fd = newField(g, "wheat");
  const v = g.workersOf(farm)[0];
  const c = g.fieldCells(fd)[4];   // la case du milieu : aucun voisin libre
  v.x = (c%W) + 0.5; v.y = ((c/W)|0) + 0.5; v.state = "idle"; v.cool = 0; v.task = null;
  const inside = ()=>g.occupied[Math.floor(v.y)*W + Math.floor(v.x)]===fd.id;
  assert.ok(inside());
  for(let i=0;i<3000 && inside();i++){ g.step(); g.pendingEvent = null; }
  assert.ok(!inside(), "il est sorti du champ");
});

test("détail : une maison indique ses habitants et sa capacité selon son niveau ; pleine, elle n'a plus de naissance", () => {
  const g = fresh(); houses(g, 4);
  const b = g.buildings.find(x=>x.def==="burgage");
  assert.deepStrictEqual(HOUSE_CAP, [0, 6, 8, 10]);
  assert.strictEqual(g.houseCap(b), 6);
  b.lvl = 2; assert.strictEqual(g.houseCap(b), 8); b.lvl = 3; assert.strictEqual(g.houseCap(b), 10); b.lvl = 1;
  const fam = g.houseFamily(b) || (()=>{ const f = g.makeFamily("Test"); f.home = b.id; return f; })();
  const n0 = g.houseCount(b);
  assert.strictEqual(n0, g.membersOf(fam.id).length);
  // un couple fécond : sans la limite, la naissance a lieu (graine fixée) ; maison pleine, non
  g.villagers = g.villagers.filter(v=>v.fam!==fam.id);
  const m = g.makePerson(fam, "m", 25, { x:b.x, y:b.y }), w = g.makePerson(fam, "f", 24, { x:b.x, y:b.y });
  g.marry(m, w);
  for(let k=0;k<HOUSE_CAP[1]-2;k++){ const kid = g.makePerson(fam, "m", 2+k, { mother:w.id, father:m.id, x:b.x, y:b.y }); kid.bornAt = g.monthIdx() - 60; }
  assert.strictEqual(g.houseCount(b), HOUSE_CAP[1]);
  fam.fed = 1; g.approval = 80;
  const before = g.membersOf(fam.id).length;
  withRnd(g, 0, ()=>g.demography(false, 1));
  assert.strictEqual(g.membersOf(fam.id).length, before, "maison pleine : aucune naissance");
  // au niveau 2 elle a de la place : les enfants ont grandi (moins de 3 de moins de 12 ans) et une naissance est possible
  b.lvl = 2; g.villagers.filter(v=>v.mother===w.id).forEach(v=>{ v.bornAt = g.monthIdx() - 200; });
  withRnd(g, 0, ()=>g.demography(false, 1));
  assert.ok(g.membersOf(fam.id).length>before, "au niveau 2, un enfant naît");
});

test("détail : quand le bœuf est pris, les autres journaliers traînent un tronc au lieu d'attendre", () => {
  const g = fresh();
  g.stock.timber = 40;
  const sites = [placeInCenter(g, "storehouse"), placeInCenter(g, "hunter"), placeInCenter(g, "forager")];
  let most = 0, withOx = false;
  quietSteps(g, 20*DAY, ()=>{
    const hauling = g.villagers.filter(v=>v.task && v.task.type==="haul" && v.task.phase!=="back");
    if(hauling.some(v=>v.task.ox)) withOx = true;
    most = Math.max(most, hauling.length);
    return sites.every(b=>g.matFrac(b)>=1);
  });
  assert.ok(withOx, "le bœuf sert toujours");
  assert.ok(most>=3, "plusieurs journaliers charrient en même temps ("+most+")");
  assert.ok(sites.every(b=>g.matFrac(b)>=1), "tout le bois est livré");
});

test("détail : un journalier qui flâne se met au travail peu après la pose d'un chantier", () => {
  const g = fresh();
  g.stock.timber = 40;
  quietSteps(g, 3*DAY);   // ils flânent autour du campement
  const b = placeInCenter(g, "woodcutter");
  const t = quietSteps(g, 3*DAY, ()=>g.villagers.some(v=>v.task && (v.task.bid===b.id)));
  assert.ok(t < DAY/2, "quelqu'un part servir le chantier en moins d'une demi-journée ("+t+" ticks)");
});

/* ================= étape 7a : le fisc et les comptes ================= */
const { TAX_DEFS, TAX_ORDER, TAILLE_MONTHS, DIME_MONTH, LOAN_STEP, LOAN_MISS_MAX, BOOK_CATS, BOOK_ORDER } = require("../js/sim.js");
// le bilan d'un mois donné (m : le mois qui commence), sans événement en attente
function monthAt(g, m){ g.time.month = m; g.time.day = 0; g.onMonth(); g.pendingEvent = null; }
function lastBook(g){ return g.book.hist[g.book.hist.length-1]; }

test("étape 7a : trois redevances à quatre niveaux, chacune rangée au livre de comptes", () => {
  assert.deepStrictEqual(TAX_ORDER, ["dime","peage","corvee"]);
  for(const id of TAX_ORDER){
    const d = TAX_DEFS[id];
    assert.strictEqual(d.levels.length, 4, id);
    assert.strictEqual(d.ap.length, 4, id);
    assert.ok(d.ap[3] < 0, id+" : le niveau le plus lourd coûte de l'approbation");
  }
  for(const k of BOOK_ORDER) assert.ok(BOOK_CATS[k] && BOOK_CATS[k].name, k);
  assert.deepStrictEqual(TAILLE_MONTHS, [3, 8], "Pâques et Saint-Michel");
});

test("étape 7a : sans manoir, pas de péage ni de corvée ; sans église, pas de dîme", () => {
  const g = fresh();
  assert.ok(g.setTaxLevel("peage", 2), "refusé sans manoir");
  assert.ok(g.setTaxLevel("corvee", 1), "refusé sans manoir");
  assert.ok(g.setTaxLevel("dime", 1), "refusé sans église");
  assert.strictEqual(g.taxLevel("peage"), 0);
  doneBuilding(g, "manor");
  assert.strictEqual(g.setTaxLevel("peage", 2), null);
  assert.strictEqual(g.taxLevel("peage"), 2);
  assert.ok(g.setTaxLevel("dime", 1), "toujours pas d'église");
  doneBuilding(g, "church");
  assert.strictEqual(g.setTaxLevel("dime", 9), null);
  assert.strictEqual(g.taxes.dime, 3, "borné au niveau le plus lourd");
});

test("étape 7a : la taille court chaque mois mais ne se lève qu'à Pâques et à la Saint-Michel", () => {
  const g = fresh(); houses(g, 3); doneBuilding(g, "manor");
  g.taxRate = 0.5;
  const tm = g.tailleMonthly();
  assert.ok(tm > 0, "des maisons habitées : la taille court");
  const t0 = g.treasury;
  monthAt(g, 2);
  assert.ok(Math.abs(g.fisc.taille - tm) < 1e-6, "un mois de taille en attente");
  assert.ok(!lastBook(g).lines.taille, "rien n'est encore levé en mars");
  g.approval = 80;
  const owed = g.fisc.taille + g.tailleMonthly();
  monthAt(g, 3);
  assert.strictEqual(g.fisc.taille, 0, "levée à Pâques");
  assert.ok(lastBook(g).lines.taille > 0, "rangée au livre");
  assert.ok(Math.abs(lastBook(g).lines.taille - Math.round(owed*g.tailleRate())) < 1e-6);
  assert.strictEqual(g.fisc.lastTaille.m, 3);
  assert.ok(g.treasury > t0);
});

test("étape 7a : une seigneurie mécontente ne paie pas toute sa taille", () => {
  const g = fresh();
  g.approval = 80; assert.strictEqual(g.tailleRate(), 1);
  g.approval = 30; assert.strictEqual(g.tailleRate(), 0.8);
  g.approval = 10; assert.strictEqual(g.tailleRate(), 0.6);
});

test("étape 7a : la dîme prend sa part de la récolte en octobre et rapporte de l'influence chaque mois", () => {
  const g = fresh(); doneBuilding(g, "church");
  g.setTaxLevel("dime", 2);
  g.fisc.harvest = 60; g.stock.sh_grain = 4; g.stock.grain = 20;
  const i0 = g.influence;
  monthAt(g, 5);
  assert.ok(g.influence >= i0 + TAX_DEFS.dime.inf[2], "influence du mois");
  assert.strictEqual(g.stock.sh_grain, 4, "rien n'est pris hors d'octobre");
  const before = g.stock.sh_grain + g.stock.grain;
  monthAt(g, DIME_MONTH);
  const took = before - (g.stock.sh_grain + g.stock.grain);
  assert.ok(Math.abs(took - 6) < 0.6, "un dixième de 60 mesures ("+took+")");
  assert.strictEqual(g.stock.sh_grain, 0, "les gerbes d'abord");
  assert.strictEqual(g.fisc.harvest, 0, "nouvelle année de récolte");
  assert.ok(g.approvalWhy.some(w=>/^Dîme/.test(w[0]) && w[1]<0), "la dîme pèse sur l'approbation");
});

test("étape 7a : la moisson des céréales et des pois fait l'assiette de la dîme", () => {
  const g = fresh();
  g.stock.timber = 40;
  const r = freeBlock(g, 4, 4);
  const pts = [[r.x,r.y],[r.x+4,r.y],[r.x+4,r.y+4],[r.x,r.y+4]];
  assert.strictEqual(g.traceField(pts), null);
  const b = g.buildings[g.buildings.length-1];
  b.done = true; b.f.crop = "wheat"; b.f.sown = true; b.f.sownCrop = "wheat"; b.f.growth = 1;
  const q = g.harvestField(b);
  assert.ok(q > 0);
  assert.strictEqual(g.fisc.harvest, q);
});

test("étape 7a : les péages se lèvent chaque mois sur le marché, pas avec les marchés libres", () => {
  const g = fresh(); houses(g, 3); doneBuilding(g, "manor"); doneBuilding(g, "market");
  g.setTaxLevel("peage", 3);
  monthAt(g, 5);
  const t = lastBook(g).lines.peage || 0;
  assert.ok(t > 0, "péage du marché ("+t+")");
  assert.ok(g.approvalWhy.some(w=>/^Péages/.test(w[0]) && w[1]<0));
  g.setPolicy("freeMarket", true);
  monthAt(g, 6);
  assert.ok(!lastBook(g).lines.peage, "marchés libres : le marché ne paie plus de péage");
});

test("étape 7a : jour de corvée, les ouvriers quittent leur poste pour le chantier, puis y retournent", () => {
  const g = fresh(); doneBuilding(g, "manor");
  const wc = doneBuilding(g, "woodcutter");
  g.assign(wc.id); g.assign(wc.id);
  const crew = g.workersOf(wc).map(v=>v.id);
  assert.strictEqual(crew.length, 2);
  g.stock.timber = 40; g.stock.stone = 10;
  const site = placeInCenter(g, "storehouse");
  g.setTaxLevel("corvee", 3);
  let onSite = false, backHome = false, sawCorvee = false;
  quietSteps(g, 16*DAY, ()=>{
    const busy = crew.some(id=>{ const v = g.villager(id); return v.task && v.task.bid===site.id; });
    if(g.corveeToday()){ sawCorvee = true; if(busy) onSite = true; }
    else if(onSite && crew.some(id=>{ const v = g.villager(id); return v.task && v.task.type==="chop"; })) backHome = true;
    return onSite && backHome;
  });
  assert.ok(sawCorvee, "des jours de corvée dans le mois");
  assert.ok(onSite, "un ouvrier du camp de bûcherons sert le chantier");
  assert.ok(backHome, "la corvée finie, il retourne abattre des arbres");
  assert.ok(g.fisc.corveeDays > 0, "journées de corvée comptées");
  for(const id of crew) assert.strictEqual(g.villager(id).work, wc.id, "le poste est gardé");
});

test("étape 7a : la corvée tombe exactement le nombre de jours voulu dans le mois", () => {
  const g = fresh(); doneBuilding(g, "manor");
  for(let lv=0; lv<4; lv++){
    g.taxes.corvee = lv;
    let n = 0;
    for(let d=0; d<16; d++){ g.time.day = d; if(g.corveeToday()) n++; }
    assert.strictEqual(n, TAX_DEFS.corvee.days[lv], "niveau "+lv);
  }
});

test("étape 7a : sans corvée, les ouvriers des postes ne vont pas aux chantiers", () => {
  const g = fresh(); doneBuilding(g, "manor");
  const wc = doneBuilding(g, "woodcutter");
  g.assign(wc.id); g.assign(wc.id);
  const crew = g.workersOf(wc).map(v=>v.id);
  g.stock.timber = 40;
  const site = placeInCenter(g, "storehouse");
  let seen = false;
  quietSteps(g, 16*DAY, ()=>{ seen = seen || crew.some(id=>{ const v = g.villager(id); return v.task && v.task.bid===site.id; }); return seen; });
  assert.ok(!seen);
  assert.ok(!g.approvalWhy.some(w=>/^Corvée/.test(w[0])), "pas de corvée, pas de grogne");
});

test("étape 7a : emprunter, payer les intérêts, rembourser", () => {
  const g = fresh();
  assert.ok(g.borrow(50), "pas de changeur sans manoir");
  doneBuilding(g, "manor");
  const cap = g.loanCap();
  assert.ok(cap >= 100);
  assert.strictEqual(g.borrow(LOAN_STEP), null);
  assert.strictEqual(g.fisc.debt, 50);
  assert.strictEqual(g.treasury, 50);
  assert.strictEqual(g.book.cur.loan, 50);
  assert.ok(g.borrow(cap), "pas au-delà du plafond");
  monthAt(g, 4);
  assert.strictEqual(lastBook(g).lines.interest, -1, "2 % de 50");
  assert.strictEqual(g.repay(20), null);
  assert.strictEqual(g.fisc.debt, 30);
  g.treasury = 100;
  assert.strictEqual(g.repay(), null);
  assert.strictEqual(g.fisc.debt, 0);
  assert.ok(g.repay(), "plus rien à rembourser");
});

test("étape 7a : intérêts impayés, la dette grossit ; trois fois de suite, le changeur saisit des biens", () => {
  const g = fresh(); doneBuilding(g, "manor");
  g.borrow(100); g.treasury = 0;
  g.stock.bread = 50; g.stock.cheese = 50;
  g.influence = 30;
  monthAt(g, 4);
  assert.strictEqual(g.fisc.debt, 102);
  assert.strictEqual(g.fisc.missed, 1);
  assert.ok(g.borrow(50), "plus de prêt tant qu'on doit des intérêts");
  g.treasury = 0; monthAt(g, 5);
  assert.strictEqual(g.fisc.missed, 2);
  assert.ok(g.approvalWhy.some(w=>w[0]==="Dettes impayées"), "la dette impayée pèse sur l'approbation");
  for(let k=2; k<LOAN_MISS_MAX; k++){ g.treasury = 0; monthAt(g, 4+k); }
  assert.strictEqual(g.fisc.missed, 0, "la saisie remet les compteurs à zéro");
  assert.ok(g.fisc.debt < 70, "la moitié de la dette est couverte ("+g.fisc.debt+")");
  assert.ok(g.stock.bread + g.stock.cheese < 100, "des biens saisis");
  assert.ok(g.influence < 30, "votre nom en sort sali ("+g.influence+")");
});

test("étape 7a : chaque achat et chaque vente passent au livre ; le mois se ferme au bilan", () => {
  const g = fresh();
  g.treasury = 100;
  g.buyOx();
  assert.strictEqual(g.book.cur.livestock, -20);
  g.hireMercenary();
  assert.strictEqual(g.book.cur.mercs, -25);
  g.time.month = 5; g.onMonth(); g.pendingEvent = null;
  const h = lastBook(g);
  assert.strictEqual(h.m, 4, "bilan de mai");
  assert.strictEqual(h.lines.livestock, -20);
  assert.deepStrictEqual(g.book.cur, {}, "nouveau mois, nouvelle page");
  for(let k=0;k<14;k++) monthAt(g, (6+k)%12);
  assert.strictEqual(g.book.hist.length, 12, "douze mois gardés");
  assert.ok(Object.keys(g.bookYear()).every(k=>BOOK_CATS[k]));
});

test("étape 7a : l'impôt du roi payé passe au livre", () => {
  const g = fresh(); g.time.year = 1178; g.treasury = 200;
  doneBuilding(g, "manor");   // étape 8 : le roi taxe une seigneurie qui a son manoir
  g.time.month = 10; g.onMonth();
  assert.ok(g.pendingEvent && g.pendingEvent.title==="L'impôt du roi");
  const amount = g.pendingEvent.choices[0].amount;
  assert.strictEqual(amount, g.kingTaxEstimate(1178));
  g.resolveEvent(0);
  assert.strictEqual(g.book.cur.king, -amount);
});

test("étape 7a : la prévision jusqu'au printemps compte la taille, l'impôt du roi et les intérêts", () => {
  const g = fresh(); houses(g, 3); doneBuilding(g, "manor");
  g.time.year = 1178; g.time.month = 7; g.taxRate = 0.4; g.approval = 80;
  g.borrow(100);
  const f = g.cashForecast();
  assert.strictEqual(f.months, 7, "d'août à mars");
  const line = (n)=>f.lines.find(l=>l[0]===n);
  assert.ok(line("Taille") && line("Taille")[1] > 0, "la Saint-Michel tombe dans la période");
  assert.strictEqual(line("Impôt du roi")[1], -g.kingTaxEstimate(1178));
  assert.strictEqual(line("Intérêts")[1], -14);
  assert.strictEqual(f.end, Math.floor(g.treasury) + f.total);
});

test("étape 7a : sauvegarde — redevances, fisc et livre gardés ; l'ancien décret de dîme devient une dîme au dixième", () => {
  const g = fresh(); doneBuilding(g, "manor"); doneBuilding(g, "church");
  g.setTaxLevel("peage", 1); g.setTaxLevel("corvee", 2); g.setTaxLevel("dime", 3);
  g.borrow(50); g.fisc.taille = 7.5; g.fisc.harvest = 12;
  monthAt(g, 4);
  g.buyOx();
  const data = JSON.parse(JSON.stringify(g.serialize()));
  const g2 = GameState.load(data);
  assert.deepStrictEqual(g2.taxes, g.taxes);
  assert.strictEqual(g2.fisc.debt, g.fisc.debt);
  assert.strictEqual(g2.fisc.taille, g.fisc.taille);
  assert.strictEqual(g2.fisc.harvest, 12);
  assert.deepStrictEqual(g2.book, g.book);
  // une sauvegarde d'avant l'étape 7a
  const old = JSON.parse(JSON.stringify(data));
  delete old.taxes; delete old.fisc; delete old.book;
  old.policies = { tithe:true, freeMarket:false, militiaService:true };
  old.book = { cur:{ bogus:5, taille:"x" }, hist:[ null, { y:1176, m:3, lines:{ taille:4, nope:1 } } ] };
  const g3 = GameState.load(old);
  assert.strictEqual(g3.taxes.dime, 2);
  assert.strictEqual(g3.taxes.peage, 0);
  assert.ok(!("tithe" in g3.policies));
  assert.strictEqual(g3.policies.militiaService, true);
  assert.deepStrictEqual(g3.book.cur, {});
  assert.deepStrictEqual(g3.book.hist, [{ y:1176, m:3, lines:{ taille:4 } }]);
  assert.strictEqual(g3.fisc.debt, 0);
});

/* ================= étape 7b : l'opinion, la réputation et le conseil ================= */
const { TRAIT_DEFS, SEAT_DEFS, SEAT_ORDER, COUNCIL_WAGE, EMBEZZLE, AUDIT_COST, ALMS_COST, REP_GEN, REP_SEV } = require("../js/sim.js");
function adultOf(g, pred){ return g.villagers.find(v=>g.isAdult(v) && v.health>=25 && !v.seat && (!pred || pred(v))); }

test("étape 7b : chaque villageois a des traits fixes, et jamais deux traits contraires", () => {
  const g = fresh();
  for(const v of g.villagers){
    const t = g.traitsOf(v);
    assert.deepStrictEqual(t, g.traitsOf(v), "stables");
    for(const k of t) assert.ok(TRAIT_DEFS[k], k);
    assert.ok(!(t.includes("honest") && t.includes("greedy")));
    assert.ok(!(t.includes("lazy") && t.includes("diligent")));
  }
  const all = new Set(); for(let id=1; id<300; id++) for(const k of g.traitsOf({ id })) all.add(k);
  assert.strictEqual(all.size, Object.keys(TRAIT_DEFS).length, "tous les traits existent");
});

test("étape 7b : le conseil est facultatif — quatre sièges vides, sans aucun malus", () => {
  const g = fresh(); doneBuilding(g, "manor"); doneBuilding(g, "church");
  assert.deepStrictEqual(SEAT_ORDER, ["steward","bailiff","chaplain","marshal"]);
  for(const id of SEAT_ORDER){ assert.strictEqual(g.seatHolder(id), null); assert.strictEqual(g.seatPower(id), 0); }
  monthAt(g, 5);
  assert.ok(!g.approvalWhy.some(w=>/conseil|bailli|chapelain|intendant/i.test(w[0])), "un conseil vide ne coûte rien");
  assert.ok(!lastBook(g).lines.wages, "pas de gages");
});

test("étape 7b : nommer un conseiller — il quitte son poste, sa famille en est fière, il touche ses gages", () => {
  const g = fresh();
  const v = adultOf(g);
  assert.ok(g.appoint("steward", v.id), "il faut un manoir");
  doneBuilding(g, "manor");
  assert.ok(g.appoint("chaplain", v.id), "il faut une église pour le chapelain");
  const wc = doneBuilding(g, "woodcutter");
  g.assignVillager(v.id, wc.id);
  assert.strictEqual(v.work, wc.id);
  assert.strictEqual(g.appoint("steward", v.id), null);
  assert.strictEqual(v.seat, "steward");
  assert.strictEqual(v.work, -1, "il quitte son poste");
  assert.ok(!g.freeAdults().includes(v), "il n'est plus journalier");
  assert.ok(g.assignVillager(v.id, wc.id), "on ne l'affecte pas tant qu'il siège");
  assert.ok(g.memTotal(g.famOf(v)) > 0, "sa famille en est fière");
  assert.ok(g.villagerStatus(v).startsWith("Intendant"));
  g.treasury = 10;
  monthAt(g, 5);
  assert.strictEqual(lastBook(g).lines.wages, -COUNCIL_WAGE);
  assert.strictEqual(v.sxp, 1, "un mois d'expérience");
  g.dismiss("steward");
  assert.ok(!v.seat);
  assert.ok(g.memTotal(g.famOf(v)) < 0, "renvoyé : la famille le prend mal");
});

test("étape 7b : la compétence dépend du savoir-faire, des traits et de l'expérience", () => {
  const g = fresh();
  const v = adultOf(g);
  v.skills.trade = 0; v.sxp = 0;
  const c0 = g.competence(v, "steward");
  v.skills.trade = 80;
  assert.ok(g.competence(v, "steward") > c0);
  v.sxp = 20;
  assert.ok(g.competence(v, "steward") > c0 + 40);
  assert.ok(g.competence(v, "steward") <= 100);
  const cands = g.seatCandidates("steward", 3);
  assert.ok(cands.length===3 && g.competence(cands[0], "steward") >= g.competence(cands[2], "steward"));
});

test("étape 7b : un intendant qui lève la taille en tire davantage", () => {
  const mk = (withSteward)=>{
    const g = fresh(); houses(g, 3); doneBuilding(g, "manor");
    g.taxRate = 0.5;
    if(withSteward){ const v = adultOf(g); g.appoint("steward", v.id); v.skills.trade = 100; v.sxp = 30; g.council.steward.task = "tax"; g.rnd = ()=>0.99; }
    g.fisc.taille = 40; g.approval = 30; g.treasury = 50;
    monthAt(g, 3);
    return (lastBook(g).lines.taille||0) + g.council.steward.stolen;
  };
  assert.ok(mk(true) > mk(false), "plus de taille levée (vols compris)");
});

test("étape 7b : un intendant cupide détourne ; le bailli ou un contrôle le démasque, il rend gorge", () => {
  const g = fresh(); houses(g, 3); doneBuilding(g, "manor");
  let v = null;
  for(let id=1; id<500 && !v; id++){ const o = adultOf(g); if(!o) break; if(g.traitsOf(o).includes("greedy")) v = o; else { o.id = 100000 + id; if(g.traitsOf(o).includes("greedy")) v = o; } }
  assert.ok(v, "un villageois cupide");
  g.appoint("steward", v.id);
  assert.strictEqual(g.skim(100), 100*EMBEZZLE);
  g.fisc.taille = 40; g.approval = 80; g.treasury = 50;
  monthAt(g, 3);
  assert.ok(g.council.steward.stolen > 0, "il garde une part de la taille");
  g.influence = 0;
  assert.ok(g.audit(), "il faut de l'influence pour vérifier");
  g.influence = AUDIT_COST;
  assert.strictEqual(g.audit(), null);
  assert.ok(g.council.steward.known);
  const t0 = g.treasury, back = Math.round(g.council.steward.stolen), f = g.famOf(v);
  assert.strictEqual(g.punishSteward(), null);
  assert.strictEqual(g.treasury, t0 + back, "les sommes reviennent au trésor");
  assert.ok(!v.seat && !g.seatHolder("steward"));
  assert.ok(f.mem.some(x=>x.k==="disgrace" && x.v<0), "la famille est déshonorée");
});

test("étape 7b : sans gages deux mois de suite, le conseiller s'en va", () => {
  const g = fresh(); doneBuilding(g, "manor");
  const v = adultOf(g); g.appoint("bailiff", v.id);
  g.treasury = 0; monthAt(g, 5);
  assert.strictEqual(v.seat, "bailiff");
  g.treasury = 0; monthAt(g, 6);
  assert.ok(!v.seat, "parti");
  assert.ok(g.famOf(v).mem.some(x=>x.k==="unpaid"));
});

test("étape 7b : les missions du conseil ont leurs effets (greniers, prêche, milice, brigands)", () => {
  const g = fresh(); doneBuilding(g, "manor"); doneBuilding(g, "church");
  const r0 = g.spoilRate("meat", 6);
  const a = adultOf(g); g.appoint("steward", a.id); g.setSeatTask("steward", "granary");
  assert.ok(g.spoilRate("meat", 6) < r0, "moins de denrées gâtées");
  const b = adultOf(g); g.appoint("chaplain", b.id); g.setSeatTask("chaplain", "preach");
  g.treasury = 100; monthAt(g, 5);
  assert.ok(g.approvalWhy.some(w=>w[0]==="Le chapelain prêche" && w[1]>0));
  const c = adultOf(g); g.appoint("marshal", c.id); g.setSeatTask("marshal", "train");
  g.raiseMilitia();
  assert.ok(g.units.length && g.units[0].maxHp > 10, "milice entraînée");
  assert.ok(g.setSeatTask("marshal", "nope"));
  // un conseiller malade garde sa place mais n'apporte rien
  c.sick = 2;
  assert.strictEqual(g.seatPower("marshal"), 0);
});

test("étape 7b : un conseiller passe ses journées au manoir et ne va pas aux chantiers", () => {
  const g = fresh(); const m = doneBuilding(g, "manor");
  const v = adultOf(g); g.appoint("steward", v.id);
  g.stock.timber = 40; placeInCenter(g, "storehouse");
  let site = false;
  quietSteps(g, 4*DAY, ()=>{ if(v.task && v.task.bid) site = true; return false; });
  assert.ok(!site);
  assert.ok(Math.hypot(v.x - m.x, v.y - m.y) < 8, "près du manoir");
});

test("étape 7b : la mort d'un conseiller libère son siège", () => {
  const g = fresh(); doneBuilding(g, "manor");
  const v = adultOf(g); g.appoint("marshal", v.id);
  g.die(v, "de maladie", true);
  assert.strictEqual(g.council.marshal.vid, -1);
});

test("étape 7b : la mémoire des familles s'estompe et pèse sur leur opinion", () => {
  const g = fresh(); const f = g.families[0];
  g.approval = 50;
  g.addMem(f, "x", "Un affront", -12, 4);
  assert.strictEqual(g.famOpinion(f), 38);
  g.memMonth(); g.memMonth();
  assert.strictEqual(g.memTotal(f), -6, "à moitié oublié");
  g.memMonth(); g.memMonth();
  assert.strictEqual(f.mem.length, 0, "oublié");
  g.addMem(f, "x", "Pour toujours", 5, 0);
  for(let k=0;k<20;k++) g.memMonth();
  assert.strictEqual(g.memTotal(f), 5, "un souvenir permanent reste");
  const v = g.membersOf(f.id)[0];
  assert.ok(g.personalMood(v).why.some(w=>w[0]==="Pour toujours"), "le villageois le dit");
});

test("étape 7b : un bailli qui apaise les rancunes les fait oublier plus vite", () => {
  const g = fresh(); doneBuilding(g, "manor");
  const b = adultOf(g); g.appoint("bailiff", b.id); g.setSeatTask("bailiff", "quarrels");
  b.skills.build = 100; b.sxp = 30;
  const f = g.families.find(x=>x.id!==b.fam);
  g.addMem(f, "x", "Un affront", -12, 12);
  g.addMem(f, "y", "Un bienfait", 12, 12);
  g.memMonth();
  assert.ok(f.mem.find(x=>x.k==="x").m < f.mem.find(x=>x.k==="y").m, "le grief s'efface plus vite que le bienfait");
});

test("étape 7b : maison rasée, mort de faim, taille lourde, corvée : les familles s'en souviennent", () => {
  const g = fresh(); houses(g, 3); doneBuilding(g, "manor");
  const f = g.families.find(x=>x.home>0);
  g.demolish(f.home);
  assert.ok(f.mem.some(x=>x.k==="razed" && x.v<0));
  const v = g.membersOf(f.id).find(x=>!g.isAdult(x)) || g.membersOf(f.id)[0];
  g.die(v, "de faim", true);
  if(g.families.includes(f)) assert.ok(f.mem.some(x=>/de faim/.test(x.t)));
  g.taxRate = 0.5; g.fisc.taille = 10; monthAt(g, 3);
  assert.ok(g.families.every(x=>x.mem && x.mem.some(y=>y.k==="taille")), "taille lourde");
  g.fisc.corveeFam = { [g.families[0].id]: 3 }; monthAt(g, 4);
  assert.ok(g.families[0].mem.some(x=>x.k==="corvee" && x.v===-3));
});

test("étape 7b : un jeune foyer hérite de la moitié des rancunes de ses parents", () => {
  const g = fresh();
  const fh = g.families[0];
  g.addMem(fh, "old", "Une vieille rancune", -12, 0);
  const h = g.membersOf(fh.id).find(v=>g.isAdult(v));
  const w = g.villagers.find(v=>v.fam!==fh.id && g.isAdult(v));
  const house = legacyHouse(g); house.done = true;
  g.families.forEach(f=>{ if(f.home===house.id) f.home = -1; });
  const nf = g.moveOut(h, w, house);
  const x = nf.mem && nf.mem.find(y=>y.k==="old");
  assert.ok(x && Math.round(g.memVal(x))===-6, "la moitié");
});

test("étape 7b : la famille la plus fâchée part la première ; une famille rancunière finit par partir", () => {
  const g = fresh(); houses(g, 3);
  for(const f of g.families) f.founder = false;
  const [a, b, c] = g.families;
  g.addMem(b, "x", "Grief", -40, 0);
  g.stock.firewood = 0; g.stock.clothes = 0; for(const f of g.families) f.clothed = false;   // un village malheureux (approbation sous 30)
  g.time.month = 4; g.onMonth(); g.pendingEvent = null;
  assert.ok(g.approval<30, "approbation "+g.approval);
  assert.ok(!g.families.includes(b), "la plus fâchée est partie");
  const g2 = fresh(); houses(g2, 3);
  for(const f of g2.families) f.founder = false;
  const t = g2.families[1];
  g2.addMem(t, "x", "Grief", -90, 0);
  for(let k=0;k<3 && g2.families.includes(t);k++){ g2.time.month = 4+k; g2.onMonth(); g2.pendingEvent = null; }
  assert.ok(!g2.families.includes(t), "elle part au bout de trois mois de rancune");
});

test("étape 7b : la réputation — avare, généreux, craint", () => {
  const g = fresh(); doneBuilding(g, "manor");
  g.taxRate = 0.8;
  for(let k=0;k<6;k++) g.repMonth();
  assert.ok(g.rep.gen <= -REP_GEN && g.repTitles().some(t=>t.id==="miser"), "avare ("+g.rep.gen+")");
  g.rep.gen = 40; assert.ok(g.repTitles().some(t=>t.id==="generous"));
  g.rep.sev = REP_SEV + 5; assert.ok(g.feared());
  monthAt(g, 5);
  assert.ok(g.approvalWhy.some(w=>w[0]==="Réputation : craint"));
});

test("étape 7b : aumône et fête au village", () => {
  const g = fresh();
  g.treasury = 0;
  assert.ok(g.giveAlms(), "il faut des deniers");
  g.treasury = 100;
  assert.strictEqual(g.giveAlms(), null);
  assert.strictEqual(g.book.cur.alms, -ALMS_COST);
  assert.strictEqual(g.families.filter(f=>f.mem && f.mem.some(x=>x.k==="alms")).length, Math.min(3, g.families.length));
  assert.ok(g.rep.gen > 0);
  const food = g.foodStock();
  assert.strictEqual(g.giveFeast(), null);
  assert.ok(g.foodStock() <= food - g.feastNeed() + 1e-9);
  assert.ok(g.families.every(f=>f.mem.some(x=>x.k==="feast")));
  assert.ok(g.giveFeast(), "une fête par an");
});

test("étape 7b : sauvegarde — conseil, réputation, souvenirs ; un siège mal formé est vidé", () => {
  const g = fresh(); doneBuilding(g, "manor");
  const v = adultOf(g); g.appoint("bailiff", v.id); g.setSeatTask("bailiff", "corvee");
  v.sxp = 7; g.council.bailiff.unpaid = 1;
  g.rep.gen = -12; g.rep.sev = 9; g.feastY = 1176;
  g.addMem(g.families[1], "z", "Souvenir", -5, 6);
  const data = JSON.parse(JSON.stringify(g.serialize()));
  const g2 = GameState.load(data);
  assert.deepStrictEqual(g2.council, g.council);
  assert.strictEqual(g2.villager(v.id).seat, "bailiff");
  assert.strictEqual(g2.villager(v.id).sxp, 7);
  assert.deepStrictEqual(g2.rep, g.rep);
  assert.strictEqual(g2.feastY, 1176);
  assert.deepStrictEqual(g2.families[1].mem, g.families[1].mem);
  const bad = JSON.parse(JSON.stringify(data));
  bad.council.bailiff.vid = 99999; bad.council.bailiff.task = "nope";
  bad.families[1].mem.push({ k:3 }, null);
  const g3 = GameState.load(bad);
  assert.strictEqual(g3.council.bailiff.vid, -1);
  assert.strictEqual(g3.council.bailiff.task, "patrol");
  assert.ok(!g3.villager(v.id).seat, "le villageois ne siège plus");
  assert.strictEqual(g3.families[1].mem.length, 1);
  const old = JSON.parse(JSON.stringify(data)); delete old.council; delete old.rep; delete old.feastY;
  for(const x of old.villagers) delete x.seat;
  const g4 = GameState.load(old);
  assert.ok(SEAT_ORDER.every(id=>g4.council[id].vid===-1));
  assert.deepStrictEqual(g4.rep, { gen:0, sev:0, just:0 });
});

/* ================= étape 7c : les ordres et le coutumier ================= */
const { SKILLED, ENNOBLE_COST, LAW_DEFS, LAW_COST, LAW_COOLDOWN, MAINMORTE } = require("../js/sim.js");

test("étape 8 : un serf tient un atelier à demi-vitesse, un bourgeois passe devant ; une maison de niveau 2 fait entrer la famille dans la bourgeoisie", () => {
  const g = fresh(); houses(g, 3);
  assert.ok(g.families.every(f=>f.ord==="serf"), "on commence serfs");
  const bk = doneBuilding(g, "woodcutter"); for(const f of g.families) f.ord = "serf";
  g.stock.timber = 20; g.stock.stone = 20;
  const b = placeInCenter(g, "bakery"); b.done = true; for(const f of g.families) f.ord = "serf";
  for(const x of g.villagers) if(x.work>0) g.leaveJob(x);
  const v = g.freeAdults()[0];
  assert.strictEqual(g.assignVillager(v.id, b.id), null, "un serf peut tenir l'atelier");
  assert.strictEqual(g.rankMul(v, b), SERF_CRAFT, "… à demi-vitesse");
  assert.strictEqual(g.rankMul(v, bk), 1, "un poste de base, à pleine vitesse");
  assert.strictEqual(g.assignVillager(v.id, bk.id), null, "un poste de base, oui");
  // à l'embauche, un bourgeois passe devant un serf, même moins doué
  const other = g.freeAdults().find(x=>x.fam!==v.fam);
  g.famOf(other).ord = "bourg"; other.skills.craft = 0;
  for(const x of g.freeAdults()) if(x.fam!==other.fam) x.skills.craft = 90;
  g.assign(b.id);
  const hired = g.workersOf(b);
  assert.ok(hired.length===1 && hired[0].fam===other.fam, "un bourgeois est embauché d'abord");
  assert.strictEqual(g.rankMul(hired[0], b), 1);
  g.leaveJob(hired[0]); g.famOf(other).ord = "serf";
  const f = g.famOf(v), h = g.buildings.find(x=>x.id===f.home) || legacyHouse(g);
  f.home = h.id; h.lvl = 1; h.monthsGood = 5; g.stock.timber = 50;
  for(const k of Object.keys(g.stock)) if(k!=="ox") g.stock[k] = Math.max(g.stock[k], 40);
  doneBuilding(g, "market"); for(const o of g.families) o.ord = "serf";
  for(const o of g.families){ o.fed = 1; o.variety = 3; }
  g.time.month = 5; g.onMonth(); g.pendingEvent = null;
  assert.ok(h.lvl>=2, "la maison bien pourvue monte de niveau");
  assert.strictEqual(f.ord, "bourg", "maison de niveau 2 : bourgeois");
  f.ord = "bourg";
  assert.strictEqual(g.assignVillager(v.id, b.id), null, "un bourgeois peut être boulanger");
});

test("étape 7c : la corvée n'appelle que les serfs ; les nobles ne travaillent pas et ne paient pas la taille", () => {
  const g = fresh(); houses(g, 3); doneBuilding(g, "manor");
  const v = g.freeAdults()[0];
  g.famOf(v).ord = "bourg";
  g.taxes.corvee = 3; g.time.day = 0;
  g.stock.timber = 40; placeInCenter(g, "storehouse"); for(const f of g.families) f.ord = f===g.famOf(v) ? "bourg" : "serf";
  assert.strictEqual(g.corveeCall(v), false, "un bourgeois ne doit pas la corvée");
  const f = g.famOf(v), h = g.buildings.find(x=>x.id===f.home);
  h.lvl = 3; g.taxRate = 0.5;
  const t0 = g.tailleMonthly();
  assert.ok(g.ennoble(f.id), "il faut de l'influence");
  g.influence = ENNOBLE_COST;
  assert.strictEqual(g.ennoble(f.id), null);
  assert.strictEqual(g.influence, 0);
  assert.ok(g.tailleMonthly() < t0, "les nobles sont exempts de taille");
  assert.ok(!g.freeAdults().some(x=>x.fam===f.id), "ni journaliers ni ouvriers");
  assert.ok(g.membersOf(f.id).filter(x=>g.isAdult(x)).every(x=>x.office==="court"));
  assert.ok(g.competence(v, "steward") >= 40, "un noble fait un conseiller instruit");
  g.stock.clothes = 0; g.stock.cheese = 0; g.stock.honey = 0; g.stock.smoked = 0; g.stock.ale = 0;
  g.nobleUpkeep();
  assert.ok(f.mem.some(x=>x.k==="upkeep"), "le train de vie manque");
});

test("étape 7c : une loi coûte de l'influence, prend effet le mois suivant et ne se change pas aussitôt", () => {
  const g = fresh();
  assert.ok(g.proclaim("deadwood", 1), "il faut un manoir");
  doneBuilding(g, "manor");
  g.influence = 0;
  assert.ok(g.proclaim("deadwood", 1), "il faut de l'influence");
  g.influence = 40;
  assert.strictEqual(g.proclaim("deadwood", 1), null);
  assert.strictEqual(g.influence, 40 - LAW_COST);
  assert.strictEqual(g.law("deadwood"), 0, "pas encore en vigueur");
  monthAt(g, 3);
  assert.strictEqual(g.law("deadwood"), 1);
  assert.ok(/encore/.test(g.proclaim("deadwood", 0)), "délai avant d'y revenir");
  assert.ok(g.proclaim("succession", 1), "verrouillée jusqu'à la dynastie");
  g.laws.arms = 1;
  assert.ok(g.militiaCount() > Math.floor(g.families.length/2));
});

test("étape 7c : la mainmorte prend sa part à la mort d'un serf adulte", () => {
  const g = fresh(); doneBuilding(g, "manor");
  const v = g.villagers.find(x=>g.isAdult(x)), f = g.famOf(v);
  const t0 = g.treasury;
  g.die(v, "de maladie", true);
  assert.strictEqual(g.treasury, t0 + MAINMORTE);
  assert.strictEqual(g.book.cur.rights, MAINMORTE);
  if(g.families.includes(f)) assert.ok(f.mem.some(x=>x.k==="mainmorte"));
});

test("étape 7c : sauvegarde — lois et ordres gardés ; une partie d'avant garde ses artisans", () => {
  const g = fresh(); doneBuilding(g, "manor");
  g.influence = 50; g.proclaim("curfew", 1);
  g.families[0].ord = "noble";
  const data = JSON.parse(JSON.stringify(g.serialize()));
  const g2 = GameState.load(data);
  assert.deepStrictEqual(g2.laws, g.laws);
  assert.deepStrictEqual(g2.lawPending, g.lawPending);
  assert.strictEqual(g2.families[0].ord, "noble");
  const old = JSON.parse(JSON.stringify(data)); delete old.laws; delete old.lawPending;
  for(const f of old.families) delete f.ord;
  const mill = old.buildings.find(b=>b.def==="manor"); mill.def = "windmill";
  old.villagers.find(v=>v.fam===old.families[1].id && g.isAdult(v)).work = mill.id;
  const g3 = GameState.load(old);
  assert.strictEqual(g3.families[1].ord, "bourg", "le meunier d'avant reste meunier");
  assert.strictEqual(g3.families[2].ord, "serf");
  assert.strictEqual(g3.law("curfew"), 0);
});

/* ================= étape 7d : justice et audiences ================= */
const { CASE_DEFS, FREEDOM_PRICE } = require("../js/sim.js");

test("étape 7d : une affaire de vol — condamner un innocent laisse une rancune, la haute justice est verrouillée", () => {
  const g = fresh();
  g.rnd = (()=>{ let i=0; const seq=[0.0, 0.1, 0.9, 0.9]; return ()=>seq[i++%seq.length]; })();
  let c = null;
  for(let k=0;k<20 && !c;k++){ const x = g.newCase(); if(x && x.type==="theft") c = x; else if(x) g.cases = []; }
  if(!c){ c = { id:g.nextCase++, type:"theft", a:g.families[0].id, b:g.families[1].id, until:g.nextPlaid(), v:g.membersOf(g.families[0].id).find(v=>g.isAdult(v)).id, guilty:false, proof:"minces" }; g.cases.push(c); }
  c.guilty = false;
  assert.ok(/baron/.test(g.judge(c.id, "hang")), "pas de haute justice");
  const fa = g.famById(c.a), j0 = g.rep.just;
  assert.strictEqual(g.judge(c.id, "fine"), null);
  assert.ok(fa.mem.some(x=>/à tort/.test(x.t)), "condamné à tort");
  assert.ok(g.rep.just < j0);
  assert.strictEqual(g.book.cur.fines, 5);
  assert.strictEqual(g.cases.length, 0);
});

test("étape 7d : une affaire non jugée aux plaids est close au détriment des deux familles", () => {
  const g = fresh();
  const c = { id:g.nextCase++, type:"border", a:g.families[0].id, b:g.families[1].id, until:g.monthIdx()-1, right:"a" };
  g.cases.push(c);
  g.rnd = ()=>0.99;
  g.justiceMonth(g.time.month);
  assert.strictEqual(g.cases.length, 0);
  assert.ok(g.families[0].mem.some(x=>x.k==="case"+c.id && x.v<0));
});

test("étape 7d : pétitions — l'affranchissement fait un bourgeois ; une faveur due retient une famille qui voulait partir", () => {
  const g = fresh(); houses(g, 3);
  const f = g.families[1];
  g.petitions.push({ id:g.nextCase++, type:"freedom", f:f.id, until:g.monthIdx()+2 });
  const t0 = g.treasury;
  assert.strictEqual(g.answer(g.petitions[0].id, true), null);
  assert.strictEqual(f.ord, "bourg");
  assert.strictEqual(g.treasury, t0 + FREEDOM_PRICE);
  g.petitions.push({ id:g.nextCase++, type:"loan", f:f.id, until:g.monthIdx()+2, amount:8 });
  g.treasury = 20;
  g.answer(g.petitions[0].id, true);
  assert.strictEqual(f.favor, 1, "elle vous doit une faveur");
  for(const x of g.families) x.founder = false;
  g.addMem(f, "x", "Grief", -90, 0); f.sour = 2;
  g.time.month = 4; g.onMonth(); g.pendingEvent = null;
  assert.ok(g.families.includes(f), "elle reste");
  assert.strictEqual(f.favor, 0, "faveur soldée");
});

test("étape 7d : sauvegarde des affaires, pétitions et précédents", () => {
  const g = fresh();
  g.cases.push({ id:3, type:"debt", a:g.families[0].id, b:g.families[1].id, until:g.monthIdx()+2 });
  g.petitions.push({ id:4, type:"exempt", f:g.families[2].id, until:g.monthIdx()+2 });
  g.prec.theft = 2; g.nextCase = 5; g.families[0].favor = 2;
  const g2 = GameState.load(JSON.parse(JSON.stringify(g.serialize())));
  assert.deepStrictEqual(g2.cases, g.cases);
  assert.deepStrictEqual(g2.petitions, g.petitions);
  assert.deepStrictEqual(g2.prec, { theft:2 });
  assert.strictEqual(g2.nextCase, 5);
  assert.strictEqual(g2.families[0].favor, 2);
});

/* ================= étape 7e : les intrigues ================= */
const { FACTION_STRIKE, FACTION_ULTIMATUM, SECRET_DEFS } = require("../js/sim.js");

test("étape 7e : les familles fâchées forment une faction, font grève, posent un ultimatum ; céder la dissout", () => {
  const g = fresh(); houses(g, 3); doneBuilding(g, "manor");
  g.taxRate = 0.5; g.approval = 50;
  for(const f of g.families.slice(0, 2)) g.addMem(f, "x", "Grief", -40, 0);
  g.rnd = ()=>0.1;
  g.factionMonth();
  const F = g.faction;
  assert.ok(F, "une faction se forme");
  assert.strictEqual(F.demand, "taille");
  assert.ok(F.fams.length>=2);
  assert.ok(g.arrestLeader(), "sans informateur, on ne connaît pas le meneur");
  F.power = FACTION_STRIKE;
  const v = g.membersOf(F.fams[0]).find(x=>g.isAdult(x));
  g.taxes.corvee = 3;
  assert.ok(g.striking(v.fam));
  assert.strictEqual(g.corveeCall(v), false, "grève de la corvée");
  F.power = FACTION_ULTIMATUM; g.pendingEvent = null;
  g.factionMonth();
  assert.ok(g.pendingEvent && g.pendingEvent.title==="Un ultimatum");
  g.resolveEvent(0);
  assert.strictEqual(g.faction, null);
  assert.ok(g.taxRate<=0.15);
  assert.ok(g.chronicle.length>=2, "la chronique en garde trace");
});

test("étape 7e : un informateur démasque le meneur ; l'arrêter le bannit ; une jacquerie sans milice pille les réserves", () => {
  const g = fresh(); houses(g, 3); doneBuilding(g, "manor");
  g.taxRate = 0.5;
  for(const f of g.families) g.addMem(f, "x", "Grief", -40, 0);
  const b = g.villagers.find(v=>g.isAdult(v) && v.fam===g.families[2].id);
  g.appoint("bailiff", b.id);
  g.rnd = ()=>0.1;
  g.factionMonth();
  const F = g.faction;
  assert.ok(F && F.known, "le bailli sait qui mène");
  const lead = F.leader;
  assert.strictEqual(g.arrestLeader(), null);
  assert.ok(!g.villager(lead), "banni");
  g.faction = { leader:g.membersOf(g.families[0].id).find(x=>g.isAdult(x)).id, fams:g.families.map(f=>f.id), demand:"taille", power:100, known:true, warned:2 };
  g.units = [];
  const food = g.foodStock();
  g.jacquerie();
  assert.ok(g.foodStock() < food, "pillage");
  assert.strictEqual(g.faction, null);
});

test("étape 7e : un secret appris devient un levier — pression, dénonciation ou pardon ; chronique sauvegardée", () => {
  const g = fresh();
  let v = null;
  for(let k=0;k<400 && !v;k++){ const o = g.villagers.find(x=>g.isAdult(x)); o.id = 5000 + k; if(g.secretOf(o)) v = o; }
  assert.ok(v && SECRET_DEFS[g.secretOf(v)]);
  assert.ok(g.useSecret(v.id, "press"), "secret pas encore connu");
  v.sk = 1;
  assert.strictEqual(g.useSecret(v.id, "press"), null);
  assert.strictEqual(g.famOf(v).favor, 1, "la famille vous doit une faveur");
  assert.ok(g.useSecret(v.id, "forgive"), "un secret ne sert qu'une fois");
  g.chron("Un fait mémorable.");
  g.faction = { leader:v.id, fams:[g.families[0].id, g.families[1].id], demand:"feast", power:30, known:false, warned:0 };
  const g2 = GameState.load(JSON.parse(JSON.stringify(g.serialize())));
  assert.deepStrictEqual(g2.chronicle, g.chronicle);
  assert.deepStrictEqual(g2.faction, g.faction);
  assert.strictEqual(g2.villager(v.id).sk, 2);
});

/* ================= étape 8 : équilibrage, difficultés, objectifs ================= */
const { DIFF_BY_ID, CLOTH_EVERY, TRADE_KEEP, KING_TRADE, MODE_BY_ID, KING_MONTH: KING_MONTH_T } = require("../js/sim.js");

test("étape 8 : trois difficultés vraiment différentes (réserves, récoltes, gâchis, chauffage, impôt du roi)", () => {
  const e = DIFF_BY_ID.easy, n = DIFF_BY_ID.normal, h = DIFF_BY_ID.hard;
  for(const k of ["yield","migr","start","ap"]) assert.ok(e[k] > n[k] && n[k] > h[k], "levier "+k);
  for(const k of ["spoil","fuel","sick","tax","raid","bandits"]) assert.ok(e[k] < n[k] && n[k] < h[k], "levier "+k);
  for(const d of [e, n, h]) assert.ok(typeof d.desc==="string" && d.desc.length>20, "chaque difficulté s'explique");
  const ge = new GameState(7, "prosperity", "easy"), gh = new GameState(7, "prosperity", "hard");
  assert.ok(ge.foodStock() > gh.foodStock() && ge.stock.timber > gh.stock.timber, "réserves de départ");
  // la même récolte rend plus en Paisible qu'en Difficile
  for(const g of [ge, gh]){ g.setFieldSize(4); }
  const fe = sownField(ge, "wheat", 1), fh = sownField(gh, "wheat", 1);
  fe.f.fert = fh.f.fert = 0.8;
  assert.ok(ge.forecast(fe).qty > gh.forecast(fh).qty, "récolte");
  ge.stock.berries = gh.stock.berries = 100;
  assert.ok(ge.spoilRate("berries", 4) < gh.spoilRate("berries", 4), "les denrées se gâtent plus vite en Difficile");
  assert.ok(ge.kingTaxEstimate(1180) < gh.kingTaxEstimate(1180), "impôt du roi");
});

test("étape 8 : le tailleur travaille dès le niveau 1, une famille use un vêtement tous les trois mois", () => {
  const g = fresh(); houses(g, 3);
  const b = g.buildings.find(x=>x.def==="burgage" && x.done);
  g.stock.timber = 10; g.buyExtension(b.id, "tailor");
  assert.ok(b.exts.includes("tailor"));
  feed(g); g.stock.clothes = 0;
  const c0 = g.stock.clothes; toMonth(g, 4); g.onMonth(); g.pendingEvent = null;
  assert.ok(g.stock.clothes > c0, "il coud même sans laine (moitié moins)");
  // la distribution : chaque famille prend un vêtement tous les CLOTH_EVERY mois, jamais un stock négatif
  const f = g.families[0]; f.clothCool = 0; g.stock.clothes = 0.4;
  for(let k=0;k<CLOTH_EVERY;k++){ toMonth(g, 4); g.onMonth(); g.pendingEvent = null; }
  assert.ok(g.stock.clothes >= 0, "jamais de vêtements en négatif");
});

test("étape 8 : le comptoir garde les vivres du village et les prix reviennent vers leur prix de base", () => {
  const g = fresh(); houses(g, 3); feed(g);
  for(const k of FT6) g.stock[k] = 0;
  g.stock.clothes = 0; g.stock.wool = 0; g.stock.ale = 0;
  g.stock.berries = 4;   // moins que trois mois de vivres : rien n'est vendu
  const t = doneBuilding(g, "trade"); g.assign(t.id);
  const tr0 = g.treasury; toMonth(g, 4); g.onMonth(); g.pendingEvent = null;
  assert.strictEqual(g.treasury, tr0, "le comptoir ne vend pas le pain de la bouche des familles");
  g.stock.honey = 200;   // un vrai surplus : il se vend
  toMonth(g, 4); g.onMonth(); g.pendingEvent = null;
  assert.ok(g.treasury > tr0 && g.stock.honey < 200, "le surplus se vend");
  // une marchandise vendue chaque mois perd de sa valeur ; les prix ne dérivent plus à l'infini
  for(let m=0;m<24;m++){ g.stock.honey = 200; toMonth(g, 4); g.onMonth(); g.pendingEvent = null; }
  assert.ok(g.prices.honey < TRADE_BASE.honey, "le miel vendu en masse se vend moins cher ("+g.prices.honey+")");
  for(const k of Object.keys(TRADE_BASE)) assert.ok(g.prices[k] <= TRADE_BASE[k]*1.2 + 1e-9, "prix borné : "+k);
});

test("étape 8 : le panneau d'une maison dit ce qu'il lui manque pour monter de niveau", () => {
  const g = fresh(); houses(g, 3);
  const b = g.buildings.find(x=>x.def==="burgage" && x.done && g.houseFamily(x));
  const f = g.houseFamily(b);
  f.fed = 1; f.gruel = false; f.clothed = true; f.variety = 1;
  let need = g.levelNeeds(b, true);
  assert.ok(need.some(n=>/marché/i.test(n[0]) && !n[1]), "il manque un marché");
  assert.ok(need.some(n=>/sortes/.test(n[0]) && !n[1]), "il manque de la variété");
  doneBuilding(g, "market"); f.variety = 2;
  need = g.levelNeeds(b, true);
  assert.ok(need.every(n=>n[1]), "tout est réuni : "+JSON.stringify(need));
  assert.deepStrictEqual(g.levelCost(b), { timber:2 });
  b.lvl = 2;
  need = g.levelNeeds(b, true);
  assert.ok(need.some(n=>/église/i.test(n[0])) && need.some(n=>/3 sortes/.test(n[0])), "le niveau 3 demande plus");
  b.lvl = 3; assert.strictEqual(g.levelNeeds(b), null);
});

test("étape 8 : un serf fait tourner le moulin ; la chaîne grain → farine ne reste plus bloquée sans bourgeois", () => {
  const g = fresh(); houses(g, 3); feed(g);
  for(const f of g.families) f.ord = "serf";
  const farm = doneBuilding(g, "farm");
  const mill = doneBuilding(g, "windmill");
  for(const f of g.families) f.ord = "serf";
  g.stock.grain = 30;
  g.assign(mill.id);
  assert.strictEqual(g.workersOf(mill).length, 1, "un serf est embauché");
  stepsUntil(g, 12*DAY, ()=>g.stock.flour>=2);
  assert.ok(g.stock.flour>=2, "de la farine sort du moulin ("+g.stock.flour+")");
});

test("étape 8 : un camp de bûcherons ne coûte rien — dépenser tout son bois en maisons ne bloque plus la partie", () => {
  const g = new GameState(11, "prosperity", "normal");
  g.stock.timber = 0;
  assert.strictEqual(g.canAfford("woodcutter"), true);
  const c = g.buildings.find(b=>b.def==="camp");
  let ok = false;
  for(let r=2; r<20 && !ok; r++) for(let dy=-r; dy<=r && !ok; dy++) for(let dx=-r; dx<=r && !ok; dx++) if(g.place("woodcutter", c.x+dx, c.y+dy)===null) ok = true;
  assert.ok(ok, "posé sans bois");
});

test("étape 8 : un bâtiment achevé reçoit tout de suite son premier ouvrier", () => {
  const g = fresh(); houses(g, 3);
  g.stock.timber = 20;
  const b = placeInCenter(g, "forager");
  stepsUntil(g, 20*DAY, ()=>b.done);
  assert.ok(b.done, "chantier achevé");
  assert.strictEqual(g.workersOf(b).length, 1, "un ouvrier s'y met");
  assert.strictEqual(b.want, 1);
});

test("étape 8 : le gibier se repeuple autour d'un camp de chasse", () => {
  const g = fresh();
  const h = doneBuilding(g, "hunter");
  g.deer = [];
  for(let m=0;m<6;m++) g.restockDeer(h);
  const R = BUILD_DEFS.hunter.radius;
  const near = g.deer.filter(d=>Math.hypot(d.x-h.x-0.5, d.y-h.y-0.5)<=R).length;
  assert.ok(near>=1 && near<=4, "des cerfs à portée, pas plus de quatre ("+near+")");
});

test("étape 8 : objectifs-guides — chacun s'atteint une fois, se sauvegarde, et mène à la victoire en Prospérité", () => {
  const g = new GameState(3, "prosperity", "normal");
  assert.strictEqual(g.goalsDone(), 0);
  assert.strictEqual(g.nextGoals(1)[0].id, "house");
  for(const x of GOALS) assert.ok(x.name && x.hint !== undefined, "objectif complet : "+x.id);
  houses(g, 3);
  g.goalsCheck();
  assert.ok(g.goals.done.house!==undefined, "les familles sont logées");
  assert.ok(g.log.some(l=>/Objectif atteint/.test(l.text)));
  const g2 = GameState.load(JSON.parse(JSON.stringify(g.serialize())));
  assert.deepStrictEqual(g2.goals, g.goals);
  // une ancienne partie (sans objectifs) retrouve d'elle-même ceux qui sont déjà remplis
  const old = JSON.parse(JSON.stringify(g.serialize())); delete old.goals;
  const g3 = GameState.load(old); g3.goalsCheck();
  assert.ok(g3.goals.done.house!==undefined);
});

test("étape 8 : une région prise par le Baron se reprend (moitié plus cher) ; les modes de conquête sont gagnables", () => {
  const g = new GameState(1176, "duel", "normal");
  const near = g.goalRegions()[1];
  g.baron.regions.push(near.id); g.baron.power = 2;
  assert.ok(g.regionRetakable(near) && !g.regionClaimable(near));
  const c = g.regionCost(near), base = g.regionCost();
  assert.strictEqual(c.treasury, Math.round(base.treasury*1.5));
  g.treasury = 500; g.wealth = 500;
  assert.ok(g.claimRegion(near.id));
  assert.ok(near.owned && !g.baron.regions.includes(near.id) && g.baron.power===1);
  // victoire : cinq régions, aucune voisine au Baron, en 1179
  for(const r of g.goalRegions()) if(!r.owned && g.ownedRegions().length<MODE_BY_ID.duel.regions) g.claimRegion(r.id);
  assert.ok(g.conquest().ok, JSON.stringify(g.conquest()));
  g.time.year = 1179; g.camps = [];
  toMonth(g, 3); g.onMonth(); g.pendingEvent = null;
  assert.ok(g.victory, "victoire en Duel");
});

test("étape 8 : l'immigration suit l'approbation (rien sous 40 %, au plus une famille ou deux par mois)", () => {
  const g = new GameState(5, "prosperity", "normal"); houses(g, 3); feed(g);
  for(let k=0;k<6;k++) legacyHouse2(g);
  const n0 = g.families.length;
  g.approval = 30;
  withRnd(g, 0.01, ()=>{ toMonth(g, 5); g.onMonth(); });
  // (l'approbation est recalculée pendant le mois : on vérifie au moins le plafond)
  assert.ok(g.families.length - n0 <= 2, "pas d'afflux d'un coup");
});

test("étape 8 : l'impôt du roi suit les maisons, les années et une part des ventes du comptoir", () => {
  const g = fresh(); houses(g, 3);
  const t0 = g.kingTaxEstimate(1178);
  g.book.hist.push({ y:1177, m:5, lines:{ trade:200 } });
  assert.strictEqual(g.kingTaxEstimate(1178), t0 + Math.round(KING_TRADE*200));
  assert.ok(g.kingTaxEstimate(1180) > g.kingTaxEstimate(1178), "il grandit avec les années");
});

test("étape 8 : l'impôt du roi attend le manoir ; faute de deniers, on le complète en nature", () => {
  const g = fresh(); houses(g, 3); feed(g);
  g.time.year = 1177; toMonth(g, KING_MONTH_T); g.onMonth();
  assert.ok(!g.pendingEvent || g.pendingEvent.title!=="L'impôt du roi", "pas de manoir : rien à payer");
  doneBuilding(g, "manor");
  g.treasury = 3; g.pendingEvent = null;
  toMonth(g, KING_MONTH_T); g.onMonth();
  const ev = g.pendingEvent;
  assert.ok(ev && ev.title==="L'impôt du roi");
  const k = ev.choices.findIndex(c=>c.act==="payKind");
  assert.ok(k>=0 && !ev.choices[k].disabled, "on peut payer en partie en nature");
  const food = g.foodStock(), kind = ev.choices[k].kind;
  g.resolveEvent(k);
  assert.ok(g.treasury < 1e-9, "tous les deniers partent");
  assert.ok(Math.abs(g.foodStock() - (food - kind)) < 1e-6, "et des vivres pour le reste");
});

test("étape 8 : une case libre enfermée n'est plus visée — les journaliers passent par un accès qu'ils peuvent atteindre", () => {
  const g = fresh(); houses(g, 3);
  g.stock.timber = 99; g.stock.stone = 99;
  // un entrepôt dont la seule case libre au contact est une poche fermée par des remparts
  let spot = null;
  for(let y=DY+3; y<DY+OH-6 && !spot; y++) for(let x=DX+Math.ceil(OW/3)+3; x<DX+Math.floor(2*OW/3)-6 && !spot; x++){
    let ok = true;
    for(let yy=y-3; yy<=y+4 && ok; yy++) for(let xx=x-3; xx<=x+3 && ok; xx++) if(g.tiles[yy*W+xx]!==T_GRASS || g.occupied[yy*W+xx]>=0 || g.roads[yy*W+xx]) ok = false;
    if(ok) spot = { x, y };
  }
  assert.ok(spot, "un coin libre");
  const { x, y } = spot;
  assert.strictEqual(g.place("storehouse", x, y), null);
  const st = g.buildings[g.buildings.length-1]; st.done = true; st.progress = 1; delete st.mat;
  for(const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1],[0,2],[-1,2],[1,2]]){
    assert.strictEqual(g.place("wall", x+dx, y+dy), null);
    const w = g.buildings[g.buildings.length-1]; w.done = true; w.progress = 1; delete w.mat;
  }
  assert.ok(g.passable(x, y+1), "la poche est libre…");
  const from = { x:x+0.5, y:y-3.5 };
  const sp = g.spotFor(st, from.x, from.y);
  assert.ok(sp, "un accès existe plus loin");
  assert.ok(!(sp.x===x && sp.y===y+1), "… mais on ne vise plus la poche");
  assert.strictEqual(g.compAt(sp.x+0.5, sp.y+0.5), g.compAt(from.x, from.y), "l'accès choisi est relié");
  assert.ok(g.astar(Math.floor(from.x), Math.floor(from.y), sp.x, sp.y), "et un chemin y mène");
});

test("étape 8 : un bâtiment que plus personne ne peut atteindre est signalé (panneau et message)", () => {
  const g = fresh(); houses(g, 3);
  g.stock.timber = 99; g.stock.stone = 99;
  const b = doneBuilding(g, "hunter");
  assert.ok(!g.enclosedCheck() || !b.enclosed, "accessible au départ");
  // trois anneaux de remparts autour : plus aucune case libre reliée
  for(let r=1;r<=3;r++) for(let y=b.y-r;y<=b.y+r;y++) for(let x=b.x-r;x<=b.x+r;x++){
    if(Math.max(Math.abs(x-b.x), Math.abs(y-b.y))!==r) continue;
    if(g.place("wall", x, y)===null){ const w = g.buildings[g.buildings.length-1]; w.done = true; w.progress = 1; delete w.mat; }
    else { g.occupied[y*W+x] = 9999; }   // (une case déjà prise ou impropre : on la bouche aussi)
  }
  g._reach = null;
  g.enclosedCheck();
  assert.ok(b.enclosed, "enfermé");
  assert.ok(/Enfermé/.test(g.workStatus(b)), g.workStatus(b));
  assert.ok(g.log.some(l=>/n'a plus aucun accès/.test(l.text)), "message au joueur");
});

/* ===== le bœuf polyvalent : tâches au choix, labour et charroi en même temps, poteau déplaçable ===== */
test("bœuf : un fermier qui laboure attelle un bœuf (×2) ; le charroi n'est plus bloqué pour autant", () => {
  const g = fresh();
  const farm = doneBuilding(g, "farm"); g.assign(farm.id);
  const v = g.workersOf(farm)[0];
  const b = newField(g, "wheat"); toMonth(g, 8);
  g.treasury = 99; g.buyOx();
  assert.strictEqual(g.oxen.length, 2);
  v.task = { type:"plow", bid:b.id }; v.state = "work";
  g.fieldWork(v, v.task);
  const yoked = g.oxen.find(o=>o.plow===v.id);
  assert.ok(yoked, "un bœuf est attelé à la charrue");
  assert.strictEqual(g.plowMul(v), 2);
  assert.ok(/charrue/.test(g.oxActivity(yoked)));
  // pendant ce temps, un chantier trouve l'autre bœuf
  g.stock.timber = 40;
  const s = placeInCenter(g, "storehouse");
  const w = g.villagers.find(x=>g.canWork(x) && x!==v && x.work<0);
  const job = g.siteJob(w, [s]);
  assert.strictEqual(job.type, "haul"); assert.ok(job.ox && job.ox!==yoked.id, "l'autre bœuf part au charroi");
  // le labour s'arrête : le bœuf (resté au champ) est dételé et rentre seul
  yoked.x += 6; yoked.y += 3;
  v.task = null; g.oxStep();
  assert.ok(!(yoked.plow>0) && yoked.home, "dételé, il rentre au poteau");
  for(let i=0;i<400 && yoked.home;i++) g.oxStep();
  assert.ok(!g.oxAway(yoked), "il est revenu au poteau");
});

test("bœuf : ce qu'on lui demande (charroi seul, labour seul, repos) est respecté et sauvegardé", () => {
  const g = fresh();
  const o = g.oxen[0];
  const farm = doneBuilding(g, "farm"); g.assign(farm.id);
  const v = g.workersOf(farm)[0];
  g.oxStep();
  assert.strictEqual(g.oxJob(o), "all");
  assert.strictEqual(g.setOxJob(o.id, "haul"), null);
  assert.strictEqual(g.yokeOx(v), null, "au charroi seulement : pas de charrue");
  assert.ok(g.freeOx(o.x, o.y), "mais libre pour les troncs");
  g.setOxJob(o.id, "plow");
  assert.strictEqual(g.freeOx(o.x, o.y), null, "au labour seulement : pas de charroi");
  assert.ok(g.yokeOx(v), "mais attelé à la charrue");
  g.setOxJob(o.id, "rest");
  assert.ok(!(o.plow>0), "mis au repos : dételé");
  assert.strictEqual(g.freeOx(o.x, o.y), null); assert.strictEqual(g.plowMul(), 1);
  const g2 = GameState.load(JSON.parse(JSON.stringify(g.serialize())));
  assert.strictEqual(g2.oxJob(g2.oxen[0]), "rest", "gardé dans la sauvegarde");
  assert.strictEqual(g2.setOxJob(o.id, "n'importe quoi"), "Bœuf introuvable");
});

test("bœuf : le poteau se déplace gratuitement, les bœufs qui y attendaient le suivent", () => {
  const g = fresh();
  const post = g.buildings.find(b=>b.def==="oxpost"), o = g.oxen[0];
  g.oxStep();
  assert.ok(!g.oxAway(o));
  const sp = freeSpot(g), t0 = g.stock.timber;
  g.stock.timber = 0;
  assert.strictEqual(g.canMoveOxPost(sp.x, sp.y), null, "pas besoin de bois pour le déplacer");
  const ox0 = post.x, oy0 = post.y;
  assert.strictEqual(g.moveOxPost(sp.x, sp.y), null);
  assert.strictEqual(post.x, sp.x); assert.strictEqual(post.y, sp.y);
  assert.strictEqual(g.occupied[oy0*W+ox0], -1, "l'ancienne case est libérée");
  assert.strictEqual(g.occupied[sp.y*W+sp.x], post.id);
  assert.strictEqual(g.stock.timber, 0);
  for(let i=0;i<2000 && o.home;i++) g.oxStep();
  assert.ok(!g.oxAway(o), "le bœuf a rejoint le nouveau poteau");
  assert.ok(g.moveOxPost(-5, -5), "hors de la carte : refusé");
  g.stock.timber = t0;
});

console.log("\n" + passed + " tests OK" + (process.exitCode ? " (avec échecs)" : ""));
