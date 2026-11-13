"use strict";
/* Étape 8 : le joueur automatique « raisonnable » (utilisé par test/joueur.js dans Node, et par l'audit de
   l'interface dans un navigateur). Il part du vrai départ et ne triche jamais : il ne touche ni au stock ni au
   trésor, il passe par les mêmes actions que le joueur (tracer, poser, affecter, régler, juger, répondre).
   makeBot(S) : S = le module de la simulation (ou les globales du jeu dans une page). */
(function(root){
function makeBot(S, profile){
const NOVICE = profile==="novice";   // un joueur qui débute : il passe moins souvent, prévoit peu, oublie des choses
const { BUILD_DEFS, W, H, T_GRASS, T_FOREST, T_BERRY, T_STONE, SKILLED, CASE_DEFS } = S;
/* ---------- la carte ---------- */
const at = (x, y)=>y*W+x;
function free(g, x, y){
  if(x<1 || y<1 || x>=W-1 || y>=H-1) return false;
  const i = at(x, y);
  return g.tiles[i]===T_GRASS && g.occupied[i]<0 && !g.roads[i] && !g.pastureCell[i] && g.regionOwned(x, y);
}
function rectFree(g, x, y, w, h){ for(let yy=y; yy<y+h; yy++) for(let xx=x; xx<x+w; xx++) if(!free(g, xx, yy)) return false; return true; }
function center(g){ const b = g.buildings.find(q=>q.def==="manor") || g.buildings.find(q=>q.def==="camp") || g.buildings.find(q=>q.def==="burgage") || g.buildings[0]; return b ? { x:b.x+1, y:b.y+1 } : { x:W/2|0, y:H/2|0 }; }
function count(g, x, y, R, pred){ let n = 0; for(let yy=Math.max(0, y-R); yy<=Math.min(H-1, y+R); yy++) for(let xx=Math.max(0, x-R); xx<=Math.min(W-1, x+R); xx++){ if(Math.hypot(xx-x, yy-y)<=R && pred(at(xx, yy), xx, yy)) n++; } return n; }
// relie une case au réseau de routes par le plus court chemin (sur l'herbe libre), s'il en existe un pas trop long
function connect(g, x, y, maxLen){
  if(g.roadAt(x, y)) return true;
  const prev = new Map(), q = [at(x, y)]; prev.set(q[0], -1);
  for(let h=0; h<q.length && h<6000; h++){
    const i = q[h], cx = i%W, cy = (i/W)|0;
    for(const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx = cx+dx, ny = cy+dy, n = at(nx, ny);
      if(prev.has(n) || nx<1 || ny<1 || nx>=W-1 || ny>=H-1) continue;
      if(g.roadAt(nx, ny)){
        // remonte le chemin et pose la route
        const path = []; let k = i; while(k>=0){ path.push(k); k = prev.get(k); }
        if(path.length>maxLen) return false;
        for(const c of path) if(!g.roads[c]) g.toggleRoad(c%W, (c/W)|0);
        return true;
      }
      if(!free(g, nx, ny)) continue;
      prev.set(n, i); q.push(n);
    }
  }
  return false;
}
// une rue droite, avec des maisons des deux côtés (profondeur 3 : la maison et une cour de cinq cases)
function addStreet(g, houses){
  const c = center(g), perSide = Math.max(1, Math.ceil(houses/2)), L = perSide*2;
  let best = null, bd = Infinity;
  for(let y=c.y-30; y<=c.y+30; y++) for(let x=c.x-30; x<=c.x+30; x++){
    const d = Math.hypot(x+L/2-c.x, y-c.y); if(d>=bd) continue;
    if(!rectFree(g, x, y-3, L, 7)) continue;
    // la rue doit pouvoir rejoindre le réseau
    best = { x, y }; bd = d;
  }
  if(!best) return 0;
  const { x, y } = best;
  for(let k=0; k<L; k++) g.toggleRoad(x+k, y);
  if(!connect(g, x-1, y, 25) && !connect(g, x+L, y, 25)){ for(let k=0; k<L; k++) g.toggleRoad(x+k, y); return 0; }
  let n = 0;
  for(const pts of [[[x, y-3], [x+L, y-3], [x+L, y], [x, y]], [[x, y+1], [x+L, y+1], [x+L, y+4], [x, y+4]]]){
    const before = g.buildings.length;
    if(g.traceZone(pts)===null) n += g.buildings.length - before;
  }
  return n;
}
// le meilleur emplacement d'un bâtiment : près du village, et près de sa ressource
function placeBest(g, def, score, R){
  const c = center(g), d = BUILD_DEFS[def];
  let best = null, bs = -Infinity;
  R = R || 28;
  for(let y=c.y-R; y<=c.y+R; y++) for(let x=c.x-R; x<=c.x+R; x++){
    if(def==="quarry"){ if(x<0 || y<0 || x>=W || y>=H || g.tiles[at(x, y)]!==T_STONE || g.occupied[at(x, y)]>=0 || !g.regionOwned(x, y) || g.stoneAmt[at(x, y)]<20) continue; }
    else if(!rectFree(g, x-1, y-1, d.w+2, d.h+2)) continue;   // une case libre tout autour : jamais enfermé
    const s = score(x, y) - Math.hypot(x-c.x, y-c.y)*0.6;
    if(s>bs){ bs = s; best = { x, y }; }
  }
  if(!best || bs===-Infinity) return null;
  if(g.place(def, best.x, best.y)) return null;
  const b = g.buildings[g.buildings.length-1];
  connect(g, best.x, best.y+d.h, 20) || connect(g, best.x-1, best.y, 20) || connect(g, best.x+d.w, best.y, 20);
  return b;
}
const forest = (g)=>(i)=>g.tiles[i]===T_FOREST && g.treeWood[i]>0;
const SCORE = {
  woodcutter:(g)=>(x, y)=>{ const n = count(g, x, y, 6, forest(g)); return n<12 ? -Infinity : Math.min(n, 60); },
  forager:(g)=>(x, y)=>{ const n = count(g, x, y, 6, (i)=>g.tiles[i]===T_BERRY); return n<3 ? -Infinity : n*4; },
  hunter:(g)=>(x, y)=>{ const n = count(g, x, y, 9, forest(g)); return n<25 ? -Infinity : Math.min(n, 80)/2; },
  quarry:()=>()=>0,
  any:()=>()=>0,
};
function build(g, def){ return placeBest(g, def, (SCORE[def] || SCORE.any)(g)); }
// un champ rectangulaire sur la meilleure terre proche
function addField(g){
  const c = center(g); let best = null, bs = -Infinity;
  for(let y=c.y-26; y<=c.y+26; y+=1) for(let x=c.x-26; x<=c.x+26; x+=1){
    if(!rectFree(g, x-1, y-1, 8, 7)) continue;    // une case de marge autour
    let s = 0; for(let yy=y; yy<y+5; yy++) for(let xx=x; xx<x+6; xx++) s += g.soil[at(xx, yy)];
    s = s/30*40 - Math.hypot(x-c.x, y-c.y)*0.4;
    if(s>bs){ bs = s; best = { x, y }; }
  }
  if(!best) return null;
  const { x, y } = best;
  if(g.traceField([[x, y], [x+6, y], [x+6, y+5], [x, y+5]])) return null;
  return g.buildings[g.buildings.length-1];
}
function addPasture(g){
  const c = center(g); let best = null, bd = Infinity;
  for(let y=c.y-26; y<=c.y+26; y++) for(let x=c.x-26; x<=c.x+26; x++){
    const d = Math.hypot(x-c.x, y-c.y); if(d<8 || d>=bd) continue;
    if(!rectFree(g, x-1, y-1, 8, 8)) continue;
    best = { x, y }; bd = d;
  }
  if(!best) return null;
  const { x, y } = best;
  if(g.tracePasture([[x, y], [x+6, y], [x+6, y+6], [x, y+6]])) return null;
  return g.buildings[g.buildings.length-1];
}

/* ---------- le joueur ---------- */
const nb = (g, def, all)=>g.buildings.filter(b=>b.def===def && (all || true)).length;
const nbDone = (g, def)=>g.buildings.filter(b=>b.def===def && b.done).length;
const sites = (g)=>g.buildings.filter(b=>!b.done).length;
// les postes, par ordre d'importance ; on garde des journaliers pour les chantiers
const JOB_PRIO = ["forager","woodcutter","hunter","farm","windmill","bakery","quarry","trade","market","pasture","dairy","smokehouse"];
function staff(g){
  const builders = sites(g) ? 2 : 0;
  for(const def of JOB_PRIO){
    for(const b of g.buildings){
      if(b.def!==def || !b.done) continue;
      const d = BUILD_DEFS[def];
      let cap = d.fam;
      if(def==="quarry" && g.stock.stone>=40) cap = 0;
      if(def==="pasture" && !(b.herd && b.herd.an.length)) cap = 0;
      if(def==="market") cap = 1;
      if(def==="farm" && !g.fields().length) cap = 0;

      while(g.workersOf(b).length<cap){
        const freeA = g.freeAdults().filter(v=>g.canHold(v, b));
        if(freeA.length <= (SKILLED.includes(def) ? 0 : builders)) break;
        if(!g.assign(b.id)) break;
      }
      while(g.workersOf(b).length>cap) g.unassign(b.id);
    }
  }
}
function judge(g){
  for(const c of g.cases.slice()){
    const d = CASE_DEFS[c.type];
    const v = d.accused ? (c.proof==="solides" ? "fine" : "acquit") : c.type==="border" ? "split" : c.type==="debt" ? "pay" : "fine";
    if(g.judge(c.id, v)) g.judge(c.id, d.verdicts[0].id);
  }
  for(const p of g.petitions.slice()) g.answer(p.id, p.type!=="marry" && (p.type!=="loan" || g.treasury>(p.amount||0)+30));
}
function resolve(g, R){
  const ev = g.pendingEvent; if(!ev) return;
  R.events[ev.title] = (R.events[ev.title]||0) + 1;
  const pick = (act)=>ev.choices.findIndex(c=>c.act===act && !c.disabled);
  let k = -1;
  if(ev.title==="L'impôt du roi"){ k = pick("pay"); if(k<0 && g.foodMonths()>3) k = pick("payKind"); }
  else if(ev.title.startsWith("Des brigands")) k = g.treasury > (ev.choices[0].amount||0)*2 ? pick("payBandits") : -1;
  else if(ev.choices.some(c=>c.act==="buyFood")) k = pick("buyFood") >= 0 ? pick("buyFood") : ev.choices.findIndex(c=>c.act==="buyFood" && !c.disabled);
  else if(ev.choices.some(c=>c.act==="fairWood")) k = g.freeStock("timber")>20 ? pick("fairWood") : pick("fairCoin");
  else if(ev.choices.some(c=>c.act==="facYield")) k = pick("facYield");
  if(k<0) k = ev.choices.findIndex(c=>!c.disabled && /refuse|Refuse|hide|No|noFood/.test(c.act));
  if(k<0) k = ev.choices.findIndex(c=>!c.disabled);
  if(k<0) k = ev.choices.length-1;
  g.resolveEvent(k);
}
const EXT_CYCLE = ["garden","chicken","orchard","beehive"];
function play(g, R){
  if(NOVICE && (R.turn = (R.turn||0) + 1) % 2) return;   // le novice ne passe voir son village qu'une fois par mois
  const m = g.time.month, fam = g.families.length, timber = g.freeStock("timber"), stone = g.freeStock("stone");
  const houses = g.buildings.filter(b=>b.def==="burgage");
  const freeH = houses.filter(b=>!g.families.some(f=>f.home===b.id)).length;     // maisons vides ou en chantier
  // 0) d'abord de quoi se chauffer et manger (le bois qui reste ira aux maisons)
  if(!nb(g, "woodcutter") && build(g, "woodcutter")) R.built.woodcutter = (R.built.woodcutter||0) + 1;
  if(!nb(g, "forager") && g.canAfford("forager") && build(g, "forager")) R.built.forager = (R.built.forager||0) + 1;
  // 1) des maisons : toutes les familles logées, et une ou deux d'avance pour les nouveaux venus
  const homeless = g.families.filter(f=>f.home<0 || g.buildings.some(b=>b.id===f.home && b.def==="camp")).length;
  if(freeH < (NOVICE ? Math.max(1, homeless) : Math.max(2, homeless)) && timber>=4 && sites(g)<6) addStreet(g, Math.min(6, Math.max(4, homeless+2)));
  // 2) l'essentiel d'abord
  const want = [];
  if(!nb(g, "woodcutter")) want.push("woodcutter");
  if(!nb(g, "forager")) want.push("forager");
  if(!nb(g, "hunter") && fam>=3) want.push("hunter");
  if(nb(g, "woodcutter") < Math.ceil(fam/7)) want.push("woodcutter");
  if(!nb(g, "market") && houses.length>=4) want.push("market");
  if(!nb(g, "farm") && (g.time.year>1176 || m>=5)) want.push("farm");
  if(!nb(g, "storehouse") && fam>=5) want.push("storehouse");
  if(!nb(g, "granary") && fam>=6 && !NOVICE) want.push("granary");
  if(!nb(g, "quarry") && fam>=5) want.push("quarry");
  if(!nb(g, "church") && fam>=7) want.push("church");
  if(!nb(g, "manor") && fam>=8) want.push("manor");
  if(!nb(g, "windmill") && nbDone(g, "farm") && fam>=8) want.push("windmill");
  if(!nb(g, "bakery") && nbDone(g, "windmill")) want.push("bakery");
  const fm = NOVICE ? 9 : g.foodMonths();   // le novice ne surveille pas ses réserves
  if(nb(g, "forager") < Math.ceil(fam/(fm<4 ? 6 : 10))) want.push("forager");
  if(nb(g, "hunter") < Math.ceil(fam/(fm<4 ? 8 : 14))) want.push("hunter");
  if(!nb(g, "trade") && nbDone(g, "manor") && fam>=10) want.push("trade");
  if(nb(g, "farm") < Math.ceil(fam/(fm<4 ? 8 : 12))) want.push("farm");
  if(nbDone(g, "manor") && !nb(g, "tower") && g.mode().combat) want.push("tower");
  if(fam>=14 && nb(g, "storehouse")<2) want.push("storehouse");
  if(fam>=12 && !nb(g, "smokehouse") && !NOVICE) want.push("smokehouse");
  for(const def of want){
    if(sites(g)>=4) break;
    if(!g.canAfford(def)) continue;
    if(build(g, def)) R.built[def] = (R.built[def]||0) + 1;
  }
  // 3) des champs pour chaque ferme (avant les semailles d'automne), un pâturage à moutons pour la laine
  const fields = g.buildings.filter(b=>b.def==="field").length;
  if(nbDone(g, "farm") && fields < 2*nbDone(g, "farm") && fields < Math.ceil(fam/(fm<4 ? 3 : 5))) addField(g);
  for(const b of g.fields()) if(b.f && !b.f.sown){
    const crops = g.fields().filter(x=>x!==b).map(x=>x.f.crop);
    if(m>=6 && m<=9 && b.f.crop!=="wheat" && b.f.crop!=="rye") g.setCrop(b.id, b.f.prev==="wheat" ? "rye" : "wheat");
    if(m>=0 && m<=2 && !crops.includes("peas") && b.f.prev) g.setCrop(b.id, "peas");
  }
  if(!g.pastures().length && fam>=8 && timber>=12) addPasture(g);
  for(const p of g.pastures()) if(p.done && !p.herd.an.length && g.treasury>=12){ g.buyAnimal(p.id, "sheep", true); g.buyAnimal(p.id, "sheep", true); g.buyAnimal(p.id, "sheep", false); }
  // 4) les agrandissements de cour, pour varier les repas (et le tailleur au niveau 2)
  let k = 0;
  for(const b of houses){
    if(!b.done || b.exts.length || !g.families.some(f=>f.home===b.id) || g.freeStock("timber")<6) continue;
    if(NOVICE && b.id%2) continue;   // le novice n'équipe qu'une cour sur deux
    const tailors = houses.filter(h=>h.exts.includes("tailor")).length;
    // des vêtements pour tous (le jeu le dit : sans vêtements, pas de niveau 2), puis de quoi varier les repas
    if(tailors < Math.ceil(fam/4) && (g.stock.clothes||0) < fam) g.buyExtension(b.id, "tailor");
    else g.buyExtension(b.id, EXT_CYCLE[(b.id + k++)%EXT_CYCLE.length]);
  }
  // 5) l'église : autel puis clocher ; le fisc, raisonnable
  const ch = g.buildings.find(b=>b.def==="church" && b.done);
  if(ch && g.freeStock("stone")>=8) g.churchUp(ch.id, (ch.churchUp||[]).includes("altar") ? "bell" : "altar");
  if(g.hasManor()){
    if(g.taxRate!==(NOVICE ? 0.3 : 0.2)) g.setTax(NOVICE ? 0.3 : 0.2);
    if(g.taxLevel("peage")!==1) g.setTaxLevel("peage", 1);
    if(g.hasChurch() && g.taxLevel("dime")!==1) g.setTaxLevel("dime", 1);
    for(const id of ["steward","chaplain"]) if(g.seatOpen(id) && !g.seatHolder(id) && fam>=8){ const c = g.seatCandidates(id, 1)[0]; if(c) g.appoint(id, c.id); }
  }
  // 6) les ouvriers, la justice, la guerre, les régions
  staff(g);
  judge(g);
  if(g.camps.length) g.raiseMilitia();
  if(g.mode().combat || g.treasury>150){
    // d'abord reprendre au Baron les terres voisines du départ, puis réclamer
    const r = g.goalRegions().find(r2=>g.regionRetakable(r2)) || g.goalRegions().find(r2=>g.regionClaimable(r2)) || g.regions.find(r2=>g.regionClaimable(r2));
    const c = r && g.regionCost(r);
    if(r && g.treasury >= c.treasury + 30 && g.wealth >= c.wealth) g.claimRegion(r.id);
  }
  if(g.fisc.debt>0 && g.treasury>g.fisc.debt+30) g.repay(g.fisc.debt);
  if(m===9 && g.treasury<20 && g.hasManor() && g.time.year>=1177) g.borrow(50);
}

return { play, resolve, addStreet, build, addField, addPasture, staff };
}
if(typeof module!=="undefined" && module.exports) module.exports = makeBot;
else root.makeBot = makeBot;
})(this);
