"use strict";
/* Test de l'interface de l'étape 7 dans un vrai navigateur, au format téléphone (nécessite Playwright).
   Une partie est préparée puis jouée deux ans ; on ouvre chaque panneau de l'administration et l'on touche
   chacun de ses boutons, en surveillant les erreurs de la page. Des captures sont écrites dans le dossier donné.
   Lancer avec : node test/ui.smoke.js [dossier des captures] */
const path = require("path");
const { chromium, devices } = require("playwright");
const OUT = process.argv[2] || null;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if(m.type()==="error") errors.push(m.text()); });
  await page.addInitScript(() => { try{ localStorage.clear(); }catch(e){} });
  await page.goto("file://" + path.resolve(__dirname, "../index.html"));
  await page.waitForTimeout(800);

  // une partie équipée, jouée deux ans en accéléré
  await page.evaluate(() => {
    const g = new GameState(1180, "peace", "normal");
    const c = g.buildings.find(b=>b.def==="camp");
    const put = (def)=>{ g.stock.timber = 99; g.stock.stone = 99;
      for(let r=2; r<30; r++) for(let dy=-r; dy<=r; dy++) for(let dx=-r; dx<=r; dx++){
        if(Math.max(Math.abs(dx), Math.abs(dy))!==r) continue;
        if(g.place(def, c.x+dx, c.y+dy)===null){ const b = g.buildings[g.buildings.length-1]; b.done = true; b.progress = 1; delete b.mat; return b; }
      } };
    for(let k=0;k<8;k++) put("burgage");
    g.rehouseCamp();
    ["woodcutter","forager","hunter","farm","field","windmill","bakery","market","granary","church","manor","trade"].forEach(put);
    for(const k of FOOD_TYPES) g.stock[k] = 40;
    g.stock.firewood = 120; g.stock.clothes = 60; g.treasury = 120; g.influence = 200;
    g.setTax(0.25); g.setTaxLevel("dime", 2); g.setTaxLevel("peage", 1); g.setTaxLevel("corvee", 1);
    const M = TICKS_PER_DAY*DAYS_PER_MONTH;
    for(let m=0; m<24; m++){
      for(const b of g.buildings){ const d = BUILD_DEFS[b.def]; if(d && d.fam>0 && b.done) b.want = d.fam; }
      g.fillJobs();
      g.stock.clothes = Math.max(g.stock.clothes, 2*g.families.length);
      if(g.freeBurgages()<2) { put("burgage"); put("burgage"); }
      for(let i=0;i<M;i++){ g.step(); if(g.pendingEvent) g.resolveEvent(g.pendingEvent.choices.findIndex(x=>!x.disabled) >= 0 ? g.pendingEvent.choices.findIndex(x=>!x.disabled) : 0); }
    }
    // de quoi remplir chaque panneau : des affaires, des pétitions, une faction, un secret, une maison de niveau 3
    while(g.cases.length<3 && g.newCase());
    while(g.petitions.length<2 && g.newPetition());
    const ads = g.villagers.filter(v=>g.isAdult(v) && !v.seat);
    if(!g.faction && g.families.length>=2) g.faction = { leader:ads[0].id, fams:[ads[0].fam, g.families.find(f=>f.id!==ads[0].fam).id], demand:"taille", power:55, known:false, warned:1 };
    const sv = g.villagers.find(v=>g.secretOf(v)); if(sv) sv.sk = 1;
    const h = g.buildings.find(b=>b.def==="burgage" && b.done && g.families.some(f=>f.home===b.id)); h.lvl = 3;
    g.influence = 300; g.treasury = 300;
    game = g; uiMenu = false; window.__h = h.id; window.__sv = sv ? sv.id : null;
    centerCam(); renderUI();
  });

  const sheets = ["realm","book","council","laws","justice","plots","chronicle"];
  let clicks = 0;
  const shot = async (name)=>{ if(OUT) await page.screenshot({ path: path.join(OUT, name+".png") }); };
  // touche chaque bouton d'un panneau (en relisant la liste après chaque toucher, le panneau se redessine)
  async function tapAll(open, skip){
    for(let i=0;i<40;i++){
      await page.evaluate(open);
      await page.waitForTimeout(60);
      const acts = await page.$$eval("#sheet [data-act]", els => els.map(e => e.getAttribute("data-act")+"|"+(e.getAttribute("data-arg")||"")));
      const todo = acts.filter(a => !skip.some(s => a.startsWith(s)));
      if(i>=todo.length) break;
      const [act, arg] = todo[i].split("|");
      const sel = "#sheet [data-act='"+act+"']"+(arg ? "[data-arg='"+arg+"']" : ":not([data-arg])");
      const el = await page.$(sel);
      if(el){ await el.scrollIntoViewIfNeeded().catch(()=>{}); await el.click({ timeout:2000 }).catch(()=>{}); clicks++; }
    }
  }
  const skip = ["closesheet","sheet|realm","modal","mainmenu","demolish"];
  for(const s of sheets){
    await page.evaluate((s)=>{ ui.selId = null; ui.selV = null; ui.sheet = s; renderUI(); }, s);
    await page.waitForTimeout(150);
    await shot("ui-"+s);
    await tapAll(new Function("ui.selId = null; ui.selV = null; ui.sheet = '"+s+"'; renderUI();"), skip.concat(["sheet|"]));
  }
  // le manoir (redevances), la maison de niveau 3 (anoblissement), le villageois au secret, un noble
  await page.evaluate(()=>{ ui.sheet = null; ui.selV = null; ui.selId = game.buildings.find(b=>b.def==="manor").id; renderUI(); });
  await shot("ui-manor");
  await tapAll(()=>{ ui.sheet = null; ui.selV = null; ui.selId = game.buildings.find(b=>b.def==="manor").id; renderUI(); }, skip.concat(["sheet|"]));
  await tapAll(()=>{ ui.sheet = null; ui.selV = null; ui.selId = window.__h; renderUI(); }, skip.concat(["sheet|","ext","vsel","bsel","assign","unassign"]));
  if(await page.evaluate(()=>window.__sv)) await tapAll(()=>{ ui.sheet = null; ui.selId = null; ui.selV = window.__sv; renderUI(); }, skip.concat(["sheet|","vjob","vassign","vappr","vsel","vlook","bsel"]));
  await page.evaluate(()=>{ const n = game.villagers.find(v=>game.isNoble(v) && game.isAdult(v)); window.__n = n ? n.id : null; });
  if(await page.evaluate(()=>window.__n)){ await tapAll(()=>{ ui.sheet = null; ui.selId = null; ui.selV = window.__n; renderUI(); }, skip.concat(["sheet|","vjob","vassign","vappr","vsel","vlook","bsel"])); await shot("ui-noble"); }
  // la partie tourne avec l'interface ouverte, en accéléré
  const t0 = await page.evaluate(()=>{ ui.selId = null; ui.selV = null; ui.sheet = "justice"; game.speed = 60; renderUI(); return game.monthIdx()*16 + game.time.day; });
  await page.waitForTimeout(4000);
  const t1 = await page.evaluate(()=>game.monthIdx()*16 + game.time.day);
  if(t1<=t0) errors.push("la partie n'avance pas en accéléré");
  console.log("en 4 s à ×60 : "+(t1-t0)+" jours de jeu");
  await shot("ui-run");
  const state = await page.evaluate(()=>({ y:game.time.year, m:game.time.month, fam:game.families.length, nobles:game.families.filter(f=>f.ord==="noble").length,
    cases:game.cases.length, pet:game.petitions.length, chron:game.chronicle.length, faction:!!game.faction }));
  console.log("état final :", JSON.stringify(state));
  console.log(clicks+" boutons touchés, "+errors.length+" erreur(s)");
  for(const e of errors.slice(0, 10)) console.log("  ! "+e);
  await browser.close();
  if(errors.length) process.exitCode = 1;
})();
