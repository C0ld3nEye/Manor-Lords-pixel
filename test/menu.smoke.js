"use strict";
/* Écran d'accueil, sauvegardes, pause, fiches des bâtiments, origine des ressources et bœufs, dans un vrai navigateur
   au format téléphone (nécessite Playwright). Lancer avec : node test/menu.smoke.js [dossier des captures] */
const path = require("path");
const assert = require("assert");
const { chromium, devices } = require("playwright");
const OUT = process.argv[2] || null;
const URL = "file://" + path.resolve(__dirname, "../index.html");

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await ctx.newPage();
  const errors = [];
  let ok = 0;
  const check = (cond, msg)=>{ if(cond){ ok++; console.log("ok - "+msg); } else { errors.push(msg); console.log("ECHEC - "+msg); } };
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if(m.type()==="error") errors.push(m.text()); });
  page.on("dialog", d => d.accept("Mon fief"));
  const shot = async (n)=>{ if(OUT) await page.screenshot({ path: path.join(OUT, n+".png") }); };

  // 1) une ancienne sauvegarde (emplacement 2 de l'ancien système) est retrouvée et proposée à « Continuer »
  await page.goto(URL); await page.waitForTimeout(600);
  await page.evaluate(()=>{
    localStorage.clear();
    const g = new GameState(77, "prosperity", "easy");
    localStorage.setItem("seigneurie-save-v2-2", JSON.stringify(g.serialize()));
    localStorage.setItem("seigneurie-last-slot", "1");
  });
  await page.reload(); await page.waitForTimeout(800);
  check(await page.evaluate(()=>uiMenu && !game), "on arrive sur l'écran d'accueil");
  check(await page.evaluate(()=>activeKey==="seigneurie-save-v2-2" && saveIndex.list.length===1), "l'ancienne sauvegarde est retrouvée");
  check(await page.$("[data-act='continue']") !== null, "bouton Continuer");
  for(const a of ["new","load","options","guide"]) check(await page.$("[data-act='home'][data-arg='"+a+"']") !== null, "bouton "+a);
  await shot("m01-accueil");
  await page.click("[data-act='continue']"); await page.waitForTimeout(1500);
  check(await page.evaluate(()=>!!game && !uiMenu && game.diffId==="easy"), "Continuer charge la partie");

  // 2) une nouvelle partie s'ajoute à côté, sans rien remplacer
  await page.click("[data-act='sheet'][data-arg='menu']"); await page.click("[data-act='mainmenu']");
  await page.click("[data-act='home'][data-arg='new']");
  await page.click("[data-act='startgame']"); await page.waitForTimeout(1200);
  check(await page.evaluate(()=>saveIndex.list.length===2 && activeKey!=="seigneurie-save-v2-2"), "nouvelle partie dans une nouvelle sauvegarde");

  // 3) la pause fige tout sur la carte
  await page.evaluate(()=>{ game.speed = 1; renderUI(); }); await page.waitForTimeout(500);
  await page.click("[data-act='pause']"); await page.waitForTimeout(300);
  const a = await page.locator("#cv").screenshot(); await page.waitForTimeout(900);
  const b = await page.locator("#cv").screenshot();
  check(Buffer.compare(a, b)===0, "en pause, l'image ne bouge plus");
  check(await page.$(".pill.paused") !== null, "repère « En pause » sur la carte");
  await page.click(".pill.paused"); await page.waitForTimeout(500);
  const c1 = await page.locator("#cv").screenshot(); await page.waitForTimeout(700);
  const c2 = await page.locator("#cv").screenshot();
  check(Buffer.compare(c1, c2)!==0, "le jeu repart et la carte s'anime");

  // 4) appui long sur une carte du tiroir : la fiche, sans entrer en mode pose
  await page.click("[data-act='cat'][data-arg='res']");
  const bb = await page.locator(".card[data-arg='woodcutter']").boundingBox();
  await page.mouse.move(bb.x+20, bb.y+20); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  await page.waitForTimeout(150);
  check(await page.evaluate(()=>ui.modal==="binfo" && ui.infoId==="woodcutter" && !ui.buildSel), "fiche du camp de bûcherons");
  await shot("m02-fiche");
  await page.click("[data-act='modalclose']");
  const infos = await page.evaluate(()=>Object.keys(BUILD_INFO).map(id=>{ ui.infoId = id; ui.modal = "binfo"; renderUI(); return document.getElementById("mcard").textContent.length; }));
  check(infos.every(n=>n>80), "chaque fiche a du contenu");
  await page.evaluate(()=>{ ui.modal = null; renderUI(); });

  // 5) réserves : d'où vient chaque ressource
  await page.evaluate(()=>{ ui.cat = null; ui.sheet = "stock"; ui.stockHow = false; renderUI(); });
  await page.click("[data-act='stockhow']");
  check(await page.evaluate(()=>document.querySelectorAll("#sheet .how").length>15), "origine affichée sous les ressources");
  await shot("m03-reserves");

  // 6) les bœufs : tâche, déplacement du poteau
  await page.evaluate(()=>{ ui.sheet = "oxen"; renderUI(); });
  await page.click("[data-act='oxjob'][data-arg$=':plow']");
  check(await page.evaluate(()=>game.oxJob(game.oxen[0])==="plow"), "tâche du bœuf choisie");
  await page.evaluate(()=>{ ui.sheet = null; ui.selId = game.buildings.find(b=>b.def==="oxpost").id; renderUI(); });
  await page.click("[data-act='movepost']");
  const t = await page.evaluate(()=>{ const p = game.buildings.find(b=>b.def==="oxpost");
    for(let r=3;r<12;r++) for(let dx=-r;dx<=r;dx++){ const x=p.x+dx, y=p.y+r; if(!game.canMoveOxPost(x,y)) return { x, y }; } });
  await page.evaluate((t)=>{ ui.pendingPlace = { tx:t.x, ty:t.y }; renderUI(); }, t);
  await page.click("[data-act='placeok']");
  check(await page.evaluate((t)=>{ const p = game.buildings.find(b=>b.def==="oxpost"); return p.x===t.x && p.y===t.y; }, t), "poteau déplacé");
  await shot("m04-poteau");

  // 7) sauvegarder, garder une copie, renommer, charger, supprimer
  await page.evaluate(()=>{ cancelAll(); ui.sheet = "menu"; renderUI(); });
  await page.click("[data-act='savenow']");
  await page.click("[data-act='savecopy']");
  check(await page.evaluate(()=>saveIndex.list.length===3 && saveIndex.list.some(e=>e.copy)), "copie gardée");
  await page.click("[data-act='mainmenu']");
  await page.click("[data-act='home'][data-arg='load']");
  await page.click("[data-act='rensave'][data-arg='"+await page.evaluate(()=>activeKey)+"']");
  check(await page.evaluate(()=>entryOf(activeKey).name==="Mon fief"), "partie renommée");
  await shot("m05-charger");
  const copyKey = await page.evaluate(()=>saveIndex.list.find(e=>e.copy).key);
  await page.click("[data-act='loadsave'][data-arg='"+copyKey+"']"); await page.waitForTimeout(1500);
  check(await page.evaluate((k)=>activeKey===k && !uiMenu && game.oxJob(game.oxen[0])==="plow", copyKey), "copie chargée, avec la tâche du bœuf");
  await page.click("[data-act='sheet'][data-arg='menu']"); await page.click("[data-act='mainmenu']");
  await page.click("[data-act='home'][data-arg='load']");
  await page.click("[data-act='delsave'][data-arg='"+copyKey+"']"); await page.click("[data-act='delsave'][data-arg='"+copyKey+"']");
  check(await page.evaluate((k)=>saveIndex.list.length===2 && !localStorage.getItem(k), copyKey), "copie supprimée");

  // 8) exporter puis importer un fichier : la partie s'ajoute
  await page.click("[data-act='home'][data-arg='main']");
  await page.click("[data-act='continue']"); await page.waitForTimeout(1500);
  const n0 = await page.evaluate(()=>saveIndex.list.length);
  const err = await page.evaluate(()=>importText(exportText(game)));
  check(err===null && await page.evaluate((n)=>saveIndex.list.length===n+1 && /importée/.test(entryOf(activeKey).name), n0), "export puis import d'un fichier");
  check(await page.evaluate(()=>importText("n'importe quoi")!==null), "un mauvais fichier est refusé");

  // 9) relancer : l'index survit, Continuer reprend la dernière partie jouée
  const last = await page.evaluate(()=>{ persist(game, true); return activeKey; });
  await page.reload(); await page.waitForTimeout(800);
  check(await page.evaluate((k)=>uiMenu && activeKey===k && saveIndex.list.length>=3, last), "après relance : Continuer reprend la dernière partie");
  await page.click("[data-act='home'][data-arg='options']");
  await shot("m06-options");
  await page.click("[data-act='home'][data-arg='main']");
  await page.click("[data-act='home'][data-arg='guide']");
  check(await page.evaluate(()=>/Les bœufs/.test(document.getElementById("mcard").textContent)), "le guide s'ouvre depuis l'accueil");
  check(await page.evaluate(()=>window.seigneurieBack()==="ok" && ui.home==="main"), "Retour Android : revient à l'accueil");

  console.log("\n"+ok+" vérifications OK, "+errors.length+" erreur(s)");
  for(const e of errors.slice(0, 10)) console.log("  ! "+e);
  await browser.close();
  if(errors.length) process.exitCode = 1;
})();
