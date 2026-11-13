"use strict";
/* Étape 8 : un joueur automatique « raisonnable », qui part du vrai départ (trois familles au campement) SANS AUCUNE
   TRICHE : il trace des rues et des zones de maisons, pose les bâtiments près de leurs ressources, affecte les ouvriers,
   règle le fisc, juge, répond aux événements… comme un joueur moyen qui suit les conseils du jeu. Il ne touche jamais
   au stock ni au trésor. On mesure la courbe de la partie selon le mode et la difficulté.
   Lancer avec : node test/joueur.js [années=8] [graines=3] [modes=prosperity] [difficultés=easy,normal,hard] [--detail] */
const S = require("../js/sim.js");
const { GameState, TICKS_PER_DAY, DAYS_PER_MONTH, SKILLED } = S;
const PROFILE = process.argv.includes("--novice") ? "novice" : "bon";
const { play, resolve } = require("./bot.js")(S, PROFILE);
const YEARS = Number(process.argv[2]) || 8, SEEDS = Number(process.argv[3]) || 3;
const MODES = (process.argv[4] || "prosperity").split(",");
const DIFFS = (process.argv[5] || "easy,normal,hard").split(",");
const DETAIL = process.argv.includes("--detail");
const HALF = TICKS_PER_DAY*DAYS_PER_MONTH/2;   // le joueur passe voir son village deux fois par mois

/* ---------- une partie ---------- */
function run(seed, mode, diff){
  const g = new GameState(seed, mode, diff);
  const R = { built:{}, events:{}, deaths:{}, years:[], firstLvl2:null, firstBourg:null, starveMonths:0, gruelMonths:0, crashed:null };
  const die = g.die; g.die = function(v, cause){ R.deaths[cause] = (R.deaths[cause]||0) + 1; return die.apply(this, arguments); };
  const rf = g.removeFamily; g.removeFamily = function(){ R.departures = (R.departures||0) + 1; return rf.apply(this, arguments); };
  try{
    for(let mo=0; mo<YEARS*12; mo++){
      for(let half=0; half<2; half++){
        play(g, R);
        for(let i=0;i<HALF;i++){ g.step(); if(g.pendingEvent) resolve(g, R); if(g.defeat) break; }
        if(g.defeat) break;
      }
      if(g.families.some(f=>f.fed<0.5)) R.starveMonths++;
      R.minFood = Math.min(R.minFood===undefined ? 99 : R.minFood, g.foodMonths());
      if(g.families.some(f=>f.gruel)) R.gruelMonths++;
      const lv2 = g.buildings.filter(b=>b.def==="burgage" && b.lvl>=2).length;
      if(lv2 && R.firstLvl2===null) R.firstLvl2 = mo;
      if(g.families.some(f=>f.ord==="bourg") && R.firstBourg===null) R.firstBourg = mo;
      if(g.time.month===2 || g.defeat){
        const yr = g.bookYear();
        R.years.push({ y:g.time.year, fam:g.families.length, pop:g.villagers.length, ap:g.approval, tr:Math.round(g.treasury),
          food:Math.round(g.foodMonths()*10)/10, lv:[1,2,3].map(l=>g.buildings.filter(b=>b.def==="burgage" && b.done && b.lvl===l).length),
          bourg:g.families.filter(f=>f.ord==="bourg").length, noble:g.families.filter(f=>f.ord==="noble").length,
          inc:Math.round(Object.keys(yr).filter(k=>S.BOOK_CATS[k].inc && k!=="loan").reduce((s, k)=>s+yr[k], 0)),
          trade:Math.round(yr.trade||0), taille:Math.round(yr.taille||0), wealth:Math.round(g.wealth), inf:Math.round(g.influence),
          artisans:g.villagers.filter(v=>v.work>0 && !v.appr && g.buildings.some(b=>b.id===v.work && SKILLED.includes(b.def))).length,
          why:g.approvalWhy.filter(w=>w[1]<0).map(w=>w[0]+" "+w[1]).join(", "),
          reg:g.ownedRegions().length, goal:g.goalRegions().filter(r=>r.owned).length+"/"+g.goalRegions().length, baron:g.baron.regions.length, camps:g.camps.length, units:g.units.length });
      }
      if(g.defeat || g.victory && !R.victoryAt){ if(g.victory && !R.victoryAt) R.victoryAt = g.time.year+"/"+(g.time.month+1); }
      if(g.defeat){ R.defeat = g.endReason+" ("+g.time.year+"/"+(g.time.month+1)+")"; break; }
    }
  }catch(e){ R.crashed = e.stack.split("\n").slice(0, 4).join(" | "); }
  R.g = g;
  return R;
}

/* ---------- la campagne ---------- */
const t0 = Date.now();
for(const mode of MODES) for(const diff of DIFFS){
  const rs = [];
  for(let s=0; s<SEEDS; s++){
    const R = run(1000 + 131*s, mode, diff);
    rs.push(R);
    if(DETAIL || R.crashed){
      console.log("\n--- "+mode+" / "+diff+" / graine "+s+(R.crashed ? " PLANTAGE "+R.crashed : "")+(R.defeat ? " DÉFAITE "+R.defeat : "")+(R.victoryAt ? " victoire "+R.victoryAt : ""));
      for(const y of R.years) console.log("  "+y.y+" : "+y.fam+" fam ("+y.pop+" hab), appro "+y.ap+", trésor "+y.tr+" (recettes/an "+y.inc+", comptoir "+y.trade+", taille "+y.taille+"), vivres "+y.food+" mois, maisons "+y.lv.join("/")+", bourg. "+y.bourg+", nobles "+y.noble+", artisans "+y.artisans+", régions "+y.reg+" (voisines "+y.goal+", Baron "+y.baron+"), camps "+y.camps+", soldats "+y.units+(y.why ? " — malus : "+y.why : ""));
      console.log("  décès : "+JSON.stringify(R.deaths)+" · mois de famine "+R.starveMonths+", de bouillie "+R.gruelMonths+" · 1er niveau 2 au mois "+R.firstLvl2+" · bâti : "+JSON.stringify(R.built));
    }
  }
  const avg = (f)=>Math.round(rs.reduce((s, r)=>s + f(r), 0)/rs.length*10)/10;
  const last = (r)=>r.years[r.years.length-1] || {};
  const atY = (r, k)=>r.years[Math.min(k, r.years.length-1)] || {};
  console.log("\n=== "+mode+" / "+diff+" / joueur "+PROFILE+" ("+SEEDS+" parties de "+YEARS+" ans) ===");
  console.log("  familles : an 1 "+avg(r=>atY(r, 0).fam||0)+", an 2 "+avg(r=>atY(r, 1).fam||0)+", an 4 "+avg(r=>atY(r, 3).fam||0)+", fin "+avg(r=>last(r).fam||0)
    +" · approbation fin "+avg(r=>last(r).ap||0)+" · trésor an 4 "+avg(r=>atY(r, 3).tr||0)+", fin "+avg(r=>last(r).tr||0)+" (recettes/an "+avg(r=>last(r).inc||0)+", comptoir "+avg(r=>last(r).trade||0)+")");
  console.log("  maisons fin (niv. 1/2/3) : "+[0,1,2].map(i=>avg(r=>(last(r).lv||[0,0,0])[i])).join("/")+" · bourgeoises "+avg(r=>last(r).bourg||0)+" · artisans "+avg(r=>last(r).artisans||0)+" · 1er niveau 2 au mois "+avg(r=>r.firstLvl2===null ? YEARS*12 : r.firstLvl2));
  console.log("  vivres au plus bas "+avg(r=>Math.round((r.minFood||0)*10)/10)+" mois · départs "+avg(r=>r.departures||0)+" · mois de famine "+avg(r=>r.starveMonths)+", de bouillie "+avg(r=>r.gruelMonths)+" · décès de faim "+avg(r=>r.deaths["de faim"]||0)+", de froid "+avg(r=>r.deaths["de froid"]||0)+", de maladie "+avg(r=>r.deaths["de maladie"]||0)
    +" · défaites "+rs.filter(r=>r.defeat).length+", victoires "+rs.filter(r=>r.victoryAt).length+" ("+rs.filter(r=>r.victoryAt).map(r=>r.victoryAt).join(", ")+"), plantages "+rs.filter(r=>r.crashed).length);
  const ev = {}; for(const r of rs) for(const k of Object.keys(r.events)) ev[k] = (ev[k]||0) + r.events[k]/rs.length;
  console.log("  événements par partie : "+Object.keys(ev).map(k=>k+" "+Math.round(ev[k]*10)/10).join(", "));
}
console.log("\n"+Math.round((Date.now()-t0)/1000)+" s");
