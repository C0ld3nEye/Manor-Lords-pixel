/* ================= APPLICATION MOBILE ================= */
/* ============ SEIGNEURIE — application mobile (vanilla JS) ============ */
var SAVE_SLOTS = ["seigneurie-save-v2-1","seigneurie-save-v2-2","seigneurie-save-v2-3"];
var SAVE_KEY = SAVE_SLOTS[0];
var activeSlot = 0;
function persist(g){ try{ window.localStorage.setItem(SAVE_SLOTS[activeSlot], JSON.stringify(g.serialize())); }catch(e){} }
function persistSlot(g, i){ try{ window.localStorage.setItem(SAVE_SLOTS[i], JSON.stringify(g.serialize())); }catch(e){} }
function loadSlot(i){ try{ var r=window.localStorage.getItem(SAVE_SLOTS[i]); return r?GameState.load(JSON.parse(r)):null; }catch(e){ return null; } }
function slotInfo(i){ var g=loadSlot(i); return g?{mode:g.mode().name, diff:g.diff().name, date:g.time.month+"/"+g.time.year, pop:g.families.length, victory:g.victory, defeat:g.defeat}:null; }
function encodeSave(g){ try{ return btoa(unescape(encodeURIComponent(JSON.stringify(g.serialize())))); }catch(e){ return ""; } }
function decodeSave(code){ try{ return GameState.load(JSON.parse(decodeURIComponent(escape(atob(code.trim()))))); }catch(e){ return null; } }

/* ----- partie (restaurée depuis l'appareil si possible) ----- */
var game = null;
var uiMenu = false; // écran de démarrage (choix mode/slot)
try{
  var _last = window.localStorage.getItem("seigneurie-last-slot");
  if(_last!==null){ activeSlot = Math.max(0, Math.min(2, Number(_last)||0)); }
  game = loadSlot(activeSlot);
}catch(e){}
if(game){ SAVE_KEY = SAVE_SLOTS[activeSlot]; }
else { uiMenu = true; }

var cam = { x:0, y:0, zoom:1.6 };
function centerCam(){
  var b = game.buildings[0];
  if(b){ cam.x = b.x + b.w/2; cam.y = b.y + b.h/2; }
}
centerCam();

var ui = { buildSel:null, selId:null, helpOpen:false, flash:null, taxDrag:false, logOpen:false, roadMode:false, regionsOpen:false,
  layers:{ forest:false, stone:false, berry:false, soil:false } };
function esc(str){
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function flash(msg){
  ui.flash = msg;
  if(ui._ft) clearTimeout(ui._ft);
  ui._ft = setTimeout(function(){ ui.flash = null; renderUI(); }, 1800);
}

/* ----- éléments ----- */
var canvas = document.getElementById("cv");
var wrap = document.getElementById("mapwrap");
var hud = document.getElementById("hud");
var overlay = document.getElementById("overlay");
var buildbar = document.getElementById("buildbar");
var tileinfo = document.getElementById("tileinfo");
var ctx = canvas.getContext("2d");
var dpr = Math.min(2, window.devicePixelRatio || 1);

function resize(){
  var r = wrap.getBoundingClientRect();
  if(r.width<10 || r.height<10) return;
  canvas.width = Math.floor(r.width*dpr);
  canvas.height = Math.floor(r.height*dpr);
  canvas.style.width = r.width+"px";
  canvas.style.height = r.height+"px";
}
window.addEventListener("resize", resize);
resize();

/* ----- entrées : pointeurs (drag / pinch / clic / minimap) ----- */
var pointers = new Map();
var pinch = null;
var drag = { down:false, sx:0, sy:0, cx:0, cy:0, moved:false };
var keys = new Set();
var hover = { tx:-1, ty:-1, inside:false };

function toWorld(clientX, clientY){
  var r = canvas.getBoundingClientRect();
  var wx = cam.x + (clientX - r.left - r.width/2)/(16*cam.zoom);
  var wy = cam.y + (clientY - r.top - r.height/2)/(16*cam.zoom);
  return { wx:wx, wy:wy, tx:Math.floor(wx), ty:Math.floor(wy) };
}

canvas.addEventListener("pointerdown", function(e){
  if(canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if(pointers.size===2){
    var pts = [];
    pointers.forEach(function(p){ pts.push(p); });
    var dist = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
    var w = toWorld((pts[0].x+pts[1].x)/2, (pts[0].y+pts[1].y)/2);
    pinch = { dist:dist, zoom:cam.zoom, wx:w.wx, wy:w.wy };
    drag.down = false; drag.moved = true;
    return;
  }
  drag.down = true; drag.moved = false;
  drag.sx = e.clientX; drag.sy = e.clientY;
  drag.cx = cam.x; drag.cy = cam.y;
});

canvas.addEventListener("pointermove", function(e){
  if(pointers.has(e.pointerId)) pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
  /* pincement : zoom à deux doigts */
  if(pointers.size>=2 && pinch){
    var pts2 = [];
    pointers.forEach(function(p){ pts2.push(p); });
    var dist2 = Math.hypot(pts2[0].x-pts2[1].x, pts2[0].y-pts2[1].y);
    var z = Math.max(0.7, Math.min(4, pinch.zoom * dist2/Math.max(20, pinch.dist)));
    cam.zoom = z;
    var r = canvas.getBoundingClientRect();
    var mx = (pts2[0].x+pts2[1].x)/2, my = (pts2[0].y+pts2[1].y)/2;
    cam.x = Math.max(-4, Math.min(W+4, pinch.wx - (mx - r.left - r.width/2)/(16*z)));
    cam.y = Math.max(-4, Math.min(H+4, pinch.wy - (my - r.top - r.height/2)/(16*z)));
    return;
  }
  /* survol (titre de tuile, aperçu de pose) */
  var w = toWorld(e.clientX, e.clientY);
  var inside = w.tx>=0 && w.ty>=0 && w.tx<W && w.ty<H;
  if(hover.tx!==w.tx || hover.ty!==w.ty || hover.inside!==inside){
    hover.tx = w.tx; hover.ty = w.ty; hover.inside = inside;
    if(inside && e.pointerType==="mouse"){
      var hb = game.buildingAt(w.tx, w.ty);
      tileinfo.textContent = hb ? BUILD_DEFS[hb.def].name+" — "+game.workStatus(hb) : game.tileName(w.tx, w.ty);
    } else if(!inside){
      tileinfo.textContent = "";
    }
  }
  /* glissement : déplacement de la caméra */
  if(drag.down){
    var dx = e.clientX-drag.sx, dy = e.clientY-drag.sy;
    if(Math.abs(dx)+Math.abs(dy)>7) drag.moved = true;
    if(drag.moved){
      var rr = canvas.getBoundingClientRect();
      cam.x = Math.max(-4, Math.min(W+4, drag.cx - dx/(16*cam.zoom)));
      cam.y = Math.max(-4, Math.min(H+4, drag.cy - dy/(16*cam.zoom)));
    }
  }
});

function endPointer(e){
  pointers.delete(e.pointerId);
  if(pointers.size<2) pinch = null;
  drag.down = false;
}

canvas.addEventListener("pointerup", function(e){
  endPointer(e);
  if(drag.moved) return;
  if(pointers.size>0) return;
  /* clic sur la minimap : recentrage */
  var mm = game.mmRect;
  if(mm){
    var r = canvas.getBoundingClientRect();
    var px = e.clientX - r.left, py = e.clientY - r.top;
    if(px>=mm.x-6 && px<=mm.x+mm.w+6 && py>=mm.y-6 && py<=mm.y+mm.h+6){
      cam.x = Math.max(-4, Math.min(W+4, (px-mm.x)/mm.ppt));
      cam.y = Math.max(-4, Math.min(H+4, (py-mm.y)/mm.ppt));
      return;
    }
  }
  /* clic : pose ou sélection */
  var w = toWorld(e.clientX, e.clientY);
  if(w.tx<0||w.ty<0||w.tx>=W||w.ty>=H) return;
  if(ui.roadMode){
    if(!game.toggleRoad(w.tx, w.ty)) flash("Impossible de tracer une route ici.");
  }
  else if(ui.buildSel){
    var err = game.place(ui.buildSel, w.tx, w.ty);
    if(err) flash(err);
    else if(ui.buildSel==="manor"||ui.buildSel==="church"||ui.buildSel==="windmill") ui.buildSel = null;
  } else {
    var b = game.buildingAt(w.tx, w.ty);
    ui.selId = b ? b.id : null;
  }
  renderUI();
});
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("wheel", function(e){
  e.preventDefault();
  var z = cam.zoom * (e.deltaY>0 ? 0.88 : 1.14);
  cam.zoom = Math.max(0.7, Math.min(4, z));
}, { passive:false });
canvas.addEventListener("contextmenu", function(e){
  e.preventDefault();
  ui.buildSel = null; ui.selId = null;
  renderUI();
});

/* ----- clavier : pause, vitesse, ZQSD/WASD/flèches ----- */
window.addEventListener("pointerdown", function(){ AudioFX.init(); }, { once:false });
window.addEventListener("keydown", function(e){
  AudioFX.init();
  if(e.key===" "){ e.preventDefault(); game.speed = game.speed===0 ? 1 : 0; }
  if(e.key==="m"){ AudioFX.muted = !AudioFX.muted; flash(AudioFX.muted ? "Son coupé" : "Son activé"); }
  if(e.key==="Escape"){ ui.buildSel = null; ui.selId = null; ui.helpOpen = false; ui.roadMode = false; renderUI(); }
  if(e.key==="1") game.speed = 1;
  if(e.key==="2") game.speed = 2;
  if(e.key==="3") game.speed = 4;
  var k = e.key.toLowerCase();
  if(["arrowup","arrowdown","arrowleft","arrowright","z","q","s","d","w","a"].indexOf(k)>=0){
    e.preventDefault();
    keys.add(k);
  }
});
window.addEventListener("keyup", function(e){ keys.delete(e.key.toLowerCase()); });

/* ----- clics UI (délégation) ----- */
document.addEventListener("pointerdown", function(e){
  if(e.target && e.target.id==="taxSlider") ui.taxDrag = true;
});
document.addEventListener("pointerup", function(){ ui.taxDrag = false; });

document.addEventListener("click", function(e){
  var el = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
  if(!el) return;
  var act = el.getAttribute("data-act");
  var arg = el.getAttribute("data-arg");
  if(act && act!=="noop") AudioFX.click();
  if(act==="speed"){ game.speed = Number(arg); }
  else if(act==="build"){ ui.buildSel = (ui.buildSel===arg ? null : arg); ui.selId = null; }
  else if(act==="selclose"){ ui.selId = null; }
  else if(act==="assign"){ if(ui.selId!=null) game.assign(ui.selId); }
  else if(act==="unassign"){ if(ui.selId!=null) game.unassign(ui.selId); }
  else if(act==="ext"){ if(ui.selId!=null) game.buyExtension(ui.selId, arg); }
  else if(act==="demolish"){ if(ui.selId!=null){ game.demolish(ui.selId); ui.selId = null; } }
  else if(act==="resolve"){ game.resolveEvent(Number(arg)); }
  else if(act==="help"){ ui.helpOpen = true; }
  else if(act==="helpclose"){ ui.helpOpen = false; }
  else if(act==="road"){ ui.roadMode = !ui.roadMode; if(ui.roadMode){ ui.buildSel=null; ui.selId=null; } }
  else if(act==="buyox"){ game.buyOx(); }
  else if(act==="crop"){ if(ui.selId!=null) game.setCrop(ui.selId, arg); }
  else if(act==="fieldsize"){ game.setFieldSize(Number(arg)); }
  else if(act==="layer"){ ui.layers[arg] = !ui.layers[arg]; }
  else if(act==="militia"){ game.raiseMilitia(); }
  else if(act==="merc"){ game.hireMercenary(); }
  else if(act==="policy"){ game.setPolicy(arg, !game.policies[arg]); }
  else if(act==="churchup"){ if(ui.selId!=null) game.churchUp(ui.selId, arg); }
  else if(act==="regions"){ ui.regionsOpen = true; }
  else if(act==="regionsclose"){ ui.regionsOpen = false; }
  else if(act==="claim"){ game.claimRegion(Number(arg)); }
  else if(act==="log"){ ui.logOpen = true; }
  else if(act==="logclose"){ ui.logOpen = false; }
  else if(act==="noop"){ return; } /* clic à l'intérieur d'une modale : ne rien faire */
  else if(act==="mute"){ AudioFX.init(); AudioFX.muted = !AudioFX.muted; }
  else if(act==="new"){ uiMenu = true; }
  else if(act==="menuclose"){ uiMenu = false; if(!game){ uiMenu = true; } }
  else if(act==="startgame"){
    var mid = el.getAttribute("data-mode") || "prosperity";
    var did = el.getAttribute("data-diff") || "normal";
    var slot = Number(el.getAttribute("data-slot")||activeSlot);
    game = new GameState(Math.floor(Math.random()*2000000000), mid, did);
    activeSlot = Math.max(0, Math.min(2, slot));
    SAVE_KEY = SAVE_SLOTS[activeSlot];
    try{ window.localStorage.setItem("seigneurie-last-slot", String(activeSlot)); }catch(e2){}
    persist(game);
    ui.selId = null; ui.buildSel = null; uiMenu = false;
    centerCam();
  }
  else if(act==="loadslot"){
    var g2 = loadSlot(Number(arg));
    if(g2){ game = g2; activeSlot = Number(arg); SAVE_KEY = SAVE_SLOTS[activeSlot];
      try{ window.localStorage.setItem("seigneurie-last-slot", String(activeSlot)); }catch(e2){}
      ui.selId = null; ui.buildSel = null; uiMenu = false; centerCam(); }
  }
  else if(act==="delslot"){
    try{ window.localStorage.removeItem(SAVE_SLOTS[Number(arg)]); }catch(e2){}
    if(Number(arg)===activeSlot && game){ persist(game); }
  }
  else if(act==="saveCode"){
    var code = encodeSave(game);
    window.prompt("Votre code de sauvegarde — copiez-le :", code);
  }
  else if(act==="loadCode"){
    var s = window.prompt("Collez un code de sauvegarde :");
    if(s){
      var ng = decodeSave(s);
      if(ng){
        game = ng; persist(game);
        ui.selId = null; ui.buildSel = null;
        centerCam();
        flash("Partie chargée !");
      } else flash("Code invalide.");
    }
  }
  renderUI();
});

/* curseur d'impôt (le manoir sélectionné) */
document.addEventListener("input", function(e){
  if(e.target && e.target.id==="taxSlider"){
    game.setTax(Number(e.target.value)/100);
  }
});

/* ----- rendu de l'interface (toutes les ~300 ms) ----- */
function renderUI(){
  var g = game;
  var season = g.season();
  var seasonIcon = ["❄️","🌷","☀️","🍂"][season];
  var apCol = g.approval>=60 ? "#7bd88f" : g.approval>=40 ? "#e8c35a" : "#e86a5a";
  var homeless = g.families.filter(function(f){ return f.home<0; }).length;

  /* barre du haut */
  var h = "";
  h += "<span class='ttl'>🏰 SEIGNEURIE</span>";
  h += "<span class='chip'>"+MONTHS[g.time.month]+" "+g.time.year+" "+seasonIcon+"</span>";
  h += "<span class='chip' title='Niveau de la seigneurie'>"+esc(g.settlementName())+"</span>";
  var wIcon = { clear:"\u2600\ufe0f", rain:"\ud83c\udf27\ufe0f", snow:"\ud83c\udf28\ufe0f", fog:"\ud83c\udf2b\ufe0f" }[g.weather] || "\u2600\ufe0f";
  h += "<span class='chip' title='Météo'>"+wIcon+"</span>";
  h += "<span class='chip'>💰 "+Math.floor(g.treasury)+"</span>";
  h += "<span class='chip' style='color:"+apCol+"'>😊 "+g.approval+"%</span>";
  h += "<span class='chip'>👨‍👩‍👧 "+g.families.length+(homeless>0 ? " (!"+homeless+")" : "")+"</span>";
  h += "<div class='res'>";
  var resList = [["timber",g.stock.timber],["firewood",g.stock.firewood],["stone",g.stock.stone],
                 ["berries",g.stock.berries],["meat",g.stock.meat],["grain",g.stock.grain],
                 ["bread",g.stock.bread],["eggs",g.stock.eggs],["veg",g.stock.veg],
                 ["apples",g.stock.apples],["honey",g.stock.honey],
                 ["clothes",g.stock.clothes],["ale",g.stock.ale],["barley",g.stock.barley],["ox",g.stock.ox]];
  for(var ri=0;ri<resList.length;ri++) h += "<span class='chip small'>"+RES_ICONS[resList[ri][0]]+" "+Math.floor(resList[ri][1])+"</span>";
  h += "</div>";
  h += "<div class='spacer'></div>";
  var speeds = [[0,"⏸"],[1,"▶"],[2,"⏩2"],[4,"⏩4"]];
  for(var si=0;si<speeds.length;si++)
    h += "<button class='btn"+(g.speed===speeds[si][0]?" on":"")+"' data-act='speed' data-arg='"+speeds[si][0]+"'>"+speeds[si][1]+"</button>";
  h += "<button class='btn"+(ui.layers.forest?" on":"")+"' data-act='layer' data-arg='forest' title='For\u00eats'>\ud83c\udf32</button>";
  h += "<button class='btn"+(ui.layers.stone?" on":"")+"' data-act='layer' data-arg='stone' title='Gisements de pierre'>\ud83e\dea8</button>";
  h += "<button class='btn"+(ui.layers.berry?" on":"")+"' data-act='layer' data-arg='berry' title='Baies'>\ud83e\udfd0</button>";
  h += "<button class='btn"+(ui.layers.soil?" on":"")+"' data-act='layer' data-arg='soil' title='Fertilit\u00e9 du sol'>\ud83c\udf3e</button>";
  h += "<button class='btn"+(ui.roadMode?" on":"")+"' data-act='road' title='Tracer des routes'>≡</button>";
  if(game.time.year >= 1177) h += "<span class='chip small' style='color:#e86a5a' title='Puissance du Baron rival'>⚔️ "+game.baron.power+"</span>";
  h += "<span class='chip small' title='Influence (prestige du seigneur)'>⭐ "+Math.floor(g.influence)+"</span>";
  h += "<span class='chip small' title='Richesse régionale'>💵 "+Math.floor(g.wealth)+"</span>";
  h += "<button class='btn' data-act='buyox' title='Acheter un boeuf (20 deniers)'>🐂+</button>";
  h += "<button class='btn' data-act='militia' title='Lever la milice (1 soldat pour 2 familles)'>⚔️\ufe0f "+game.units.length+"/"+game.militiaCount()+"</button>";
  h += "<button class='btn' data-act='merc' title='Louer un mercenaire (25 deniers, 6 mois)'>\u2694\ufe0f+</button>";
  h += "<button class='btn' data-act='regions' title='Régions'>🏰️\ufe0f</button>";
  h += "<button class='btn' data-act='log' title='Journal des \u00e9v\u00e9nements'>\ud83d\udcdc</button>";
  h += "<button class='btn' data-act='saveCode' title='Code de sauvegarde'>💾</button>";
  h += "<button class='btn' data-act='loadCode' title='Charger un code'>📥</button>";
  h += "<button class='btn' data-act='mute' title='Son on/off (M)'>"+(AudioFX.muted?"\ud83d\udd07":"\ud83d\udd0a")+"</button>";
  h += "<button class='btn' data-act='help'>?</button>";
  h += "<button class='btn danger' data-act='new' title='Nouvelle partie'>⟲</button>";
  hud.innerHTML = h;

  /* calque par-dessus la carte */
  var o = "";

  /* ----- écran de fin (victoire/défaite) ----- */
  if(g.victory || g.defeat){
    var win = g.victory;
    o += "<div class='modalwrap'><div class='modal big'>";
    o += "<b>"+(win?"\ud83c\udfc6 VICTOIRE !":"\ud83d\udc80 DÉFAITE")+"</b>";
    o += "<p>Mode : <b>"+esc(g.mode().name)+"</b> \u00b7 Difficulté : <b>"+esc(g.diff().name)+"</b></p>";
    o += "<p>"+esc(g.time.month)+" "+g.time.year+" \u2014 "+esc(g.settlementName())+" de "+g.families.length+" familles</p>";
    o += "<p>Trésorerie : "+Math.floor(g.treasury)+" deniers \u00b7 Influence : "+Math.floor(g.influence)+" \u00b7 Approbation : "+g.approval+"%</p>";
    if(!win && g.endReason) o += "<p class='dim'>Cause : "+esc(g.endReason)+"</p>";
    o += "<button class='btn wide' data-act='new'>Nouvelle partie</button>";
    o += "<button class='btn wide' data-act='menuclose'>Continuer à jouer</button>";
    o += "</div></div>";
  }

  /* ----- menu de démarrage : modes, difficultés, slots ----- */
  if(uiMenu){
    o += "<div class='modalwrap'><div class='modal big'>";
    o += "<b>\ud83c\udff0 SEIGNEURIE</b>";
    o += "<p class='dim'>Choisissez un mode et une difficulté :</p>";
    for(var mi=0; mi<MODES.length; mi++){
      var md = MODES[mi];
      for(var di=0; di<DIFFICULTIES.length; di++){
        var dd = DIFFICULTIES[di];
        o += "<button class='btn wide' data-act='startgame' data-mode='"+md.id+"' data-diff='"+dd.id+"' data-slot='"+activeSlot+"'>"
          + esc(md.name)+" \u00b7 "+esc(dd.name)+"</button>";
      }
    }
    o += "<p class='dim'>Sauvegardes :</p>";
    for(var si=0; si<3; si++){
      var info = slotInfo(si);
      o += "<div class='row'>";
      o += "<button class='btn"+(info?"":" dis")+"' data-act='loadslot' data-arg='"+si+"'"+(info?"":" disabled")+">Slot "+(si+1)+(info?" : "+esc(info.mode)+" "+esc(info.diff)+" "+esc(info.date)+" ("+info.pop+" fam."+(info.victory?", \ud83c\udfc6":"")+(info.defeat?", \ud83d\udc80":"")+")":" (vide)")+"</button>";
      if(info) o += "<button class='btn danger' data-act='delslot' data-arg='"+si+"'>\u2715</button>";
      o += "</div>";
    }
    if(game) o += "<button class='btn wide' data-act='menuclose'>Reprendre la partie en cours</button>";
    o += "</div></div>";
  }
  o += "<div class='panel' id='objpanel'>";
  o += "<b>📜 Objectifs</b>";
  o += "<div>"+(g.objectives.wood?"✅":"⬜")+" Bûcherons actifs</div>";
  o += "<div>"+(g.objectives.happy?"✅":"⬜")+" Approbation ≥ 50 % (3 mois)</div>";
  o += "<div>"+(g.objectives.pop?"✅":"⬜")+" 10 familles</div>";
  o += "<div>"+(g.objectives.manor?"✅":"⬜")+" Un manoir</div>";
  if(g.victory) o += "<div class='gold'>🏆 Seigneurie prospère !</div>";
  o += "</div>";

  var sel = ui.selId!=null ? g.buildings.find(function(b){ return b.id===ui.selId; }) : null;
  if(sel){
    var d = BUILD_DEFS[sel.def];
    o += "<div class='panel' id='selpanel'>";
    o += "<div class='row'><b>"+d.icon+" "+d.name+(sel.def==="burgage"?" (niv. "+sel.lvl+")":"")+"</b><button class='btn' data-act='selclose'>✕</button></div>";
    o += "<div class='desc'>"+d.desc+"</div>";
    o += "<div>"+g.workStatus(sel)+"</div>";
    if(d.fam>0){
      o += "<div class='row'>Familles : "+sel.families.length+"/"+d.fam+" ";
      o += "<button class='btn' data-act='unassign'>−</button> ";
      o += "<button class='btn' data-act='assign'>+</button>";
      o += " <span class='dim'>oisifs : "+g.unemployed()+"</span></div>";
    }
    if(sel.def==="burgage"){
      var fam = g.families.find(function(f){ return f.home===sel.id; });
      o += "<div>"+(fam ? "Résidente : "+esc(fam.name) : "Vacante")+"</div>";
      if(sel.monthsGood>0) o += "<div class='good'>Bilan positif : "+sel.monthsGood+" mois</div>";
      if(sel.done){
        var exts = sel.exts || [];
        if(exts.length) o += "<div class='good'>Agrandissements : "+exts.map(function(e){ return EXT_DEFS[e].name; }).join(", ")+"</div>";
        var avail = EXT_ORDER.filter(function(e){ return exts.indexOf(e)<0 && sel.lvl>=EXT_DEFS[e].lvl; });
        for(var ei=0; ei<avail.length; ei++){
          var ed = EXT_DEFS[avail[ei]];
          var costTxt = Object.keys(ed.cost).map(function(k){ return ed.cost[k]+" "+(RES_ICONS[k]||k); }).join(" + ");
          o += "<div class='row'><button class='btn' data-act='ext' data-arg='"+ed.id+"'>"+ed.name+" ("+costTxt+")</button></div>";
        }
        if(!avail.length && !exts.length) o += "<div class='dim'>Aucun agrandissement disponible (niveau "+sel.lvl+").</div>";
      }
    }
    if(sel.def==="field" && sel.f){
      o += "<div>Taille : "+sel.w+"x"+sel.h+" · Culture : <b>"+CROP_DEFS[sel.f.crop].name+"</b></div>";
      o += "<div class='row'>";
      for(var ci=0; ci<CROP_ORDER.length; ci++){
        var cd = CROP_DEFS[CROP_ORDER[ci]];
        o += "<button class='btn"+(sel.f.crop===cd.id?" on":"")+"' data-act='crop' data-arg='"+cd.id+"' title='"+cd.desc+"'>"+cd.name+"</button>";
      }
      o += "</div>";
      o += "<div>Fertilité : "+Math.round(sel.f.fert*100)+" %</div>";
      o += "<div>Labour : "+Math.round(sel.f.plow*100)+" %</div>";
      o += "<div>"+(!sel.f.sown ? (sel.f.growth>0?"Mûr":"Jachère / en attente") : "Croissance : "+Math.round(sel.f.growth*100)+" %")+"</div>";
      if(sel.f.harvestP>0) o += "<div>Moisson : "+Math.round(sel.f.harvestP*100)+" %</div>";
    }
    if(sel.def==="trade" && sel.done){
      o += "<div class='row'><span class='dim'>Prix du marché :</span></div>";
      for(var pk in g.prices) o += "<span class='chip small'>"+(RES_ICONS[pk]||pk)+" "+g.prices[pk]+"d</span> ";
    }
    if(sel.def==="church" && sel.done){
      var cups = sel.churchUp || [];
      if(cups.length) o += "<div class='good'>Améliorations : "+cups.map(function(u){ return CHURCH_UPGRADES[u].name; }).join(", ")+"</div>";
      for(var cui=0; cui<CHURCH_UP_ORDER.length; cui++){
        var cu = CHURCH_UPGRADES[CHURCH_UP_ORDER[cui]];
        if(cups.indexOf(cu.id)>=0) continue;
        var ccost = Object.keys(cu.cost).map(function(k){ return cu.cost[k]+" "+(RES_ICONS[k]||k); }).join(" + ");
        o += "<div class='row'><button class='btn' data-act='churchup' data-arg='"+cu.id+"' title='"+esc(cu.desc)+"'>"+cu.name+" ("+ccost+")</button></div>";
      }
    }
    if(sel.def==="manor" && sel.done){
      o += "<div class='row'><b>Décrets :</b></div>";
      for(var pi=0; pi<POLICY_ORDER.length; pi++){
        var pd = POLICY_DEFS[POLICY_ORDER[pi]];
        o += "<div class='row'><button class='btn"+(g.policies[pd.id]?" on":"")+"' data-act='policy' data-arg='"+pd.id+"' title='"+esc(pd.desc)+"'>"+esc(pd.name)+"</button></div>";
      }
    }
    if(sel.def==="manor" && sel.done){
      o += "<div>Taux d'imposition : "+Math.round(g.taxRate*100)+" %</div>";
      o += "<input type='range' min='0' max='100' step='5' id='taxSlider' value='"+Math.round(g.taxRate*100)+"'/>";
      o += "<div class='dim'>Au-delà de 10 %, l'approbation en pâtit.</div>";
    }
    o += "<button class='btn danger wide' data-act='demolish'>Démolir (½ remboursée)</button>";
    o += "</div>";
  }

  if(g.pendingEvent){
    o += "<div class='modalwrap'><div class='modal'>";
    o += "<b>"+esc(g.pendingEvent.title)+"</b>";
    o += "<p>"+esc(g.pendingEvent.text)+"</p>";
    for(var ci=0;ci<g.pendingEvent.choices.length;ci++){
      var c = g.pendingEvent.choices[ci];
      o += "<button class='btn wide"+(c.disabled?" dis":"")+"' data-act='resolve' data-arg='"+ci+"'"+(c.disabled?" disabled":"")+">"+esc(c.label)+"</button>";
    }
    o += "</div></div>";
  }

  if(ui.regionsOpen){
    o += "<div class='modalwrap' data-act='regionsclose'><div class='modal big' data-act='noop'>";
    o += "<b>🏰️\ufe0f Régions du domaine</b>";
    for(var ri=0; ri<REGION_DEFS.length; ri++){
      var rd = REGION_DEFS[ri], rr = g.regions[ri];
      var baronHas = g.baron.regions.indexOf(ri)>=0;
      o += "<div class='row'><b>"+esc(rd.name)+"</b> "+(rr.owned?"<span class='good'>à vous</span>":(baronHas?"<span style='color:#e86a5a'>au Baron</span>":""));
      if(!rr.owned){
        o += "<button class='btn' data-act='claim' data-arg='"+ri+"' title='Coût : 30 deniers + 15 richesse'>Réclamer (30\u00a0💰 + 15💵)</button>";
      }
      o += "</div><div class='dim'>"+esc(rd.desc)+"</div>";
    }
    o += "<button class='btn wide' data-act='regionsclose'>Fermer</button>";
    o += "</div></div>";
  }

  if(ui.logOpen){
    o += "<div class='modalwrap' data-act='logclose'><div class='modal big' data-act='noop'>";
    o += "<b>\ud83d\udcdc Journal de la seigneurie</b>";
    if(g.log.length===0) o += "<p class='dim'>Aucun \u00e9v\u00e9nement pour le moment.</p>";
    else {
      for(var li=g.log.length-1; li>=0; li--){
        var le = g.log[li];
        o += "<div class='"+(le.kind==="bad"?"bad":le.kind==="good"?"good":"dim")+"'>["+MONTHS[le.month]+" "+le.year+"] "+esc(le.text)+"</div>";
      }
    }
    o += "<button class='btn wide' data-act='logclose'>Fermer</button>";
    o += "</div></div>";
  }

  if(ui.helpOpen){
    o += "<div class='modalwrap' data-act='helpclose'><div class='modal big' data-act='noop'>";
    o += "<b>📚 Comment jouer</b>";
    o += "<p><b>Boucle de base :</b> posez un <b>camp de bûcherons</b> près de la forêt et affectez-lui une famille (panneau du bâtiment, bouton +). Les journaliers (familles non affectées) construisent automatiquement les chantiers.</p>";
    o += "<p><b>Nourrir :</b> cueilleuses (baies, mars→novembre) et chasseurs (viande). La <b>variété</b> alimentaire est la clé de l'approbation. Un <b>marché</b> actif est indispensable pour y donner accès.</p>";
    o += "<p><b>Chauffage :</b> les bûcherons fournissent aussi du bois de chauffe. L'hiver, la consommation double — stockez avant décembre !</p>";
    o += "<p><b>Agriculture :</b> champs gratuits (rendement selon la fertilité), labour au printemps, moisson en septembre. Le <b>moulin</b> transforme le grain en pain. Laissez un champ en jachère une année sur deux.</p>";
    o += "<p><b>Croissance :</b> approbation ≥ 55 % + bourgage libre = nouvelle famille. Les bourgages évoluent (niveaux 2 et 3) quand leurs foyers sont nourris, chauffés et approvisionnés. Le <b>manoir</b> permet de lever l'impôt.</p>";
    o += "<p><b>Événements :</b> le roi exigera son impôt en novembre, des brigands peuvent surgir en mai. Gérez votre trésorerie !</p>";
    o += "<p><b>Commandes :</b> glisser = déplacer · pincer / molette = zoom · ZQSD ou flèches = caméra · Espace = pause · 1/2/3 = vitesse · appui long = annuler · tapez la <b>minimap</b> (en bas à droite) pour recentrer.</p>";
    o += "<p><b>Sauvegarde :</b> automatique sur cet appareil. 💾 donne un code à copier, 📥 le recharge (n'importe quel appareil).</p>";
    o += "<button class='btn wide' data-act='helpclose'>Compris !</button>";
    o += "</div></div>";
  }

  var now = Date.now();
  var toasts = g.toasts.filter(function(t){ return now-t.t<6500; });
  if(toasts.length){
    o += "<div class='toasts'>";
    for(var ti=0;ti<toasts.length;ti++) o += "<div class='toast "+toasts[ti].kind+"'>"+esc(toasts[ti].text)+"</div>";
    o += "</div>";
  }
  if(ui.flash) o += "<div class='flash'>"+esc(ui.flash)+"</div>";
  if(ui.roadMode) o += "<div class='hint'>≡ Mode route : touchez une case pour tracer/supprimer \u2014 les travailleurs empruntent les routes (plus rapides). Appui long ou \u00c9chap pour quitter.</div>";
  if(ui.buildSel){
    o += "<div class='hint'>Posez : "+BUILD_DEFS[ui.buildSel].name+" — appui long pour annuler";
    if(BUILD_DEFS[ui.buildSel].uiSize){
      o += " · Taille : ";
      for(var si=0; si<FIELD_SIZES.length; si++){
        o += "<button class='btn"+(game.fieldSize()===FIELD_SIZES[si]?" on":"")+"' data-act='fieldsize' data-arg='"+FIELD_SIZES[si]+"'>"+FIELD_SIZES[si]+"x"+FIELD_SIZES[si]+"</button>";
      }
    }
    o += "</div>";
  }

  if(!ui.taxDrag) overlay.innerHTML = o;

  /* barre de construction (défilement horizontal) */
  var bh = "";
  for(var bi=0;bi<BUILD_ORDER.length;bi++){
    var id = BUILD_ORDER[bi];
    var dd = BUILD_DEFS[id];
    var afford = g.canAfford(id);
    bh += "<button class='bbtn"+(ui.buildSel===id?" on":"")+(afford?"":" off")+"' data-act='build' data-arg='"+id+"'>";
    bh += "<span class='bicon'>"+dd.icon+"</span>";
    bh += "<span>"+dd.name+"</span>";
    bh += "<span class='bcost'>"+g.costText(id)+"</span>";
    bh += "</button>";
  }
  bh += "<span class='dim self'>Journaliers : "+g.unemployed()+"</span>";
  buildbar.innerHTML = bh;
}
renderUI();

/* ----- sons procéduraux (WebAudio, aucun fichier) ----- */
var AudioFX = {
  ctx:null, muted:false, master:null,
  init(){
    if(this.ctx) return;
    try{
      this.ctx = new (window.AudioContext||window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.25;
      this.master.connect(this.ctx.destination);
    }catch(e){ this.ctx = null; }
  },
  tone(freq, dur, type, vol){
    if(!this.ctx || this.muted) return;
    const o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=type||"sine"; o.frequency.value=freq;
    g.gain.setValueAtTime(vol||0.5, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime+dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime+dur);
  },
  click(){ this.tone(660, 0.06, "square", 0.25); },
  good(){ this.tone(523, 0.12, "sine", 0.4); this.tone(784, 0.18, "sine", 0.3); },
  bad(){ this.tone(220, 0.25, "sawtooth", 0.3); },
  build(){ this.tone(330, 0.08, "triangle", 0.35); this.tone(440, 0.1, "triangle", 0.3); },
  coin(){ this.tone(988, 0.08, "square", 0.2); this.tone(1319, 0.12, "square", 0.15); },
};
// sons déclenchés sur les nouveaux toasts
var _lastToastId = 0;
function soundForToasts(g){
  if(!g.log.length) return;
  var last = g.log[g.log.length-1];
  if(last.id > _lastToastId){
    _lastToastId = last.id;
    if(last.kind==="good") AudioFX.good();
    else if(last.kind==="bad") AudioFX.bad();
  }
}

/* ----- boucle principale ----- */
var _last = performance.now(), _acc = 0, _uiAcc = 0, _saveAcc = 0;
function loop(now){
  var dt = Math.min(200, now-_last); _last = now;
  if(game.speed>0 && !game.pendingEvent){
    _acc += dt*game.speed;
    var n = Math.floor(_acc/100);
    if(n>60){ n = 60; _acc = 0; } else _acc -= n*100;
    for(var i=0;i<n;i++) game.step();
  }
  var sp = 14*dt/1000, pvx = 0, pvy = 0;
  if(keys.has("arrowleft")||keys.has("q")||keys.has("a")) pvx -= sp;
  if(keys.has("arrowright")||keys.has("d")) pvx += sp;
  if(keys.has("arrowup")||keys.has("z")||keys.has("w")) pvy -= sp;
  if(keys.has("arrowdown")||keys.has("s")) pvy += sp;
  if(pvx||pvy){
    cam.x = Math.max(-4, Math.min(W+4, cam.x+pvx));
    cam.y = Math.max(-4, Math.min(H+4, cam.y+pvy));
  }
  _saveAcc += dt;
  if(_saveAcc>5000){ _saveAcc = 0; persist(game); }
  soundForToasts(game);
  _uiAcc += dt;
  if(_uiAcc>300){ _uiAcc = 0; renderUI(); }
  drawGame(ctx, game, cam, canvas, hover, ui.buildSel, ui.selId, ui.layers, now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* sauvegarde quand on quitte / cache l'application */
document.addEventListener("visibilitychange", function(){ if(document.hidden) persist(game); });
window.addEventListener("beforeunload", function(){ persist(game); });
