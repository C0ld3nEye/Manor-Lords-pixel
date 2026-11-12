/* ================= SPRITES PIXEL-ART =================
   Tous les sprites sont dessinés pixel par pixel au démarrage (aucun fichier image),
   puis rangés dans un atlas unique (un seul canvas) pour un rendu rapide sur mobile.
   Convention : 1 tuile = 16 × 16 pixels d'art. Lumière venant du haut-gauche.
   Saisons : 0 hiver, 1 printemps, 2 été, 3 automne (comme seasonOf de sim.js).
   ===================================================== */
var SPR = (function(){
"use strict";

/* ---------- couleurs ---------- */
function C(hex, a){
  if(!hex) return 0;
  var n = parseInt(hex.slice(1), 16);
  var r = (n>>16)&255, g = (n>>8)&255, b = n&255;
  return (((a===undefined?255:a)<<24) | (b<<16) | (g<<8) | r) >>> 0;
}
function mix(h1, h2, t){
  var a = parseInt(h1.slice(1),16), b = parseInt(h2.slice(1),16);
  var r = Math.round(((a>>16)&255)*(1-t) + ((b>>16)&255)*t);
  var g = Math.round(((a>>8)&255)*(1-t) + ((b>>8)&255)*t);
  var bl = Math.round((a&255)*(1-t) + (b&255)*t);
  return "#"+((1<<24)|(r<<16)|(g<<8)|bl).toString(16).slice(1);
}

/* Palette maîtresse : tons terreux, médiévaux, légèrement désaturés. */
var P = {
  ink:"#1e1712", inkSoft:"#2c2219",
  // bois
  wood0:"#2e2016", wood1:"#4a3322", wood2:"#6b4a30", wood3:"#8c6642", wood4:"#ad8758",
  // chaume
  th0:"#5e4520", th1:"#86662e", th2:"#a9853f", th3:"#c8a556", th4:"#e0c675",
  // torchis / enduit
  da0:"#8f8068", da1:"#b9a988", da2:"#d6cbae", da3:"#ebe3cc",
  // pierre
  st0:"#3a3f47", st1:"#565d67", st2:"#767e88", st3:"#9aa2ab", st4:"#c3c9cf",
  // tuiles d'argile
  cl0:"#4e2219", cl1:"#7a3527", cl2:"#9d4733", cl3:"#bd6243",
  // ardoise
  sl0:"#262c36", sl1:"#3b4452", sl2:"#525e6e", sl3:"#6c7a8c",
  // bardeaux
  sh0:"#3b2a1f", sh1:"#5b4130", sh2:"#7a5940", sh3:"#957253",
  // peau, cheveux
  sk0:"#a8704e", sk1:"#d9a17a", sk2:"#f0c49a",
  hrBrown:"#5a3820", hrBlond:"#c9a24e", hrBlack:"#2a2220", hrRed:"#9a4a26", hrGrey:"#9a958c",
  // tissus
  red0:"#5c1a1c", red1:"#8e2a2a", red2:"#b83c34",
  gold0:"#7a5a1a", gold1:"#c09030", gold2:"#e8c35a",
  blue0:"#1f3550", blue1:"#2f5577", blue2:"#4a78a0",
  linen:"#e6dcc4", linen0:"#bfb294",
  // eau
  wa0:"#1d3b52", wa1:"#285a78", wa2:"#3a7598", wa3:"#5d98b8", wa4:"#a6d0e2",
  // terre
  dt0:"#3e2e20", dt1:"#5e4630", dt2:"#7d6244", dt3:"#9a7d58", dt4:"#b39a72",
  // neige
  sn0:"#9fb0c2", sn1:"#c3d0dc", sn2:"#e2e9ef", sn3:"#f7fafc",
  // végétation de base
  lf0:"#1f3a22", lf1:"#2e5530", lf2:"#3f7238", lf3:"#5a9140", lf4:"#80b150",
  fire0:"#a83a1a", fire1:"#e07a24", fire2:"#f6c64a", fire3:"#fff2b0",
};

/* Rampes de feuillage par saison (sombre → clair). */
var LEAF = {
  oak: [
    ["#3c4a3a","#55604a","#6d7558","#8a8c6c"],                 // hiver (inutilisé : arbres nus)
    ["#2c5a2a","#3f7a32","#5c9a3e","#86bd52","#b6db7a"],       // printemps
    ["#1e4224","#2c5a2c","#3e7334","#5a8f3e","#7aab4c"],       // été
    ["#5a2a14","#8a4218","#b8641e","#d6902c","#ecbc4a"],       // automne
  ],
  birch: [
    null,
    ["#3c6a2a","#55893a","#77a84a","#a0c860","#c8e48a"],
    ["#2e5428","#467036","#628c42","#86aa52","#a6c46a"],
    ["#6a4a10","#9a7018","#c49a26","#e2c044","#f4dc78"],
  ],
  pine: ["#132a22","#1d3d2e","#2a523a","#3a6a48","#558a5a"],
  bush: [
    ["#4a3a2a","#6a5236","#8a6c48"],
    ["#24512a","#357036","#4e8c40","#72aa52"],
    ["#1c4426","#2a5a2e","#3c7236","#5a8a42"],
    ["#4a3016","#6e4a1e","#8e6a2a","#a8843a"],
  ],
};

/* ---------- hasard déterministe ---------- */
function hash(x, y, s){
  var h = (x*374761393 + y*668265263 + (s||0)*2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
function rng(seed){
  var a = seed|0;
  return function(){
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
var BAYER = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
function bayer(x, y){ return (BAYER[(y&3)*4 + (x&3)] + 0.5) / 16; }

/* ---------- toile de pixels ---------- */
function Px(w, h){ this.w = w; this.h = h; this.d = new Uint32Array(w*h); }
Px.prototype.p = function(x, y, c){
  x = x|0; y = y|0;
  if(x<0 || y<0 || x>=this.w || y>=this.h) return this;
  if(c === null){ this.d[y*this.w + x] = 0; return this; }
  if(!c) return this;
  this.d[y*this.w + x] = (typeof c === "string") ? C(c) : c;
  return this;
};
Px.prototype.g = function(x, y){
  if(x<0 || y<0 || x>=this.w || y>=this.h) return 0;
  return this.d[y*this.w + x];
};
Px.prototype.r = function(x, y, w, h, c){
  for(var j=0;j<h;j++) for(var i=0;i<w;i++) this.p(x+i, y+j, c);
  return this;
};
Px.prototype.ln = function(x0, y0, x1, y1, c){
  x0|=0; y0|=0; x1|=0; y1|=0;
  var dx = Math.abs(x1-x0), sx = x0<x1?1:-1, dy = -Math.abs(y1-y0), sy = y0<y1?1:-1, err = dx+dy;
  for(;;){
    this.p(x0, y0, c);
    if(x0===x1 && y0===y1) break;
    var e2 = 2*err;
    if(e2 >= dy){ err += dy; x0 += sx; }
    if(e2 <= dx){ err += dx; y0 += sy; }
  }
  return this;
};
/* ellipse pleine ; c peut être une fonction (nx, ny, x, y) -> couleur */
Px.prototype.el = function(cx, cy, rx, ry, c){
  for(var y=Math.floor(cy-ry); y<=Math.ceil(cy+ry); y++){
    for(var x=Math.floor(cx-rx); x<=Math.ceil(cx+rx); x++){
      var nx = (x+0.5-cx)/rx, ny = (y+0.5-cy)/ry;
      if(nx*nx + ny*ny <= 1){
        var col = (typeof c === "function") ? c(nx, ny, x, y) : c;
        if(col) this.p(x, y, col);
      }
    }
  }
  return this;
};
/* contour : chaque pixel vide touchant un pixel plein prend la couleur c */
Px.prototype.outline = function(c, onlyBelow){
  var w = this.w, h = this.h, src = this.d.slice(), cc = (typeof c === "string") ? C(c) : c;
  for(var y=0;y<h;y++) for(var x=0;x<w;x++){
    if(src[y*w+x]) continue;
    var n = (y>0 && src[(y-1)*w+x]) || (!onlyBelow && y<h-1 && src[(y+1)*w+x]) ||
            (!onlyBelow && x>0 && src[y*w+x-1]) || (!onlyBelow && x<w-1 && src[y*w+x+1]);
    if(n) this.d[y*w+x] = cc;
  }
  return this;
};
/* assombrit le bord bas/droit intérieur d'une forme (volume) */
Px.prototype.rim = function(c){
  var w = this.w, h = this.h, src = this.d.slice(), cc = C(c);
  for(var y=0;y<h;y++) for(var x=0;x<w;x++){
    if(!src[y*w+x]) continue;
    if((y<h-1 && !src[(y+1)*w+x]) || (x<w-1 && !src[y*w+x+1])) this.d[y*w+x] = cc;
  }
  return this;
};
Px.prototype.blit = function(o, dx, dy){
  for(var y=0;y<o.h;y++) for(var x=0;x<o.w;x++){ var c = o.d[y*o.w+x]; if(c) this.p(dx+x, dy+y, c); }
  return this;
};
Px.prototype.flip = function(){
  var o = new Px(this.w, this.h);
  for(var y=0;y<this.h;y++) for(var x=0;x<this.w;x++) o.d[y*this.w + (this.w-1-x)] = this.d[y*this.w+x];
  return o;
};
Px.prototype.clone = function(){ var o = new Px(this.w, this.h); o.d.set(this.d); return o; };
/* recolorie : table {ancienne:nouvelle} en hex */
Px.prototype.recolor = function(map){
  var m = {};
  for(var k in map) m[C(k)] = C(map[k]);
  for(var i=0;i<this.d.length;i++){ var n = m[this.d[i]]; if(n !== undefined) this.d[i] = n; }
  return this;
};
/* teinte globale (pour les fantômes de construction, la neige...) */
Px.prototype.tint = function(hex, t){
  var tr = parseInt(hex.slice(1,3),16), tg = parseInt(hex.slice(3,5),16), tb = parseInt(hex.slice(5,7),16);
  for(var i=0;i<this.d.length;i++){
    var c = this.d[i]; if(!c) continue;
    var r = c&255, g = (c>>8)&255, b = (c>>16)&255, a = (c>>>24);
    r = Math.round(r*(1-t) + tr*t); g = Math.round(g*(1-t) + tg*t); b = Math.round(b*(1-t) + tb*t);
    this.d[i] = ((a<<24)|(b<<16)|(g<<8)|r)>>>0;
  }
  return this;
};
/* dessin depuis une grille de caractères */
Px.fromStrings = function(rows, legend){
  var h = rows.length, w = 0;
  for(var i=0;i<h;i++) w = Math.max(w, rows[i].length);
  var o = new Px(w, h);
  for(var y=0;y<h;y++) for(var x=0;x<rows[y].length;x++){
    var ch = rows[y][x];
    if(ch !== "." && ch !== " " && legend[ch]) o.p(x, y, legend[ch]);
  }
  return o;
};

/* ======================================================
   VÉGÉTATION
   ====================================================== */

/* houppier ombré : pixels groupés en touffes 2×2, lumière haut-gauche */
function canopy(o, cx, cy, rx, ry, ramp, seed, rough){
  rough = rough===undefined ? 0.22 : rough;
  o.el(cx, cy, rx+1, ry+1, function(nx, ny, x, y){
    var edge = nx*nx + ny*ny;
    var bump = (hash(x>>1, y>>1, seed) - 0.5) * rough * 2;
    if(edge > 1 + bump - 0.18) return 0;
    var light = -(nx*0.55 + ny*0.85);
    var t = 0.42 + light*0.42 + (hash(x>>1, (y+1)>>1, seed+7)-0.5)*0.45 + (hash(x, y, seed+3)-0.5)*0.12;
    var i = Math.max(0, Math.min(ramp.length-1, Math.floor(t*ramp.length)));
    return ramp[i];
  });
}

function trunk(o, x, y0, y1, w){
  for(var y=y0; y<=y1; y++){
    for(var i=0;i<w;i++){
      var c = i===0 ? P.wood3 : (i===w-1 ? P.wood1 : P.wood2);
      o.p(x+i, y, c);
    }
  }
  // racines
  o.p(x-1, y1, P.wood1); o.p(x+w, y1, P.wood0);
}

function branches(o, x, y, len, ang, depth, rnd, col){
  if(depth<=0 || len<2) return;
  var x2 = x + Math.cos(ang)*len, y2 = y + Math.sin(ang)*len;
  o.ln(Math.round(x), Math.round(y), Math.round(x2), Math.round(y2), col);
  var n = depth>2 ? 2 : (rnd()<0.6?2:1);
  for(var i=0;i<n;i++){
    var a = ang + (i===0?-1:1)*(0.35 + rnd()*0.45);
    branches(o, x2, y2, len*(0.62+rnd()*0.15), a, depth-1, rnd, depth>2?P.wood1:P.wood2);
  }
}

/* Chêne : 20 × 26, pied à (10, 25) */
function oak(season, v){
  var o = new Px(20, 26), rnd = rng(100+v*17+season);
  var sc = [1, 0.9, 1.08][v%3];
  var top = Math.round(26 - 26*sc);
  if(season===0){
    trunk(o, 9, 14, 25, 3);
    branches(o, 10, 15, 6*sc, -Math.PI/2, 4, rnd, P.wood1);
    branches(o, 10, 17, 5*sc, -Math.PI/2-0.9, 3, rnd, P.wood1);
    branches(o, 10, 17, 5*sc, -Math.PI/2+0.9, 3, rnd, P.wood1);
    // neige sur les branches
    for(var y=1;y<o.h;y++) for(var x=0;x<o.w;x++){
      if(o.g(x,y) && !o.g(x,y-1) && hash(x,y,v)<0.55) o.p(x, y-1, P.sn3);
    }
    return o;
  }
  var ramp = LEAF.oak[season];
  if(season===3 && v===1) ramp = ["#4a2414","#7a2e18","#a43a1c","#c8582a","#e0843a"];
  trunk(o, 9, 15, 25, 3);
  var cy = 11 + (1-sc)*8;
  canopy(o, 10, cy, 8*sc, 7*sc, ramp, v*31+season);
  canopy(o, 5, cy+3, 4.5*sc, 4*sc, ramp, v*31+season+1);
  canopy(o, 15, cy+3, 4.5*sc, 4*sc, ramp, v*31+season+2);
  canopy(o, 10, cy-4*sc, 5.5*sc, 4.5*sc, ramp, v*31+season+3);
  o.outline(C(ramp[0]==="#1e4224"?"#14301a":mix(ramp[0], P.ink, 0.45)));
  // fleurs de printemps sur un chêne sur deux
  if(season===1 && v!==1){
    for(var k=0;k<14;k++){
      var fx = 3 + Math.floor(rnd()*14), fy = Math.floor(top + 2 + rnd()*12);
      var c = o.g(fx, fy);
      if(c && c !== C(ramp[0])) o.p(fx, fy, v===0 ? "#f4f0e6" : "#f2b8c8");
    }
  }
  return o;
}

/* Pin / sapin : 14 × 28, pied à (7, 27) */
function pine(season, v){
  var o = new Px(14, 28);
  var sc = v===0 ? 1 : 0.86;
  var ramp = LEAF.pine;
  // tronc
  o.r(6, 22, 2, 6, P.wood2); o.p(7, 22, P.wood1); o.p(7,23,P.wood1); o.p(5, 27, P.wood1); o.p(8, 27, P.wood0);
  var tiers = 4, base = 24, h = Math.round(22*sc), top = base - h;
  for(var t=0;t<tiers;t++){
    var ty0 = top + Math.round(t*h/tiers*0.82), ty1 = ty0 + Math.round(h/tiers*1.25);
    if(t===tiers-1) ty1 = base;
    var hw0 = 1 + t*0.6, hw1 = 2.5 + (t+1)*1.25*sc;
    for(var y=ty0; y<=ty1; y++){
      var f = (y-ty0)/Math.max(1, ty1-ty0);
      var hw = hw0 + (hw1-hw0)*f;
      for(var x=Math.floor(7-hw); x<=Math.ceil(6+hw); x++){
        var nx = (x+0.5-7)/hw;
        var light = -nx*0.6 - (f-0.5)*0.5 + (hash(x,y,v+t)-0.5)*0.5;
        var i = Math.max(0, Math.min(4, Math.floor(2 + light*2.2)));
        if(y===ty1 || (y===ty1-1 && hash(x,y,9)<0.4)) i = 0;
        o.p(x, y, ramp[i]);
      }
    }
    if(season===0){
      for(var x2=0;x2<14;x2++){
        for(var y2=ty0;y2<=ty1;y2++){
          if(o.g(x2,y2)){ o.p(x2, y2, P.sn3); if(hash(x2,y2,3)<0.6) o.p(x2, y2+1, P.sn1); break; }
        }
      }
    }
  }
  o.outline(C("#0c1a14"));
  return o;
}

/* Bouleau : 14 × 26, pied à (7, 25) */
function birch(season, v){
  var o = new Px(14, 26), rnd = rng(300+v*13+season);
  // tronc blanc à marques noires
  for(var y=12;y<=25;y++){ o.p(6, y, "#e8e4da"); o.p(7, y, "#c8c2b4"); if(hash(6,y,v)<0.25) o.p(6+(y&1), y, P.ink); }
  o.p(5, 25, "#a8a294"); o.p(8, 25, "#8a8478");
  if(season===0){
    branches(o, 7, 13, 5, -Math.PI/2, 4, rnd, "#7a6a5a");
    branches(o, 7, 15, 4, -Math.PI/2-1.0, 3, rnd, "#7a6a5a");
    branches(o, 7, 15, 4, -Math.PI/2+1.0, 3, rnd, "#7a6a5a");
    for(var yy=1;yy<o.h;yy++) for(var xx=0;xx<o.w;xx++) if(o.g(xx,yy) && !o.g(xx,yy-1) && hash(xx,yy,v)<0.5) o.p(xx, yy-1, P.sn3);
    for(var y3=12;y3<=25;y3++){ o.p(6, y3, "#e8e4da"); o.p(7, y3, "#c8c2b4"); if(hash(6,y3,v)<0.25) o.p(6+(y3&1), y3, P.ink); }
    return o;
  }
  var ramp = LEAF.birch[season];
  canopy(o, 7, 9, 5.5, 7.5, ramp, 500+v, 0.35);
  canopy(o, 4, 13, 3, 3.5, ramp, 501+v, 0.35);
  canopy(o, 10, 12, 3, 3.5, ramp, 502+v, 0.35);
  o.outline(C(mix(ramp[0], P.ink, 0.5)));
  // le tronc reste visible sous le feuillage
  for(var y4=17;y4<=25;y4++){ o.p(6, y4, "#e8e4da"); o.p(7, y4, "#c8c2b4"); if(hash(6,y4,v)<0.25) o.p(6+(y4&1), y4, P.ink); }
  return o;
}

/* Jeune arbre (forêt en partie abattue) : 10 × 15 */
function sapling(season, v){
  var o = new Px(10, 15);
  o.r(4, 9, 2, 6, P.wood2); o.p(5,10,P.wood1);
  if(season===0 && v===0){
    o.ln(5,9,2,4,P.wood1); o.ln(5,9,8,5,P.wood1); o.ln(5,8,5,2,P.wood1);
    o.p(2,3,P.sn3); o.p(8,4,P.sn3); o.p(5,1,P.sn3);
    return o;
  }
  var ramp = v===1 ? LEAF.pine : (season===0 ? LEAF.pine : LEAF.oak[season]);
  canopy(o, 5, 6, 4, 4.5, ramp, 700+v+season, 0.3);
  o.outline(C(mix(ramp[0], P.ink, 0.45)));
  if(season===0) for(var x=0;x<10;x++) for(var y=0;y<10;y++) if(o.g(x,y)){ o.p(x,y,P.sn3); break; }
  return o;
}

function stump(){
  var o = new Px(7, 5);
  o.r(1, 1, 5, 4, P.wood2); o.r(1, 1, 5, 1, P.wood4); o.p(3,1,P.wood3);
  o.p(0, 4, P.wood1); o.p(6, 4, P.wood1); o.r(5,2,1,3,P.wood1);
  o.outline(C(P.ink));
  return o;
}

/* Buisson à baies : 13 × 10, pied à (6, 9). n = nombre de baies visibles */
function bush(season, v, n){
  var o = new Px(13, 10);
  var ramp = LEAF.bush[season];
  if(season===0){
    var rnd = rng(900+v);
    for(var k=0;k<6;k++) o.ln(6, 9, 1+Math.floor(rnd()*11), 2+Math.floor(rnd()*4), k&1?P.wood1:P.wood2);
    for(var x=0;x<13;x++) for(var y=0;y<10;y++) if(o.g(x,y)){ o.p(x, y-1, P.sn3); break; }
    return o;
  }
  canopy(o, 6.5, 5.5, 5.5, 3.8, ramp, 800+v, 0.3);
  o.outline(C(mix(ramp[0], P.ink, 0.5)));
  var spots = [[3,4],[8,3],[5,6],[10,6],[2,7],[7,7],[9,4]];
  for(var i=0;i<Math.min(n, spots.length);i++){
    var s = spots[(i+v*3)%spots.length];
    o.p(s[0], s[1], season===3 ? "#7a1a3a" : "#c42a2a"); o.p(s[0]+1, s[1], season===3 ? "#5a1028" : "#8a1a1e");
    o.p(s[0], s[1]-1, "#f08a7a");
  }
  return o;
}

/* Rochers d'un gisement : taille 0..2, 14 × 11 */
function rocks(season, size, v){
  var o = new Px(16, 12), rnd = rng(1200+v*7+size);
  var list = size===2 ? [[5,7,5,4],[11,8,4,3],[8,4,3.5,3]] : size===1 ? [[6,8,4.5,3.5],[11,9,3,2.5]] : [[7,9,3.5,2.5]];
  for(var k=0;k<list.length;k++){
    var b = list[(k+v)%list.length], ox = (v%2)*1;
    o.el(b[0]+ox, b[1], b[2], b[3], function(nx, ny, x, y){
      var light = -(nx*0.6 + ny*0.8) + (hash(x,y,v+k)-0.5)*0.4;
      return light>0.55 ? P.st4 : light>0.1 ? P.st3 : light>-0.4 ? P.st2 : P.st1;
    });
  }
  o.outline(C(P.st0));
  // fissures + mousse / neige
  for(var y=0;y<12;y++) for(var x=0;x<16;x++){
    var c = o.g(x,y);
    if(!c || c===C(P.st0)) continue;
    if(season===0 && !o.g(x,y-1)) o.p(x, y, P.sn3);
    else if((season===1||season===2) && !o.g(x,y-1) && hash(x,y,size)<0.35) o.p(x, y, "#5e7a3e");
    else if(hash(x,y,v+5)<0.05) o.p(x, y, P.st1);
  }
  return o;
}

/* ======================================================
   MATÉRIAUX (toits, murs, menuiseries)
   ====================================================== */
var ROOF = {
  thatch:  [P.th0, P.th1, P.th2, P.th3, P.th4],
  clay:    [P.cl0, P.cl1, P.cl2, P.cl3, "#d68058"],
  slate:   [P.sl0, P.sl1, P.sl2, P.sl3, "#8a98a8"],
  shingle: [P.sh0, P.sh1, P.sh2, P.sh3, "#b08a66"],
  hide:    ["#4a3424","#6e5038","#8e6c4c","#a88866","#c4a684"],
  canvas:  ["#7a6e5a","#a39880","#c4b89c","#ddd2b6","#f0e8d2"],
};
function clampI(i, n){ return i<0 ? 0 : (i>n-1 ? n-1 : i); }
/* couleur d'un toit au pixel (x,y), décalage d'ombre sh (-2..+2) */
function roofPix(type, x, y, sh, seed){
  var ramp = ROOF[type], i = 2;
  if(type==="thatch" || type==="hide"){
    var n = hash(x, y>>1, 77+(seed||0));
    i = n<0.22 ? 1 : n<0.72 ? 2 : n<0.94 ? 3 : 4;
    if(y%3===2) i--;
  } else if(type==="canvas"){
    i = 3;
  } else {
    var course = y>>1, row = y&1;
    i = row===0 ? 3 : 2;
    var period = type==="slate" ? 4 : 3;
    if(row===1 && ((x + course*2) % period)===0) i = 1;
    if(hash(x>>1, course, 5+(seed||0))<0.15) i--;
  }
  return ramp[clampI(i+sh, ramp.length)];
}

/* toit « long » (faîtage parallèle à la façade), vu en 3/4 : trapèze */
function roofHip(o, x0, x1, yTop, yBot, inset, type, opts){
  opts = opts || {};
  for(var y=yTop; y<=yBot; y++){
    var f = (y-yTop)/Math.max(1, yBot-yTop);
    var xl = Math.round(x0 + inset*(1-f)), xr = Math.round(x1 - inset*(1-f));
    for(var x=xl; x<=xr; x++){
      var sh = 0;
      if(x-xl < 2 && inset>0) sh = 1;          // pente gauche éclairée
      if(xr-x < 2 && inset>0) sh = -1;         // pente droite ombrée
      if(y===yTop) sh = Math.max(sh, 1);       // faîtage
      if(y>=yBot-1) sh = -1;                   // bord d'avant-toit
      var c = roofPix(type, x, y, sh, opts.seed);
      if(y===yBot) c = ROOF[type][0];
      o.p(x, y, c);
    }
  }
  if(type==="thatch"){ // chaume épais : bord arrondi
    o.p(x0, yBot, null); o.p(x1, yBot, null);
  }
}

/* toit à pignon en façade : deux pans qui fuient vers l'arrière (forme en chevron) */
function roofGable(o, x0, x1, eaveY, apexY, depth, type, opts){
  opts = opts || {};
  var cx = (x0 + x1)/2;
  for(var x=x0; x<=x1; x++){
    var t = Math.abs(x+0.5 - (cx+0.5)) / ((x1-x0)/2 + 0.5);       // 0 au faîtage, 1 au bord
    var yb = Math.round(apexY + (eaveY-apexY)*t);                  // bas du pan
    var yt = yb - depth;
    var left = x+0.5 < cx+0.5;
    for(var y=yt; y<=yb; y++){
      var sh = left ? 1 : -1;
      if(Math.abs(x+0.5-(cx+0.5))<1) sh = 1;                       // arête du faîtage
      if(y>=yb-1) sh -= 1;                                          // rive
      var c = roofPix(type, x, y, sh, opts.seed);
      if(y===yb) c = ROOF[type][0];
      o.p(x, y, c);
    }
  }
}
/* triangle du pignon (sous le toit à pignon) */
function gableFill(o, x0, x1, eaveY, apexY, baseY, mat){
  var cx = (x0 + x1)/2;
  for(var x=x0+1; x<=x1-1; x++){
    var t = Math.abs(x+0.5 - (cx+0.5)) / ((x1-x0)/2 + 0.5);
    var yb = Math.round(apexY + (eaveY-apexY)*t) + 1;
    for(var y=yb; y<baseY; y++) o.p(x, y, wallPix(mat, x, y, x-x0, x1-x0));
  }
  if(mat==="daub"){ // poinçon et entrait
    var mx = Math.round(cx);
    for(var y2=apexY+2; y2<baseY; y2++) o.p(mx, y2, P.wood1);
    o.r(x0+1, baseY-1, x1-x0-1, 1, P.wood1);
  }
}

function wallPix(mat, x, y, rx, w){
  var right = rx > w*0.66;
  if(mat==="daub"){
    var c = hash(x,y,11)<0.08 ? P.da1 : (hash(x,y,12)<0.06 ? P.da3 : P.da2);
    if(right && c===P.da2) c = P.da1;
    return c;
  }
  if(mat==="stone"){
    var course = Math.floor(y/2), off = (course&1)*2;
    var bx = Math.floor((x+off)/4);
    if((y&1)===1 && hash(bx, course, 3)<0.4) return P.st1;
    if(((x+off)&3)===0) return P.st1;
    var c2 = hash(bx, course, 4)<0.5 ? P.st2 : P.st3;
    if(right) c2 = c2===P.st3 ? P.st2 : P.st1;
    return c2;
  }
  if(mat==="plank"){
    var seam = (x%3)===0;
    var c3 = seam ? P.wood1 : (hash(x,(y>>2),9)<0.5 ? P.wood3 : P.wood2);
    if(right && c3===P.wood3) c3 = P.wood2;
    return c3;
  }
  if(mat==="log"){
    var r = y%3;
    return r===0 ? P.wood3 : (r===1 ? P.wood2 : P.wood1);
  }
  return P.da2;
}
/* mur de façade (rx = position relative pour l'ombrage) */
function wall(o, x0, y0, w, h, mat, frame){
  for(var y=y0; y<y0+h; y++) for(var x=x0; x<x0+w; x++) o.p(x, y, wallPix(mat, x, y, x-x0, w));
  if(frame){ // colombages
    o.r(x0, y0, w, 1, P.wood1); o.r(x0, y0+h-1, w, 1, P.wood0);
    o.r(x0, y0, 1, h, P.wood1); o.r(x0+w-1, y0, 1, h, P.wood0);
    var step = frame===2 ? 4 : 5;
    for(var x2=x0+step; x2<x0+w-2; x2+=step) o.r(x2, y0, 1, h, P.wood1);
    if(frame===2){ // croix de Saint-André dans les panneaux
      for(var x3=x0; x3+step<=x0+w-1; x3+=step*2) o.ln(x3, y0+1, x3+step, y0+h-2, P.wood1);
    }
  }
}
function door(o, x, y, w, h, arched){
  o.r(x, y, w, h, P.wood1);
  for(var i=1;i<w-1;i++) o.r(x+i, y+1, 1, h-1, (i&1)?P.wood2:P.wood3);
  o.r(x, y, w, 1, P.wood0);
  if(arched){ o.p(x, y, null); o.p(x+w-1, y, null); }
  o.p(x+w-2, y+Math.floor(h/2), P.gold1);
}
function windowPx(o, x, y, w, h, lit){
  w = w||2; h = h||2;
  o.r(x-1, y-1, w+2, 1, P.wood1);
  o.r(x, y, w, h, lit ? "#e8b84a" : "#241c18");
  if(!lit) o.p(x, y, "#3a3430");
  o.r(x-1, y+h, w+2, 1, P.wood3);
}
function chimney(o, x, y, h, mat){
  for(var j=0;j<h;j++){ o.p(x, y+j, mat==="stone"?P.st3:P.da2); o.p(x+1, y+j, mat==="stone"?P.st2:P.da1); }
  o.p(x, y, P.st1); o.p(x+1, y, P.st0);
}
function contact(o, x0, x1, y){ for(var x=x0;x<=x1;x++) o.p(x, y, C("#1a140e", 110)); }

function S(w, h, ax, ay){ var o = new Px(w, h); o.ax = ax; o.ay = ay; return o; }

/* ======================================================
   BÂTIMENTS
   Chaque sprite a (ax, ay) : position, dans le sprite, du coin bas-gauche de l'emprise.
   ====================================================== */

/* Bourgage niveau 1 : chaumière, toit de chaume long */
function burgage1(v){
  var o = S(18, 21, 1, 21);
  wall(o, 3, 13, 12, 7, "daub", 1);
  door(o, 6, 15, 3, 5);
  windowPx(o, 11, 15);
  roofHip(o, 1, 16, 2, 13, 3, "thatch", { seed:v });
  o.p(11, 3, P.th0); o.p(12, 3, P.th0); o.p(11, 2, P.inkSoft); // trou à fumée
  contact(o, 3, 14, 20);
  o.outline(C(P.ink), true);
  return o;
}
/* Bourgage niveau 2 : maison à colombages, étage en encorbellement, pignon */
function burgage2(v){
  var o = S(18, 26, 1, 26);
  wall(o, 3, 19, 12, 6, "daub", 1);
  door(o, 5, 20, 3, 5);
  windowPx(o, 11, 21);
  wall(o, 2, 13, 14, 6, "daub", 2);         // étage
  o.r(2, 18, 14, 1, P.wood0);                // ombre sous l'encorbellement
  windowPx(o, 5, 15); windowPx(o, 11, 15);
  roofGable(o, 1, 16, 13, 6, 6, "shingle", { seed:v });
  gableFill(o, 1, 16, 13, 6, 13, "daub");
  contact(o, 3, 14, 25);
  o.outline(C(P.ink), true);
  return o;
}
/* Bourgage niveau 3 : rez-de-chaussée en pierre, étage à colombages, tuiles, cheminée */
function burgage3(v){
  var o = S(18, 29, 1, 29);
  wall(o, 2, 22, 14, 6, "stone", 0);
  door(o, 7, 23, 3, 5, true);
  windowPx(o, 4, 24); windowPx(o, 12, 24);
  wall(o, 1, 15, 16, 7, "daub", 2);
  o.r(1, 21, 16, 1, P.wood0);
  windowPx(o, 4, 17); windowPx(o, 8, 17); windowPx(o, 12, 17);
  roofGable(o, 0, 17, 15, 6, 6, "clay", { seed:v });
  gableFill(o, 0, 17, 15, 6, 15, "daub");
  chimney(o, 13, 1, 6, "stone");
  contact(o, 2, 15, 28);
  o.outline(C(P.ink), true);
  return o;
}

/* Camp de bûcherons : appentis + pile de rondins + billot */
function woodcutter(){
  var o = S(18, 20, 1, 20);
  // appentis à droite
  o.r(10, 11, 1, 8, P.wood1); o.r(15, 11, 1, 8, P.wood0);
  wall(o, 10, 13, 6, 6, "plank", 0);
  roofHip(o, 8, 17, 6, 12, 1, "shingle", { seed:3 });
  // pile de rondins (vue de bout)
  var logs = [[2,16],[5,16],[8,16],[3,13],[6,13],[4,10]];
  for(var i=0;i<logs.length;i++){
    var lx = logs[i][0], ly = logs[i][1];
    o.el(lx+1.5, ly+1.5, 1.6, 1.6, P.wood3);
    o.p(lx+1, ly+1, P.wood4); o.p(lx+2, ly+2, P.wood2);
  }
  // billot + hache
  o.r(12, 17, 3, 2, P.wood2); o.r(12, 16, 3, 1, P.wood4);
  o.ln(13, 13, 14, 16, P.wood1); o.r(12, 13, 2, 1, P.st3);
  contact(o, 1, 16, 19);
  o.outline(C(P.ink), true);
  return o;
}

/* Cabane de cueilleuses : hutte ronde au toit conique + paniers */
function forager(){
  var o = S(18, 22, 1, 22);
  wall(o, 3, 15, 10, 5, "plank", 0);
  door(o, 7, 16, 3, 4);
  // toit conique de chaume
  for(var y=3;y<=15;y++){
    var f = (y-3)/12, hw = 1 + f*6.5;
    for(var x=Math.floor(8-hw); x<=Math.ceil(7+hw); x++){
      var sh = x < 8-hw*0.4 ? 1 : (x > 7+hw*0.4 ? -1 : 0);
      if(y>=14) sh = -1;
      o.p(x, y, y===15 ? P.th0 : roofPix("thatch", x, y, sh, 4));
    }
  }
  o.p(8, 2, P.wood1); o.p(8, 1, P.wood1);
  // paniers de baies
  function basket(bx, by, col){
    o.r(bx, by+1, 4, 2, P.wood3); o.r(bx, by+3, 4, 1, P.wood1); o.p(bx, by+1, P.wood2);
    o.r(bx+1, by, 2, 1, col); o.p(bx, by+1, col); o.p(bx+3, by+1, mix(col, P.ink, 0.3));
  }
  basket(13, 17, "#c42a2a"); basket(1, 18, "#5a3a7a");
  contact(o, 2, 16, 21);
  o.outline(C(P.ink), true);
  return o;
}

/* Camp de chasse : tente de peaux, séchoir à peaux, bois de cerf */
function hunter(){
  var o = S(18, 21, 1, 21);
  // tente en A
  for(var y=6;y<=19;y++){
    var f = (y-6)/13, hw = 0.5 + f*6;
    for(var x=Math.floor(7-hw); x<=Math.ceil(6+hw); x++){
      var sh = x < 7 ? 1 : -1;
      if(y===19) sh = -2;
      o.p(x, y, roofPix("hide", x, y, sh, 2));
    }
  }
  for(var y2=14;y2<=19;y2++){ o.p(6, y2, P.inkSoft); o.p(7, y2, P.inkSoft); } // ouverture
  o.p(6, 5, P.wood1); o.p(5, 4, P.wood1); o.p(8, 4, P.wood1); o.p(9, 3, P.wood1);
  // séchoir à peau
  o.r(12, 9, 1, 11, P.wood1); o.r(17, 9, 1, 11, P.wood1); o.r(11, 9, 8, 1, P.wood2);
  o.r(13, 10, 4, 6, "#a8875e"); o.r(14, 11, 2, 4, "#c4a47a"); o.p(13,15,null); o.p(16,15,null);
  // bois de cerf au sommet
  o.p(12, 7, P.da3); o.p(11, 6, P.da3); o.p(13, 6, P.da3); o.p(17,7,P.da3); o.p(16,6,P.da3); o.p(18,6,P.da3);
  contact(o, 1, 17, 20);
  o.outline(C(P.ink), true);
  return o;
}

/* Carrière : fosse, blocs taillés, chèvre de levage */
function quarry(){
  var o = S(18, 22, 1, 22);
  // fosse (sol)
  o.el(9, 14, 7.5, 5.5, function(nx, ny, x, y){
    var d = nx*nx+ny*ny;
    if(d>0.7) return ny<0 ? P.st2 : P.st3;
    if(d>0.45) return P.st1;
    return ny<0.2 ? P.st0 : P.st1;
  });
  for(var s=0;s<3;s++) o.r(13-s*2, 13+s, 2, 1, P.st3); // marches
  // blocs taillés
  function block(bx, by){ o.r(bx, by, 4, 3, P.st3); o.r(bx, by, 4, 1, P.st4); o.r(bx+3, by, 1, 3, P.st2); o.r(bx, by+2, 4, 1, P.st1); }
  block(1, 18); block(5, 18); block(3, 15);
  // chèvre de levage
  o.ln(11, 18, 14, 4, P.wood1); o.ln(17, 18, 14, 4, P.wood1); o.ln(14, 4, 14, 3, P.wood2);
  o.r(13, 3, 3, 1, P.wood2); o.ln(15, 4, 15, 11, P.linen0); o.r(14, 11, 3, 2, P.st3);
  o.outline(C(P.ink), true);
  return o;
}

/* Grange (grenier sur pierres-champignons) */
function granary(){
  var o = S(18, 23, 1, 23);
  // pierres-champignons
  for(var i=0;i<3;i++){ var px = 3+i*5; o.r(px, 19, 2, 3, P.st2); o.r(px-1, 18, 4, 1, P.st3); }
  wall(o, 2, 12, 14, 6, "plank", 0);
  o.r(2, 17, 14, 1, P.wood0);
  door(o, 7, 13, 4, 5);
  roofHip(o, 1, 16, 3, 12, 3, "thatch", { seed:9 });
  // sac et échelle
  o.r(12, 19, 3, 3, P.linen); o.r(12, 19, 3, 1, P.linen0);
  o.outline(C(P.ink), true);
  return o;
}

/* Entrepôt : hangar ouvert, caisses, tonneaux, sacs */
function storehouse(){
  var o = S(18, 22, 1, 22);
  wall(o, 2, 12, 14, 8, "plank", 0);
  o.r(4, 14, 10, 6, P.wood0);               // intérieur sombre
  o.r(3, 12, 1, 8, P.wood1); o.r(14, 12, 1, 8, P.wood1);
  roofHip(o, 1, 16, 4, 12, 2, "shingle", { seed:11 });
  // tonneau, caisse, sacs
  o.r(4, 16, 3, 4, P.wood3); o.r(4, 17, 3, 1, P.st2); o.r(4, 19, 3, 1, P.st2); o.p(6,16,P.wood2);
  o.r(9, 17, 4, 3, P.wood4); o.r(9, 17, 4, 1, P.da2); o.ln(9,17,12,19,P.wood2);
  o.r(15, 17, 2, 3, P.linen); o.p(15,17,P.linen0); o.r(0, 18, 2, 2, P.linen); o.p(0,18,P.linen0);
  contact(o, 2, 15, 21);
  o.outline(C(P.ink), true);
  return o;
}

/* Tour de guet : pierre, créneaux */
function tower(){
  var o = S(18, 36, 1, 36);
  wall(o, 4, 10, 10, 25, "stone", 0);
  // créneaux
  wall(o, 3, 5, 12, 5, "stone", 0);
  for(var x=3;x<15;x+=3){ o.r(x, 3, 2, 2, P.st3); o.p(x+1, 3, P.st2); }
  o.r(3, 9, 12, 1, P.st0);
  o.r(8, 14, 2, 4, P.ink); o.r(8, 24, 2, 4, P.ink);   // meurtrières
  door(o, 7, 30, 4, 5, true);
  contact(o, 4, 13, 35);
  o.outline(C(P.ink), true);
  return o;
}

/* Rempart : 16 variantes selon les voisins (bits N=1 E=2 S=4 O=8) */
function wallPiece(mask){
  var o = S(16, 26, 0, 26);
  var face = 7, top = 3;            // hauteur de la face, épaisseur du chemin de ronde
  var by = 25;                      // bas de la face (rangée 25 du sprite)
  function segH(x0, x1){            // segment horizontal (face + dessus + merlons)
    for(var x=x0;x<=x1;x++){
      for(var y=by-face+1;y<=by;y++) o.p(x, y, wallPix("stone", x, y, 3, 10));
      for(var y2=by-face-top+1;y2<=by-face;y2++) o.p(x, y2, P.st3);
      if((x%4)<2) o.p(x, by-face-top, P.st3);
      o.p(x, by-face, P.st2);
    }
  }
  function segV(y0, y1){            // segment vertical (on voit surtout le dessus)
    for(var y=y0;y<=y1;y++){
      for(var x=5;x<=10;x++) o.p(x, y, x===5 ? P.st4 : (x===10 ? P.st1 : P.st3));
      if((y%4)<2){ o.p(4, y, P.st3); o.p(11, y, P.st2); }
    }
  }
  var midTop = by-face-top;
  if(mask&1) segV(0, midTop+2);
  if(mask&4) segV(midTop, by-face);
  if(mask&8) segH(0, 7);
  if(mask&2) segH(8, 15);
  // pilier central
  for(var x=4;x<=11;x++){
    for(var y=by-face+1;y<=by;y++) o.p(x, y, wallPix("stone", x, y, x-4, 8));
    for(var y2=midTop-1;y2<=by-face;y2++) o.p(x, y2, x<6 ? P.st4 : (x>9 ? P.st2 : P.st3));
  }
  o.r(4, midTop-2, 2, 1, P.st3); o.r(10, midTop-2, 2, 1, P.st2);
  o.outline(C(P.ink));
  return o;
}

/* Ferme (2×2) : grande grange, portes doubles, meule de foin */
function farm(){
  var o = S(34, 40, 1, 40);
  wall(o, 3, 25, 22, 14, "plank", 0);
  // portes doubles
  o.r(9, 28, 10, 11, P.wood0);
  o.r(10, 29, 4, 10, P.wood2); o.r(14, 29, 4, 10, P.wood3);
  o.ln(10, 29, 13, 38, P.wood1); o.ln(17, 29, 14, 38, P.wood1);
  o.r(9, 28, 10, 1, P.wood1);
  roofGable(o, 1, 27, 26, 10, 9, "thatch", { seed:21 });
  gableFill(o, 1, 27, 26, 10, 26, "plank");
  o.r(13, 17, 3, 3, P.wood0); // lucarne à foin
  // meule de foin
  o.el(30, 34, 4, 4.5, function(nx, ny, x, y){ var l = -(nx*0.6+ny*0.8); return l>0.4?P.th4:l>0?P.th3:l>-0.5?P.th2:P.th1; });
  o.r(26, 37, 8, 2, P.th1);
  contact(o, 3, 24, 39);
  o.outline(C(P.ink), true);
  return o;
}

/* Moulin à pivot (2×2) : corps de bois sur chevalet ; les ailes sont dessinées à part */
function windmillBody(){
  var o = S(34, 44, 1, 44);
  // tertre
  o.el(16.5, 40, 13, 4, function(nx, ny){ return ny<-0.2 ? P.lf3 : P.lf2; });
  // chevalet
  o.ln(9, 41, 16, 30, P.wood1); o.ln(24, 41, 17, 30, P.wood1); o.r(16, 26, 2, 15, P.wood2);
  o.r(8, 40, 18, 2, P.wood1);
  // corps
  wall(o, 9, 12, 16, 16, "plank", 0);
  o.r(9, 27, 16, 1, P.wood0);
  door(o, 15, 20, 4, 7);
  windowPx(o, 12, 16); windowPx(o, 21, 16);
  roofGable(o, 8, 25, 12, 3, 3, "shingle", { seed:5 });
  gableFill(o, 8, 25, 12, 3, 12, "plank");
  // échelle
  o.ln(19, 28, 23, 41, P.wood2); o.ln(21, 28, 25, 41, P.wood2);
  for(var k=0;k<5;k++) o.ln(20+k, 30+k*2+1, 22+k, 30+k*2+1, P.wood3);
  o.outline(C(P.ink), true);
  // moyeu des ailes
  o.r(16, 8, 3, 3, P.wood1); o.p(17, 9, P.wood3);
  return o;
}
/* Ailes du moulin, 8 étapes de rotation sur un quart de tour */
function windmillSails(frame){
  var o = S(40, 40, 0, 0);
  var cx = 19.5, cy = 19.5, a0 = frame/8 * Math.PI/2;
  for(var k=0;k<4;k++){
    var a = a0 + k*Math.PI/2, ca = Math.cos(a), sa = Math.sin(a);
    // vergue
    for(var t=2;t<19;t+=0.5) o.p(Math.round(cx+ca*t), Math.round(cy+sa*t), P.wood1);
    // toile d'un côté de la vergue
    for(var t2=6;t2<19;t2+=0.5){
      for(var s=1;s<=4;s++){
        var xx = Math.round(cx + ca*t2 - sa*s), yy = Math.round(cy + sa*t2 + ca*s);
        var grid = (Math.round(t2*2)%5===0) || s===4;
        o.p(xx, yy, grid ? P.wood2 : (s<3 ? P.linen : P.linen0));
      }
    }
  }
  return o;
}

/* Marché (2×2) : trois étals à auvent rayé */
function market(full){
  var o = S(34, 34, 1, 34);
  var cols = [[P.red1, P.linen], [P.blue1, P.linen], ["#4e7a2e", P.linen]];
  var goods = [["#d0a050","#b08030"], ["#c42a2a","#7a9a2a"], ["#e6dcc4","#8a4a7a"]];
  function stall(sx, sy, k){
    // table
    o.r(sx, sy+8, 10, 2, P.wood3); o.r(sx, sy+10, 10, 1, P.wood1);
    o.r(sx, sy+11, 1, 3, P.wood1); o.r(sx+9, sy+11, 1, 3, P.wood1);
    if(full){
      for(var g=0; g<4; g++){ var gc = goods[k][g&1]; o.r(sx+1+g*2, sy+7, 2, 1, gc); o.p(sx+1+g*2, sy+6, mix(gc, "#ffffff", 0.3)); }
    }
    // poteaux + auvent
    o.r(sx, sy+1, 1, 7, P.wood2); o.r(sx+9, sy+1, 1, 7, P.wood1);
    for(var x=sx-1; x<=sx+10; x++){
      var c = (((x-sx+1)>>1)&1) ? cols[k][1] : cols[k][0];
      o.p(x, sy-1, c); o.p(x, sy, c); o.p(x, sy+1, mix(c, P.ink, 0.25));
      if(((x-sx+1)&1)===0) o.p(x, sy+2, mix(c, P.ink, 0.25));
    }
  }
  stall(3, 8, 0); stall(19, 8, 1); stall(11, 20, 2);
  o.outline(C(P.ink), true);
  return o;
}

/* Comptoir commercial (2×2) : maison de négoce, enseigne, charrette, caisses */
function trade(){
  var o = S(34, 38, 1, 38);
  wall(o, 3, 23, 20, 14, "daub", 2);
  door(o, 11, 29, 4, 8);
  windowPx(o, 6, 27); windowPx(o, 19, 27);
  roofHip(o, 1, 25, 10, 23, 4, "clay", { seed:13 });
  // enseigne suspendue
  o.r(16, 25, 5, 1, P.wood1); o.p(17, 26, P.wood1); o.p(20, 26, P.wood1);
  o.r(16, 27, 6, 4, P.gold1); o.r(17, 28, 4, 2, P.gold2); o.p(18,28,P.gold0);
  // charrette
  o.r(25, 29, 8, 4, P.wood3); o.r(25, 29, 8, 1, P.wood4); o.r(26, 26, 3, 3, P.linen); o.r(29, 27, 3, 2, P.wood4);
  o.el(27, 34.5, 2.2, 2.2, P.wood1); o.p(27,34,P.wood3); o.el(32, 34.5, 2.2, 2.2, P.wood1); o.p(32,34,P.wood3);
  // caisses
  o.r(1, 31, 4, 4, P.wood4); o.r(1, 31, 4, 1, P.da2); o.ln(1,31,4,34,P.wood2);
  contact(o, 3, 22, 37);
  o.outline(C(P.ink), true);
  return o;
}

/* Église (2×2) : nef de pierre, toit d'ardoise, clocher (option), vitrail (autel) */
function church(bell, altar){
  var o = S(34, bell ? 48 : 40, 1, bell ? 48 : 40);
  var base = o.h - 1;
  // nef
  wall(o, 2, base-13, 22, 13, "stone", 0);
  door(o, 11, base-7, 4, 7, true);
  // fenêtres en arc
  [5, 19].forEach(function(wx){
    o.r(wx, base-10, 2, 4, altar ? "#3a5aa8" : "#241c18");
    if(altar){ o.p(wx, base-9, "#c43a3a"); o.p(wx+1, base-8, P.gold2); }
    o.p(wx, base-11, P.st1); o.p(wx+1, base-11, P.st1);
  });
  roofGable(o, 1, 25, base-13, base-26, 8, "slate", { seed:17 });
  gableFill(o, 1, 25, base-13, base-26, base-13, "stone");
  o.el(13, base-18, 2, 2, altar ? P.gold2 : P.st0);   // rosace
  // croix au sommet du pignon
  o.r(13, base-31, 1, 5, P.gold1); o.r(12, base-30, 3, 1, P.gold1);
  // clocher latéral
  var tx = 25;
  if(bell){
    wall(o, tx, base-28, 8, 28, "stone", 0);
    o.r(tx+2, base-24, 4, 4, P.ink); o.r(tx+3, base-23, 2, 3, P.gold1); o.p(tx+3, base-20, P.gold2); // cloche
    roofGable(o, tx-1, tx+8, base-28, base-35, 3, "slate", { seed:19 });
    o.r(tx+4, base-40, 1, 4, P.gold1); o.r(tx+3, base-39, 3, 1, P.gold1);
  } else {
    wall(o, tx, base-14, 6, 14, "stone", 0);
    roofHip(o, tx-1, tx+6, base-18, base-14, 2, "slate", { seed:19 });
  }
  contact(o, 2, 31, base);
  o.outline(C(P.ink), true);
  return o;
}

/* Manoir (2×2) : soubassement de pierre, étage à colombages, grand toit de tuiles, tourelle */
function manor(){
  var o = S(34, 46, 1, 46);
  wall(o, 2, 35, 28, 10, "stone", 0);
  door(o, 13, 37, 5, 8, true);
  o.r(12, 44, 7, 1, P.st3);
  windowPx(o, 5, 38); windowPx(o, 9, 38); windowPx(o, 22, 38); windowPx(o, 26, 38);
  wall(o, 1, 26, 30, 9, "daub", 2);
  o.r(1, 34, 30, 1, P.wood0);
  windowPx(o, 5, 29); windowPx(o, 11, 29); windowPx(o, 19, 29); windowPx(o, 25, 29);
  roofHip(o, 0, 31, 10, 26, 6, "clay", { seed:23 });
  chimney(o, 6, 6, 7, "stone"); chimney(o, 24, 7, 6, "stone");
  // tourelle d'angle
  wall(o, 27, 18, 6, 27, "stone", 0);
  for(var y=8;y<=18;y++){ var hw = (y-8)/10*3.6; for(var x=Math.floor(30-hw); x<=Math.ceil(29+hw); x++) o.p(x, y, roofPix("slate", x, y, x<30?1:-1, 4)); }
  o.r(30, 2, 1, 7, P.wood1);
  contact(o, 2, 32, 45);
  o.outline(C(P.ink), true);
  return o;
}

/* Échafaudage de chantier (posé par-dessus le bâtiment en construction) */
function scaffold(wt, ht){
  var w = wt*16, h = 16 + (wt>1 ? 18 : 10);
  var o = S(w+2, h, 1, h);
  var top = 2;
  for(var x=1; x<=w; x+=Math.max(5, Math.floor(w/4))){
    o.r(x, top, 1, h-top, P.wood2);
  }
  o.r(w, top, 1, h-top, P.wood2);
  for(var y=top+4; y<h-1; y+=6){ o.r(0, y, w+2, 1, P.wood3); o.r(0, y+1, w+2, 1, P.wood1); }
  o.ln(1, h-2, w, top+4, P.wood1);
  return o;
}
/* Tas de matériaux de chantier */
function materials(){
  var o = S(14, 8, 0, 8);
  for(var i=0;i<3;i++){ o.r(1, 5-i*2+2, 8-i*2, 2, i&1?P.wood3:P.wood2); o.p(1, 6-i*2+1, P.wood4); }
  o.r(9, 4, 4, 3, P.st3); o.r(9, 4, 4, 1, P.st4); o.r(11, 2, 2, 2, P.st2);
  o.outline(C(P.ink));
  return o;
}

/* étape 5 bis : tas livrés au pied du chantier (1 à 4 troncs, 1 à 3 pierres) */
function logPile(n){
  var o = S(14, 9, 0, 9);
  var rows = [[1,7,11],[2,5,9],[3,3,7],[4,1,5]];   // [x, y, longueur] du bas vers le haut
  for(var i=0;i<n;i++){
    var q = rows[i];
    o.r(q[0], q[1], q[2], 2, i&1 ? P.wood3 : P.wood2); o.r(q[0], q[1], q[2], 1, i&1 ? P.wood4 : P.wood3);
    o.p(q[0], q[1]+1, P.wood4); o.p(q[0]+q[2]-1, q[1]+1, P.wood1);
  }
  o.outline(C(P.ink));
  return o;
}
function stonePile(n){
  var o = S(12, 8, 0, 8);
  var at = [[1,4,5,3],[6,4,5,3],[3,1,5,3]];
  for(var i=0;i<n;i++){ var q = at[i]; o.r(q[0], q[1], q[2], q[3], i===2 ? P.st2 : P.st3); o.r(q[0], q[1], q[2], 1, P.st4); o.p(q[0]+q[2]-1, q[1]+q[3]-1, P.st1); }
  o.outline(C(P.ink));
  return o;
}
/* étape 5 bis : ce que le bœuf traîne derrière lui (troncs liés, ou traîneau de pierres) */
function dragLoad(kind){
  var o = S(16, 7, 8, 7);
  if(kind==="timber"){
    for(var i=0;i<3;i++){ o.r(1, 1+i*2, 14, 2, i&1 ? P.wood3 : P.wood2); o.r(1, 1+i*2, 14, 1, i&1 ? P.wood4 : P.wood3); o.p(1, 2+i*2, P.wood4); }
  } else {
    o.r(1, 4, 14, 2, P.wood2); o.r(1, 4, 14, 1, P.wood3);
    o.r(2, 1, 4, 3, P.st3); o.r(6, 2, 4, 2, P.st2); o.r(10, 1, 4, 3, P.st3); o.r(2, 1, 4, 1, P.st4); o.r(10, 1, 4, 1, P.st4);
  }
  o.outline(C(P.ink));
  return o;
}

/* ======================================================
   PERSONNAGES (8 × 12, pied au centre bas, regard vers la droite)
   ====================================================== */
var HEAD = {
  hair:  [ "..KKKK..", ".KHHHHK.", ".KHHSSK.", ".KHSESK.", "..KSSsK." ],
  hood:  [ "..KKKK..", ".KTTTTK.", ".KTTSSK.", ".KTSESK.", "..KtSsK." ],
  coif:  [ "..KKKK..", ".KWWWWK.", ".KWHSSK.", ".KHSESK.", "..KSSsK." ],
  long:  [ "..KKKK..", ".KHHHHK.", "KHHHSSK.", "KHHSESK.", "KHKSSsK." ],
  helm:  [ ".KKKKKK.", "KMMMMMMK", ".KmSSSK.", ".KmSESK.", "..KSSsK." ],
};
var BODY = {
  idle:  [ ".KuTTTK.", "KuTTTtTK", "KSTTTtSK", ".KBBBBK.", ".KTTTtK.", "..KLLK..", "..KFFK.." ],
  walkA: [ ".KuTTTK.", "KuTTTtTK", ".KSTTtSK", ".KBBBBK.", ".KTTTtK.", ".KLKKLK.", ".KF..KF." ],
  walkB: [ ".KuTTTK.", "KSTTTtTK", "KuTTTtK.", ".KBBBBK.", ".KTTTtK.", "..KLLK..", "..KFKF.." ],
  workU: [ ".KuTTTSK", "KuTTTtSK", "KuTTTtK.", ".KBBBBK.", ".KTTTtK.", ".KLK.KLK", ".KF..KF." ],
  workD: [ ".KuTTTK.", "KuTTTtTK", "KuTTTtSS", ".KBBBBK.", ".KTTTtK.", ".KLK.KLK", ".KF..KF." ],
};
var JOB_CLOTH = {
  laborer:["#8a7a62","#6d5f4b","#a8987c"], woodcutter:["#9a4a2e","#743622","#b86444"],
  forager:["#5e8a3a","#486c2c","#7aa650"], hunter:["#6a5236","#4f3c27","#86694a"],
  quarry:["#6f7c8a","#56606c","#8c98a4"], farm:["#3e6f9a","#2f5577","#5a8cb4"],
  windmill:["#d8d0b8","#b0a68c","#ece6d4"], market:["#c49a3a","#9a7628","#dcb860"],
  trade:["#7a4a8a","#5c3768","#9a68aa"], militia:["#3e5a86","#2c4266","#5a78a4"],
  merc:["#7a2a2a","#561c1e","#984040"], brigand:["#4a4038","#342c26","#625548"],
  pasture:["#7a6a44","#5c4f32","#968458"],
};
var HAIRS = [P.hrBrown, P.hrBlond, P.hrBlack, P.hrRed, P.hrGrey];
function person(head, body, cloth, hair, opts){
  opts = opts || {};
  var rows = HEAD[head].concat(BODY[body]);
  /* cheveux longs : ils tombent sur l'épaule, dans le dos */
  if(head==="long") rows[5] = "KH" + rows[5].slice(2);
  /* robe : la jupe descend jusqu'aux pieds */
  if(opts.dress) rows[10] = ".KTTTtK.";
  var lg = {
    K:P.ink, H:hair, h:mix(hair, P.ink, 0.35), S:P.sk1, s:P.sk0, E:P.ink,
    T:cloth[0], t:cloth[1], u:cloth[2], B:P.wood1, L:opts.legs||"#3a2c22", F:"#22180f",
    W:P.linen, M:P.st3, m:P.st1,
  };
  var o = Px.fromStrings(rows, lg);
  o.ax = 4; o.ay = 12;
  return o;
}
/* Nourrisson emmailloté (portrait de la fiche ; il n'est pas dessiné sur la carte) */
function babySprite(){
  var o = Px.fromStrings([ ".KKKK.", "KWSSEK", "KWSSsK", "KWWWWK", "KWWWwK", ".KKKK." ],
    { K:P.ink, W:P.linen, w:P.linen0, S:P.sk1, s:P.sk0, E:P.ink });
  o.ax = 3; o.ay = 6;
  return o;
}
/* Repère au-dessus du villageois sélectionné (petite flèche dorée qui rebondit) */
function marker(f){
  var o = S(9, 7, 4, 7);
  o.r(1, 1, 7, 1, f ? "#ffffff" : "#e8c35a"); o.r(2, 2, 5, 1, f ? "#ffffff" : "#e8c35a"); o.r(3, 3, 3, 1, "#e8c35a"); o.p(4, 4, "#e8c35a");
  o.outline(C(P.ink));
  return o;
}
/* Outils portés pendant le travail (16 × 16 ; le corps 8×12 y occupe (4,2)-(11,13)) */
function toolSprite(kind, up){
  var o = S(16, 16, 8, 14);
  var hx = up ? 10 : 11, hy = up ? 7 : 9;   // position de la main
  function handle(x0,y0,x1,y1){ o.ln(x0,y0,x1,y1,P.wood2); }
  if(kind==="axe"){
    if(up){ handle(hx, hy, hx+1, 2); o.r(hx+1, 1, 2, 3, P.st3); o.p(hx+2, 1, P.st4); }
    else { handle(hx, hy, hx+3, hy+2); o.r(hx+3, hy+1, 2, 3, P.st3); o.p(hx+4, hy+1, P.st4); }
  } else if(kind==="pick"){
    if(up){ handle(hx, hy, hx, 2); o.ln(hx-2, 2, hx+2, 1, P.st3); o.p(hx+2, 1, P.st4); }
    else { handle(hx, hy, hx+3, hy+1); o.ln(hx+3, hy-1, hx+4, hy+3, P.st3); }
  } else if(kind==="hoe"){
    if(up){ handle(hx, hy, hx+1, 2); o.r(hx+1, 2, 3, 1, P.st2); }
    else { handle(hx-1, hy-4, hx+2, hy+3); o.r(hx+2, hy+3, 3, 1, P.st2); }
  } else if(kind==="hammer"){
    if(up){ handle(hx, hy, hx, 3); o.r(hx-1, 2, 3, 2, P.st2); }
    else { handle(hx, hy, hx+3, hy+1); o.r(hx+3, hy-1, 2, 3, P.st2); }
  } else if(kind==="sickle"){
    if(up){ handle(hx, hy, hx, hy-2); o.ln(hx, hy-3, hx+2, hy-4, P.st4); o.p(hx+3, hy-3, P.st4); }
    else { handle(hx, hy, hx+1, hy); o.ln(hx+2, hy, hx+3, hy+2, P.st4); o.p(hx+2, hy+3, P.st4); }
  } else if(kind==="basket"){
    var by = up ? hy : hy+2;
    o.r(hx-1, by, 4, 3, P.wood3); o.r(hx-1, by, 4, 1, "#c42a2a"); o.p(hx-1, by+2, P.wood1);
  } else if(kind==="bow"){
    o.ln(hx+1, hy-5, hx+2, hy-1, P.wood2); o.ln(hx+2, hy-1, hx+1, hy+3, P.wood2); o.ln(hx+1, hy-5, hx+1, hy+3, P.linen0);
  } else if(kind==="fork"){          // fourche à fumier
    if(up){ handle(hx, hy, hx+1, 3); o.r(hx, 1, 3, 1, P.st2); o.p(hx, 0, P.st3); o.p(hx+2, 0, P.st3); }
    else { handle(hx-1, hy-3, hx+2, hy+3); o.r(hx+2, hy+4, 3, 1, P.st2); o.p(hx+2, hy+5, P.st3); o.p(hx+4, hy+5, P.st3); o.p(hx+5, hy+4, "#4a321e"); }
  } else if(kind==="seed"){          // sac de semences, on sème à la volée
    var sy = up ? hy-1 : hy+1;
    o.r(hx-2, sy, 4, 4, P.linen); o.r(hx-2, sy, 4, 1, P.linen0); o.p(hx-1, sy+2, P.linen0);
    if(!up){ o.p(hx+3, hy-1, P.th3); o.p(hx+4, hy+1, P.th3); o.p(hx+5, hy-2, P.th3); }
  } else if(kind==="scythe"){        // faux
    if(up){ handle(hx, hy, hx+2, 1); o.ln(hx+2, 1, hx-3, 2, P.st4); o.p(hx-4, 3, P.st3); }
    else { handle(hx-2, hy-5, hx+1, hy+4); o.ln(hx+1, hy+4, hx+5, hy+5, P.st4); o.p(hx+6, hy+4, P.st3); }
  } else if(kind==="flail"){         // fléau à battre
    if(up){ handle(hx, hy, hx, 3); o.ln(hx, 3, hx-3, 1, P.wood3); }
    else { handle(hx, hy, hx+2, hy-2); o.ln(hx+2, hy-2, hx+3, hy+3, P.wood3); }
  } else if(kind==="crook"){         // houlette du berger
    handle(hx+1, hy+5, hx+1, 1); o.p(hx+2, 0, P.wood2); o.p(hx+3, 1, P.wood2); o.p(hx+3, 2, P.wood2);
  }
  return o;
}
/* Charges portées sur le dos (même repère que toolSprite ; dessinées derrière le corps) */
function carrySprite(kind){
  var o = S(16, 16, 8, 14);
  if(kind==="timber"){ o.r(1, 7, 10, 2, P.wood3); o.r(1, 7, 10, 1, P.wood4); o.p(1,8,P.wood1); o.p(10,8,P.wood1); o.r(2, 5, 8, 2, P.wood2); o.p(2,5,P.wood4); }
  else if(kind==="berries"){ o.r(1, 6, 4, 5, P.wood3); o.r(1, 6, 4, 1, "#c42a2a"); o.p(2,5,"#c42a2a"); o.p(3,5,"#e05050"); o.r(1,10,4,1,P.wood1); }
  else if(kind==="meat"){ o.r(1, 6, 6, 3, "#8a3a2a"); o.r(1, 6, 6, 1, "#b85a44"); o.p(6,5,P.da3); o.p(1,9,"#8a3a2a"); }
  else if(kind==="stone"){ o.r(1, 6, 5, 4, P.st3); o.r(1, 6, 5, 1, P.st4); o.r(5,7,1,3,P.st1); }
  else { o.r(1, 5, 5, 6, P.linen); o.r(1, 5, 5, 1, P.linen0); o.p(3,4,P.linen0); o.r(5,6,1,5,P.linen0); }
  o.outline(C(P.ink));
  return o;
}

/* Soldat : casque, gambison, bouclier rond ; lance ou épée */
function soldier(kind, frame){
  var cloth = JOB_CLOTH[kind];
  var o = S(14, 18, 3, 18);
  var body = person("helm", frame===1 ? "walkA" : (frame===2 ? "workD" : "idle"), cloth, P.hrBrown);
  o.blit(body, 3, 6);
  if(kind==="militia"){
    var sx = frame===2 ? 12 : 10;
    o.ln(sx, 0, sx, 17, P.wood2); o.r(sx, 0, 1, 2, P.st4); o.p(sx, 2, P.st2);
    // bouclier
    o.el(5, 12, 2.6, 3, function(nx){ return nx<-0.3 ? P.red2 : nx<0.35 ? P.linen : P.red1; });
  } else if(kind==="merc"){
    var bx = frame===2 ? 12 : 11;
    o.ln(bx, frame===2 ? 11 : 6, bx+(frame===2?2:0), frame===2 ? 13 : 12, P.st4); o.r(bx-1, 12, 3, 1, P.gold1);
    o.el(5, 12, 2.6, 3, function(nx){ return nx<0 ? "#2a2a2a" : P.red1; });
  } else { // brigand : capuche sombre, gourdin
    o.ln(11, 8, 12, 14, P.wood1); o.r(11, 7, 2, 2, P.wood2);
  }
  o.outline(C(P.ink));
  return o;
}

/* Cerf : 14 × 11, pied (7, 11). frame 0 debout, 1-2 marche, 3 broute */
function deer(frame, stag){
  var head = frame===3 ? [
    "..............",
    "..............",
    "..............",
    "..............",
    ".KKKKKKKK.....",
    "KwbbbbbbbK....",
    ".KbbbbbbbbK...",
    ".KbBBBBBbbbK..",
    "..KLK..KLKbEK.",
    "..KLK..KLK.KK.",
    "..KF...KF.....",
  ] : [
    "..........A.A.",
    "..........KAK.",
    "...........KbK",
    "..........KbbE",
    ".KKKKKKKKKbbK.",
    "KwbbbbbbbbbK..",
    ".KbbbbbbbbK...",
    ".KbBBBBBbbK...",
    frame===1 ? ".KLK...KLK...." : (frame===2 ? "..KLK.KLK....." : "..KLK..KLK...."),
    frame===1 ? "KLK.....KLK..." : (frame===2 ? "..KLKKLK......" : "..KLK..KLK...."),
    frame===1 ? "KF.......KF..." : (frame===2 ? "..KF.KF......." : "..KF...KF....."),
  ];
  if(!stag && frame!==3){ head[0] = ".............."; head[1] = "..........K..."; }
  var o = Px.fromStrings(head, { K:P.ink, b:"#9a6a3e", B:"#d8c09a", w:"#f0e6d4", E:P.ink, L:"#6a4a2a", F:P.ink, A:P.da3 });
  o.ax = 7; o.ay = 11;
  return o;
}

/* Bœuf : 18 × 12, corps massif, robe fauve, cornes claires */
function ox(frame){
  var rows = [
    "...............W..",
    "............KKKWK.",
    "..KKKKKKKKKKccccK.",
    ".KcccccccccccccccK",
    "Kc+ccccccccccccmEK",
    "KccccccccccccKcmmK",
    "KcCCCCCCCCccK.KKK.",
    "KcCCCCCCCCcK......",
    ".KcCCCCCCcK.......",
    frame ? ".KLK.....KLK......" : "..KLK...KLK.......",
    frame ? "KLK.......KLK....." : "..KLK...KLK.......",
    frame ? "KF.........KF....." : "..KF....KF........",
  ];
  var o = Px.fromStrings(rows, { K:P.ink, c:"#9a6a42", C:"#7a5234", "+":"#b8865a", m:"#d8b894", W:P.da3, E:P.ink, L:"#5a3c26", F:P.ink });
  o.ax = 9; o.ay = 12;
  return o;
}

/* Poule : 4 × 4, 2 images (picore) */
function chicken(frame, brown){
  var rows = frame ? [ "....", ".ww.", "wwwr", ".y.." ] : [ ".r..", "wwww", ".ww.", ".y.." ];
  var w = brown ? "#a86a3a" : "#f0ece0";
  var o = Px.fromStrings(rows, { w:w, r:"#c42a2a", y:"#d8a030" });
  o.ax = 2; o.ay = 4;
  return o;
}

/* ======================================================
   ACCESSOIRES DE BOURGAGE (extensions de cour)
   ====================================================== */
function skep(){ // ruche en paille
  var o = S(6, 6, 3, 6);
  o.el(3, 3.5, 2.6, 2.6, function(nx, ny, x, y){ return y%2 ? P.th2 : (nx<0 ? P.th4 : P.th3); });
  o.r(0, 5, 6, 1, P.wood1); o.p(3, 4, P.ink);
  o.outline(C(P.ink));
  return o;
}
function vegPatch(season){
  var o = S(10, 5, 5, 5);
  o.r(0, 0, 10, 5, P.dt1);
  for(var r=0;r<2;r++) for(var x=1;x<9;x+=2){
    if(season===0){ o.p(x, 1+r*2, P.sn2); continue; }
    o.p(x, 1+r*2, r ? "#4e8c40" : "#6aa64a"); o.p(x, r*2, "#3a6a30");
    if(season===2 && r===1) o.p(x, 1+r*2, "#d86a2a");
  }
  o.r(0, 0, 10, 1, P.wood2); o.r(0, 0, 1, 5, P.wood2); o.r(9, 0, 1, 5, P.wood2);
  return o;
}
function barrel(){
  var o = S(5, 6, 2, 6);
  o.r(0, 0, 5, 6, P.wood3); o.r(0, 0, 5, 1, P.wood2); o.r(0,1,5,1,P.st2); o.r(0,4,5,1,P.st2); o.r(4,0,1,6,P.wood1); o.p(1,2,P.wood4);
  o.outline(C(P.ink));
  return o;
}
function clothLine(){
  var o = S(12, 8, 6, 8);
  o.r(0, 1, 1, 7, P.wood1); o.r(11, 1, 1, 7, P.wood1); o.ln(0, 1, 11, 1, P.linen0);
  o.r(2, 2, 3, 3, "#a84040"); o.r(6, 2, 3, 4, "#4a6aa0"); o.r(9,2,2,2,P.linen);
  return o;
}
function fruitTree(season){
  var o = sapling(season, 0).clone();
  if(season===2 || season===3){
    var spots = [[3,4],[6,3],[5,7],[2,7],[7,6]];
    for(var i=0;i<spots.length;i++) o.p(spots[i][0], spots[i][1], season===3 ? "#d84a2a" : "#e0503a");
  }
  if(season===1){ var fl = [[3,3],[6,4],[4,6],[7,7]]; for(var j=0;j<fl.length;j++) o.p(fl[j][0], fl[j][1], "#f6e6ee"); }
  o.ax = 5; o.ay = 15;
  return o;
}

/* ======================================================
   CHAMPS (tuiles 16 × 16 posées au sol)
   stage : 0 labouré, 1 semé, 2 pousses, 3 jeune, 4 haut, 5 mûrissant, 6 mûr
   ====================================================== */
function furrowPix(x, y, v){
  var r = y % 4, n = hash(x, y, v);
  var c = r===0 ? P.dt1 : r===1 ? P.dt2 : r===2 ? P.dt3 : P.dt2;
  if(n<0.08) c = P.dt1; else if(n>0.94) c = P.dt4;
  return c;
}
function fieldTile(crop, stage, season, v){
  var o = new Px(16, 16);
  for(var y=0;y<16;y++) for(var x=0;x<16;x++) o.p(x, y, furrowPix(x, y, v));
  if(season===0){
    for(var y2=0;y2<16;y2++) for(var x2=0;x2<16;x2++){
      var r = y2%4; if(r!==0 || hash(x2,y2,v)<0.3) o.p(x2, y2, r===3 ? P.sn1 : P.sn2);
    }
    return o;
  }
  if(crop==="fallow"){
    for(var k=0;k<40;k++){
      var fx = Math.floor(hash(k,1,v)*16), fy = Math.floor(hash(k,2,v)*16);
      o.p(fx, fy, k%5===0 ? "#d8c84a" : (k&1 ? "#5a8a3a" : "#6e9a44"));
      if(k%3===0) o.p(fx+1, fy, "#4a7432");
    }
    return o;
  }
  if(stage===1){
    for(var x3=1;x3<16;x3+=3) for(var r3=2;r3<16;r3+=4) o.p(x3+(r3>>2&1), r3, P.dt4);
    return o;
  }
  if(stage>=2){
    var barley = crop==="barley";
    var greens = barley ? ["#3e6a3a","#557e44","#729a52"] : ["#3a6a2a","#4e8434","#6aa040"];
    var ripe = barley ? ["#a89458","#c8b47a","#e0d098"] : ["#b08a2e","#d0a840","#ecc860"];
    var midc = barley ? ["#7a8a4a","#9aa25a","#b8b86a"] : ["#7a8a32","#a0a23a","#c4b44a"];
    var ramp = stage>=6 ? ripe : stage===5 ? midc : greens;
    var height = stage===2 ? 1 : stage===3 ? 2 : 3;
    for(var row=2; row<16; row+=4){
      for(var x4=0; x4<16; x4++){
        if(stage===2 && (x4%2)) continue;
        var hh = height + (hash(x4,row,v)<0.3 ? -1 : 0);
        for(var j=0;j<=hh;j++){
          var yy = row - j + 1;
          var ci = j===hh ? 2 : (j===0 ? 0 : 1);
          o.p(x4, yy, ramp[ci]);
        }
        if(stage>=4){ o.p(x4, row+2, ramp[0]); }
        if(stage>=6 && hash(x4,row,v+1)<0.45) o.p(x4, row-hh, barley ? "#f0e4b0" : "#f6dc80");
      }
    }
  }
  return o;
}
function stubbleTile(season, v){
  var o = new Px(16, 16);
  for(var y=0;y<16;y++) for(var x=0;x<16;x++){
    var r = y%4, c = r===0 ? P.dt2 : P.dt3;
    if(r===2 && hash(x,y,v)<0.6) c = "#c8b070";
    if(r===1 && hash(x,y,v+3)<0.3) c = "#a89050";
    if(season===0 && hash(x,y,v+5)<0.7) c = P.sn2;
    o.p(x, y, c);
  }
  return o;
}
function sheaf(){
  var o = Px.fromStrings([
    ".y.y.y.",
    "yYyYyYy",
    ".yYyYy.",
    "..bbb..",
    ".yYyYy.",
    "yYyYyYy",
    ".Yy.yY.",
  ], { y:P.th3, Y:P.th4, b:P.wood2 });
  o.outline(C(P.ink)); o.ax = 4; o.ay = 9;
  return o;
}

/* ======================================================
   ÉTAPE 5 : NOUVELLES CULTURES, PRÉS, FUMIER, MEULES
   stage : 2 pousses, 3 jeune, 4 haut / fleurs, 5 mûrissant, 6 mûr
   ====================================================== */
var CROP_RAMPS = {
  rye:  { g:["#3a6248","#4f7c5a","#6a9a6c"], m:["#7a8a5a","#9a9e6a","#b8b27a"], r:["#8f7a4a","#b09a62","#cdb682"], head:"#dccb92", tall:1 },
  oats: { g:["#4a7a3a","#62924a","#7eac5a"], m:["#94a25a","#aeb46a","#c8c47e"], r:["#b8a868","#d2c488","#ece0b0"], head:"#f4ecc8", tall:0 },
};
function cropTile(crop, stage, v){
  var o = new Px(16, 16), x, y, row, j;
  for(y=0;y<16;y++) for(x=0;x<16;x++) o.p(x, y, furrowPix(x, y, v));
  if(crop==="rye" || crop==="oats"){
    var R = CROP_RAMPS[crop], ramp = stage>=6 ? R.r : stage===5 ? R.m : R.g;
    var height = (stage===2 ? 1 : stage===3 ? 2 : 3) + (stage>=4 ? R.tall : 0);
    for(row=2; row<16; row+=4) for(x=0; x<16; x++){
      if(stage===2 && (x%2)) continue;
      var hh = height + (hash(x,row,v)<0.3 ? -1 : 0);
      for(j=0;j<=hh;j++) o.p(x, row-j+1, ramp[j===hh ? 2 : (j===0 ? 0 : 1)]);
      if(stage>=4) o.p(x, row+2, ramp[0]);
      if(crop==="oats" && stage>=5 && hash(x,row,v+2)<0.5){ o.p(x+1, row-hh+1, R.head); o.p(x-1, row-hh+2, R.head); }
      if(crop==="rye" && stage>=6 && hash(x,row,v+1)<0.5) o.p(x, row-hh, R.head);
    }
  } else if(crop==="flax"){
    var st = ["#4e7a44","#6a9a52","#86b062"];
    for(row=2; row<16; row+=4) for(x=0; x<16; x+=2){
      var hf = (stage===2 ? 1 : stage===3 ? 2 : 3) + (hash(x,row,v)<0.3 ? -1 : 0), xx = x + (row>>2&1);
      for(j=0;j<=hf;j++) o.p(xx, row-j+1, stage>=6 ? "#9a8a50" : st[j===hf ? 2 : 1]);
      if((stage===4 || stage===5) && hash(xx,row,v+4)<(stage===4 ? 0.7 : 0.4)) o.p(xx, row-hf, hash(xx,row,v+5)<0.5 ? "#6a8ad8" : "#9ab4f0");
      if(stage>=5 && hash(xx,row,v+6)<0.5) o.p(xx, row-hf, stage>=6 ? "#7a6438" : "#a0a85a");
    }
  } else if(crop==="peas"){
    var pg = stage>=6 ? ["#7a7a3a","#9a9248","#b8a858"] : ["#3e7a34","#56963e","#78b452"];
    for(row=2; row<16; row+=4) for(x=0; x<16; x++){
      if(stage===2 && (x%3)) continue;
      var hp = stage<=2 ? 0 : stage===3 ? 1 : 2;
      if(hash(x,row,v)<0.2) hp = Math.max(0, hp-1);
      for(j=0;j<=hp;j++) o.p(x, row-j+1, pg[j===hp ? 2 : (j===0 ? 0 : 1)]);
      if(stage===4 && hash(x,row,v+3)<0.25) o.p(x, row-hp, "#f0eee0");
      if(stage===5 && hash(x,row,v+3)<0.3) o.p(x, row-hp+1, "#a8d86a");
      if(stage>=6 && hash(x,row,v+3)<0.3) o.p(x, row-hp+1, "#c8b46a");
    }
  }
  return o;
}
/* pré de fauche : herbe sur toute la case, de plus en plus haute et fleurie ; mown : fauché */
function meadowTile(stage, v, mown){
  var o = new Px(16, 16), x, y;
  var base = ["#3c6a2c","#4e7e34","#5e8e3c"];
  for(y=0;y<16;y++) for(x=0;x<16;x++){ var n = hash(x, y, v+30); o.p(x, y, n<0.3 ? base[0] : n<0.75 ? base[1] : base[2]); }
  if(mown){
    for(y=0;y<16;y++) for(x=0;x<16;x++){ if(hash(x,y,v+31)<0.5) o.p(x, y, hash(x,y,v+32)<0.5 ? "#7a9a48" : "#94a85a"); }
    for(y=3;y<16;y+=6) for(x=0;x<16;x++){ o.p(x, y, "#c8c070"); if(hash(x,y,v+33)<0.6) o.p(x, y-1, "#ddd48a"); o.p(x, y+1, "#a89a52"); }
    return o;
  }
  var tall = stage<=2 ? 1 : stage<=3 ? 2 : 3, dens = stage<=2 ? 0.25 : stage<=3 ? 0.45 : 0.6;
  var blades = ["#4a8a38","#62a244","#7cb850"];
  for(x=0;x<16;x++) for(y=2;y<16;y+=2){
    if(hash(x,y,v+34) > dens) continue;
    var h = tall - (hash(x,y,v+35)<0.4 ? 1 : 0);
    for(var j=0;j<=h;j++) o.p(x, y-j, blades[Math.min(2, j)]);
    if(stage>=5 && hash(x,y,v+36)<0.12){
      var fl = ["#e8d04a","#f4f0e0","#a878c8","#d84a3a"][Math.floor(hash(x,y,v+37)*4)];
      o.p(x, y-h-1, fl);
    }
  }
  if(stage>=6) for(x=0;x<16;x++) for(y=0;y<16;y++) if(hash(x,y,v+38)<0.06) o.p(x, y, "#b8b05a");
  return o;
}
/* fumier épandu sur le chaume, avant le labour */
function dungTile(v){
  var o = stubbleTile(2, v);
  for(var k=0;k<14;k++){
    var x = Math.floor(hash(k,1,v+40)*15), y = Math.floor(hash(k,2,v+40)*15);
    o.p(x, y, "#4a321e"); o.p(x+1, y, "#3a2616"); if(k&1) o.p(x, y+1, "#5a3e24");
  }
  return o;
}
/* culture d'hiver sous la neige : quelques pousses vertes dépassent */
function winterCropTile(v){
  var o = fieldTile("wheat", 0, 0, v);
  for(var row=2; row<16; row+=4) for(var x=0; x<16; x+=2) if(hash(x,row,v+41)<0.55){ o.p(x+(row>>2&1), row, "#5a8a4a"); }
  return o;
}
/* meule de foin (pré fauché, réserve d'hiver près de l'abri) */
function haycock(){
  var o = S(10, 9, 5, 9);
  o.el(5, 5.5, 4.4, 3.6, function(nx, ny, x, y){
    if(ny<-0.4) return nx<0 ? "#e8d690" : "#d8c47a";
    var n = hash(x, y, 50);
    return ny>0.5 ? "#a89048" : n<0.25 ? "#c8b060" : n<0.7 ? "#d8c070" : "#e4d08a";
  });
  o.p(5, 1, "#b09a50"); o.p(4, 2, "#c8b060");
  o.outline(C(P.ink));
  return o;
}

/* ======================================================
   ÉTAPE 5 : BÉTAIL (frame : 0 debout, 1 marche, 2 broute, 3 couché)
   ====================================================== */
function legs(o, xs, y0, len, col, frame){
  for(var i=0;i<xs.length;i++){
    var lift = frame===1 && (i&1) ? 1 : 0, dx = frame===1 ? ((i&1) ? 1 : -1)*0 : 0;
    o.r(xs[i]+dx, y0, 1, len-lift, col);
  }
}
function sheepSprite(frame, young){
  var o = young ? S(11, 9, 5, 9) : S(15, 12, 7, 12);
  var s = young ? 0.68 : 1, by = young ? 4.6 : 6.4, lie = frame===3;
  if(lie) by += young ? 1.6 : 2.4;
  var wool = function(nx, ny, x, y){ if(ny>0.45) return "#c4b89c"; return ((x+y)&1) ? "#efe9d8" : (hash(x,y,52)<0.5 ? "#dcd2bc" : "#e6dfcc"); };
  if(!lie) legs(o, young ? [2,4,6,7] : [3,5,9,11], young ? 6 : 9, young ? 3 : 3, "#3a2e26", frame);
  o.el(young ? 4.6 : 6.5, by, 4.7*s, 3.1*s, wool);
  var face = "#3a2e26", hx = young ? 7 : 10, hy = frame===2 ? (young ? 5 : 7) : (young ? 2 : 3);
  if(lie) hy += young ? 1 : 2;
  o.r(hx, hy, young ? 2 : 3, young ? 2 : 3, face);
  o.p(hx-1, hy, face);                                   // oreille
  o.p(hx + (young ? 1 : 2), hy+1, "#e8dcc4");            // œil
  if(!young && frame!==2) o.p(hx-1, hy-1, "#efe9d8");   // laine sur le front
  o.outline(C(P.ink));
  return o;
}
function cowSprite(frame, young){
  var o = young ? S(13, 10, 6, 10) : S(19, 14, 9, 14);
  var lie = frame===3;
  var base = young ? "#b07a4e" : "#8a5a3a", dark = young ? "#8a5c38" : "#6a4228", white = "#ece4d6";
  if(!lie) legs(o, young ? [2,4,7,9] : [3,5,12,14], young ? 7 : 10, young ? 3 : 4, "#4a3222", frame);
  var cx = young ? 5.5 : 8.5, cy = (young ? 4.8 : 6.8) + (lie ? (young ? 1.5 : 2.5) : 0);
  o.el(cx, cy, young ? 4.6 : 7.2, young ? 2.8 : 3.8, function(nx, ny, x, y){
    if(ny>0.5) return dark;
    if(!young && hash(Math.floor(x/3), Math.floor(y/3), 55)<0.35) return white;
    return nx<-0.3 && ny<0 ? mix(base, "#ffffff", 0.12) : base;
  });
  var hx = young ? 9 : 14, hy = (frame===2 ? (young ? 5 : 8) : (young ? 2 : 3)) + (lie ? (young ? 1 : 2) : 0);
  o.r(hx, hy, young ? 3 : 4, young ? 3 : 4, base);
  o.r(hx+(young ? 2 : 3), hy+(young ? 1 : 2), young ? 1 : 2, young ? 2 : 2, "#e8b8a0");   // mufle
  o.p(hx+(young ? 1 : 2), hy+1, P.ink);                                                  // œil
  if(!young){ o.p(hx, hy-1, "#e8e0c8"); o.p(hx+2, hy-1, "#e8e0c8"); }                  // cornes
  o.p(hx-1, hy+1, dark);                                                                  // oreille
  if(!lie) o.ln(young ? 1 : 1, cy-1, young ? 1 : 1, cy+(young ? 2 : 3), dark);           // queue
  o.outline(C(P.ink));
  return o;
}
function pigSprite(frame, young){
  var o = young ? S(10, 7, 5, 7) : S(15, 10, 7, 10);
  var lie = frame===3, pink = "#e8a890", sh = "#c8806c", lt = "#f4c4b0";
  if(!lie) legs(o, young ? [2,3,6,7] : [3,5,9,11], young ? 5 : 7, young ? 2 : 3, sh, frame);
  var cx = young ? 4.5 : 6.8, cy = (young ? 3.6 : 5) + (lie ? (young ? 1 : 1.6) : 0);
  o.el(cx, cy, young ? 3.4 : 5.2, young ? 2.1 : 2.9, function(nx, ny){ return ny>0.45 ? sh : (nx<-0.2 && ny<-0.1 ? lt : pink); });
  var hx = young ? 7 : 11, hy = (frame===2 ? (young ? 4 : 6) : (young ? 2 : 3)) + (lie ? 1 : 0);
  o.r(hx, hy, young ? 2 : 3, young ? 2 : 3, pink);
  o.r(hx+(young ? 2 : 3), hy+1, 1, young ? 1 : 2, lt);                 // groin
  o.p(hx+(young ? 2 : 3), hy+1, "#a85a50");
  o.p(hx+1, hy, P.ink);                                                 // œil
  o.p(hx, hy-1, sh);                                                    // oreille
  if(!young){ o.p(1, cy-2, sh); o.p(0, cy-3, sh); }                     // queue en tire-bouchon
  o.outline(C(P.ink));
  return o;
}
/* abris des pâturages (1 case) : bergerie, étable, soue, ou simple appentis */
function shelter(kind){
  var o;
  if(kind==="sheep"){
    o = S(18, 17, 1, 17);
    wall(o, 2, 10, 14, 6, "stone", 0);
    o.r(7, 11, 4, 5, P.inkSoft); o.r(7, 11, 4, 1, P.wood1);          // porte ouverte
    roofHip(o, 1, 16, 3, 10, 2, "thatch", { seed:21 });
    contact(o, 2, 15, 16);
  } else if(kind==="cattle"){
    o = S(18, 21, 1, 21);
    wall(o, 2, 13, 14, 7, "plank", 0);
    o.r(6, 14, 6, 6, P.wood1); for(var i=7;i<11;i++) o.r(i, 15, 1, 5, (i&1) ? P.wood2 : P.wood3); o.r(6, 16, 6, 1, P.wood0);   // grande porte
    roofGable(o, 1, 16, 14, 7, 5, "shingle", { seed:22 });
    gableFill(o, 1, 16, 14, 7, 13, "plank");
    o.r(8, 9, 2, 2, "#241c18");                                      // lucarne du fenil
    contact(o, 2, 15, 20);
  } else if(kind==="pig"){
    o = S(18, 14, 1, 14);
    for(var x=2;x<16;x++) for(var y=9;y<13;y++) o.p(x, y, wallPix("stone", x, y, x-2, 14));
    o.r(4, 10, 3, 3, P.inkSoft);                                     // trou de la soue
    roofHip(o, 1, 11, 4, 9, 1, "shingle", { seed:23 });
    o.r(11, 12, 5, 1, "#5e4630"); o.r(12, 11, 3, 1, "#6e5238");     // auge
    contact(o, 2, 15, 13);
  } else {
    o = S(18, 15, 1, 15);
    o.r(3, 7, 1, 7, P.wood1); o.r(14, 7, 1, 7, P.wood0);             // poteaux
    roofHip(o, 1, 16, 3, 8, 2, "thatch", { seed:24 });
    o.el(9, 12, 4, 2, function(nx, ny, x, y){ return hash(x,y,56)<0.5 ? "#c8b060" : "#d8c070"; });   // foin
    contact(o, 3, 14, 14);
  }
  o.outline(C(P.ink), true);
  return o;
}

/* ======================================================
   CAMP DE BRIGANDS, EFFETS, INTERFACE
   ====================================================== */
function banditCamp(){
  var o = S(30, 22, 15, 18);
  function tent(tx, ty, w, col){
    for(var y=0;y<10;y++){
      var hw = 0.5 + y/9*(w/2);
      for(var x=Math.floor(tx-hw); x<=Math.ceil(tx+hw-1); x++){
        var c = roofPix(col, x, y, x<tx ? 0 : -1, 3);
        if(hash(x,y,8)<0.08) c = "#3a2e24";
        o.p(x, ty+y, c);
      }
    }
    o.r(Math.round(tx)-1, ty+5, 2, 5, P.inkSoft);
  }
  tent(8, 3, 12, "hide"); tent(22, 5, 10, "canvas");
  // pieux de palissade
  for(var x=0;x<30;x+=3){ if(x>9 && x<20) continue; o.r(x, 15, 1, 5, P.wood2); o.p(x, 14, P.wood3); }
  // rondin + bannière noire
  o.r(10, 18, 8, 2, P.wood2); o.r(10, 18, 8, 1, P.wood3);
  o.r(27, 0, 1, 15, P.wood1); o.r(23, 1, 4, 4, "#2a2622"); o.p(24,2,"#8a2a2a");
  o.outline(C(P.ink), true);
  return o;
}
function fire(frame){
  var o = S(7, 8, 3, 8);
  o.r(0, 6, 7, 2, P.wood1); o.ln(0, 7, 6, 5, P.wood2);
  var shapes = [
    ["...a...", "..aba..", ".abcba.", ".bcdcb.", "..cdc.."],
    ["..a....", "..ab.a.", ".abcba.", ".bcdcb.", "..cdc.."],
    [".....a.", "...ab..", "..abca.", ".bcdcb.", "..cdc.."],
  ][frame];
  var f = Px.fromStrings(shapes, { a:P.fire0, b:P.fire1, c:P.fire2, d:P.fire3 });
  o.blit(f, 0, 2);
  return o;
}
function flag(frame, col){
  var rows = [
    ["K.....", "Krrrrr", "Krggrr", "Krrrr.", "K.....", "K.....", "K.....", "K....."],
    ["K.....", "Krrrr.", "Krggrr", "Krrrrr", "K.....", "K.....", "K.....", "K....."],
    ["K.....", "Krrrrr", "Krggr.", "Krrrrr", "K.....", "K.....", "K.....", "K....."],
  ][frame];
  var o = Px.fromStrings(rows, { K:P.wood1, r:col||P.red1, g:P.gold2 });
  o.ax = 0; o.ay = 8;
  return o;
}
function smoke(size){
  var o = S(4, 4, 2, 2);
  if(size===0){ o.r(1,1,2,2,"#d4d0c8"); o.p(1,1,"#ece8e0"); }
  else { o.r(0,1,4,2,"#c8c4bc"); o.r(1,0,2,4,"#c8c4bc"); o.p(1,1,"#e4e0d8"); o.p(2,1,"#e4e0d8"); }
  return o;
}
/* chiffres 3 × 5 pour l'affichage de fertilité */
var DIGITS = ["111101101101111","010110010010111","111001111100111","111001111001111","101101111001001",
              "111100111001111","111100111101111","111001010010010","111101111101111","111101111001111"];
function digit(n, col){
  var o = new Px(4, 6), s = DIGITS[n];
  for(var i=0;i<15;i++) if(s[i]==="1"){ o.p(i%3, Math.floor(i/3), col); o.p(i%3+1, Math.floor(i/3)+1, "#14100c"); }
  for(var j=0;j<15;j++) if(s[j]==="1") o.p(j%3, Math.floor(j/3), col);
  return o;
}

/* pavés (place du marché) et terre battue (cours, chantiers) */
function cobbleTile(v){
  var o = new Px(16, 16);
  o.r(0, 0, 16, 16, P.dt1);
  for(var cy=0; cy<16; cy+=4){
    var off = ((cy>>2)&1) ? 2 : 0;
    for(var cx=-off; cx<16; cx+=4){
      var c = hash(cx, cy, v)<0.5 ? P.st2 : (hash(cx, cy, v+1)<0.5 ? P.st3 : "#8a8478");
      o.r(cx, cy, 3, 3, c); o.p(cx, cy, mix(c, "#ffffff", 0.2)); o.p(cx+2, cy+2, mix(c, P.ink, 0.3));
    }
  }
  return o;
}
function dirtTile(v){
  var o = new Px(16, 16);
  for(var y=0;y<16;y++) for(var x=0;x<16;x++){
    var n = hash(x, y, 40+v), m = hash(x>>2, y>>2, 41+v);
    o.p(x, y, n<0.1 ? P.dt1 : (n>0.93 ? P.dt4 : (m<0.5 ? P.dt2 : P.dt3)));
  }
  return o;
}

/* ======================================================
   HIVER : neige sur les toits et le foin
   ====================================================== */
var SNOW_MAP = null;
function snowify(o){
  if(!SNOW_MAP){
    SNOW_MAP = {};
    var to = [null, P.sn0, P.sn1, P.sn2, P.sn3];
    ["thatch","clay","slate","shingle","hide","canvas"].forEach(function(k){
      ROOF[k].forEach(function(col, i){ if(to[i]) SNOW_MAP[C(col)] = C(to[i]); });
    });
    [P.lf2, P.lf3].forEach(function(col){ SNOW_MAP[C(col)] = C(P.sn2); });
  }
  var r = o.clone(); r.ax = o.ax; r.ay = o.ay;
  for(var i=0;i<r.d.length;i++){ var n = SNOW_MAP[r.d[i]]; if(n) r.d[i] = n; }
  return r;
}

/* ======================================================
   OMBRES (formes noires, composées en semi-transparence au rendu)
   ====================================================== */
function shadowEll(w, h, ax, ay){
  var o = S(w, h, ax, ay);
  o.el(w/2, h/2, w/2, h/2, "#000000");
  return o;
}
function shadowBuilding(wt, ht, extra){
  var w = wt*16 + 4 + extra, h = ht*16 + 3;
  var o = S(w, h, -1, h-3);
  for(var y=0;y<h;y++){
    var x0 = 2 + Math.round(y*0.25), x1 = wt*16 + 3 + extra - Math.round((h-1-y)*0.1);
    for(var x=x0;x<=Math.min(w-1,x1);x++) o.p(x, y, "#000000");
  }
  o.p(2,0,null); o.p(w-1,h-1,null);
  return o;
}

/* ======================================================
   ATLAS : tous les sprites dans un seul canvas
   ====================================================== */
var frames = {}, atlas = null, keep = {}, list = [];
function A(o, ax, ay){ o.ax = ax; o.ay = ay; return o; }
function add(name, o){ if(o.ax===undefined){ o.ax = 0; o.ay = o.h; } list.push({ n:name, o:o }); return o; }
function addLR(name, o){
  add(name, o);
  var f = o.flip(); f.ax = o.w - o.ax; f.ay = o.ay;
  add(name+"_l", f);
}
function addW(name, o){ add(name, o); add(name+"_w", snowify(o)); }

/* allures des villageois : 0-4 hommes, 5-8 femmes (robe), 9 ancien, 10 ancienne */
var LOOKS = [["hair",P.hrBrown],["hair",P.hrBlond],["hood",P.hrBrown],["hair",P.hrBlack],["hair",P.hrRed],
  ["coif",P.hrBrown,{dress:1}],["long",P.hrBlond,{dress:1}],["long",P.hrBrown,{dress:1}],["long",P.hrRed,{dress:1}],
  ["hair",P.hrGrey],["coif",P.hrGrey,{dress:1}]];
/* enfants (6 × 9) : 4 garçons, 4 filles */
var KID_HEAD = {
  m: [ ".KKKK.", "KHHHHK", "KHHSEK", ".KSSsK" ],
  f: [ ".KKKK.", "KHHHHK", "KHHSEK", "KHKSsK" ],
};
var KID_BODY = {
  idle:  [ ".KTTK.", "KSTTSK", ".KTtK.", ".KLLK.", ".KFFK." ],
  walkA: [ ".KTTK.", "KSTTSK", ".KTtK.", "KLK.LK", "KF..KF" ],
  walkB: [ ".KTTK.", ".STTSK", ".KTtK.", ".KLLK.", ".KFKF." ],
};
var KID_LOOKS = [[P.hrBrown,"#8a6a4a"],[P.hrBlond,"#5a7a9a"],[P.hrBlack,"#9a5a4a"],[P.hrRed,"#6a8a4a"]];
var KID_BODIES = ["idle","walkA","walkB"];
function kid(sex, look, body){
  var rows = KID_HEAD[sex].concat(KID_BODY[body]);
  if(sex==="f") rows[7] = "KTTTtK";   /* robe */
  var L = KID_LOOKS[look], cl = sex==="f" ? mix(L[1], "#b04a6a", 0.45) : L[1];
  var o = Px.fromStrings(rows, { K:P.ink, H:L[0], S:P.sk1, s:P.sk0, E:P.ink, T:cl, t:mix(cl, P.ink, 0.3), L:"#3a2c22", F:"#22180f" });
  o.ax = 3; o.ay = 9;
  return o;
}
var JOBS = ["laborer","woodcutter","forager","hunter","quarry","farm","windmill","market","trade","pasture"];
var BODIES = ["idle","walkA","walkB","workU","workD"];

function build(){
  if(atlas) return api;
  var t0 = (typeof performance!=="undefined") ? performance.now() : 0;
  var s, v, k;
  /* végétation */
  for(s=0;s<4;s++){
    for(v=0;v<3;v++) keep["oak_"+s+"_"+v] = add("oak_"+s+"_"+v, A(oak(s,v), 10, 26));
    for(v=0;v<2;v++) keep["pine_"+s+"_"+v] = add("pine_"+s+"_"+v, A(pine(s,v), 7, 28));
    for(v=0;v<2;v++) keep["birch_"+s+"_"+v] = add("birch_"+s+"_"+v, A(birch(s,v), 7, 26));
    for(v=0;v<2;v++) add("sap_"+s+"_"+v, A(sapling(s,v), 5, 15));
    for(v=0;v<2;v++) for(k=0;k<4;k++) add("bush_"+s+"_"+v+"_"+k, A(bush(s, v, [0,2,4,7][k]), 6, 10));
    for(v=0;v<2;v++) for(k=0;k<3;k++) add("rock_"+s+"_"+k+"_"+v, A(rocks(s, k, v), 8, 12));
    add("veg_"+s, vegPatch(s));
    add("fruit_"+s, fruitTree(s));
  }
  add("stump", A(stump(), 3, 5));
  /* bâtiments (+ variante hivernale) */
  for(v=0;v<3;v++){ addW("burgage1_"+v, burgage1(v)); addW("burgage2_"+v, burgage2(v)); }
  for(v=0;v<2;v++) addW("burgage3_"+v, burgage3(v));
  addW("woodcutter", woodcutter()); addW("forager", forager()); addW("hunter", hunter());
  addW("quarry", quarry()); addW("granary", granary()); addW("storehouse", storehouse());
  addW("tower", tower()); addW("farm", farm()); addW("windmill", windmillBody());
  addW("market_1", market(true)); addW("market_0", market(false)); addW("trade", trade());
  addW("church_00", church(false,false)); addW("church_01", church(false,true));
  addW("church_10", church(true,false)); addW("church_11", church(true,true));
  addW("manor", manor());
  for(k=0;k<16;k++) addW("wall_"+k, wallPiece(k));
  for(k=0;k<8;k++) add("sails_"+k, windmillSails(k));
  add("scaffold_1", scaffold(1,1)); add("scaffold_2", scaffold(2,2)); add("materials", materials());
  for(var lp=1; lp<=4; lp++) add("pile_timber_"+lp, logPile(lp));
  for(var sp=1; sp<=3; sp++) add("pile_stone_"+sp, stonePile(sp));
  add("drag_timber", dragLoad("timber")); add("drag_stone", dragLoad("stone"));
  addW("camp", banditCamp());
  for(v=0;v<2;v++){ add("cobble_"+v, cobbleTile(v)); add("dirt_"+v, dirtTile(v)); }
  /* sol des champs */
  for(v=0;v<2;v++){
    add("field_plow_"+v, fieldTile("wheat",0,2,v));
    add("field_sown_"+v, fieldTile("wheat",1,2,v));
    for(k=2;k<=6;k++){ add("field_wheat_"+k+"_"+v, fieldTile("wheat",k,2,v)); add("field_barley_"+k+"_"+v, fieldTile("barley",k,2,v)); }
    add("field_fallow_"+v, fieldTile("fallow",3,2,v));
    add("field_snow_"+v, fieldTile("wheat",0,0,v));
    add("field_stub_"+v, stubbleTile(2,v));
  }
  add("sheaf", sheaf());
  /* étape 5 : nouvelles cultures, prés, fumier, blé sous la neige, meules */
  for(v=0;v<2;v++){
    for(k=2;k<=6;k++){ ["rye","oats","flax","peas"].forEach(function(c){ add("field_"+c+"_"+k+"_"+v, cropTile(c, k, v)); }); add("field_hay_"+k+"_"+v, meadowTile(k, v)); }
    add("field_mown_"+v, meadowTile(0, v, true));
    add("field_dung_"+v, dungTile(v));
    add("field_wintercrop_"+v, winterCropTile(v));
  }
  add("haycock", haycock());
  /* étape 5 : bétail et abris */
  for(k=0;k<4;k++){
    addLR("sheep_a_"+k, sheepSprite(k, false)); addLR("sheep_y_"+k, sheepSprite(k, true));
    addLR("cattle_a_"+k, cowSprite(k, false)); addLR("cattle_y_"+k, cowSprite(k, true));
    addLR("pig_a_"+k, pigSprite(k, false)); addLR("pig_y_"+k, pigSprite(k, true));
  }
  ["sheep","cattle","pig","none"].forEach(function(sp){ addW("shelter_"+sp, shelter(sp)); });
  /* personnages */
  for(var l=0;l<LOOKS.length;l++) for(var j=0;j<JOBS.length;j++) for(var b=0;b<BODIES.length;b++)
    addLR("p_"+l+"_"+JOBS[j]+"_"+BODIES[b], person(LOOKS[l][0], BODIES[b], JOB_CLOTH[JOBS[j]], LOOKS[l][1], LOOKS[l][2]));
  for(var ks=0;ks<2;ks++) for(var kl=0;kl<KID_LOOKS.length;kl++) for(var kb=0;kb<KID_BODIES.length;kb++)
    addLR("kid_"+(ks?"f":"m")+"_"+kl+"_"+KID_BODIES[kb], kid(ks?"f":"m", kl, KID_BODIES[kb]));
  add("mark_0", marker(0)); add("mark_1", marker(1)); add("baby", babySprite());
  ["axe","pick","hoe","hammer","sickle","basket","bow","fork","seed","scythe","flail","crook"].forEach(function(t){ addLR("tool_"+t+"_u", toolSprite(t,true)); addLR("tool_"+t+"_d", toolSprite(t,false)); });
  ["timber","berries","meat","stone","sack"].forEach(function(c){ addLR("carry_"+c, carrySprite(c)); });
  ["militia","merc","brigand"].forEach(function(kd){ for(var f=0;f<3;f++) addLR("sol_"+kd+"_"+f, soldier(kd,f)); });
  for(k=0;k<4;k++){ addLR("deer_1_"+k, deer(k,true)); addLR("deer_0_"+k, deer(k,false)); }
  addLR("ox_0", ox(0)); addLR("ox_1", ox(1));
  for(k=0;k<2;k++){ addLR("chick_0_"+k, chicken(k,false)); addLR("chick_1_"+k, chicken(k,true)); }
  add("skep", skep()); add("barrel", barrel()); add("cloth", clothLine());
  /* effets */
  for(k=0;k<3;k++){ add("fire_"+k, fire(k)); add("flag_"+k, flag(k)); add("flagb_"+k, flag(k, P.blue1)); }
  add("smoke_0", smoke(0)); add("smoke_1", smoke(1));
  for(k=0;k<10;k++) add("dig_"+k, digit(k, "#ffffff"));
  /* ombres */
  add("sh_tree", shadowEll(15, 5, 4, 3)); add("sh_pine", shadowEll(11, 4, 3, 2)); add("sh_sap", shadowEll(8, 3, 2, 2));
  add("sh_bush", shadowEll(12, 4, 5, 2)); add("sh_rock", shadowEll(14, 4, 6, 2));
  add("sh_person", shadowEll(7, 3, 3, 2)); add("sh_deer", shadowEll(13, 3, 6, 2)); add("sh_ox", shadowEll(17, 4, 8, 2));
  add("sh_b1", shadowBuilding(1,1,1)); add("sh_b1t", shadowBuilding(1,1,7)); add("sh_b2", shadowBuilding(2,2,2)); add("sh_b2t", shadowBuilding(2,2,8));
  add("sh_camp", shadowEll(28, 6, 13, 3));
  add("sh_sheep", shadowEll(11, 3, 5, 2)); add("sh_lamb", shadowEll(7, 2, 3, 1)); add("sh_cow", shadowEll(15, 4, 7, 2)); add("sh_pig", shadowEll(11, 3, 5, 2));

  /* rangement en étagères (largeur 1024) */
  var AW = 1024, pad = 1;
  list.sort(function(a,b){ return (b.o.h - a.o.h) || (b.o.w - a.o.w); });
  var x = 0, y = 0, rowH = 0;
  for(var i=0;i<list.length;i++){
    var o = list[i].o;
    if(x + o.w > AW){ x = 0; y += rowH + pad; rowH = 0; }
    list[i].x = x; list[i].y = y;
    x += o.w + pad; rowH = Math.max(rowH, o.h);
  }
  var AH = y + rowH;
  var data = new Uint32Array(AW*AH);
  for(var i2=0;i2<list.length;i2++){
    var it = list[i2], oo = it.o;
    for(var yy=0; yy<oo.h; yy++) data.set(oo.d.subarray(yy*oo.w, (yy+1)*oo.w), (it.y+yy)*AW + it.x);
    frames[it.n] = { x:it.x, y:it.y, w:oo.w, h:oo.h, ax:oo.ax, ay:oo.ay };
  }
  atlas = document.createElement("canvas");
  atlas.width = AW; atlas.height = AH;
  atlas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(data.buffer), AW, AH), 0, 0);
  api.atlas = atlas; api.frames = frames; api.keep = keep;
  api.buildMs = (typeof performance!=="undefined") ? Math.round(performance.now() - t0) : 0;
  api.count = list.length;
  list = [];
  return api;
}
/* dessin d'un sprite par son nom, (x, y) = point d'ancrage */
function draw(ctx, name, x, y){
  var f = frames[name];
  if(!f) return false;
  ctx.drawImage(atlas, f.x, f.y, f.w, f.h, Math.round(x - f.ax), Math.round(y - f.ay), f.w, f.h);
  return true;
}
/* dessin partiel (chantier) : seulement la fraction basse p du sprite */
function drawBottom(ctx, name, x, y, p){
  var f = frames[name];
  if(!f || p<=0) return;
  var h = Math.max(1, Math.round(f.h*Math.min(1,p)));
  ctx.drawImage(atlas, f.x, f.y + f.h - h, f.w, h, Math.round(x - f.ax), Math.round(y - f.ay) + f.h - h, f.w, h);
}

/* ======================================================
   API
   ====================================================== */
var api = { P:P, C:C, mix:mix, hash:hash, rng:rng, bayer:bayer, Px:Px, LEAF:LEAF, ROOF:ROOF, JOB_CLOTH:JOB_CLOTH,
  JOBS:JOBS, LOOKS:LOOKS, build:build, draw:draw, drawBottom:drawBottom, frames:frames, atlas:null, keep:keep,
  gen:{ oak:oak, pine:pine, birch:birch, sapling:sapling, stump:stump, bush:bush, rocks:rocks,
    burgage1:burgage1, burgage2:burgage2, burgage3:burgage3, woodcutter:woodcutter, forager:forager,
    hunter:hunter, quarry:quarry, granary:granary, storehouse:storehouse, tower:tower, wallPiece:wallPiece,
    farm:farm, windmillBody:windmillBody, windmillSails:windmillSails, market:market, trade:trade,
    church:church, manor:manor, scaffold:scaffold, materials:materials,
    person:person, toolSprite:toolSprite, carrySprite:carrySprite, soldier:soldier, deer:deer, ox:ox, chicken:chicken,
    skep:skep, vegPatch:vegPatch, barrel:barrel, clothLine:clothLine, fruitTree:fruitTree,
    fieldTile:fieldTile, stubbleTile:stubbleTile, sheaf:sheaf, banditCamp:banditCamp, fire:fire, flag:flag,
    cropTile:cropTile, meadowTile:meadowTile, dungTile:dungTile, haycock:haycock, sheepSprite:sheepSprite, cowSprite:cowSprite,
    pigSprite:pigSprite, shelter:shelter,
    smoke:smoke, digit:digit } };
return api;
})();
