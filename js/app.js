/* ============ SEIGNEURIE — application mobile (vanilla JS) ============
   Interface pensée pour un téléphone tenu en portrait :
   - barre du haut compacte (date, trésor, approbation, familles, vitesse, menu) + bandeau des réserves ;
   - carte plein écran, minimap en haut à droite, objectifs repliables, notifications discrètes ;
   - dock du bas par catégories (comme Manor Lords) qui ouvre un tiroir de construction ;
   - panneaux en « feuille du bas » (bâtiment sélectionné, réserves, seigneurie, menu).
   ===================================================================== */
/* ===== les sauvegardes, sur l'appareil =====
   Autant de parties qu'on veut, chacune sous une clé « seigneurie-save-v2-N » (les trois anciens emplacements sont
   les clés 1 à 3 : rien n'est perdu). Un index garde, pour chacune, son nom, le moment de la dernière sauvegarde et
   un résumé (mode, date, familles), pour afficher la liste sans tout relire.
   Dans un navigateur : le stockage local (dont on demande qu'il soit gardé). Dans l'application Android : en plus,
   un fichier par partie dans la mémoire de l'application (pont « SeigneurieAndroid »), qui survit à un vidage de la
   vue web et suit la sauvegarde automatique d'Android. C'est lui qu'on lit d'abord. */
var SAVE_PREFIX = "seigneurie-save-v2-";
var INDEX_KEY = "seigneurie-saves-index";
var activeKey = null;     // la partie en cours
var NATIVE = (typeof window!=="undefined" && window.SeigneurieAndroid) || null;
// moment d'une sauvegarde, lu sans tout décoder (pour garder la plus récente des deux copies)
function saveMoment(str){
  var m = /"time":\{"tick":(\d+),"day":(\d+),"month":(\d+),"year":(\d+)\}/.exec(str || "");
  return m ? ((Number(m[4])*12 + Number(m[3]))*32 + Number(m[2]))*1000 + Number(m[1]) : -1;
}
function storeGet(k){
  var v = null, w = null;
  if(NATIVE){ try{ v = NATIVE.load(k) || null; }catch(e){ v = null; } }
  try{ w = window.localStorage.getItem(k); }catch(e){}
  if(v==null) return w;
  if(w!=null && w!==v && saveMoment(w) > saveMoment(v)) return w;   // le fichier a au plus 30 s de retard
  return v;
}
function storeSet(k, v, nativeOnly){
  var ok = false;
  if(!nativeOnly || !NATIVE){ try{ window.localStorage.setItem(k, v); ok = true; }catch(e){} }
  if(NATIVE){ try{ if(NATIVE.save(k, String(v))) ok = true; }catch(e){} }
  return ok;
}
function storeDel(k){ try{ window.localStorage.removeItem(k); }catch(e){} if(NATIVE){ try{ NATIVE.remove(k); }catch(e){} } }
try{ if(!NATIVE && navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch(e){}

/* l'index des parties */
var saveIndex = { list:[], next:4 };
function readIndex(){
  var idx = null;
  try{ idx = JSON.parse(storeGet(INDEX_KEY) || "null"); }catch(e){ idx = null; }
  if(!idx || !Array.isArray(idx.list)) idx = { list:[], next:4 };
  idx.list = idx.list.filter(function(e){ return e && typeof e.key==="string" && e.key.indexOf(SAVE_PREFIX)===0; });
  // les parties présentes sur l'appareil mais absentes de l'index (anciens emplacements, index perdu)
  var keys = {};
  try{ for(var i=0;i<window.localStorage.length;i++){ var lk = window.localStorage.key(i); if(lk && lk.indexOf(SAVE_PREFIX)===0) keys[lk] = 1; } }catch(e){}
  if(NATIVE && typeof NATIVE.list==="function"){ try{ JSON.parse(NATIVE.list() || "[]").forEach(function(k){ if(String(k).indexOf(SAVE_PREFIX)===0) keys[k] = 1; }); }catch(e){} }
  else if(NATIVE){ for(var s=1;s<=3;s++) keys[SAVE_PREFIX+s] = 1; }   // (une ancienne appli ne sait pas lister)
  Object.keys(keys).forEach(function(k){
    if(idx.list.some(function(e){ return e.key===k; })) return;
    var raw = storeGet(k);
    if(!raw) return;
    var info = summarize(raw);
    if(info) idx.list.push({ key:k, name:"Seigneurie "+k.slice(SAVE_PREFIX.length), t:0, info:info });
  });
  idx.list.forEach(function(e){ var n = Number(e.key.slice(SAVE_PREFIX.length)); if(n>=idx.next) idx.next = n+1; });
  saveIndex = idx;
  return idx;
}
function writeIndex(){ storeSet(INDEX_KEY, JSON.stringify(saveIndex)); }
function sortedSaves(){ return saveIndex.list.slice().sort(function(a, b){ return (b.t||0) - (a.t||0); }); }
function entryOf(k){ return saveIndex.list.filter(function(e){ return e.key===k; })[0] || null; }
/* résumé lu directement dans la sauvegarde (recharger une partie régénère toute la grande carte : trop lent ici) */
function summarize(raw){
  try{
    var d = typeof raw==="string" ? JSON.parse(raw) : raw;
    if(!d || !(d.v>=8) || d.mapW!==W || d.mapH!==H || !d.time) return null;
    return infoFrom(d.modeId, d.diffId, d.time, Array.isArray(d.families) ? d.families.length : 0, !!d.victory, !!d.defeat);
  }catch(e){ return null; }
}
function infoFrom(modeId, diffId, time, pop, victory, defeat){
  var lv = 0;
  for(var li=0; li<SETTLEMENT_LEVELS.length; li++) if(pop >= SETTLEMENT_LEVELS[li].minPop) lv = li;
  return { mode:(MODE_BY_ID[modeId] || MODE_BY_ID.prosperity).name, diff:(DIFF_BY_ID[diffId] || DIFF_BY_ID.normal).name,
    month:time.month, year:time.year, pop:pop, level:SETTLEMENT_LEVELS[lv].name, victory:victory, defeat:defeat };
}
function infoOf(g){ return infoFrom(g.modeId, g.diffId, g.time, g.families.length, !!g.victory, !!g.defeat); }
function newSaveKey(){ var k = SAVE_PREFIX + saveIndex.next; saveIndex.next++; return k; }

// la sauvegarde automatique passe toutes les 5 s ; le fichier de l'application n'est réécrit qu'au plus toutes les
// 30 s (batterie), mais toujours aussitôt qu'on quitte, qu'on sauvegarde à la main ou qu'on change de partie (force)
var _nativeT = 0, _lastSaveAt = 0;
function persist(g, force){
  if(!g || !activeKey) return false;
  var ok = false;
  try{
    var str = JSON.stringify(g.serialize());
    try{ window.localStorage.setItem(activeKey, str); ok = true; }catch(e){}
    if(NATIVE && (force || Date.now() - _nativeT > 30000)){ _nativeT = Date.now(); try{ if(NATIVE.save(activeKey, str)) ok = true; }catch(e){} }
    else if(NATIVE) ok = true;
    var e2 = entryOf(activeKey);
    if(!e2){ e2 = { key:activeKey, name:"Seigneurie", t:0 }; saveIndex.list.push(e2); }
    e2.t = Date.now(); e2.info = infoOf(g);
    if(force || Date.now() - _lastSaveAt > 30000) writeIndex();
    else try{ window.localStorage.setItem(INDEX_KEY, JSON.stringify(saveIndex)); }catch(e){}
    if(ok) _lastSaveAt = Date.now();
  }catch(e){ ok = false; }
  return ok;
}
function loadKey(k){ try{ var r = storeGet(k); return r ? GameState.load(JSON.parse(r)) : null; }catch(e){ return null; } }
function deleteSave(k){
  storeDel(k);
  saveIndex.list = saveIndex.list.filter(function(e){ return e.key!==k; });
  writeIndex();
}
// une copie de la partie en cours, qu'on retrouvera telle quelle (la partie continue sous son nom)
function snapshot(g){
  var cur = entryOf(activeKey), k = newSaveKey();
  var name = (cur ? cur.name : "Seigneurie")+" — "+MONTHS[g.time.month].toLowerCase()+" "+g.time.year;
  if(!storeSet(k, JSON.stringify(g.serialize()), true)) return null;
  saveIndex.list.push({ key:k, name:name, t:Date.now()-1, info:infoOf(g), copy:true });
  writeIndex();
  return name;
}
function defaultName(){
  var used = {}; saveIndex.list.forEach(function(e){ used[e.name] = 1; });
  for(var n=1;;n++) if(!used["Seigneurie "+n]) return "Seigneurie "+n;
}
/* un fichier de sauvegarde (export) : la partie et son nom */
function exportText(g){ var e = entryOf(activeKey); return JSON.stringify({ seigneurie:1, name:e ? e.name : "Seigneurie", save:g.serialize() }); }
function importText(txt){
  var d = null;
  try{ d = JSON.parse(txt); }catch(e){
    try{ d = { save:JSON.parse(decodeURIComponent(escape(atob(String(txt).trim())))) }; }catch(e2){ d = null; }   // un ancien code de sauvegarde
  }
  if(!d) return "Ce fichier n'est pas une sauvegarde de Seigneurie.";
  var data = d.seigneurie && d.save ? d.save : d.save || d;
  var g = null;
  try{ g = GameState.load(data); }catch(e){ g = null; }
  if(!g) return "Ce fichier n'est pas une sauvegarde de Seigneurie.";
  var k = newSaveKey(), name = (typeof d.name==="string" && d.name.trim() ? d.name.trim().slice(0, 40) : defaultName())+" (importée)";
  if(!storeSet(k, JSON.stringify(g.serialize()))) return "Plus de place pour enregistrer la partie.";
  saveIndex.list.push({ key:k, name:name, t:Date.now(), info:infoOf(g) });
  writeIndex();
  openGame(g, k);
  flash("Partie importée : "+name);
  return null;
}

/* ----- partie : on ouvre sur l'écran d'accueil ----- */
var game = null;
var uiMenu = true;   // écran d'accueil (continuer, nouvelle partie, charger, options, guide)
readIndex();
try{
  activeKey = storeGet("seigneurie-last-key");
  if(!activeKey){ var _ls = storeGet("seigneurie-last-slot"); if(_ls!==null) activeKey = SAVE_PREFIX + (Math.max(0, Math.min(2, Number(_ls)||0)) + 1); }
  if(activeKey && !entryOf(activeKey)) activeKey = null;
}catch(e){ activeKey = null; }
if(!activeKey && saveIndex.list.length) activeKey = sortedSaves()[0].key;

var cam = { x:0, y:0, zoom:snapZoom(1.5) };
function centerCam(){
  if(!game) return;
  var b = game.buildings[0];
  if(b){ cam.x = b.x + b.w/2; cam.y = b.y + b.h/2; }
}
centerCam();

var ui = {
  buildSel:null, selId:null, cat:null, sheet:null, modal:null, roadMode:false,
  zoneMode:false, zoneKind:"house", zonePts:[], zoneClosed:false, zoneN:null, extPlace:null,
  flash:null, objOpen:false, layersOpen:false, tip:null, tipT:0, hoverTip:null,
  demolishArm:0, delArm:null, taxDrag:false, lastSpeed:1, endSeen:false,
  newMode:"prosperity", newDiff:"normal", home:"main", loading:null,
  selV:null, vJob:false, pFilter:"all",   /* étape 4 : fiche d'un villageois, choix du métier, filtre des habitants */
  layers:{ forest:false, stone:false, berry:false, soil:false }
};
try{ ui.stockHow = window.localStorage.getItem("seigneurie-stockhow")==="1"; ui.noVibe = window.localStorage.getItem("seigneurie-novibe")==="1"; }catch(e){}

/* ----- catégories de construction (dock du bas) ----- */
var CATS = [
  { id:"home",  name:"Maisons",    icon:"house",  items:[], actions:["zone"],
    hint:"Tracez une zone le long d'une route : maisons, cours et clôtures se placent seules." },
  { id:"res",   name:"Récolte",    icon:"axe",    items:["woodcutter","forager","hunter","quarry"],
    hint:"Bois, baies, gibier et pierre : posez-les près de la ressource." },
  { id:"farm",  name:"Terres",     icon:"grain",  items:["farm"], actions:["fieldzone","pasture","oxpost","buyox"],
    hint:"Tracez champs et pâturages à la forme que vous voulez ; une ferme travaille les champs." },
  { id:"store", name:"Vivres",     icon:"bread",  items:["windmill","bakery","dairy","smokehouse","granary","storehouse"],
    hint:"Moulin, boulangerie, laiterie, fumoir : transformer et conserver. La grange abrite les denrées, l'entrepôt agrandit les réserves." },
  { id:"realm", name:"Domaine",    icon:"church", items:["market","trade","church","manor"],
    hint:"Marché, commerce, église et manoir : le cœur de la seigneurie." },
  { id:"def",   name:"Défense",    icon:"shield", items:["tower","wall"], actions:["militia","merc"],
    hint:"Tours et remparts contre les pillards, milice et mercenaires." },
  { id:"road",  name:"Routes",     icon:"road",   tool:true }
];
var UNIQUE = { manor:1, church:1, windmill:1, market:1, trade:1, oxpost:1 };

/* ----- ressources : nom et icône ----- */
var RES = {
  timber:{ n:"Bois d'œuvre" }, firewood:{ n:"Bois de chauffe" }, stone:{ n:"Pierre" },
  grain:{ n:"Grain" }, barley:{ n:"Orge" }, bread:{ n:"Pain" }, berries:{ n:"Baies" }, meat:{ n:"Viande" },
  eggs:{ n:"Œufs" }, veg:{ n:"Légumes" }, apples:{ n:"Pommes" }, honey:{ n:"Miel" },
  clothes:{ n:"Vêtements" }, ale:{ n:"Ale" }, ox:{ n:"Bœufs" },
  oats:{ n:"Avoine" }, flax:{ n:"Lin" }, pulses:{ n:"Pois et fèves" }, milk:{ n:"Lait" }, wool:{ n:"Laine" },
  hay:{ n:"Foin et paille" }, manure:{ n:"Fumier" }, sh_grain:{ n:"Gerbes de blé et de seigle" }, sh_barley:{ n:"Gerbes d'orge" }, sh_oats:{ n:"Gerbes d'avoine" },
  flour:{ n:"Farine" }, cheese:{ n:"Fromage" }, smoked:{ n:"Viande fumée" }
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
  "🗺":"flag", "🛡":"shield", "⚔":"sword", "🏆":"crown", "🏰":"house", "❄":"winter", "💀":"", "☠":"", "🏕":"", "⚠":"",
  "🌱":"oats", "🪻":"flax", "🫛":"pulses", "🥛":"milk", "🧶":"wool", "🌿":"hay", "🟫":"manure", "🎋":"sheaf",
  "🐑":"sheep", "🐄":"cow", "🐖":"pig", "🌩":"", "🌧":"", "☀":"summer", "🥣":"flour", "🧀":"cheese", "🥓":"smoked" };
var EMOJI_RE = new RegExp("("+Object.keys(EMOJI_IC).join("|")+")\\ufe0f?\\s?", "g");
function rich(text){
  return esc(text).replace(EMOJI_RE, function(m, e){ var n = EMOJI_IC[e]; return n ? ic(n,"s")+(/\s$/.test(m)?" ":"") : ""; });
}
function flash(msg){
  ui.flash = msg;
  if(ui._ft) clearTimeout(ui._ft);
  ui._ft = setTimeout(function(){ ui.flash = null; renderUI(); }, msg && msg.length>60 ? 3500 : 2200);
}
function buzz(ms){ if(ui.noVibe) return; try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} }
function costHtml(cost, g){
  var ks = Object.keys(cost||{});
  if(!ks.length) return "<span class='cost'>Gratuit</span>";
  return ks.map(function(k){
    var short = g && g.freeStock(k) < cost[k];
    return "<span class='cost"+(short?" no":"")+"'>"+cost[k]+ic(k,"s")+"</span>";
  }).join(" ");
}
function missingText(def, g){
  var c = BUILD_DEFS[def].cost, m = [];
  for(var k in c) if(g.freeStock(k) < c[k]) m.push(Math.ceil(c[k]-Math.max(0, g.freeStock(k)))+" "+RES[k].n.toLowerCase());
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
  var any = ui.buildSel || ui.roadMode || ui.zoneMode || ui.extPlace || ui.selId!=null || ui.selV!=null || ui.cat || ui.sheet;
  clearTools();
  ui.buildSel = null; ui.roadMode = false; ui.selId = null; ui.selV = null; ui.cat = null; ui.sheet = null; ui.layersOpen = false;
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
  /* outil de zone, sur un point existant :
     - appui long (0,28 s) = on « attrape » le point, qui suit ensuite le doigt en relatif (il reste visible) ;
     - glisser tout de suite depuis le dernier point = tirer un nouveau trait ;
     - glisser tout de suite ailleurs = déplacer la vue ; toucher le premier point = fermer le contour */
  if(game && ui.zoneMode && ui.zonePts.length){
    var zw0 = toWorld(e.clientX, e.clientY), zi = nearZonePt(zw0.wx, zw0.wy);
    if(zi>=0){
      zoneDrag = { i:zi, sx:e.clientX, sy:e.clientY, moved:false, grabbed:false, p0:ui.zonePts[zi].slice(),
                   extend: !ui.zoneClosed && zi===ui.zonePts.length-1 };
      zoneDrag.timer = setTimeout(function(){
        if(zoneDrag.i===zi && !zoneDrag.moved){ zoneDrag.grabbed = true; zoneDrag.extend = false; buzz(15); }
      }, 280);
      drag.sx = e.clientX; drag.sy = e.clientY; drag.cx = cam.x; drag.cy = cam.y;
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
    var zdx = e.clientX-zoneDrag.sx, zdy = e.clientY-zoneDrag.sy;
    if(!zoneDrag.grabbed && !zoneDrag.follow && Math.abs(zdx)+Math.abs(zdy)>8){
      clearTimeout(zoneDrag.timer);
      if(zoneDrag.extend){ /* tirer depuis le dernier point : un nouveau trait suit le doigt */
        ui.zonePts.push(ui.zonePts[zoneDrag.i].slice()); zoneDrag.i = ui.zonePts.length-1; zoneDrag.extend = false; zoneDrag.follow = true;
      } else { zoneDrag = { i:-1 }; drag.down = true; } /* pas d'appui long : on déplace la vue */
    }
    if(zoneDrag.i>=0){
      if(zoneDrag.grabbed || zoneDrag.follow){
        if(Math.abs(zdx)+Math.abs(zdy)>2) zoneDrag.moved = true;
        var zn = ui.zonePts.length, zi2 = zoneDrag.i, zx, zy;
        var zprev = zi2>0 ? ui.zonePts[zi2-1] : (ui.zoneClosed ? ui.zonePts[zn-1] : null);
        if(zoneDrag.grabbed){ zx = zoneDrag.p0[0] + zdx/(16*cam.zoom); zy = zoneDrag.p0[1] + zdy/(16*cam.zoom); }
        else { var zw = toWorld(e.clientX, e.clientY); zx = zw.wx; zy = zw.wy; }
        ui.zonePts[zi2] = game.snapZonePoint(zx, zy, zprev);
      }
      return;
    }
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
    var zd = zoneDrag; clearTimeout(zd.timer); zoneDrag = { i:-1 }; endPointer(e);
    if(!zd.moved && !zd.grabbed && zd.i===0 && !ui.zoneClosed && ui.zonePts.length>=3){ ui.zoneClosed = true; ui.zoneN = null; buzz(8); }
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
    if(ui.zoneClosed) flash("Appui long sur un point pour le déplacer, ou ↶ pour rouvrir le contour.");
    else { ui.zonePts.push(game.snapZonePoint(w.wx, w.wy, ui.zonePts[ui.zonePts.length-1])); buzz(5); }
  }
  else if(ui.roadMode){
    if(!game.toggleRoad(w.tx, w.ty)) flash("Impossible de tracer une route ici.");
  }
  else if(ui.buildSel){
    /* pose en deux temps : 1er toucher = emplacement en bleu, 2e toucher au même endroit = validation */
    var def = ui.buildSel, pp = ui.pendingPlace;
    if(!pp || pp.tx!==w.tx || pp.ty!==w.ty){
      var perr = ui.movePost ? game.canMoveOxPost(w.tx, w.ty) : game.canPlace(def, w.tx, w.ty);
      if(perr){ ui.pendingPlace = null; flash(perr); }
      else { ui.pendingPlace = { tx:w.tx, ty:w.ty }; buzz(5); }
      renderUI(); return;
    }
    ui.pendingPlace = null;
    if(ui.movePost){ movePostAt(w.tx, w.ty); renderUI(); return; }
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
    /* un villageois sous le doigt ? sa fiche ; sinon le bâtiment */
    var tv = villagerAt(game, w.wx, w.wy);
    if(tv){ selectVillager(tv); renderUI(); return; }
    if(oxAt(game, w.wx, w.wy)){ ui.sheet = "oxen"; ui.selId = null; ui.selV = null; renderUI(); return; }
    var b = game.buildingAt(w.tx, w.ty);
    ui.selId = b ? b.id : null; ui.selV = null; ui.demolishArm = 0;
    if(b) revealAboveSheet(b);
    if(!b){ ui.tip = game.tileName(w.tx, w.ty); ui.tipT = Date.now() + 2600; }
  }
  renderUI();
});
canvas.addEventListener("pointercancel", function(e){ clearTimeout(zoneDrag.timer); zoneDrag = { i:-1 }; endPointer(e); });
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
    if(uiMenu && ui.home && ui.home!=="main"){ ui.home = "main"; }
    else if(ui.modal){ ui.modal = null; }
    else if(uiMenu && game){ uiMenu = false; }
    else cancelAll();
    renderUI(); return;
  }
  if(!game) return;
  if(e.key===" "){ e.preventDefault(); togglePause(); }
  if(e.key==="m"){ AudioFX.muted = !AudioFX.muted; flash(AudioFX.muted ? "Son coupé" : "Son activé"); }
  if(e.key==="1") setSpeed(1);
  if(e.key==="2") setSpeed(4);
  if(e.key==="3") setSpeed(16);
  if(e.key==="4") setSpeed(60);
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

/* vitesses : ×1 = environ 5 minutes par mois (on prend son temps) ; ×60 = environ 1 minute par année */
var SPEEDS = [1, 4, 16, 60];
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

/* ----- étape 4 : villageois sous le doigt (les nourrissons restent à la maison) ----- */
function villagerAt(g, wx, wy){
  var best = null, bd = 1e9;
  for(var i=0;i<g.villagers.length;i++){
    var v = g.villagers[i], st = g.stageOf(v);
    if(st==="baby") continue;
    var h = st==="child" ? 0.65 : 0.85, dx = wx - v.x, up = v.y - wy;   /* up > 0 : au-dessus des pieds */
    if(Math.abs(dx)<0.42 && up>-0.25 && up<h){
      var d = Math.abs(dx) + Math.abs(up - h/2);
      if(d<bd){ bd = d; best = v; }
    }
  }
  return best;
}
/* ouvrir une partie (nouvelle, chargée ou importée) */
function openGame(g, key){
  if(game && game!==g && activeKey && activeKey!==key) persist(game, true);
  game = g; activeKey = key;
  storeSet("seigneurie-last-key", key);
  cancelAll(); uiMenu = false; ui.modal = null; ui.endSeen = false; ui.home = "main"; ui.loading = null;
  _animT = 0; centerCam();
}
function loadAndOpen(key){
  if(!key || ui.loading) return;
  ui.loading = key; renderUI();
  setTimeout(function(){
    var g2 = loadKey(key);
    ui.loading = null;
    if(g2) openGame(g2, key);
    else flash("Cette partie est illisible ou abîmée.");
    renderUI();
  }, 40);
}
/* retour de l'application Android : fichier exporté, ou fichier choisi pour l'import */
window.seigneurieFileDone = function(kind, ok){
  if(kind==="export") flash(ok ? "Fichier de sauvegarde enregistré." : "Export annulé.");
  if(kind==="import"){
    var txt = null;
    if(ok && NATIVE && typeof NATIVE.takeImport==="function"){ try{ txt = NATIVE.takeImport(); }catch(e){ txt = null; } }
    if(txt){ var er = importText(txt); if(er) flash(er); }
    else if(ok) flash("Fichier illisible.");
  }
  renderUI();
  return "ok";
};
function movePostAt(tx, ty){
  var me = game.moveOxPost(tx, ty);
  if(me){ flash(me); return; }
  AudioFX.build(); buzz(8);
  var post = game.buildings.filter(function(b){ return b.def==="oxpost"; })[0];
  clearTools(); ui.buildSel = null;
  if(post){ ui.selId = post.id; revealAboveSheet(post); }
  flash("Poteau déplacé : les bœufs qui attendaient y vont.");
}
/* un bœuf sous le doigt (au poteau ou en chemin) */
function oxAt(g, wx, wy){
  var best = null, bd = 0.7;
  for(var i=0;i<g.oxen.length;i++){
    var o = g.oxen[i];
    if(!g.oxAway(o) || !isFinite(o.x)) continue;
    var d = Math.abs(wx - o.x) + Math.abs(wy - (o.y - 0.4));
    if(d<bd){ bd = d; best = o; }
  }
  return best;
}
function selectVillager(v){
  ui.selV = v.id; ui.selId = null; ui.sheet = null; ui.cat = null; ui.vJob = false; ui.demolishArm = 0;
  revealAboveSheet({ x:v.x-0.5, y:v.y-1, w:1, h:1 });
}

/* ----- appui long sur une carte du tiroir de construction : la fiche du bâtiment ----- */
var cardPress = null, _suppressClick = 0;
elSheet.addEventListener("pointerdown", function(e){
  var card = e.target && e.target.closest ? e.target.closest(".card[data-act]") : null;
  if(!card || !game) return;
  var act = card.getAttribute("data-act"), id = act==="build" ? card.getAttribute("data-arg") : act;
  if(!BUILD_INFO[id] && !BUILD_DEFS[id]) return;
  if(cardPress) clearTimeout(cardPress.t);
  cardPress = { x:e.clientX, y:e.clientY, t:setTimeout(function(){
    cardPress = null; _suppressClick = Date.now() + 700;
    ui.infoId = id; ui.modal = "binfo"; buzz(15); renderUI();
  }, 450) };
});
function cancelCardPress(e){ if(cardPress && (!e || e.type!=="pointermove" || Math.abs(e.clientX-cardPress.x)+Math.abs(e.clientY-cardPress.y)>10)){ clearTimeout(cardPress.t); cardPress = null; } }
elSheet.addEventListener("pointermove", cancelCardPress);
["pointerup","pointercancel","pointerleave"].forEach(function(ev){ elSheet.addEventListener(ev, function(){ cancelCardPress(); }); });
elSheet.addEventListener("scroll", function(){ cancelCardPress(); }, true);
/* le relâchement de l'appui long ne compte pas comme un toucher ; le toucher suivant, si */
window.addEventListener("pointerup", function(){ if(_suppressClick) setTimeout(function(){ _suppressClick = 0; }, 0); }, true);
elSheet.addEventListener("contextmenu", function(e){ if(e.target && e.target.closest && e.target.closest(".card")) e.preventDefault(); });

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
  if(Date.now() < _suppressClick && elSheet.contains(el)){ _suppressClick = 0; return; }   // le relâchement d'un appui long n'est pas un toucher
  var act = el.getAttribute("data-act");
  var arg = el.getAttribute("data-arg");
  AudioFX.init();
  if(act!=="noop") AudioFX.click();
  var g = game;
  switch(act){
    /* --- temps --- */
    case "pause": togglePause(); break;
    case "speedcycle": { var s = g.speed || ui.lastSpeed || 1, nx = SPEEDS[0]; for(var si=0; si<SPEEDS.length; si++) if(SPEEDS[si]>s){ nx = SPEEDS[si]; break; } setSpeed(nx); break; }
    /* --- dock / tiroirs / panneaux --- */
    case "cat":
      if(arg==="road"){
        ui.roadMode = !ui.roadMode; ui.cat = null; ui.buildSel = null; ui.selId = null; ui.sheet = null;
      } else {
        ui.cat = (ui.cat===arg ? null : arg); ui.buildSel = null; ui.roadMode = false; ui.selId = null; ui.sheet = null;
      }
      ui.layersOpen = false; clearTools();
      break;
    case "zone": case "pasture": case "fieldzone":
      clearTools(); ui.zoneMode = true; ui.zoneKind = act==="pasture" ? "pasture" : act==="fieldzone" ? "field" : "house";
      ui.cat = null; ui.buildSel = null; ui.roadMode = false; ui.selId = null; ui.sheet = null;
      break;
    case "placeok":
      if(ui.movePost && ui.pendingPlace){ var mpp = ui.pendingPlace; ui.pendingPlace = null; movePostAt(mpp.tx, mpp.ty); break; }
      if(ui.buildSel && ui.pendingPlace){
        var pp2 = ui.pendingPlace, perr2 = g.place(ui.buildSel, pp2.tx, pp2.ty); ui.pendingPlace = null;
        if(perr2) flash(perr2);
        else { AudioFX.build(); buzz(8);
          if(UNIQUE[ui.buildSel]) ui.buildSel = null;
          else if(!g.canAfford(ui.buildSel)){ var bs = ui.buildSel; ui.buildSel = null; flash("Plus assez de matériaux. "+missingText(bs, g)); } }
      }
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
        var zerr = ui.zoneKind==="pasture" ? g.tracePasture(ui.zonePts) : ui.zoneKind==="field" ? g.traceField(ui.zonePts) : g.traceZone(ui.zonePts, ui.zoneN==null ? undefined : ui.zoneN);
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
      ui.sheet = (ui.sheet===arg ? null : arg); ui.cat = null; ui.selId = null; ui.selV = null; ui.buildSel = null; ui.roadMode = false; ui.layersOpen = false; clearTools();
      break;
    case "closesheet": ui.sheet = null; ui.cat = null; ui.selId = null; ui.selV = null; break;
    /* --- étape 4 : villageois --- */
    case "vsel": { var vv = g.villager(Number(arg)); if(vv) selectVillager(vv); break; }
    case "vjob": ui.vJob = !ui.vJob; break;
    case "vassign": if(ui.selV!=null){ var ve = g.assignVillager(ui.selV, Number(arg)); if(ve) flash(ve); else ui.vJob = false; } break;
    case "vappr": if(ui.selV!=null){ var va = g.takeApprentice(Number(arg), ui.selV); if(va) flash(va); } break;
    case "vlook": { var vl = ui.selV!=null ? g.villager(ui.selV) : null; if(vl){ cam.x = vl.x; cam.y = vl.y; cam.zoom = Math.max(cam.zoom, snapZoom(2)); revealAboveSheet({ x:vl.x-0.5, y:vl.y-1, w:1, h:1 }); } break; }
    case "bsel": { var bb = g.buildings.filter(function(x){ return x.id===Number(arg); })[0]; if(bb){ ui.selId = bb.id; ui.selV = null; ui.sheet = null; ui.demolishArm = 0; revealAboveSheet(bb); } break; }
    case "pfilter": ui.pFilter = arg; break;
    case "stockhow": ui.stockHow = !ui.stockHow; try{ window.localStorage.setItem("seigneurie-stockhow", ui.stockHow ? "1" : ""); }catch(e4){} break;
    case "appr": if(ui.selId!=null){ var ae = g.takeApprentice(ui.selId); if(ae) flash(ae); } break;
    case "apprstop": if(ui.selId!=null) g.dropApprentice(ui.selId); break;
    case "obj": ui.objOpen = !ui.objOpen; break;
    case "layersbtn": ui.layersOpen = !ui.layersOpen; break;
    case "layer": ui.layers[arg] = !ui.layers[arg]; break;
    /* --- bâtiment sélectionné --- */
    case "selclose": ui.selId = null; ui.selV = null; break;
    case "assign": if(ui.selId!=null) g.assign(ui.selId); break;
    case "unassign": if(ui.selId!=null) g.unassign(ui.selId); break;
    case "ext":
      if(ui.selId!=null){
        g.buyExtension(ui.selId, arg);
      }
      break;
    case "crop": if(ui.selId!=null) g.setCrop(ui.selId, arg); break;
    case "sprio": if(ui.selId!=null){ var sp = g.buildings.filter(function(x){ return x.id===ui.selId; })[0]; if(sp) g.setSitePrio(sp.id, !sp.prio); } break;
    case "churchup": if(ui.selId!=null) g.churchUp(ui.selId, arg); break;
    case "policy": g.setPolicy(arg, !g.policies[arg]); break;
    /* --- étape 7a : redevances et changeur --- */
    case "taxlvl": { var tl = String(arg).split(":"), te = g.setTaxLevel(tl[0], Number(tl[1])); if(te) flash(te); break; }
    /* --- étape 7b : conseil, réputation --- */
    case "appoint": { var ap2 = String(arg).split(":"), ae2 = g.appoint(ap2[0], Number(ap2[1])); if(ae2) flash(ae2); else ui.pickSeat = null; break; }
    case "pickseat": ui.pickSeat = ui.pickSeat===arg ? null : arg; break;
    case "dismiss": g.dismiss(arg); break;
    case "seattask": { var st2 = String(arg).split(":"); g.setSeatTask(st2[0], st2[1]); break; }
    case "audit": { var au = g.audit(); if(au) flash(au); break; }
    case "punish": { var pu = g.punishSteward(); if(pu) flash(pu); break; }
    /* --- étape 7c : ordres et coutumier --- */
    case "proclaim": { var pl = String(arg).split(":"), pe = g.proclaim(pl[0], Number(pl[1])); if(pe) flash(pe); break; }
    case "ennoble": { var en = g.ennoble(Number(arg)); if(en) flash(en); break; }
    case "office": if(ui.selV!=null){ var oe = g.setOffice(ui.selV, arg); if(oe) flash(oe); } break;
    /* --- étape 7d : justice et audiences --- */
    case "judge": { var jd = String(arg).split(":"), je = g.judge(Number(jd[0]), jd[1]); if(je) flash(je); break; }
    case "petition": { var pt = String(arg).split(":"), pe2 = g.answer(Number(pt[0]), pt[1]==="1"); if(pe2) flash(pe2); break; }
    /* --- étape 7e : intrigues --- */
    case "facyield": { var fy = g.factionYield(); if(fy) flash(fy); break; }
    case "facarrest": { var fa2 = g.arrestLeader(); if(fa2) flash(fa2); break; }
    case "secret": { var sc = String(arg).split(":"), se3 = g.useSecret(Number(sc[0]), sc[1]); if(se3) flash(se3); break; }
    case "alms": { var al = g.giveAlms(); if(al) flash(al); break; }
    case "feast": { var fe = g.giveFeast(); if(fe) flash(fe); break; }
    case "borrow": { var be2 = g.borrow(LOAN_STEP); if(be2) flash(be2); break; }
    case "repay": { var re2 = g.repay(arg==="all" ? g.fisc.debt : LOAN_STEP); if(re2) flash(re2); break; }
    case "demolish":
      if(ui.selId==null) break;
      if(Date.now() < ui.demolishArm){ g.demolish(ui.selId); ui.selId = null; ui.demolishArm = 0; }
      else { ui.demolishArm = Date.now() + 3000; setTimeout(renderUI, 3050); }
      break;
    /* --- actions de la seigneurie --- */
    case "buyox": g.buyOx(); break;
    /* --- étape 5 : bœufs et troupeaux --- */
    case "retireox": g.retireOx(); break;
    case "oxjob": { var oj = String(arg).split(":"), oe2 = g.setOxJob(Number(oj[0]), oj[1]); if(oe2) flash(oe2); break; }
    case "movepost": clearTools(); ui.movePost = true; ui.buildSel = "oxpost"; ui.cat = null; ui.selId = null; ui.sheet = null; ui.roadMode = false; break;
    case "buyanimal": if(ui.selId!=null){ var ba = String(arg).split(":"), be = g.buyAnimal(ui.selId, ba[0], ba[1]==="1"); if(be) flash(be); } break;
    case "sellanimal": if(ui.selId!=null){ var se = g.sellAnimal(ui.selId); if(se) flash(se); } break;
    case "slaughter": if(ui.selId!=null){ var sle = g.slaughter(ui.selId); if(sle) flash(sle); } break;
    case "cullsick": if(ui.selId!=null){ var ce = g.cullSick(ui.selId); if(ce) flash(ce); } break;
    case "keepminus": case "keepplus": case "keepall": {
      var kp = ui.selId!=null ? g.pastureOf(ui.selId) : null;
      if(kp){
        var cur = kp.herd.keep===null ? kp.herd.an.length : kp.herd.keep;
        g.setKeep(kp.id, act==="keepall" ? null : Math.max(0, cur + (act==="keepplus" ? 1 : -1)));
      }
      break;
    }
    case "militia": if(!g.raiseMilitia()) flash("Toute la milice disponible est déjà levée."); break;
    case "merc": g.hireMercenary(); break;
    case "claim": g.claimRegion(Number(arg)); break;
    case "rlook": { var rr = g.regions[Number(arg)]; if(rr){ cam.x = rr.cx + 0.5; cam.y = rr.cy + 0.5; ui.modal = null; } break; }
    case "resolve": g.resolveEvent(Number(arg)); break;
    /* --- fenêtres --- */
    case "modal": ui.modal = arg; ui.sheet = null; break;
    case "modalclose": ui.modal = null; break;
    case "noop": return;
    case "mute": AudioFX.muted = !AudioFX.muted; try{ window.localStorage.setItem("seigneurie-mute", AudioFX.muted ? "1" : ""); }catch(e7){} break;
    case "vibe": ui.noVibe = !ui.noVibe; try{ window.localStorage.setItem("seigneurie-novibe", ui.noVibe ? "1" : ""); }catch(e7){} if(!ui.noVibe) buzz(20); break;
    case "text": cycleTextSize(); break;
    case "endcontinue": ui.endSeen = true; break;
    /* --- écran d'accueil et sauvegardes --- */
    case "mainmenu":
      if(game) persist(game, true);
      uiMenu = true; ui.home = "main"; ui.sheet = null; ui.modal = null; ui.delArm = null; readIndex();
      break;
    case "home": ui.home = arg || "main"; ui.delArm = null; if(arg==="load") readIndex(); break;
    case "menuclose": if(game) uiMenu = false; break;
    case "continue":
      if(game && (!arg || arg===activeKey)){ uiMenu = false; break; }
      loadAndOpen(arg || activeKey);
      break;
    case "nmode": ui.newMode = arg; break;
    case "ndiff": ui.newDiff = arg; break;
    case "startgame": {
      if(game) persist(game, true);
      var ng = new GameState(Math.floor(Math.random()*2000000000), ui.newMode, ui.newDiff);
      var nk = newSaveKey();
      saveIndex.list.push({ key:nk, name:defaultName(), t:Date.now(), info:infoOf(ng) });
      openGame(ng, nk);
      ui.objOpen = true; ui.lastSpeed = 1;
      if(!persist(game, true)) flash("Attention : la partie n'a pas pu être enregistrée sur l'appareil (plus de place ?).");
      break;
    }
    case "loadsave": loadAndOpen(arg); break;
    case "delsave": {
      if(ui.delArm && ui.delArm.key===arg && Date.now() < ui.delArm.t){
        deleteSave(arg);
        if(arg===activeKey){ game = null; activeKey = saveIndex.list.length ? sortedSaves()[0].key : null; }
        ui.delArm = null;
        if(!saveIndex.list.length) ui.home = "main";
      } else { ui.delArm = { key:arg, t:Date.now()+3000 }; setTimeout(renderUI, 3050); }
      break;
    }
    case "rensave": {
      var re = entryOf(arg);
      if(!re) break;
      var nn = window.prompt("Nom de la partie :", re.name);
      if(nn && nn.trim()){ re.name = nn.trim().slice(0, 40); writeIndex(); }
      break;
    }
    case "savenow":
      if(persist(g, true)) flash("Partie enregistrée sur l'appareil.");
      else flash("Échec de l'enregistrement (plus de place sur l'appareil ?).");
      break;
    case "savecopy": {
      persist(g, true);
      var cn = snapshot(g);
      flash(cn ? "Copie gardée : « "+cn+" ». Retrouvez-la dans Charger une partie." : "Échec : plus de place sur l'appareil ?");
      break;
    }
    case "exportfile": {
      if(!g) break;
      persist(g, true);
      var ee = entryOf(activeKey), fname = ((ee ? ee.name : "seigneurie").replace(/[^\wÀ-ÿ -]+/g, "").trim() || "seigneurie").replace(/\s+/g, "-")+"-"+MONTHS[g.time.month].toLowerCase()+"-"+g.time.year+".seigneurie.json";
      var txt = exportText(g);
      if(NATIVE && typeof NATIVE.exportFile==="function"){ try{ NATIVE.exportFile(fname, txt); }catch(e5){ flash("Export impossible."); } }
      else if(NATIVE){ try{ NATIVE.share(txt, "Seigneurie — sauvegarde"); }catch(e5){ flash("Export impossible."); } }
      else {
        try{
          var blob = new Blob([txt], { type:"application/json" }), url = URL.createObjectURL(blob), aEl = document.createElement("a");
          aEl.href = url; aEl.download = fname; document.body.appendChild(aEl); aEl.click(); aEl.remove();
          setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
          flash("Fichier de sauvegarde téléchargé.");
        }catch(e5){ flash("Export impossible."); }
      }
      break;
    }
    case "importfile": {
      if(NATIVE && typeof NATIVE.importFile==="function"){ try{ NATIVE.importFile(); }catch(e6){ flash("Import impossible."); } break; }
      var inp = document.createElement("input");
      inp.type = "file"; inp.accept = ".json,application/json,text/plain";
      inp.onchange = function(){
        var file = inp.files && inp.files[0]; if(!file) return;
        var rd = new FileReader();
        rd.onload = function(){ var er = importText(String(rd.result||"")); if(er) flash(er); renderUI(); };
        rd.readAsText(file);
      };
      inp.click();
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
  if(g && ui.selV!=null && !g.villager(ui.selV)) ui.selV = null;
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
  h += "<button class='stat' data-act='sheet' data-arg='book' aria-label='Livre de comptes'>"+ic("coin")+"<span class='v'>"+Math.floor(g.treasury)+"</span></button>";
  h += "<button class='stat "+apCls+"' data-act='sheet' data-arg='realm'>"+ic(heartIcon(g.approval))+"<span class='v'>"+g.approval+"%</span></button>";
  h += "<button class='stat' data-act='sheet' data-arg='people' aria-label='Habitants'>"+ic("family")+"<span class='v'>"+g.villagers.length+"</span>"
     + (homeless>0 ? "<span class='badge' title='Familles sans logis'>"+homeless+"</span>" : "")+"</button>";
  h += "<span class='grow'></span>";
  var paused = g.speed===0;
  h += "<button class='b sq"+(paused?" gold":"")+"' data-act='pause' aria-label='"+(paused?"Reprendre":"Pause")+"'>"+ic(paused?"play":"pause")+"</button>";
  h += "<button class='b sq' data-act='speedcycle' aria-label='Vitesse'><span class='speedlbl'>×"+(g.speed||ui.lastSpeed||1)+"</span></button>";
  h += "<button class='b sq"+(ui.sheet==="menu"?" on":"")+"' data-act='sheet' data-arg='menu' aria-label='Menu'>"+ic("menu")+"</button>";
  setHTML(elBar, h);

  /* bandeau des réserves (toucher = détail) */
  var food = g.foodStock(), kinds = foodGroupsIn(g);
  var cold = [9,10,11,0,1].indexOf(g.time.month)>=0;
  var r = "";
  r += rc("timber", g.stock.timber, g.stock.timber<3);
  r += rc("firewood", g.stock.firewood, cold && g.stock.firewood < g.families.length*3);
  r += rc("stone", g.stock.stone, false);
  r += "<span class='rc"+(food < g.foodNeed()*2 || g.dearth>0 ? " low" : "")+"'>"+ic("bread")+Math.floor(food)
     + "<span class='dim' style='font-size:10px'>·"+kinds+"</span></span>";
  ["grain","flour","barley","clothes","ale"].forEach(function(k){ if((g.stock[k]||0)>=1) r += rc(k, g.stock[k], false); });
  /* étape 5 : le foin compte dès qu'il y a des bêtes à nourrir l'hiver */
  var wneed = g.winterNeed();
  if(wneed>0) r += rc("hay", g.stock.hay, [8,9,10,11,0,1].indexOf(g.time.month)>=0 && g.fodderStock() < wneed*3);
  if(g.sheafTotal()>=1) r += rc("sheaf", g.sheafTotal(), false);
  if(g.stock.ox>0) r += rc("ox", g.stock.ox, false);
  r += "<span class='rc sep'>"+ic("crown")+Math.floor(g.influence)+"</span>";
  r += "<span class='rc'>"+ic("bag")+Math.floor(g.wealth)+"</span>";
  setHTML(elRes, r);
}
function rc(k, v, low){ return "<span class='rc"+(low?" low":"")+"'>"+ic(k)+Math.floor(v||0)+"</span>"; }

/* ---------- surcouche de la carte : objectifs, notifications, calques, aide à la pose ---------- */
function renderHud(g){
  if(!g){ setHTML(elHudL, ""); setHTML(elHudR, ""); setHTML(elHint, ""); return; }
  /* étape 8 : les objectifs-guides — le dernier atteint, les prochains, et un conseil pour le premier */
  var done = g.goalsDone(), total = GOALS.length;
  var l = g.speed===0 ? "<button class='frame pill paused' data-act='pause'>"+ic("pause","s")+"<b>En pause</b> <span class='dim'>toucher pour reprendre</span></button>" : "";
  l += "<button class='frame pill' data-act='obj'>"+ic("scroll","s")+"<b>Objectifs</b> <span class='"+(done===total?"good":"dim")+"'>"+done+"/"+total+"</span></button>";
  /* étape 7d : affaires et pétitions qui attendent le seigneur */
  var nj = g.cases.length + g.petitions.length;
  if(nj) l += " <button class='frame pill' data-act='sheet' data-arg='justice'>"+ic("crown","s")+"<b>Audiences</b> <span class='gold'>"+nj+"</span></button>";
  if(factionSeen(g)) l += " <button class='frame pill' data-act='sheet' data-arg='plots'>"+ic("sword","s")+"<b>Mécontents</b> <span class='bad'>"+Math.round(g.faction.power)+"</span></button>";
  /* un panneau ouvert : la carte est petite, on replie les objectifs et on ne garde qu'une notification */
  var busy = !!(ui.sheet || ui.selId!=null || ui.selV!=null || ui.cat);
  if(ui.objOpen && !busy){
    l += "<div class='frame obj' data-act='obj'>";
    if(g.modeId!=="prosperity"){
      var cq = g.conquest(), mg = "<div class='gold'>"+ic("flag","s")+" "+esc(g.modeGoal())+"</div>";
      if(cq.need) mg += "<div class='dim' style='font-size:11px'>Régions : "+cq.have+"/"+cq.need+(cq.baronNear ? " · terres voisines au Baron : "+cq.baronNear : "")+(g.camps.length ? " · camps de brigands : "+g.camps.length : "")+"</div>";
      l += mg;
    }
    var past = GOALS.filter(function(x){ return g.goals.done[x.id]!==undefined; });
    if(past.length) l += "<div class='done'>✔ "+esc(past[past.length-1].name)+(past.length>1 ? " <span class='dim'>(et "+(past.length-1)+" autre"+(past.length>2?"s":"")+")</span>" : "")+"</div>";
    var nx = g.nextGoals(3);
    nx.forEach(function(x, i){
      l += "<div>○ "+esc(x.name)+"</div>";
      if(i===0 && x.hint) l += "<div class='hint'>"+esc(x.hint)+"</div>";
    });
    if(g.victory) l += "<div class='gold'>La seigneurie prospère !</div>";
    l += "</div>";
  }
  /* notifications : les 3 plus récentes, 6 s chacune */
  var now = Date.now();
  var ts = g.toasts.filter(function(t){ return now-t.t<6000; }).slice(busy ? -1 : -3);
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
  if(ui.zoneMode && ui.zoneKind!=="house"){
    var isF = ui.zoneKind==="field";
    var po = zoneOverlay(g), pp = ui.zonePts.length, ppl = po && po.plan, ptxt, ptitle = isF ? "Champ" : "Pâturage", pok = ui.zoneClosed && ppl && !ppl.err;
    if(!ui.zoneClosed) ptxt = pp===0 ? (isF ? "Touchez la carte pour poser les points du champ, où vous voulez ("+FIELD_MIN+" à "+FIELD_MAX+" cases). Le calque montre la fertilité." : "Touchez la carte pour poser les points de la clôture, où vous voulez (4 cases au moins).")
      : pp<3 ? pp+" point"+(pp>1?"s":"")+" posé"+(pp>1?"s":"")+". Continuez le contour."
      : pp+" points. Touchez le premier point (doré) ou « Fermer ». Appui long sur un point pour le déplacer.";
    else if(!pok) ptxt = ppl ? ppl.err : "";
    else if(isF){
      ptitle = "Champ de "+ppl.n+" cases · fertilité "+Math.round(ppl.fert*100)+" %";
      ptxt = "Gratuit. "+CROP_DEFS[ppl.crop].name+" (culture proposée) : récolte estimée ≈ "+ppl.qty+(CROP_DEFS[ppl.crop].sheaf ? " gerbes" : "")+" par an, avant météo et rotation.";
    } else {
      ptitle = "Pâturage de "+ppl.n+" cases "+costHtml({ timber:ppl.cost }, g);
      ptxt = "Herbe pour ~"+Math.floor((ppl.n-1)/0.5)+" moutons, ~"+Math.floor(ppl.n-1)+" vaches ou ~"+Math.floor((ppl.n-1)/0.5)+" porcs. L'abri se place au bord, côté route.";
    }
    h += "<div class='frame place wrap'>"+(isF ? ICONS.th("field") : ic("sheep","l"))+"<div class='t'><b>"+ptitle+"</b><span>"+rich(ptxt)+"</span></div><div class='sizes'>";
    if(pp>0) h += "<button class='b' data-act='zoneundo' aria-label='Annuler le dernier point'>↶</button>";
    if(!ui.zoneClosed && pp>=3) h += "<button class='b' data-act='zoneclose'>Fermer</button>";
    if(pok) h += "<button class='b gold' data-act='zoneok'>"+(isF ? "Tracer" : "Clôturer")+"</button>";
    h += "</div><button class='b sq' data-act='cancel' aria-label='Annuler'>"+ic("close")+"</button></div>";
  } else if(ui.zoneMode){
    var zo = zoneOverlay(g), zp = ui.zonePts.length, zpl2 = zo && zo.plan, ztxt, ztitle = "Zone de bourgages", zok = ui.zoneClosed && zpl2 && !zpl2.err;
    if(!ui.zoneClosed) ztxt = zp===0 ? "Touchez la carte pour poser les points du contour, le long d'une route."
      : zp<3 ? zp+" point"+(zp>1?"s":"")+" posé"+(zp>1?"s":"")+". Continuez le contour."
      : zp+" points. Touchez le premier point (doré) ou « Fermer ». Appui long sur un point pour le déplacer.";
    else if(!zok) ztxt = zpl2 ? zpl2.err : "";
    else {
      var zs = zpl2.plots.map(function(p){ return p.cells.length-1; }), zmn = Math.min.apply(null, zs), zmx = Math.max.apply(null, zs);
      ztitle = zpl2.plots.length+" maison"+(zpl2.plots.length>1?"s":"")+" "+costHtml({ timber:zpl2.plots.length*(BUILD_DEFS.burgage.cost.timber||0) }, g);
      ztxt = "Jardins de "+(zmn===zmx ? zmn : zmn+" à "+zmx)+" case"+(zmx>1?"s":"")+(zpl2.limited ? " · bois insuffisant pour plus" : "")+". Appui long sur un point pour le déplacer.";
    }
    h += "<div class='frame place wrap'>"+ic("house","l")+"<div class='t'><b>"+ztitle+"</b><span>"+esc(ztxt)+"</span></div><div class='sizes'>";
    if(zp>0) h += "<button class='b' data-act='zoneundo' aria-label='Annuler le dernier point'>↶</button>";
    if(!ui.zoneClosed && zp>=3) h += "<button class='b' data-act='zoneclose'>Fermer</button>";
    if(zok) h += "<button class='b' data-act='zoneminus' data-arg='-1' aria-label='Une maison de moins'>−</button><button class='b' data-act='zoneplus' data-arg='1' aria-label='Une maison de plus'>+</button><button class='b gold' data-act='zoneok'>Tracer</button>";
    h += "</div><button class='b sq' data-act='cancel' aria-label='Annuler'>"+ic("close")+"</button></div>";
  } else if(ui.roadMode){
    h += "<div class='frame place'>"+ic("road","l")+"<div class='t'><b>Routes</b><span>Touchez une case pour tracer ou effacer. Les villageois y marchent plus vite.</span></div>"
       + "<button class='b gold' data-act='cancel'>Terminer</button></div>";
  } else if(ui.movePost){
    h += "<div class='frame place'>"+ic("ox","l")+"<div class='t'><b>Déplacer le poteau du bœuf</b><span>"+(ui.pendingPlace
         ? "Touchez à nouveau l'emplacement bleu pour valider, ou ailleurs pour le changer."
         : "Touchez la carte là où les bœufs doivent attendre : près des chantiers ou des champs.")+"</span></div>";
    if(ui.pendingPlace) h += "<button class='b gold' data-act='placeok'>Valider</button>";
    h += "<button class='b sq' data-act='cancel' aria-label='Annuler'>"+ic("close")+"</button></div>";
  } else if(ui.buildSel){
    var d = BUILD_DEFS[ui.buildSel];
    h += "<div class='frame place'><div class='t'><b>"+esc(d.name)+" "+costHtml(d.cost, g)+"</b><span>"+(ui.pendingPlace
         ? "Touchez à nouveau l'emplacement bleu pour valider, ou ailleurs pour le changer."
         : "Touchez la carte pour choisir l'emplacement"+(UNIQUE[ui.buildSel] ? "" : " (plusieurs à la suite)")+".")+"</span></div>";
    if(ui.pendingPlace) h += "<button class='b gold' data-act='placeok'>Valider</button>";
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
    else if(ui.selV!=null) h = sheetVillager(g);
    else if(ui.selId!=null) h = sheetSelection(g);
    else if(ui.sheet==="people") h = sheetPeople(g);
    else if(ui.sheet==="stock") h = sheetStock(g);
    else if(ui.sheet==="realm") h = sheetRealm(g);
    else if(ui.sheet==="book") h = sheetBook(g);
    else if(ui.sheet==="council") h = sheetCouncil(g);
    else if(ui.sheet==="laws") h = sheetLaws(g);
    else if(ui.sheet==="justice") h = sheetJustice(g);
    else if(ui.sheet==="plots") h = sheetPlots(g);
    else if(ui.sheet==="chronicle") h = sheetChronicle(g);
    else if(ui.sheet==="menu") h = sheetMenu(g);
    else if(ui.sheet==="oxen") h = sheetOxen(g);
  }
  var key = (ui.cat||"")+"|"+ui.selId+"|"+ui.selV+"|"+(ui.sheet||"");
  var reset = elSheet._key !== key;
  setHTML(elSheet, h);
  if(reset){ elSheet._key = key; elSheet.scrollTop = 0; }
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
  h += "<div class='dim' style='font-size:10px;margin:-2px 0 4px'>Appui long sur une carte : sa fiche détaillée.</div>";
  h += "<div class='cards'>";
  for(var i=0;i<cat.items.length;i++){
    var id = cat.items[i], d = BUILD_DEFS[id];
    var ok = g.canAfford(id);
    var built = g.buildings.filter(function(b){ return b.def===id; }).length;
    h += "<button class='card"+(ok?"":" off")+(ui.buildSel===id?" on":"")+"' data-act='build' data-arg='"+id+"'>"
       + "<span class='pic'>"+ICONS.th(id)+"</span><span class='nm'>"+esc(d.name)+"</span>"
       + "<span>"+costHtml(d.cost, g)+"</span>"
       + "<span class='ws'>"+(d.fam>0 ? d.fam+" ouvrier"+(d.fam>1?"s":"") : (id==="burgage" ? "loge 1 famille" : "sans ouvrier"))+(built ? " · "+built+" posé"+(built>1?"s":"") : "")+"</span></button>";
  }
  var acts = cat.actions || [];
  for(var a=0;a<acts.length;a++){
    if(acts[a]==="zone") h += actionCard("zone", ic("house","l"), "Tracer une zone", costHtml(BUILD_DEFS.burgage.cost, g)+"<span class='dim'> / maison</span>", "Parcelles le long d'une route");
    if(acts[a]==="fieldzone") h += actionCard("fieldzone", ICONS.th("field"), "Tracer un champ", "<span class='cost'>gratuit</span>", "Forme libre, "+FIELD_MIN+" à "+FIELD_MAX+" cases");
    if(acts[a]==="pasture") h += actionCard("pasture", ic("sheep","l"), "Tracer un pâturage", "<span class='cost'>clôture "+ic("timber","s")+"</span>", "Moutons, vaches ou porcs");
    if(acts[a]==="oxpost"){
      var post = g.buildings.filter(function(b){ return b.def==="oxpost"; })[0];
      h += post ? actionCard("movepost", ICONS.th("oxpost"), "Déplacer le poteau", "<span class='cost'>gratuit</span>", g.oxen.length+" bœuf"+(g.oxen.length>1?"s":"")+" · toucher pour gérer")
                : actionCard("build' data-arg='oxpost", ICONS.th("oxpost"), "Poteau du bœuf", costHtml(BUILD_DEFS.oxpost.cost, g), "Là où les bœufs attendent");
    }
    if(acts[a]==="buyox") h += actionCard("buyox", ic("ox","l"), "Acheter un bœuf", "<span class='cost"+(g.treasury<20?" no":"")+"'>20"+ic("coin","s")+"</span>", "Labours plus rapides");
    if(acts[a]==="militia") h += actionCard("militia", ic("sword","l"), "Lever la milice", "<span class='cost'>"+g.units.length+" / "+g.militiaCount()+"</span>", "1 soldat pour 2 familles");
    if(acts[a]==="merc") h += actionCard("merc", ic("shield","l"), "Mercenaire", "<span class='cost"+(g.treasury<25?" no":"")+"'>25"+ic("coin","s")+"</span>", "Loué pour 6 mois");
  }
  h += "</div>";
  return h;
}
/* appui long sur une carte du tiroir : la fiche du bâtiment (à quoi il sert, ce qu'il produit, ce qu'il lui faut) */
var BUILD_INFO = {
  woodcutter:{ makes:["timber","firewood"], fx:["Abat les arbres dans un rayon de 6 cases : bois d'œuvre pour bâtir, bois de chauffe pour l'hiver.","Gratuit : posez-le au bord d'une forêt.","Le camp sert aussi de dépôt de bois pour les chantiers voisins."] },
  forager:   { makes:["berries"], fx:["Cueille les baies des buissons dans un rayon de 6 cases, de mars à novembre.","Rien l'hiver : faites des réserves ou d'autres vivres."] },
  hunter:    { makes:["meat"], fx:["Chasse le gibier des forêts dans un rayon de 10 cases, toute l'année.","La viande fraîche se gâte vite : un fumoir la conserve."] },
  quarry:    { makes:["stone"], fx:["À poser sur un gisement de pierre ; il s'épuise avec le temps.","La carrière sert de dépôt de pierre pour les chantiers."] },
  farm:      { makes:["sh_grain","grain","barley","oats","flax","pulses","hay"], fx:["Ses fermiers travaillent tous les champs : fumure, labour, semailles, moisson, fauche.","Ils battent les gerbes en grain l'hiver.","Un bœuf attelé double la vitesse du labour.","Les champs se tracent gratuitement depuis ce même tiroir."] },
  windmill:  { makes:["flour"], fx:["1 grain donne 1 farine.","Sans boulangerie, chaque foyer cuit sa farine (1 farine → 1 pain).","Artisans bourgeois deux fois plus efficaces qu'un serf."] },
  bakery:    { makes:["bread"], fx:["1 farine donne 1,5 pain, avec ¼ de bois de chauffe par fournée.","Le pain rassit vite : on cuit à mesure des besoins.","Ajoute le pain (une sorte d'aliment) aux repas."] },
  dairy:     { makes:["cheese"], fx:["3 laits donnent 2 fromages.","Il faut des vaches au pâturage (lait après le vêlage).","Le fromage se garde tout l'hiver et se vend bien."] },
  smokehouse:{ makes:["smoked"], fx:["1 viande donne 1 viande fumée, avec ½ bois de chauffe.","La viande fumée se garde des mois.","Laisse "+(typeof SMOKE_KEEP!=="undefined" ? SMOKE_KEEP : 4)+" viandes fraîches pour la table."] },
  granary:   { fx:["Met "+GRANARY_CAP+" denrées à l'abri : elles s'y gâtent trois fois moins vite.","Les artisans y viennent chercher grain, farine, lait et viande."] },
  storehouse:{ fx:["+150 de capacité de stockage pour chaque ressource.","Sert de dépôt de bois et de pierre : posez-le près des chantiers."] },
  market:    { fx:["Distribue les vivres : sans marché, chaque famille ne mange qu'une sorte d'aliment.","Indispensable pour que les maisons montent de niveau."] },
  trade:     { makes:["coin"], fx:["Vend chaque mois les vrais surplus (il garde de quoi manger et se vêtir).","Les prix varient et baissent pour ce qu'on vend en masse.","Fait monter la richesse régionale, qui sert à réclamer des régions."] },
  church:    { fx:["+5 d'approbation, de l'influence chaque mois.","Requise pour les maisons de niveau 3 et pour la dîme.","S'améliore ensuite (autel, clocher)."] },
  tower:     { fx:["+4 d'approbation.","Réduit de moitié le pillage des raids."] },
  wall:      { fx:["Case infranchissable : les brigands ne passent pas.","Coûte 2 pierres par case."] },
  manor:     { fx:["Siège de l'administration : taille, péages, corvée, décrets, changeur.","Ouvre le conseil (intendant, bailli, chapelain, maître d'armes) et le coutumier.","+1 d'influence par mois."] },
  oxpost:    { fx:["Les bœufs y attendent entre deux travaux.","Les journaliers viennent y chercher un bœuf pour traîner trois troncs.","Se déplace gratuitement, à tout moment."] },
  zone:      { title:"Zone de maisons", pic:function(){ return ic("house","l"); }, fx:["Tracez un contour le long d'une route : il est découpé en parcelles, une maison et sa cour chacune.","Une maison loge 6 personnes (8 au niveau 2, 10 au niveau 3).","La cour accueille un potager, une basse-cour, un verger, un rucher, un tailleur ou une brasserie."], cost:function(){ return BUILD_DEFS.burgage.cost; } },
  fieldzone: { title:"Champ", pic:function(){ return ICONS.th("field"); }, fx:["Gratuit, à la forme que vous voulez ("+FIELD_MIN+" à "+FIELD_MAX+" cases).","Le rendement dépend de la fertilité (calque), de la météo et de la rotation.","Il faut une ferme et ses fermiers pour le travailler."] },
  pasture:   { title:"Pâturage", pic:function(){ return ic("sheep","l"); }, fx:["Enclos tracé librement ; la clôture coûte du bois selon sa longueur.","Moutons (laine), vaches (lait, fumier, futurs bœufs) ou porcs (glandée).","Un gardien soigne les bêtes ; l'hiver, il faut du foin."] },
  buyox:     { title:"Bœuf de trait", pic:function(){ return ic("ox","l"); }, fx:["20 deniers. Polyvalent : il traîne trois troncs jusqu'aux chantiers et double la vitesse du labour.","Choisissez sa tâche dans le panneau du poteau : polyvalent, charroi, labour ou repos.","Mange 1 foin par mois l'hiver."] },
  movepost:  { alias:"oxpost" },
  militia:   { title:"Milice", pic:function(){ return ic("sword","l"); }, fx:["Un soldat pour deux familles, levé parmi les adultes.","Détruit les camps de brigands."] },
  merc:      { title:"Mercenaire", pic:function(){ return ic("shield","l"); }, fx:["25 deniers, loué pour 6 mois.","Complète la milice sans prendre d'ouvriers."] }
};
function modalBuildInfo(g){
  var id = ui.infoId, inf = BUILD_INFO[id] || {};
  if(inf.alias){ id = inf.alias; inf = BUILD_INFO[id] || {}; }
  var d = BUILD_DEFS[id];
  var title = inf.title || (d ? d.name : id), pic = inf.pic ? inf.pic() : (d ? ICONS.th(id) : "");
  var h = "<h2>"+pic+esc(title)+"</h2>";
  if(d && d.desc) h += "<p>"+esc(d.desc)+"</p>";
  var cost = inf.cost ? inf.cost() : d ? d.cost : null;
  var facts = [];
  if(cost && Object.keys(cost).length) facts.push("<b>Coût</b> "+costHtml(cost, g));
  else if(d) facts.push("<b>Coût</b> gratuit");
  if(d && !inf.title){
    if(d.fam>0) facts.push("<b>Ouvriers</b> "+d.fam+(d.skill && SKILL_DEFS[d.skill] ? " · savoir-faire : "+esc(SKILL_DEFS[d.skill].name.toLowerCase()) : ""));
    else facts.push("<b>Ouvriers</b> aucun");
    if(!d.uiSize && !d.zone) facts.push("<b>Taille</b> "+d.w+" × "+d.h+" case"+(d.w*d.h>1?"s":""));
    if(d.radius) facts.push("<b>Rayon</b> "+d.radius+" cases");
    facts.push("<b>Chantier</b> "+(d.instant ? "posé aussitôt" : "bâti par les journaliers, matériaux livrés"));
  }
  if(facts.length) h += "<div class='facts'>"+facts.map(function(f){ return "<div>"+f+"</div>"; }).join("")+"</div>";
  if(inf.makes) h += "<h3>Produit</h3><div class='chips' style='margin:4px 0'>"+inf.makes.map(function(k){ return "<span class='chip'>"+ic(k,"s")+(RES[k] ? esc(RES[k].n) : k==="coin" ? "Deniers" : esc(k))+"</span>"; }).join("")+"</div>";
  if(inf.fx) h += "<h3>Effets</h3><ul class='fx'>"+inf.fx.map(function(x){ return "<li>"+esc(x)+"</li>"; }).join("")+"</ul>";
  if(d && g){ var n = g.buildings.filter(function(b){ return b.def===id; }).length; if(n) h += "<p class='dim' style='font-size:12px'>Vous en avez "+n+".</p>"; }
  return h + closeBtn();
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
  var hsp = sel.def==="pasture" && sel.herd && LIVESTOCK[sel.herd.sp] && sel.herd.an.length ? LIVESTOCK[sel.herd.sp] : null;
  var h = head(ICONS.th(sel.def), esc(d.name)+(sel.def==="burgage" ? " · niveau "+sel.lvl : "")+(hsp ? " · "+hsp.name : "")+(sel.def==="field" ? " · "+g.fieldN(sel)+" cases" : ""), status ? esc(status) : "");
  if(sel.def!=="field") h += "<div class='desc'>"+esc(hsp ? hsp.desc : d.desc)+"</div>";
  if(!sel.done){
    h += "<div class='row'><span class='dim'>Chantier</span>"+bar(sel.progress||0,"gold")+"<b>"+Math.round((sel.progress||0)*100)+" %</b></div>";
    h += sheetSite(g, sel);
  }
  if(d.fam>0) h += workersHtml(g, sel, d);
  if(sel.def==="burgage"){
    var fam = g.families.filter(function(f){ return f.home===sel.id; })[0];
    h += "<div class='kv'><span class='k'>"+ic("family","s")+(fam ? esc(fam.name) : "Logement vacant")+"</span>"
       + (sel.monthsGood>0 ? "<span class='v good'>Bien loti : "+sel.monthsGood+" mois</span>" : "")+"</div>";
    var hn = g.houseCount(sel), hc = g.houseCap(sel);
    h += "<div class='kv'><span class='k'>Habitants</span>"+bar(hn/hc, hn>hc ? "red" : hn===hc ? "gold" : "")+"<span class='v "+(hn>hc ? "bad" : hn===hc ? "gold" : "")+"'>"+hn+" / "+hc+"</span></div>";
    if(hn>hc) h += "<div class='bad' style='font-size:11px;margin:-2px 0 4px'>Surpeuplée : des familles s'entassent faute d'autre maison.</div>";
    else if(fam && hn===hc) h += "<div class='gold' style='font-size:11px;margin:-2px 0 4px'>Maison pleine : plus de naissances ici"+(sel.lvl<3 ? " tant qu'elle n'a pas gagné un niveau ("+g.houseCap({ lvl:sel.lvl+1 })+" places)" : "")+".</div>";
    else if(fam && sel.lvl<3) h += "<div class='dim' style='font-size:11px;margin:-2px 0 4px'>Niveau "+sel.lvl+" : "+hc+" places ; "+g.houseCap({ lvl:sel.lvl+1 })+" au niveau suivant.</div>";
    if(fam && fam.menu) h += "<div class='kv'><span class='k dim' style='font-size:11px'>Au menu le mois dernier</span><span class='v' style='font-size:11px'>"
       + (fam.menu.length ? fam.menu.map(function(gk){ return esc(FOOD_GROUPS[gk] ? FOOD_GROUPS[gk].name.toLowerCase() : gk); }).join(", ") : "rien")
       + (fam.gruel ? " <span class='bad'>(bouillie de disette)</span>" : "")+"</span></div>";
    /* étape 8 : ce qu'il manque pour monter d'un niveau, condition par condition */
    var lnd = g.levelNeeds(sel);
    if(lnd){
      var lc = g.levelCost(sel), lck = Object.keys(lc).map(function(k){ return lc[k]+"&nbsp;"+ic(k,"s"); }).join(" ");
      h += "<div class='sec'>Pour passer au niveau "+(sel.lvl+1)+" <span class='dim' style='font-weight:normal'>· "+Math.min(sel.monthsGood||0, 3)+"/3 mois d'affilée · <span style='white-space:nowrap'>"+lck+"</span></span></div><div class='needs'>";
      lnd.forEach(function(n){ h += "<span class='"+(n[1] ? "good" : "bad")+"'>"+(n[1] ? "✔" : "✗")+" "+esc(n[0])+"</span>"; });
      h += "</div>";
    }
    if(fam){
      h += "<div class='kv'><span class='k'>"+ic("crown","s")+"Ordre</span><span class='v'>"+esc(ORDER_DEFS[fam.ord||"serf"].name)+"</span></div>";
      if(fam.ord!=="noble" && sel.lvl>=3) h += "<button class='b wide"+(g.canEnnoble(fam)?" off":"")+"' data-act='ennoble' data-arg='"+fam.id+"'>"+ic("crown","s")+"Anoblir la famille · "+g.ennobleCost()+" d'influence</button>"
         + "<div class='dim' style='font-size:11px'>"+(g.nobleCount()>=g.nobleCap() ? "<span class='bad'>La noblesse reste rare : une famille noble pour huit familles au plus.</span> " : "")+"Noble, elle ne travaille plus, sert à votre cour, au clergé ou comme lettrée, ne paie pas la taille et veut chaque mois des vêtements et une bonne table.</div>";
      else if(fam.ord==="serf" && sel.lvl<2) h += "<div class='dim' style='font-size:11px'>Au niveau 2, la famille entrera dans la bourgeoisie (artisans deux fois plus efficaces, plus de corvée).</div>";
    }
    if(fam) g.membersOf(fam.id).forEach(function(v){ h += vRow(g, v); });
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
  if(sel.def==="field" && sel.f) h += sheetField(g, sel);
  if(sel.def==="farm" && sel.done) h += sheetFarm(g);
  if(sel.def==="oxpost"){
    h += "<button class='b wide gold' data-act='movepost'>"+ic("ox","s")+"Déplacer le poteau (gratuit)</button>";
    h += oxenHtml(g);
  }
  if(RECIPES[sel.def] && sel.done) h += sheetWorkshop(g, sel);
  if(sel.def==="granary" && sel.done) h += sheetGranary(g);
  if(sel.def==="pasture" && sel.herd) h += sheetPasture(g, sel);
  if(sel.def==="trade" && sel.done){
    h += "<div class='sec'>Prix du marché (deniers)</div><div class='chips'>";
    for(var pk in g.prices) h += "<span class='chip'>"+(RES[pk] ? ic(pk,"s") : esc(pk))+" "+String(g.prices[pk]).replace(".", ",")+(g.tradeLast && g.tradeLast[pk] ? " <span class='dim'>(−"+g.tradeLast[pk]+")</span>" : "")+"</span>";
    h += "</div><div class='dim' style='font-size:11px'>Entre parenthèses : ce qui a été vendu le mois dernier.</div>";
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
    h += sheetFisc(g);
    h += "<div class='sec'>Décrets</div>";
    for(var pi=0; pi<POLICY_ORDER.length; pi++){
      var pd = POLICY_DEFS[POLICY_ORDER[pi]], on = !!g.policies[pd.id];
      h += "<button class='ext"+(on?" have":"")+"' style='cursor:pointer' data-act='policy' data-arg='"+pd.id+"'><span class='t'><b>"+esc(pd.name)+"</b><span>"+esc(pd.desc)+"</span></span><span class='"+(on?"good":"dim")+"'>"+(on?"Actif":"—")+"</span></button>";
    }
  }
  var armed = Date.now() < ui.demolishArm;
  var lbl = !sel.done && sel.mat ? "Abandonner le chantier (matériaux non employés rendus)" : "Démolir (moitié remboursée)";
  h += "<button class='b red wide' data-act='demolish'>"+(armed ? "Toucher encore pour confirmer" : lbl)+"</button>";
  return h;
}
/* étape 5 bis : matériaux du chantier — livrés, en route, à aller chercher */
function sheetSite(g, sel){
  var h = "";
  if(!sel.mat){
    return h + "<div class='dim' style='font-size:11px'>Les journaliers (adultes sans poste) construisent les chantiers.</div>";
  }
  if(g.unemployed()===0 && !g.workersOf(sel).length) h += "<div class='bad' style='font-size:12px;margin:4px 0'>Aucun journalier libre : ce chantier n'avance pas. Retirez quelqu'un d'un poste (bouton − d'un bâtiment) pour qu'il construise.</div>";
  h += "<div class='sec'>Matériaux</div>";
  MAT_RES.forEach(function(r){
    var need = sel.mat.need[r]; if(!need) return;
    var got = Math.min(need, sel.mat.got[r]||0), way = g.inTransit(sel, r);
    h += "<div class='row'><span class='dim'>"+ic(r,"s")+RES[r].n+"</span>"+bar(got/need, got>=need ? "" : "gold")
       + "<b>"+Math.floor(got)+" / "+need+"</b></div>";
    if(got<need) h += "<div class='dim' style='font-size:11px;margin:-2px 0 4px'>"
       + (way>0 ? way+" en route"+(g.villagers.some(function(v){ return v.task && v.task.type==="haul" && v.task.ox && v.task.bid===sel.id && v.task.res===r && v.task.phase!=="back"; }) ? " (avec le bœuf)" : "") : g.pickable(r)<=0 ? "plus rien en réserve : il faut en produire" : r==="timber" && g.oxen.some(function(o){ return g.oxCanHaul(o); }) ? "le bœuf est pris, on attend son retour" : "personne n'est encore parti le chercher")+"</div>";
  });
  var deps = g.depotsFor("timber").concat(g.depotsFor("stone")).filter(function(b, i, a){ return a.indexOf(b)===i; });
  h += "<div class='dim' style='font-size:11px'>Les journaliers vont chercher le bois et la pierre "
     + (deps.length ? "au plus commode des dépôts ("+deps.map(function(b){ return BUILD_DEFS[b.def].name.toLowerCase(); }).filter(function(n, i, a){ return a.indexOf(n)===i; }).join(", ")+")" : "chez un marchand, faute de dépôt")
     + ". Un tronc est trop lourd pour un homme : un journalier mène le bœuf, qui en traîne trois (faute de bœuf, on en traîne un à la main, lentement). La pierre se porte une à une. Chaque charge sort du stock quand elle est déposée ; on ne bâtit qu'avec ce qui est arrivé.</div>";
  h += "<button class='ext"+(sel.prio ? " have" : "")+"' style='cursor:pointer' data-act='sprio'><span class='t'><b>Livrer en priorité</b><span>Porteurs et bœuf servent ce chantier avant les autres.</span></span><span class='"+(sel.prio ? "good" : "dim")+"'>"+(sel.prio ? "Oui" : "—")+"</span></button>";
  return h;
}

/* =====================================================================
   ÉTAPE 5 : champs, ferme, pâturages
   ===================================================================== */
var CROP_IC = { wheat:"grain", rye:"rye", barley:"barley", oats:"oats", flax:"flax", peas:"pulses", hay:"hay", fallow:null };
function pct(x){ return Math.round(x*100)+" %"; }
function mulTxt(x){ return "×"+(Math.round(x*100)/100).toFixed(2).replace(".", ","); }
function cropIc(id, cls){ var k = CROP_IC[id]; return k ? ic(k, cls||"s") : "<i class='ic s' style='background:#5a4630'></i>"; }
/* calendrier d'une culture en une ligne */
function calTxt(cd){
  var cal = CROP_CAL[cd.season] || {};
  if(cd.season==="rest") return "Aucun travail : le champ se repose une année.";
  if(cd.season==="meadow") return "Repousse en mars · fauche "+monthsTxt(cal.harvest);
  var plow = cal.plow.slice().sort(function(a, c){ return ((a+5)%12)-((c+5)%12); });
  return "Labour "+monthsTxt(plow)+" · semailles "+monthsTxt(cal.sow)+" · récolte "+monthsTxt(cal.harvest);
}
function sheetField(g, sel){
  var f = sel.f, cd = g.liveCrop(f), h = "";
  if(!f.sown){
    h += "<div class='sec'>Culture prévue · "+g.fieldN(sel)+" cases</div><div class='crops'>";
    for(var ci=0; ci<CROP_ORDER.length; ci++){
      var c = CROP_DEFS[CROP_ORDER[ci]];
      h += "<button class='b"+(f.crop===c.id?" on":"")+"' data-act='crop' data-arg='"+c.id+"'>"+cropIc(c.id)+"<span>"+esc(c.short||c.name)+"</span></button>";
    }
    h += "</div>";
  } else {
    h += "<div class='sec'>En terre · "+g.fieldN(sel)+" cases</div>"
       + "<div class='kv'><span class='k'>"+cropIc(cd.id,"")+"<b>"+esc(cd.name)+"</b></span><span class='v dim' style='font-weight:400'>semé"+(cd.season==="meadow" ? " (pré)" : "")+" en "+MONTHS_ABBR[((f.sownAt%12)+12)%12]+" "+Math.floor(f.sownAt/12)+"</span></div>";
  }
  h += "<div class='desc'>"+esc(cd.desc)+"<br><span class='gold'>"+esc(calTxt(cd))+"</span></div>";
  /* la rotation : ce qui a poussé avant ici */
  var rot = g.rotationMul(f, cd);
  if(rot[0]!==1) h += "<div class='"+(rot[0]>1?"good":"bad")+"' style='font-size:12px'>"+esc(rot[1])+" : rendement "+mulTxt(rot[0])+"</div>";
  if(f.hist.length){
    h += "<div class='chips' style='margin:4px 0'>";
    f.hist.slice().reverse().forEach(function(x){ h += "<span class='chip'>"+x.y+" · "+cropIc(x.crop)+esc(CROP_DEFS[x.crop].short||CROP_DEFS[x.crop].name)+" "+x.q+"</span>"; });
    h += "</div>";
  }
  if(cd.season!=="rest"){
    h += "<div class='sec'>Travaux</div>";
    h += "<div class='kv'><span class='k'>Fertilité</span>"+bar(f.fert, f.fert<0.35?"red":"")+"<span class='v'>"+pct(f.fert)+"</span></div>";
    if(cd.season!=="meadow"){
      if(!f.sown){
        var man = Math.floor(g.stock.manure||0);
        h += "<div class='kv'><span class='k'>"+ic("manure","s")+"Fumure</span>"+bar(f.dunged ? 1 : f.dungP,"gold")+"<span class='v'>"+(f.dunged ? "faite" : man>=1 ? man+" en réserve" : "pas de fumier")+"</span></div>";
        h += "<div class='kv'><span class='k'>Labour</span>"+bar(f.plow,"gold")+"<span class='v'>"+pct(f.plow)+"</span></div>";
        h += "<div class='kv'><span class='k'>Semailles</span>"+bar(f.sowP,"gold")+"<span class='v'>"+pct(f.sowP)+"</span></div>";
      }
    }
    if(f.sown){
      h += "<div class='kv'><span class='k'>Pousse</span>"+bar(f.growth)+"<span class='v'>"+pct(f.growth)+"</span></div>";
      if(f.harvestP>0) h += "<div class='kv'><span class='k'>"+(cd.season==="meadow" ? "Fauche" : "Moisson")+"</span>"+bar(f.harvestP,"gold")+"<span class='v'>"+pct(f.harvestP)+"</span></div>";
    }
    /* la récolte attendue, et pourquoi */
    var fc = g.forecast(sel);
    h += "<div class='sec'>Récolte attendue</div><div class='kv'><span class='k'>"+(fc.unit ? ic(fc.unit.indexOf("sh_")===0 ? "sheaf" : fc.unit) : "")+"<b>≈ "+fc.qty+"</b>"
       + "<span class='dim'>"+(cd.sheaf ? "gerbes à battre" : RES[fc.unit] ? RES[fc.unit].n.toLowerCase() : "")+"</span></span></div><div class='why'>";
    fc.parts.forEach(function(p){ h += "<div><span>"+esc(p[0])+"</span><b class='"+(p[1]>=1 ? "good" : p[1]>=0.7 ? "gold" : "bad")+"'>"+mulTxt(p[1])+"</b></div>"; });
    (f.hits||[]).forEach(function(x){ h += "<div><span class='dim'>· "+esc(x[0])+"</span><b class='bad'>"+x[1]+" %</b></div>"; });
    h += "</div>";
  }
  if(!g.buildings.some(function(b){ return b.def==="farm" && b.done && g.workersOf(b).length>0; })) h += "<div class='bad' style='font-size:12px;margin-top:6px'>Aucune ferme active : ce champ ne sera pas travaillé.</div>";
  return h;
}
function sheetFarm(g){
  var h = "";
  h += oxenHtml(g);
  h += "<div class='sec'>Grange de la ferme</div>";
  var any = false;
  ["sh_grain","sh_barley","sh_oats"].forEach(function(k){ var q = Math.floor(g.stock[k]||0); if(q>0){ any = true; h += "<div class='kv'><span class='k'>"+ic(k,"s")+RES[k].n+"</span><span class='v'>"+q+"</span></div>"; } });
  if(!any) h += "<div class='dim' style='font-size:12px'>Aucune gerbe à battre. Les fermiers battent au fléau quand les champs leur en laissent le temps, surtout l'hiver.</div>";
  h += "<div class='kv'><span class='k'>"+ic("manure","s")+"Fumier</span><span class='v'>"+Math.floor(g.stock.manure||0)+"</span></div>";
  var fs = g.fields();
  h += "<div class='sec'>Champs · "+fs.length+"</div>";
  if(!fs.length) h += "<div class='dim'>Tracez des champs depuis le tiroir Terres.</div>";
  fs.forEach(function(b){
    var cd = g.liveCrop(b.f), fc = g.forecast(b);
    var st = g.fieldStatus(b); if(st.indexOf(cd.name+" · ")===0) st = st.slice(cd.name.length+3);
    h += "<button class='vrow' data-act='bsel' data-arg='"+b.id+"'><span class='ppw'>"+cropIc(cd.id,"")+"</span><span class='t'>"+esc(cd.name)+" · "+g.fieldN(b)+" cases"
       + "<span class='s'>"+esc(st.charAt(0).toUpperCase()+st.slice(1))+"</span></span>"+(fc.qty ? "<span class='mood dim'>≈"+fc.qty+"</span>" : "")+"</button>";
  });
  return h;
}
/* les bœufs de trait, un par un : ce qu'il fait, ce qu'on lui demande */
function oxenHtml(g){
  var h = "<div class='sec'>Bœufs de trait · "+g.oxen.length+"</div>";
  if(!g.oxen.length) h += "<div class='dim' style='font-size:12px'>Aucun bœuf. Un bœuf traîne trois troncs jusqu'aux chantiers et double la vitesse du labour.</div>";
  g.oxen.forEach(function(o, i){
    var job = g.oxJob(o);
    h += "<div class='oxrow'><div class='kv' style='border:0;padding:2px 0'><span class='k'>"+ic("ox","s")+"<b>Bœuf "+(i+1)+"</b> <span class='dim'>"+Math.floor(o.a/12)+" ans · "
       + "<span class='"+(o.h<50 ? "bad" : o.h<80 ? "gold" : "good")+"'>santé "+Math.round(o.h)+"</span></span></span></div>"
       + "<div class='dim' style='font-size:11px;margin:-2px 0 3px'>"+esc(g.oxActivity(o))+"</div><div class='seg4'>";
    OX_JOB_ORDER.forEach(function(j){
      h += "<button class='b sm"+(job===j ? " on" : "")+"' data-act='oxjob' data-arg='"+o.id+":"+j+"'>"+esc(OX_JOBS[j].name)+"</button>";
    });
    h += "</div></div>";
  });
  h += "<div class='dim' style='font-size:11px;margin-top:4px'>"+esc(OX_JOBS.all.desc)+" Un bœuf attelé à la charrue ne traîne pas de troncs en même temps : avec deux bœufs, l'un peut labourer pendant que l'autre charrie. L'hiver, chaque bœuf mange 1 foin par mois.</div>";
  h += "<div class='row'><button class='b sm' data-act='buyox'>Acheter un bœuf · 20"+ic("coin","s")+"</button>"
     + (g.oxen.length ? "<button class='b sm' data-act='retireox'>Réformer le plus vieux</button>" : "")+"</div>";
  return h;
}
function sheetOxen(g){
  var post = g.buildings.filter(function(b){ return b.def==="oxpost"; })[0];
  var h = head(ic("ox","l"), "Bœufs de trait", post ? "" : "Pas de poteau : ils attendent à la ferme ou au campement");
  h += oxenHtml(g);
  h += post ? "<button class='b wide' data-act='bsel' data-arg='"+post.id+"'>Voir le poteau</button>"
            : "<button class='b wide' data-act='build' data-arg='oxpost'>Poser un poteau "+costHtml(BUILD_DEFS.oxpost.cost, g)+"</button>";
  return h;
}
function herdCounts(g, h){
  var d = LIVESTOCK[h.sp], c = { f:0, m:0, y:0, sick:0 };
  h.an.forEach(function(a){ if(a.s>0) c.sick++; if(a.a<d.adultAt) c.y++; else if(a.f) c.f++; else c.m++; });
  return c;
}
function sheetPasture(g, sel){
  var h = "", hd = sel.herd, d = LIVESTOCK[hd.sp], n = hd.an.length;
  if(!sel.done) return h;
  if(!n){
    h += "<div class='sec'>Choisir les bêtes</div><div class='dim' style='font-size:11px;margin-bottom:4px'>Une seule espèce par pâturage. Il faut un mâle pour les naissances. Un marchand de bestiaux passe parfois au printemps.</div>";
    LIVESTOCK_ORDER.forEach(function(sp){
      var L = LIVESTOCK[sp], cap = Math.floor(g.grassCells(sel)/L.area);
      h += "<div class='ext' style='cursor:default'>"+ic(sp==="cattle" ? "cow" : sp)+"<span class='t'><b>"+L.name+"</b><span>"+esc(L.desc)+" Herbe pour ~"+cap+" adultes · foin "+String(L.fodder).replace(".", ",")+"/mois l'hiver.</span></span></div>"
         + "<div class='row' style='justify-content:flex-end;margin-top:0'><button class='b sm' data-act='buyanimal' data-arg='"+sp+":1'>+ "+L.f+" · "+L.buy+ic("coin","s")+"</button><button class='b sm' data-act='buyanimal' data-arg='"+sp+":0'>+ "+L.m+" · "+L.buy+ic("coin","s")+"</button></div>";
    });
    return h;
  }
  var c = herdCounts(g, hd), m = g.time.month, eq = g.herdEq(hd), cap = g.pastureCap(sel, isWinterMonth(m) ? 4 : m);
  h += "<div class='sec'>Troupeau · "+n+" "+(n>1 ? d.ones : d.one)+"</div>";
  h += "<div class='chips'><span class='chip'>"+c.f+" "+(c.f>1 ? d.fs : d.f.toLowerCase())+"</span><span class='chip'>"+c.m+" "+(c.m>1 ? d.ms : d.m.toLowerCase())+"</span>"
     + (c.y ? "<span class='chip'>"+c.y+" "+(c.y>1 ? d.youngs : d.young.toLowerCase())+"</span>" : "")
     + (c.sick ? "<span class='chip bad'>"+c.sick+" malade"+(c.sick>1?"s":"")+"</span>" : "")+"</div>";
  if(!c.m) h += "<div class='bad' style='font-size:12px;margin-top:4px'>Pas de "+d.m.toLowerCase()+" adulte : aucune naissance au printemps.</div>";
  if(hd.out>=0) h += "<div class='kv'><span class='k'>Glandée</span><span class='v good'>en forêt, ils s'engraissent</span></div>";
  else if(isWinterMonth(m)){
    var need = Math.round(eq*d.fodder*10)/10, have = g.fodderStock();
    h += "<div class='kv'><span class='k'>"+ic("hay","s")+"Au foin</span>"+bar(hd.fed, hd.fed<0.6?"red":hd.fed<1?"gold":"")+"<span class='v'>"+String(need).replace(".", ",")+"/mois</span></div>";
    h += "<div class='dim' style='font-size:11px'>Réserve de fourrage : "+Math.floor(have)+" (foin, et avoine comptée 1,5).</div>";
  } else {
    h += "<div class='kv'><span class='k'>"+ic("hay","s")+"Herbe</span>"+bar(Math.min(1, cap/Math.max(1, eq)), cap<eq?"red":cap<eq*1.3?"gold":"")+"<span class='v'>"+Math.floor(cap)+" places / "+Math.ceil(eq)+"</span></div>";
  }
  if(hd.sp==="pig") h += "<div class='dim' style='font-size:11px'>Glandée (sept.–nov.) : "+(g.forestNear(sel, 9)>=0 ? "<span class='good'>une forêt est à portée</span>" : "<span class='bad'>aucune forêt à moins de 9 cases</span>")+", avec un porcher.</div>";
  var L = hd.last || {}, prod = [];
  if(L.milk) prod.push(ic("milk","s")+String(L.milk).replace(".", ",")+" lait");
  if(L.wool) prod.push(ic("wool","s")+Math.round(L.wool)+" laine");
  if(L.hay) prod.push(ic("hay","s")+Math.round(L.hay)+" foin");
  if(L.born) prod.push(L.born+" naissance"+(L.born>1?"s":""));
  if(L.dead) prod.push("<span class='bad'>"+L.dead+" mort"+(L.dead>1?"s":"")+"</span>");
  if(prod.length) h += "<div class='kv'><span class='k dim'>Le mois dernier</span><span class='v' style='font-weight:400'>"+prod.join(" · ")+"</span></div>";
  if(!g.keeperOf(sel)) h += "<div class='bad' style='font-size:12px;margin-top:4px'>Sans "+d.job[0].toLowerCase()+" : ni lait ni tonte, moins de naissances, plus de maladies.</div>";
  h += "<div class='sec'>Commerce et boucherie</div><div class='row'>"
     + "<button class='b sm' data-act='buyanimal' data-arg='"+hd.sp+":1'>+ "+d.f+" · "+d.buy+ic("coin","s")+"</button>"
     + "<button class='b sm' data-act='buyanimal' data-arg='"+hd.sp+":0'>+ "+d.m+" · "+d.buy+ic("coin","s")+"</button>"
     + "<button class='b sm' data-act='sellanimal'>Vendre · +"+d.sell+ic("coin","s")+"</button>"
     + "<button class='b sm' data-act='slaughter'>Abattre · "+ic("meat","s")+"</button></div>";
  if(c.sick) h += "<button class='b red wide' data-act='cullsick'>"+(c.sick>1 ? "Abattre les "+c.sick+" bêtes malades" : "Abattre la bête malade")+" ("+esc(d.disease)+")</button>";
  /* l'abattage de novembre : combien en garder pour l'hiver ? */
  var keep = hd.keep, feedable = d.fodder>0 ? Math.floor(g.fodderStock()/3/d.fodder) : 0;
  h += "<div class='sec'>Abattage de novembre</div><div class='row'><div class='stepper'>"
     + "<button class='b sq' data-act='keepminus' aria-label='Garder une bête de moins'>−</button>"
     + "<span class='n'>"+(keep===null ? "tout" : keep)+"</span>"
     + "<button class='b sq' data-act='keepplus' aria-label='Garder une bête de plus'>+</button></div>"
     + (keep!==null ? "<button class='b sm' data-act='keepall'>Tout garder</button>" : "")
     + "<span class='dim' style='font-size:11px;flex:1 1 120px'>bêtes gardées pour l'hiver ; le reste part à la boucherie. Le fourrage en stock en nourrirait ~"+feedable+".</span></div>";
  return h;
}

/* ---------- étape 4 : les villageois ---------- */
function ageTxt(a){ return a+" an"+(a>1?"s":""); }
function moodCls(m){ return m>=60 ? "good" : m>=40 ? "gold" : "bad"; }
function signed(n){ return (n>0 ? "+" : n<0 ? "−" : "")+Math.abs(n); }
/* portrait : le sprite du villageois tel qu'il apparaît sur la carte */
function portrait(g, v, sc){
  var st = g.stageOf(v), n;
  if(st==="baby") n = "baby";
  else if(st==="child") n = "kid_"+(v.sex==="f" ? "f" : "m")+"_"+(v.id % 4)+"_idle";
  else {
    var b = v.work>0 ? g.buildings.filter(function(x){ return x.id===v.work; })[0] : null;
    var job = b && SPR.JOBS.indexOf(b.def)>=0 ? b.def : "laborer";
    n = "p_"+RENDER.lookOf(g, v)+"_"+job+"_idle";
  }
  return "<span class='ppw'>"+ICONS.pp(n, sc||2)+"</span>";
}
/* une ligne touchable : portrait, prénom, âge, ce qu'il fait, humeur */
function vRow(g, v, sub){
  return "<button class='vrow' data-act='vsel' data-arg='"+v.id+"'>"+portrait(g, v, 2)
    + "<span class='t'><b>"+esc(v.first)+"</b> <span class='dim'>"+ageTxt(g.ageOf(v))+"</span>"
    + "<span class='s"+(v.sick>0 ? " bad" : "")+"'>"+esc(sub!=null ? sub : g.villagerStatus(v))+"</span></span>"
    + "<span class='mood "+moodCls(v.mood)+"'>"+ic(heartIcon(v.mood),"s")+Math.round(v.mood)+"</span></button>";
}
function skillTxt(v, sk){ return SKILL_DEFS[sk].name+" : "+skillLevel(v.skills[sk]).toLowerCase(); }
/* panneau d'un bâtiment : ses ouvriers, son apprenti */
function workersHtml(g, sel, d){
  var ws = g.workersOf(sel), sk = d.skill, want = Math.max(Number(sel.want)||0, ws.length);
  var h = "<div class='sec'>Ouvriers</div><div class='row'><div class='stepper'>"
     + "<button class='b sq' data-act='unassign' aria-label='Un ouvrier de moins'>−</button>"
     + "<span class='n'>"+ws.length+"/"+d.fam+"</span>"
     + "<button class='b sq' data-act='assign' aria-label='Un ouvrier de plus'>+</button></div>"
     + "<span class='dim'>"+ic("family","s")+" "+g.unemployed()+" journalier"+(g.unemployed()>1?"s":"")+" libre"+(g.unemployed()>1?"s":"")+"</span></div>";
  if(!ws.length && want===0) h += "<div class='dim' style='font-size:11px'>+ embauche l'adulte libre le plus doué"+(sk ? " ("+SKILL_DEFS[sk].name.toLowerCase()+")" : "")+".</div>";
  ws.forEach(function(v){ h += vRow(g, v, (g.jobTitle(v)||"")+(sk ? " · "+skillLevel(v.skills[sk]).toLowerCase() : "")+(g.rankMul(v, sel)<1 ? " · serf, à demi-vitesse" : "")); });
  if(g.isSkilled(sel)) h += "<div class='dim' style='font-size:11px'>Métier d'artisan : un bourgeois (famille d'une maison de niveau 2) y travaille deux fois mieux qu'un serf.</div>";
  if(want>ws.length) h += "<div class='gold' style='font-size:12px;margin:4px 0'>"+(want-ws.length)+" poste"+(want-ws.length>1?"s":"")+" en attente d'un adulte libre.</div>";
  if(sk && sel.done){
    var ap = g.apprenticeOf(sel), m = g.masterOf(sel);
    h += "<div class='sec'>Apprenti</div>";
    if(ap){
      h += vRow(g, ap, "Apprenti"+(ap.sex==="f"?"e":"")+" · "+skillLevel(ap.skills[sk]).toLowerCase());
      h += "<div class='row'><span class='dim' style='flex:1 1 auto;font-size:11px'>"+(m && m.skills[sk]>=40
           ? "Formé"+(ap.sex==="f"?"e":"")+" par "+esc(m.first)+" ("+skillLevel(m.skills[sk]).toLowerCase()+") : progrès rapides."
           : "Sans maître confirmé (compagnon ou mieux), il apprend lentement.")+"</span><button class='b' data-act='apprstop'>Renvoyer</button></div>";
    } else {
      var teens = g.villagers.filter(function(v){ return g.canApprentice(v) && !v.appr; }).length;
      h += "<div class='row'><span class='dim' style='flex:1 1 auto;font-size:11px'>Un adolescent de 12 à 15 ans apprend le métier auprès du meilleur ouvrier. "
         + teens+" disponible"+(teens>1?"s":"")+".</span><button class='b"+(teens?"":" off")+"' data-act='appr'>Prendre un apprenti</button></div>";
    }
  }
  return h;
}

/* fiche d'un villageois */
function sheetVillager(g){
  var v = g.villager(ui.selV); if(!v) return "";
  var st = g.stageOf(v), age = g.ageOf(v), fam = g.famOf(v), fem = v.sex==="f";
  var job = v.work>0 ? g.buildings.filter(function(x){ return x.id===v.work; })[0] : null;
  var sub = ageTxt(age)+" · "+esc(g.villagerStatus(v))+(fam ? " · "+esc(fam.name) : "");
  var h = head(portrait(g, v, 3), esc(g.fullName(v)), sub);
  h += "<div class='kv'><span class='k'>"+ic(heartIcon(v.mood),"s")+"Humeur</span>"+bar(v.mood/100, v.mood<40?"red":v.mood<60?"gold":"")+"<span class='v'>"+Math.round(v.mood)+"</span></div>";
  h += "<div class='kv'><span class='k'>Santé"+(v.sick>0 ? " <span class='bad'>· malade</span>" : "")+"</span>"+bar(v.health/100, v.health<40?"red":v.health<70?"gold":"")+"<span class='v'>"+Math.round(v.health)+"</span></div>";
  /* étape 7b : caractère, siège au conseil, ce que pense sa famille */
  if(g.isAdult(v)){
    var tr = g.traitsOf(v);
    h += "<div class='chips' style='margin:4px 0'>"+(tr.length ? tr.map(function(t){ return "<span class='chip' title='"+esc(TRAIT_DEFS[t].desc)+"'>"+esc(TRAIT_DEFS[t].name)+"</span>"; }).join("") : "<span class='chip dim'>Sans trait marquant</span>")+"</div>";
  }
  if(fam) h += "<div class='kv'><span class='k'>"+ic("crown","s")+"Ordre</span><span class='v'>"+esc(g.orderName(v))+"</span></div>";
  if(v.sk===1 && g.secretOf(v)){
    h += "<div class='sec'>Un secret</div><div class='bad' style='font-size:12px'>"+(fem?"Elle":"Il")+" "+esc(SECRET_DEFS[g.secretOf(v)].name.toLowerCase())+".</div>"
       + "<div class='lvls' style='grid-template-columns:repeat(3,1fr)'><button class='b' data-act='secret' data-arg='"+v.id+":press'><b>Faire pression</b><span>faveur due</span></button>"
       + "<button class='b' data-act='secret' data-arg='"+v.id+":denounce'><b>Dénoncer</b><span>"+(g.secretOf(v)==="hoard" ? "amende" : "procès")+"</span></button>"
       + "<button class='b' data-act='secret' data-arg='"+v.id+":forgive'><b>Pardonner</b><span>gratitude</span></button></div>";
  }
  if(v.seat) h += "<button class='kv lnk' data-act='sheet' data-arg='council'><span class='k'>"+ic("crown","s")+esc(g.seatTitle(v.seat, v))+" au conseil</span><span class='v'>compétence "+g.competence(v, v.seat)+" ›</span></button>";
  if(fam){
    var fo = g.famOpinion(fam);
    h += "<div class='kv'><span class='k'>"+ic("family","s")+"Opinion de sa famille</span>"+bar(fo/100, fo<30?"red":fo<55?"gold":"")+"<span class='v'>"+fo+"</span></div>";
  }
  /* pourquoi cette humeur : l'ambiance du village, puis ce qui le touche, lui */
  h += "<div class='sec'>Pourquoi cette humeur</div><div class='why'>";
  h += "<div><span>Ambiance du village (approbation)</span><b>"+g.approval+"</b></div>";
  (v.why||[]).forEach(function(w){ h += "<div><span>"+esc(w[0])+"</span><b class='"+(w[1]>0?"good":"bad")+"'>"+signed(w[1])+"</b></div>"; });
  if(!(v.why||[]).length) h += "<div class='dim'><span>Rien de particulier ce mois-ci</span></div>";
  h += "</div>";
  /* métier */
  h += "<div class='sec'>Métier</div>";
  if(g.isNoble(v) && g.isAdult(v) && !v.seat){
    h += "<div class='dim' style='font-size:12px'>"+(fem?"Noble, elle":"Noble, il")+" ne prend pas de poste : sa charge à votre service.</div><div class='lvls' style='grid-template-columns:repeat(3,1fr)'>";
    NOBLE_OFFICE_ORDER.forEach(function(k){ var o = NOBLE_OFFICES[k]; h += "<button class='b"+(v.office===k?" on":"")+"' data-act='office' data-arg='"+k+"'><b>"+esc(fem ? o.fem : o.name)+"</b></button>"; });
    h += "</div>"+(v.office ? "<div class='dim' style='font-size:11px'>"+esc(NOBLE_OFFICES[v.office].desc)+"</div>" : "");
  } else if(v.seat){
    h += "<div class='dim' style='font-size:12px'>Siège au conseil : "+(fem?"elle":"il")+" passe ses journées "+(v.seat==="chaplain" ? "à l'église" : "au manoir")+" et ne prend pas de poste.</div>";
  } else if(g.canWork(v)){
    if(job) h += "<div class='row'><span style='flex:1 1 auto'>"+esc(g.villagerStatus(v))+(g.jobSkill(job) ? " <span class='dim'>· "+esc(skillTxt(v, g.jobSkill(job)))+"</span>" : "")+"</span><button class='b' data-act='bsel' data-arg='"+job.id+"'>Voir</button></div>";
    else h += "<div class='dim' style='font-size:12px'>"+(fem?"Journalière":"Journalier")+" : bâtit les chantiers quand il y en a.</div>";
    h += "<button class='b wide"+(ui.vJob?" on":"")+"' data-act='vjob'>"+(ui.vJob ? "Fermer la liste" : "Changer de métier")+"</button>";
    if(ui.vJob) h += jobChoices(g, v);
  } else if(st==="teen"){
    if(v.appr && job){
      var m = g.masterOf(job), sk = g.jobSkill(job);
      h += "<div class='row'><span style='flex:1 1 auto'>Apprenti"+(fem?"e":"")+" · "+esc(BUILD_DEFS[job.def].name)+(m ? " <span class='dim'>auprès de "+esc(m.first)+"</span>" : "")+" <span class='dim'>· "+esc(skillTxt(v, sk))+"</span></span>"
         + "<button class='b' data-act='vassign' data-arg='-1'>Arrêter</button></div>";
    } else h += "<div class='dim' style='font-size:12px'>"+(v.sick>0 ? "Malade : l'apprentissage attendra." : "Peut entrer en apprentissage jusqu'à 16 ans :")+"</div>";
    if(!(v.sick>0)) h += apprChoices(g, v);
    h += "<div class='dim' style='font-size:11px;margin-top:4px'>À 16 ans, "+(fem?"elle":"il")+" pourra prendre un poste.</div>";
  } else if(st==="elder" && age>=AGE_RETIRE){
    h += "<div class='dim' style='font-size:12px'>À la retraite depuis "+ageTxt(age-AGE_RETIRE)+".</div>";
  } else if(st==="adult" || st==="elder"){
    h += "<div class='bad' style='font-size:12px'>Trop faible pour travailler en ce moment ("+(v.sick>0 ? "malade" : "santé "+Math.round(v.health))+").</div>";
  } else {
    h += "<div class='dim' style='font-size:12px'>Trop jeune pour travailler. Apprentissage possible à 12 ans, métier à 16 ans.</div>";
  }
  /* savoir-faire */
  h += "<div class='sec'>Savoir-faire</div>";
  var jsk = job ? g.jobSkill(job) : null;
  SKILL_ORDER.forEach(function(k){
    var x = v.skills[k]||0;
    h += "<div class='kv sk"+(k===jsk?" on":"")+"'><span class='k'>"+esc(SKILL_DEFS[k].name)+"</span>"+bar(x/100, k===jsk?"gold":"")+"<span class='v'>"+esc(skillLevel(x))+"</span></div>";
  });
  /* famille */
  var rel = [];
  var sp = v.spouse>=0 ? g.villager(v.spouse) : null;
  if(sp) rel.push(["Conjoint"+(sp.sex==="f"?"e":""), [sp]]);
  var par = [v.mother, v.father].map(function(id){ return id>=0 ? g.villager(id) : null; }).filter(Boolean);
  if(par.length) rel.push(["Parents", par]);
  var kids = g.villagers.filter(function(o){ return o.mother===v.id || o.father===v.id; });
  if(kids.length) rel.push(["Enfants", kids]);
  var sib = g.villagers.filter(function(o){ return o!==v && ((v.mother>=0 && o.mother===v.mother) || (v.father>=0 && o.father===v.father)); });
  if(sib.length) rel.push(["Frères et sœurs", sib]);
  h += "<div class='sec'>Famille</div>";
  if(v.maiden) h += "<div class='dim' style='font-size:12px'>"+(fem?"Née":"Né")+" "+esc(v.maiden)+".</div>";
  if(!rel.length) h += "<div class='dim' style='font-size:12px'>Aucun proche dans la seigneurie.</div>";
  rel.forEach(function(r){
    h += "<div class='rel'><span class='dim'>"+r[0]+"</span><span class='chips'>";
    r[1].forEach(function(o){ h += "<button class='chip lnk' data-act='vsel' data-arg='"+o.id+"'>"+esc(o.first)+" · "+g.ageOf(o)+"</button>"; });
    h += "</span></div>";
  });
  var home = fam && fam.home>0 ? g.buildings.filter(function(x){ return x.id===fam.home; })[0] : null;
  h += "<div class='row' style='margin-top:10px'>";
  if(g.stageOf(v)!=="baby") h += "<button class='b' data-act='vlook'>"+ic("flag","s")+"Voir sur la carte</button>";
  if(home && home.def==="burgage") h += "<button class='b' data-act='bsel' data-arg='"+home.id+"'>"+ic("house","s")+"Sa maison</button>";
  h += "<button class='b' data-act='sheet' data-arg='people'>"+ic("family","s")+"Habitants</button></div>";
  return h;
}
/* les postes où l'on peut placer un adulte (avec son niveau dans chaque métier) */
function jobChoices(g, v){
  var h = "<div class='jobs'>";
  if(v.work>0) h += "<button class='ext' data-act='vassign' data-arg='-1'><span class='t'><b>"+(v.sex==="f"?"Journalière":"Journalier")+"</b><span>Bâtit les chantiers</span></span></button>";
  var any = false;
  g.buildings.forEach(function(b){
    var d = BUILD_DEFS[b.def]; if(!d || d.fam<=0 || b.id===v.work) return;
    var n = g.workersOf(b).length, full = n>=d.fam, sk = d.skill, no = !g.canHold(v, b);
    any = true;
    h += "<button class='ext"+(full||no?" off":"")+"' data-act='vassign' data-arg='"+b.id+"'><span class='tb'>"+ICONS.th(b.def)+"</span><span class='t'><b>"+esc(d.name)+(b.done ? "" : " (chantier)")+"</b>"
       + "<span>"+(no ? "Pas pour un noble" : n+"/"+d.fam+(full ? " · complet" : "")+(sk ? " · "+esc(skillTxt(v, sk)) : "")+(g.rankMul(v, b)<1 ? " · à demi-vitesse (serf)" : ""))+"</span></span></button>";
  });
  if(!any) h += "<div class='dim' style='font-size:12px'>Aucun bâtiment n'emploie d'ouvriers pour l'instant.</div>";
  return h + "</div>";
}
/* les ateliers qui peuvent prendre un apprenti */
function apprChoices(g, v){
  var h = "<div class='jobs'>", any = false;
  g.buildings.forEach(function(b){
    var d = BUILD_DEFS[b.def]; if(!d || !d.skill || !b.done || b.id===v.work) return;
    var ap = g.apprenticeOf(b), m = g.masterOf(b);
    any = true;
    h += "<button class='ext"+(ap?" off":"")+"' data-act='vappr' data-arg='"+b.id+"'><span class='tb'>"+ICONS.th(b.def)+"</span><span class='t'><b>"+esc(d.name)+"</b>"
       + "<span>"+(ap ? "Déjà un apprenti" : m ? "Maître : "+esc(m.first)+" ("+skillLevel(m.skills[d.skill]).toLowerCase()+")" : "Personne pour l'enseigner")+"</span></span></button>";
  });
  if(!any) h += "<div class='dim' style='font-size:12px'>Aucun atelier achevé pour l'instant.</div>";
  return h + "</div>";
}

/* liste des habitants, foyer par foyer */
function sheetPeople(g){
  var all = g.villagers, camp = g.buildings.filter(function(b){ return b.def==="camp"; })[0];
  var F = {
    all:   { n:"Tous", f:function(){ return true; } },
    adult: { n:"Adultes", f:function(v){ var s = g.stageOf(v); return (s==="adult" || s==="elder") && g.ageOf(v)<AGE_RETIRE; } },
    free:  { n:"Journaliers", f:function(v){ return v.work<0 && !v.appr && g.canWork(v); } },
    teen:  { n:"Adolescents", f:function(v){ return g.stageOf(v)==="teen"; } },
    kids:  { n:"Enfants", f:function(v){ var s = g.stageOf(v); return s==="child" || s==="baby"; } },
    sick:  { n:"Malades", f:function(v){ return v.sick>0 || v.health<40; } },
  };
  var filt = F[ui.pFilter] ? ui.pFilter : "all";
  var adults = all.filter(function(v){ return g.isAdult(v); }).length;
  var h = head(ic("family","l"), "Habitants · "+all.length, g.families.length+" foyer"+(g.families.length>1?"s":"")+" · "+adults+" adulte"+(adults>1?"s":"")+" · "+(all.length-adults)+" enfant"+(all.length-adults>1?"s":"")+" ou adolescent"+(all.length-adults>1?"s":""));
  h += "<div class='chips' style='margin:2px 0 6px'>";
  Object.keys(F).forEach(function(k){
    var n = all.filter(F[k].f).length;
    if(k!=="all" && !n) return;
    h += "<button class='chip lnk"+(filt===k?" on":"")+"' data-act='pfilter' data-arg='"+k+"'>"+F[k].n+" · "+n+"</button>";
  });
  h += "</div>";
  if(filt==="adult"){
    /* les adultes en âge de travailler, rangés par poste, avec leur niveau dans le métier */
    var groups = {}, order = [];
    all.filter(F.adult.f).forEach(function(v){
      var b = v.work>0 ? g.buildings.filter(function(x){ return x.id===v.work; })[0] : null;
      var key = b ? "b"+b.id : (g.canWork(v) ? "free" : "weak");
      if(!groups[key]){ groups[key] = { b:b, key:key, list:[] }; order.push(key); }
      groups[key].list.push(v);
    });
    order.sort(function(a, c){ var r = function(k){ return k==="free" ? 0 : k==="weak" ? 2 : 1; }; return r(a) - r(c); });
    if(!order.length) h += "<div class='dim'>Personne.</div>";
    order.forEach(function(k){
      var G = groups[k], b = G.b, sk = b ? g.jobSkill(b) : null;
      var title = b ? BUILD_DEFS[b.def].name+(b.done ? "" : " (chantier)") : k==="free" ? "Journaliers · bâtissent les chantiers" : "Trop faibles pour travailler";
      h += "<div class='fam'><span class='sec' style='margin:0'>"+esc(title)+"</span><span class='dim' style='font-size:11px;flex:1 1 auto'>"+G.list.length+"</span>"
         + (b ? "<button class='b sm' data-act='bsel' data-arg='"+b.id+"'>Voir</button>" : "")+"</div>";
      G.list.forEach(function(v){ h += vRow(g, v, g.villagerStatus(v)+(sk && !v.appr ? " · "+skillLevel(v.skills[sk]).toLowerCase() : "")); });
    });
    if(!groups.free) h += "<div class='bad' style='font-size:12px;margin-top:6px'>Aucun journalier : personne ne bâtit les chantiers. Retirez quelqu'un d'un poste (bouton − du bâtiment) pour qu'il construise.</div>";
    return h;
  }
  if(filt!=="all"){
    var list = all.filter(F[filt].f);
    if(!list.length) h += "<div class='dim'>Personne.</div>";
    list.forEach(function(v){ h += vRow(g, v); });
    return h;
  }
  g.families.forEach(function(f){
    var mem = g.membersOf(f.id);
    var where = f.home<0 ? "<span class='bad'>sans logis</span>" : (camp && f.home===camp.id) ? "au campement" : "";
    var home = f.home>0 && !(camp && f.home===camp.id) ? f.home : null;
    h += "<div class='fam'><span class='sec' style='margin:0'>"+esc(f.name)+"</span><span class='dim' style='font-size:11px;flex:1 1 auto'>"+where+"</span>"
       + (home ? "<button class='b sm' data-act='bsel' data-arg='"+home+"'>"+ic("house","s")+"Maison</button>" : "")+"</div>";
    mem.sort(function(a, b){ return g.ageOf(b) - g.ageOf(a); });
    mem.forEach(function(v){ h += vRow(g, v); });
  });
  return h;
}

/* réserves détaillées */
/* =====================================================================
   ÉTAPE 6 : vivres, ateliers, grange
   ===================================================================== */
function foodGroupsIn(g){
  var n = 0;
  FOOD_GROUP_ORDER.forEach(function(gk){ if(FOOD_TYPES.some(function(k){ return FOOD_DEFS[k].group===gk && (g.stock[k]||0)>=1; })) n++; });
  return n;
}
function spoilTxt(r){ var p = r*100; return (p<1 ? (Math.round(p*10)/10).toString().replace(".", ",") : Math.round(p))+" %"; }
function monthsFood(m){ return m>=24 ? "plus de 2 ans" : m<1 ? "moins d'un mois" : (Math.floor(m*2)/2).toString().replace(".", ",")+" mois"; }
function granaryNote(g){
  var n = g.granaryCount();
  if(!n) return "<div class='gold' style='font-size:11px'>Sans grange, tout se gâte trois fois plus vite qu'à l'abri.</div>";
  var sh = g.granaryShare();
  return "<div class='dim' style='font-size:11px'>"+n+" grange"+(n>1?"s":"")+" : "+(n*GRANARY_CAP)+" denrées à l'abri"+(sh<0.999 ? " ("+Math.round(sh*100)+" % des réserves ; une grange de plus en abriterait davantage)" : " (toutes les réserves)")+".</div>";
}
var RECIPE_TXT = {
  windmill:"1 grain → 1 farine. Sans boulangerie, chaque foyer cuit sa farine (1 farine → 1 pain).",
  bakery:"1 farine → 1,5 pain, avec ¼ de bois de chauffe par fournée.",
  dairy:"3 laits → 2 fromages.",
  smokehouse:"1 viande → 1 viande fumée, avec ½ bois de chauffe. "+SMOKE_KEEP+" viandes fraîches restent pour la table."
};
var FROM_TXT = { farm:"ferme", granary:"grange", storehouse:"entrepôt", camp:"campement", windmill:"moulin", pasture:"pâturage", hunter:"camp de chasse" };
function sheetWorkshop(g, sel){
  var rc = RECIPES[sel.def], h = "";
  var tgt = g.craftTarget(rc.out), have = Math.floor(g.stock[rc.out]||0);
  h += "<div class='sec'>Fabrication</div>";
  h += "<div class='kv'><span class='k'>"+ic(rc.inp,"s")+RES[rc.inp].n+" → "+ic(rc.out,"s")+RES[rc.out].n+"</span></div>";
  h += "<div class='dim' style='font-size:11px'>"+esc(RECIPE_TXT[sel.def])+"</div>";
  h += "<div class='kv'><span class='k'>Sur place</span>"+bar(Math.min(1, (sel.inp||0)/rc.load))+"<span class='v'>"+(Math.floor((sel.inp||0)*10)/10).toString().replace(".", ",")+" "+RES[rc.inp].n.toLowerCase()+"</span></div>";
  h += "<div class='kv'><span class='k'>En réserve</span><span class='v'>"+Math.floor(g.stock[rc.inp]||0)+" "+RES[rc.inp].n.toLowerCase()+" · "+have+" "+RES[rc.out].n.toLowerCase()+"</span></div>";
  if(tgt < g.capFor(rc.out)) h += "<div class='dim' style='font-size:11px'>"+(rc.out==="bread" ? "Le pain rassit vite : on cuit à mesure, jusqu'à "+tgt+" pains d'avance." : "On moud d'avance jusqu'à "+tgt+" farines ; le grain se garde mieux.")+"</div>";
  if(sel.lastMade!==undefined) h += "<div class='kv'><span class='k'>Le mois dernier</span><span class='v'>"+String(sel.lastMade).replace(".", ",")+" "+RES[rc.out].n.toLowerCase()+"</span></div>";
  var deps = rc.from.map(function(d){ return FROM_TXT[d]; }).filter(Boolean);
  h += "<div class='dim' style='font-size:11px;margin-top:4px'>L'artisan va chercher "+RES[rc.inp].n.toLowerCase()+" au plus proche : "+deps.join(", ")+(sel.def==="dairy" ? " (des vaches)" : "")+". Il le porte à l'atelier, où il sort de la réserve.</div>";
  return h;
}
function sheetGranary(g){
  var h = "<div class='sec'>Conservation</div>";
  h += granaryNote(g);
  h += "<div class='dim' style='font-size:11px'>Ce qui est à l'abri se gâte trois fois moins vite. Le lait n'y gagne rien : faites-en du fromage.</div>";
  var sp = g.spoiled || {}, any = false;
  FOOD_TYPES.concat(["grain","flour"]).forEach(function(k){ if((sp[k]||0)>=0.5){ if(!any) h += "<div class='sec'>Gâté le mois dernier</div>"; any = true; h += "<div class='kv'><span class='k'>"+ic(k,"s")+RES[k].n+"</span><span class='v bad'>−"+Math.round(sp[k])+"</span></div>"; } });
  return h;
}
/* d'où vient chaque ressource : les sources (bâtiments, cours, troupeaux) et combien sont à l'œuvre */
var RES_HOW = {
  timber:  [["b","woodcutter","abat les arbres alentour"]],
  firewood:[["b","woodcutter","avec le bois d'œuvre"]],
  stone:   [["b","quarry","sur un gisement de pierre"]],
  berries: [["b","forager","de mars à novembre"]],
  meat:    [["b","hunter","toute l'année"],["h","pig","porcs (glandée, abattage)"],["h","cattle","bêtes abattues en novembre"],["t","","bœuf réformé"]],
  smoked:  [["b","smokehouse","1 viande → 1 viande fumée"]],
  bread:   [["b","bakery","1 farine → 1,5 pain"],["t","","sans boulangerie, chaque foyer cuit sa farine (1 → 1)"]],
  flour:   [["b","windmill","1 grain → 1 farine"]],
  grain:   [["f","wheat","battage des gerbes de blé ou de seigle, à la ferme"],["t","","marchand de grain en disette"]],
  barley:  [["f","barley","battage des gerbes d'orge"]],
  oats:    [["f","oats","battage des gerbes d'avoine"]],
  pulses:  [["f","peas","champ de pois et fèves"],["t","","marchand de grain en disette"]],
  flax:    [["f","flax","champ de lin"]],
  hay:     [["f","hay","pré de fauche (juin-juillet)"],["h","any","herbe en trop fauchée au pâturage"],["t","","paille du battage"]],
  sh_grain:[["f","wheat","moisson du blé d'hiver et du seigle"]], sh_barley:[["f","barley","moisson de l'orge"]], sh_oats:[["f","oats","moisson de l'avoine"]],
  veg:     [["e","garden","potager d'une arrière-cour"]],
  eggs:    [["e","chicken","basse-cour d'une arrière-cour"]],
  apples:  [["e","orchard","verger, d'août à octobre"]],
  honey:   [["e","beehive","rucher, d'avril à septembre"]],
  milk:    [["h","cattle","vaches après le vêlage"]],
  cheese:  [["b","dairy","3 laits → 2 fromages"]],
  wool:    [["h","sheep","tonte en mai"]],
  clothes: [["e","tailor","tailleur d'une cour, avec laine ou lin"]],
  ale:     [["e","brewer","brasserie d'une cour (niveau 2), avec de l'orge"]],
  manure:  [["h","any","les troupeaux"],["t","","les bœufs de trait"]],
  ox:      [["t","","achat (20 deniers) ou jeune taureau dressé"]]
};
function howHtml(g, k){
  var src = RES_HOW[k];
  if(!src) return "";
  var parts = src.map(function(x){
    var name = "", n = null;
    if(x[0]==="b"){ name = BUILD_DEFS[x[1]].name; n = g.buildings.filter(function(b){ return b.def===x[1] && b.done; }).length; }
    else if(x[0]==="e"){ name = EXT_DEFS[x[1]].name; n = g.buildings.filter(function(b){ return b.exts && b.exts.indexOf(x[1])>=0; }).length; }
    else if(x[0]==="h"){ name = x[1]==="any" ? "Pâturages" : LIVESTOCK[x[1]].name; n = g.pastures().filter(function(b){ return b.herd && b.herd.an.length && (x[1]==="any" || b.herd.sp===x[1]); }).length; }
    else if(x[0]==="f"){ name = "Champs"; n = g.fields().filter(function(b){ var c = b.f && g.liveCrop(b.f).id; return c===x[1] || (x[1]==="wheat" && c==="rye"); }).length; }
    var cnt = n===null ? "" : " <span class='"+(n>0 ? "good" : "bad")+"'>("+n+")</span>";
    return (name ? "<b>"+esc(name)+"</b>"+cnt+" : " : "")+esc(x[2]);
  });
  return "<div class='how'>← "+parts.join(" · ")+"</div>";
}
function sheetStock(g){
  var cap = g.capFor("timber");
  var food = g.foodStock(), kinds = foodGroupsIn(g);
  var h = head(ic("crate","l"), "Réserves", "Capacité : "+cap+" par ressource · "+g.storehouseCount()+" entrepôt(s)");
  var how = !!ui.stockHow;
  h += "<button class='b wide"+(how ? " on" : "")+"' data-act='stockhow' style='margin:0 0 4px'>"+ic("help","s")+(how ? "Masquer d'où vient chaque ressource" : "D'où vient chaque ressource ?")+"</button>";
  if(how) h += "<div class='dim' style='font-size:11px'>Sous chaque ligne : ce qui la produit, et entre parenthèses combien en ont sur votre domaine (<span class='bad'>0</span> = rien n'en produit).</div>";
  function line(k){ var v = Math.floor(g.stock[k]||0); return "<div class='kv'><span class='k'>"+ic(k)+RES[k].n+"</span>"+bar(v/cap, v>=cap?"gold":"")+"<span class='v' style='min-width:36px;text-align:right'>"+v+"</span></div>"+(how ? howHtml(g, k) : ""); }
  /* étape 6 : denrée par denrée, ce qui se gâtera ce mois-ci */
  function fline(k){
    var v = Math.floor(g.stock[k]||0), rt = g.spoilRate(k);
    return "<div class='kv'><span class='k'>"+ic(k)+RES[k].n+"</span>"+bar(v/cap, v>=cap?"gold":"")
         + "<span class='v' style='min-width:36px;text-align:right'>"+v+"</span>"
         + "<span class='dim' style='min-width:44px;text-align:right;font-size:10px'>"+(rt>0.0005 ? "−"+spoilTxt(rt) : "se garde")+"</span></div>"+(how ? howHtml(g, k) : "");
  }
  h += "<div class='sec'>Matériaux</div>"+line("timber")+line("stone");
  var rt = g.reserved("timber"), rs = g.reserved("stone");
  if(rt>0 || rs>0) h += "<div class='dim' style='font-size:11px'>Dont réservés aux chantiers : "+(rt>0 ? Math.ceil(rt)+" bois" : "")+(rt>0 && rs>0 ? " et " : "")+(rs>0 ? Math.ceil(rs)+" pierre"+(rs>1?"s":"") : "")+". Ils sortent du stock à la livraison.</div>";
  h += "<div class='sec'>Chauffage</div>"+line("firewood");
  var fm = g.foodMonths();
  h += "<div class='sec'>Nourriture · "+Math.floor(food)+" · "+kinds+"/"+FOOD_GROUP_ORDER.length+" sortes · "+monthsFood(fm)+"</div>";
  if(!g.marketActive()) h += "<div class='bad' style='font-size:12px'>Sans marché actif, chaque famille ne mange qu'une sorte d'aliment.</div>";
  h += "<div class='dim' style='font-size:11px;margin-bottom:2px'>Ce qui se gâte ce mois-ci"+(isWinterMonth(g.time.month) ? " (le froid ralentit tout)" : (g.time.month>=5 && g.time.month<=7) ? " (la chaleur l'accélère)" : "")+". On mange d'abord le plus périssable.</div>";
  FOOD_GROUP_ORDER.forEach(function(gk){
    var ks = FOOD_TYPES.filter(function(k){ return FOOD_DEFS[k].group===gk; });
    h += "<div class='dim' style='font-size:11px;margin:4px 0 0;font-weight:700'>"+esc(FOOD_GROUPS[gk].name)+"</div>";
    ks.forEach(function(k){ h += fline(k); });
  });
  h += granaryNote(g);
  var sp = g.spoiled || {}, spt = 0; for(var sk in sp) if(FOOD_DEFS[sk]) spt += sp[sk];
  if(spt>=1) h += "<div class='dim' style='font-size:11px'>Le mois dernier, "+Math.round(spt)+" denrée"+(spt>=2?"s":"")+" se sont gâtées.</div>";
  h += "<div class='sec'>Ingrédients</div>"+fline("grain")+fline("flour")+fline("barley");
  if(g.sheafTotal()>=1) h += "<div class='sec'>Gerbes à battre</div>"+["sh_grain","sh_barley","sh_oats"].filter(function(k){ return (g.stock[k]||0)>=1; }).map(line).join("");
  h += "<div class='sec'>Fibres et biens</div>"+line("wool")+line("flax")+line("clothes")+line("ale");
  var wn = g.winterNeed();
  h += "<div class='sec'>Fourrage et fumier</div>"+line("hay")+line("oats")+line("manure");
  if(wn>0) h += "<div class='dim' style='font-size:11px'>L'hiver, le bétail mange ~"+(Math.round(wn*10)/10).toString().replace(".", ",")+" foin par mois (l'avoine compte 1,5). Réserve : "+Math.floor(g.fodderStock())+".</div>";
  h += "<div class='sec'>Bétail</div><div class='kv'><span class='k'>"+ic("ox")+"Bœufs de trait</span><span class='v'>"+(g.stock.ox||0)+"</span><button class='b sm' data-act='sheet' data-arg='oxen'>Gérer</button></div>"+(how ? howHtml(g, "ox") : "");
  LIVESTOCK_ORDER.forEach(function(sp){
    var n = 0, np = 0; g.pastures().forEach(function(b){ if(b.herd.sp===sp){ n += b.herd.an.length; np++; } });
    if(np) h += "<div class='kv'><span class='k'>"+ic(sp==="cattle" ? "cow" : sp)+LIVESTOCK[sp].name+"</span><span class='v'>"+n+" · "+np+" pâturage"+(np>1?"s":"")+"</span></div>";
  });
  return h;
}

/* ===== étape 7a : le fisc (panneau du manoir) et le livre de comptes ===== */
function deniers(v){
  var a = Math.abs(v), t = a>=10 || Math.abs(a-Math.round(a))<0.05 ? String(Math.round(a)) : (Math.round(a*10)/10).toString().replace(".", ",");
  return (v>0 ? "+" : v<0 ? "−" : "")+t;
}
function inMonthsTxt(k){ return k<=1 ? "le mois prochain" : "dans "+k+" mois"; }
function sheetFisc(g){
  var h = "<div class='sec'>Taille</div><div class='row'><span>Taux</span><b id='taxLbl'>"+Math.round(g.taxRate*100)+" %</b></div>";
  h += "<input type='range' min='0' max='100' step='5' id='taxSlider' value='"+Math.round(g.taxRate*100)+"'/>";
  var nt = g.nextOf(TAILLE_MONTHS), tm = g.tailleMonthly();
  h += "<div class='dim' style='font-size:11px'>Au-delà de 10 %, l'approbation baisse. "+(tm<0.05 ? "Aucune maison habitée ne paie encore ; prochaine levée à " : "Environ "+deniers(tm).replace("+","")+" denier"+(tm>=2?"s":"")+" par mois, levés à ")+(nt.month===3 ? "Pâques" : "la Saint-Michel")+" ("+inMonthsTxt(nt.inMonths)+") : "+Math.round(g.fisc.taille)+" en attente."
     + (g.tailleRate()<1 ? " <span class='bad'>Approbation basse : "+Math.round((1-g.tailleRate())*100)+" % ne seront pas payés.</span>" : "")+"</div>";
  TAX_ORDER.forEach(function(id){
    var d = TAX_DEFS[id], lv = g.taxes[id]|0, ok = g.taxPossible(id);
    h += "<div class='sec'>"+esc(d.name)+"</div><div class='desc' style='margin-bottom:4px'>"+esc(d.desc)+"</div>";
    if(!ok){ h += "<div class='bad' style='font-size:12px'>"+(d.needs==="church" ? "Il faut une église achevée." : "Il faut un manoir achevé.")+"</div>"; return; }
    h += "<div class='lvls'>";
    for(var k=0;k<d.levels.length;k++){
      var fx = d.ap[k] ? signed(d.ap[k])+" appro." : "";
      if(id==="dime" && d.inf[k]) fx = "+"+d.inf[k]+" infl. "+fx;
      h += "<button class='b"+(lv===k?" on":"")+"' data-act='taxlvl' data-arg='"+id+":"+k+"'><b>"+esc(d.levels[k])+"</b><span>"+(fx||"—")+"</span></button>";
    }
    h += "</div>";
    var st = "";
    if(id==="dime"){
      st = "Assiette de cette année : "+Math.round(g.fisc.harvest)+" mesures récoltées";
      if(lv>0) st += ", soit environ "+Math.round(g.fisc.harvest*d.share[lv])+" pour l'Église en octobre";
      if(g.fisc.lastDime) st += ". Dîme "+g.fisc.lastDime.y+" : "+Math.round(g.fisc.lastDime.q)+" mesures";
    } else if(id==="peage"){
      st = !g.marketActive() && !g.buildings.some(function(b){ return b.done && b.def==="trade"; }) ? "Sans marché ni comptoir, aucun marchand ne passe."
         : "Le mois dernier : "+deniers(g.fisc.peageLast||0)+" deniers"+(g.policies.freeMarket ? " (marchés libres : rien au marché)" : "");
    } else if(id==="corvee"){
      st = "Le mois dernier : "+(g.fisc.corveeLast||0)+" journée"+((g.fisc.corveeLast||0)>1?"s":"")+" de corvée"+(g.buildings.some(function(b){ return !b.done; }) ? "" : ". Aucun chantier en cours : personne n'est appelé");
    }
    if(st) h += "<div class='dim' style='font-size:11px;margin-top:2px'>"+esc(st)+".</div>";
  });
  h += "<button class='kv lnk' data-act='sheet' data-arg='book' style='margin-top:8px'><span class='k'>"+ic("scroll")+"Livre de comptes</span><span class='v'>›</span></button>";
  h += "<button class='kv lnk' data-act='sheet' data-arg='council'><span class='k'>"+ic("crown")+"Le conseil et la réputation</span><span class='v'>"+councilCount(g)+"/4 ›</span></button>";
  h += "<button class='kv lnk' data-act='sheet' data-arg='justice'><span class='k'>"+ic("crown")+"Justice et audiences</span><span class='v'>"+(g.cases.length+g.petitions.length ? "<span class='gold'>"+(g.cases.length+g.petitions.length)+" en attente</span> " : "")+"›</span></button>";
  h += "<button class='kv lnk' data-act='sheet' data-arg='plots'><span class='k'>"+ic("sword")+"Intrigues et chronique</span><span class='v'>"+(factionSeen(g) ? "<span class='bad'>une faction</span> " : "")+"›</span></button>";
  h += "<button class='kv lnk' data-act='sheet' data-arg='laws'><span class='k'>"+ic("scroll")+"Le coutumier (lois)</span><span class='v'>"+(Object.keys(g.lawPending).length ? "proclamation en cours " : "")+"›</span></button>";
  return h;
}
function bookRows(lines){
  var h = "", tot = 0;
  BOOK_ORDER.forEach(function(k){
    var v = lines[k]; if(!v || Math.abs(v)<0.05) return;
    tot += v;
    h += "<div><span>"+esc(BOOK_CATS[k].name)+"</span><b class='"+(v>0?"good":"bad")+"'>"+deniers(v)+"</b></div>";
  });
  if(!h) return "<div class='dim' style='font-size:12px'>Aucun mouvement.</div>";
  return "<div class='why'>"+h+"<div><span><b>Solde</b></span><b class='"+(tot>=0?"good":"bad")+"'>"+deniers(tot)+"</b></div></div>";
}
function sheetBook(g){
  var h = head(ic("scroll","l"), "Livre de comptes", "Trésor : "+Math.floor(g.treasury)+" deniers · "+MONTHS[g.time.month]+" "+g.time.year);
  h += "<div class='kv'><span class='k'>"+ic("coin")+"Trésor</span><span class='v'>"+Math.floor(g.treasury)+" deniers</span></div>";
  if(g.fisc.debt>0) h += "<div class='kv'><span class='k bad'>"+ic("bag")+"Dette au changeur</span><span class='v bad'>"+Math.ceil(g.fisc.debt)+" · "+g.interestDue()+" d'intérêts par mois</span></div>";
  /* prévision */
  var f = g.cashForecast();
  h += "<div class='sec'>Prévision jusqu'en mars ("+f.months+" mois)</div>";
  if(f.lines.length){
    h += "<div class='why'>";
    f.lines.forEach(function(l){ h += "<div><span>"+esc(l[0])+"</span><b class='"+(l[1]>0?"good":"bad")+"'>"+deniers(l[1])+"</b></div>"; });
    h += "</div>";
  } else h += "<div class='dim' style='font-size:12px'>Aucune recette ni dépense prévue.</div>";
  h += "<div class='kv'><span class='k'>Trésor attendu à la fin de l'hiver</span><span class='v "+(f.end<0?"bad":f.end<20?"gold":"good")+"'>"+f.end+"</span></div>";
  if(f.end<0) h += "<div class='bad' style='font-size:12px'>Il manquera des deniers : levez la taille, vendez des surplus ou empruntez au changeur.</div>";
  /* calendrier */
  var nt = g.nextOf(TAILLE_MONTHS), nk = g.nextOf([KING_MONTH]), nd = g.nextOf([DIME_MONTH]);
  h += "<div class='sec'>Calendrier fiscal</div>";
  if(g.hasManor()) h += "<div class='kv'><span class='k'>Taille ("+(nt.month===3 ? "Pâques" : "Saint-Michel")+")</span><span class='v'>"+MONTHS[nt.month]+" · "+Math.round(g.fisc.taille)+" en attente</span></div>";
  else h += "<div class='kv'><span class='k dim'>Taille</span><span class='v dim'>manoir requis</span></div>";
  if(g.taxLevel("dime")) h += "<div class='kv'><span class='k'>Dîme (en nature)</span><span class='v'>"+MONTHS[nd.month]+"</span></div>";
  var ky = g.time.year + Math.floor((g.time.month + nk.inMonths)/12);
  if(ky>=1177) h += "<div class='kv'><span class='k'>Impôt du roi</span><span class='v'>"+(g.hasManor() ? MONTHS[nk.month]+" "+ky+" · ~"+g.kingTaxEstimate(ky) : "dû dès qu'il y aura un manoir")+"</span></div>";
  /* mois en cours, mois dernier, douze mois */
  h += "<div class='sec'>Ce mois-ci (en cours)</div>"+bookRows(g.book.cur);
  var last = g.book.hist[g.book.hist.length-1];
  if(last) h += "<div class='sec'>"+MONTHS[last.m]+" "+last.y+"</div>"+bookRows(last.lines);
  if(g.book.hist.length>1) h += "<div class='sec'>Sur les "+g.book.hist.length+" derniers mois</div>"+bookRows(g.bookYear());
  /* le changeur */
  h += "<div class='sec'>Le changeur du bourg</div>";
  if(!g.hasManor()) h += "<div class='dim' style='font-size:12px'>Il ne traite qu'avec le seigneur d'un manoir.</div>";
  else {
    h += "<div class='desc'>Prête jusqu'à "+g.loanCap()+" deniers (selon vos terres), à "+Math.round(LOAN_RATE*100)+" % par mois. Faute de deniers, les intérêts s'ajoutent à la dette ; au bout de "+LOAN_MISS_MAX+" échéances manquées, il saisit des biens.</div>";
    var can = g.fisc.debt + LOAN_STEP <= g.loanCap() && !g.fisc.missed;
    h += "<div class='row'><button class='b"+(can?"":" off")+"' data-act='borrow'>"+ic("coin","s")+"Emprunter "+LOAN_STEP+"</button>";
    if(g.fisc.debt>0){
      h += "<button class='b' data-act='repay'>Rembourser "+Math.min(LOAN_STEP, Math.ceil(g.fisc.debt))+"</button>";
      if(g.fisc.debt>LOAN_STEP) h += "<button class='b' data-act='repay' data-arg='all'>Tout ("+Math.ceil(g.fisc.debt)+")</button>";
    }
    h += "</div>";
  }
  return h;
}

/* ===== étape 7b : le conseil (facultatif) et la réputation du seigneur ===== */
function councilCount(g){ return SEAT_ORDER.filter(function(id){ return !!g.seatHolder(id); }).length; }
function traitChips(g, v){ return g.traitsOf(v).map(function(t){ return "<span class='chip'>"+esc(TRAIT_DEFS[t].name)+"</span>"; }).join(""); }
function sheetCouncil(g){
  var h = head(ic("crown","l"), "Le seigneur et son conseil", "Influence "+Math.floor(g.influence)+" · trésor "+Math.floor(g.treasury));
  /* réputation */
  var R = g.rep, ts = g.repTitles();
  h += "<div class='sec'>Votre réputation</div>";
  h += "<div class='kv'><span class='k'>Générosité</span>"+bar((R.gen+100)/200, R.gen<=-REP_GEN?"red":R.gen>=REP_GEN?"":"gold")+"<span class='v'>"+(R.gen>=0?"+":"−")+Math.abs(Math.round(R.gen))+"</span></div>";
  h += "<div class='kv'><span class='k'>Sévérité</span>"+bar(R.sev/100, R.sev>=REP_SEV?"red":"gold")+"<span class='v'>"+Math.round(R.sev)+"</span></div>";
  if(ts.length) ts.forEach(function(t){ h += "<div class='"+(t.ap>0?"good":"bad")+"' style='font-size:12px'><b>"+esc(t.name)+"</b> : "+esc(t.desc)+"</div>"; });
  else h += "<div class='dim' style='font-size:12px'>On ne dit encore rien de particulier sur vous. Les redevances lourdes vous font une réputation d'avare, les largesses de généreux, une corvée écrasante et les châtiments vous font craindre.</div>";
  h += "<div class='row'><button class='b"+(g.treasury<ALMS_COST?" off":"")+"' data-act='alms'>Faire l'aumône · "+ALMS_COST+ic("coin","s")+"</button>"
     + "<button class='b"+(g.feastY===g.time.year||g.treasury<FEAST_COST?" off":"")+"' data-act='feast'>Fête au village · "+FEAST_COST+ic("coin","s")+" + "+g.feastNeed()+" denrées</button></div>";
  h += "<div class='dim' style='font-size:11px'>L'aumône va aux trois familles les plus démunies ou les plus fâchées. Une fête par an"+(g.feastY===g.time.year ? " (déjà donnée cette année)" : "")+" ; avec de l'ale, on s'en souvient mieux.</div>";
  /* conseil */
  h += "<div class='sec'>Le conseil</div><div class='desc'>Facultatif : un siège vide ne coûte rien et le domaine tourne très bien sans. Un conseiller quitte son poste, touche "+COUNCIL_WAGE+" deniers de gages par mois et apporte un plus selon sa compétence (savoir-faire, caractère, expérience). Les anciens retraités y font de bons conseillers.</div>";
  SEAT_ORDER.forEach(function(id){
    var d = SEAT_DEFS[id], v = g.seatHolder(id), c = g.council[id];
    h += "<div class='sec'>"+esc(d.name)+"</div>";
    if(!g.seatOpen(id)){ h += "<div class='dim' style='font-size:12px'>"+esc(d.desc)+" "+(d.needs==="church" ? "Il faut une église achevée." : "Il faut un manoir achevé.")+"</div>"; return; }
    if(v){
      var cp = g.competence(v, id);
      h += "<div class='kv'><button class='k chip lnk' data-act='vsel' data-arg='"+v.id+"'>"+esc(g.fullName(v))+" · "+g.ageOf(v)+" ans</button>"+bar(cp/100, cp<35?"red":cp<60?"gold":"")+"<span class='v'>"+cp+"</span></div>";
      h += "<div class='chips' style='margin:2px 0 4px'>"+traitChips(g, v)+(g.canSit(v) ? "" : "<span class='chip bad'>Malade : n'apporte rien</span>")+"</div>";
      h += "<div class='lvls'>";
      Object.keys(d.tasks).forEach(function(k){ h += "<button class='b"+(c.task===k?" on":"")+"' data-act='seattask' data-arg='"+id+":"+k+"'><b>"+esc(d.tasks[k].name)+"</b></button>"; });
      h += "</div><div class='dim' style='font-size:11px'>"+esc(d.tasks[c.task].desc)+" Effet actuel : "+Math.round(g.seatPower(id)*100)+" %.</div>";
      if(id==="steward"){
        if(c.known) h += "<div class='bad' style='font-size:12px;margin-top:4px'>Démasqué : "+(v.sex==="f"?"elle":"il")+" a détourné "+Math.round(c.stolen)+" deniers.</div><button class='b wide' data-act='punish'>Lui faire rendre gorge et le chasser du conseil</button>";
        else h += "<button class='b wide"+(g.influence<AUDIT_COST?" off":"")+"' data-act='audit'>Vérifier ses comptes · "+AUDIT_COST+" d'influence</button>";
      }
      h += "<button class='b wide' data-act='dismiss' data-arg='"+id+"'>Relever de ses fonctions</button>";
    } else {
      h += "<div class='dim' style='font-size:12px'>Siège vacant. "+esc(d.desc)+"</div>";
      h += "<button class='b wide"+(ui.pickSeat===id?" on":"")+"' data-act='pickseat' data-arg='"+id+"'>"+(ui.pickSeat===id ? "Fermer la liste" : "Nommer quelqu'un")+"</button>";
      if(ui.pickSeat===id){
        var cs = g.seatCandidates(id, 5);
        if(!cs.length) h += "<div class='dim' style='font-size:12px'>Personne n'est en état de servir.</div>";
        cs.forEach(function(o){
          h += "<button class='ext' data-act='appoint' data-arg='"+id+":"+o.id+"'><span class='t'><b>"+esc(g.fullName(o))+" · "+g.ageOf(o)+" ans</b><span>"+esc(g.villagerStatus(o))+" · "+g.traitsOf(o).map(function(t){ return TRAIT_DEFS[t].name; }).join(", ")+"</span></span><span class='gold'>"+g.competence(o, id)+"</span></button>";
        });
      }
    }
  });
  return h;
}

/* ===== étape 7c : les ordres et le coutumier ===== */
function orderCounts(g){
  var c = { serf:0, bourg:0, noble:0 };
  g.families.forEach(function(f){ c[f.ord||"serf"]++; });
  return c.serf+" serf"+(c.serf>1?"s":"")+" · "+c.bourg+" bourg. · "+c.noble+" noble"+(c.noble>1?"s":"");
}
function sheetLaws(g){
  var h = head(ic("scroll","l"), "Le coutumier", "Influence "+Math.floor(g.influence)+" · une loi coûte "+LAW_COST);
  /* les ordres */
  h += "<div class='sec'>Les trois ordres</div>";
  ["serf","bourg","noble"].forEach(function(o){
    var n = g.families.filter(function(f){ return (f.ord||"serf")===o; }).length;
    h += "<div class='kv'><span class='k'><b>"+esc(ORDER_DEFS[o].name)+"</b></span><span class='v'>"+n+" famille"+(n>1?"s":"")+"</span></div><div class='dim' style='font-size:11px;margin:-2px 0 4px'>"+esc(ORDER_DEFS[o].desc)+"</div>";
  });
  /* les lois, chapitre par chapitre */
  h += "<div class='desc' style='margin-top:8px'>Proclamer une loi coûte "+LAW_COST+" d'influence ; elle prend effet le mois suivant, et l'on ne revient pas dessus avant "+LAW_COOLDOWN+" mois.</div>";
  var lastCh = null;
  LAW_ORDER.forEach(function(id){
    var d = LAW_DEFS[id], cur = g.law(id), pend = g.lawPending[id], lk = g.lawLock(id), w = g.lawWait(id);
    if(d.ch!==lastCh){ h += "<div class='sec'>"+esc(LAW_CHAPTERS[d.ch])+"</div>"; lastCh = d.ch; }
    h += "<div class='kv'><span class='k'><b>"+esc(d.name)+"</b></span><span class='v"+(pend?" gold":"")+"'>"+esc(pend ? "→ "+d.opts[pend.opt].name+" le mois prochain" : d.opts[cur].name)+"</span></div>";
    if(d.locked){ h += "<div class='dim' style='font-size:11px'>"+esc(d.locked)+"</div>"; return; }
    h += "<div class='lvls' style='grid-template-columns:repeat("+d.opts.length+",1fr)'>";
    d.opts.forEach(function(o, k){
      var dis = !!lk || !!pend || (k!==cur && (w>0 || g.influence<LAW_COST));
      h += "<button class='b"+(k===(pend ? pend.opt : cur)?" on":"")+(dis && k!==cur ? " off" : "")+"' data-act='proclaim' data-arg='"+id+":"+k+"'><b>"+esc(o.name)+"</b><span>"+(o.ap ? signed(o.ap)+" appro." : "—")+"</span></button>";
    });
    h += "</div><div class='dim' style='font-size:11px'>"+esc(d.opts[pend ? pend.opt : cur].desc)+(lk ? " <span class='bad'>"+esc(lk)+".</span>" : w>0 ? " <span class='gold'>Modifiable dans "+w+" mois.</span>" : "")+"</div>";
  });
  return h;
}

/* ===== étape 7d : justice et audiences ===== */
function famName(g, id){ var f = g.famById(id); return f ? esc(f.name) : "?"; }
function sheetJustice(g){
  var np = g.nextOf(PLAID_MONTHS);
  var h = head(ic("crown","l"), "Justice et audiences", "Prochains plaids : "+MONTHS[np.month].toLowerCase()+(np.inMonths===12 ? " (ce mois-ci)" : ""));
  h += "<div class='desc'>Jugez quand vous voulez, au plus tard aux plaids de la saison : une affaire laissée sans jugement fâche les deux familles. "
     + (g.seatHolder("bailiff") ? "Votre bailli enquête : les preuves sont fiables à "+Math.round(g.proofAcc()*100)+" %." : "Sans bailli, les preuves sont incertaines (fiables à 60 %).")+"</div>";
  h += "<div class='sec'>Affaires ("+g.cases.length+")</div>";
  if(!g.cases.length) h += "<div class='dim' style='font-size:12px'>Aucune affaire en attente.</div>";
  g.cases.forEach(function(c){
    var d = CASE_DEFS[c.type], acc = c.v ? g.villager(c.v) : null;
    h += "<div class='kv'><span class='k'><b>"+esc(d.name)+"</b></span><span class='v dim' style='font-weight:400'>avant "+MONTHS[c.until%12].toLowerCase()+"</span></div>";
    var who = c.type==="border" ? famName(g, c.a)+" contre "+famName(g, c.b)
      : c.type==="theft" ? famName(g, c.b)+" accuse "+(acc ? esc(g.fullName(acc)) : "?")
      : c.type==="poach" ? (acc ? esc(g.fullName(acc)) : "?")+" ("+famName(g, c.a)+")"
      : c.type==="debt" ? famName(g, c.a)+" réclame son dû à la "+esc(g.famLow(g.famById(c.b)))
      : "Un homme de la "+esc(g.famLow(g.famById(c.a)))+" contre un de la "+esc(g.famLow(g.famById(c.b)));
    h += "<div class='desc' style='margin-bottom:4px'>"+esc(d.desc)+" "+who+"."+(c.proof ? " <b class='"+(c.proof==="solides"?"gold":"dim")+"'>Preuves "+c.proof+".</b>" : "")+"</div>";
    var vs = d.verdicts.map(function(x){
      var lbl = x.id==="a" ? "Raison aux "+esc(g.surnameOf(g.famById(c.a))) : x.id==="b" ? "Raison aux "+esc(g.surnameOf(g.famById(c.b))) : esc(x.name);
      return "<button class='b"+(x.high ? " off" : "")+"' data-act='judge' data-arg='"+c.id+":"+x.id+"'><b>"+lbl+"</b>"+(x.high ? "<span>baron</span>" : "")+"</button>";
    });
    h += "<div class='lvls' style='grid-template-columns:repeat("+Math.min(3, vs.length)+",1fr)'>"+vs.join("")+"</div>";
    var last = g.prec[c.type];
    if(last!==undefined && d.accused) h += "<div class='dim' style='font-size:11px'>Précédent : la dernière fois, sur preuves solides, "+esc((d.verdicts.find(function(x){ return x.sev===last; })||{ name:"?" }).name.toLowerCase())+". Un revirement brutal choque le village.</div>";
  });
  h += "<div class='sec'>Pétitions ("+g.petitions.length+")</div>";
  if(!g.petitions.length) h += "<div class='dim' style='font-size:12px'>Personne ne demande audience.</div>";
  g.petitions.forEach(function(p){
    var d = PETITION_DEFS[p.type], f = g.famById(p.f), v = p.v ? g.villager(p.v) : null;
    h += "<div class='kv'><span class='k'><b>"+esc(d.name)+"</b> · "+famName(g, p.f)+"</span><span class='v dim' style='font-weight:400'>"+(f ? "opinion "+g.famOpinion(f) : "")+"</span></div>";
    h += "<div class='desc' style='margin-bottom:4px'>"+esc(d.desc)+(p.amount ? " Elle demande "+p.amount+" deniers." : "")+(v ? " ("+esc(g.fullName(v))+", "+g.ageOf(v)+" ans)" : "")
       + (p.type!=="freedom" ? " Accordée, la famille vous devra une faveur." : "")+"</div>";
    h += "<div class='row'><button class='b' data-act='petition' data-arg='"+p.id+":1'>Accorder</button><button class='b' data-act='petition' data-arg='"+p.id+":0'>Refuser</button></div>";
  });
  var debtors = g.families.filter(function(f){ return (f.favor||0)>0; });
  if(debtors.length){
    h += "<div class='sec'>Faveurs dues</div><div class='chips'>"+debtors.map(function(f){ return "<span class='chip'>"+esc(g.surnameOf(f))+" · "+f.favor+"</span>"; }).join("")+"</div>"
       + "<div class='dim' style='font-size:11px'>Une famille redevable accepte un verdict contre elle sans trop de rancune, ou reste au lieu de partir.</div>";
  }
  return h;
}

/* ===== étape 7e : intrigues et chronique ===== */
function factionSeen(g){ return !!g.faction && (g.faction.known || g.faction.power>=20); }
function sheetPlots(g){
  var h = head(ic("sword","l"), "Intrigues", g.informer()>0 ? "Vos informateurs tendent l'oreille" : "Sans bailli ni chapelain, vous ne savez rien");
  var F = g.faction;
  h += "<div class='sec'>Les mécontents</div>";
  if(!F) h += "<div class='dim' style='font-size:12px'>Aucune faction. Quand plusieurs familles vous en veulent (opinion sous 35), elles se rassemblent autour d'un meneur.</div>";
  else if(!factionSeen(g)) h += "<div class='dim' style='font-size:12px'>Rien de précis… mais on murmure dans les chaumières. Un bailli ou un chapelain vous en dirait plus.</div>";
  else {
    var lead = g.villager(F.leader);
    h += "<div class='kv'><span class='k'>Revendication</span><span class='v'>"+esc(FACTION_DEMANDS[F.demand].name)+"</span></div>";
    h += "<div class='kv'><span class='k'>Meneur</span><span class='v'>"+(F.known && lead ? "<button class='chip lnk' data-act='vsel' data-arg='"+lead.id+"'>"+esc(g.fullName(lead))+"</button>" : "inconnu")+"</span></div>";
    h += "<div class='kv'><span class='k'>Familles</span><span class='v'>"+F.fams.map(function(id){ return esc(g.surnameOf(g.famById(id))); }).join(", ")+"</span></div>";
    h += "<div class='kv'><span class='k'>Force</span>"+bar(F.power/100, F.power>=FACTION_ULTIMATUM?"red":F.power>=FACTION_STRIKE?"gold":"")+"<span class='v'>"+Math.round(F.power)+"</span></div>";
    h += "<div class='dim' style='font-size:11px'>À "+FACTION_STRIKE+" : grève de la corvée et de la moitié de la taille. À "+FACTION_ULTIMATUM+" : ultimatum. À 100 : jacquerie (matée si votre milice compte au moins un soldat par famille révoltée). Un bailli en tournée et une réputation de seigneur craint la freinent ; satisfaire la revendication ou apaiser les familles la dissout.</div>";
    h += "<div class='row'><button class='b' data-act='facyield'>Céder</button><button class='b"+(F.known?"":" off")+"' data-act='facarrest'>Faire arrêter le meneur</button></div>";
  }
  var sv = g.villagers.filter(function(v){ return v.sk===1 && g.secretOf(v); });
  h += "<div class='sec'>Secrets connus</div>";
  if(!sv.length) h += "<div class='dim' style='font-size:12px'>"+(g.informer()>0 ? "Vos informateurs n'ont encore rien appris." : "Il faut un bailli ou un chapelain au conseil pour apprendre les secrets des villageois.")+"</div>";
  sv.forEach(function(v){ h += vRow(g, v, SECRET_DEFS[g.secretOf(v)].name); });
  h += "<button class='kv lnk' data-act='sheet' data-arg='chronicle' style='margin-top:8px'><span class='k'>"+ic("scroll")+"Chronique du domaine</span><span class='v'>"+g.chronicle.length+" ›</span></button>";
  return h;
}
function sheetChronicle(g){
  var h = head(ic("scroll","l"), "Chronique du domaine", "Ce que l'on retiendra de votre règne");
  if(!g.chronicle.length) return h + "<div class='dim' style='font-size:12px'>Rien de mémorable encore.</div>";
  var y = null;
  g.chronicle.slice().reverse().forEach(function(c){
    if(c.y!==y){ h += "<div class='sec'>"+c.y+"</div>"; y = c.y; }
    h += "<div style='font-size:12px;margin:3px 0'><span class='dim'>"+MONTHS[c.m]+" · </span><span class='"+(c.k==="bad"?"bad":c.k==="good"?"good":"")+"'>"+esc(c.t)+"</span></div>";
  });
  return h;
}

/* vue d'ensemble de la seigneurie */
function sheetRealm(g){
  var homeless = g.families.filter(function(f){ return f.home<0; }).length;
  var h = head(ic("crown","l"), esc(g.settlementName()), esc(g.mode().name)+" · "+esc(g.diff().name)+" · "+MONTHS[g.time.month]+" "+g.time.year);
  h += "<div class='kv'><span class='k'>"+ic("coin")+"Trésor</span><span class='v'>"+Math.floor(g.treasury)+" deniers</span></div>";
  h += "<div class='kv'><span class='k'>"+ic(heartIcon(g.approval))+"Approbation</span>"+bar(g.approval/100, g.approval<40?"red":g.approval<60?"gold":"")+"<span class='v'>"+g.approval+" %</span></div>";
  /* étape 4 : ce qui fait monter ou baisser l'approbation (bilan du dernier mois) */
  if(g.approvalWhy && g.approvalWhy.length){
    h += "<div class='why'>";
    g.approvalWhy.forEach(function(w){ if(w[1]) h += "<div><span>"+esc(w[0])+"</span><b class='"+(w[0]==="Base" ? "dim" : w[1]>0 ? "good" : "bad")+"'>"+(w[0]==="Base" ? w[1] : signed(w[1]))+"</b></div>"; });
    h += "</div>";
  }
  var fm = g.foodMonths();
  h += "<button class='kv lnk' data-act='sheet' data-arg='stock'><span class='k'>"+ic("bread")+"Vivres"+(g.dearth>0 ? " · <span class='bad'>disette</span>" : "")+"</span><span class='v"+(fm<2 ? " bad" : fm<4 ? " gold" : "")+"'>"+monthsFood(fm)+" ›</span></button>";
  h += "<button class='kv lnk' data-act='sheet' data-arg='people'><span class='k'>"+ic("family")+"Habitants</span><span class='v'>"+g.villagers.length+" · "+g.families.length+" foyer"+(g.families.length>1?"s":"")+" ›</span></button>";
  h += "<div class='kv'><span class='k' style='padding-left:24px'>Journaliers (adultes sans poste)</span><span class='v'>"+g.unemployed()+"</span></div>";
  h += "<div class='kv'><span class='k' style='padding-left:24px'>Bourgages libres</span><span class='v'>"+g.freeBurgages()+"</span></div>";
  if(homeless) h += "<div class='kv'><span class='k bad' style='padding-left:24px'>Sans logis</span><span class='v bad'>"+homeless+"</span></div>";
  h += "<div class='kv'><span class='k'>"+ic("crown")+"Influence</span><span class='v'>"+Math.floor(g.influence)+"</span></div>";
  h += "<button class='kv lnk' data-act='sheet' data-arg='justice'><span class='k'>"+ic("crown")+"Justice et audiences</span><span class='v'>"+(g.cases.length+g.petitions.length)+" en attente ›</span></button>";
  h += "<button class='kv lnk' data-act='sheet' data-arg='plots'><span class='k'>"+ic("sword")+"Intrigues et chronique</span><span class='v'>"+(factionSeen(g) ? "<span class='bad'>une faction</span> " : "")+"›</span></button>";
  h += "<button class='kv lnk' data-act='sheet' data-arg='laws'><span class='k'>"+ic("scroll")+"Coutumier et ordres</span><span class='v'>"+orderCounts(g)+" ›</span></button>";
  h += "<button class='kv lnk' data-act='sheet' data-arg='council'><span class='k'>"+ic("crown")+"Conseil et réputation</span><span class='v'>"+councilCount(g)+"/4"+g.repTitles().map(function(t){ return " · "+esc(t.name.toLowerCase()); }).join("")+" ›</span></button>";
  h += "<div class='kv'><span class='k'>"+ic("bag")+"Richesse régionale</span><span class='v'>"+Math.floor(g.wealth)+"</span></div>";
  h += "<button class='kv lnk' data-act='sheet' data-arg='book'><span class='k'>"+ic("scroll")+"Livre de comptes</span><span class='v'>"+(g.hasManor() ? "taille "+Math.round(g.taxRate*100)+" %" : "manoir requis")+(g.fisc.debt>0 ? " · <span class='bad'>dette "+Math.ceil(g.fisc.debt)+"</span>" : "")+" ›</span></button>";
  h += "<div class='kv'><span class='k'>"+ic("sword")+"Soldats</span><span class='v'>"+g.units.length+" / "+g.militiaCount()+"</span></div>";
  if(g.time.year>=1177) h += "<div class='kv'><span class='k bad'>"+ic("shield")+esc(g.baron.name)+"</span><span class='v bad'>puissance "+g.baron.power+"</span></div>";
  h += "<div class='row' style='margin-top:10px'><button class='b' data-act='modal' data-arg='regions'>"+ic("flag")+"Régions</button>"
     + "<button class='b' data-act='modal' data-arg='log'>"+ic("scroll")+"Journal</button>"
     + "<button class='b' data-act='sheet' data-arg='stock'>"+ic("crate")+"Réserves</button></div>";
  return h;
}

/* menu (☰) */
function sheetMenu(g){
  var e = entryOf(activeKey), ago = _lastSaveAt ? Math.round((Date.now()-_lastSaveAt)/1000) : null;
  var h = head(ic("menu","l"), "Menu", esc(e ? e.name : "Seigneurie")+" · enregistrée "+(ago===null ? "automatiquement" : ago<5 ? "à l'instant" : "il y a "+(ago<60 ? ago+" s" : Math.round(ago/60)+" min")));
  h += "<div class='menu-list'>";
  h += "<button class='b wide gold' data-act='savenow'>"+ic("crate")+"Sauvegarder maintenant</button>";
  h += "<button class='b wide' data-act='savecopy'>"+ic("scroll")+"Garder une copie de la partie (point de retour)</button>";
  h += "<button class='b wide' data-act='modal' data-arg='regions'>"+ic("flag")+"Régions du domaine</button>";
  h += "<button class='b wide' data-act='modal' data-arg='log'>"+ic("scroll")+"Journal des événements</button>";
  h += "<button class='b wide' data-act='modal' data-arg='help'>"+ic("help")+"Guide</button>";
  h += "<button class='b wide' data-act='modal' data-arg='options'>"+ic("sound")+"Options</button>";
  h += "<button class='b wide' data-act='mainmenu'>"+ic("house")+"Écran d'accueil (charger, nouvelle partie)</button>";
  h += "</div>";
  h += "<div class='dim' style='font-size:11px;margin-top:6px'>La partie s'enregistre toute seule sur l'appareil toutes les 5 secondes et dès qu'on quitte"+(NATIVE ? " (fichiers de l'application, gardés jusqu'à la désinstallation)" : "")+".</div>";
  return h;
}

/* options : son, texte, transfert de parties (fichiers) */
function optionsHtml(inGame){
  var h = "";
  h += "<button class='opt' data-act='mute'><b>"+ic(AudioFX.muted?"mute":"sound","s")+" Son : "+(AudioFX.muted?"coupé":"activé")+"</b><span>Bruitages de construction, cloches, alertes.</span></button>";
  h += "<button class='opt' data-act='text'><b>Taille du texte : "+TXT_NAMES[_txtSize]+"</b><span>Toucher pour changer (normal, grand, très grand).</span></button>";
  h += "<button class='opt' data-act='vibe'><b>Vibrations : "+(ui.noVibe ? "coupées" : "activées")+"</b><span>Petit retour au toucher en posant ou en annulant.</span></button>";
  h += "<h3>Transférer une partie</h3>";
  h += "<p class='dim' style='font-size:12px;margin:2px 0 4px'>Les parties sont déjà enregistrées sur cet appareil. Un fichier sert à en garder une à part ou à la passer sur un autre téléphone.</p>";
  if(inGame) h += "<button class='opt' data-act='exportfile'><b>"+ic("scroll","s")+" Exporter cette partie dans un fichier</b><span>"+(NATIVE ? "Choisissez où l'enregistrer (Téléchargements, Drive…)." : "Le navigateur télécharge un fichier .json.")+"</span></button>";
  h += "<button class='opt' data-act='importfile'><b>"+ic("scroll","s")+" Importer une partie depuis un fichier</b><span>Elle s'ajoute à vos parties, sans rien remplacer.</span></button>";
  return h;
}

/* ---------- dock des catégories ---------- */
function renderDock(g){
  if(!g || uiMenu){ setHTML(elDock, ""); elDock.style.display = "none"; return; }
  elDock.style.display = "";
  var h = "";
  for(var i=0;i<CATS.length;i++){
    var c = CATS[i];
    var on = c.tool ? ui.roadMode : (ui.cat===c.id || (ui.buildSel && c.items.indexOf(ui.buildSel)>=0)
           || (c.id==="home" && ((ui.zoneMode && ui.zoneKind==="house") || ui.extPlace)) || (c.id==="farm" && ui.zoneMode && ui.zoneKind!=="house"));
    h += "<button class='cat"+(on?" on":"")+"' data-act='cat' data-arg='"+c.id+"'>"+ic(c.icon)+"<span>"+c.name+"</span></button>";
  }
  setHTML(elDock, h);
}

/* ---------- fenêtres ---------- */
function renderModal(g){
  var h = "", big = false;
  if(uiMenu || !g){ h = (ui.flash ? "<div class='flash' style='margin:0 0 8px'>"+esc(ui.flash)+"</div>" : "")+modalMenu(g); big = true; }
  else if((g.victory || g.defeat) && !ui.endSeen) h = modalEnd(g);
  else if(g.pendingEvent) h = modalEvent(g);
  else if(ui.modal==="help"){ h = modalHelp(); big = true; }
  else if(ui.modal==="log"){ h = modalLog(g); big = true; }
  else if(ui.modal==="regions"){ h = modalRegions(g); big = true; }
  else if(ui.modal==="binfo") h = modalBuildInfo(g);
  else if(ui.modal==="options") h = "<h2>"+ic("sound","l")+"Options</h2>"+optionsHtml(true)+closeBtn();
  elModal.classList.toggle("hide", !h);
  elCard.classList.toggle("big", big);
  elModal.classList.toggle("home", !!(uiMenu || !g));
  var key = uiMenu ? "menu"+(ui.home||"") : (ui.modal||"") + (g && g.pendingEvent ? "ev" : "");
  setHTML(elCard, h);
  if(elCard._key!==key){ elCard._key = key; elCard.scrollTop = 0; }
}
function closeBtn(){ return "<button class='b wide' data-act='modalclose'>Fermer</button>"; }

function saveRow(e){
  var info = e.info || {}, armed = ui.delArm && ui.delArm.key===e.key && Date.now()<ui.delArm.t, cur = e.key===activeKey && !!game;
  return "<div class='slot'><button class='opt"+(cur ? " on" : "")+"' data-act='loadsave' data-arg='"+esc(e.key)+"'><b>"+esc(e.name)+(cur ? " <span class='dim'>(en cours)</span>" : "")+"</b>"
    + "<span>"+(info.level ? esc(info.level)+" de "+info.pop+" familles · "+MONTHS[info.month]+" "+info.year+" · "+esc(info.mode)+" · "+esc(info.diff) : "")
    + (info.victory ? " · victoire" : "")+(info.defeat ? " · défaite" : "")+(e.t ? "<br>Enregistrée "+whenTxt(e.t) : "")+"</span></button>"
    + "<button class='b' data-act='rensave' data-arg='"+esc(e.key)+"' aria-label='Renommer'>✎</button>"
    + "<button class='b red' data-act='delsave' data-arg='"+esc(e.key)+"' aria-label='Supprimer'>"+(armed ? "Effacer ?" : ic("close"))+"</button></div>";
}
function whenTxt(t){
  var d = new Date(t), now = new Date(), hm = String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
  if(d.toDateString()===now.toDateString()) return "aujourd'hui à "+hm;
  var y = new Date(now.getTime()-86400000);
  if(d.toDateString()===y.toDateString()) return "hier à "+hm;
  return "le "+d.getDate()+" "+["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."][d.getMonth()]+(d.getFullYear()!==now.getFullYear() ? " "+d.getFullYear() : "")+" à "+hm;
}
function backBtn(){ return "<button class='b wide' data-act='home' data-arg='main'>Retour</button>"; }
function modalMenu(g){
  var saves = sortedSaves(), scr = ui.home || "main";
  if(ui.loading){
    var le = entryOf(ui.loading);
    return "<div class='home-title'>"+ICONS.th("manor")+"<div><b>SEIGNEURIE</b></div></div><p style='text-align:center'>Chargement de « "+esc(le ? le.name : "la partie")+" »…</p>";
  }
  var h = "";
  if(scr==="main"){
    h += "<div class='home-title'>"+ICONS.th("manor")+"<div><b>SEIGNEURIE</b><span>Un village médiéval à faire prospérer</span></div></div>";
    var last = (game && entryOf(activeKey)) || entryOf(activeKey) || saves[0];
    if(last){
      var li = last.info || {};
      h += "<button class='hbtn gold' data-act='continue' data-arg='"+esc(last.key)+"'><b>Continuer</b><span>"+esc(last.name)+(li.level ? " · "+esc(li.level)+" de "+li.pop+" familles · "+MONTHS[li.month]+" "+li.year : "")+"</span></button>";
    }
    h += "<button class='hbtn' data-act='home' data-arg='new'><b>Nouvelle partie</b><span>Choisir le mode et la difficulté</span></button>";
    if(saves.length) h += "<button class='hbtn' data-act='home' data-arg='load'><b>Charger une partie</b><span>"+saves.length+" partie"+(saves.length>1?"s":"")+" sur cet appareil</span></button>";
    h += "<button class='hbtn' data-act='home' data-arg='options'><b>Options</b><span>Son, texte, transfert de parties</span></button>";
    h += "<button class='hbtn' data-act='home' data-arg='guide'><b>Guide</b><span>Comment jouer</span></button>";
    return h;
  }
  if(scr==="load"){
    h += "<h2>"+ic("crate","l")+"Charger une partie</h2>";
    if(!saves.length) h += "<p class='dim'>Aucune partie sur cet appareil.</p>";
    saves.forEach(function(e){ h += saveRow(e); });
    h += "<p class='dim' style='font-size:12px'>✎ renommer · ✕ supprimer (toucher deux fois). Les copies gardées depuis le menu ☰ apparaissent ici.</p>";
    return h + backBtn();
  }
  if(scr==="options"){
    h += "<h2>"+ic("sound","l")+"Options</h2>"+optionsHtml(!!game);
    return h + backBtn();
  }
  if(scr==="guide") return helpHtml() + backBtn();
  /* nouvelle partie */
  h += "<h2>"+ICONS.th("manor")+"Nouvelle partie</h2>";
  h += "<h3>Mode</h3>";
  for(var m=0;m<MODES.length;m++){
    var md = MODES[m];
    h += "<button class='opt"+(ui.newMode===md.id?" on":"")+"' data-act='nmode' data-arg='"+md.id+"'><b>"+esc(md.name)+"</b><span>"+esc(md.desc)+"</span></button>";
  }
  h += "<h3>Difficulté</h3><div class='seg'>";
  for(var d=0;d<DIFFICULTIES.length;d++){
    var dd = DIFFICULTIES[d];
    h += "<button class='opt"+(ui.newDiff===dd.id?" on":"")+"' data-act='ndiff' data-arg='"+dd.id+"'><b>"+esc(dd.name)+"</b></button>";
  }
  var dsel = DIFFICULTIES.filter(function(x){ return x.id===ui.newDiff; })[0];
  h += "</div>"+(dsel && dsel.desc ? "<p class='dim' style='font-size:12px;margin:6px 0 0'>"+esc(dsel.desc)+"</p>" : "");
  h += "<p class='dim' style='font-size:12px'>La partie s'enregistre sous le nom « "+esc(defaultName())+" » (renommable), à côté de vos autres parties : rien n'est remplacé.</p>";
  h += "<button class='b gold wide' data-act='startgame'>Commencer</button>";
  return h + backBtn();
}
function modalEnd(g){
  var win = g.victory;
  var h = "<h2>"+(win ? ic("crown","l")+"Victoire !" : ic("heart_r","l")+"Défaite")+"</h2>";
  h += "<p>"+esc(g.mode().name)+" · "+esc(g.diff().name)+"</p>";
  h += "<p>"+MONTHS[g.time.month]+" "+g.time.year+" — "+esc(g.settlementName())+" de "+g.families.length+" familles.</p>";
  h += "<p>Trésor : "+Math.floor(g.treasury)+"&nbsp;deniers · Influence : "+Math.floor(g.influence)+" · Approbation : "+g.approval+"&nbsp;%</p>";
  if(win) h += "<p class='dim' style='font-size:12px'>Vous pouvez continuer à faire grandir votre seigneurie : la partie reste sauvegardée.</p>";
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
/* régions de la grande carte : les vôtres, celles qui touchent vos terres (réclamables), puis les autres */
var BONUS_TXT = { stone:"+1 pierre par mois", berries:"+2 baies par mois", firewood:"+2 bois de chauffe par mois", grain:"+2 grain par mois" };
function regionBonusTxt(r){ var k = r.bonus ? Object.keys(r.bonus)[0] : null; return k ? (BONUS_TXT[k] || ("+"+r.bonus[k]+" "+k)) : "votre terre natale"; }
function regionRow(g, r, cost){
  var baron = g.baron.regions.indexOf(r.id)>=0, near = g.regionClaimable(r);
  var tag = r.owned ? " · <span class='good'>à vous</span>" : baron ? " · <span class='bad'>au Baron</span>" : near ? " · <span class='gold'>voisine</span>" : "";
  var h = "<div class='kv' style='align-items:center;gap:6px'><div style='flex:1 1 auto;min-width:0'><div><b>"+esc(r.name)+"</b>"+tag+"</div>"
        + "<div class='dim' style='font-size:11px'>"+r.n+" cases · "+esc(regionBonusTxt(r))+"</div></div>";
  h += "<button class='b sm' data-act='rlook' data-arg='"+r.id+"'>Voir</button>";
  if(near || g.regionRetakable(r)){
    var rc = g.regionCost(r), can = g.treasury>=rc.treasury && g.wealth>=rc.wealth;
    h += "<button class='b sm"+(can?" gold":" dis")+"' data-act='claim' data-arg='"+r.id+"'>"+(near ? "Réclamer" : "Reprendre ("+rc.treasury+")")+"</button>";
  }
  return h + "</div>";
}
function modalRegions(g){
  var cost = g.regionCost();
  var h = "<h2>"+ic("flag","l")+"Régions</h2>";
  h += "<p class='dim'>On ne réclame qu'une région qui touche vos terres. La prochaine coûte "+cost.treasury+"&nbsp;deniers et "+cost.wealth+"&nbsp;de richesse régionale (vous avez "+Math.floor(g.treasury)+" et "+Math.floor(g.wealth)+") ; chaque région de plus coûte un peu plus. Reprendre une région au Baron coûte moitié plus de deniers.</p>";
  var mine = g.regions.filter(function(r){ return r.owned; });
  var near = g.regions.filter(function(r){ return !r.owned && (g.regionClaimable(r) || (g.baron.regions.indexOf(r.id)>=0 && r.nb.some(function(k){ return g.regions[k].owned; }))); });
  var rest = g.regions.length - mine.length - near.length;
  h += "<h3>Vos terres</h3>"; mine.forEach(function(r){ h += regionRow(g, r, cost); });
  if(near.length){ h += "<h3>Aux frontières</h3>"; near.forEach(function(r){ h += regionRow(g, r, cost); }); }
  if(rest>0) h += "<p class='dim' style='font-size:12px'>Plus loin, "+rest+" autres régions : vous pourrez les réclamer de proche en proche.</p>";
  return h + closeBtn();
}
function modalHelp(){ return helpHtml() + "<button class='b gold wide' data-act='modalclose'>Compris</button>"; }
function helpHtml(){
  var h = "<h2>"+ic("help","l")+"Guide</h2>";
  h += "<h3>Premiers pas</h3><p>Suivez les <b>objectifs</b>, en haut à gauche : chacun dit quoi faire et où le trouver. Tracez d'abord une zone de <b>maisons</b> le long de la route, puis ouvrez <b>Récolte</b> et posez un <b>camp de bûcherons</b> (gratuit) près d'une forêt. Un bâtiment achevé reçoit tout de suite un ouvrier ; touchez-le, puis <b>+</b> pour en ajouter : le jeu choisit l'adulte libre le plus doué. Les adultes sans poste (journaliers) construisent les chantiers.</p>";
  h += "<h3>Chantiers et matériaux</h3><p>Le bois et la pierre d'un chantier sont réservés à la pose (on ne peut plus les dépenser ailleurs), puis <b>apportés</b> : ils sortent du stock quand ils arrivent au pied du chantier. Les journaliers les prennent au dépôt le plus commode (campement, poteau du bœuf, <b>entrepôt</b>, camp de bûcherons pour le bois, carrière pour la pierre). Un tronc est trop lourd pour un homme : un journalier va chercher le <b>bœuf</b> et le mène, avec trois troncs derrière lui, quand il ne laboure pas ; sans bœuf en état, on traîne un tronc à la main, lentement. La pierre se porte une à une. On ne bâtit qu'avec ce qui est arrivé : posez vos entrepôts près des chantiers, et touchez un chantier pour le <b>livrer en priorité</b>. Abandonner un chantier rend les matériaux non employés.</p>";
  h += "<h3>Les villageois</h3><p>Chaque habitant a un âge, une santé, une humeur et un savoir-faire par métier, qui progresse en travaillant (de novice à maître). Touchez un villageois sur la carte, ou le compteur d'habitants en haut, pour ouvrir sa fiche : vous y voyez pourquoi il est content ou non, et vous pouvez changer son métier. Les adolescents de 12 à 15 ans peuvent entrer en <b>apprentissage</b> : auprès d'un bon maître, ils apprennent vite. Les couples se marient, ont des enfants, vieillissent ; à 65 ans, on prend sa retraite. Si un maître meurt sans avoir formé personne, son savoir-faire disparaît.</p>";
  h += "<h3>Nourrir et chauffer</h3><p>Cueilleuses (baies, de mars à novembre) et chasseurs (viande) nourrissent le village. Les repas se comptent en cinq sortes d'aliments : <b>pain</b>, <b>viande</b>, <b>laitages et œufs</b>, <b>légumes et pois</b>, <b>fruits et miel</b>. Plus il y en a dans l'écuelle de chaque foyer, plus l'approbation monte. Un <b>marché</b> actif les distribue ; sans lui, chacun se contente d'une seule sorte. L'hiver, la consommation de bois de chauffe double : faites des réserves avant décembre.</p>";
  h += "<h3>Transformer et conserver</h3><p>Le <b>moulin</b> moud le grain en farine ; la <b>boulangerie</b> en tire 1,5 pain par farine (un foyer, dans son propre four, n'en tire qu'un). La <b>laiterie</b> fait du fromage avec le lait des vaches, le <b>fumoir</b> fume la viande. Chaque artisan va chercher ce qu'il lui faut au plus proche (ferme, grange, moulin, pâturage, camp de chasse) et le porte à l'atelier.</p>"
     + "<p>Chaque denrée se gâte à son rythme : le lait tourne en quelques semaines, la viande fraîche et le pain ne durent pas, le fromage, la viande fumée, les pois secs et le miel se gardent. Le froid de l'hiver ralentit tout, la chaleur de l'été l'accélère. Une <b>grange</b> met 200 denrées à l'abri (trois fois moins de pertes). On mange d'abord ce qui va se gâter : les conserves restent pour l'hiver.</p>"
     + "<p><b>Disette</b> : quand les réserves ne suffisent plus, on mange le grain en bouillie, puis on a faim. Le jeu prévient en mars si la soudure s'annonce difficile, et en octobre si l'hiver sera maigre. En disette, un marchand de grain passe parfois et vend des pois secs.</p>";
  h += "<h3>Agriculture</h3><p>Les champs sont gratuits ; les fermiers d'une <b>ferme</b> les travaillent au fil des saisons. Chaque culture a son calendrier : le <b>blé d'hiver</b> et le <b>seigle</b> se sèment à l'automne et se moissonnent l'été suivant ; l'orge, l'avoine, le lin et les pois se sèment au printemps ; le <b>pré de fauche</b> donne du foin en juin-juillet sans labour. Les céréales sont moissonnées en <b>gerbes</b>, battues ensuite à la ferme (surtout l'hiver) ; le moulin moud le grain, la boulangerie fait le pain.</p>"
     + "<p><b>Rotation</b> : la même céréale deux ans de suite rend moins ; après des pois ou une jachère, davantage. Le <b>fumier</b> des bêtes, épandu avant le labour, remonte la fertilité ; un <b>bœuf</b> accélère le labour. La météo compte : gel tardif, printemps sec, grêle, été pourri. Le panneau d'un champ montre la récolte attendue et pourquoi.</p>";
  h += "<h3>Élevage</h3><p>Tracez un <b>pâturage</b> (tiroir Terres) comme une zone, n'importe où : la clôture coûte du bois, un abri se pose au bord. Achetez des moutons (laine en mai), des vaches (lait après le vêlage, les jeunes taureaux deviennent des bœufs) ou des porcs (glandée en forêt l'automne). Il faut un mâle pour les naissances et un <b>gardien</b> pour traire, tondre et soigner. L'herbe nourrit les bêtes du printemps à l'automne ; l'hiver, il faut du <b>foin</b> (pré de fauche, herbe en trop fauchée en juin, paille du battage) ou de l'avoine. Réglez l'<b>abattage de novembre</b> pour ne garder que ce que vous pourrez nourrir. Une maladie se propage dans un troupeau : abattre les bêtes malades l'arrête.</p>";
  h += "<h3>La carte et les régions</h3><p>Le pays est vaste : une rivière qu'on traverse aux <b>gués</b>, des lacs, de grandes forêts, et une vingtaine de <b>régions</b> aux frontières en pointillé doré. Vous commencez au Val du Cœur ; les terres assombries ne sont pas à vous : on n'y passe pas et on n'y bâtit pas. Ouvrez <b>Régions</b> (vue d'ensemble de la seigneurie) pour réclamer une région qui touche les vôtres, chacune avec son bonus. La minicarte, en haut à droite, vous emmène n'importe où d'un toucher.</p>";
  h += "<h3>Croissance</h3><p>Une approbation d'au moins 40&nbsp;%, une maison libre et deux mois de vivres attirent de nouvelles familles, d'autant plus vite que l'approbation est haute ; les jeunes couples du village qui vivent chez leurs parents passent avant. Une maison monte au <b>niveau 2</b> après trois mois nourrie, chauffée, <b>vêtue</b> (atelier du tailleur dans une cour), avec deux sortes d'aliments et un marché ; au <b>niveau 3</b>, il faut trois sortes d'aliments, une église et 65&nbsp;% d'approbation. Touchez une maison : son panneau dit ce qui lui manque. Le <b>manoir</b> permet de lever l'impôt.</p>"
     + "<h3>Difficulté</h3><p><b>Paisible</b> : récoltes généreuses, hivers doux, impôt du roi léger. <b>Normal</b> : il faut préparer l'hiver et varier les repas. <b>Difficile</b> : récoltes maigres, denrées qui se gâtent vite, hivers rudes, maladies, impôts et ennemis plus durs. Quand les vivres manquent, les colons cessent de venir : le village ne grandit pas plus vite qu'il ne peut se nourrir.</p>";
  h += "<h3>Le fisc</h3><p>Dans le panneau du <b>manoir</b> : la <b>taille</b> (curseur) court chaque mois selon les maisons habitées et leur niveau, mais ne se lève qu'à <b>Pâques</b> (avril) et à la <b>Saint-Michel</b> (septembre) ; une seigneurie mécontente en cache une partie. La <b>dîme</b> (il faut une église) donne à l'Église une part des céréales et des pois récoltés, en octobre, contre de l'influence chaque mois. Les <b>péages</b> se lèvent chaque mois sur les marchands du marché et du comptoir. La <b>corvée</b> appelle, certains jours, les ouvriers des postes sur vos chantiers. Chaque redevance a son coût en approbation. Le <b>conseil</b> (facultatif) : intendant, bailli, chapelain, maître d'armes, chacun avec sa mission ; un intendant cupide détourne des deniers, faites vérifier ses comptes. Chaque famille se souvient de ce que vous lui faites (maison rasée, mort de faim, corvée, aumône, fête…) : touchez un villageois pour voir l'opinion de sa famille. Votre <b>réputation</b> (généreux, avare, craint) se fait au fil de vos choix. <b>Les trois ordres</b> : les familles arrivent <b>serves</b> (tâches de base, chantiers, corvée) ; quand leur maison atteint le niveau 2, elles entrent dans la <b>bourgeoisie</b> : leurs artisans (moulin, boulangerie, laiterie, fumoir, comptoir) travaillent deux fois mieux qu'un serf, qui n'y est qu'un simple manœuvre ; une famille d'une maison de niveau 3 peut être <b>anoblie</b> (influence) : elle ne travaille plus, sert à la cour, au clergé ou comme lettrée, ne paie pas la taille et mène grand train. <b>Justice et audiences</b> : des affaires (bornage, vol, braconnage, dette, rixe) et des pétitions (prêt, exemption, affranchissement, dispense de corvée, mariage au dehors) arrivent au fil des mois ; le bouton « Audiences » apparaît sur la carte. Jugez avant les plaids de la saison ; sans bailli, les preuves sont incertaines et l'on peut condamner un innocent. Une faveur accordée rend la famille redevable. <b>Intrigues</b> : les familles fâchées forment une faction autour d'un meneur et réclament quelque chose (baisse de la taille, moins de corvée…) ; laissée grandir, elle fait grève, pose un ultimatum, puis se soulève. Un bailli ou un chapelain au conseil vous sert d'informateur : il démasque le meneur et apprend les secrets des villageois, dont vous pouvez faire un levier. La <b>chronique</b> garde les grands moments de votre règne. Le <b>coutumier</b> (panneau du manoir) rassemble les lois : chasse, bois mort, port d'armes, couvre-feu, mainmorte, charte du bourg, taille des nobles. Touchez le <b>trésor</b>, en haut, pour le <b>livre de comptes</b> : recettes et dépenses poste par poste, prévision jusqu'au printemps, calendrier fiscal, et le <b>changeur</b> qui prête à 2 % par mois (trois échéances manquées : il saisit des biens).</p>";
  h += "<h3>Commandes</h3><p>Glisser pour déplacer · pincer ou molette pour zoomer · toucher un bâtiment pour l'ouvrir · <b>appui long</b> pour annuler · toucher la minimap pour s'y rendre. Le bandeau des réserves et la date ouvrent le détail. Au clavier : Espace = pause, 1/2/3/4 = vitesse (×1, ×4, ×16, ×60), ZQSD = caméra, Échap = annuler.</p>";
  h += "<h3>Sauvegarde</h3><p>Chaque partie s'enregistre toute seule sur l'appareil, toutes les 5 secondes et dès qu'on quitte. Menu ☰ : <b>Sauvegarder maintenant</b>, ou <b>Garder une copie</b> pour revenir plus tard à ce moment précis. L'écran d'accueil liste toutes vos parties (charger, renommer, supprimer). Pour changer d'appareil : Options → <b>Exporter dans un fichier</b>, puis <b>Importer</b> sur l'autre.</p>";
  h += "<h3>Les bœufs</h3><p>Un bœuf est polyvalent : il tire la charrue d'un fermier (labour deux fois plus rapide) ou traîne trois troncs jusqu'aux chantiers, mené par un journalier. Touchez le poteau (ou un bœuf) pour choisir sa tâche : polyvalent, charroi, labour ou repos. Avec deux bœufs, l'un laboure pendant que l'autre charrie. Le poteau se déplace gratuitement.</p>";
  h += "<h3>Astuces</h3><p><b>Appui long</b> sur une carte du tiroir de construction : sa fiche (effets, production, ouvriers). Dans les <b>Réserves</b>, « D'où vient chaque ressource ? » montre ce qui produit chaque chose. En <b>pause</b>, tout se fige sur la carte.</p>";
  return h;
}

try{ AudioFX.muted = window.localStorage.getItem("seigneurie-mute")==="1"; }catch(e){}
renderUI();

/* ----- boucle principale ----- */
var _lastT = performance.now(), _acc = 0, _uiAcc = 0, _saveAcc = 0;
/* étape 8 : économie de batterie — l'image est redessinée à chaque trame quand on touche l'écran (ou que la
   caméra glisse), à 30 images par seconde le reste du temps, et à 4 par seconde derrière un menu */
var _lastInput = 0, _lastDraw = 0;
["pointerdown","pointermove","wheel","keydown"].forEach(function(ev){ window.addEventListener(ev, function(){ _lastInput = performance.now(); }, { passive:true }); });
/* étape 3 : outils de zone et de pose dans la cour */
function clearTools(){ ui.movePost = false; ui.pendingPlace = null; ui.zoneMode = false; ui.zoneKind = "house"; ui.zonePts = []; ui.zoneClosed = false; ui.zoneN = null; ui.extPlace = null; zoneDrag = { i:-1 }; }
var zoneDrag = { i:-1 }, lastPtrType = "mouse";
function nearZonePt(x, y){
  var r = Math.max(0.35, 34/(16*cam.zoom)), best = -1;
  for(var i=0; i<ui.zonePts.length; i++){ var d = Math.hypot(ui.zonePts[i][0]-x, ui.zonePts[i][1]-y); if(d<=r){ r = d; best = i; } }
  return best;
}
var _zoneKey = "", _zoneOv = null;
function zoneOverlay(g){
  if(ui.buildSel && ui.pendingPlace){
    var bd = BUILD_DEFS[ui.buildSel];
    return { pending:{ x:ui.pendingPlace.tx, y:ui.pendingPlace.ty, w:bd.w, h:bd.h } };
  }
  if(!ui.zoneMode || ui.zonePts.length===0) return null;
  var grab = zoneDrag.i>=0 && zoneDrag.grabbed ? zoneDrag.i : -1;
  var key = ui.zoneKind+"|"+JSON.stringify(ui.zonePts)+"|"+ui.zoneClosed+"|"+ui.zoneN+"|"+grab+"|"+g.uiVersion+"|"+g.buildings.length+"|"+Math.floor(g.stock.timber);
  if(key===_zoneKey) return _zoneOv;
  _zoneKey = key;
  var pasture = ui.zoneKind==="pasture";
  _zoneOv = { kind:ui.zoneKind, pts:ui.zonePts.slice(), closed:ui.zoneClosed, grab:grab,
              plan: ui.zoneClosed ? (pasture ? g.planPasture(ui.zonePts) : ui.zoneKind==="field" ? g.planField(ui.zonePts) : g.planZone(ui.zonePts, ui.zoneN==null ? undefined : ui.zoneN)) : null };
  return _zoneOv;
}

/* l'horloge des animations (fumées, feux, eau, pas des villageois, bêtes, météo) n'avance que si le temps du jeu
   s'écoule : en pause, derrière un événement ou au menu, plus rien ne bouge sur la carte */
var _animT = 0;
function gameRunning(){ return !!(game && game.speed>0 && !game.pendingEvent && !uiMenu); }
function loop(now){
  var dt = Math.min(200, now-_lastT); _lastT = now;
  var running = gameRunning();
  if(running) _animT += dt;
  if(running){
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
  /* en pause, l'image ne change que si l'on touche l'écran (ou pour le clignotement de la sélection) */
  var every = (uiMenu || ui.modal) ? 250 : (now - _lastInput < 600 || camGoal || pvx || pvy) ? 0 : running ? 32 : 120;
  if(game && now - _lastDraw >= every){ _lastDraw = now; RENDER.setOverlay(zoneOverlay(game)); RENDER.setSelVillager(ui.selV); drawGame(ctx, game, cam, canvas, hover, ui.buildSel, ui.selId, (ui.zoneMode && ui.zoneKind==="field") ? Object.assign({}, ui.layers, { soil:true }) : ui.layers, _animT, now); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* étape 8 : l'application Android demande au jeu de sauvegarder (mise en arrière-plan) et lui passe le bouton
   Retour : il ferme d'abord ce qui est ouvert, puis il faut toucher Retour deux fois pour quitter */
var _backT = 0;
window.seigneurieSave = function(){ persist(game, true); return "ok"; };
window.seigneurieBack = function(){
  if(uiMenu && ui.loading) return "ok";
  if(uiMenu && ui.home && ui.home!=="main"){ ui.home = "main"; ui.delArm = null; renderUI(); return "ok"; }
  if(ui.modal){ ui.modal = null; renderUI(); return "ok"; }
  if(game && game.pendingEvent && !uiMenu) return "ok";
  if(uiMenu && game){ uiMenu = false; renderUI(); return "ok"; }
  if(cancelAll()){ renderUI(); return "ok"; }
  persist(game, true);
  var now = Date.now();
  if(now - _backT < 2500) return "quit";
  _backT = now; flash("Touchez encore Retour pour quitter (la partie est sauvegardée).");
  renderUI();
  return "ok";
};
/* sauvegarde quand on quitte / cache l'application */
document.addEventListener("visibilitychange", function(){ if(document.hidden) persist(game, true); });
window.addEventListener("pagehide", function(){ persist(game, true); });
window.addEventListener("beforeunload", function(){ persist(game, true); });
