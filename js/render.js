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
   CACHE DU SOL, PAR MORCEAUX
   La carte est grande (256 × 192 cases) : le sol n'est plus peint d'un bloc. Il est découpé en
   morceaux de CHK × CHK cases, peints à la demande quand ils entrent dans la vue (et un peu avant),
   gardés dans un cache limité, et repeints peu à peu au changement de saison.
   ====================================================== */
var T = null;
var CHK = 16, CPX = CHK*TS;           // un morceau : 16 × 16 cases = 256 × 256 pixels d'art (peint vite)
var CACHE_MAX = 110;                  // morceaux gardés en mémoire (256 ko chacun : ≈ 28 Mo au plus)

function tileAt(g, x, y){ return (x<0||y<0||x>=W||y>=H) ? -1 : g.tiles[y*W+x]; }
function isRoad(g, x, y){ return x>=0 && y>=0 && x<W && y<H && g.roads[y*W+x]; }

/* valeur d'un type de tuile (0/1), hors carte : forêt dense, ni eau ni pierre. Un gué compte comme de l'eau. */
function tv(g, kind, x, y){
  var t = tileAt(g, x, y);
  if(t<0) return kind===T_FOREST ? 0.8 : 0;
  if(kind===T_WATER) return (t===T_WATER || t===T_FORD) ? 1 : 0;
  return t===kind ? 1 : 0;
}
/* masque lissé (bilinéaire + lissage) d'un type de tuile au pixel d'art (px, py) */
function mask(g, kind, px, py){
  var u = px/TS - 0.5, v = py/TS - 0.5, i = Math.floor(u), j = Math.floor(v);
  var fu = u-i, fv = v-j; fu = fu*fu*(3-2*fu); fv = fv*fv*(3-2*fv);
  var a = tv(g,kind,i,j), b = tv(g,kind,i+1,j), c = tv(g,kind,i,j+1), d = tv(g,kind,i+1,j+1);
  return a + (b-a)*fu + (c-a)*fv + (a-b-c+d)*fu*fv;
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
  var seed = (g.seed|0) % 100000;
  var sc = document.createElement("canvas"); sc.width = CPX; sc.height = CPX;
  var scx = sc.getContext("2d"), simg = scx.createImageData(CPX, CPX);
  var jimg = scx.createImageData(CPX, CPX);
  T = {
    g:g, w:CW, h:CH, seed:seed,
    nA1:new NoiseGrid(CW, CH, 40, seed+1), nA2:new NoiseGrid(CW, CH, 13, seed+2), nB:new NoiseGrid(CW, CH, 4, seed+3),
    kind:new Uint8Array(W*H), season:-1, regionKey:"", tiles:new Uint8Array(W*H), roads:new Uint8Array(W*H),
    chunks:new Map(), nx:Math.ceil((W+2*M)/CHK), ny:Math.ceil((H+2*M)/CHK),
    simg:simg, sd:new Uint32Array(simg.data.buffer), jimg:jimg, jd:new Uint32Array(jimg.data.buffer), job:null,
    mm:document.createElement("canvas"), mmDirty:true, paintMs:null, frame:0, tw:null,
  };
  T.mm.width = W; T.mm.height = H;
  var kn = new NoiseGrid(W, H, 5, seed+4);
  for(var y=0;y<H;y++) for(var x=0;x<W;x++){
    var n = kn.at(x, y);
    T.kind[y*W+x] = n<0.36 ? 0 : (n<0.62 ? 1 : 2);   // 0 pinède, 1 bois mêlé, 2 chênaie-boulaie
  }
}

/* cible de la peinture : un tableau de pixels et la position (en pixels d'art du monde) de son coin */
var TD = null, TW = 0, TOX = 0, TOY = 0, TWATER = null;
function target(d, w, ox, oy, water){ TD = d; TW = w; TOX = ox; TOY = oy; TWATER = water || null; }
function tIdx(px, py){ return (py - TOY)*TW + (px - TOX); }

/* peint les tuiles [tx0..tx1]×[ty0..ty1] (coordonnées carte, marge comprise) dans la cible */
/* poids d'interpolation précalculés pour les 16 pixels d'une tuile */
var IX = new Int8Array(TS), FS = new Float32Array(TS), FL = new Float32Array(TS);
for(var ii=0; ii<TS; ii++){
  var uu = ii/TS - 0.5, fl = uu<0 ? uu+1 : uu;
  IX[ii] = uu<0 ? 0 : 1; FL[ii] = fl; FS[ii] = fl*fl*(3-2*fl);
}
var NBW = new Float32Array(9), NBF = new Float32Array(9), NBS = new Float32Array(9), NBO = new Float32Array(9);
function soilT(g, x, y){ x = Math.max(0, Math.min(W-1, x)); y = Math.max(0, Math.min(H-1, y)); return g.soil[y*W+x]; }
var snowGrass = 0;

function paintTerrain(g, tx0, ty0, tx1, ty1){
  var s = T.season, R = GROUND[s], d = TD, off = M*TS;
  if(!snowGrass) snowGrass = U("#8a9a7c");
  for(var ty=ty0; ty<=ty1; ty++) for(var tx=tx0; tx<=tx1; tx++){
    var inMap = tx>=0 && ty>=0 && tx<W && ty<H;
    var owned = !inMap || g.regionOwned(tx, ty);
    var ford = inMap && g.tiles[ty*W+tx]===T_FORD;
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
        var px = tx*TS+i, py = ty*TS+j, ci = tIdx(px, py);
        var cx = IX[i], fu = FS[i], k0 = cy + cx;
        var a = T.nA1.at(px+off, py+off)*0.6 + T.nA2.at(px+off, py+off)*0.4;
        var b = T.nB.at(px+off, py+off);
        var bay = bayer(px, py);
        var col, A_, B_, C2, D_;
        // --- eau ---
        var wm = 0;
        if(nearW){ A_ = NBW[k0]; B_ = NBW[k0+1]; C2 = NBW[k0+3]; D_ = NBW[k0+4];
          wm = A_ + (B_-A_)*fu + (C2-A_)*fv + (A_-B_-C2+D_)*fu*fv + (b-0.5)*0.22; }
        if(ford && wm > 0.5){
          // gué : eau claire et peu profonde, galets
          var hf = hash(px, py, 31);
          if(s===0) col = hf<0.2 ? C_.st2 : (bay<0.5 ? C_.sn1 : C_.sn2);
          else col = hf<0.16 ? (hf<0.07 ? C_.st4 : C_.st2) : (bay<0.45 ? C_.wa4 : C_.wa3);
        } else if(wm > 0.5){
          var up1 = mask(g, T_WATER, px, py-1) + (T.nB.at(px+off, py-1+off)-0.5)*0.22;
          var up2 = mask(g, T_WATER, px, py-2) + (T.nB.at(px+off, py-2+off)-0.5)*0.22;
          if(s===0){
            col = up1<=0.5 ? C_.sn0 : (wm>0.8 ? C_.sn1 : C_.sn2);
            if(hash(px>>1, py, 3)<0.04) col = C_.wa3;
          } else if(up1<=0.5) col = C_.dt1;               // berge vue de face
          else if(up2<=0.5) col = C_.wa0;                 // ombre de la berge sur l'eau
          else col = wm>0.85 ? C_.wa1 : (wm>0.64 ? (bay<0.5?C_.wa1:C_.wa2) : C_.wa2);
          if(TWATER && s!==0 && wm>0.72 && hash(px, py, 77)<0.006 && owned) TWATER.push(px, py);
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
        // --- région qui n'est pas à vous : terre assombrie ---
        if(!owned) col = shadeU(col, 0.68, 0.45);
        // --- hors carte : lisière qui s'enfonce dans l'ombre ---
        if(!inMap){
          var dx = Math.max(0, -px, px-(W*TS-1)), dy = Math.max(0, -py, py-(H*TS-1));
          var dist = Math.sqrt(dx*dx + dy*dy);
          col = mixU(shadeU(col, 0.8, 0.3), BGU, Math.min(0.92, 0.38 + dist/(M*TS*0.75)));
        }
        d[ci] = col;
      }
    }
    if(inMap){ decorateTile(g, tx, ty, owned); regionEdges(g, tx, ty, owned); }
  }
}

/* frontières de régions : pointillé doré le long des bords de cases, dessiné dans chaque case
   (doré du côté intérieur, ombre de l'autre côté), effacé entre deux terres qui sont à vous */
function regionEdges(g, tx, ty, owned){
  var r = g.regionAt(tx, ty), d = TD, x0 = tx*TS, y0 = ty*TS, k;
  function line(horiz, fixed, col){
    for(k=0;k<TS;k++){
      var px = horiz ? x0+k : fixed, py = horiz ? fixed : y0+k;
      if((((horiz ? px : py)>>2)&1)===0) continue;
      d[tIdx(px, py)] = col;
    }
  }
  function other(nx, ny){ var o = g.regionAt(nx, ny); return o>=0 && o!==r && !(owned && g.regionOwned(nx, ny)); }
  if(other(tx+1, ty)) line(false, x0+TS-1, GOLD);
  if(other(tx-1, ty)) line(false, x0, GOLD_D);
  if(other(tx, ty+1)) line(true, y0+TS-1, GOLD);
  if(other(tx, ty-1)) line(true, y0, GOLD_D);
}

/* petits détails du sol : touffes, fleurs, cailloux, feuilles mortes */
function decorateTile(g, tx, ty, owned){
  var s = T.season, i = ty*W+tx, t = g.tiles[i];
  if(t===T_WATER || t===T_FORD || t===T_STONE || g.roads[i]) return;
  var d = TD, off = M*TS, R = GROUND[s];
  function put(x, y, c){ if(x<0||y<0||x>15||y>15) return; d[tIdx(tx*TS+x, ty*TS+y)] = c; }
  function fix(c){ return owned ? c : shadeU(c, 0.68, 0.45); }
  var n = 2 + Math.floor(hash(tx, ty, 1)*3);
  for(var k=0;k<n;k++){
    var x = 1 + Math.floor(hash(tx, ty, 10+k)*13), y = 2 + Math.floor(hash(tx, ty, 20+k)*12);
    if(s===0){ if(hash(tx,ty,30+k)<0.4) put(x, y, fix(U("#6f7f60"))); continue; }
    var base = d[tIdx(tx*TS+x, ty*TS+y)];
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

/* arbres décoratifs dans la marge (hors carte), pour les cases [tx0..tx1]×[ty0..ty1] ; seuls les pixels
   de la cible sont écrits (un arbre à cheval sur deux morceaux est dessiné moitié dans chacun) */
function paintMarginTrees(tx0, ty0, tx1, ty1, x0, y0, x1, y1){
  var d = TD, s = T.season;
  for(var ty=ty0-1; ty<=ty1+2; ty++) for(var tx=tx0-1; tx<=tx1+1; tx++){
    if(tx<-M || ty<-M || tx>=W+M || ty>=H+M) continue;
    if(tx>=0 && ty>=0 && tx<W && ty<H) continue;
    if(ty===H) continue;                       // ne pas déborder sur la carte
    if(hash(tx, ty, 123) > 0.62) continue;
    var kinds = ["pine_"+s+"_0","oak_"+s+"_0","birch_"+s+"_1","pine_"+s+"_1","oak_"+s+"_2"];
    var spr = SPR.keep[kinds[Math.floor(hash(tx,ty,124)*kinds.length)]];
    if(!spr) continue;
    var bx = tx*TS + 3 + Math.floor(hash(tx,ty,125)*10) - spr.ax;
    var by = ty*TS + 10 + Math.floor(hash(tx,ty,126)*6) - spr.ay;
    var ddx = Math.max(0, -tx, tx-(W-1)), ddy = Math.max(0, -ty, ty-(H-1));
    var dark = Math.min(0.9, 0.42 + Math.sqrt(ddx*ddx+ddy*ddy)/(M*0.75));
    for(var y=0;y<spr.h;y++) for(var x=0;x<spr.w;x++){
      var c = spr.d[y*spr.w+x]; if(!c) continue;
      var X = bx+x, Y = by+y;
      if(X<x0 || Y<y0 || X>=x1 || Y>=y1) continue;
      if(X>=0 && X<W*TS && Y>=0 && Y<H*TS) continue;   // jamais sur la carte
      d[tIdx(X, Y)] = mixU(c, BGU, dark);
    }
  }
}

/* ---- arbres ----
   Les arbres d'une case (1 à 3 selon le bois qui reste), à des places fixes tirées de la case. */
var TREE_SPOTS = [[4,7],[12,10],[7,15]];
function treeCount(wood){ return wood>6 ? 3 : wood>3 ? 2 : 1; }
function treeSpecs(g, tx, ty, season){
  var ti = ty*W+tx, wood = g.treeWood[ti], kind = T.kind[ti], cnt = treeCount(wood), out = [];
  for(var k=0;k<cnt;k++){
    var px = tx*TS + TREE_SPOTS[k][0] + Math.floor(hash(tx,ty,k)*4) - 2, py = ty*TS + TREE_SPOTS[k][1] + Math.floor(hash(tx,ty,k+5)*3);
    var r = hash(tx, ty, k+11), nm, shn = "sh_tree";
    var young = wood<=2 && k===0;
    if(young){ nm = "sap_"+season+"_"+(kind===0 ? 1 : 0); shn = "sh_sap"; }
    else if(kind===0 ? r<0.8 : kind===1 ? r<0.4 : r<0.08){ nm = "pine_"+season+"_"+(r<0.3?1:0); shn = "sh_pine"; }
    else if(kind===2 ? r<0.45 : r<0.6){ nm = "birch_"+season+"_"+(hash(tx,ty,k+3)<0.5?0:1); shn = "sh_pine"; }
    else nm = "oak_"+season+"_"+Math.floor(hash(tx,ty,k+7)*3);
    out.push({ n:nm, sh:shn, x:px, y:py });
  }
  return out;
}
/* Cœur de forêt : la case et tout ce qui l'entoure (une case de chaque côté, deux au-dessus, une
   au-dessous) sont boisés, sans jeune pousse. Ses arbres sont peints une fois pour toutes dans le sol :
   rien de ce qui est devant ne peut les cacher, et une grande forêt ne coûte plus rien à afficher. */
function bakedTile(g, tx, ty){
  if(tx<1 || ty<2 || tx>=W-1 || ty>=H-1) return false;
  for(var y=ty-2; y<=ty+1; y++) for(var x=tx-1; x<=tx+1; x++){
    var i = y*W+x;
    if(g.tiles[i]!==T_FOREST || g.treeWood[i]<=2) return false;
  }
  return true;
}
var SHADOW_ELL = { sh_tree:[15,5,4,3], sh_pine:[11,4,3,2] };
/* peint les arbres des cœurs de forêt qui débordent sur le rectangle de pixels [x0,x1[×[y0,y1[ de la cible */
function bakeTrees(g, tx0, ty0, tx1, ty1, x0, y0, x1, y1){
  var s = T.season, list = [], d = TD;
  for(var ty=Math.max(0, ty0-1); ty<=Math.min(H-1, ty1+2); ty++) for(var tx=Math.max(0, tx0-2); tx<=Math.min(W-1, tx1+2); tx++){
    if(!bakedTile(g, tx, ty)) continue;
    var sp = treeSpecs(g, tx, ty, s);
    for(var k=0;k<sp.length;k++) list.push(sp[k]);
  }
  if(!list.length) return;
  list.sort(function(a, b){ return a.y - b.y || a.x - b.x; });
  var shade = s===0 ? 0.82 : 0.72;
  for(var a=0; a<list.length; a++){                       // les ombres d'abord, comme pour les objets
    var e = SHADOW_ELL[list[a].sh]; if(!e) continue;
    var cx = list[a].x - e[2] + e[0]/2, cy = list[a].y - e[3] + e[1]/2, rx = e[0]/2, ry = e[1]/2;
    for(var yy=Math.floor(cy-ry); yy<=cy+ry; yy++) for(var xx=Math.floor(cx-rx); xx<=cx+rx; xx++){
      if(xx<x0 || yy<y0 || xx>=x1 || yy>=y1) continue;
      var u = (xx+0.5-cx)/rx, v = (yy+0.5-cy)/ry;
      if(u*u + v*v > 1) continue;
      var ci = tIdx(xx, yy); d[ci] = shadeU(d[ci], shade);
    }
  }
  for(var b=0; b<list.length; b++){
    var spr = SPR.keep[list[b].n]; if(!spr) continue;
    var bx0 = list[b].x - spr.ax, by0 = list[b].y - spr.ay;
    for(var y=0;y<spr.h;y++){
      var Y = by0 + y; if(Y<y0 || Y>=y1) continue;
      for(var x=0;x<spr.w;x++){
        var X = bx0 + x; if(X<x0 || X>=x1) continue;
        var c = spr.d[y*spr.w+x]; if(!c) continue;
        var al = (c>>>24)&255, ci2 = tIdx(X, Y);
        d[ci2] = al>=250 ? c : mixU(d[ci2], c|0xff000000, al/255);
      }
    }
  }
}

/* ---- les morceaux ---- */
function chunkKey(ci, cj){ return ci*100 + cj; }
function chunkTiles(ci, cj){ var tx0 = -M + ci*CHK, ty0 = -M + cj*CHK; return { tx0:tx0, ty0:ty0, tx1:Math.min(W+M-1, tx0+CHK-1), ty1:Math.min(H+M-1, ty0+CHK-1) }; }
function newChunk(ci, cj){
  var c = document.createElement("canvas"); c.width = CPX; c.height = CPX;
  return { ci:ci, cj:cj, c:c, cx:c.getContext("2d"), season:-1, rk:"", water:[], used:0, ready:false };
}
/* peint un morceau entier tout de suite (il entre dans la vue et n'a jamais été peint) */
function paintChunkNow(g, ch){
  var t0 = performance.now(), r = chunkTiles(ch.ci, ch.cj), ox = r.tx0*TS, oy = r.ty0*TS;
  ch.water = [];
  target(T.sd, CPX, ox, oy, ch.water);
  paintTerrain(g, r.tx0, r.ty0, r.tx1, r.ty1);
  paintMarginTrees(r.tx0, r.ty0, r.tx1, r.ty1, ox, oy, ox+CPX, oy+CPX);
  bakeTrees(g, r.tx0, r.ty0, r.tx1, r.ty1, ox, oy, ox+CPX, oy+CPX);
  ch.cx.putImageData(T.simg, 0, 0);
  ch.season = T.season; ch.rk = T.regionKey; ch.ready = true;
  var ms = performance.now() - t0;
  T.paintMs = T.paintMs===null ? Math.round(ms) : Math.round(T.paintMs*0.8 + ms*0.2);
}
/* repeint un morceau rangée par rangée, sur plusieurs images (changement de saison ou de frontières) :
   l'ancien reste affiché jusqu'au bout */
function stepJob(g, budget){
  var J = T.job; if(!J) return;
  var ch = J.ch, r = chunkTiles(ch.ci, ch.cj), ox = r.tx0*TS, oy = r.ty0*TS, t0 = performance.now();
  if(J.row===r.ty0){ J.water = []; }
  target(T.jd, CPX, ox, oy, J.water);
  while(J.row <= r.ty1 && performance.now() - t0 < budget){ paintTerrain(g, r.tx0, J.row, r.tx1, J.row); J.row++; }
  if(J.row > r.ty1){
    paintMarginTrees(r.tx0, r.ty0, r.tx1, r.ty1, ox, oy, ox+CPX, oy+CPX);
    bakeTrees(g, r.tx0, r.ty0, r.tx1, r.ty1, ox, oy, ox+CPX, oy+CPX);
    ch.cx.putImageData(T.jimg, 0, 0);
    ch.water = J.water; ch.season = J.season; ch.rk = J.rk; ch.ready = true;
    T.job = null;
  }
}
function evict(){
  if(T.chunks.size <= CACHE_MAX) return;
  var list = []; T.chunks.forEach(function(ch){ list.push(ch); });
  list.sort(function(a, b){ return a.used - b.used; });
  for(var i=0; i<list.length && T.chunks.size > CACHE_MAX; i++){
    if(T.job && T.job.ch===list[i]) continue;
    T.chunks.delete(chunkKey(list[i].ci, list[i].cj));
  }
}

/* minicarte : une couleur par case, calculée directement (pas besoin d'avoir peint le sol) */
function paintMinimap(g){
  var mx = T.mm.getContext("2d"), id = mx.createImageData(W, H), md = new Uint32Array(id.data.buffer);
  var R = GROUND[T.season], road = U("#c9b088"), berry = U("#8a3a5a"), ford = C_.wa3, water = T.season===0 ? C_.sn1 : C_.wa1;
  for(var y=0;y<H;y++) for(var x=0;x<W;x++){
    var i = y*W+x, t = g.tiles[i], c;
    if(t===T_WATER) c = water;
    else if(t===T_FORD) c = ford;
    else {
      c = R[Math.max(0, Math.min(4, Math.round(3.2 - g.soil[i]*2.4)))];
      if(t===T_FOREST) c = shadeU(c, 0.58);
      else if(t===T_BERRY) c = mixU(c, berry, 0.4);
      else if(t===T_STONE) c = C_.st3;
      if(g.roads[i]) c = road;
    }
    var r = g.regionAt(x, y);
    if(!g.regionOwned(x, y)) c = shadeU(c, 0.6, 0.5);
    if((x+1<W && g.regionAt(x+1, y)!==r) || (y+1<H && g.regionAt(x, y+1)!==r)) c = mixU(c, GOLD, 0.55);
    md[i] = c;
  }
  mx.putImageData(id, 0, 0);
  T.mmDirty = false;
}

/* met le cache à jour pour la vue [vx0..vx1]×[vy0..vy1] (pixels d'art du monde) */
function updateTerrain(g, vx0, vy0, vx1, vy1){
  var first = !T || T.g!==g;
  if(first) terrainInit(g);
  T.frame++;
  var season = g.season();
  var rk = g.regions.map(function(r){ return r.owned ? 1 : 0; }).join("");
  if(first){ T.season = season; T.regionKey = rk; T.tiles.set(g.tiles); T.roads.set(g.roads); }
  // saison ou frontières changées : tout est à repeindre, les morceaux lointains sont simplement oubliés
  if(season!==T.season || rk!==T.regionKey){
    T.season = season; T.regionKey = rk; T.mmDirty = true; T.job = null;
    T.chunks.forEach(function(ch, key){ if(!inView(ch, vx0, vy0, vx1, vy1, CPX)) T.chunks.delete(key); });
  }
  // changements locaux (arbres abattus, routes...) : seules les cases touchées sont repeintes, morceau par
  // morceau. Une case qui change change aussi le cœur de forêt de ses voisines (une de chaque côté,
  // une au-dessus, deux au-dessous) et les lisières peintes autour d'elle.
  var dirty = null, tw = T.tw;
  if(!tw){ tw = T.tw = new Uint8Array(W*H); for(var w0=0; w0<W*H; w0++) tw[w0] = g.tiles[w0]===T_FOREST ? treeCount(g.treeWood[w0]) + (g.treeWood[w0]<=2 ? 4 : 0) : 0; }
  for(var i=0;i<W*H;i++){
    var tc = g.tiles[i]===T_FOREST ? treeCount(g.treeWood[i]) + (g.treeWood[i]<=2 ? 4 : 0) : 0;
    if(T.tiles[i]===g.tiles[i] && T.roads[i]===g.roads[i] && tw[i]===tc) continue;
    if(T.tiles[i]!==g.tiles[i] || T.roads[i]!==g.roads[i]) T.mmDirty = true;
    T.tiles[i] = g.tiles[i]; T.roads[i] = g.roads[i]; tw[i] = tc;
    var x = i % W, y = (i/W)|0;
    if(!dirty) dirty = new Map();
    for(var yy=Math.max(0, y-2); yy<=Math.min(H-1, y+2); yy++) for(var xx=Math.max(0, x-1); xx<=Math.min(W-1, x+1); xx++){
      var ck = chunkKey(Math.floor((xx+M)/CHK), Math.floor((yy+M)/CHK)), rr = dirty.get(ck);
      if(!rr) dirty.set(ck, { x0:xx, y0:yy, x1:xx, y1:yy });
      else { if(xx<rr.x0) rr.x0 = xx; if(yy<rr.y0) rr.y0 = yy; if(xx>rr.x1) rr.x1 = xx; if(yy>rr.y1) rr.y1 = yy; }
    }
  }
  if(dirty) dirty.forEach(function(rr, ck){
    var ch = T.chunks.get(ck); if(!ch) return;
    var r = chunkTiles(ch.ci, ch.cj);
    if(T.job && T.job.ch===ch) T.job.row = r.ty0;                   // le repeint en cours reprend du début
    if(!ch.ready || ch.season!==T.season || ch.rk!==T.regionKey) return;   // il sera repeint en entier
    var ox = r.tx0*TS, oy = r.ty0*TS;
    target(T.sd, CPX, ox, oy, null);
    paintTerrain(g, rr.x0, rr.y0, rr.x1, rr.y1);
    var px0 = rr.x0*TS, py0 = rr.y0*TS, px1 = (rr.x1+1)*TS, py1 = (rr.y1+1)*TS;
    bakeTrees(g, rr.x0, rr.y0, rr.x1, rr.y1, px0, py0, px1, py1);
    ch.cx.putImageData(T.simg, 0, 0, px0-ox, py0-oy, px1-px0, py1-py0);
  });
  // les morceaux visibles : peints tout de suite s'ils ne l'ont jamais été, repeints peu à peu s'ils sont périmés
  var c0 = Math.max(0, Math.floor((vx0/TS + M)/CHK)), c1 = Math.min(T.nx-1, Math.floor((vx1/TS + M)/CHK));
  var r0 = Math.max(0, Math.floor((vy0/TS + M)/CHK)), r1 = Math.min(T.ny-1, Math.floor((vy1/TS + M)/CHK));
  var stale = null;
  for(var cj=r0; cj<=r1; cj++) for(var ci=c0; ci<=c1; ci++){
    var key = chunkKey(ci, cj), ch = T.chunks.get(key);
    if(!ch){ ch = newChunk(ci, cj); T.chunks.set(key, ch); }
    ch.used = T.frame;
    if(!ch.ready) paintChunkNow(g, ch);
    else if((ch.season!==T.season || ch.rk!==T.regionKey) && !stale) stale = ch;
  }
  if(!T.job && stale) T.job = { ch:stale, row:chunkTiles(stale.ci, stale.cj).ty0, season:T.season, rk:T.regionKey, water:[] };
  // la caméra bouge-t-elle ? on peint d'avance là où elle va (dans une seconde environ)
  var vcx = (vx0+vx1)/2, vcy = (vy0+vy1)/2;
  if(T.pc){ T.vx = (T.vx||0)*0.85 + (vcx - T.pc.x)*0.15; T.vy = (T.vy||0)*0.85 + (vcy - T.pc.y)*0.15; }
  T.pc = { x:vcx, y:vcy };
  if(!T.job){
    var aimX = vcx + (T.vx||0)*50, aimY = vcy + (T.vy||0)*50, best = null, bd = Infinity;
    var moving = Math.abs(T.vx||0) + Math.abs(T.vy||0) > 0.4;
    var span = moving ? 2 : 1;          // immobile : la couronne voisine seulement ; en mouvement, plus loin devant
    for(var pj=r0-span; pj<=r1+span; pj++) for(var pi=c0-span; pi<=c1+span; pi++){
      if(pi<0 || pj<0 || pi>=T.nx || pj>=T.ny) continue;
      var pc = T.chunks.get(chunkKey(pi, pj));
      if(pc && pc.ready && pc.season===T.season && pc.rk===T.regionKey) continue;
      var d = Math.hypot((pi*CHK - M)*TS + CPX/2 - aimX, (pj*CHK - M)*TS + CPX/2 - aimY);
      if(d<bd){ bd = d; best = { i:pi, j:pj }; }
    }
    if(best){
      var bk = chunkKey(best.i, best.j), bc = T.chunks.get(bk);
      if(!bc){ bc = newChunk(best.i, best.j); T.chunks.set(bk, bc); }
      bc.used = T.frame;
      T.job = { ch:bc, row:chunkTiles(bc.ci, bc.cj).ty0, season:T.season, rk:T.regionKey, water:[] };
    }
  }
  if(T.job) stepJob(g, 4);
  evict();
  if(T.mmDirty) paintMinimap(g);
}
function inView(ch, vx0, vy0, vx1, vy1, pad){
  var ox = (ch.ci*CHK - M)*TS, oy = (ch.cj*CHK - M)*TS;
  return ox + CPX > vx0 - pad && ox < vx1 + pad && oy + CPX > vy0 - pad && oy < vy1 + pad;
}
/* dessine le sol visible dans le tampon */
function drawGround(bw, bh){
  T.chunks.forEach(function(ch){
    if(!ch.ready) return;
    var ox = (ch.ci*CHK - M)*TS - OX, oy = (ch.cj*CHK - M)*TS - OY;
    if(ox >= bw || oy >= bh || ox + CPX <= 0 || oy + CPX <= 0) return;
    // seule la partie visible du morceau est copiée
    var sx = Math.max(0, -ox), sy = Math.max(0, -oy), w = Math.min(CPX - sx, bw - Math.max(0, ox)), h = Math.min(CPX - sy, bh - Math.max(0, oy));
    if(w>0 && h>0) bx.drawImage(ch.c, sx, sy, w, h, Math.max(0, ox), Math.max(0, oy), w, h);
  });
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

var TOOL_OF = { chop:"axe", mine:"pick", build:"hammer", plow:"hoe", harvest:"sickle", gather:"basket", hunt:"bow",
                spread:"fork", sow:"seed", mow:"scythe", thresh:"flail", herd:"crook" };
var JOBSET = {}; SPR.JOBS.forEach(function(j){ JOBSET[j] = true; });
var WALKING = { walk:1, return:1, settle:1, wander:1 };
var FIELD_T = { plow:1, spread:1, sow:1, harvest:1, mow:1 };   // le fermier avance de case en case : il marche entre deux coups de bêche

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

/* étape 5 : chaque culture a ses tuiles ; fumure, labour et semailles se voient case par case */
var FIELD_SPR = { wheat:"wheat", barley:"barley", rye:"rye", oats:"oats", flax:"flax", peas:"peas", hay:"hay" };
function drawField(g, b, season){
  var f = b.f; if(!f) return;
  var cells = g.fieldCells(b), n = cells.length, plowed = Math.floor((f.plow||0)*n + 0.0001), harvested = Math.floor((f.harvestP||0)*n);
  var sowed = Math.floor((f.sowP||0)*n + 0.0001), dunged = f.dunged ? n : Math.floor((f.dungP||0)*n);
  var crop = f.sown ? (f.sownCrop || f.crop) : f.crop;
  var stage = fieldStage(f), mi = g.monthIdx ? g.monthIdx() : 0;
  var stubble = !f.sown && f.prev && f.prev!=="hay" && (f.plow||0)<=0 && mi - (f.stubAt||-999) < 14;
  for(var k=0;k<n;k++){
    var cx = cells[k]%W, cy = (cells[k]/W)|0, v = (cx+cy)&1;
    var px = cx*TS, py = cy*TS, name = null;
    if(season===0) name = (f.sown && crop!=="hay" && f.growth>0) ? "field_wintercrop_"+v : "field_snow_"+v;
    else if(crop==="fallow") name = "field_fallow_"+v;
    else if(crop==="hay"){
      if(f.sown) name = k < harvested ? "field_mown_"+v : "field_hay_"+Math.max(2, stage)+"_"+v;
      else name = (f.prev==="hay" && mi - (f.stubAt||-999) <= 3) ? "field_mown_"+v : "field_hay_2_"+v;
    }
    else if(f.sown){
      if(k < harvested) name = "field_stub_"+v;
      else if(stage<=1) name = "field_sown_"+v;
      else name = "field_"+(FIELD_SPR[crop]||"wheat")+"_"+stage+"_"+v;
    }
    else if(k < plowed) name = k < sowed ? "field_sown_"+v : "field_plow_"+v;
    else if(k < dunged) name = "field_dung_"+v;
    else if(stubble) name = "field_stub_"+v;
    if(name) spr(name, px, py + TS);
  }
  // bordure : talus et piquets, le long du contour tracé
  var set = {}; for(k=0;k<n;k++) set[cells[k]] = 1;
  var bank = season===0 ? "#8a98a8" : "#4a3624";
  for(k=0;k<n;k++){
    var c = cells[k], qx = (c%W)*TS - OX, qy = ((c/W)|0)*TS - OY, ccx = c%W;
    bx.fillStyle = bank;
    if(!set[c-W]) bx.fillRect(qx, qy, TS, 1);
    if(!set[c+W]) bx.fillRect(qx, qy+TS-1, TS, 1);
    if(ccx===0 || !set[c-1]) bx.fillRect(qx, qy, 1, TS);
    if(ccx===W-1 || !set[c+1]) bx.fillRect(qx+TS-1, qy, 1, TS);
    bx.fillStyle = "#6b4a30";
    if(!set[c-W]){ bx.fillRect(qx, qy-1, 1, 2); bx.fillRect(qx+8, qy-1, 1, 2); }
    if(!set[c+W]){ bx.fillRect(qx, qy+TS-2, 1, 2); bx.fillRect(qx+8, qy+TS-2, 1, 2); }
  }
}

/* étape 5 : pâturage — herbe teintée selon ce qu'il en reste, clôture qui suit le tracé */
function drawPastureGround(g, b, season, winter){
  var h = b.herd, fed = h && h.an && h.an.length ? h.fed : 1;
  var tint = winter ? "rgba(255,255,255,0.10)" : fed>=0.95 ? "rgba(90,170,50,0.22)" : fed>=0.6 ? "rgba(160,150,60,0.24)" : "rgba(150,100,40,0.30)";
  if(b.plot.poly){ fillPoly(b.plot.poly, tint); drawPolyFence(g, b.plot.poly, -1, b.done ? 1 : 0.4, WOOD_A, WOOD_B); return; }
  bx.fillStyle = tint;
  for(var k=1; k<b.plot.cells.length; k++) bx.fillRect(cellX(b.plot.cells[k])-OX, cellY(b.plot.cells[k])-OY, TS, TS);
  drawFences(g.plotFences(b), b.done ? 1 : 0.4, WOOD_A, WOOD_B);
}
/* les bêtes vont et viennent autour d'un « coin » à elles ; l'hiver près de l'abri, en forêt pour la glandée */
var PCACHE = {};
function nearCells(cells, c0, R){
  var x0 = c0%W, y0 = (c0/W)|0, out = [];
  for(var i=0;i<cells.length;i++){ var c = cells[i], dx = c%W - x0, dy = ((c/W)|0) - y0; if(dx*dx+dy*dy <= R*R) out.push(c); }
  return out.length ? out : [c0];
}
function herdSpots(b, key, home, R, cells){
  var pc = PCACHE[b.id];
  var ck = b.plot.cells.length+":"+b.plot.cells[0]+":"+key;
  if(!pc || pc.k!==ck){ pc = PCACHE[b.id] = { k:ck, m:{} }; }
  if(!pc.m[home]) pc.m[home] = nearCells(cells, home, R);
  return pc.m[home];
}
function animalPos(id, spots, t, period){
  var u = t/period + hash(id, 1, 60)*7, seg = Math.floor(u), ph = u - seg;
  function at(k){ var c = spots[Math.floor(hash(id, k, 61)*spots.length)]; return { x:(c%W) + 0.2 + hash(id, k, 62)*0.6, y:((c/W)|0) + 0.45 + hash(id, k, 63)*0.5 }; }
  var p0 = at(seg), p1 = at(seg+1), mv = ph<0.6 ? 0 : (ph-0.6)/0.4;
  mv = mv*mv*(3-2*mv);
  return { x:p0.x + (p1.x-p0.x)*mv, y:p0.y + (p1.y-p0.y)*mv, moving: ph>=0.6 && Math.abs(p1.x-p0.x)+Math.abs(p1.y-p0.y)>0.05,
           dir: p1.x>=p0.x ? 1 : -1, graze: ph<0.6 && hash(id, seg, 64)<0.65 };
}
var SH_OF = { sheep:["sh_sheep","sh_lamb"], cattle:["sh_cow","sh_sheep"], pig:["sh_pig","sh_lamb"] };
function drawHerd(g, B, winter, t, now){
  var h = B.herd, d = LIVESTOCK[h.sp]; if(!d || !h.an.length || !B.plot) return;
  var cells = B.plot.cells.length>1 ? B.plot.cells.slice(1) : B.plot.cells, anchor = B.plot.cells[0];
  var mode = h.out>=0 ? "out" : winter ? "winter" : "grass";
  if(mode==="winter"){
    // au foin : une meule près de l'abri
    var near = herdSpots(B, "w", anchor, 2.3, cells), hc = near[near.length>1 ? 1 : 0];
    obj(cellY(hc)+12, drawSprite, "haycock", cellX(hc)+8, cellY(hc)+12);
  }
  var outCells = null;
  if(mode==="out"){ outCells = []; var ox = h.out%W, oy = (h.out/W)|0; for(var yy=oy-1; yy<=oy+1; yy++) for(var xx=ox-1; xx<=ox+1; xx++) if(xx>=0&&yy>=0&&xx<W&&yy<H) outCells.push(yy*W+xx); }
  var lim = Math.min(h.an.length, 60);
  for(var i=0;i<lim;i++){
    var a = h.an[i], young = a.a < d.adultAt, spots;
    if(mode==="out") spots = outCells;
    else if(mode==="winter") spots = herdSpots(B, "w", anchor, 2.3, cells);
    else spots = herdSpots(B, "g", cells[Math.floor(hash(a.id, 3, 65)*cells.length)], 2.6, cells);
    var p = animalPos(a.id, spots, t, young ? 6 : 9), fr;
    if(a.s>0) fr = 3;
    else if(p.moving) fr = (Math.floor(now/(young ? 140 : 200)) + a.id) % 2 ? 1 : 0;
    else fr = p.graze ? 2 : 0;
    var px = p.x*TS, py = p.y*TS;
    sh(SH_OF[h.sp][young ? 1 : 0], px, py);
    obj(py, drawSprite, h.sp+"_"+(young ? "y" : "a")+"_"+fr+(p.dir<0 ? "_l" : ""), px, py);
  }
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

/* un bâtiment où quelqu'un travaille (étals garnis, ailes du moulin qui tournent) */
function staffed(g, b){
  if(b.preview) return true;
  if(g.villagers){ for(var i=0;i<g.villagers.length;i++){ var v = g.villagers[i]; if(v.work===b.id && !v.appr) return true; } return false; }
  return !!(b.families && b.families.length);
}
function buildingSprite(g, b, winter, byId){
  var w = winter ? "_w" : "";
  switch(b.def){
    case "burgage":
      var lv = Math.max(1, Math.min(3, b.lvl||1));
      return "burgage"+lv+"_"+(lv===3 ? b.id%2 : b.id%3)+w;
    case "market": return "market_"+(staffed(g, b) ? 1 : 0)+w;
    case "church":
      var cu = b.churchUp || [];
      return "church_"+(cu.indexOf("bell")>=0 ? 1 : 0)+(cu.indexOf("altar")>=0 ? 1 : 0)+w;
    case "wall": return "wall_"+wallMask(g, b, byId)+w;
    case "field": case "camp": case "oxpost": return null; // dessinés à part
    case "pasture": return "shelter_"+(b.herd && b.herd.sp && b.herd.an && b.herd.an.length ? b.herd.sp : "none")+w;
    default: return b.def + w;
  }
}
var TALL = { tower:1, windmill:1, manor:1 };

function drawBuilding(g, b, info){
  var name = info.name, bxp = b.x*TS, byp = (b.y+b.h)*TS;
  if(!b.done){ drawSite(g, b, name); return; }
  spr(name, bxp, byp);
  if(b.def==="windmill"){
    var f = SPR.frames[name];
    var hubX = bxp - f.ax + 17.5, hubY = byp - f.ay + 9.5;
    var turning = staffed(g, b);
    var fr = turning ? Math.floor(info.now/110) % 8 : 0;
    spr("sails_"+fr, hubX - 19.5, hubY - 19.5);
  }
  if(b.def==="burgage" && !b.plot) drawExtensionsFront(g, b, info);
}

/* étape 3 : chantier en quatre étapes (fondations, charpente, murs, toit) */
var STONE_A = "#d4cec0", STONE_B = "#9a9384", STONE_D = "#4a443b", WOOD_A = "#b07a44", WOOD_B = "#5e3b1f";
function drawSite(g, b, name){
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
  // étape 5 bis : le tas de ce qui a été livré et pas encore employé
  if(b.mat){
    var lt = Math.ceil(g.matOnSite(b, "timber") - 0.05), ls = Math.ceil(g.matOnSite(b, "stone") - 0.05);
    if(lt>0) spr("pile_timber_"+Math.min(4, lt), bxp - 3, byp + 4);
    if(ls>0) spr("pile_stone_"+Math.min(3, ls), bxp + (lt>0 ? 10 : -2), byp + 4);
  } else if(st<3) spr("materials", bxp - 3, byp + 2);
  var bw = fw - 4, top = byp - fr.ay - 3;
  rect(bxp+2, top, bw, 2, "#1a140e");
  rect(bxp+2, top, Math.max(1, Math.round(bw*(b.progress||0))), 2, "#7bd88f");
}

/* étape 3 : parcelle (cour teintée, potager, clôture) */
function cellX(i){ return (i%W)*TS; }
/* un enclos tracé est-il (au moins en partie) dans la vue ? (boîte englobante mise en cache) */
function plotVisible(b, ox, oy, w, h){
  var bb = b._bb;
  if(!bb || bb.n!==b.plot.cells.length){
    var x0 = W, y0 = H, x1 = 0, y1 = 0;
    for(var i=0;i<b.plot.cells.length;i++){ var c = b.plot.cells[i], cx = c%W, cy = (c/W)|0; if(cx<x0) x0=cx; if(cy<y0) y0=cy; if(cx>x1) x1=cx; if(cy>y1) y1=cy; }
    bb = { n:b.plot.cells.length, x0:x0*TS, y0:y0*TS, x1:(x1+1)*TS, y1:(y1+1)*TS };
    try{ Object.defineProperty(b, "_bb", { value:bb, writable:true, enumerable:false, configurable:true }); }catch(e){}
  }
  return bb.x1 > ox && bb.x0 < ox+w && bb.y1 > oy && bb.y0 < oy+h;
}
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
/* tracé pixel par pixel (Bresenham) en pixels d'art */
function pxLine(x0, y0, x1, y1, fn){
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  var dx = Math.abs(x1-x0), dy = -Math.abs(y1-y0), sx = x0<x1 ? 1 : -1, sy = y0<y1 ? 1 : -1, err = dx+dy, s = 0;
  for(;;){ fn(x0, y0, s++); if(x0===x1 && y0===y1) break; var e2 = 2*err; if(e2>=dy){ err += dy; x0 += sx; } if(e2<=dx){ err += dx; y0 += sy; } }
}
function fillPoly(poly, color){
  bx.fillStyle = color; bx.beginPath();
  for(var k=0; k<poly.length; k++){ var x = poly[k][0]*TS-OX, y = poly[k][1]*TS-OY; if(k===0) bx.moveTo(x, y); else bx.lineTo(x, y); }
  bx.closePath(); bx.fill();
}
/* côté rue laissé ouvert : pas de clôture sur la route ni contre elle */
function fenceSkip(g, px, py, dir){
  var tx = Math.floor(px/TS), ty = Math.floor(py/TS), ox = px - tx*TS, oy = py - ty*TS;
  if(g.roadAt(tx, ty)) return true;
  if(dir<0) return false;   // pâturage : clôturé tout autour
  if(dir===0) return oy<=2 && g.roadAt(tx, ty-1);
  if(dir===2) return oy>=TS-3 && g.roadAt(tx, ty+1);
  if(dir===1) return ox>=TS-3 && g.roadAt(tx+1, ty);
  return ox<=2 && g.roadAt(tx-1, ty);
}
/* clôture qui suit exactement le contour tracé, à n'importe quel angle */
function drawPolyFence(g, poly, dir, a, rail, post){
  bx.globalAlpha = a;
  for(var k=0; k<poly.length; k++){
    var A = poly[k], B = poly[(k+1)%poly.length];
    pxLine(Math.min(A[0]*TS, W*TS-1), Math.min(A[1]*TS, H*TS-1), Math.min(B[0]*TS, W*TS-1), Math.min(B[1]*TS, H*TS-1), function(x, y, st){
      if(fenceSkip(g, x, y, dir)) return;
      rect(x, y, 1, 1, rail);
      if(st%5===0) rect(x, y-2, 1, 3, post);
    });
  }
  bx.globalAlpha = 1;
}
function drawPlotGround(g, b, season, winter){
  var cells = b.plot.cells, garden = b.done && b.exts && b.exts[0]==="garden" ? yardSpots(b) : [], k;
  if(b.plot.poly){
    fillPoly(b.plot.poly, winter ? "rgba(255,255,255,0.10)" : "rgba(70,96,34,0.18)");
    for(k=0; k<garden.length; k++) spr("veg_"+season, cellX(garden[k])+8, cellY(garden[k])+12);
    drawPolyFence(g, b.plot.poly, b.plot.dir, b.done ? 1 : 0.4, WOOD_A, WOOD_B);
    return;
  }
  bx.fillStyle = winter ? "rgba(255,255,255,0.10)" : "rgba(70,96,34,0.18)";
  for(var k=1; k<cells.length; k++) bx.fillRect(cellX(cells[k])-OX, cellY(cells[k])-OY, TS, TS);
  for(k=0; k<garden.length; k++) spr("veg_"+season, cellX(garden[k])+8, cellY(garden[k])+12);
  drawFences(g.plotFences(b), b.done ? 1 : 0.4, WOOD_A, WOOD_B);
}
/* étape 3 : l'unique agrandissement remplit l'arrière-cour, à la mesure de sa taille
   (un élément pour ~2 cases, 5 au plus, répartis sur toute la cour) */
function yardSpots(b){
  var y = b.plot.cells.slice(1).sort(function(a, c){ return a-c; }), n = y.length, out = [];
  var k = Math.min(5, Math.max(1, Math.round(n/2)));
  for(var j=0; j<k && n>0; j++) out.push(y[Math.floor((j+0.5)*n/k)]);
  return out;
}
function drawYard(B, season, winter, t, now){
  var e = B.exts && B.exts[0]; if(!e || e==="garden") return;
  var sp = yardSpots(B), x, y;
  for(var j=0; j<sp.length; j++){
    var i = sp[j];
    if(e==="orchard"){ x = cellX(i)+8; y = cellY(i)+13; sh("sh_sap", x, y); obj(y, drawSprite, "fruit_"+season, x, y); }
    else if(e==="beehive"){ x = cellX(i)+6; y = cellY(i)+12; obj(y, drawSprite, "skep", x, y); }
    else if(e==="brewer"){ x = cellX(i)+5; y = cellY(i)+12; obj(y, drawSprite, "barrel", x, y); }
    else if(e==="tailor"){ x = cellX(i)+3; y = cellY(i)+11; obj(y, drawSprite, "cloth", x, y); }
    else if(e==="chicken" && !winter){
      for(var c=0; c<(sp.length<3 ? 2 : 1); c++){
        var ph = t*0.7 + B.id + j*1.7 + c*2;
        var cx2 = cellX(i) + 4 + c*5 + Math.round(Math.sin(ph)*2), cy2 = cellY(i) + 9 + c*3;
        var pk = (Math.floor(now/400) + c + j + B.id) % 3 === 0 ? 1 : 0;
        obj(cy2, drawSprite, "chick_"+((c+j)&1)+"_"+pk+((Math.sin(ph+0.2) - Math.sin(ph))<0 ? "_l" : ""), cx2, cy2);
      }
    }
  }
}

/* départ : campement des survivants (tentes et feu) et poteau du bœuf */
function drawStart(g, B, winter, now){
  var bxp = B.x*TS, byp = (B.y+B.h)*TS;
  if(B.def==="camp"){
    var cxp = bxp + TS, cyp = byp - 2;
    sh("sh_camp", cxp, cyp);
    obj(cyp, function(){ spr("camp"+(winter ? "_w" : ""), cxp, cyp); spr("fire_"+(Math.floor(now/140) + B.id) % 3, cxp - 1, cyp); });
    return;
  }
  obj(byp - 1, function(){ rect(bxp+3, byp-12, 2, 11, WOOD_B); rect(bxp+2, byp-12, 4, 1, WOOD_A); rect(bxp+5, byp-8, 5, 1, "#c9b48a"); });
  if(g.oxenHome() > 0){
    var ox = bxp + 12, oy = byp - 1;
    sh("sh_ox", ox, oy);
    obj(oy, drawSprite, "ox_"+(Math.floor(now/900) % 2)+"_l", ox, oy);
  }
}

/* étape 3 : aperçu du tracé de zone et des cases libres de cour (fourni par app.js) */
var OV = null;
var SELV = null;                    // villageois sélectionné (fiche ouverte)
var PLOT_TINTS = ["rgba(90,224,110,0.30)", "rgba(110,190,255,0.30)"];
function drawOverlay(g, now){
  var k, j;
  if(OV.pending){ /* emplacement choisi, en attente de validation */
    var pq = OV.pending, pa = 0.30 + 0.12*Math.sin(now/200);
    bx.fillStyle = "rgba(80,150,255,"+pa.toFixed(3)+")";
    bx.fillRect(pq.x*TS-OX, pq.y*TS-OY, pq.w*TS, pq.h*TS);
    corners(pq.x*TS, pq.y*TS, pq.w*TS, pq.h*TS, "#8cc4ff");
  }
  if(OV.pts){
    var pl = OV.plan, plots = (pl && !pl.err) ? pl.plots : [];
    var pastureKind = OV.kind==="pasture", fieldKind = OV.kind==="field";
    for(k=0; k<plots.length; k++){ fillPoly(plots[k].poly, pastureKind ? "rgba(120,210,90,0.30)" : fieldKind ? "rgba(150,100,50,0.35)" : PLOT_TINTS[k&1]); drawPolyFence(g, plots[k].poly, plots[k].dir, 0.95, "#f2e6c8", "#c9a45a"); }
    for(k=0; k<plots.length && !fieldKind; k++){ var hc = plots[k].cells[0]; bx.globalAlpha = 0.7; spr(pastureKind ? "shelter_none" : "burgage1_"+(k%3), cellX(hc), cellY(hc)+TS); bx.globalAlpha = 1; }
    var P = OV.pts, col = (pl && pl.err) ? "#e05a3a" : "#fff4d6", nSeg = OV.closed ? P.length : P.length-1;
    for(k=0; k<nSeg; k++){
      var A = P[k], B = P[(k+1)%P.length];
      pxLine(A[0]*TS, A[1]*TS, B[0]*TS, B[1]*TS, function(x, y){ rect(x, y+1, 1, 1, "rgba(0,0,0,0.45)"); rect(x, y, 1, 1, col); });
    }
    for(k=0; k<P.length; k++){
      var held = k===OV.grab, big = held || (k===0 && !OV.closed && P.length>=3), sz = held ? 7 : big ? 5 : 3;
      rect(Math.round(P[k][0]*TS)-(sz>>1)-1, Math.round(P[k][1]*TS)-(sz>>1)-1, sz+2, sz+2, "#1a140e");
      rect(Math.round(P[k][0]*TS)-(sz>>1), Math.round(P[k][1]*TS)-(sz>>1), sz, sz, held ? "#7bd88f" : big ? "#e8c35a" : col);
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

/* allure d'un villageois : sexe et âge (voir SPR.LOOKS) */
function lookOf(g, v){
  if(g.stageOf && g.stageOf(v)==="elder") return v.sex==="f" ? 10 : 9;
  return v.sex==="f" ? 5 + (v.id % 4) : v.id % 5;
}
function personSprite(g, f, job, body, dir){ return "p_"+lookOf(g, f)+"_"+job+"_"+body+(dir<0 ? "_l" : ""); }
/* un enfant (3 à 11 ans) : petit, sans outil, il joue près de la maison */
function drawKid(g, v, info){
  var m = info.m, now = info.now, sfx = m.dir<0 ? "_l" : "";
  var walking = WALKING[v.state] && (now - m.mt) < 300;
  var body = walking ? ["walkA","idle","walkB","idle"][(Math.floor(now/110) + v.id) % 4] : "idle";
  spr("kid_"+(v.sex==="f" ? "f" : "m")+"_"+(v.id % 4)+"_"+body+sfx, v.x*TS, v.y*TS);
}

function drawFamily(g, f, info){
  var m = info.m, now = info.now, dir = m.dir, sfx = dir<0 ? "_l" : "";
  var x = f.x*TS, y = f.y*TS;
  var herding = f.state==="work" && f.task && f.task.type==="herd";
  var tilling = f.state==="work" && f.task && FIELD_T[f.task.type];
  var walking = (WALKING[f.state] || herding || tilling) && (now - m.mt) < 300;
  var body = "idle", tool = null, up = false;
  if(walking){
    body = ["walkA","idle","walkB","idle"][(Math.floor(now/130) + f.id) % 4];
    if(herding) tool = "crook";
    else if(tilling) tool = TOOL_OF[f.task.type];   // l'outil sur l'épaule
  } else if(herding){
    tool = "crook";
  } else if(f.state==="work" && f.task && TOOL_OF[f.task.type]){
    tool = TOOL_OF[f.task.type];
    up = (Math.floor(now/300) + f.id) % 2 === 0;
    body = up ? "workU" : "workD";
    if(tool==="basket" || tool==="bow" || tool==="crook") body = "idle";
  }
  if(walking && f.task && f.task.type==="haul" && f.task.drag && f.task.phase==="bring") spr("drag_timber", x + (dir<0 ? 10 : -10), y + 1);
  if(f.carry && walking){
    var ck = f.carry.timber ? "timber" : f.carry.berries ? "berries" : f.carry.meat ? "meat" : f.carry.stone ? "stone" : f.carry.milk ? "milk" : "sack";
    spr("carry_"+ck+sfx, x, y);
  }
  spr(personSprite(g, f, info.job, body, dir), x, y);
  if(tool) spr("tool_"+tool+"_"+(up ? "u" : "d")+sfx, x, y);
}

function drawDeer(g, d, info){
  var m = info.m, now = info.now, sfx = m.dir<0 ? "_l" : "";
  var moving = (now - m.mt) < 300;
  var fr = moving ? 1 + (Math.floor(now/160) + d.id) % 2 : ((hash(d.id, Math.floor(now/2600), 7) < 0.5) ? 3 : 0);
  spr("deer_"+(d.id%3===0 ? 1 : 0)+"_"+fr+sfx, d.x*TS, d.y*TS);
}

function drawHaulOx(g, o, info){
  var m = info.m, now = info.now, left = m.dir<0, x = o.x*TS, y = o.y*TS;
  var moving = (now - m.mt) < 300;
  var lv = o.lead>0 ? g.villager(o.lead) : null, lt = lv && lv.task;
  if(lt && lt.type==="haul" && lt.phase==="bring") spr("drag_"+(lt.res==="stone" ? "stone" : "timber"), x + (left ? 16 : -16), y + 1);
  spr("ox_"+(moving ? (Math.floor(now/260) + o.id) % 2 : 0)+(left ? "_l" : ""), x, y);
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
  bakery:[[9.5,5]], smokehouse:[[7.5,5],[8.5,6]],
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
  bx.fillStyle = "rgba(207,232,242,0.75)";
  T.chunks.forEach(function(ch){
    if(!ch.ready || ch.season!==T.season) return;
    var w = ch.water;
    for(var i=0;i<w.length;i+=2){
      var px = w[i], py = w[i+1];
      if(px<x0 || px>x1 || py<y0 || py>y1) continue;
      var ph = (t*0.45 + hash(px, py, 4)*7) % 3;
      if(ph < 0.6) bx.fillRect(px-OX - (ph<0.3 ? 0 : 1), py-OY, ph<0.3 ? 2 : 3, 1);
    }
  });
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
  var cw = canvas.width, ch = canvas.height;
  var dpr = cw/(canvas.clientWidth||1);
  var S = clampScale(Math.round(cam.zoom*dpr), Math.max(1, Math.round(dpr)));
  var bw = Math.ceil(cw/S) + 2, bh = Math.ceil(ch/S) + 2;
  ensureBuf(bw, bh);
  var vx = cam.x*TS - cw/S/2, vy = cam.y*TS - ch/S/2;
  OX = Math.floor(vx); OY = Math.floor(vy);
  var fx = vx - OX, fy = vy - OY;
  var t = now/1000, season = g.season(), winter = season===0;

  /* sol : les morceaux visibles du cache (peints à la demande) */
  updateTerrain(g, OX, OY, OX+bw, OY+bh);
  bx.globalCompositeOperation = "source-over"; bx.globalAlpha = 1;
  bx.fillStyle = BG; bx.fillRect(0, 0, bw, bh);
  drawGround(bw, bh);

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
    if(b.plot && b.def!=="field" && bx1 > OX-80 && bx0 < OX+bw+80 && by1 > OY-80 && by0 < OY+bh+80){
      if(b.def==="pasture"){ if(plotVisible(b, OX, OY, bw, bh)) drawPastureGround(g, b, season, winter); }
      else drawPlotGround(g, b, season, winter);
    }
    if(b.def==="field"){ if(b.plot ? plotVisible(b, OX-16, OY-16, bw+32, bh+32) : !(bx1 < OX-16 || bx0 > OX+bw+16 || by1 < OY-16 || by0 > OY+bh+16)) drawField(g, b, season); continue; }
    if(bx1 < OX-16 || bx0 > OX+bw+16 || by1 < OY-16 || by0 > OY+bh+16) continue;
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
      if(bakedTile(g, tx, ty)) continue;        // cœur de forêt : ses arbres sont déjà peints dans le sol
      var specs = treeSpecs(g, tx, ty, season);
      for(var k=0;k<specs.length;k++){ var sp0 = specs[k]; sh(sp0.sh, sp0.x, sp0.y); obj(sp0.y, drawTree, sp0.n, sp0.x, sp0.y); }
      if(g.treeWood[ti]<=2){ var spx = tx*TS+12, spy = ty*TS+13; obj(spy, drawSprite, "stump", spx, spy); }
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
    if(B.def==="camp" || B.def==="oxpost"){ drawStart(g, B, winter, now); continue; }
    var name = buildingSprite(g, B, winter, byId);
    if(!name || !SPR.frames[name]) continue;
    var fr = SPR.frames[name], bxp = B.x*TS, byp = (B.y+B.h)*TS;
    if(bxp - fr.ax + fr.w < OX - 4 || bxp - fr.ax > OX + bw + 4 || byp - fr.ay > OY + bh + 4 || byp - fr.ay + fr.h < OY - 30) continue;
    if(B.done) sh(name, bxp + (TALL[B.def] ? 4 : 3), byp + 2);
    obj(byp - 0.5, drawBuilding, g, B, { name:name, now:now });
    if(B.done && B.def==="burgage" && B.plot) drawYard(B, season, winter, t, now);
    if(B.done && B.def==="pasture" && B.herd && plotVisible(B, OX-40, OY-40, bw+80, bh+80)) drawHerd(g, B, winter, t, now);
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
    var oxIdle = g.oxenHome();
    if(B.done && B.def==="farm" && oxIdle>0 && !winter){
      for(var o2=0; o2<Math.min(3, oxIdle); o2++){
        var oxx = bxp + 6 + o2*16 + Math.round(Math.sin(t*0.15 + o2*2.1)*4), oyy = byp + 10 + (o2&1)*4;
        var odir = Math.cos(t*0.15 + o2*2.1) < 0 ? "_l" : "";
        sh("sh_ox", oxx, oyy);
        obj(oyy, drawSprite, "ox_"+((Math.floor(now/500)+o2)%2 && Math.abs(Math.cos(t*0.15+o2*2.1))>0.3 ? 1 : 0)+odir, oxx, oyy);
      }
    }
    if(B.def==="field" ) continue;
  }
  // gerbes (céréales, lin) ou meules (foin, pois) sur les champs récoltés, jusqu'au labour suivant
  var mIdx = g.monthIdx ? g.monthIdx() : 0;
  for(var fj=0; fj<g.buildings.length; fj++){
    var F = g.buildings[fj];
    if(F.def!=="field" || !F.f || winter) continue;
    var Ff = F.f, cropNow = Ff.sown ? (Ff.sownCrop || Ff.crop) : Ff.prev, cdq = CROP_DEFS[cropNow];
    if(!cdq || !cdq.yield) continue;
    var Fc = g.fieldCells(F), Fn = Fc.length;
    var harvested = Ff.sown ? Math.floor((Ff.harvestP||0)*Fn) : ((mIdx - (Ff.stubAt||-999) <= 1 && (Ff.plow||0)<=0 && !(Ff.dungP>0)) ? Fn : 0);
    var pile = (cdq.season==="meadow" || cdq.id==="peas") ? "haycock" : "sheaf";
    for(var q=0;q<harvested;q++){
      if(hash(F.id, q, 2) > (pile==="haycock" ? 0.22 : 0.35)) continue;
      var qx = (Fc[q]%W)*TS + 6 + Math.floor(hash(F.id,q,3)*5), qy = ((Fc[q]/W)|0)*TS + 10;
      obj(qy, drawSprite, pile, qx, qy);
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
  /* villageois : les nourrissons restent à la maison, les enfants jouent autour, les adultes travaillent */
  var VS = g.villagers || [];
  for(var fi=0; fi<VS.length; fi++){
    var Fm = VS[fi];
    var stg = g.stageOf ? g.stageOf(Fm) : "adult";
    if(stg==="baby") continue;
    var fm = track("v"+Fm.id, Fm.x, Fm.y, now);
    if(Fm.x*TS < vx0 || Fm.x*TS > vx1 || Fm.y*TS < vy0 || Fm.y*TS > vy1) continue;
    if(stg==="child"){
      sh("sh_person", Fm.x*TS, Fm.y*TS);
      obj(Fm.y*TS, drawKid, g, Fm, { m:fm, now:now });
      continue;
    }
    var wb = Fm.work>=0 ? byId[Fm.work] : null;
    var job = (wb && JOBSET[wb.def]) ? wb.def : "laborer";
    sh("sh_person", Fm.x*TS, Fm.y*TS);
    obj(Fm.y*TS, drawFamily, g, Fm, { m:fm, now:now, job:job });
  }
  /* étape 5 bis : bœufs menés par un journalier (troncs ou pierres derrière eux), ou laissés en chemin */
  for(var oj=0; oj<g.oxen.length; oj++){
    var Ox = g.oxen[oj];
    if(!g.oxAway(Ox) || !isFinite(Ox.x) || !isFinite(Ox.y)) continue;
    var om = track("o"+Ox.id, Ox.x, Ox.y, now);
    if(Ox.x*TS < vx0 - 20 || Ox.x*TS > vx1 + 20 || Ox.y*TS < vy0 || Ox.y*TS > vy1 + 10) continue;
    sh("sh_ox", Ox.x*TS, Ox.y*TS);
    obj(Ox.y*TS, drawHaulOx, g, Ox, { m:om, now:now });
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

  /* villageois sélectionné : une flèche dorée rebondit au-dessus de sa tête */
  if(SELV!=null && g.villager){
    var sv = g.villager(SELV);
    if(sv){
      var kidS = g.stageOf && (g.stageOf(sv)==="child" || g.stageOf(sv)==="baby");
      var bob = Math.round(Math.abs(Math.sin(now/220))*2);
      spr("mark_"+(Math.floor(now/450)%2), sv.x*TS, sv.y*TS - (kidS ? 11 : 15) - bob);
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
      var gn = buildingSprite(g, { def:buildSel, id:1, lvl:1, x:hover.tx, y:hover.ty, w:bd.w, h:bd.h, preview:true, exts:[], churchUp:[] }, winter, byId);
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
  else if(g.wx==="drought" && !winter) grade = "#fdf0d2";   // étape 5 : printemps sec
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
  /* la carte est grande : la minicarte garde une taille fixe à l'écran */
  var ppt = Math.min(2, 136/W), mw = Math.round(W*ppt), mh = Math.round(H*ppt);
  /* en haut à droite : le bas de l'écran est réservé aux panneaux et à l'aide de pose */
  var mmx = (canvas.clientWidth||1) - 8 - mw, mmy = 8;
  if(mmx > 120 && (canvas.clientHeight||1) > mh + 160){
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#3a2a1c"; ctx.fillRect(mmx-3, mmy-3, mw+6, mh+6);
    ctx.fillStyle = "#c9a45a"; ctx.fillRect(mmx-2, mmy-2, mw+4, mh+4);
    ctx.drawImage(T.mm, 0, 0, W, H, mmx, mmy, mw, mh);
    ctx.fillStyle = "#7fae4a";
    for(var mp=0; mp<g.buildings.length; mp++){
      var Bp = g.buildings[mp]; if(Bp.def!=="pasture" || !Bp.plot) continue;
      for(var mq=1; mq<Bp.plot.cells.length; mq++){ var mc0 = Bp.plot.cells[mq]; ctx.fillRect(mmx+(mc0%W)*ppt, mmy+((mc0/W)|0)*ppt, Math.max(1, ppt), Math.max(1, ppt)); }
    }
    for(var mb=0; mb<g.buildings.length; mb++){
      var Bm = g.buildings[mb];
      ctx.fillStyle = Bm.def==="field" ? "#d6b44a" : (Bm.done ? "#f2e6c8" : "#c97a4a");
      ctx.fillRect(Math.floor(mmx+Bm.x*ppt), Math.floor(mmy+Bm.y*ppt), Math.max(1, Math.round(Bm.w*ppt)), Math.max(1, Math.round(Bm.h*ppt)));
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

return { drawGame:drawGame, setOverlay:function(o){ OV = o || null; }, setSelVillager:function(id){ SELV = (id===undefined ? null : id); }, lookOf:lookOf, snapZoom:snapZoom, stepZoom:stepZoom, stats:function(){ return { terrainPaintMs: T ? T.paintMs : null, chunks: T ? T.chunks.size : 0, sprites: SPR.count, atlasMs: SPR.buildMs }; } };
})();

/* points d'entrée utilisés par app.js */
function drawGame(ctx, g, cam, canvas, hover, buildSel, selId, layers, now){
  return RENDER.drawGame(ctx, g, cam, canvas, hover, buildSel, selId, layers, now);
}
function snapZoom(z){ return RENDER.snapZoom(z); }
function stepZoom(z, dir){ return RENDER.stepZoom(z, dir); }
