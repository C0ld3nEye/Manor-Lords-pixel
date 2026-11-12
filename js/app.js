/* ============ SEIGNEURIE — application mobile (vanilla JS) ============
   Interface pensée pour un téléphone tenu en portrait :
   - barre du haut compacte (date, trésor, approbation, familles, vitesse, menu) + bandeau des réserves ;
   - carte plein écran, minimap en haut à droite, objectifs repliables, notifications discrètes ;
   - dock du bas par catégories (comme Manor Lords) qui ouvre un tiroir de construction ;
   - panneaux en « feuille du bas » (bâtiment sélectionné, réserves, seigneurie, menu).
   ===================================================================== */
var SAVE_SLOTS = ["seigneurie-save-v2-1","seigneurie-save-v2-2","seigneurie-save-v2-3"];
var SAVE_KEY = SAVE_SLOTS[0];
var activeSlot = 0;
function persist(g){ if(!g) return; try{ window.localStorage.setItem(SAVE_SLOTS[activeSlot], JSON.stringify(g.serialize())); }catch(e){} }
function loadSlot(i){ try{ var r=window.localStorage.getItem(SAVE_SLOTS[i]); return r?GameState.load(JSON.parse(r)):null; }catch(e){ return null; } }
var _slotCache = {};
function slotInfo(i){
  if(_slotCache[i] && Date.now()-_slotCache[i].t < 1500) return _slotCache[i].info;
  var raw = null;
  try{ raw = window.localStorage.getItem(SAVE_SLOTS[i]); }catch(e){}
  if(!raw) return null;
  if(_slotCache[i] && _slotCache[i].raw===raw.length && Date.now()-_slotCache[i].t < 4000) return _slotCache[i].info;
  var g = loadSlot(i);
  var info = g ? { mode:g.mode().name, diff:g.diff().name, month:g.time.month, year:g.time.year, pop:g.families.length,
    level:g.settlementName(), victory:g.victory, defeat:g.defeat } : null;
  _slotCache[i] = { raw:raw.length, info:info, t:Date.now() };
  return info;
}
function encodeSave(g){ try{ return btoa(unescape(encodeURIComponent(JSON.stringify(g.serialize())))); }catch(e){ return ""; } }
function decodeSave(code){ try{ return GameState.load(JSON.parse(decodeURIComponent(escape(atob(code.trim()))))); }catch(e){ return null; } }

/* ----- partie (restaurée depuis l'appareil si possible) ----- */
var game = null;
var uiMenu = false; // écran d'accueil (sauvegardes / nouvelle partie)
try{
  var _last = window.localStorage.getItem("seigneurie-last-slot");
  if(_last!==null){ activeSlot = Math.max(0, Math.min(2, Number(_last)||0)); }
  game = loadSlot(activeSlot);
}catch(e){}
if(game){ SAVE_KEY = SAVE_SLOTS[activeSlot]; }
else { uiMenu = true; game = null; }

var cam = { x:0, y:0, zoom:snapZoom(1.5) };
function centerCam(){
  if(!game) return;
  var b = game.buildings[0];
  if(b){ cam.x = b.x + b.w/2; cam.y = b.y + b.h/2; }
}
centerCam();

var ui = {
  buildSel:null, selId:null, cat:null, sheet:null, modal:null, roadMode:false,
  zoneMode:false, zonePts:[], zoneClosed:false, zoneN:null, extPlace:null,
  flash:null, objOpen:false, layersOpen:false, tip:null, tipT:0, hoverTip:null,
  demolishArm:0, delArm:null, taxDrag:false, lastSpeed:1, endSeen:false,
  newMode:"prosperity", newDiff:"normal", newSlot:activeSlot,
  layers:{ forest:false, stone:false, berry:false, soil:false }
};

/* ----- catégories de construction (dock du bas) ----- */
var CATS = [
  { id:"home",  name:"Maisons",    icon:"house",  items:[], actions:["zone"],
    hint:"Tracez une zone le long d'une route : maisons, cours et clôtures se placent seules." },
  { id:"res",   name:"Récolte",    icon:"axe",    items:["woodcutter","forager","hunter","quarry"],
    hint:"Bois, baies, gibier et pierre : posez-les près de la ressource." },
  { id:"farm",  name:"Champs",     icon:"grain",  items:["field","farm","windmill"], actions:["buyox"],
    hint:"Champs gratuits, une ferme pour les travailler, un moulin pour le pain." },
  { id:"store", name:"Stocks",     icon:"crate",  items:["granary","storehouse"],
    hint:"La grange limite le pourrissement, l'entrepôt augmente la capacité." },
  { id:"realm", name:"Domaine",    icon:"church", items:["market","trade","church","manor"],
    hint:"Marché, commerce, église et manoir : le cœur de la seigneurie." },
  { id:"def",   name:"Défense",    icon:"shield", items:["tower","wall"], actions:["militia","merc"],
    hint:"Tours et remparts contre les pillards, milice et mercenaires." },
  { id:"road",  name:"Routes",     icon:"road",   tool:true }
];
var UNIQUE = { manor:1, church:1, windmill:1, market:1, trade:1 };

/* ----- ressources : nom et icône ----- */
var RES = {
  timber:{ n:"Bois d'œuvre" }, firewood:{ n:"Bois de chauffe" }, stone:{ n:"Pierre" },
  grain:{ n:"Grain" }, barley:{ n:"Orge" }, bread:{ n:"Pain" }, berries:{ n:"Baies" }, meat:{ n:"Viande" },
  eggs:{ n:"Œufs" }, veg:{ n:"Légumes" }, apples:{ n:"Pommes" }, honey:{ n:"Miel" },
  clothes:{ n:"Vêtements" }, ale:{ n:"Ale" }, ox:{ n:"Bœufs" }
};
var MONTHS_SHORT = ["Janv.","Févr.","Mars","Avril","Mai","Juin","Juil.","Août","Sept.","Oct.","Nov.","Déc."];
var SEASON_IC = ["winter","spring","summer","autumn"];

function esc(str){
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function ic(n, cls){ return ICONS.ic(n, cls); }
/* Les messages de la simulation contiennent des emojis : à l'affichage, on les remplace
   par les icônes pixel-art (ou on les retire quand il n'y a pas d'équivalent). */
var EMOJI_IC = { "💰":"coin", "🪵":"timber", "🔥":"firewood", "🪨":"stone", "🌾":"grain", "🍞":"bread", "🍒":"berries",
  "🍗":"meat", "🥚":"eggs", "🥕":"veg", "🍎":"apples", "🍯":"honey", "👕":"clothes", "🍺":"ale", "🐂":"ox",
  "🗺":"flag", "🛡":"shield", "⚔":"sword", "🏆":"crown", "🏰":"house", "❄":"winter", "💀":"", "☠":"", "🏕":"", "⚠":"" };
var EMOJI_RE = new RegExp("("+Object.keys(EMOJI_IC).join("|")+")\\ufe0f?\\s?", "g");
function rich(text){
  return esc(text).replace(EMOJI_RE, function(m, e){ var n = EMOJI_IC[e]; return n ? ic(n,"s")+(/\s$/.test(m)?" ":"") : ""; });
}
function flash(msg){
  ui.flash = msg;
  if(ui._ft) clearTimeout(ui._ft);
  ui._ft = setTimeout(function(){ ui.flash = null; renderUI(); }, 2200);
}
function buzz(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} }
function costHtml(cost, g){
  var ks = Object.keys(cost||{});
  if(!ks.length) return "<span class='cost'>Gratuit</span>";
  return ks.map(function(k){
    var short = g && (g.stock[k]||0) < cost[k];
    return "<span class='cost"+(short?" no":"")+"'>"+cost[k]+ic(k,"s")+"</span>";
  }).join(" ");
}
function missingText(def, g){
  var c = BUILD_DEFS[def].cost, m = [];
  for(var k in c) if((g.stock[k]||0) < c[k]) m.push((c[k]-(g.stock[k]||0))+" "+RES[k].n.toLowerCase());
  return m.length ? "Il manque "+m.join(" et ")+"." : "";
}
function bar(p, cls){ return "<div class='bar"+(cls?" "+cls:"")+"'><i style='width:"+Math.max(0,Math.min(100,Math.round(p*100)))+"%'></i></div>"; }
/* Mise à jour « sur place » : au lieu de remplacer tout le HTML d'une zone, on ne modifie que
   les nœuds qui ont changé. Un bouton reste le même élément quand seul un chiffre voisin bouge :
   un toucher commencé n'est jamais perdu, et le défilement des listes est conservé. */
var _tpl = document.createElement("template");
function setHTML(el, html){
  if(el._h===html) return;
  el._h = html;
  _tpl.innerHTML = html;
  patchChildren(el, _tpl.content);
}
function patchChildren(a, b){
  var bl = Array.prototype.slice.call(b.childNodes);
  for(var i=0;i<bl.length;i++){
    var nb = bl[i], na = a.childNodes[i];
    if(!na){ a.appendChild(nb); continue; }
    if(na.nodeType!==nb.nodeType || na.nodeName!==nb.nodeName){ a.replaceChild(nb, na); continue; }
    if(na.nodeType!==1){ if(na.nodeValue!==nb.nodeValue) na.nodeValue = nb.nodeValue; continue; }
    patchAttrs(na, nb);
    if(na.tagName==="INPUT") continue;   /* le curseur garde sa valeur pendant qu'on le manipule */
    patchChildren(na, nb);
  }
  while(a.childNodes.length > bl.length) a.removeChild(a.lastChild);
}
function patchAttrs(a, b){
  var i, ba = b.attributes, aa = a.attributes;
  for(i=0;i<ba.length;i++) if(a.getAttribute(ba[i].name)!==ba[i].value) a.setAttribute(ba[i].name, ba[i].value);
  for(i=aa.length-1;i>=0;i--) if(!b.hasAttribute(aa[i].name)) a.removeAttribute(aa[i].name);
}

/* ----- éléments ----- */
var canvas = document.getElementById("cv");
var wrap = document.getElementById("mapwrap");
var elBar = document.getElementById("bar");
var elRes = document.getElementById("res");
var elHudL = document.getElementById("hudl");
var elHudR = document.getElementById("hudr");
var elHint = document.getElementById("hint");
var elTip = document.getElementById("tip");
var elSheet = document.getElementById("sheet");
var elDock = document.getElementById("dock");
var elModal = document.getElementById("modal");
var elCard = document.getElementById("mcard");
var ctx = canvas.getContext("2d");
var dpr = Math.min(2, window.devicePixelRatio || 1);
ICONS.init();

function resize(){
  var r = wrap.getBoundingClientRect();
  if(r.width<10 || r.height<10) return;
  var w = Math.floor(r.width*dpr), h = Math.floor(r.height*dpr);
  if(canvas.width!==w || canvas.height!==h){ canvas.width = w; canvas.height = h; }
}
window.addEventListener("resize", resize);
if(window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
resize();

/* ----- entrées : pointeurs (glisser / pincer / toucher / appui long / minimap) ----- */
var pointers = new Map();
var pinch = null;
var drag = { down:false, sx:0, sy:0, cx:0, cy:0, moved:false };
var keys = new Set();
var hover = { tx:-1, ty:-1, inside:false };
var longPress = null;

function toWorld(clientX, clientY){
  var r = canvas.getBoundingClientRect();
  var wx = cam.x + (clientX - r.left - r.width/2)/(16*cam.zoom);
  var wy = cam.y + (clientY - r.top - r.height/2)/(16*cam.zoom);
  return { wx:wx, wy:wy, tx:Math.floor(wx), ty:Math.floor(wy) };
}
/* sur téléphone, la feuille du bas couvre la moitié basse : on remonte doucement la vue
   pour que le bâtiment sélectionné reste visible au-dessus */
var camGoal = null;
function revealAboveSheet(b){
  var r = canvas.getBoundingClientRect();
  if(r.width>=760) return;
  var wy = b.y + b.h/2, S = 16*cam.zoom;
  var sy = r.height/2 + (wy - cam.y)*S;
  if(sy > r.height*0.40) camGoal = { y: Math.max(-4, Math.min(H+4, wy + (r.height*0.5 - r.height*0.24)/S)) };
}
function clearLongPress(){ if(longPress){ clearTimeout(longPress); longPress = null; } }
/* appui long : annule la pose / le tracé / la sélection */
function cancelAll(){
  var any = ui.buildSel || ui.roadMode || ui.zoneMode || ui.extPlace || ui.selId!=null || ui.cat || ui.sheet;
  clearTools();
  ui.buildSel = null; ui.roadMode = false; ui.selId = null; ui.cat = null; ui.sheet = null; ui.layersOpen = false;
  return any;
}

canvas.addEventListener("pointerdown", function(e){
  try{ if(canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId); }catch(err){}
  pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
  lastPtrType = e.pointerType;
  clearLongPress();
  if(pointers.size===2){
    var pts = [];
    pointers.forEach(function(p){ pts.push(p); });
    var dist = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
    var w = toWorld((pts[0].x+pts[1].x)/2, (pts[0].y+pts[1].y)/2);
    pinch = { dist:dist, zoom:cam.zoom, wx:w.wx, wy:w.wy };
    drag.down = false; drag.moved = true; zoneDrag = { i:-1 };
    return;
  }
  /* outil de zone : toucher un point existant = le déplacer (ou fermer le contour sur le premier) */
  if(game && ui.zoneMode && ui.zonePts.length){
    var zw0 = toWorld(e.clientX, e.clientY), zi = nearZonePt(zw0.wx, zw0.wy);
    if(zi>=0){
      zoneDrag = { i:zi, sx:e.clientX, sy:e.clientY, moved:false, extend: !ui.zoneClosed && zi===ui.zonePts.length-1 };
      drag.down = false; drag.moved = true; return;
    }
  }
  drag.down = true; drag.moved = false; camGoal = null;
  drag.sx = e.clientX; drag.sy = e.clientY;
  drag.cx = cam.x; drag.cy = cam.y;
  /* en traçant une zone, l'appui long n'efface rien (on annule avec la croix) */
  if(e.pointerType!=="mouse" && !ui.zoneMode){
    longPress = setTimeout(function(){
      longPress = null;
      if(drag.down && !drag.moved && pointers.size===1){
        drag.moved = true; /* le relâchement ne sera pas un toucher */
        if(cancelAll()){ buzz(15); renderUI(); }
      }
    }, 550);
  }
});

canvas.addEventListener("pointermove", function(e){
  if(!game) return;
  if(pointers.has(e.pointerId)) pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if(pointers.size>=2 && pinch){
    var pts2 = [];
    pointers.forEach(function(p){ pts2.push(p); });
    var dist2 = Math.hypot(pts2[0].x-pts2[1].x, pts2[0].y-pts2[1].y);
    var z = snapZoom(pinch.zoom * dist2/Math.max(20, pinch.dist));   /* paliers entiers : pixels nets */
    cam.zoom = z;
    var r = canvas.getBoundingClientRect();
    var mx = (pts2[0].x+pts2[1].x)/2, my = (pts2[0].y+pts2[1].y)/2;
    cam.x = Math.max(-4, Math.min(W+4, pinch.wx - (mx - r.left - r.width/2)/(16*z)));
    cam.y = Math.max(-4, Math.min(H+4, pinch.wy - (my - r.top - r.height/2)/(16*z)));
    return;
  }
  if(zoneDrag.i>=0){
    if(Math.abs(e.clientX-zoneDrag.sx)+Math.abs(e.clientY-zoneDrag.sy)>6) zoneDrag.moved = true;
    if(zoneDrag.moved){
      /* tirer depuis le dernier point : un nouveau trait suit le doigt */
      if(zoneDrag.extend){ ui.zonePts.push(ui.zonePts[zoneDrag.i].slice()); zoneDrag.i = ui.zonePts.length-1; zoneDrag.extend = false; }
      var zw = toWorld(e.clientX, e.clientY), zn = ui.zonePts.length, zi2 = zoneDrag.i;
      var zprev = zi2>0 ? ui.zonePts[zi2-1] : (ui.zoneClosed ? ui.zonePts[zn-1] : null);
      ui.zonePts[zi2] = game.snapZonePoint(zw.wx, zw.wy, zprev);
    }
    return;
  }
  var w = toWorld(e.clientX, e.clientY);
  var inside = w.tx>=0 && w.ty>=0 && w.tx<W && w.ty<H;
  if(hover.tx!==w.tx || hover.ty!==w.ty || hover.inside!==inside){
    hover.tx = w.tx; hover.ty = w.ty; hover.inside = inside;
    if(e.pointerType==="mouse"){
      if(inside){
        var hb = game.buildingAt(w.tx, w.ty);
        ui.hoverTip = hb ? BUILD_DEFS[hb.def].name+(game.workStatus(hb) ? " — "+game.workStatus(hb) : "") : game.tileName(w.tx, w.ty);
      } else ui.hoverTip = null;
      renderTip();
    }
  }
  if(drag.down){
    var dx = e.clientX-drag.sx, dy = e.clientY-drag.sy;
    if(Math.abs(dx)+Math.abs(dy)>7){ drag.moved = true; clearLongPress(); }
    if(drag.moved){
      cam.x = Math.max(-4, Math.min(W+4, drag.cx - dx/(16*cam.zoom)));
      cam.y = Math.max(-4, Math.min(H+4, drag.cy - dy/(16*cam.zoom)));
    }
  }
});

function endPointer(e){
  pointers.delete(e.pointerId);
  if(pointers.size<2) pinch = null;
  drag.down = false;
  clearLongPress();
}

canvas.addEventListener("pointerup", function(e){
  if(!game) return;
  if(zoneDrag.i>=0){
    var zd = zoneDrag; zoneDrag = { i:-1 }; endPointer(e);
    if(!zd.moved && zd.i===0 && !ui.zoneClosed && ui.zonePts.length>=3){ ui.zoneClosed = true; ui.zoneN = null; buzz(8); }
    renderUI(); return;
  }
  var wasMoved = drag.moved;
  endPointer(e);
  if(wasMoved) return;
  if(pointers.size>0) return;
  /* toucher sur la minimap : recentrage */
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
  var w = toWorld(e.clientX, e.clientY);
  ui.objOpen = false; ui.layersOpen = false;
  if(w.tx<0||w.ty<0||w.tx>=W||w.ty>=H){ renderUI(); return; }
  if(ui.zoneMode){
    if(ui.zoneClosed) flash("Glissez un point pour ajuster le contour, ou ↶ pour le rouvrir.");
    else { ui.zonePts.push(game.snapZonePoint(w.wx, w.wy, ui.zonePts[ui.zonePts.length-1])); buzz(5); }
  }
  else if(ui.roadMode){
    if(!game.toggleRoad(w.tx, w.ty)) flash("Impossible de tracer une route ici.");
  }
  else if(ui.buildSel){
    var def = ui.buildSel;
    var err = game.place(def, w.tx, w.ty);
    if(err) flash(err);
    else {
      AudioFX.build(); buzz(8);
      if(UNIQUE[def]) ui.buildSel = null;
      else if(!game.canAfford(def)){ ui.buildSel = null; flash("Plus assez de matériaux. "+missingText(def, game)); }
    }
  }
  else if(ui.cat || ui.sheet){
    /* toucher la carte referme le tiroir / le panneau ouvert */
    ui.cat = null; ui.sheet = null;
  }
  else {
    var b = game.buildingAt(w.tx, w.ty);
    ui.selId = b ? b.id : null; ui.demolishArm = 0;
    if(b) revealAboveSheet(b);
    if(!b){ ui.tip = game.tileName(w.tx, w.ty); ui.tipT = Date.now() + 2600; }
  }
  renderUI();
});
canvas.addEventListener("pointercancel", function(e){ zoneDrag = { i:-1 }; endPointer(e); });
canvas.addEventListener("pointerleave", function(e){ if(e.pointerType==="mouse"){ ui.hoverTip = null; renderTip(); } });
canvas.addEventListener("wheel", function(e){
  e.preventDefault();
  cam.zoom = stepZoom(cam.zoom, e.deltaY>0 ? -1 : 1);
}, { passive:false });
canvas.addEventListener("contextmenu", function(e){
  e.preventDefault();
  /* sur téléphone, un appui long déclenche aussi « contextmenu » : seul le clic droit annule */
  if(lastPtrType!=="mouse") return;
  cancelAll();
  renderUI();
});

/* ----- clavier : pause, vitesse, ZQSD/WASD/flèches ----- */
window.addEventListener("pointerdown", function(){ AudioFX.init(); });
window.addEventListener("keydown", function(e){
  AudioFX.init();
  if(e.key==="Escape"){
    if(ui.modal){ ui.modal = null; }
    else if(uiMenu && game){ uiMenu = false; }
    else cancelAll();
    renderUI(); return;
  }
  if(!game) return;
  if(e.key===" "){ e.preventDefault(); togglePause(); }
  if(e.key==="m"){ AudioFX.muted = !AudioFX.muted; flash(AudioFX.muted ? "Son coupé" : "Son activé"); }
  if(e.key==="1") setSpeed(1);
  if(e.key==="2") setSpeed(2);
  if(e.key==="3") setSpeed(4);
  if(e.key==="+"||e.key==="="){ cam.zoom = stepZoom(cam.zoom, 1); }
  if(e.key==="-"){ cam.zoom = stepZoom(cam.zoom, -1); }
  if(e.key.toLowerCase()==="t"){ cycleTextSize(); }
  var k = e.key.toLowerCase();
  if(["arrowup","arrowdown","arrowleft","arrowright","z","q","s","d","w","a"].indexOf(k)>=0){
    e.preventDefault();
    keys.add(k);
  }
  renderUI();
});
window.addEventListener("keyup", function(e){ keys.delete(e.key.toLowerCase()); });

function setSpeed(s){ game.speed = s; ui.lastSpeed = s; }
function togglePause(){ if(game.speed===0) game.speed = ui.lastSpeed||1; else { ui.lastSpeed = game.speed; game.speed = 0; } }
var _txtSize = 0;
var TXT_NAMES = ["normal","grand","très grand"];
function cycleTextSize(){
  _txtSize = (_txtSize+1)%3;
  document.body.classList.remove("txt-lg","txt-xl");
  if(_txtSize===1) document.body.classList.add("txt-lg");
  if(_txtSize===2) document.body.classList.add("txt-xl");
  try{ window.localStorage.setItem("seigneurie-txt", String(_txtSize)); }catch(e){}
}
try{ var _ts = Number(window.localStorage.getItem("seigneurie-txt")||0); while(_txtSize!==_ts && _ts>0 && _ts<3) cycleTextSize(); }catch(e){}

/* ----- clics de l'interface (délégation) ----- */
document.addEventListener("pointerdown", function(e){ if(e.target && e.target.id==="taxSlider") ui.taxDrag = true; });
document.addEventListener("pointerup", function(){ if(ui.taxDrag){ ui.taxDrag = false; renderUI(); } });

elModal.addEventListener("click", function(e){
  /* toucher le fond assombri referme les fenêtres d'information */
  if(e.target===elModal && ui.modal){ ui.modal = null; renderUI(); }
});

document.addEventListener("click", function(e){
  var el = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
  if(!el) return;
  var act = el.getAttribute("data-act");
  var arg = el.getAttribute("data-arg");
  AudioFX.init();
  if(act!=="noop") AudioFX.click();
  var g = game;
  switch(act){
    /* --- temps --- */
    case "pause": togglePause(); break;
    case "speedcycle": { var s = g.speed || ui.lastSpeed || 1; setSpeed(s===1 ? 2 : s===2 ? 4 : 1); break; }
    /* --- dock / tiroirs / panneaux --- */
    case "cat":
      if(arg==="road"){
        ui.roadMode = !ui.roadMode; ui.cat = null; ui.buildSel = null; ui.selId = null; ui.sheet = null;
      } else {
        ui.cat = (ui.cat===arg ? null : arg); ui.buildSel = null; ui.roadMode = false; ui.selId = null; ui.sheet = null;
      }
      ui.layersOpen = false; clearTools();
      break;
    case "zone":
      clearTools(); ui.zoneMode = true; ui.cat = null; ui.buildSel = null; ui.roadMode = false; ui.selId = null; ui.sheet = null;
      break;
    case "zoneundo": if(ui.zoneClosed) ui.zoneClosed = false; else ui.zonePts.pop(); ui.zoneN = null; break;
    case "zoneclose": if(ui.zonePts.length>=3){ ui.zoneClosed = true; ui.zoneN = null; } break;
    case "zoneminus": case "zoneplus": {
      var zo2 = zoneOverlay(g), zpl = zo2 && zo2.plan;
      if(zpl && !zpl.err) ui.zoneN = Math.max(zpl.nMin, Math.min(zpl.nMax, zpl.n + (arg==="1" ? 1 : -1)));
      break;
    }
    case "zoneok":
      if(ui.zoneClosed){
        var zerr = g.traceZone(ui.zonePts, ui.zoneN==null ? undefined : ui.zoneN);
        if(zerr) flash(zerr); else { AudioFX.build(); buzz(8); ui.zonePts = []; ui.zoneClosed = false; ui.zoneN = null; }
      }
      break;
    case "extrm": if(ui.selId!=null) g.removeExtension(ui.selId); break;
    case "build":
      if(!g.canAfford(arg)){ flash(missingText(arg, g)); break; }
      clearTools(); ui.buildSel = arg; ui.cat = null; ui.selId = null; ui.sheet = null;
      break;
    case "cancel":
      ui.buildSel = null; ui.roadMode = false; clearTools(); break;
    case "sheet":
      ui.sheet = (ui.sheet===arg ? null : arg); ui.cat = null; ui.selId = null; ui.buildSel = null; ui.roadMode = false; ui.layersOpen = false; clearTools();
      break;
    case "closesheet": ui.sheet = null; ui.cat = null; ui.selId = null; break;
    case "obj": ui.objOpen = !ui.objOpen; break;
    case "layersbtn": ui.layersOpen = !ui.layersOpen; break;
    case "layer": ui.layers[arg] = !ui.layers[arg]; break;
    case "fieldsize": g.setFieldSize(Number(arg)); break;
    /* --- bâtiment sélectionné --- */
    case "selclose": ui.selId = null; break;
    case "assign": if(ui.selId!=null) g.assign(ui.selId); break;
    case "unassign": if(ui.selId!=null) g.unassign(ui.selId); break;
    case "ext":
      if(ui.selId!=null){
        g.buyExtension(ui.selId, arg);
      }
      break;
    case "crop": if(ui.selId!=null) g.setCrop(ui.selId, arg); break;
    case "churchup": if(ui.selId!=null) g.churchUp(ui.selId, arg); break;
    case "policy": g.setPolicy(arg, !g.policies[arg]); break;
    case "demolish":
      if(ui.selId==null) break;
      if(Date.now() < ui.demolishArm){ g.demolish(ui.selId); ui.selId = null; ui.demolishArm = 0; }
      else { ui.demolishArm = Date.now() + 3000; setTimeout(renderUI, 3050); }
      break;
    /* --- actions de la seigneurie --- */
    case "buyox": g.buyOx(); break;
    case "militia": if(!g.raiseMilitia()) flash("Toute la milice disponible est déjà levée."); break;
    case "merc": g.hireMercenary(); break;
    case "claim": g.claimRegion(Number(arg)); break;
    case "resolve": g.resolveEvent(Number(arg)); break;
    /* --- fenêtres --- */
    case "modal": ui.modal = arg; ui.sheet = null; break;
    case "modalclose": ui.modal = null; break;
    case "noop": return;
    case "mute": AudioFX.muted = !AudioFX.muted; break;
    case "text": cycleTextSize(); break;
    case "endcontinue": ui.endSeen = true; break;
    case "mainmenu": {
      uiMenu = true; ui.sheet = null; ui.newSlot = activeSlot;
      for(var fs=0; fs<3; fs++) if(!slotInfo(fs)){ ui.newSlot = fs; break; }   /* un emplacement libre par défaut */
      break;
    }
    case "menuclose": if(game) uiMenu = false; break;
    case "nmode": ui.newMode = arg; break;
    case "ndiff": ui.newDiff = arg; break;
    case "nslot": ui.newSlot = Number(arg); break;
    case "startgame":
      game = new GameState(Math.floor(Math.random()*2000000000), ui.newMode, ui.newDiff);
      activeSlot = Math.max(0, Math.min(2, ui.newSlot));
      SAVE_KEY = SAVE_SLOTS[activeSlot];
      try{ window.localStorage.setItem("seigneurie-last-slot", String(activeSlot)); }catch(e2){}
      persist(game);
      cancelAll(); uiMenu = false; ui.endSeen = false; ui.objOpen = true; ui.lastSpeed = 1;
      centerCam();
      break;
    case "loadslot": {
      var g2 = loadSlot(Number(arg));
      if(g2){
        if(game && game!==g2) persist(game);
        game = g2; activeSlot = Number(arg); SAVE_KEY = SAVE_SLOTS[activeSlot];
        try{ window.localStorage.setItem("seigneurie-last-slot", String(activeSlot)); }catch(e2){}
        cancelAll(); uiMenu = false; ui.endSeen = false; centerCam();
      }
      break;
    }
    case "delslot": {
      var si = Number(arg);
      if(ui.delArm && ui.delArm.slot===si && Date.now() < ui.delArm.t){
        try{ window.localStorage.removeItem(SAVE_SLOTS[si]); }catch(e2){}
        delete _slotCache[si];
        if(si===activeSlot && game){ game = null; }
        ui.delArm = null;
      } else { ui.delArm = { slot:si, t:Date.now()+3000 }; setTimeout(renderUI, 3050); }
      break;
    }
    case "saveCode": {
      var code = encodeSave(g);
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(code).then(function(){ flash("Code de sauvegarde copié !"); }, function(){ window.prompt("Votre code de sauvegarde — copiez-le :", code); });
      } else window.prompt("Votre code de sauvegarde — copiez-le :", code);
      break;
    }
    case "loadCode": {
      var str = window.prompt("Collez un code de sauvegarde :");
      if(str){
        var ng = decodeSave(str);
        if(ng){ game = ng; persist(game); cancelAll(); uiMenu = false; centerCam(); flash("Partie chargée !"); }
        else flash("Code invalide.");
      }
      break;
    }
  }
  renderUI();
});

/* curseur d'impôt (panneau du manoir) */
document.addEventListener("input", function(e){
  if(game && e.target && e.target.id==="taxSlider"){
    game.setTax(Number(e.target.value)/100);
    var lbl = document.getElementById("taxLbl");
    if(lbl) lbl.textContent = Math.round(game.taxRate*100)+" %";
  }
});

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
  click(){ this.tone(660, 0.05, "square", 0.18); },
  good(){ this.tone(523, 0.12, "sine", 0.4); this.tone(784, 0.18, "sine", 0.3); },
  bad(){ this.tone(220, 0.25, "sawtooth", 0.3); },
  build(){ this.tone(330, 0.08, "triangle", 0.35); this.tone(440, 0.1, "triangle", 0.3); },
};
var _lastToastId = -1;
function soundForToasts(g){
  if(!g.log.length) return;
  var last = g.log[g.log.length-1];
  if(_lastToastId<0){ _lastToastId = last.id; return; }
  if(last.id > _lastToastId){
    _lastToastId = last.id;
    if(last.kind==="good") AudioFX.good();
    else if(last.kind==="bad") AudioFX.bad();
  }
}

/* =====================================================================
   RENDU DE L'INTERFACE (toutes les ~300 ms et après chaque action)
   Chaque zone n'est réécrite que si son contenu a changé : le défilement
   des panneaux et l'état des boutons ne « sautent » pas.
   ===================================================================== */
function renderUI(){
  var g = game;
  if(g && ui.selId!=null && !g.buildings.some(function(b){ return b.id===ui.selId; })) ui.selId = null;
  renderTop(g);
  renderHud(g);
  renderTip();
  renderSheet(g);
  renderDock(g);
  renderModal(g);
}

/* ---------- barre du haut ---------- */
function heartIcon(ap){ return ap>=60 ? "heart_g" : ap>=40 ? "heart_y" : "heart_r"; }
function renderTop(g){
  if(!g){ setHTML(elBar, "<span class='mono' style='padding:10px 6px;font-weight:700'>SEIGNEURIE</span>"); setHTML(elRes, ""); return; }
  var homeless = g.families.filter(function(f){ return f.home<0; }).length;
  var apCls = g.approval>=60 ? "good" : g.approval>=40 ? "gold" : "bad";
  var h = "";
  h += "<button class='stat date' data-act='sheet' data-arg='realm'>"+ic(SEASON_IC[g.season()],"l")
     + "<span class='datebox'><span class='m'>"+MONTHS_SHORT[g.time.month]+"</span><span class='y'>"+g.time.year+"</span></span></button>";
  h += "<button class='stat' data-act='sheet' data-arg='realm'>"+ic("coin")+"<span class='v'>"+Math.floor(g.treasury)+"</span></button>";
  h += "<button class='stat "+apCls+"' data-act='sheet' data-arg='realm'>"+ic(heartIcon(g.approval))+"<span class='v'>"+g.approval+"%</span></button>";
  h += "<button class='stat' data-act='sheet' data-arg='realm'>"+ic("family")+"<span class='v'>"+g.families.length+"</span>"
     + (homeless>0 ? "<span class='badge' title='Familles sans logis'>"+homeless+"</span>" : "")+"</button>";
  h += "<span class='grow'></span>";
  var paused = g.speed===0;
  h += "<button class='b sq"+(paused?" gold":"")+"' data-act='pause' aria-label='"+(paused?"Reprendre":"Pause")+"'>"+ic(paused?"play":"pause")+"</button>";
  h += "<button class='b sq' data-act='speedcycle' aria-label='Vitesse'><span class='speedlbl'>×"+(g.speed||ui.lastSpeed||1)+"</span></button>";
  h += "<button class='b sq"+(ui.sheet==="menu"?" on":"")+"' data-act='sheet' data-arg='menu' aria-label='Menu'>"+ic("menu")+"</button>";
  setHTML(elBar, h);

  /* bandeau des réserves (toucher = détail) */
  var food = 0, kinds = 0;
  for(var i=0;i<FOOD_TYPES.length;i++){ var q = g.stock[FOOD_TYPES[i]]||0; food += q; if(q>=1) kinds++; }
  var cold = [9,10,11,0,1].indexOf(g.time.month)>=0;
  var r = "";
  r += rc("timber", g.stock.timber, g.stock.timber<3);
  r += rc("firewood", g.stock.firewood, cold && g.stock.firewood < g.families.length*3);
  r += rc("stone", g.stock.stone, false);
  r += "<span class='rc"+(food < g.families.length*2 ? " low" : "")+"'>"+ic("bread")+Math.floor(food)
     + "<span class='dim' style='font-size:10px'>·"+kinds+"</span></span>";
  ["grain","barley","clothes","ale"].forEach(function(k){ if((g.stock[k]||0)>=1) r += rc(k, g.stock[k], false); });
  if(g.stock.ox>0) r += rc("ox", g.stock.ox, false);
  r += "<span class='rc sep'>"+ic("crown")+Math.floor(g.influence)+"</span>";
  r += "<span class='rc'>"+ic("bag")+Math.floor(g.wealth)+"</span>";
  setHTML(elRes, r);
}
function rc(k, v, low){ return "<span class='rc"+(low?" low":"")+"'>"+ic(k)+Math.floor(v||0)+"</span>"; }

/* ---------- surcouche de la carte : objectifs, notifications, calques, aide à la pose ---------- */
function renderHud(g){
  if(!g){ setHTML(elHudL, ""); setHTML(elHudR, ""); setHTML(elHint, ""); return; }
  var ob = g.objectives;
  var list = [["wood","Bûcherons au travail"],["happy","Approbation ≥ 50 % pendant 3 mois"],["pop","8 familles"],["manor","Un manoir achevé"]];
  var done = list.filter(function(o){ return ob[o[0]]; }).length;
  var l = "<button class='frame pill' data-act='obj'>"+ic("scroll","s")+"<b>Objectifs</b> <span class='"+(done===list.length?"good":"dim")+"'>"+done+"/"+list.length+"</span></button>";
  if(ui.objOpen){
    l += "<div class='frame obj' data-act='obj'>";
    for(var i=0;i<list.length;i++) l += "<div class='"+(ob[list[i][0]]?"done":"")+"'>"+(ob[list[i][0]]?"✔":"○")+" "+list[i][1]+"</div>";
    if(g.victory) l += "<div class='gold'>La seigneurie prospère !</div>";
    l += "</div>";
  }
  /* notifications : les 3 plus récentes, 6 s chacune */
  var now = Date.now();
  var ts = g.toasts.filter(function(t){ return now-t.t<6000; }).slice(-3);
  for(var t=ts.length-1;t>=0;t--){
    var age = now - ts[t].t, op = age>5000 ? Math.max(0, (6000-age)/1000) : 1;
    l += "<div class='toast "+ts[t].kind+"' style='opacity:"+op.toFixed(1)+"'>"+rich(ts[t].text)+"</div>";
  }
  setHTML(elHudL, l);

  /* calques (sous la minimap) */
  var anyLayer = ui.layers.forest||ui.layers.stone||ui.layers.berry||ui.layers.soil;
  var r = "<button class='b sq"+(ui.layersOpen||anyLayer?" on":"")+"' data-act='layersbtn' aria-label='Calques'>"+ic("layers")+"</button>";
  if(ui.layersOpen){
    r += "<div class='frame layers'>";
    [["forest","tree","Forêts"],["stone","stone","Pierre"],["berry","berries","Baies"],["soil","grain","Fertilité"]].forEach(function(L){
      r += "<button class='b"+(ui.layers[L[0]]?" on":"")+"' data-act='layer' data-arg='"+L[0]+"'>"+ic(L[1])+L[2]+"</button>";
    });
    r += "</div>";
  }
  setHTML(elHudR, r);

  /* aide à la pose (bas de l'écran) */
  var h = "";
  if(ui.flash) h += "<div class='flash'>"+esc(ui.flash)+"</div>";
  if(ui.zoneMode){
    var zo = zoneOverlay(g), zp = ui.zonePts.length, zpl2 = zo && zo.plan, ztxt, ztitle = "Zone de bourgages", zok = ui.zoneClosed && zpl2 && !zpl2.err;
    if(!ui.zoneClosed) ztxt = zp===0 ? "Touchez la carte pour poser les points du contour, le long d'une route."
      : zp<3 ? zp+" point"+(zp>1?"s":"")+" posé"+(zp>1?"s":"")+". Continuez le contour."
      : zp+" points. Touchez le premier point (doré) ou « Fermer ».";
    else if(!zok) ztxt = zpl2 ? zpl2.err : "";
    else {
      var zs = zpl2.plots.map(function(p){ return p.cells.length-1; }), zmn = Math.min.apply(null, zs), zmx = Math.max.apply(null, zs);
      ztitle = zpl2.plots.length+" maison"+(zpl2.plots.length>1?"s":"")+" "+costHtml({ timber:zpl2.plots.length*(BUILD_DEFS.burgage.cost.timber||0) }, g);
      ztxt = "Jardins de "+(zmn===zmx ? zmn : zmn+" à "+zmx)+" case"+(zmx>1?"s":"")+(zpl2.limited ? " · bois insuffisant pour plus" : "")+". Glissez un point pour ajuster.";
    }
    h += "<div class='frame place wrap'>"+ic("house","l")+"<div class='t'><b>"+ztitle+"</b><span>"+esc(ztxt)+"</span></div><div class='sizes'>";
    if(zp>0) h += "<button class='b' data-act='zoneundo' aria-label='Annuler le dernier point'>↶</button>";
    if(!ui.zoneClosed && zp>=3) h += "<button class='b' data-act='zoneclose'>Fermer</button>";
    if(zok) h += "<button class='b' data-act='zoneminus' data-arg='-1' aria-label='Une maison de moins'>−</button><button class='b' data-act='zoneplus' data-arg='1' aria-label='Une maison de plus'>+</button><button class='b gold' data-act='zoneok'>Tracer</button>";
    h += "</div><button class='b sq' data-act='cancel' aria-label='Annuler'>"+ic("close")+"</button></div>";
  } else if(ui.roadMode){
    h += "<div class='frame place'>"+ic("road","l")+"<div class='t'><b>Routes</b><span>Touchez une case pour tracer ou effacer. Les villageois y marchent plus vite.</span></div>"
       + "<button class='b gold' data-act='cancel'>Terminer</button></div>";
  } else if(ui.buildSel){
    var d = BUILD_DEFS[ui.buildSel];
    h += "<div class='frame place'><div class='t'><b>"+esc(d.name)+" "+costHtml(d.cost, g)+"</b><span>Touchez la carte pour poser"
       + (UNIQUE[ui.buildSel] ? "" : " (plusieurs à la suite)")+". Appui long pour annuler.</span></div>";
    if(d.uiSize){
      h += "<div class='sizes'>";
      for(var si=0; si<FIELD_SIZES.length; si++) h += "<button class='b"+(g.fieldSize()===FIELD_SIZES[si]?" on":"")+"' data-act='fieldsize' data-arg='"+FIELD_SIZES[si]+"'>"+FIELD_SIZES[si]+"×"+FIELD_SIZES[si]+"</button>";
      h += "</div>";
    }
    h += "<button class='b sq' data-act='cancel' aria-label='Annuler'>"+ic("close")+"</button></div>";
  }
  setHTML(elHint, h);
}
function renderTip(){
  var txt = ui.hoverTip || (ui.tip && Date.now()<ui.tipT ? ui.tip : "");
  if(elSheet._h || elHint._h) txt = "";
  setHTML(elTip, txt ? esc(txt) : "");
}

/* ---------- feuille du bas ---------- */
function renderSheet(g){
  if(ui.taxDrag) return;
  var h = "";
  if(g && !uiMenu){
    if(ui.cat) h = sheetBuild(g, ui.cat);
    else if(ui.selId!=null) h = sheetSelection(g);
    else if(ui.sheet==="stock") h = sheetStock(g);
    else if(ui.sheet==="realm") h = sheetRealm(g);
    else if(ui.sheet==="menu") h = sheetMenu(g);
  }
  var reset = elSheet._key !== (ui.cat||"")+"|"+ui.selId+"|"+(ui.sheet||"");
  setHTML(elSheet, h);
  if(reset){ elSheet._key = (ui.cat||"")+"|"+ui.selId+"|"+(ui.sheet||""); elSheet.scrollTop = 0; }
}
function head(pic, title, sub){
  return "<div class='sh-head'>"+pic+"<div class='tt'><b>"+title+"</b>"+(sub?"<span>"+sub+"</span>":"")+"</div>"
       + "<button class='b sq' data-act='closesheet' aria-label='Fermer'>"+ic("close")+"</button></div>";
}

/* tiroir de construction d'une catégorie */
function sheetBuild(g, catId){
  var cat = CATS.filter(function(c){ return c.id===catId; })[0];
  if(!cat) return "";
  var h = head(ic(cat.icon,"l"), cat.name, cat.hint);
  h += "<div class='cards'>";
  for(var i=0;i<cat.items.length;i++){
    var id = cat.items[i], d = BUILD_DEFS[id];
    var ok = g.canAfford(id);
    var built = g.buildings.filter(function(b){ return b.def===id; }).length;
    h += "<button class='card"+(ok?"":" off")+(ui.buildSel===id?" on":"")+"' data-act='build' data-arg='"+id+"'>"
       + "<span class='pic'>"+ICONS.th(id)+"</span><span class='nm'>"+esc(d.name)+"</span>"
       + "<span>"+costHtml(d.cost, g)+"</span>"
       + "<span class='ws'>"+(d.fam>0 ? d.fam+" famille"+(d.fam>1?"s":"") : (id==="burgage" ? "loge 1 famille" : "sans ouvrier"))+(built ? " · "+built+" posé"+(built>1?"s":"") : "")+"</span></button>";
  }
  var acts = cat.actions || [];
  for(var a=0;a<acts.length;a++){
    if(acts[a]==="zone") h += actionCard("zone", ic("house","l"), "Tracer une zone", costHtml(BUILD_DEFS.burgage.cost, g)+"<span class='dim'> / maison</span>", "Parcelles le long d'une route");
    if(acts[a]==="buyox") h += actionCard("buyox", ic("ox","l"), "Acheter un bœuf", "<span class='cost"+(g.treasury<20?" no":"")+"'>20"+ic("coin","s")+"</span>", "Labour et transport plus rapides");
    if(acts[a]==="militia") h += actionCard("militia", ic("sword","l"), "Lever la milice", "<span class='cost'>"+g.units.length+" / "+g.militiaCount()+"</span>", "1 soldat pour 2 familles");
    if(acts[a]==="merc") h += actionCard("merc", ic("shield","l"), "Mercenaire", "<span class='cost"+(g.treasury<25?" no":"")+"'>25"+ic("coin","s")+"</span>", "Loué pour 6 mois");
  }
  h += "</div>";
  return h;
}
function actionCard(act, pic, name, cost, sub){
  return "<button class='card' data-act='"+act+"'><span class='pic' style='align-items:center'>"+pic+"</span><span class='nm'>"+name+"</span><span>"+cost+"</span><span class='ws'>"+sub+"</span></button>";
}

/* panneau du bâtiment sélectionné */
function sheetSelection(g){
  var sel = g.buildings.filter(function(b){ return b.id===ui.selId; })[0];
  if(!sel) return "";
  var d = BUILD_DEFS[sel.def];
  var status = g.workStatus(sel);
  var h = head(ICONS.th(sel.def), esc(d.name)+(sel.def==="burgage" ? " · niveau "+sel.lvl : ""), status ? esc(status) : "");
  h += "<div class='desc'>"+esc(d.desc)+"</div>";
  if(!sel.done){
    h += "<div class='row'><span class='dim'>Chantier</span>"+bar(sel.progress||0,"gold")+"<b>"+Math.round((sel.progress||0)*100)+" %</b></div>";
    h += "<div class='dim' style='font-size:11px'>Les journaliers (familles sans emploi) construisent les chantiers.</div>";
  }
  if(d.fam>0){
    h += "<div class='sec'>Ouvriers</div><div class='row'><div class='stepper'>"
       + "<button class='b sq' data-act='unassign' aria-label='Retirer une famille'>−</button>"
       + "<span class='n'>"+sel.families.length+"/"+d.fam+"</span>"
       + "<button class='b sq' data-act='assign' aria-label='Affecter une famille'>+</button></div>"
       + "<span class='dim'>"+ic("family","s")+" "+g.unemployed()+" journalier"+(g.unemployed()>1?"s":"")+" libre"+(g.unemployed()>1?"s":"")+"</span></div>";
  }
  if(sel.def==="burgage"){
    var fam = g.families.filter(function(f){ return f.home===sel.id; })[0];
    h += "<div class='kv'><span class='k'>"+ic("family","s")+(fam ? esc(fam.name) : "Logement vacant")+"</span>"
       + (sel.monthsGood>0 ? "<span class='v good'>Bien loti : "+sel.monthsGood+" mois</span>" : "")+"</div>";
    if(sel.done){
      var exts = sel.exts || [];
      if(sel.plot){
        /* parcelle tracée : une seule chose, qui remplit l'arrière-cour et produit selon sa taille */
        var yn = g.yardSize(sel), yfs = g.yardFactor(sel).toFixed(1).replace(".", ",");
        h += "<div class='sec'>Arrière-cour · "+yn+" case"+(yn>1?"s":"")+" · rendement ×"+yfs+"</div>";
        if(exts.length){
          var cur = EXT_DEFS[exts[0]];
          h += "<div class='ext have'><span class='t'><b>"+esc(cur.name)+" ×"+yfs+"</b><span>"+esc(cur.desc)+"</span></span><button class='b' data-act='extrm'>Retirer</button></div>";
        } else {
          h += "<div class='dim' style='font-size:11px;margin:2px 0 4px'>Une seule chose par arrière-cour : elle s'étend sur toute la cour.</div>";
          for(var ej=0; ej<EXT_ORDER.length; ej++){
            var ed2 = EXT_DEFS[EXT_ORDER[ej]];
            if(sel.lvl < ed2.lvl) h += "<div class='ext' style='opacity:.5;cursor:default'><span class='t'><b>"+esc(ed2.name)+"</b><span>Bourgage niveau "+ed2.lvl+" requis</span></span></div>";
            else h += "<button class='ext' data-act='ext' data-arg='"+ed2.id+"'><span class='t'><b>"+esc(ed2.name)+" ×"+yfs+"</b><span>"+esc(ed2.desc)+"</span></span>"+costHtml(ed2.cost, g)+"</button>";
          }
        }
      }
      else h += "<div class='sec'>Arrière-cour</div>";
      for(var ei=0; ei<(sel.plot ? 0 : EXT_ORDER.length); ei++){
        var ed = EXT_DEFS[EXT_ORDER[ei]];
        var have = exts.indexOf(ed.id)>=0, locked = sel.lvl < ed.lvl;
        if(have) h += "<div class='ext have'><span class='t'><b>"+esc(ed.name)+"</b><span>"+esc(ed.desc)+"</span></span><span class='good'>✔</span></div>";
        else if(locked) h += "<div class='ext' style='opacity:.5;cursor:default'><span class='t'><b>"+esc(ed.name)+"</b><span>Bourgage niveau "+ed.lvl+" requis</span></span></div>";
        else h += "<button class='ext' data-act='ext' data-arg='"+ed.id+"'><span class='t'><b>"+esc(ed.name)+"</b><span>"+esc(ed.desc)+"</span></span>"+costHtml(ed.cost, g)+"</button>";
      }
    }
  }
  if(sel.def==="field" && sel.f){
    h += "<div class='sec'>Culture · "+sel.w+"×"+sel.h+"</div><div class='row'>";
    for(var ci=0; ci<CROP_ORDER.length; ci++){
      var cd = CROP_DEFS[CROP_ORDER[ci]];
      h += "<button class='b"+(sel.f.crop===cd.id?" on":"")+"' data-act='crop' data-arg='"+cd.id+"'>"+(cd.yield ? ic(cd.yield==="grain"?"grain":"barley","s") : "")+esc(cd.name)+"</button>";
    }
    h += "</div><div class='desc'>"+esc(CROP_DEFS[sel.f.crop].desc)+"</div>";
    h += "<div class='kv'><span class='k'>Fertilité</span>"+bar(sel.f.fert, sel.f.fert<0.35?"red":"")+"<span class='v'>"+Math.round(sel.f.fert*100)+" %</span></div>";
    h += "<div class='kv'><span class='k'>Labour</span>"+bar(sel.f.plow,"gold")+"<span class='v'>"+Math.round(sel.f.plow*100)+" %</span></div>";
    h += "<div class='kv'><span class='k'>"+(sel.f.sown ? "Croissance" : (sel.f.growth>0 ? "Mûr" : "En attente"))+"</span>"+bar(sel.f.sown ? sel.f.growth : 0)+"<span class='v'>"+(sel.f.sown ? Math.round(sel.f.growth*100)+" %" : "—")+"</span></div>";
    if(sel.f.harvestP>0) h += "<div class='kv'><span class='k'>Moisson</span>"+bar(sel.f.harvestP,"gold")+"<span class='v'>"+Math.round(sel.f.harvestP*100)+" %</span></div>";
    if(!g.buildings.some(function(b){ return b.def==="farm" && b.done && b.families.length>0; })) h += "<div class='bad' style='font-size:12px;margin-top:6px'>Aucune ferme active : ce champ ne sera pas travaillé.</div>";
  }
  if(sel.def==="farm" && sel.done){
    h += "<div class='kv'><span class='k'>"+ic("ox","s")+"Bœufs à l'écurie</span><span class='v'>"+(g.stock.ox||0)+"</span>"
       + "<button class='b' data-act='buyox'>+1 · 20"+ic("coin","s")+"</button></div>";
  }
  if(sel.def==="trade" && sel.done){
    h += "<div class='sec'>Prix du marché (deniers)</div><div class='chips'>";
    for(var pk in g.prices) h += "<span class='chip'>"+(RES[pk] ? ic(pk,"s") : esc(pk))+" "+g.prices[pk]+"</span>";
    h += "</div>";
  }
  if(sel.def==="church" && sel.done){
    var cups = sel.churchUp || [];
    h += "<div class='sec'>Améliorations</div>";
    for(var cui=0; cui<CHURCH_UP_ORDER.length; cui++){
      var cu = CHURCH_UPGRADES[CHURCH_UP_ORDER[cui]];
      if(cups.indexOf(cu.id)>=0) h += "<div class='ext have'><span class='t'><b>"+esc(cu.name)+"</b><span>"+esc(cu.desc)+"</span></span><span class='good'>✔</span></div>";
      else h += "<button class='ext' data-act='churchup' data-arg='"+cu.id+"'><span class='t'><b>"+esc(cu.name)+"</b><span>"+esc(cu.desc)+"</span></span>"+costHtml(cu.cost, g)+"</button>";
    }
  }
  if(sel.def==="manor" && sel.done){
    h += "<div class='sec'>Impôt</div><div class='row'><span>Taux</span><b id='taxLbl'>"+Math.round(g.taxRate*100)+" %</b></div>";
    h += "<input type='range' min='0' max='100' step='5' id='taxSlider' value='"+Math.round(g.taxRate*100)+"'/>";
    h += "<div class='dim' style='font-size:11px'>Au-delà de 10 %, l'approbation baisse.</div>";
    h += "<div class='sec'>Décrets</div>";
    for(var pi=0; pi<POLICY_ORDER.length; pi++){
      var pd = POLICY_DEFS[POLICY_ORDER[pi]], on = !!g.policies[pd.id];
      h += "<button class='ext"+(on?" have":"")+"' style='cursor:pointer' data-act='policy' data-arg='"+pd.id+"'><span class='t'><b>"+esc(pd.name)+"</b><span>"+esc(pd.desc)+"</span></span><span class='"+(on?"good":"dim")+"'>"+(on?"Actif":"—")+"</span></button>";
    }
  }
  var armed = Date.now() < ui.demolishArm;
  h += "<button class='b red wide' data-act='demolish'>"+(armed ? "Toucher encore pour confirmer" : "Démolir (moitié remboursée)")+"</button>";
  return h;
}

/* réserves détaillées */
function sheetStock(g){
  var cap = g.capFor("timber");
  var food = 0, kinds = 0;
  for(var i=0;i<FOOD_TYPES.length;i++){ var q = g.stock[FOOD_TYPES[i]]||0; food += q; if(q>=1) kinds++; }
  var h = head(ic("crate","l"), "Réserves", "Capacité : "+cap+" par ressource · "+g.storehouseCount()+" entrepôt(s)");
  function line(k){ var v = Math.floor(g.stock[k]||0); return "<div class='kv'><span class='k'>"+ic(k)+RES[k].n+"</span>"+bar(v/cap, v>=cap?"gold":"")+"<span class='v' style='min-width:36px;text-align:right'>"+v+"</span></div>"; }
  h += "<div class='sec'>Matériaux</div>"+line("timber")+line("stone");
  h += "<div class='sec'>Chauffage</div>"+line("firewood");
  h += "<div class='sec'>Nourriture · "+Math.floor(food)+" · variété "+kinds+"/"+FOOD_TYPES.length+"</div>";
  if(!g.marketActive()) h += "<div class='bad' style='font-size:12px'>Sans marché actif, chaque famille ne reçoit qu'un type de nourriture.</div>";
  FOOD_TYPES.forEach(function(k){ h += line(k); });
  h += "<div class='sec'>Ingrédients</div>"+line("grain")+line("barley");
  h += "<div class='sec'>Biens</div>"+line("clothes")+line("ale");
  h += "<div class='sec'>Bétail</div><div class='kv'><span class='k'>"+ic("ox")+"Bœufs</span><span class='v'>"+(g.stock.ox||0)+"</span><button class='b' data-act='buyox'>+1 · 20"+ic("coin","s")+"</button></div>";
  return h;
}

/* vue d'ensemble de la seigneurie */
function sheetRealm(g){
  var homeless = g.families.filter(function(f){ return f.home<0; }).length;
  var h = head(ic("crown","l"), esc(g.settlementName()), esc(g.mode().name)+" · "+esc(g.diff().name)+" · "+MONTHS[g.time.month]+" "+g.time.year);
  h += "<div class='kv'><span class='k'>"+ic("coin")+"Trésor</span><span class='v'>"+Math.floor(g.treasury)+" deniers</span></div>";
  h += "<div class='kv'><span class='k'>"+ic(heartIcon(g.approval))+"Approbation</span>"+bar(g.approval/100, g.approval<40?"red":g.approval<60?"gold":"")+"<span class='v'>"+g.approval+" %</span></div>";
  h += "<div class='kv'><span class='k'>"+ic("family")+"Familles</span><span class='v'>"+g.families.length+"</span></div>";
  h += "<div class='kv'><span class='k' style='padding-left:24px'>Journaliers (sans emploi)</span><span class='v'>"+g.unemployed()+"</span></div>";
  h += "<div class='kv'><span class='k' style='padding-left:24px'>Bourgages libres</span><span class='v'>"+g.freeBurgages()+"</span></div>";
  if(homeless) h += "<div class='kv'><span class='k bad' style='padding-left:24px'>Sans logis</span><span class='v bad'>"+homeless+"</span></div>";
  h += "<div class='kv'><span class='k'>"+ic("crown")+"Influence</span><span class='v'>"+Math.floor(g.influence)+"</span></div>";
  h += "<div class='kv'><span class='k'>"+ic("bag")+"Richesse régionale</span><span class='v'>"+Math.floor(g.wealth)+"</span></div>";
  h += "<div class='kv'><span class='k'>"+ic("coin")+"Impôt</span><span class='v'>"+(g.hasManor() ? Math.round(g.taxRate*100)+" %" : "manoir requis")+"</span></div>";
  h += "<div class='kv'><span class='k'>"+ic("sword")+"Soldats</span><span class='v'>"+g.units.length+" / "+g.militiaCount()+"</span></div>";
  if(g.time.year>=1177) h += "<div class='kv'><span class='k bad'>"+ic("shield")+esc(g.baron.name)+"</span><span class='v bad'>puissance "+g.baron.power+"</span></div>";
  h += "<div class='row' style='margin-top:10px'><button class='b' data-act='modal' data-arg='regions'>"+ic("flag")+"Régions</button>"
     + "<button class='b' data-act='modal' data-arg='log'>"+ic("scroll")+"Journal</button>"
     + "<button class='b' data-act='sheet' data-arg='stock'>"+ic("crate")+"Réserves</button></div>";
  return h;
}

/* menu (☰) */
function sheetMenu(g){
  var h = head(ic("menu","l"), "Menu", "Slot "+(activeSlot+1)+" · sauvegarde automatique");
  h += "<div class='menu-list'>";
  h += "<button class='b wide' data-act='modal' data-arg='regions'>"+ic("flag")+"Régions du domaine</button>";
  h += "<button class='b wide' data-act='modal' data-arg='log'>"+ic("scroll")+"Journal des événements</button>";
  h += "<button class='b wide' data-act='modal' data-arg='help'>"+ic("help")+"Comment jouer</button>";
  h += "<button class='b wide' data-act='mute'>"+ic(AudioFX.muted?"mute":"sound")+"Son : "+(AudioFX.muted?"coupé":"activé")+"</button>";
  h += "<button class='b wide' data-act='text'><b class='mono' style='width:18px'>Aa</b>Taille du texte : "+TXT_NAMES[_txtSize]+"</button>";
  h += "<button class='b wide' data-act='saveCode'>"+ic("scroll")+"Copier un code de sauvegarde</button>";
  h += "<button class='b wide' data-act='loadCode'>"+ic("scroll")+"Charger un code de sauvegarde</button>";
  h += "<button class='b wide gold' data-act='mainmenu'>"+ic("house")+"Menu principal (parties, nouvelle partie)</button>";
  h += "</div>";
  return h;
}

/* ---------- dock des catégories ---------- */
function renderDock(g){
  if(!g || uiMenu){ setHTML(elDock, ""); elDock.style.display = "none"; return; }
  elDock.style.display = "";
  var h = "";
  for(var i=0;i<CATS.length;i++){
    var c = CATS[i];
    var on = c.tool ? ui.roadMode : (ui.cat===c.id || (ui.buildSel && c.items.indexOf(ui.buildSel)>=0) || (c.id==="home" && (ui.zoneMode || ui.extPlace)));
    h += "<button class='cat"+(on?" on":"")+"' data-act='cat' data-arg='"+c.id+"'>"+ic(c.icon)+"<span>"+c.name+"</span></button>";
  }
  setHTML(elDock, h);
}

/* ---------- fenêtres ---------- */
function renderModal(g){
  var h = "", big = false;
  if(uiMenu || !g){ h = modalMenu(g); big = true; }
  else if((g.victory || g.defeat) && !ui.endSeen) h = modalEnd(g);
  else if(g.pendingEvent) h = modalEvent(g);
  else if(ui.modal==="help"){ h = modalHelp(); big = true; }
  else if(ui.modal==="log"){ h = modalLog(g); big = true; }
  else if(ui.modal==="regions"){ h = modalRegions(g); big = true; }
  elModal.classList.toggle("hide", !h);
  elCard.classList.toggle("big", big);
  var key = uiMenu ? "menu" : (ui.modal||"") + (g && g.pendingEvent ? "ev" : "");
  setHTML(elCard, h);
  if(elCard._key!==key){ elCard._key = key; elCard.scrollTop = 0; }
}
function closeBtn(){ return "<button class='b wide' data-act='modalclose'>Fermer</button>"; }

function modalMenu(g){
  var h = "<h2>"+ICONS.th("manor")+"Seigneurie</h2>";
  h += "<p class='dim'>Fondez un village médiéval, nourrissez et logez vos familles, et faites-le prospérer au fil des saisons.</p>";
  var any = false, s = "";
  for(var i=0;i<3;i++){
    var info = slotInfo(i);
    if(!info) continue;
    any = true;
    var armed = ui.delArm && ui.delArm.slot===i && Date.now()<ui.delArm.t;
    s += "<div class='slot'><button class='opt' data-act='loadslot' data-arg='"+i+"'><b>Slot "+(i+1)+" · "+esc(info.level)+" de "+info.pop+" familles"
       + (info.victory?" · victoire":"")+(info.defeat?" · défaite":"")+"</b><span>"+esc(info.mode)+" · "+esc(info.diff)+" · "+MONTHS[info.month]+" "+info.year+"</span></button>"
       + "<button class='b red' data-act='delslot' data-arg='"+i+"'>"+(armed?"Effacer ?":ic("close"))+"</button></div>";
  }
  if(any) h += "<h3>Reprendre une partie</h3>"+s;
  h += "<h3>Nouvelle partie</h3>";
  for(var m=0;m<MODES.length;m++){
    var md = MODES[m];
    h += "<button class='opt"+(ui.newMode===md.id?" on":"")+"' data-act='nmode' data-arg='"+md.id+"'><b>"+esc(md.name)+"</b><span>"+esc(md.desc)+"</span></button>";
  }
  h += "<h3>Difficulté</h3><div class='seg'>";
  for(var d=0;d<DIFFICULTIES.length;d++){
    var dd = DIFFICULTIES[d];
    h += "<button class='opt"+(ui.newDiff===dd.id?" on":"")+"' data-act='ndiff' data-arg='"+dd.id+"'><b>"+esc(dd.name)+"</b></button>";
  }
  h += "</div><h3>Emplacement</h3><div class='seg'>";
  for(var k=0;k<3;k++){
    var used = !!slotInfo(k);
    h += "<button class='opt"+(ui.newSlot===k?" on":"")+"' data-act='nslot' data-arg='"+k+"'><b>Slot "+(k+1)+"</b><span>"+(used?"occupé":"libre")+"</span></button>";
  }
  h += "</div>";
  if(slotInfo(ui.newSlot)) h += "<p class='bad' style='font-size:12px'>Attention : la partie du slot "+(ui.newSlot+1)+" sera remplacée.</p>";
  h += "<button class='b gold wide' data-act='startgame'>Commencer</button>";
  if(g) h += "<button class='b wide' data-act='menuclose'>Retour à la partie</button>";
  return h;
}
function modalEnd(g){
  var win = g.victory;
  var h = "<h2>"+(win ? ic("crown","l")+"Victoire !" : ic("heart_r","l")+"Défaite")+"</h2>";
  h += "<p>"+esc(g.mode().name)+" · "+esc(g.diff().name)+"</p>";
  h += "<p>"+MONTHS[g.time.month]+" "+g.time.year+" — "+esc(g.settlementName())+" de "+g.families.length+" familles.</p>";
  h += "<p>Trésor : "+Math.floor(g.treasury)+" deniers · Influence : "+Math.floor(g.influence)+" · Approbation : "+g.approval+" %</p>";
  if(!win && g.endReason) h += "<p class='dim'>Cause : "+rich(g.endReason)+"</p>";
  h += "<button class='b gold wide' data-act='mainmenu'>Nouvelle partie</button>";
  h += "<button class='b wide' data-act='endcontinue'>Continuer à jouer</button>";
  return h;
}
function modalEvent(g){
  var ev = g.pendingEvent;
  var h = "<h2>"+ic("scroll","l")+rich(ev.title)+"</h2><p>"+rich(ev.text)+"</p>";
  for(var i=0;i<ev.choices.length;i++){
    var c = ev.choices[i];
    h += "<button class='b wide"+(c.disabled?" dis":"")+"' data-act='resolve' data-arg='"+i+"'"+(c.disabled?" disabled":"")+">"+rich(c.label)+"</button>";
  }
  return h;
}
function modalLog(g){
  var h = "<h2>"+ic("scroll","l")+"Journal</h2>";
  if(!g.log.length) h += "<p class='dim'>Aucun événement pour le moment.</p>";
  for(var i=g.log.length-1;i>=0;i--){
    var le = g.log[i];
    h += "<div class='log-line "+(le.kind==="bad"?"bad":le.kind==="good"?"good":"")+"'><span class='dim'>"+MONTHS_SHORT[le.month]+" "+le.year+"</span> · "+rich(le.text)+"</div>";
  }
  return h + closeBtn();
}
function modalRegions(g){
  var h = "<h2>"+ic("flag","l")+"Régions</h2>";
  h += "<p class='dim'>Réclamer une région coûte "+REGION_COST.treasury+" deniers et "+REGION_COST.wealth+" de richesse régionale (vous avez "+Math.floor(g.treasury)+" et "+Math.floor(g.wealth)+").</p>";
  for(var i=0;i<REGION_DEFS.length;i++){
    var rd = REGION_DEFS[i], rr = g.regions[i];
    var baron = g.baron.regions.indexOf(i)>=0;
    h += "<h3>"+esc(rd.name)+(rr.owned ? " · <span class='good'>à vous</span>" : baron ? " · <span class='bad'>au Baron</span>" : "")+"</h3>";
    h += "<p style='font-size:12px'>"+esc(rd.desc)+"</p>";
    if(!rr.owned){
      var can = g.treasury>=REGION_COST.treasury && g.wealth>=REGION_COST.wealth;
      h += "<button class='b"+(can?" gold":" dis")+"' data-act='claim' data-arg='"+i+"'>Réclamer · "+REGION_COST.treasury+ic("coin","s")+" "+REGION_COST.wealth+ic("bag","s")+"</button>";
    }
  }
  return h + closeBtn();
}
function modalHelp(){
  var h = "<h2>"+ic("help","l")+"Comment jouer</h2>";
  h += "<h3>Premiers pas</h3><p>Ouvrez <b>Ressources</b> dans la barre du bas et posez un <b>camp de bûcherons</b> près d'une forêt. Touchez-le, puis <b>+</b> pour lui affecter une famille. Les familles sans emploi (journaliers) construisent les chantiers.</p>";
  h += "<h3>Nourrir et chauffer</h3><p>Cueilleuses (baies, de mars à novembre) et chasseurs (viande) nourrissent le village. La <b>variété</b> de nourriture fait monter l'approbation, et il faut un <b>marché</b> actif pour la distribuer. L'hiver, la consommation de bois de chauffe double : faites des réserves avant décembre.</p>";
  h += "<h3>Agriculture</h3><p>Les champs sont gratuits ; une <b>ferme</b> les laboure au printemps et moissonne en septembre. Le <b>moulin</b> transforme le grain en pain. Une année de jachère restaure la fertilité.</p>";
  h += "<h3>Croissance</h3><p>Une approbation d'au moins 55 % et un bourgage libre attirent une nouvelle famille. Les bourgages bien approvisionnés montent de niveau et débloquent des arrière-cours (potager, rucher, atelier…). Le <b>manoir</b> permet de lever l'impôt.</p>";
  h += "<h3>Commandes</h3><p>Glisser pour déplacer · pincer ou molette pour zoomer · toucher un bâtiment pour l'ouvrir · <b>appui long</b> pour annuler · toucher la minimap pour s'y rendre. Le bandeau des réserves et la date ouvrent le détail. Au clavier : Espace = pause, 1/2/3 = vitesse, ZQSD = caméra, Échap = annuler.</p>";
  h += "<h3>Sauvegarde</h3><p>Automatique sur cet appareil (3 emplacements). Le menu permet de copier un code pour continuer sur un autre appareil.</p>";
  return h + "<button class='b gold wide' data-act='modalclose'>Compris</button>";
}

renderUI();

/* ----- boucle principale ----- */
var _lastT = performance.now(), _acc = 0, _uiAcc = 0, _saveAcc = 0;
/* étape 3 : outils de zone et de pose dans la cour */
function clearTools(){ ui.zoneMode = false; ui.zonePts = []; ui.zoneClosed = false; ui.zoneN = null; ui.extPlace = null; zoneDrag = { i:-1 }; }
var zoneDrag = { i:-1 }, lastPtrType = "mouse";
function nearZonePt(x, y){
  var r = Math.max(0.35, 30/(16*cam.zoom)), best = -1;
  for(var i=0; i<ui.zonePts.length; i++){ var d = Math.hypot(ui.zonePts[i][0]-x, ui.zonePts[i][1]-y); if(d<=r){ r = d; best = i; } }
  return best;
}
var _zoneKey = "", _zoneOv = null;
function zoneOverlay(g){
  if(!ui.zoneMode || ui.zonePts.length===0) return null;
  var key = JSON.stringify(ui.zonePts)+"|"+ui.zoneClosed+"|"+ui.zoneN+"|"+g.uiVersion+"|"+g.buildings.length+"|"+Math.floor(g.stock.timber);
  if(key===_zoneKey) return _zoneOv;
  _zoneKey = key;
  _zoneOv = { pts:ui.zonePts.slice(), closed:ui.zoneClosed, plan: ui.zoneClosed ? g.planZone(ui.zonePts, ui.zoneN==null ? undefined : ui.zoneN) : null };
  return _zoneOv;
}

function loop(now){
  var dt = Math.min(200, now-_lastT); _lastT = now;
  if(game && game.speed>0 && !game.pendingEvent && !uiMenu){
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
  if(camGoal){
    cam.y += (camGoal.y - cam.y)*Math.min(1, dt*0.012);
    if(Math.abs(camGoal.y - cam.y) < 0.02){ cam.y = camGoal.y; camGoal = null; }
  }
  _saveAcc += dt;
  if(game && _saveAcc>5000){ _saveAcc = 0; persist(game); }
  if(game) soundForToasts(game);
  _uiAcc += dt;
  if(_uiAcc>300){ _uiAcc = 0; renderUI(); }
  if(game){ RENDER.setOverlay(zoneOverlay(game)); drawGame(ctx, game, cam, canvas, hover, ui.buildSel, ui.selId, ui.layers, now); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* sauvegarde quand on quitte / cache l'application */
document.addEventListener("visibilitychange", function(){ if(document.hidden) persist(game); });
window.addEventListener("beforeunload", function(){ persist(game); });
