/* ================= RENDU PIXEL-ART =================
   Principe (pensé pour le mobile) :
   - la scène est dessinée dans un petit tampon à la résolution de l'art
     (1 pixel d'art = 1 pixel du tampon), puis agrandie d'un facteur ENTIER
     sans lissage : pixels nets, et 4 à 16 fois moins de pixels à remplir ;
   - le sol (herbe, eau, routes, lisières) est peint une fois dans un cache
     et seulement repeint là où la carte change ;
   - tous les sprites viennent d'un atlas unique (js/sprites.js).
   ==================================================== */
var RENDER = (function(){
"use strict";

var TS = 16;          // pixels d'art par tuile
var M = 6;            // marge décorative autour de la carte (en tuiles)
var BG = "#0b100a";
var P = SPR.P, hash = SPR.hash, bayer = SPR.bayer;

/* ---------- zoom par paliers entiers ---------- */
function devRatio(){ return Math.min(2, window.devicePixelRatio || 1); }
function clampScale(s, d){ return Math.max(1, Math.min(4*d, s)); }
function snapZoom(z){ var d = devRatio(); return clampScale(Math.round(z*d), d)/d; }
function stepZoom(z, dir){ var d = devRatio(); return clampScale(Math.round(z*d) + dir, d)/d; }

/* ---------- utilitaires couleur ---------- */
function rgb(hex){ var n = parseInt(hex.slice(1),16); return [(n>>16)&255, (n>>8)&255, n&255]; }
function pack(r, g, b){ return ((255<<24) | (b<<16) | (g<<8) | r) >>> 0; }
function U(hex){ var c = rgb(hex); return pack(c[0], c[1], c[2]); }
function shadeU(u, f, sat){       // assombrir / désaturer une couleur packée
  var r = u&255, g = (u>>8)&255, b = (u>>16)&255;
  if(sat !== undefined){ var l = r*0.3 + g*0.59 + b*0.11; r = r + (l-r)*sat; g = g + (l-g)*sat; b = b + (l-b)*sat; }
  return pack(Math.round(r*f), Math.round(g*f), Math.round(b*f));
}
function mixU(u, v, t){
  var r = (u&255)*(1-t) + (v&255)*t, g = ((u>>8)&255)*(1-t) + ((v>>8)&255)*t, b = ((u>>16)&255)*(1-t) + ((v>>16)&255)*t;
  return pack(Math.round(r), Math.round(g), Math.round(b));
}

/* rampes du sol par saison : 0 sombre/humide → 4 clair/sec */
var GROUND = [
  ["#a4b4c4","#bccad6","#d2dce6","#e6edf2","#f6f9fb"],   // hiver (neige)
  ["#46732f","#527f34","#5e8c3a","#6e9a42","#84aa4e"],   // printemps
  ["#3d6230","#486e33","#537a37","#62883d","#779646"],   // été
  ["#5a5a2c","#6c6830","#807836","#968a40","#ab9c4c"],   // automne
].map(function(r){ return r.map(U); });
var C_ = {};
["wa0","wa1","wa2","wa3","wa4","dt0","dt1","dt2","dt3","dt4","st1","st2","st3","st4","sn0","sn1","sn2","sn3"].forEach(function(k){ C_[k] = U(P[k]); });
var GOLD = U("#e8c35a"), GOLD_D = U("#5a4418"), BGU = U(BG);
var FLOWERS = [[], ["#e8d870","#e0a8c0","#b8a8e0","#e8d870","#f0ece0"], ["#e8d870","#d8c070"], []].map(function(a){ return a.map(U); });

/* ---------- bruit de valeur sur grilles précalculées (rapide) ---------- */
function NoiseGrid(w, h, cell, seed){
  this.cell = cell; this.gw = Math.ceil(w/cell)+2; this.gh = Math.ceil(h/cell)+2;
  this.v = new Float32Array(this.gw*this.gh);
  for(var i=0;i<this.v.length;i++) this.v[i] = hash(i % this.gw, Math.floor(i/this.gw), seed);
}
NoiseGrid.prototype.at = function(x, y){
  var fx = x/this.cell, fy = y/this.cell, xi = Math.floor(fx), yi = Math.floor(fy);
  var u = fx-xi, v = fy-yi; u = u*u*(3-2*u); v = v*v*(3-2*v);
  var gw = this.gw, i = yi*gw + xi, a = this.v[i], b = this.v[i+1], c = this.v[i+gw], d = this.v[i+gw+1];
  return a + (b-a)*u + (c-a)*v + (a-b-c+d)*u*v;
};

/* ======================================================
   CACHE DU SOL
   ====================================================== */
var T = null;

function tileAt(g, x, y){ return (x<0||y<0||x>=W||y>=H) ? -1 : g.tiles[y*W+x]; }
function isRoad(g, x, y){ return x>=0 && y>=0 && x<W && y<H && g.roads[y*W+x]; }

/* valeur d'un type de tuile (0/1), hors carte : forêt dense, ni eau ni pierre */
function tv(g, kind, x, y){
  var t = tileAt(g, x, y);
  if(t<0) return kind===T_FOREST ? 0.8 : 0;
  return t===kind ? 1 : 0;
}
/* masque lissé (bilinéaire + lissage) d'un type de tuile au pixel d'art (px, py) */
function mask(g, kind, px, py){
  var u = px/TS - 0.5, v = py/TS - 0.5, i = Math.floor(u), j = Math.floor(v);
  var fu = u-i, fv = v-j; fu = fu*fu*(3-2*fu); fv = fv*fv*(3-2*fv);
  var a = tv(g,kind,i,j), b = tv(g,kind,i+1,j), c = tv(g,kind,i,j+1), d = tv(g,kind,i+1,j+1);
  return a + (b-a)*fu + (c-a)*fv + (a-b-c+d)*fu*fv;
}
function soilAt(g, px, py){
  var u = px/TS - 0.5, v = py/TS - 0.5, i = Math.floor(u), j = Math.floor(v);
  function s(x,y){ x = Math.max(0, Math.min(W-1, x)); y = Math.max(0, Math.min(H-1, y)); return g.soil[y*W+x]; }
  var fu = u-i, fv = v-j;
  return s(i,j)*(1-fu)*(1-fv) + s(i+1,j)*fu*(1-fv) + s(i,j+1)*(1-fu)*fv + s(i+1,j+1)*fu*fv;
}
/* distance d'un pixel au réseau de routes (tuiles voisines comprises) */
function roadDist(g, px, py, tx, ty){
  var best = 99;
  for(var yy=ty-1; yy<=ty+1; yy++) for(var xx=tx-1; xx<=tx+1; xx++){
    if(!isRoad(g, xx, yy)) continue;
    var cx = xx*TS + 7.5, cy = yy*TS + 7.5;
    var d = Math.hypot(px-cx, py-cy) + 0.6;
    if(d<best) best = d;
    // demi-segments vers les voisines reliées
    if(isRoad(g, xx+1, yy) && px>=cx && px<=cx+8){ d = Math.abs(py-cy); if(d<best) best = d; }
    if(isRoad(g, xx-1, yy) && px<=cx && px>=cx-8){ d = Math.abs(py-cy); if(d<best) best = d; }
    if(isRoad(g, xx, yy+1) && py>=cy && py<=cy+8){ d = Math.abs(px-cx); if(d<best) best = d; }
    if(isRoad(g, xx, yy-1) && py<=cy && py>=cy-8){ d = Math.abs(px-cx); if(d<best) best = d; }
  }
  return best;
}

function terrainInit(g){
  var CW = (W+2*M)*TS, CH = (H+2*M)*TS;
  var c = document.createElement("canvas"); c.width = CW; c.height = CH;
  var cx = c.getContext("2d");
  var img = cx.createImageData(CW, CH);
  var seed = (g.seed|0) % 100000;
  T = {
    g:g, w:CW, h:CH, c:c, cx:cx, img:img, d:new Uint32Array(img.data.buffer),
    nA1:new NoiseGrid(CW, CH, 40, seed+1), nA2:new NoiseGrid(CW, CH, 13, seed+2), nB:new NoiseGrid(CW, CH, 4, seed+3),
    kind:new Uint8Array(W*H), season:-1, regionKey:"", tiles:new Uint8Array(W*H), roads:new Uint8Array(W*H),
    water:[], mm:document.createElement("canvas"), seed:seed,
  };
  T.mm.width = W; T.mm.height = H;
  var kn = new NoiseGrid(W, H, 5, seed+4);
  for(var y=0;y<H;y++) for(var x=0;x<W;x++){
    var n = kn.at(x, y);
    T.kind[y*W+x] = n<0.36 ? 0 : (n<0.62 ? 1 : 2);   // 0 pinède, 1 bois mêlé, 2 chênaie-boulaie
  }
}

function regionBorders(g){
  var xs = [];
  for(var x=1;x<W;x++) if(g.regionAt(x)!==g.regionAt(x-1)) xs.push(x*TS);
  return xs;
}

/* peint les tuiles [tx0..tx1]×[ty0..ty1] (coordonnées carte, marge comprise) */
/* poids d'interpolation précalculés pour les 16 pixels d'une tuile */
var IX = new Int8Array(TS), FS = new Float32Array(TS), FL = new Float32Array(TS);
for(var ii=0; ii<TS; ii++){
  var uu = ii/TS - 0.5, fl = uu<0 ? uu+1 : uu;
  IX[ii] = uu<0 ? 0 : 1; FL[ii] = fl; FS[ii] = fl*fl*(3-2*fl);
}
var NBW = new Float32Array(9), NBF = new Float32Array(9), NBS = new Float32Array(9), NBO = new Float32Array(9);
function soilT(g, x, y){ x = Math.max(0, Math.min(W-1, x)); y = Math.max(0, Math.min(H-1, y)); return g.soil[y*W+x]; }

function paintTerrain(g, tx0, ty0, tx1, ty1){
  var s = T.season, R = GROUND[s], d = T.d, CW = T.w, off = M*TS;
  var borders = regionBorders(g);
  var owned = [];
  for(var x=0;x<W;x++) owned.push(g.regionOwned(x));
  var snowGrass = U("#8a9a7c");
  for(var ty=ty0; ty<=ty1; ty++) for(var tx=tx0; tx<=tx1; tx++){
    var inMap = tx>=0 && ty>=0 && tx<W && ty<H;
    // voisinage 3×3 de la tuile : eau, forêt, pierre, fertilité
    var nearW = false, nearF = false, nearS = false, hasRoadNear = false;
    for(var k=0;k<9;k++){
      var nx = tx + (k%3) - 1, ny = ty + ((k/3)|0) - 1;
      NBW[k] = tv(g, T_WATER, nx, ny); NBF[k] = tv(g, T_FOREST, nx, ny); NBS[k] = tv(g, T_STONE, nx, ny);
      NBO[k] = soilT(g, nx, ny);
      if(NBW[k]>0) nearW = true; if(NBF[k]>0) nearF = true; if(NBS[k]>0) nearS = true;
      if(inMap && isRoad(g, nx, ny)) hasRoadNear = true;
    }
    for(var j=0;j<TS;j++){
      var cy = IX[j]*3, fv = FS[j], fvl = FL[j];
      for(var i=0;i<TS;i++){
        var px = tx*TS+i, py = ty*TS+j, ci = (py+off)*CW + (px+off);
        var cx = IX[i], fu = FS[i], k0 = cy + cx;
        var a = T.nA1.at(px+off, py+off)*0.6 + T.nA2.at(px+off, py+off)*0.4;
        var b = T.nB.at(px+off, py+off);
        var bay = bayer(px, py);
        var col, A_, B_, C2, D_;
        // --- eau ---
        var wm = 0;
        if(nearW){ A_ = NBW[k0]; B_ = NBW[k0+1]; C2 = NBW[k0+3]; D_ = NBW[k0+4];
          wm = A_ + (B_-A_)*fu + (C2-A_)*fv + (A_-B_-C2+D_)*fu*fv + (b-0.5)*0.22; }
        if(wm > 0.5){
          var up1 = mask(g, T_WATER, px, py-1) + (T.nB.at(px+off, py-1+off)-0.5)*0.22;
          var up2 = mask(g, T_WATER, px, py-2) + (T.nB.at(px+off, py-2+off)-0.5)*0.22;
          if(s===0){
            col = up1<=0.5 ? C_.sn0 : (wm>0.8 ? C_.sn1 : C_.sn2);
            if(hash(px>>1, py, 3)<0.04) col = C_.wa3;
          } else if(up1<=0.5) col = C_.dt1;               // berge vue de face
          else if(up2<=0.5) col = C_.wa0;                 // ombre de la berge sur l'eau
          else col = wm>0.85 ? C_.wa1 : (wm>0.64 ? (bay<0.5?C_.wa1:C_.wa2) : C_.wa2);
          if(T.collect && s!==0 && wm>0.72 && hash(px, py, 77)<0.006 && (!inMap || owned[tx])) T.water.push(px, py);
        } else {
          // --- sol ---
          var soil = 0.5;
          if(inMap){ A_ = NBO[k0]; B_ = NBO[k0+1]; C2 = NBO[k0+3]; D_ = NBO[k0+4]; var ful = FL[i];
            soil = A_*(1-ful)*(1-fvl) + B_*ful*(1-fvl) + C2*(1-ful)*fvl + D_*ful*fvl; }
          var t = 0.2 + a*0.66 + (0.55 - soil)*0.5 + (b-0.5)*0.06;
          var idx = Math.max(0, Math.min(4, Math.floor(t*5 + bay - 0.5)));
          var fm = 0;
          if(nearF){ A_ = NBF[k0]; B_ = NBF[k0+1]; C2 = NBF[k0+3]; D_ = NBF[k0+4];
            fm = A_ + (B_-A_)*fu + (C2-A_)*fv + (A_-B_-C2+D_)*fu*fv; }
          fm += (b-0.5)*0.3;
          if(fm > 0.45) idx = Math.max(0, idx - (fm>0.7 ? 2 : 1));
          col = R[idx];
          if(s===0 && a<0.34 && fm<0.45 && hash(px, py, 13)<0.16) col = snowGrass;     // herbe sous la neige
          // rive
          if(wm > 0.36) col = s===0 ? C_.sn2 : (bay < (wm-0.36)*7 ? C_.dt3 : C_.dt2);
          // gravier des gisements
          if(nearS){
            A_ = NBS[k0]; B_ = NBS[k0+1]; C2 = NBS[k0+3]; D_ = NBS[k0+4];
            var sm = A_ + (B_-A_)*fu + (C2-A_)*fv + (A_-B_-C2+D_)*fu*fv + (b-0.5)*0.35;
            if(sm > 0.42){
              var hh = hash(px, py, 9);
              col = s===0 ? (hh<0.25 ? C_.st2 : C_.sn1) : (hh<0.3 ? C_.st2 : hh<0.6 ? C_.st3 : (sm<0.52 ? C_.dt3 : C_.dt2));
            }
          }
          // routes
          if(hasRoadNear){
            var rd = roadDist(g, px, py, tx, ty);
            var lim = 4.6 + (a-0.5)*1.6;
            if(rd < lim){
              if(s===0) col = bay<0.55 ? C_.sn1 : C_.dt2;
              else if(rd > lim-1.1) col = C_.dt1;
              else if(Math.abs(rd-2.4)<0.55) col = C_.dt1;           // ornières
              else col = hash(px, py, 5)<0.07 ? C_.dt4 : (rd<1 ? C_.dt3 : C_.dt2);
            }
          }
        }
        // --- région non réclamée : terre assombrie ---
        if(inMap && !owned[tx]) col = shadeU(col, 0.68, 0.45);
        // --- hors carte : lisière qui s'enfonce dans l'ombre ---
        if(!inMap){
          var dx = Math.max(0, -px, px-(W*TS-1)), dy = Math.max(0, -py, py-(H*TS-1));
          var dist = Math.sqrt(dx*dx + dy*dy);
          col = mixU(shadeU(col, 0.8, 0.3), BGU, Math.min(0.92, 0.38 + dist/(M*TS*0.75)));
        }
        d[ci] = col;
      }
    }
    if(inMap) decorateTile(g, tx, ty);
  }
  // frontières de régions : pointillé doré
  for(var kb=0; kb<borders.length; kb++){
    var bxp = borders[kb];
    if(owned[bxp/TS] && owned[bxp/TS-1]) continue;          // frontière effacée entre deux terres possédées
    if(bxp < tx0*TS-1 || bxp > (tx1+1)*TS) continue;
    for(var py2=Math.max(0, ty0*TS); py2<Math.min(H*TS, (ty1+1)*TS); py2++){
      if(((py2>>2)&1)===0) continue;
      d[(py2+off)*CW + bxp-1+off] = GOLD; d[(py2+off)*CW + bxp+off] = GOLD_D;
    }
  }
}

/* petits détails du sol : touffes, fleurs, cailloux, feuilles mortes */
function decorateTile(g, tx, ty){
  var s = T.season, i = ty*W+tx, t = g.tiles[i];
  if(t===T_WATER || t===T_STONE || g.roads[i]) return;
  var d = T.d, CW = T.w, off = M*TS, R = GROUND[s];
  function put(x, y, c){ if(x<0||y<0||x>15||y>15) return; d[(ty*TS+y+off)*CW + tx*TS+x+off] = c; }
  var owned = g.regionOwned(tx);
  function fix(c){ return owned ? c : shadeU(c, 0.68, 0.45); }
  var n = 2 + Math.floor(hash(tx, ty, 1)*3);
  for(var k=0;k<n;k++){
    var x = 1 + Math.floor(hash(tx, ty, 10+k)*13), y = 2 + Math.floor(hash(tx, ty, 20+k)*12);
    if(s===0){ if(hash(tx,ty,30+k)<0.4) put(x, y, fix(U("#6f7f60"))); continue; }
    var base = d[(ty*TS+y+off)*CW + tx*TS+x+off];
    var dk = mixU(base, R[0], 0.55), lt = mixU(base, R[4], 0.45);
    put(x, y, dk); put(x+2, y, dk); put(x, y-1, lt); put(x+2, y-1, lt); put(x+1, y-1, dk);
  }
  var fl = FLOWERS[s];
  var meadow = T.nA1.at(tx*TS+8+off, ty*TS+8+off);           // fleurs groupées en prairies
  if(fl.length && t===T_GRASS && meadow > 0.64){
    var fh = hash(tx,ty,2);
    var nf = s===1 ? (fh<0.3 ? 2 : 1) : (fh<0.4 ? 1 : 0);
    for(var f=0; f<nf; f++){
      var fx = 1 + Math.floor(hash(tx,ty,40+f)*14), fy = 1 + Math.floor(hash(tx,ty,50+f)*14);
      put(fx, fy, fix(fl[Math.floor(hash(tx,ty,60+f)*fl.length)]));
    }
  }
  if(s===3 && t===T_FOREST){
    for(var l=0;l<5;l++) put(Math.floor(hash(tx,ty,70+l)*16), Math.floor(hash(tx,ty,80+l)*16), fix(U(l&1 ? "#c2702e" : "#9a3a1e")));
  }
  if(hash(tx, ty, 90)<0.12 && s!==0) put(Math.floor(hash(tx,ty,91)*15), Math.floor(hash(tx,ty,92)*15), fix(mixU(C_.st3, R[2], 0.4)));
}

/* arbres décoratifs cuits dans la marge */
function paintMarginTrees(){
  var d = T.d, CW = T.w, CH = T.h, off = M*TS, s = T.season;
  for(var ty=-M; ty<H+M; ty++) for(var tx=-M; tx<W+M; tx++){
    if(tx>=0 && ty>=0 && tx<W && ty<H) continue;
    if(ty===H) continue;                       // ne pas déborder sur la carte
    if(hash(tx, ty, 123) > 0.62) continue;
    var kinds = ["pine_"+s+"_0","oak_"+s+"_0","birch_"+s+"_1","pine_"+s+"_1","oak_"+s+"_2"];
    var spr = SPR.keep[kinds[Math.floor(hash(tx,ty,124)*kinds.length)]];
    if(!spr) continue;
    var bx = tx*TS + 3 + Math.floor(hash(tx,ty,125)*10) - spr.ax + off;
    var by = ty*TS + 10 + Math.floor(hash(tx,ty,126)*6) - spr.ay + off;
    var ddx = Math.max(0, -tx, tx-(W-1)), ddy = Math.max(0, -ty, ty-(H-1));
    var dark = Math.min(0.9, 0.42 + Math.sqrt(ddx*ddx+ddy*ddy)/(M*0.75));
    for(var y=0;y<spr.h;y++) for(var x=0;x<spr.w;x++){
      var c = spr.d[y*spr.w+x]; if(!c) continue;
      var X = bx+x, Y = by+y;
      if(X<0||Y<0||X>=CW||Y>=CH) continue;
      if(X>=off && X<off+W*TS && Y>=off && Y<off+H*TS) continue;   // jamais sur la carte
      d[Y*CW+X] = mixU(c, BGU, dark);
    }
  }
}

function paintMinimap(){
  var mx = T.mm.getContext("2d"), id = mx.createImageData(W, H), md = new Uint32Array(id.data.buffer);
  var off = M*TS, CW = T.w;
  for(var y=0;y<H;y++) for(var x=0;x<W;x++){
    var c = T.d[(y*TS+8+off)*CW + x*TS+8+off];
    var t = T.g.tiles[y*W+x];
    if(t===T_FOREST) c = shadeU(c, 0.62);
    else if(t===T_BERRY) c = mixU(c, U("#8a3a5a"), 0.35);
    else if(t===T_STONE) c = U(P.st3);
    if(T.g.roads[y*W+x]) c = U("#c9b088");
    md[y*W+x] = c;
  }
  mx.putImageData(id, 0, 0);
}

/* (re)construit ou met à jour le cache du sol.
   Un changement de saison (ou de région) est repeint par bandes, sur plusieurs
   images, dans l'image mémoire : l'ancien sol reste affiché jusqu'à la fin. */
function finishFullPaint(){
  paintMarginTrees();
  T.cx.putImageData(T.img, 0, 0);
  paintMinimap();
}
function updateTerrain(g){
  var first = !T || T.g!==g;
  if(first) terrainInit(g);
  var season = g.season();
  var rk = g.regions.map(function(r){ return r.owned ? 1 : 0; }).join("");
  if(first){
    T.season = season; T.regionKey = rk; T.collect = true;
    var t0 = performance.now();
    paintTerrain(g, -M, -M, W+M-1, H+M-1);
    T.collect = false;
    T.tiles.set(g.tiles); T.roads.set(g.roads);
    finishFullPaint();
    T.paintMs = Math.round(performance.now() - t0);
    return;
  }
  if(!T.job && (season!==T.season || rk!==T.regionKey)){
    T.season = season; T.regionKey = rk; T.water = [];
    T.tiles.set(g.tiles); T.roads.set(g.roads);   // les changements survenus pendant le repeint seront repris ensuite
    T.job = { row:-M, ms:0 };
  }
  if(T.job){
    var t1 = performance.now();
    T.collect = true;
    while(T.job.row < H+M && performance.now() - t1 < 5){
      paintTerrain(g, -M, T.job.row, W+M-1, T.job.row);
      T.job.row++;
    }
    T.collect = false;
    T.job.ms += performance.now() - t1;
    if(T.job.row >= H+M){ finishFullPaint(); T.paintMs = Math.round(T.job.ms); T.job = null; }
    return;
  }
  // changements locaux (arbres abattus, routes...)
  var x0 = W, y0 = H, x1 = -1, y1 = -1;
  for(var i=0;i<W*H;i++){
    if(T.tiles[i]!==g.tiles[i] || T.roads[i]!==g.roads[i]){
      var x = i % W, y = (i/W)|0;
      if(x<x0) x0 = x; if(y<y0) y0 = y; if(x>x1) x1 = x; if(y>y1) y1 = y;
    }
  }
  if(x1<0) return;
  T.tiles.set(g.tiles); T.roads.set(g.roads);
  x0 = Math.max(0, x0-1); y0 = Math.max(0, y0-1); x1 = Math.min(W-1, x1+1); y1 = Math.min(H-1, y1+1);
  paintTerrain(g, x0, y0, x1, y1);
  var off = M*TS;
  T.cx.putImageData(T.img, 0, 0, x0*TS+off, y0*TS+off, (x1-x0+1)*TS, (y1-y0+1)*TS);
  paintMinimap();
}

/* ======================================================
   TAMPON BASSE RÉSOLUTION
   ====================================================== */
var buf = null, bx = null, shc = null, shx = null;
function ensureBuf(w, h){
  if(!buf){
    buf = document.createElement("canvas"); bx = buf.getContext("2d");
    shc = document.createElement("canvas"); shx = shc.getContext("2d");
  }
  if(buf.width!==w || buf.height!==h){ buf.width = w; buf.height = h; shc.width = w; shc.height = h; }
  bx.imageSmoothingEnabled = false; shx.imageSmoothingEnabled = false;
}

/* ======================================================
   SCÈNE
   ====================================================== */
var OX = 0, OY = 0;                 // origine du tampon en pixels d'art (monde)
function spr(name, x, y){ return SPR.draw(bx, name, x - OX, y - OY); }
function sh(name, x, y){ SPR.draw(shx, name, x - OX, y - OY); }
function rect(x, y, w, h, c){ bx.fillStyle = c; bx.fillRect(Math.round(x - OX), Math.round(y - OY), w, h); }

var mem = new Map();               // mémoire visuelle par entité (direction, mouvement)
function track(key, x, y, now){
  var m = mem.get(key);
  if(!m){ m = { x:x, y:y, dir:1, mt:-1e9, seen:now }; mem.set(key, m); }
  var dx = x - m.x, dy = y - m.y;
  if(Math.abs(dx) > 0.002) m.dir = dx>0 ? 1 : -1;
  if(Math.abs(dx) + Math.abs(dy) > 0.002) m.mt = now;
  m.x = x; m.y = y; m.seen = now;
  return m;
}

var TOOL_OF = { chop:"axe", mine:"pick", build:"hammer", plow:"hoe", harvest:"sickle", gather:"basket", hunt:"bow" };
var JOBSET = {}; SPR.JOBS.forEach(function(j){ JOBSET[j] = true; });
var WALKING = { walk:1, return:1, settle:1, wander:1 };

/* ---- objets triés en profondeur ---- */
var objs = [], nObj = 0;
function obj(k, fn, a, b, c){
  var o = objs[nObj] || (objs[nObj] = {});
  o.k = k; o.fn = fn; o.a = a; o.b = b; o.c = c; nObj++;
}

function drawTree(name, x, y){ spr(name, x, y); }

function fieldStage(f){
  if(!f.sown) return 0;
  var gr = f.growth;
  return gr<0.08 ? 1 : gr<0.25 ? 2 : gr<0.45 ? 3 : gr<0.65 ? 4 : gr<0.85 ? 5 : 6;
}

function drawField(g, b, season){
  var f = b.f; if(!f) return;
  var n = b.w*b.h, plowed = Math.floor((f.plow||0)*n + 0.0001), harvested = Math.floor((f.harvestP||0)*n);
  var stage = fieldStage(f);
  var x0 = b.x*TS, y0 = b.y*TS;
  for(var k=0;k<n;k++){
    var tx = k % b.w, ty = (k / b.w)|0, v = (b.x+tx+b.y+ty)&1;
    var px = x0 + tx*TS, py = y0 + ty*TS, name = null;
    if(season===0) name = "field_snow_"+v;
    else if(f.crop==="fallow") name = (f.sown || f.plow>0 || f.usedLastYear) ? "field_fallow_"+v : "field_fallow_"+v;
    else if(f.sown){
      if(k < harvested) name = "field_stub_"+v;
      else if(stage<=1) name = "field_sown_"+v;
      else name = "field_"+(f.crop==="barley"?"barley":"wheat")+"_"+stage+"_"+v;
    }
    else if(k < plowed) name = "field_plow_"+v;
    else if(f.usedThisYear && g.time.month>=8) name = "field_stub_"+v;
    if(name) spr(name, px, py + TS);
  }
  // bordure : talus et piquets
  var w = b.w*TS, h = b.h*TS;
  bx.fillStyle = season===0 ? "#8a98a8" : "#4a3624";
  bx.fillRect(x0-OX, y0-OY, w, 1); bx.fillRect(x0-OX, y0+h-1-OY, w, 1);
  bx.fillRect(x0-OX, y0-OY, 1, h); bx.fillRect(x0+w-1-OX, y0-OY, 1, h);
  bx.fillStyle = "#6b4a30";
  for(var px2=0; px2<=w-1; px2+=6){ bx.fillRect(x0+px2-OX, y0-1-OY, 1, 2); bx.fillRect(x0+px2-OX, y0+h-2-OY, 1, 2); }
}

function wallMask(g, b, byId){
  var m = 0;
  function isW(x, y){
    if(x<0||y<0||x>=W||y>=H) return false;
    var id = g.occupied[y*W+x]; if(id<0) return false;
    var o = byId[id]; return !!o && (o.def==="wall" || o.def==="tower");
  }
  if(isW(b.x, b.y-1)) m |= 1; if(isW(b.x+1, b.y)) m |= 2; if(isW(b.x, b.y+1)) m |= 4; if(isW(b.x-1, b.y)) m |= 8;
  return m;
}

function buildingSprite(g, b, winter, byId){
  var w = winter ? "_w" : "";
  switch(b.def){
    case "burgage":
      var lv = Math.max(1, Math.min(3, b.lvl||1));
      return "burgage"+lv+"_"+(lv===3 ? b.id%2 : b.id%3)+w;
    case "market": return "market_"+((b.families && b.families.length>0) ? 1 : 0)+w;
    case "church":
      var cu = b.churchUp || [];
      return "church_"+(cu.indexOf("bell")>=0 ? 1 : 0)+(cu.indexOf("altar")>=0 ? 1 : 0)+w;
    case "wall": return "wall_"+wallMask(g, b, byId)+w;
    case "field": return null;
    default: return b.def + w;
  }
}
var TALL = { tower:1, windmill:1, manor:1 };

function drawBuilding(g, b, info){
  var name = info.name, bxp = b.x*TS, byp = (b.y+b.h)*TS;
  if(!b.done){ drawSite(b, name); return; }
  spr(name, bxp, byp);
  if(b.def==="windmill"){
    var f = SPR.frames[name];
    var hubX = bxp - f.ax + 17.5, hubY = byp - f.ay + 9.5;
    var turning = b.families && b.families.length>0;
    var fr = turning ? Math.floor(info.now/110) % 8 : 0;
    spr("sails_"+fr, hubX - 19.5, hubY - 19.5);
  }
  if(b.def==="burgage" && !b.plot) drawExtensionsFront(g, b, info);
}

/* étape 3 : chantier en quatre étapes (fondations, charpente, murs, toit) */
var STONE_A = "#d4cec0", STONE_B = "#9a9384", STONE_D = "#4a443b", WOOD_A = "#b07a44", WOOD_B = "#5e3b1f";
function drawSite(b, name){
  var fr = SPR.frames[name], bxp = b.x*TS, byp = (b.y+b.h)*TS, fw = b.w*TS;
  var st = buildStage(b), loc = Math.max(0, Math.min(1, (b.progress||0)*BUILD_STAGES.length - st));
  bx.globalAlpha = 0.18; spr(name, bxp, byp); bx.globalAlpha = 1; // silhouette du bâtiment final
  // fondations : pierres posées une à une sur le pourtour de l'emprise
  var x0 = bxp+2, x1 = bxp+fw-4, y0 = byp-b.h*TS+6, y1 = byp-4, pts = [], k;
  for(k=x0; k<x1; k+=3) pts.push([k, y1]);
  for(k=y1; k>y0; k-=3) pts.push([x1, k]);
  for(k=x1; k>x0; k-=3) pts.push([k, y0]);
  for(k=y0; k<y1; k+=3) pts.push([x0, k]);
  var n = st===0 ? Math.max(1, Math.round(pts.length*(0.15+0.85*loc))) : pts.length;
  for(k=0; k<n; k++){ rect(pts[k][0], pts[k][1]+2, 3, 1, STONE_D); rect(pts[k][0], pts[k][1], 3, 2, (k&1) ? STONE_B : STONE_A); }
  // charpente : poteaux qui montent, sablière, puis chevrons
  var ph = Math.max(10, Math.round((fr.ay-2)*0.7));
  if(st>=1){
    var grow = st===1 ? 0.35+0.65*loc : 1, hh = Math.round(ph*grow);
    for(k=x0; k<=x1; k+=Math.max(5, Math.round((x1-x0)/Math.max(2, b.w*2)))) { rect(k, y1-hh, 2, hh, WOOD_A); rect(k+2, y1-hh, 1, hh, WOOD_B); }
    rect(x1, y1-hh, 2, hh, WOOD_B);
    if(st>1 || loc>0.55){
      rect(x0, y1-ph, x1-x0+2, 2, WOOD_A);
      if(st>1 || loc>0.8){
        var rh = Math.round((x1-x0)/2.4), mid = (x0+x1+2)/2;
        for(k=0; k<rh; k++){ var dx = Math.round((x1-x0)/2*(1-k/rh)); rect(Math.round(mid-dx), y1-ph-k, 1, 1, WOOD_B); rect(Math.round(mid+dx)-1, y1-ph-k, 1, 1, WOOD_B); }
      }
    }
  }
  // murs puis toit : le vrai bâtiment se révèle depuis le bas
  if(st===2) SPR.drawBottom(bx, name, bxp - OX, byp - OY, 0.12 + 0.48*loc);
  if(st===3) SPR.drawBottom(bx, name, bxp - OX, byp - OY, 0.6 + 0.4*loc);
  if(st>=2) spr("scaffold_"+(b.w>1 ? 2 : 1), bxp, byp);
  if(st<3) spr("materials", bxp - 3, byp + 2);
  var bw = fw - 4, top = byp - fr.ay - 3;
  rect(bxp+2, top, bw, 2, "#1a140e");
  rect(bxp+2, top, Math.max(1, Math.round(bw*(b.progress||0))), 2, "#7bd88f");
}

/* étape 3 : parcelle (cour teintée, potager, clôture) */
function cellX(i){ return (i%W)*TS; }
function cellY(i){ return Math.floor(i/W)*TS; }
function drawFences(fe, a, rail, post){
  bx.globalAlpha = a;
  for(var k=0; k<fe.edges.length; k++){
    var e = fe.edges[k], x = cellX(e.i), y = cellY(e.i), p;
    if(e.d===0 || e.d===2){
      var yy = e.d===0 ? y+1 : y+TS-2;
      rect(x, yy, TS, 1, rail);
      for(p=x+(e.d===0?0:2); p<x+TS; p+=5) rect(p, yy-2, 1, 4, post);
    } else {
      var xx = e.d===3 ? x+1 : x+TS-2;
      rect(xx, y, 1, TS, rail);
      for(p=y+2; p<y+TS; p+=5) rect(xx-1, p, 3, 2, post);
    }
  }
  bx.globalAlpha = 1;
}
function drawPlotGround(g, b, season, winter){
  var cells = b.plot.cells, ea = b.plot.extAt || {};
  bx.fillStyle = winter ? "rgba(255,255,255,0.10)" : "rgba(70,96,34,0.18)";
  for(var k=1; k<cells.length; k++) bx.fillRect(cellX(cells[k])-OX, cellY(cells[k])-OY, TS, TS);
  if(b.done && ea.garden!==undefined) spr("veg_"+season, cellX(ea.garden)+8, cellY(ea.garden)+12);
  drawFences(g.plotFences(b), b.done ? 1 : 0.4, WOOD_A, WOOD_B);
}
/* agrandissements posés sur leur case de cour */
function drawYard(B, season, winter, t, now){
  var ea = B.plot.extAt || {}, i, x, y;
  if((i = ea.orchard)!==undefined){ x = cellX(i)+8; y = cellY(i)+13; sh("sh_sap", x, y); obj(y, drawSprite, "fruit_"+season, x, y); }
  if((i = ea.beehive)!==undefined){ x = cellX(i)+5; y = cellY(i)+12; obj(y, drawSprite, "skep", x, y); }
  if((i = ea.brewer)!==undefined){ x = cellX(i)+5; y = cellY(i)+12; obj(y, drawSprite, "barrel", x, y); }
  if((i = ea.tailor)!==undefined){ x = cellX(i)+3; y = cellY(i)+11; obj(y, drawSprite, "cloth", x, y); }
  if((i = ea.chicken)!==undefined && !winter){
    for(var c=0;c<2;c++){
      var ph = t*0.7 + B.id + c*2;
      var cx2 = cellX(i) + 4 + c*5 + Math.round(Math.sin(ph)*2), cy2 = cellY(i) + 9 + c*3;
      var pk = (Math.floor(now/400) + c + B.id) % 3 === 0 ? 1 : 0;
      obj(cy2, drawSprite, "chick_"+(c&1)+"_"+pk+((Math.sin(ph+0.2) - Math.sin(ph))<0 ? "_l" : ""), cx2, cy2);
    }
  }
}

/* étape 3 : aperçu du tracé de zone et des cases libres de cour (fourni par app.js) */
var OV = null;
var PLOT_TINTS = ["rgba(90,224,110,0.30)", "rgba(110,190,255,0.30)"];
function drawOverlay(g, now){
  var k, j;
  if(OV.rect){
    var r = OV.rect;
    bx.fillStyle = "rgba(255,240,200,0.10)";
    bx.fillRect(r.x0*TS-OX, r.y0*TS-OY, (r.x1-r.x0+1)*TS, (r.y1-r.y0+1)*TS);
    corners(r.x0*TS, r.y0*TS, (r.x1-r.x0+1)*TS, (r.y1-r.y0+1)*TS, OV.err ? "#e05a3a" : "#f2e6c8");
  }
  var plots = OV.plots || [];
  for(k=0; k<plots.length; k++){
    var p = plots[k];
    bx.fillStyle = PLOT_TINTS[k&1];
    for(j=0; j<p.cells.length; j++) bx.fillRect(cellX(p.cells[j])-OX, cellY(p.cells[j])-OY, TS, TS);
    drawFences(g.plotFences({ plot:p }), 0.9, "#f2e6c8", "#c9a45a");
  }
  for(k=0; k<plots.length; k++){
    var h = plots[k].cells[0];
    bx.globalAlpha = 0.7; spr("burgage1_"+(k%3), cellX(h), cellY(h)+TS); bx.globalAlpha = 1;
  }
  if(OV.free){
    var pulse = 0.22 + 0.14*Math.sin(now/220);
    for(k=0; k<OV.free.length; k++){
      var fi = OV.free[k];
      bx.fillStyle = "rgba(90,224,110,"+pulse.toFixed(3)+")";
      bx.fillRect(cellX(fi)-OX, cellY(fi)-OY, TS, TS);
      corners(cellX(fi), cellY(fi), TS, TS, "#5ae06e");
    }
  }
}

/* accessoires de cour devant / autour de la maison */
function drawExtensionsFront(g, b, info){
  var ex = b.exts || [];
  var x = b.x*TS, y = (b.y+1)*TS;
  if(ex.indexOf("beehive")>=0) spr("skep", x+2, y+1);
  if(ex.indexOf("brewer")>=0) spr("barrel", x+14, y+1);
  if(ex.indexOf("tailor")>=0) spr("cloth", x+1, y-2);
}

function personSprite(f, job, body, dir){ return "p_"+(f.id % 6)+"_"+job+"_"+body+(dir<0 ? "_l" : ""); }

function drawFamily(g, f, info){
  var m = info.m, now = info.now, dir = m.dir, sfx = dir<0 ? "_l" : "";
  var x = f.x*TS, y = f.y*TS;
  var walking = WALKING[f.state] && (now - m.mt) < 300;
  var body = "idle", tool = null, up = false;
  if(walking){
    body = ["walkA","idle","walkB","idle"][(Math.floor(now/130) + f.id) % 4];
  } else if(f.state==="work" && f.task && TOOL_OF[f.task.type]){
    tool = TOOL_OF[f.task.type];
    up = (Math.floor(now/300) + f.id) % 2 === 0;
    body = up ? "workU" : "workD";
    if(tool==="basket" || tool==="bow") body = "idle";
  }
  if(f.carry && walking){
    var ck = f.carry.timber ? "timber" : f.carry.berries ? "berries" : f.carry.meat ? "meat" : f.carry.stone ? "stone" : "sack";
    spr("carry_"+ck+sfx, x, y);
  }
  spr(personSprite(f, info.job, body, dir), x, y);
  if(tool) spr("tool_"+tool+"_"+(up ? "u" : "d")+sfx, x, y);
}

function drawDeer(g, d, info){
  var m = info.m, now = info.now, sfx = m.dir<0 ? "_l" : "";
  var moving = (now - m.mt) < 300;
  var fr = moving ? 1 + (Math.floor(now/160) + d.id) % 2 : ((hash(d.id, Math.floor(now/2600), 7) < 0.5) ? 3 : 0);
  spr("deer_"+(d.id%3===0 ? 1 : 0)+"_"+fr+sfx, d.x*TS, d.y*TS);
}

function drawUnit(g, u, info){
  var m = info.m, now = info.now, sfx = m.dir<0 ? "_l" : "";
  var moving = (now - m.mt) < 300;
  var fr = u.state==="attack" && !moving ? ((Math.floor(now/260) + u.id) % 2 ? 2 : 0) : (moving ? (Math.floor(now/180) + u.id) % 2 : 0);
  var x = u.x*TS, y = u.y*TS;
  spr("sol_"+(u.merc ? "merc" : "militia")+"_"+fr+sfx, x, y);
  if(u.hp < u.maxHp){
    rect(x-4, y-21, 8, 1, "#1a140e");
    rect(x-4, y-21, Math.max(1, Math.round(8*u.hp/u.maxHp)), 1, "#7bd88f");
  }
}

function drawCamp(g, c, info){
  var x = c.x*TS, y = c.y*TS + 4;
  spr("camp"+(info.winter ? "_w" : ""), x, y);
  spr("fire_"+(Math.floor(info.now/140) + c.id) % 3, x - 1, y);
  rect(x-10, y-22, 20, 2, "#1a140e");
  rect(x-10, y-22, Math.max(1, Math.round(20*Math.max(0, c.hp/c.maxHp))), 2, "#e05a3a");
}

function drawSprite(name, x, y){ spr(name, x, y); }

/* ---- fumées et drapeaux ---- */
var SMOKE_AT = {
  burgage1:[[11,2]], burgage2:[[9,1]], burgage3:[[13.5,0]], manor:[[6.5,5],[24.5,6]], forager:[[8,1]],
};
function smokeFrom(x, y, t, seed, strength){
  for(var k=0;k<4;k++){
    var ph = (t*0.33 + k/4 + hash(seed, k, 3)) % 1;
    var px = x + Math.sin(t*1.3 + k + seed)*1.2 + ph*5, py = y - ph*16;
    bx.globalAlpha = (0.7 - ph*0.65) * strength;
    SPR.draw(bx, ph<0.35 ? "smoke_0" : "smoke_1", px - OX, py - OY);
  }
  bx.globalAlpha = 1;
}

/* ---- météo ---- */
function weather(g, t, bw, bh){
  if(g.weather==="rain"){
    bx.fillStyle = "rgba(170,200,232,0.55)";
    var n = Math.floor(bw*bh/260);
    for(var i=0;i<n;i++){
      var x = ((hash(i,1,5)*(bw+60)) - t*38) % (bw+60); if(x<0) x += bw+60;
      var y = ((hash(i,2,5)*(bh+60)) + t*170) % (bh+60);
      bx.fillRect(Math.floor(x)-30, Math.floor(y)-30, 1, 2);
      bx.fillRect(Math.floor(x)-31, Math.floor(y)-28, 1, 2);
    }
  } else if(g.weather==="snow"){
    var n2 = Math.floor(bw*bh/420);
    for(var j=0;j<n2;j++){
      var sx = (hash(j,3,5)*(bw+20) + Math.sin(t*0.8 + j)*6 - t*4) % (bw+20); if(sx<0) sx += bw+20;
      var sy = (hash(j,4,5)*(bh+20) + t*(14 + hash(j,6,5)*10)) % (bh+20);
      bx.fillStyle = j%5===0 ? "rgba(255,255,255,0.95)" : "rgba(240,246,252,0.8)";
      var sz = j%7===0 ? 2 : 1;
      bx.fillRect(Math.floor(sx)-10, Math.floor(sy)-10, sz, sz);
    }
  } else if(g.weather==="fog"){
    bx.fillStyle = "rgba(214,220,228,0.22)"; bx.fillRect(0, 0, bw, bh);
    bx.fillStyle = "rgba(226,231,238,0.16)";
    for(var k=0;k<7;k++){
      var fy = Math.floor((hash(k,8,5)*bh*1.2 + t*1.5) % (bh+40)) - 20;
      var fx = Math.floor(((hash(k,9,5)*bw*1.5) + t*(4+k)) % (bw+160)) - 80;
      for(var r=0;r<14;r++){ var hw = Math.round(Math.sin(r/13*Math.PI)*60); bx.fillRect(fx-hw, fy+r, hw*2+40, 1); }
    }
  }
}

/* ---- étincelles sur l'eau ---- */
function waterGlints(t, x0, y0, x1, y1){
  var w = T.water;
  bx.fillStyle = "rgba(207,232,242,0.75)";
  for(var i=0;i<w.length;i+=2){
    var px = w[i], py = w[i+1];
    if(px<x0 || px>x1 || py<y0 || py>y1) continue;
    var ph = (t*0.45 + hash(px, py, 4)*7) % 3;
    if(ph < 0.6) bx.fillRect(px-OX - (ph<0.3 ? 0 : 1), py-OY, ph<0.3 ? 2 : 3, 1);
  }
}

/* ---- contour de sélection, cercle de rayon ---- */
function corners(x, y, w, h, c){
  bx.fillStyle = c;
  var X = Math.round(x-OX), Y = Math.round(y-OY);
  [[X,Y,1,1],[X+w-1,Y,-1,1],[X,Y+h-1,1,-1],[X+w-1,Y+h-1,-1,-1]].forEach(function(q){
    bx.fillRect(q[2]>0 ? q[0] : q[0]-2, q[1], 3, 1);
    bx.fillRect(q[0], q[3]>0 ? q[1] : q[1]-2, 1, 3);
  });
}
function dottedCircle(cx, cy, r, c){
  bx.fillStyle = c;
  var n = Math.max(24, Math.floor(r*2*Math.PI/3));
  for(var i=0;i<n;i++){
    var a = i/n*Math.PI*2;
    bx.fillRect(Math.round(cx + Math.cos(a)*r - OX), Math.round(cy + Math.sin(a)*r - OY), 1, 1);
  }
}

/* ======================================================
   IMAGE PRINCIPALE
   ====================================================== */
function drawGame(ctx, g, cam, canvas, hover, buildSel, selId, layers, now){
  SPR.build();
  updateTerrain(g);
  var cw = canvas.width, ch = canvas.height;
  var dpr = cw/(canvas.clientWidth||1);
  var S = clampScale(Math.round(cam.zoom*dpr), Math.max(1, Math.round(dpr)));
  var bw = Math.ceil(cw/S) + 2, bh = Math.ceil(ch/S) + 2;
  ensureBuf(bw, bh);
  var vx = cam.x*TS - cw/S/2, vy = cam.y*TS - ch/S/2;
  OX = Math.floor(vx); OY = Math.floor(vy);
  var fx = vx - OX, fy = vy - OY;
  var t = now/1000, season = g.season(), winter = season===0;

  /* sol */
  bx.globalCompositeOperation = "source-over"; bx.globalAlpha = 1;
  bx.fillStyle = BG; bx.fillRect(0, 0, bw, bh);
  var sx = OX + M*TS, sy = OY + M*TS, dx = 0, dy = 0, w = bw, h = bh;
  if(sx<0){ dx = -sx; w += sx; sx = 0; } if(sy<0){ dy = -sy; h += sy; sy = 0; }
  w = Math.min(w, T.w - sx); h = Math.min(h, T.h - sy);
  if(w>0 && h>0) bx.drawImage(T.c, sx, sy, w, h, dx, dy, w, h);

  var tx0 = Math.max(0, Math.floor(OX/TS)-2), tx1 = Math.min(W-1, Math.floor((OX+bw)/TS)+2);
  var ty0 = Math.max(0, Math.floor(OY/TS)-1), ty1 = Math.min(H-1, Math.floor((OY+bh)/TS)+3);
  var vx0 = OX - 48, vx1 = OX + bw + 48, vy0 = OY - 8, vy1 = OY + bh + 64;
  if(!winter) waterGlints(t, OX, OY, OX+bw, OY+bh);

  var byId = {};
  for(var i=0;i<g.buildings.length;i++) byId[g.buildings[i].id] = g.buildings[i];

  /* décors au sol : champs, places, chantiers, potagers */
  for(var bi=0; bi<g.buildings.length; bi++){
    var b = g.buildings[bi];
    var bx0 = b.x*TS, by0 = b.y*TS, bx1 = bx0 + b.w*TS, by1 = by0 + b.h*TS;
    if(b.plot && bx1 > OX-80 && bx0 < OX+bw+80 && by1 > OY-80 && by0 < OY+bh+80) drawPlotGround(g, b, season, winter);
    if(bx1 < OX-16 || bx0 > OX+bw+16 || by1 < OY-16 || by0 > OY+bh+16) continue;
    if(b.def==="field"){ drawField(g, b, season); continue; }
    if(!b.done || b.def==="market" || b.def==="trade" || b.def==="farm"){
      var tile = (b.def==="market" && b.done) ? "cobble_" : "dirt_";
      for(var yy=0; yy<b.h; yy++) for(var xx=0; xx<b.w; xx++){
        if(b.def==="farm" && b.done && yy===0) continue;
        if(winter && b.done) continue;
        spr(tile+((xx+yy+b.id)&1), bx0+xx*TS, by0+(yy+1)*TS);
      }
    }
    if(b.def==="burgage" && b.done && !b.plot && b.exts && b.exts.indexOf("garden")>=0) spr("veg_"+season, bx0+8, by1+4);
  }

  /* grille en mode construction */
  if(buildSel){
    bx.fillStyle = "rgba(20,16,12,0.16)";
    for(var gx=tx0; gx<=tx1+1; gx++) bx.fillRect(gx*TS-OX, ty0*TS-OY, 1, (ty1-ty0+1)*TS);
    for(var gy=ty0; gy<=ty1+1; gy++) bx.fillRect(tx0*TS-OX, gy*TS-OY, (tx1-tx0+1)*TS, 1);
  }

  /* collecte des objets (arbres, rochers, bâtiments, êtres) + ombres */
  nObj = 0;
  shx.clearRect(0, 0, bw, bh);
  var bs = g.berrySeason();
  for(var ty=ty0; ty<=ty1; ty++) for(var tx=tx0; tx<=tx1; tx++){
    var ti = ty*W+tx, tt = g.tiles[ti];
    if(tt===T_FOREST){
      var wood = g.treeWood[ti], kind = T.kind[ti];
      var cnt = wood>6 ? 3 : wood>3 ? 2 : 1;
      var spots = [[4,7],[12,10],[7,15]];
      for(var k=0;k<cnt;k++){
        var px = tx*TS + spots[k][0] + Math.floor(hash(tx,ty,k)*4) - 2, py = ty*TS + spots[k][1] + Math.floor(hash(tx,ty,k+5)*3);
        var r = hash(tx, ty, k+11), nm, shn = "sh_tree";
        var young = wood<=2 && k===0;
        if(young){ nm = "sap_"+season+"_"+(kind===0 ? 1 : 0); shn = "sh_sap"; }
        else if(kind===0 ? r<0.8 : kind===1 ? r<0.4 : r<0.08){ nm = "pine_"+season+"_"+(r<0.3?1:0); shn = "sh_pine"; }
        else if(kind===2 ? r<0.45 : r<0.6){ nm = "birch_"+season+"_"+(hash(tx,ty,k+3)<0.5?0:1); shn = "sh_pine"; }
        else nm = "oak_"+season+"_"+Math.floor(hash(tx,ty,k+7)*3);
        sh(shn, px, py);
        obj(py, drawTree, nm, px, py);
      }
      if(wood<=2){ var spx = tx*TS+12, spy = ty*TS+13; obj(spy, drawSprite, "stump", spx, spy); }
    } else if(tt===T_BERRY){
      var amt = g.berryY[ti], lvl = (!bs || season===0) ? 0 : amt>5 ? 3 : amt>3 ? 2 : amt>0.5 ? 1 : 0;
      for(var k2=0;k2<2;k2++){
        var bpx = tx*TS + 4 + k2*8 + Math.floor(hash(tx,ty,k2+20)*3), bpy = ty*TS + 6 + k2*6 + Math.floor(hash(tx,ty,k2+21)*3);
        sh("sh_bush", bpx, bpy);
        obj(bpy, drawSprite, "bush_"+season+"_"+((tx+ty+k2)&1)+"_"+lvl, bpx, bpy);
      }
    } else if(tt===T_STONE && g.occupied[ti]<0){
      var sa = g.stoneAmt[ti], size = sa>170 ? 2 : sa>70 ? 1 : 0;
      if(sa>0){
        var rpx = tx*TS+8, rpy = ty*TS+14;
        sh("sh_rock", rpx, rpy);
        obj(rpy, drawSprite, "rock_"+season+"_"+size+"_"+((tx*7+ty)&1), rpx, rpy);
      }
    }
  }

  for(var bj=0; bj<g.buildings.length; bj++){
    var B = g.buildings[bj];
    if(B.def==="field") continue;
    var name = buildingSprite(g, B, winter, byId);
    if(!name || !SPR.frames[name]) continue;
    var fr = SPR.frames[name], bxp = B.x*TS, byp = (B.y+B.h)*TS;
    if(bxp - fr.ax + fr.w < OX - 4 || bxp - fr.ax > OX + bw + 4 || byp - fr.ay > OY + bh + 4 || byp - fr.ay + fr.h < OY - 30) continue;
    if(B.done) sh(name, bxp + (TALL[B.def] ? 4 : 3), byp + 2);
    obj(byp - 0.5, drawBuilding, g, B, { name:name, now:now });
    if(B.done && B.def==="burgage" && B.plot) drawYard(B, season, winter, t, now);
    else if(B.done && B.def==="burgage"){
      var ex = B.exts || [];
      if(ex.indexOf("orchard")>=0){ var ox = bxp+14, oy = byp-9; sh("sh_sap", ox, oy); obj(oy, drawSprite, "fruit_"+season, ox, oy); }
      if(ex.indexOf("chicken")>=0 && !winter){
        for(var c=0;c<2;c++){
          var cx2 = bxp + 9 + c*4 + Math.round(Math.sin(t*0.7 + B.id + c*2)*2), cy2 = byp + 3 + c;
          var pk = (Math.floor(now/400) + c + B.id) % 3 === 0 ? 1 : 0;
          obj(cy2, drawSprite, "chick_"+(c&1)+"_"+pk+((Math.sin(t*0.7 + B.id + c*2+0.2) - Math.sin(t*0.7 + B.id + c*2))<0 ? "_l" : ""), cx2, cy2);
        }
      }
    }
    if(B.done && B.def==="farm" && g.stock.ox>0 && !winter){
      for(var o2=0; o2<Math.min(3, g.stock.ox); o2++){
        var oxx = bxp + 6 + o2*16 + Math.round(Math.sin(t*0.15 + o2*2.1)*4), oyy = byp + 10 + (o2&1)*4;
        var odir = Math.cos(t*0.15 + o2*2.1) < 0 ? "_l" : "";
        sh("sh_ox", oxx, oyy);
        obj(oyy, drawSprite, "ox_"+((Math.floor(now/500)+o2)%2 && Math.abs(Math.cos(t*0.15+o2*2.1))>0.3 ? 1 : 0)+odir, oxx, oyy);
      }
    }
    if(B.def==="field" ) continue;
  }
  // gerbes sur les champs moissonnés
  for(var fj=0; fj<g.buildings.length; fj++){
    var F = g.buildings[fj];
    if(F.def!=="field" || !F.f || winter) continue;
    var harvested = F.f.sown ? Math.floor((F.f.harvestP||0)*F.w*F.h) : ((F.f.usedThisYear && g.time.month>=8 && g.time.month<=9) ? F.w*F.h : 0);
    for(var q=0;q<harvested;q++){
      if(hash(F.id, q, 2) > 0.35) continue;
      var qx = (F.x + q % F.w)*TS + 6 + Math.floor(hash(F.id,q,3)*5), qy = (F.y + ((q / F.w)|0))*TS + 10;
      obj(qy, drawSprite, "sheaf", qx, qy);
    }
  }

  // êtres vivants
  for(var di=0; di<g.deer.length; di++){
    var D = g.deer[di];
    if(D.x*TS < vx0 || D.x*TS > vx1 || D.y*TS < vy0 || D.y*TS > vy1) continue;
    var dm = track("d"+D.id, D.x, D.y, now);
    sh("sh_deer", D.x*TS, D.y*TS);
    obj(D.y*TS, drawDeer, g, D, { m:dm, now:now });
  }
  for(var fi=0; fi<g.families.length; fi++){
    var Fm = g.families[fi];
    var fm = track("f"+Fm.id, Fm.x, Fm.y, now);
    if(Fm.x*TS < vx0 || Fm.x*TS > vx1 || Fm.y*TS < vy0 || Fm.y*TS > vy1) continue;
    var wb = Fm.work>=0 ? byId[Fm.work] : null;
    var job = (wb && JOBSET[wb.def]) ? wb.def : "laborer";
    sh("sh_person", Fm.x*TS, Fm.y*TS);
    obj(Fm.y*TS, drawFamily, g, Fm, { m:fm, now:now, job:job });
  }
  for(var ui2=0; ui2<g.units.length; ui2++){
    var Un = g.units[ui2];
    var um = track("u"+Un.id, Un.x, Un.y, now);
    if(Un.x*TS < vx0 || Un.x*TS > vx1 || Un.y*TS < vy0 || Un.y*TS > vy1) continue;
    sh("sh_person", Un.x*TS, Un.y*TS);
    obj(Un.y*TS, drawUnit, g, Un, { m:um, now:now });
  }
  for(var ci=0; ci<g.camps.length; ci++){
    var Cp = g.camps[ci];
    sh("sh_camp", Cp.x*TS, Cp.y*TS+4);
    obj(Cp.y*TS+4, drawCamp, g, Cp, { now:now, winter:winter });
  }

  /* ombres (une seule couche noire, composée en transparence) */
  shx.globalCompositeOperation = "source-in"; shx.fillStyle = "#000"; shx.fillRect(0, 0, bw, bh);
  shx.globalCompositeOperation = "source-over";
  bx.globalAlpha = winter ? 0.2 : 0.3;
  bx.drawImage(shc, 0, 0);
  bx.globalAlpha = 1;

  /* objets du fond vers l'avant */
  var list = objs.slice(0, nObj);
  list.sort(function(a, b){ return a.k - b.k; });
  for(var oi=0; oi<list.length; oi++){ var O = list[oi]; O.fn(O.a, O.b, O.c); }

  /* fumées, drapeaux */
  for(var si=0; si<g.buildings.length; si++){
    var Bs = g.buildings[si];
    if(!Bs.done) continue;
    var nm2 = buildingSprite(g, Bs, winter, byId); if(!nm2) continue;
    var base = nm2.replace(/_w$/, "").replace(/_\d+$/, "");
    var f2 = SPR.frames[nm2], ox0 = Bs.x*TS - f2.ax, oy0 = (Bs.y+Bs.h)*TS - f2.ay;
    if(ox0 > OX+bw+8 || ox0+f2.w < OX-8 || oy0 > OY+bh+8 || oy0+f2.h < OY-40) continue;
    var src = SMOKE_AT[base];
    if(src) for(var sk=0; sk<src.length; sk++) smokeFrom(ox0 + src[sk][0], oy0 + src[sk][1], t, Bs.id*3+sk, winter ? 1 : 0.75);
    if(Bs.exts && Bs.exts.indexOf("brewer")>=0) smokeFrom(Bs.x*TS+15, (Bs.y+1)*TS-6, t+1.7, Bs.id+50, 0.5);
    var ff = Math.floor(t*5 + Bs.id) % 3;
    if(Bs.def==="manor") spr("flag_"+ff, ox0+30, oy0+9);
    if(Bs.def==="tower") spr("flag_"+ff, ox0+9, oy0+4);
  }
  for(var cj=0; cj<g.camps.length; cj++) smokeFrom(g.camps[cj].x*TS - 1, g.camps[cj].y*TS - 2, t+cj, 900+cj, 0.6);

  /* calques d'information */
  if(layers && (layers.forest || layers.stone || layers.berry || layers.soil)){
    for(var ly=ty0; ly<=ty1; ly++) for(var lx=tx0; lx<=tx1; lx++){
      var li = ly*W+lx, lt = g.tiles[li], col = null;
      if(layers.forest && lt===T_FOREST) col = "rgba(40,170,70,0.38)";
      else if(layers.stone && lt===T_STONE) col = "rgba(200,210,225,0.45)";
      else if(layers.berry && lt===T_BERRY) col = "rgba(190,60,150,0.4)";
      else if(layers.soil && lt===T_GRASS){ var sv = g.soil[li]; col = sv>0.66 ? "rgba(60,210,80,0.3)" : sv>0.4 ? "rgba(210,210,60,0.3)" : "rgba(220,120,60,0.3)"; }
      if(col){ bx.fillStyle = col; bx.fillRect(lx*TS-OX, ly*TS-OY, TS, TS); }
    }
  }
  if(buildSel==="field"){
    for(var fy2=ty0; fy2<=ty1; fy2++) for(var fx2=tx0; fx2<=tx1; fx2++){
      var fi2 = fy2*W+fx2;
      if(g.tiles[fi2]!==T_GRASS || g.occupied[fi2]>=0) continue;
      var fv = g.soil[fi2];
      bx.fillStyle = fv>0.66 ? "rgba(60,210,80,0.32)" : fv>0.4 ? "rgba(210,210,60,0.32)" : "rgba(220,120,60,0.32)";
      bx.fillRect(fx2*TS-OX, fy2*TS-OY, TS, TS);
      if(S >= 3){
        var pc = Math.min(99, Math.round(fv*100));
        SPR.draw(bx, "dig_"+Math.floor(pc/10), fx2*TS+4-OX, fy2*TS+5+6-OY);
        SPR.draw(bx, "dig_"+(pc%10), fx2*TS+8-OX, fy2*TS+5+6-OY);
      }
    }
  }

  /* sélection */
  if(selId!=null){
    var sb = byId[selId];
    if(sb){
      var blink = Math.floor(now/450)%2 ? "#ffffff" : "#e8c35a";
      corners(sb.x*TS-2, sb.y*TS-2, sb.w*TS+4, sb.h*TS+4, blink);
      var sd = BUILD_DEFS[sb.def];
      if(sd && sd.radius) dottedCircle((sb.x+sb.w/2)*TS, (sb.y+sb.h/2)*TS, sd.radius*TS, "rgba(232,195,90,0.85)");
    }
  }

  /* aperçu de pose */
  if(buildSel && hover && hover.inside){
    var bd = BUILD_DEFS[buildSel];
    var pw = bd.uiSize ? g.fieldSize() : bd.w, ph = bd.uiSize ? g.fieldSize() : bd.h;
    var err = g.canPlace(buildSel, hover.tx, hover.ty);
    var gx0 = hover.tx*TS, gy0 = hover.ty*TS;
    bx.fillStyle = err ? "rgba(224,90,58,0.35)" : "rgba(90,224,110,0.28)";
    bx.fillRect(gx0-OX, gy0-OY, pw*TS, ph*TS);
    if(buildSel==="field"){
      bx.globalAlpha = 0.55;
      for(var a1=0;a1<ph;a1++) for(var a2=0;a2<pw;a2++) SPR.draw(bx, "field_plow_"+((a1+a2)&1), gx0+a2*TS-OX, gy0+a1*TS+TS-OY);
      bx.globalAlpha = 1;
    } else {
      var gn = buildingSprite(g, { def:buildSel, id:1, lvl:1, x:hover.tx, y:hover.ty, w:bd.w, h:bd.h, families:[1], exts:[], churchUp:[] }, winter, byId);
      if(gn){ bx.globalAlpha = 0.7; spr(gn, gx0, gy0 + ph*TS); bx.globalAlpha = 1; }
    }
    corners(gx0, gy0, pw*TS, ph*TS, err ? "#e05a3a" : "#5ae06e");
    if(bd.radius) dottedCircle(gx0 + bd.w*TS/2, gy0 + bd.h*TS/2, bd.radius*TS, "rgba(232,195,90,0.8)");
  }

  if(OV) drawOverlay(g, now);

  /* météo et lumière de saison */
  weather(g, t, bw, bh);
  var grade = winter ? "#dfe7f2" : season===3 ? "#fbefdc" : null;
  if(g.weather==="rain") grade = "#b9c3cf";
  else if(g.weather==="snow") grade = "#e2e8f0";
  if(grade){
    bx.globalCompositeOperation = "multiply";
    bx.fillStyle = grade; bx.fillRect(0, 0, bw, bh);
    bx.globalCompositeOperation = "source-over";
  }

  /* agrandissement entier vers l'écran (avec décalage sub-pixel pour un défilement doux) */
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = BG; ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(buf, 0, 0, bw, bh, -Math.round(fx*S), -Math.round(fy*S), bw*S, bh*S);

  /* minimap (en pixels CSS) */
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  var ppt = 2, mw = W*ppt, mh = H*ppt;
  /* en haut à droite : le bas de l'écran est réservé aux panneaux et à l'aide de pose */
  var mmx = (canvas.clientWidth||1) - 8 - mw, mmy = 8;
  if(mmx > 120 && (canvas.clientHeight||1) > mh + 160){
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#3a2a1c"; ctx.fillRect(mmx-3, mmy-3, mw+6, mh+6);
    ctx.fillStyle = "#c9a45a"; ctx.fillRect(mmx-2, mmy-2, mw+4, mh+4);
    ctx.drawImage(T.mm, 0, 0, W, H, mmx, mmy, mw, mh);
    for(var mb=0; mb<g.buildings.length; mb++){
      var Bm = g.buildings[mb];
      ctx.fillStyle = Bm.def==="field" ? "#d6b44a" : (Bm.done ? "#f2e6c8" : "#c97a4a");
      ctx.fillRect(mmx+Bm.x*ppt, mmy+Bm.y*ppt, Math.max(ppt, Bm.w*ppt), Math.max(ppt, Bm.h*ppt));
    }
    ctx.fillStyle = "#e0402a";
    for(var mc=0; mc<g.camps.length; mc++) ctx.fillRect(mmx+g.camps[mc].x*ppt-1, mmy+g.camps[mc].y*ppt-1, 3, 3);
    ctx.fillStyle = "#6aa0ff";
    for(var mu=0; mu<g.units.length; mu++) ctx.fillRect(mmx+g.units[mu].x*ppt-1, mmy+g.units[mu].y*ppt-1, 2, 2);
    var vwx = (cw/S/TS), vwy = (ch/S/TS);
    var rx0 = Math.max(mmx, Math.round(mmx + (cam.x - vwx/2)*ppt)), ry0 = Math.max(mmy, Math.round(mmy + (cam.y - vwy/2)*ppt));
    var rx1 = Math.min(mmx+mw, Math.round(mmx + (cam.x + vwx/2)*ppt)), ry1 = Math.min(mmy+mh, Math.round(mmy + (cam.y + vwy/2)*ppt));
    if(rx1>rx0 && ry1>ry0){ ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.strokeRect(rx0+0.5, ry0+0.5, rx1-rx0-1, ry1-ry0-1); }
    g.mmRect = { x:mmx, y:mmy, w:mw, h:mh, ppt:ppt };
  } else {
    g.mmRect = null;
  }

  // ménage de la mémoire visuelle (entités disparues)
  if(Math.random() < 0.01) mem.forEach(function(v, k){ if(now - v.seen > 5000) mem.delete(k); });
}

return { drawGame:drawGame, setOverlay:function(o){ OV = o || null; }, snapZoom:snapZoom, stepZoom:stepZoom, stats:function(){ return { terrainPaintMs: T ? T.paintMs : null, sprites: SPR.count, atlasMs: SPR.buildMs }; } };
})();

/* points d'entrée utilisés par app.js */
function drawGame(ctx, g, cam, canvas, hover, buildSel, selId, layers, now){
  return RENDER.drawGame(ctx, g, cam, canvas, hover, buildSel, selId, layers, now);
}
function snapZoom(z){ return RENDER.snapZoom(z); }
function stepZoom(z, dir){ return RENDER.stepZoom(z, dir); }
