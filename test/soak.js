"use strict";
/* Grande campagne de tests de l'étape 7 (administration) : un joueur automatique gouverne des parties entières,
   selon quatre manières de faire (doux, équilibré, tyran, négligent), sur plusieurs graines et plusieurs années.
   Chaque mois, l'état est vérifié (nombres valides, conseil, ordres, faction, affaires) ; chaque année, la partie est
   sauvegardée, rechargée, et l'on continue avec la partie rechargée. À la fin : un bilan chiffré par manière de faire.
   Lancer avec : node test/soak.js [années=8] [graines=3] */
const S = require("../js/sim.js");
const { GameState, BUILD_DEFS, W, H, T_GRASS, T_STONE, TICKS_PER_DAY, DAYS_PER_MONTH, TAX_ORDER, SEAT_ORDER, SEAT_DEFS,
        CASE_DEFS, SKILLED, FOOD_TYPES, BOOK_CATS } = S;
const YEARS = Number(process.argv[2]) || 8, SEEDS = Number(process.argv[3]) || 3;
const ONLY = process.argv[4] || null;                 // une seule manière de gouverner
if(process.argv.includes("--sans-ordres")) GameState.prototype.canHold = function(v){ return !this.isNoble(v); };
const MONTH = TICKS_PER_DAY*DAYS_PER_MONTH;

/* ---------- compteurs : on enveloppe les méthodes du jeu ---------- */
let C = null;
const P = GameState.prototype;
function wrap(name, fn){ const o = P[name]; P[name] = function(...a){ const r = o.apply(this, a); try{ fn.call(this, r, a); }catch(e){} return r; }; }
wrap("newCase", function(r){ if(r) C.cases++; });
wrap("newPetition", function(r){ if(r) C.petitions++; });
wrap("judge", function(r){ if(r===null) C.judged++; });
wrap("answer", function(r, a){ if(r===null) C[a[1] ? "granted" : "refused"]++; });
wrap("jacquerie", function(){ C.jacqueries++; });
wrap("factionYield", function(r){ if(r===null) C.yields++; });
wrap("arrestLeader", function(r){ if(r===null) C.arrests++; });
wrap("removeFamily", function(){ C.departures++; });
wrap("ennoble", function(r){ if(r===null) C.ennobled++; });
wrap("proclaim", function(r){ if(r===null) C.laws++; });
wrap("seizeGoods", function(){ C.seizures++; });
wrap("die", function(r, a){ C.deaths[a[1]] = (C.deaths[a[1]]||0) + 1; });
const fm = P.factionMonth;
P.factionMonth = function(){ const had = !!this.faction; const r = fm.apply(this, arguments); if(!had && this.faction) C.factions++; if(this.pendingEvent && this.pendingEvent.title==="Un ultimatum" && !this._ult){ C.ultimatums++; this._ult = true; } if(!this.pendingEvent) this._ult = false; return r; };
const jm = P.justiceMonth;
P.justiceMonth = function(){ const n0 = this.cases.length + this.cases.filter(c=>c.until<this.monthIdx()).length; const late = this.cases.filter(c=>c.until<this.monthIdx()).length; C.expired += late; return jm.apply(this, arguments); };

/* ---------- pose des bâtiments autour du départ ---------- */
function center(g){ const c = g.buildings.find(b=>b.def==="camp") || g.buildings.find(b=>b.def==="manor"); return c ? { x:c.x, y:c.y } : { x:W/2|0, y:H/2|0 }; }
function put(g, def, done){
  const c = center(g);
  g.stock.timber = Math.max(g.stock.timber, 30); g.stock.stone = Math.max(g.stock.stone, 20);
  if(def==="field") g.setFieldSize(4);
  if(def==="quarry"){
    let best = -1, bd = 1e9;
    for(let i=0;i<W*H;i++) if(g.tiles[i]===T_STONE && g.occupied[i]<0 && g.regionOwned(i%W, (i/W)|0)){ const d = Math.hypot(i%W-c.x, ((i/W)|0)-c.y); if(d<bd){ bd = d; best = i; } }
    if(best>=0 && g.place(def, best%W, (best/W)|0)===null) return fin(g.buildings[g.buildings.length-1], done);
    return null;
  }
  for(let r=2; r<40; r++) for(let dy=-r; dy<=r; dy++) for(let dx=-r; dx<=r; dx++){
    if(Math.max(Math.abs(dx), Math.abs(dy))!==r) continue;
    if(g.place(def, c.x+dx, c.y+dy)===null) return fin(g.buildings[g.buildings.length-1], done);
  }
  return null;
}
function fin(b, done){ if(done){ b.done = true; b.progress = 1; delete b.mat; } return b; }
function staff(g){ for(const b of g.buildings){ const d = BUILD_DEFS[b.def]; if(d && d.fam>0 && b.done) b.want = d.fam; } g.fillJobs(); }

/* ---------- les quatre manières de gouverner ---------- */
const STYLES = {
  doux: { taille:0.10, dime:1, peage:0, corvee:0, council:false, judge:"fair", petitions:"yes", feast:true, alms:true, ennoble:false, laws:{ deadwood:1, mainmorte:1 } },
  equilibre: { taille:0.20, dime:2, peage:1, corvee:1, council:true, judge:"fair", petitions:"afford", feast:true, alms:false, ennoble:true, laws:{ deadwood:1, charter:1 } },
  tyran: { taille:0.50, dime:3, peage:3, corvee:3, council:true, judge:"harsh", petitions:"no", feast:false, alms:false, ennoble:true, laws:{ nobleTax:0, arms:1 }, ultimatum:"arrest" },
  negligent: { taille:0.25, dime:0, peage:2, corvee:2, council:false, judge:"none", petitions:"none", feast:false, alms:false, ennoble:false, laws:{} },
};
function judgeAll(g, how){
  if(how==="none") return;
  for(const c of g.cases.slice()){
    const d = CASE_DEFS[c.type];
    let v;
    if(how==="harsh") v = d.accused ? "banish" : c.type==="border" ? "a" : c.type==="debt" ? "pay" : "pillory";
    else v = d.accused ? (c.proof==="solides" ? "fine" : "acquit") : c.type==="border" ? "split" : c.type==="debt" ? "pay" : "fine";
    if(g.judge(c.id, v)) g.judge(c.id, d.verdicts[0].id);
  }
}
function answerAll(g, how){
  if(how==="none") return;
  for(const p of g.petitions.slice()){
    const yes = how==="yes" || (how==="afford" && (p.type!=="loan" || g.treasury>p.amount+20) && p.type!=="marry");
    g.answer(p.id, how==="no" ? false : yes);
  }
}
function resolveEvent(g, st){
  const ev = g.pendingEvent; if(!ev) return;
  let k = ev.choices.findIndex(c=>!c.disabled);
  if(ev.title==="Un ultimatum") k = ev.choices.findIndex(c=>c.act===(st.ultimatum==="arrest" ? "facArrest" : "facYield"));
  if(ev.choices.some(c=>c.act==="fairNo")) k = ev.choices.findIndex(c=>c.act==="fairNo");
  if(k<0) k = ev.choices.length-1;
  g.resolveEvent(k);
}
function govern(g, st, firstMonth){
  if(firstMonth || g.time.month===2){
    g.setTax(st.taille);
    for(const id of TAX_ORDER) g.setTaxLevel(id, st[id]);
  }
  staff(g);
  // des maisons tant qu'il en faut ; des agrandissements et des vêtements pour que les maisons montent de niveau
  if(g.freeBurgages()<2 && g.freeStock("timber")>=4){ put(g, "burgage", true); put(g, "burgage", true); g.rehouseCamp(); }
  for(const b of g.buildings) if(b.def==="burgage" && b.done && !b.exts.length && g.families.some(f=>f.home===b.id)) g.buyExtension(b.id, b.id%2 ? "garden" : "chicken");
  g.stock.clothes = Math.max(g.stock.clothes, g.families.length*2);
  // un vrai joueur agrandit ses cultures avec le village : une ferme et deux champs pour huit familles, etc.
  if(g.time.month===1){
    const n = (d)=>g.buildings.filter(b=>b.def===d).length, fam = g.families.length;
    if(n("farm") < Math.ceil(fam/8)){ put(g, "farm", true); put(g, "field", true); put(g, "field", true); }
    if(n("forager") < Math.ceil(fam/8)) put(g, "forager", true);
    if(n("hunter") < Math.ceil(fam/10)) put(g, "hunter", true);
    if(n("woodcutter") < Math.ceil(fam/6)) put(g, "woodcutter", true);
    for(const b of g.buildings) if(b.def==="field" && b.f && b.f.crop==="peas" && !b.f.sown) b.f.crop = "wheat";
  }
  // un chantier de temps en temps (la corvée a de quoi faire)
  if(g.time.month%4===0 && !g.buildings.some(b=>!b.done)) put(g, "storehouse", false);
  // le conseil
  if(st.council) for(const id of SEAT_ORDER){
    if(!g.seatOpen(id) || g.seatHolder(id)) continue;
    const c = g.seatCandidates(id, 1)[0];
    if(c && g.families.length>=5) g.appoint(id, c.id);
  }
  if(st.council && g.council.steward.known) g.punishSteward();
  if(st.council && g.seatHolder("steward") && g.influence>40 && g.time.month===6) g.audit();
  // les lois voulues, une à la fois
  for(const id of Object.keys(st.laws)) if(g.law(id)!==st.laws[id] && g.influence>=30){ g.proclaim(id, st.laws[id]); break; }
  if(st.ennoble && g.influence>=70) for(const f of g.families) if(!g.canEnnoble(f)){ g.ennoble(f.id); break; }
  if(st.feast && g.time.month===7) g.giveFeast();
  if(st.alms && g.treasury>60 && g.time.month%3===0) g.giveAlms();
  // la faction : le tyran arrête, l'équilibré cède quand elle fait grève
  if(g.faction && st.ultimatum==="arrest" && g.faction.known) g.arrestLeader();
  if(g.faction && st===STYLES.equilibre && g.faction.power>=40) g.factionYield();
  // les secrets
  for(const v of g.villagers) if(v.sk===1) g.useSecret(v.id, st===STYLES.tyran ? "denounce" : st===STYLES.doux ? "forgive" : "press");
  judgeAll(g, st.judge);
  answerAll(g, st.petitions);
  // le changeur : on rembourse dès qu'on peut ; on emprunte si le trésor est vide avant l'impôt du roi
  if(g.fisc.debt>0 && g.treasury>g.fisc.debt+30) g.repay(g.fisc.debt);
  if(g.time.month===9 && g.treasury<20 && st!==STYLES.negligent) g.borrow(50);
}

/* ---------- vérifications ---------- */
function fin2(x){ return typeof x==="number" && isFinite(x); }
function check(g){
  const bad = [];
  for(const k of ["treasury","approval","influence","wealth","taxRate"]) if(!fin2(g[k])) bad.push(k+" = "+g[k]);
  if(g.approval<0 || g.approval>100) bad.push("approbation hors bornes : "+g.approval);
  for(const k of Object.keys(g.stock)) if(!fin2(g.stock[k]) || g.stock[k]< -1e-6) bad.push("stock."+k+" = "+g.stock[k]);
  for(const k of Object.keys(g.fisc)) if(typeof g.fisc[k]==="number" && !fin2(g.fisc[k])) bad.push("fisc."+k);
  for(const k of ["gen","sev","just"]) if(!fin2(g.rep[k])) bad.push("rep."+k);
  for(const k of Object.keys(g.book.cur)) if(!BOOK_CATS[k] || !fin2(g.book.cur[k])) bad.push("livre : "+k);
  const vIds = new Set(), fIds = new Set(g.families.map(f=>f.id));
  for(const v of g.villagers){
    if(vIds.has(v.id)) bad.push("villageois en double "+v.id); vIds.add(v.id);
    if(!fIds.has(v.fam)) bad.push("villageois sans famille "+v.id);
    if(v.seat && (!g.council[v.seat] || g.council[v.seat].vid!==v.id)) bad.push("siège incohérent "+v.id);
    const b = v.work>0 ? g.buildings.find(x=>x.id===v.work) : null;
    if(b && !v.appr && g.isNoble(v)) bad.push("un noble travaille : "+g.fullName(v));
    if(b && !v.appr && b.done && SKILLED.includes(b.def) && g.ordOf(v)==="serf") bad.push("un serf tient un métier d'artisan : "+g.fullName(v)+" ("+b.def+")");
    if(v.seat && v.work>0) bad.push("un conseiller a un poste : "+g.fullName(v));
  }
  for(const id of SEAT_ORDER){ const c = g.council[id]; if(c.vid>0 && !vIds.has(c.vid)) bad.push("siège "+id+" tenu par un absent"); }
  for(const f of g.families){
    for(const x of (f.mem||[])) if(!fin2(x.v) || !fin2(x.m)) bad.push("souvenir invalide "+f.name);
    if(!["serf","bourg","noble"].includes(f.ord)) bad.push("ordre inconnu "+f.name+" : "+f.ord);
    if(!fin2(g.famOpinion(f))) bad.push("opinion invalide "+f.name);
  }
  if(g.faction){
    if(!vIds.has(g.faction.leader)) bad.push("meneur absent");
    if(g.faction.fams.some(id=>!fIds.has(id))) bad.push("famille de faction absente");
  }
  for(const c of g.cases) if(!fIds.has(c.a)) bad.push("affaire sans famille");
  for(const p of g.petitions) if(!fIds.has(p.f)) bad.push("pétition sans famille");
  return bad;
}

function diff(x, y, p, out){
  if(out.length>5) return;
  if(typeof x!==typeof y || Array.isArray(x)!==Array.isArray(y) || (x===null)!==(y===null)){ out.push(p+" : "+String(JSON.stringify(x)).slice(0, 60)+" ≠ "+String(JSON.stringify(y)).slice(0, 60)); return; }
  if(x && typeof x==="object"){ for(const k of new Set([...Object.keys(x), ...Object.keys(y)])) diff(x[k], y[k], p+"."+k, out); return; }
  if(x!==y) out.push(p+" : "+x+" ≠ "+y);
}

/* ---------- une partie ---------- */
function play(styleName, seed, mode){
  const st = STYLES[styleName];
  let g = new GameState(seed, mode, "normal");
  // départ : un petit domaine déjà équipé (la campagne teste l'administration, pas les premiers mois)
  for(const k of FOOD_TYPES) g.stock[k] = Math.max(g.stock[k], 30);
  g.stock.firewood = 80; g.stock.grain = 40;
  for(let k=0;k<4;k++) put(g, "burgage", true);
  g.rehouseCamp();
  for(const d of ["woodcutter","woodcutter","forager","hunter","farm","field","field","quarry","windmill","bakery","market","granary","church","manor","trade","storehouse"]) put(g, d, true);
  for(const b of g.buildings) if(b.def==="field" && b.f){ b.f.crop = "wheat"; }
  g.treasury = 40;
  const stats = [], issues = [];
  let crashed = null;
  try{
    for(let y=0; y<YEARS; y++){
      for(let m=0; m<12; m++){
        govern(g, st, y===0 && m===0);
        for(let i=0;i<MONTH;i++){
          g.step();
          if(g.pendingEvent) resolveEvent(g, st);
          if(g.defeat) break;
        }
        const bad = check(g);
        if(bad.length) issues.push(g.time.year+"/"+(g.time.month+1)+" : "+bad.slice(0, 4).join(" ; "));
        if(g.defeat) break;
      }
      const year = g.bookYear();
      stats.push({ y:g.time.year, fam:g.families.length, pop:g.villagers.length, ap:g.approval, tr:Math.round(g.treasury), inf:Math.round(g.influence),
        debt:Math.round(g.fisc.debt), taille:Math.round(year.taille||0), peage:Math.round(year.peage||0), trade:Math.round(year.trade||0),
        bourg:g.families.filter(f=>f.ord==="bourg").length, noble:g.families.filter(f=>f.ord==="noble").length,
        seats:SEAT_ORDER.filter(id=>g.seatHolder(id)).length, gen:Math.round(g.rep.gen), sev:Math.round(g.rep.sev), just:Math.round(g.rep.just) });
      if(g.defeat) break;
      // sauvegarde, rechargement, et l'on continue avec la partie rechargée
      const data = JSON.parse(JSON.stringify(g.serialize()));
      const g2 = GameState.load(data);
      const again = JSON.stringify(g2.serialize());
      const out = []; diff(data, JSON.parse(again), "", out);   // (l'ordre des clés peut changer : seul le contenu compte)
      if(out.length) issues.push(g.time.year+" : la sauvegarde rechargée diffère : "+out.slice(0, 3).join(" ; "));
      g = g2;
    }
  }catch(e){ crashed = e.stack.split("\n").slice(0, 4).join(" | "); }
  return { stats, issues, crashed, defeat:g.defeat ? g.endReason : null, chronicle:g.chronicle.length };
}

/* ---------- la campagne ---------- */
const t0 = Date.now();
const report = {};
let problems = 0;
for(const style of Object.keys(STYLES)){
  if(ONLY && ONLY!==style && ONLY!=="tous") continue;
  report[style] = [];
  for(let s=0; s<SEEDS; s++){
    C = { cases:0, expired:0, petitions:0, judged:0, granted:0, refused:0, factions:0, ultimatums:0, jacqueries:0, yields:0, arrests:0,
          departures:0, ennobled:0, laws:0, seizures:0, deaths:{} };
    const mode = s%2 ? "peace" : "prosperity";
    const r = play(style, 1176 + 97*s, mode);
    r.counts = C; r.mode = mode;
    report[style].push(r);
    if(r.crashed || r.issues.length) problems++;
    const last = r.stats[r.stats.length-1] || {};
    console.log(style.padEnd(10)+" graine "+s+" ("+mode+") : "+(r.crashed ? "PLANTAGE " + r.crashed : r.defeat ? "défaite ("+r.defeat+") en "+last.y : "fin "+last.y)
      +" · "+last.fam+" familles · appro "+last.ap+" · trésor "+last.tr+" · "+r.issues.length+" anomalie(s)");
    for(const i of r.issues.slice(0, 5)) console.log("    ! "+i);
  }
}
console.log("\n=== Bilan par manière de gouverner (moyenne sur "+SEEDS+" parties de "+YEARS+" ans) ===");
for(const style of Object.keys(report)){
  const rs = report[style], n = rs.length;
  const avg = (f)=>Math.round(rs.reduce((s, r)=>s + f(r), 0)/n*10)/10;
  const lastS = (r)=>r.stats[r.stats.length-1] || {};
  const perY = (k)=>avg(r=>r.counts[k]/Math.max(1, r.stats.length));
  console.log("\n"+style.toUpperCase());
  console.log("  fin : "+avg(r=>lastS(r).fam)+" familles, "+avg(r=>lastS(r).pop)+" habitants, approbation "+avg(r=>lastS(r).ap)+", trésor "+avg(r=>lastS(r).tr)+", dette "+avg(r=>lastS(r).debt)+", influence "+avg(r=>lastS(r).inf));
  console.log("  ordres : "+avg(r=>lastS(r).bourg)+" bourgeoises, "+avg(r=>lastS(r).noble)+" nobles · conseil "+avg(r=>lastS(r).seats)+"/4");
  console.log("  dernière année : taille "+avg(r=>lastS(r).taille)+", péages "+avg(r=>lastS(r).peage)+", comptoir "+avg(r=>lastS(r).trade));
  console.log("  réputation : générosité "+avg(r=>lastS(r).gen)+", sévérité "+avg(r=>lastS(r).sev)+", justice "+avg(r=>lastS(r).just));
  console.log("  par an : affaires "+perY("cases")+" (closes sans jugement "+perY("expired")+"), pétitions "+perY("petitions")+", factions "+perY("factions")+", ultimatums "+perY("ultimatums")+", jacqueries "+perY("jacqueries")+", départs "+perY("departures"));
  console.log("  en tout : lois "+avg(r=>r.counts.laws)+", anoblissements "+avg(r=>r.counts.ennobled)+", arrestations "+avg(r=>r.counts.arrests)+", concessions "+avg(r=>r.counts.yields)+", saisies "+avg(r=>r.counts.seizures)+", entrées de chronique "+avg(r=>r.chronicle));
  const deaths = {}; for(const r of rs) for(const k of Object.keys(r.counts.deaths)) deaths[k] = (deaths[k]||0) + r.counts.deaths[k]/n;
  console.log("  décès (moyenne par partie) : "+Object.keys(deaths).map(k=>k+" "+Math.round(deaths[k]*10)/10).join(", "));
}
console.log("\n"+(problems ? problems+" partie(s) avec anomalies ou plantage" : "Aucune anomalie")+" · "+Math.round((Date.now()-t0)/1000)+" s");
if(problems) process.exitCode = 1;
