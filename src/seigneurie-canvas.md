---
name: "seigneurie"
title: "Seigneurie — mini Manor Lords en pixels"
type: "react"
---

import React, { useRef, useState, useEffect } from "react";

/*==SIM-START==*/
/* ============================================================
   SEIGNEURIE — simulation médiévale (cœur pur, sans React)
   1 tick = 0,1 jour. 10 ticks = 1 jour. 16 jours = 1 mois.
   ============================================================ */

const TICKS_PER_DAY = 10;
const DAYS_PER_MONTH = 16;

const W = 46;
const H = 34;

const T_GRASS = 0, T_FOREST = 1, T_BERRY = 2, T_STONE = 3, T_WATER = 4;

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const SEASONS = ["Hiver","Printemps","Été","Automne"];
function seasonOf(m: number){ return Math.floor(((m + 1) % 12) / 3); }

function mulberry32(a: number){
  return function(){
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x: number, y: number){ return ((x * 73856093) ^ (y * 19349663)) >>> 0; }

interface Vec { x: number; y: number }

interface BuildingDef {
  id: string; name: string; icon: string;
  w: number; h: number;
  cost: { timber?: number; stone?: number };
  fam: number;
  radius?: number;
  onStone?: boolean;   // doit être posé sur un gisement de pierre
  instant?: boolean;   // pas de chantier de construction
  desc: string;
}

const BUILD_DEFS: Record<string, BuildingDef> = {
  burgage:   { id:"burgage",   name:"Bourgage",       icon:"🏠", w:1,h:1, cost:{timber:1}, fam:0, instant:true,  desc:"Loge une famille. Évolue si ses besoins sont satisfaits." },
  woodcutter:{ id:"woodcutter",name:"Camp de bûcherons",icon:"🪓", w:1,h:1, cost:{timber:2}, fam:2, radius:6, instant:false, desc:"Abat les arbres à proximité : bois d'œuvre + bois de chauffe." },
  forager:   { id:"forager",   name:"Cabane de cueilleuses", icon:"🍒", w:1,h:1, cost:{timber:2}, fam:2, radius:6, instant:false, desc:"Cueille des baies (mars → novembre)." },
  hunter:    { id:"hunter",    name:"Camp de chasse",  icon:"🏹", w:1,h:1, cost:{timber:2}, fam:2, radius:10, instant:false, desc:"Chasse le gibier des forêts : viande, toute l'année." },
  quarry:    { id:"quarry",    name:"Carrière",        icon:"🪨", w:1,h:1, cost:{timber:2}, fam:1, onStone:true, instant:false, desc:"À poser SUR un gisement de pierre. S'épuise avec le temps." },
  farm:      { id:"farm",      name:"Ferme",           icon:"🚜", w:2,h:2, cost:{timber:3}, fam:2, instant:false, desc:"Travaille les champs : labour/semailles au printemps, moisson en septembre." },
  field:     { id:"field",     name:"Champ",           icon:"🌾", w:4,h:4, cost:{}, fam:0, instant:true,  desc:"Gratuit. Rendement selon la fertilité du sol (visible en mode pose). Jachère conseillée." },
  windmill:  { id:"windmill",  name:"Moulin",          icon:"💨", w:2,h:2, cost:{timber:2,stone:2}, fam:1, instant:false, desc:"Transforme le grain en pain (meilleur variété alimentaire)." },
  granary:   { id:"granary",   name:"Grange",          icon:"🏚️", w:1,h:1, cost:{timber:2}, fam:0, instant:false, desc:"Réduit fortement le pourrissement des denrées." },
  storehouse:{ id:"storehouse",name:"Entrepôt",        icon:"📦", w:1,h:1, cost:{timber:2}, fam:0, instant:false, desc:"+150 de capacité de stockage pour chaque ressource." },
  market:    { id:"market",    name:"Marché",          icon:"⛺", w:2,h:2, cost:{timber:2}, fam:3, instant:false, desc:"Sans marché actif, vos familles n'ont accès qu'à un seul type de nourriture." },
  church:    { id:"church",    name:"Église",          icon:"⛪", w:2,h:2, cost:{timber:2,stone:2}, fam:0, instant:false, desc:"+6 d'approbation. Requise pour les bourgages de niveau 3." },
  manor:     { id:"manor",     name:"Manoir",          icon:"🏰", w:2,h:2, cost:{timber:4,stone:3}, fam:0, instant:false, desc:"Permet de lever l'impôt (curseur dans le panneau du manoir)." },
};
const BUILD_ORDER = ["burgage","woodcutter","forager","hunter","quarry","farm","field","windmill","granary","storehouse","market","church","manor"];

const FOOD_TYPES = ["berries","meat","bread","eggs","veg"];
const RES_ICONS: Record<string,string> = { timber:"🪵", firewood:"🔥", stone:"🪨", grain:"🌾", bread:"🍞", berries:"🍒", meat:"🍗", eggs:"🥚", veg:"🥕" };

const SURNAMES = ["Aldéric","Baptiste","Colin","Eudes","Garlin","Hersende","Mahaut","Odon","Perrot","Raoulin","Sanceline","Thomasse","Ysoré","Gaultier","Béatrice","Manessier","Ferrant","Alips","Jourdaine","Nicaise"];

interface Field { fert:number; plow:number; sown:boolean; growth:number; harvestP:number; usedThisYear:boolean; usedLastYear:boolean; }

interface Building {
  id:number; def:string; x:number; y:number; w:number; h:number;
  done:boolean; progress:number; families:number[];
  lvl:number; ext:string|null; monthsGood:number;
  f:Field|null;
}

interface Family {
  id:number; name:string; home:number; work:number;
  x:number; y:number; path:Vec[]|null;
  state:"idle"|"walk"|"work"|"return"|"settle"|"wander";
  timer:number;
  task:{ type:string; tx?:number; ty?:number; deer?:number; bid?:number }|null;
  carry:Record<string,number>|null;
  cool:number; starving:number; lastAte:number; lastVariety:number;
}

interface Deer { id:number; x:number; y:number; path:Vec[]|null; frozen:boolean; }

interface Toast { id:number; text:string; t:number; kind:string }
interface PendingEvent { title:string; text:string; choices:{ label:string; disabled?:boolean; act:string; amount?:number }[] }

const WORK_TIME: Record<string,number> = { chop:14, gather:14, hunt:12, mine:20 };

class GameState {
  seed:number; rnd:()=>number;
  tiles:Uint8Array; treeWood:Float32Array; berryY:Float32Array; stoneAmt:Float32Array; soil:Float32Array;
  occupied:Int32Array;
  buildings:Building[]; nextB:number;
  families:Family[]; nextF:number;
  deer:Deer[]; nextD:number; deerTimer:number;
  stock:Record<string,number>;
  capBase:number; capPer:number;
  time:{ tick:number; day:number; month:number; year:number };
  approval:number; treasury:number; taxRate:number;
  pendingEvent:PendingEvent|null;
  speed:number; toasts:Toast[]; toastId:number;
  uiVersion:number;
  objectives:{ wood:boolean; happy:boolean; pop:boolean; manor:boolean; happyStreak:number };
  victory:boolean;
  winterWarned:boolean;
  mmRect:{ x:number; y:number; w:number; h:number; ppt:number }|null;

  constructor(seed:number){
    this.seed = seed; this.rnd = mulberry32(seed);
    this.tiles = new Uint8Array(W*H);
    this.treeWood = new Float32Array(W*H);
    this.berryY = new Float32Array(W*H);
    this.stoneAmt = new Float32Array(W*H);
    this.soil = new Float32Array(W*H);
    this.occupied = new Int32Array(W*H).fill(-1);
    this.buildings = []; this.nextB = 1;
    this.families = []; this.nextF = 1;
    this.deer = []; this.nextD = 1; this.deerTimer = 0;
    this.stock = { timber:15, firewood:8, stone:0, grain:0, bread:0, berries:25, meat:15, eggs:0, veg:0 };
    this.capBase = 300; this.capPer = 150;
    this.time = { tick:0, day:0, month:2, year:1176 }; // mars 1176
    this.approval = 62; this.treasury = 0; this.taxRate = 0.15;
    this.pendingEvent = null;
    this.speed = 1; this.toasts = []; this.toastId = 1;
    this.uiVersion = 0;
    this.objectives = { wood:false, happy:false, pop:false, manor:false, happyStreak:0 };
    this.victory = false; this.winterWarned = false;
    this.mmRect = null;
    this.genMap();
    this.placeStart();
  }

  /* ---------- génération de la carte ---------- */
  genMap(){
    const r = this.rnd;
    // fertilité du sol par bruit bilinéaire
    const gw = 9, gh = 7;
    const g: number[][] = [];
    for(let y=0;y<gh;y++){ g.push([]); for(let x=0;x<gw;x++) g[y].push(0.25 + r()*0.75); }
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const fx = x/W*(gw-1), fy = y/H*(gh-1);
      const x0=Math.floor(fx), y0=Math.floor(fy), x1=Math.min(gw-1,x0+1), y1=Math.min(gh-1,y0+1);
      const tx=fx-x0, ty=fy-y0;
      const v = g[y0][x0]*(1-tx)*(1-ty) + g[y0][x1]*tx*(1-ty) + g[y1][x0]*(1-tx)*ty + g[y1][x1]*tx*ty;
      this.soil[y*W+x] = v;
    }
    // clairière centrale (départ)
    const cx = Math.floor(W/2), cy = Math.floor(H/2);
    // forêts
    const centers:Vec[] = [];
    for(let i=0;i<3;i++){
      let fx=0, fy=0, tries=0;
      do { fx = 3 + Math.floor(r()*(W-6)); fy = 3 + Math.floor(r()*(H-6)); tries++; }
      while(tries<40 && Math.abs(fx-cx)<9 && Math.abs(fy-cy)<7);
      centers.push({x:fx,y:fy});
    }
    for(const c of centers){
      const rad = 3.5 + r()*2;
      for(let y=0;y<H;y++) for(let x=0;x<W;x++){
        const d = Math.hypot(x-c.x, y-c.y);
        if(d < rad && r() < 1 - d/(rad+1)){
          const i = y*W+x;
          this.tiles[i] = T_FOREST; this.treeWood[i] = 8;
        }
      }
    }
    // baies près des forêts
    for(let k=0;k<2;k++){
      const c = centers[k % centers.length];
      const bx = Math.max(1,Math.min(W-2, c.x + (r()<0.5?-1:1)*(5+Math.floor(r()*3))));
      const by = Math.max(1,Math.min(H-2, c.y + Math.floor(r()*5)-2));
      for(let y=0;y<H;y++) for(let x=0;x<W;x++){
        if(Math.hypot(x-bx,y-by) < 2.6 && r()<0.8){
          const i=y*W+x;
          if(this.tiles[i]===T_GRASS){ this.tiles[i]=T_BERRY; this.berryY[i]=8; }
        }
      }
    }
    // gisements de pierre
    for(let k=0;k<2;k++){
      let sx=0, sy=0, tries=0;
      do { sx=2+Math.floor(r()*(W-4)); sy=2+Math.floor(r()*(H-4)); tries++; }
      while(tries<50 && (Math.abs(sx-cx)<10 && Math.abs(sy-cy)<8));
      for(let y=0;y<H;y++) for(let x=0;x<W;x++){
        if(Math.hypot(x-sx,y-sy)<1.9 && r()<0.9){
          const i=y*W+x;
          if(this.tiles[i]===T_GRASS){ this.tiles[i]=T_STONE; this.stoneAmt[i]=260; }
        }
      }
    }
    // étang dans un coin
    const px = r()<0.5 ? 3 : W-4, py = r()<0.5 ? 3 : H-4;
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      if(Math.hypot(x-px,y-py) < 2.4){ const i=y*W+x; this.tiles[i]=T_WATER; this.treeWood[i]=0; this.berryY[i]=0; }
    }
    // clairière de départ
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      if(Math.hypot(x-cx,y-cy) < 5){
        const i=y*W+x;
        if(this.tiles[i]!==T_WATER){ this.tiles[i]=T_GRASS; this.treeWood[i]=0; this.berryY[i]=0; }
      }
    }
    // cerfs en lisière
    for(let i=0;i<7;i++){
      const c = centers[i % centers.length];
      const dx = c.x + (r()<0.5?-1:1)*(4+Math.floor(r()*2));
      const dy = Math.max(1,Math.min(H-2, c.y + Math.floor(r()*4)-2));
      const tx = Math.max(1,Math.min(W-2,dx));
      if(this.tiles[dy*W+tx]!==T_WATER && this.occupied[dy*W+tx]<0)
        this.deer.push({ id:this.nextD++, x:tx+0.5, y:dy+0.5, path:null, frozen:false });
    }
  }

  placeStart(){
    const cx = Math.floor(W/2), cy = Math.floor(H/2);
    const spots = [ {x:cx-2,y:cy-1}, {x:cx+1,y:cy-1}, {x:cx-2,y:cy+2} ];
    for(const s of spots){
      if(this.tiles[s.y*W+s.x]!==T_GRASS) continue;
      const b = this.makeBuilding("burgage", s.x, s.y);
      b.done = true; b.progress = 1;
      const f = this.makeFamily();
      f.home = b.id; f.x = s.x+0.5; f.y = s.y+0.5;
    }
    if(this.families.length===0){
      const b = this.makeBuilding("burgage", cx, cy); b.done=true; b.progress=1;
      const f = this.makeFamily(); f.home=b.id; f.x=cx+0.5; f.y=cy+0.5;
    }
  }

  /* ---------- fabriques ---------- */
  makeBuilding(def:string, x:number, y:number):Building{
    const d = BUILD_DEFS[def];
    const b:Building = { id:this.nextB++, def, x, y, w:d.w, h:d.h, done:false, progress:0, families:[], lvl:1, ext:null, monthsGood:0, f:null };
    if(def==="field"){
      let s=0; for(let yy=0;yy<d.h;yy++) for(let xx=0;xx<d.w;xx++) s += this.soil[(y+yy)*W+(x+xx)];
      b.f = { fert: Math.min(1, s/(d.w*d.h)), plow:0, sown:false, growth:0, harvestP:0, usedThisYear:false, usedLastYear:false };
    }
    this.buildings.push(b);
    for(let yy=0;yy<d.h;yy++) for(let xx=0;xx<d.w;xx++) this.occupied[(y+yy)*W+(x+xx)] = b.id;
    return b;
  }

  makeFamily():Family{
    const f:Family = { id:this.nextF++, name:"Famille "+SURNAMES[Math.floor(this.rnd()*SURNAMES.length)], home:-1, work:-1,
      x:0.5, y:H/2, path:null, state:"settle", timer:0, task:null, carry:null,
      cool:0, starving:0, lastAte:2, lastVariety:1 };
    this.families.push(f);
    return f;
  }

  toast(text:string, kind="info"){
    this.toasts.push({ id:this.toastId++, text, t:Date.now(), kind });
    if(this.toasts.length>6) this.toasts.shift();
    this.uiVersion++;
  }

  /* ---------- utilitaires économie ---------- */
  storehouseCount(){ return this.buildings.filter(b=>b.done && b.def==="storehouse").length; }
  capFor(res:string){ return this.capBase + this.capPer*this.storehouseCount(); }
  hasManor(){ return this.buildings.some(b=>b.done && b.def==="manor"); }
  hasChurch(){ return this.buildings.some(b=>b.done && b.def==="church"); }
  marketActive(){ return this.buildings.some(b=>b.done && b.def==="market" && b.families.length>0); }
  freeBurgages(){ return this.buildings.filter(b=>b.done && b.def==="burgage" && !this.families.some(f=>f.home===b.id)).length; }
  season(){ return seasonOf(this.time.month); }
  berrySeason(){ const m=this.time.month; return m>=2 && m<=10; } // mars → novembre
  unemployed(){ return this.families.filter(f=>f.work<0).length; }

  canAfford(def:string){ const c=BUILD_DEFS[def].cost; return this.stock.timber>=(c.timber||0) && this.stock.stone>=(c.stone||0); }
  costText(def:string){ const c=BUILD_DEFS[def].cost; const p:string[]=[]; if(c.timber)p.push(c.timber+" 🪵"); if(c.stone)p.push(c.stone+" 🪨"); return p.length?p.join(" "):"Gratuit"; }

  /* ---------- placement ---------- */
  canPlace(def:string, x:number, y:number):string|null{
    const d = BUILD_DEFS[def];
    if(x<0 || y<0 || x+d.w>W || y+d.h>H) return "Hors de la carte";
    for(let yy=0;yy<d.h;yy++) for(let xx=0;xx<d.w;xx++){
      const i=(y+yy)*W+(x+xx);
      const t=this.tiles[i];
      if(this.occupied[i]>=0) return "Emplacement occupé";
      if(t===T_WATER) return "Impossible sur l'eau";
      if(def==="quarry"){ if(t!==T_STONE) return "Doit être posé sur un gisement de pierre"; }
      else { if(t!==T_GRASS) return "Terrain impropre (forêt, baies ou rocher)"; }
    }
    if(!this.canAfford(def)) return "Ressources insuffisantes";
    return null;
  }

  place(def:string, x:number, y:number):string|null{
    const err = this.canPlace(def, x, y);
    if(err) return err;
    const d = BUILD_DEFS[def];
    this.stock.timber -= (d.cost.timber||0);
    this.stock.stone -= (d.cost.stone||0);
    const b = this.makeBuilding(def, x, y);
    if(d.instant || d.id==="field"){ b.done = true; b.progress = 1; }
    this.uiVersion++;
    return null;
  }

  demolish(id:number){
    const idx = this.buildings.findIndex(b=>b.id===id);
    if(idx<0) return;
    const b = this.buildings[idx];
    const d = BUILD_DEFS[b.def];
    this.stock.timber += Math.floor((d.cost.timber||0)/2);
    this.stock.stone += Math.floor((d.cost.stone||0)/2);
    for(let yy=0;yy<b.h;yy++) for(let xx=0;xx<b.w;xx++) this.occupied[(b.y+yy)*W+(b.x+xx)] = -1;
    for(const f of this.families){
      if(f.work===b.id){ f.work=-1; f.task=null; f.path=null; f.state="idle"; f.carry=null; }
      if(f.home===b.id) f.home = -1;
    }
    for(const o of this.buildings){ o.families = o.families.filter(fid=>this.families.some(ff=>ff.id===fid)); }
    this.buildings.splice(idx,1);
    this.toast(d.name+" démoli (moitié du coût remboursée)");
  }

  assign(bid:number){
    const b = this.buildings.find(x=>x.id===bid); if(!b) return;
    const d = BUILD_DEFS[b.def];
    if(d.fam<=0) return;
    if(b.families.length>=d.fam) return;
    const f = this.families.find(f=>f.work<0); if(!f) return;
    f.work = bid; b.families.push(f.id);
    this.resetWorker(f);
    this.uiVersion++;
  }
  unassign(bid:number){
    const b = this.buildings.find(x=>x.id===bid); if(!b) return;
    const fid = b.families.pop(); if(fid===undefined) return;
    const f = this.families.find(f=>f.id===fid); if(!f) return;
    f.work = -1; this.resetWorker(f);
    this.uiVersion++;
  }
  resetWorker(f:Family){ f.task=null; f.path=null; f.state="idle"; f.carry=null; f.timer=0; f.cool=0; }

  setTax(v:number){ this.taxRate = Math.max(0, Math.min(1, v)); this.uiVersion++; }

  buyExtension(bid:number, ext:string){
    const b = this.buildings.find(x=>x.id===bid); if(!b || b.def!=="burgage" || !b.done) return;
    if(b.ext) return;
    if(this.stock.timber<1){ this.toast("Il faut 1 🪵 pour cet agrandissement","bad"); return; }
    this.stock.timber -= 1; b.ext = ext;
    this.toast("Agrandissement ajouté au bourgage");
    this.uiVersion++;
  }

  resolveEvent(choiceIndex:number){
    const ev = this.pendingEvent; if(!ev) return;
    const c = ev.choices[choiceIndex];
    if(c.act==="pay"){ this.treasury -= (c.amount||0); this.toast("Le roi a reçu son dû. La paix est préservée.","good"); }
    else if(c.act==="refuseTax"){ this.approval -= 12; const lost=this.stock.berries+this.stock.meat+this.stock.bread+this.stock.eggs+this.stock.veg;
      for(const k of FOOD_TYPES) this.stock[k]=Math.floor(this.stock[k]*0.75); this.toast("Le bailli confisque une partie des récoltes !","bad"); }
    else if(c.act==="payBandits"){ this.treasury -= (c.amount||0); this.toast("Les brigands s'éloignent, bourse plus légère.","good"); }
    else if(c.act==="hideBandits"){ for(const k of ["berries","meat","bread","eggs","veg"]) this.stock[k]=Math.floor(this.stock[k]*0.8);
      this.stock.timber=Math.floor(this.stock.timber*0.9); this.toast("Les brigands pillent la seigneurie et repartent.","bad"); }
    this.pendingEvent = null;
    this.approval = Math.max(0, Math.min(100, this.approval));
    this.uiVersion++;
  }

  /* ---------- pathfinding ---------- */
  passable(x:number,y:number){
    if(x<0||y<0||x>=W||y>=H) return false;
    const i=y*W+x;
    return this.tiles[i]!==T_WATER && this.occupied[i]<0;
  }
  astar(sx:number,sy:number,tx:number,ty:number):Vec[]|null{
    if(sx===tx && sy===ty) return [];
    const N=W*H;
    const open:number[]=[sy*W+sx];
    const gS=new Float32Array(N).fill(Infinity); gS[sy*W+sx]=0;
    const came=new Int32Array(N).fill(-1);
    const inO=new Uint8Array(N); inO[sy*W+sx]=1;
    let guard=0;
    while(open.length>0 && guard++<2600){
      let bi=0, bf=Infinity;
      for(let i=0;i<open.length;i++){
        const n=open[i]; const f=gS[n]+Math.abs((n%W)-tx)+Math.abs(((n/W)|0)-ty);
        if(f<bf){ bf=f; bi=i; }
      }
      const cur=open[bi]; open[bi]=open[open.length-1]; open.pop(); inO[cur]=0;
      const cxx=cur%W, cyy=(cur/W)|0;
      if(cxx===tx && cyy===ty){
        const path:Vec[]=[]; let c=cur;
        while(c!==-1 && c!==sy*W+sx){ path.push({x:(c%W)+0.5, y:((c/W)|0)+0.5}); c=came[c]; }
        path.reverse(); return path;
      }
      const dirs=[1,-1,W,-W];
      for(let k=0;k<4;k++){
        const n=cur+dirs[k];
        const nx=n%W, ny=(n/W)|0;
        if(Math.abs(nx-cxx)+Math.abs(ny-cyy)!==1) continue;
        if(nx<0||ny<0||nx>=W||ny>=H) continue;
        if(!this.passable(nx,ny)) continue;
        const ng=gS[cur]+1;
        if(ng<gS[n]){ gS[n]=ng; came[n]=cur; if(!inO[n]){ inO[n]=1; open.push(n); } }
      }
    }
    return null;
  }
  // trouve une case praticable adjacente au bâtiment (pour y travailler)
  spotFor(b:Building, fx:number, fy:number):Vec|null{
    let best:Vec|null=null, bd=Infinity;
    for(let r=1;r<=3;r++){
      for(let yy=b.y-r; yy<=b.y+b.h-1+r; yy++){
        for(let xx=b.x-r; xx<=b.x+b.w-1+r; xx++){
          const edge = (xx===b.x-r||xx===b.x+b.w-1+r||yy===b.y-r||yy===b.y+b.h-1+r);
          if(!edge) continue;
          if(this.passable(xx,yy)){
            const d=Math.hypot(xx-fx,yy-fy);
            if(d<bd){ bd=d; best={x:xx,y:yy}; }
          }
        }
      }
      if(best) return best;
    }
    return null;
  }
  sendTo(f:Family, tx:number, ty:number, task:{type:string;tx?:number;ty?:number;deer?:number;bid?:number}):boolean{
    const sx=Math.floor(f.x), sy=Math.floor(f.y);
    let gx=tx, gy=ty;
    if(!this.passable(tx,ty)){
      const spot=this.spotFor({id:0,def:"burgage",x:tx,y:ty,w:1,h:1,done:true,progress:1,families:[],lvl:1,ext:null,monthsGood:0,f:null}, f.x, f.y);
      if(!spot){ f.cool=30; return false; }
      gx=spot.x; gy=spot.y;
    }
    if(sx===gx && sy===gy){ f.state="work"; f.timer=WORK_TIME[task.type]||15; f.task=task; return true; }
    const p=this.astar(sx,sy,gx,gy);
    if(!p){ f.cool=40; return false; }
    f.path=p; f.state="walk"; f.task=task;
    return true;
  }
  sendToBuilding(f:Family, b:Building, task:{type:string;bid?:number}):boolean{
    const spot=this.spotFor(b, f.x, f.y);
    if(!spot){ f.cool=30; return false; }
    const sx=Math.floor(f.x), sy=Math.floor(f.y);
    if(sx===spot.x && sy===spot.y){ f.state="work"; f.timer=WORK_TIME[task.type]||15; f.task=task; return true; }
    const p=this.astar(sx,sy,spot.x,spot.y);
    if(!p){ f.cool=40; return false; }
    f.path=p; f.state="walk"; f.task=task;
    return true;
  }

  moveAlong(f:{x:number;y:number}, path:Vec[]|null, speed:number):boolean{
    if(!path || path.length===0) return true;
    const wp=path[0];
    const dx=wp.x-f.x, dy=wp.y-f.y;
    const d=Math.hypot(dx,dy);
    if(d<0.06){ path.shift(); if(path.length===0) return true; return false; }
    const step=Math.min(speed,d);
    f.x+=dx/d*step; f.y+=dy/d*step;
    return false;
  }

  /* ---------- travail des familles ---------- */
  findForestNear(b:Building):number{
    let best=-1, bd=Infinity;
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const i=y*W+x;
      if(this.tiles[i]===T_FOREST && this.treeWood[i]>0){
        const d=Math.hypot(x+0.5-(b.x+0.5), y+0.5-(b.y+0.5));
        if(d<=(BUILD_DEFS.woodcutter.radius||5) && d<bd){ bd=d; best=i; }
      }
    }
    return best;
  }
  findBerryNear(b:Building):number{
    let best=-1, bd=Infinity;
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const i=y*W+x;
      if(this.tiles[i]===T_BERRY && this.berryY[i]>1){
        const d=Math.hypot(x+0.5-(b.x+0.5), y+0.5-(b.y+0.5));
        if(d<=(BUILD_DEFS.forager.radius||4) && d<bd){ bd=d; best=i; }
      }
    }
    return best;
  }
  findDeerNear(b:Building):Deer|null{
    let best:Deer|null=null, bd=Infinity;
    for(const d of this.deer){
      if(d.frozen) continue;
      const dist=Math.hypot(d.x-(b.x+0.5), d.y-(b.y+0.5));
      if(dist<=(BUILD_DEFS.hunter.radius||9) && dist<bd){ bd=dist; best=d; }
    }
    return best;
  }
  fields(){ return this.buildings.filter(b=>b.done && b.def==="field" && b.f); }

  assignTask(f:Family){
    if(f.cool>0){ f.cool--; return; }
    const b = f.work>0 ? this.buildings.find(x=>x.id===f.work && x.done) : undefined;
    const site = f.work>0 ? this.buildings.find(x=>x.id===f.work && !x.done) : undefined;

    // chantier : les familles affectées à un bâtiment non terminé participent au chantier
    if(site){ this.taskBuild(f, site); return; }
    if(!b){
      // journaliers : construisent le chantier le plus proche, sinon flânent
      const sites = this.buildings.filter(s=>!s.done);
      if(sites.length>0){
        let nearest=sites[0], nd=Infinity;
        for(const s of sites){ const d=Math.hypot(s.x-f.x,s.y-f.y); if(d<nd){nd=d;nearest=s;} }
        this.taskBuild(f, nearest); return;
      }
      if(this.rnd()<0.3){ // flâner près de chez soi
        const home = f.home>0 ? this.buildings.find(x=>x.id===f.home) : null;
        const hx = home?home.x:W/2, hy = home?home.y:H/2;
        const tx=Math.max(0,Math.min(W-1,Math.floor(hx+this.rnd()*5-2)));
        const ty=Math.max(0,Math.min(H-1,Math.floor(hy+this.rnd()*5-2)));
        if(this.passable(tx,ty)){
          const p=this.astar(Math.floor(f.x),Math.floor(f.y),tx,ty);
          if(p){ f.path=p; f.state="wander"; return; }
        }
        f.cool=20;
      }
      return;
    }
    const m=this.time.month;
    switch(b.def){
      case "woodcutter":{
        if(this.stock.timber>=this.capFor("timber") && this.stock.firewood>=this.capFor("firewood")){ f.cool=30; return; }
        const i=this.findForestNear(b);
        if(i<0){ f.cool=50; return; }
        if(!this.sendTo(f, i%W, (i/W)|0, {type:"chop", tx:i%W, ty:(i/W)|0})) return;
        break;
      }
      case "forager":{
        if(!this.berrySeason()){ f.cool=60; return; }
        if(this.stock.berries>=this.capFor("berries")){ f.cool=30; return; }
        const i=this.findBerryNear(b);
        if(i<0){ f.cool=50; return; }
        if(!this.sendTo(f, i%W, (i/W)|0, {type:"gather", tx:i%W, ty:(i/W)|0})) return;
        break;
      }
      case "hunter":{
        if(this.stock.meat>=this.capFor("meat")){ f.cool=30; return; }        const d=this.findDeerNear(b);
        if(!d){ f.cool=60; return; }
        d.frozen=true;
        const ok=this.sendTo(f, Math.floor(d.x), Math.floor(d.y), {type:"hunt", deer:d.id});
        if(!ok){ d.frozen=false; }
        return;
      }
      case "quarry":{
        if(this.stock.stone>=this.capFor("stone")){ f.cool=30; return; }
        const i=b.y*W+b.x;
        if(this.stoneAmt[i]<=0){ f.cool=80; return; }
        if(!this.sendToBuilding(f, b, {type:"mine"})) return;
        break;
      }
      case "farm":{
        const fs=this.fields();
        if(m===2 || m===3){ // mars-avril : labour + semailles
          let target:Building|null=null, td=Infinity;
          for(const fd of fs){ if(fd.f && fd.f.plow<1){ const d=Math.hypot(fd.x-f.x,fd.y-f.y); if(d<td){td=d;target=fd;} } }
          if(target && target.f){ this.sendToBuilding(f, target, {type:"plow", bid:target.id}); return; }
          f.cool=40; return;
        }
        if(m===8 || m===9){ // septembre-octobre : moisson
          let target:Building|null=null, td=Infinity;
          for(const fd of fs){ if(fd.f && fd.f.sown && fd.f.growth>0.85 && fd.f.harvestP<1){ const d=Math.hypot(fd.x-f.x,fd.y-f.y); if(d<td){td=d;target=fd;} } }
          if(target && target.f){ this.sendToBuilding(f, target, {type:"harvest", bid:target.id}); return; }
          f.cool=40; return;
        }
        f.cool=60; return;
      }
      case "windmill":{
        if(this.stock.grain>0 && this.stock.bread<this.capFor("bread")){
          this.sendToBuilding(f, b, {type:"mill"}); return;
        }
        f.cool=40; return;
      }
      case "market":{
        this.sendToBuilding(f, b, {type:"stall"}); return;
      }
      default: f.cool=80; return;
    }
  }

  taskBuild(f:Family, site:Building){
    const d=Math.hypot(site.x+site.w/2-f.x, site.y+site.h/2-f.y);
    if(d<1.8){ f.state="work"; f.task={type:"build", bid:site.id}; return; }
    this.sendToBuilding(f, site, {type:"build", bid:site.id});
  }

  stepFamily(f:Family){
    switch(f.state){
      case "settle":
        if(this.moveAlong(f, f.path, 0.25) || !f.path){ f.state="idle"; f.cool=0; f.path=null; }
        break;
      case "wander":
        if(this.moveAlong(f, f.path, 0.18)){ f.state="idle"; f.cool=25; f.path=null; }
        break;
      case "walk":
        if(this.moveAlong(f, f.path, 0.25)){
          f.path=null;
          const t=f.task;
          if(!t){ f.state="idle"; break; }
          if(t.type==="build"||t.type==="plow"||t.type==="harvest"||t.type==="mill"||t.type==="stall"){ f.state="work"; f.timer=0; }
          else { f.state="work"; f.timer=WORK_TIME[t.type]||15; }
        }
        break;
      case "work":
        this.doWork(f);
        break;
      case "return":
        if(this.moveAlong(f, f.path, 0.25)){
          f.path=null;
          this.deposit(f);
          f.state="idle"; f.cool=2;
        }
        break;
      case "idle":
      default:
        this.assignTask(f);
        break;
    }
  }

  doWork(f:Family){
    const t=f.task; if(!t){ f.state="idle"; return; }
    const b = f.work>0 ? this.buildings.find(x=>x.id===f.work) : null;
    switch(t.type){
      case "chop":{
        if(f.timer>0){ f.timer--; if(f.timer===0) this.finishWork(f); }
        break;
      }
      case "gather": case "hunt": case "mine":{
        if(f.timer>0){ f.timer--; if(f.timer===0) this.finishWork(f); }
        break;
      }
      case "build":{
        const site = t.bid!==undefined ? this.buildings.find(x=>x.id===t.bid) : null;
        if(!site || site.done){ f.task=null; f.state="idle"; f.cool=5; break; }
        site.progress += 0.0045;
        if(site.progress>=1){
          site.done=true; site.progress=1;
          this.toast(BUILD_DEFS[site.def].name+" est achevé(e) !","good");
          if(site.def==="manor") this.toast("Vous pouvez désormais lever l'impôt.","good");
          f.task=null; f.state="idle"; f.cool=5;
        }
        break;
      }
      case "plow":{
        const fd = t.bid!==undefined ? this.buildings.find(x=>x.id===t.bid) : null;
        if(!fd || !fd.f){ f.task=null; f.state="idle"; break; }
        if(this.time.month>3){ f.task=null; f.state="idle"; f.cool=10; break; }
        fd.f.plow = Math.min(1, fd.f.plow + 0.005);
        if(fd.f.plow>=1 && !fd.f.sown && this.time.month<=3){
          fd.f.sown=true; fd.f.usedThisYear=true;
          this.toast("Les semailles sont faites !","good");
          f.task=null; f.state="idle"; f.cool=5;
        } else if(fd.f.plow>=1){ f.task=null; f.state="idle"; f.cool=5; }
        break;
      }
      case "harvest":{
        const fd = t.bid!==undefined ? this.buildings.find(x=>x.id===t.bid) : null;
        if(!fd || !fd.f || !fd.f.sown || (this.time.month!==8 && this.time.month!==9)){ f.task=null; f.state="idle"; f.cool=10; break; }
        fd.f.harvestP = Math.min(1, fd.f.harvestP + 0.008);
        if(fd.f.harvestP>=1){
          const yieldQty = Math.round(fd.f.plow>=1 ? fd.w*fd.h*4*fd.f.fert*fd.f.growth : 0);
          this.stock.grain = Math.min(this.capFor("grain"), this.stock.grain + yieldQty);
          this.toast("Moisson : "+yieldQty+" 🌾","good");
          fd.f.sown=false; fd.f.growth=0; fd.f.plow=0; fd.f.harvestP=0;
          fd.f.fert = Math.max(0.2, fd.f.fert*0.85);
          f.task=null; f.state="idle"; f.cool=5;
        }
        break;
      }
      case "mill":{
        f.timer++;
        if(f.timer>=12){
          f.timer=0;
          if(this.stock.grain>0 && this.stock.bread<this.capFor("bread")){
            this.stock.grain--; this.stock.bread++;
          } else { f.task=null; f.state="idle"; f.cool=20; }
        }
        break;
      }
      case "stall":{
        // reste au marché, petit va-et-vient décoratif
        f.timer++;
        if(f.timer>200){ f.timer=0; }
        break;
      }
    }
  }

  finishWork(f:Family){
    const t=f.task;
    if(!t){ f.state="idle"; return; }
    f.task=null;
    const cap=(k:string)=>this.capFor(k);
    if(t.type==="chop" && t.tx!==undefined && t.ty!==undefined){
      const i=t.ty*W+t.tx;
      this.treeWood[i]-=2;
      if(this.treeWood[i]<=0){ this.treeWood[i]=0; this.tiles[i]=T_GRASS; }
      f.carry={ timber:3, firewood:3 };
    } else if(t.type==="gather" && t.tx!==undefined && t.ty!==undefined){
      const i=t.ty*W+t.tx;
      this.berryY[i]=Math.max(0,this.berryY[i]-3);
      f.carry={ berries:3 };
    } else if(t.type==="hunt" && t.deer!==undefined){
      const di=this.deer.findIndex(d=>d.id===t.deer);
      if(di>=0){ this.deer.splice(di,1); this.deerTimer=300; }
      f.carry={ meat:3 };
    } else if(t.type==="mine"){
      const b=f.work>0?this.buildings.find(x=>x.id===f.work):null;
      if(b){ const i=b.y*W+b.x; this.stoneAmt[i]=Math.max(0,this.stoneAmt[i]-2);
        if(this.stoneAmt[i]<=0) this.toast("La carrière est épuisée !","bad");
      }
      f.carry={ stone:2 };
    }
    // retour au bâtiment de travail pour déposer
    const b=f.work>0?this.buildings.find(x=>x.id===f.work):null;
    if(b && f.carry){
      const spot=this.spotFor(b, f.x, f.y);
      if(spot && (Math.floor(f.x)!==spot.x || Math.floor(f.y)!==spot.y)){
        const p=this.astar(Math.floor(f.x),Math.floor(f.y),spot.x,spot.y);
        if(p){ f.path=p; f.state="return"; return; }
      }
      this.deposit(f); f.state="idle"; f.cool=3;
    } else {
      f.state="idle"; f.cool=3;
    }
  }

  deposit(f:Family){
    if(!f.carry) return;
    for(const k in f.carry){
      const cap=this.capFor(k);
      const room=Math.max(0, cap-this.stock[k]);
      this.stock[k]+=Math.min(room, f.carry[k]);
    }
    f.carry=null;
  }

  /* ---------- progression du temps ---------- */
  step(){
    const t=this.time;
    t.tick++;
    // croissance des cultures (mai → août)
    if(t.month>=4 && t.month<=7){
      for(const b of this.buildings){
        if(b.done && b.def==="field" && b.f && b.f.sown && b.f.growth<1){
          b.f.growth = Math.min(1, b.f.growth + 0.0016);
        }
      }
    }
    for(const f of this.families) this.stepFamily(f);
    // cerfs
    if(t.tick%6===0){
      for(const d of this.deer){
        if(d.frozen) continue;
        if(this.rnd()<0.25 && (!d.path || d.path.length===0)){
          const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
          const dd=dirs[Math.floor(this.rnd()*4)];
          const nx=Math.floor(d.x)+dd[0], ny=Math.floor(d.y)+dd[1];
          if(this.passable(nx,ny)) d.path=[{x:nx+0.5,y:ny+0.5}];
        }
        if(d.path && d.path.length>0) this.moveAlong(d, d.path, 0.06);
      }
      if(this.deerTimer>0){ this.deerTimer--; if(this.deerTimer<=0 && this.deer.length<7){
        const cx=2+Math.floor(this.rnd()*(W-4)), cy=2+Math.floor(this.rnd()*(H-4));
        if(this.passable(cx,cy)) this.deer.push({id:this.nextD++, x:cx+0.5, y:cy+0.5, path:null, frozen:false});
      }}
      // libère les cerfs dont le chasseur a disparu
      if(t.tick%200===0){
        const hunting=new Set<number>();
        for(const f of this.families) if(f.task && f.task.type==="hunt" && f.task.deer!==undefined && f.state!=="idle") hunting.add(f.task.deer);
        for(const d of this.deer) if(d.frozen && !hunting.has(d.id)) d.frozen=false;
      }
    }
    if(t.tick>=TICKS_PER_DAY){
      t.tick=0; t.day++;
      if(t.day>=DAYS_PER_MONTH){
        t.day=0; t.month++;
        if(t.month>11){ t.month=0; t.year++; this.onYear(); }
        this.onMonth();
      }
    }
  }

  onYear(){
    for(const b of this.fields()){
      const f=b.f; if(!f) continue;
      if(f.usedLastYear && !f.usedThisYear) f.fert=Math.min(1, f.fert+0.12); // jachère
      f.usedLastYear=f.usedThisYear; f.usedThisYear=false;
    }
  }

  onMonth(){
    const m=this.time.month;
    const winter=(seasonOf(m)===0);
    // production des agrandissements
    for(const b of this.buildings){
      if(b.done && b.def==="burgage" && b.ext==="garden") this.stock.veg=Math.min(this.capFor("veg"), this.stock.veg+0.5);
      if(b.done && b.def==="burgage" && b.ext==="chicken") this.stock.eggs=Math.min(this.capFor("eggs"), this.stock.eggs+0.5);
    }
    // repousse des baies et croissance lente des arbres non abattus
    if(this.berrySeason()){
      for(let i=0;i<W*H;i++) if(this.tiles[i]===T_BERRY) this.berryY[i]=Math.min(10, this.berryY[i]+0.18*DAYS_PER_MONTH);
    }
    for(let i=0;i<W*H;i++){
      if(this.tiles[i]===T_FOREST && this.treeWood[i]>0 && this.treeWood[i]<8){
        // croissance des arbres non abattus si un voisin est forestier
        const x=i%W, y=(i/W)|0;
        const near = (x>0&&this.tiles[i-1]===T_FOREST)||(x<W-1&&this.tiles[i+1]===T_FOREST)||(y>0&&this.tiles[i-W]===T_FOREST)||(y<H-1&&this.tiles[i+W]===T_FOREST);
        if(near) this.treeWood[i]=Math.min(8, this.treeWood[i]+0.15);
      }
    }
    // reforestation lente : de jeunes arbres repoussent en lisière
    let planted=0;
    for(let tries=0; tries<50 && planted<3; tries++){
      const i=Math.floor(this.rnd()*W*H);
      if(this.tiles[i]!==T_GRASS || this.occupied[i]>=0) continue;
      const x=i%W, y=(i/W)|0;
      let nf=0;
      if(x>0&&this.tiles[i-1]===T_FOREST)nf++;
      if(x<W-1&&this.tiles[i+1]===T_FOREST)nf++;
      if(y>0&&this.tiles[i-W]===T_FOREST)nf++;
      if(y<H-1&&this.tiles[i+W]===T_FOREST)nf++;
      if(nf>=2){ this.tiles[i]=T_FOREST; this.treeWood[i]=3; planted++; }
    }
    // ----- consommation des foyers (1 nourriture + bois de chauffe par mois) -----
    const market=this.marketActive();
    const available=FOOD_TYPES.filter(k=>this.stock[k]>0.5);
    const accessible=market?available:available.slice(0,1);
    const varietyVillage=accessible.length; // variété offerte par le marché
    let starved=0;
    for(const f of this.families){
      let need=1, ate=0, turn=0;
      while(need>0 && accessible.length>0){
        accessible.sort((a,b)=>this.stock[b]-this.stock[a]);
        // on alterne les types pour la variété alimentaire (comme les étals d'un marché)
        const k = (turn%2===1 && accessible.length>1) ? accessible[1] : accessible[0];
        turn++;
        if(this.stock[k]<1) break;
        this.stock[k]-=1; ate++; need--;
        if(this.stock[k]<1){ const ix=accessible.indexOf(k); if(ix>=0) accessible.splice(ix,1); }
      }
      f.lastAte=ate; f.lastVariety=varietyVillage;
      if(ate===0){ f.starving++; starved++; } else f.starving=0;
    }
    // bois de chauffe
    const fuelNeed=this.families.length*(winter?2:1);
    const fuelGot=Math.min(this.stock.firewood, fuelNeed);
    this.stock.firewood-=fuelGot;
    const fuelRatio=fuelNeed>0?fuelGot/fuelNeed:1;
    // pourrissement
    const spoil=this.buildings.some(b=>b.done&&b.def==="granary")?0.03:0.10;
    for(const k of FOOD_TYPES) this.stock[k]=Math.max(0,this.stock[k]*(1-spoil));
    // approbation
    let a=50;
    if(varietyVillage>=3) a+=10; else if(varietyVillage===2) a+=4; else if(varietyVillage===1) a-=8; else a-=20;
    if(fuelRatio>=1) a+=4; else if(fuelRatio>=0.5) a-=5; else a-=15;
    if(this.hasChurch()) a+=6;
    if(this.buildings.some(b=>b.done&&b.def==="market")) a+=2; else a-=4;
    const homeless=this.families.filter(f=>f.home<0).length;
    a-=Math.min(24, homeless*12);
    a-=(this.taxRate-0.1)*40;
    if(starved>0) a-=25;
    this.approval=Math.max(0,Math.min(100,Math.round(a)));
    if(this.approval>=50) this.objectives.happyStreak=(this.objectives.happyStreak||0)+1; else this.objectives.happyStreak=0;
    if(this.approval>=50 && (this.objectives.happyStreak||0)>=3) this.objectives.happy=true;
    // impôts
    if(this.hasManor()){
      let levels=0;
      for(const b of this.buildings) if(b.done&&b.def==="burgage"&&this.families.some(f=>f.home===b.id)) levels+=[0,1,3,6][b.lvl];
      this.treasury+=levels*this.taxRate;
    }
    // évolution des bourgages
    for(const b of this.buildings){
      if(b.def!=="burgage"||!b.done) continue;
      const res=this.families.find(f=>f.home===b.id);
      if(!res) continue;
      const ok=res.lastAte>=1 && fuelRatio>=1 && market && varietyVillage>=2;
      if(ok) b.monthsGood++; else b.monthsGood=0;
      if(b.lvl===1 && b.monthsGood>=3 && this.stock.timber>=2){ this.stock.timber-=2; b.lvl=2; this.toast("Un bourgage évolue : niveau 2 !","good"); }
      else if(b.lvl===2 && b.monthsGood>=3 && this.approval>=65 && this.hasChurch() && this.stock.timber>=2 && this.stock.stone>=2){
        this.stock.timber-=2; this.stock.stone-=2; b.lvl=3; this.toast("Un bourgage évolue : niveau 3 ! Impôts accrus.","good");
      }
    }
    // migration (personne ne s'installe dans un village au bord de la famine)
    if(this.approval>=55){
      const free=this.freeBurgages();
      const foodTotal=FOOD_TYPES.reduce((s,k)=>s+this.stock[k],0);
      const n=(this.approval>=75)?2:1;
      for(let i=0;i<n && i<free;i++){
        if(foodTotal < (this.families.length+i+1)*2.5) break;
        const fb=this.buildings.find(bd=>bd.done&&bd.def==="burgage"&&!this.families.some(f=>f.home===bd.id));
        if(!fb) break;
        const f=this.makeFamily();
        f.home=fb.id;
        // point d'entrée praticable sur le bord ouest
        let ey=Math.floor(H/2);
        for(let y2=0;y2<H;y2++){ const yy=(Math.floor(H/2)+y2)%H; if(this.passable(0,yy)){ ey=yy; break; } }
        f.x=0.5; f.y=ey+0.5;
        const spot=this.spotFor(fb, f.x, f.y);
        if(spot){
          const p=this.astar(0,ey,spot.x,spot.y);
          if(p && p.length>0){ f.path=p; f.state="settle"; }
          else { f.x=spot.x+0.5; f.y=spot.y+0.5; f.state="idle"; }
        } else { f.x=fb.x+0.5; f.y=fb.y+0.5; f.state="idle"; }
        this.toast(f.name+" s'installe dans la seigneurie !","good");
      }
    }
    if(this.approval<30 && this.families.length>1){
      // les nouveaux arrivants repartent en premier (les souches fondatrices restent)
      let f=this.families[0];
      for(const c of this.families) if(c.id>f.id && c.id<100000) f=c;
      const fid=f.id;
      this.families=this.families.filter(x=>x.id!==fid);
      for(const o of this.buildings) o.families=o.families.filter(id=>id!==fid);
      this.toast(f.name+" quitte la seigneurie, déçue…","bad");
    }
    // objectifs
    this.objectives.wood=this.objectives.wood||this.buildings.some(b=>b.done&&b.def==="woodcutter"&&b.families.length>0);
    this.objectives.pop=this.objectives.pop||this.families.length>=10;
    this.objectives.manor=this.objectives.manor||this.hasManor();
    if(this.objectives.wood&&this.objectives.happy&&this.objectives.pop&&this.objectives.manor&&!this.victory){
      this.victory=true;
      this.toast("🏆 Votre seigneurie prospère ! Tous les objectifs sont accomplis.","good");
    }
    // avertissement hiver
    if(m===9 && !this.winterWarned && this.stock.firewood<this.families.length*6){
      this.winterWarned=true; this.toast("⚠️ Stockez du bois de chauffe avant l'hiver !","bad");
    }
    if(m===2) this.winterWarned=false;
    // événements
    if(m===10 && this.time.year>=1177){
      const amount=Math.round(8+this.families.length*1.2+(this.time.year-1177)*2);
      this.pendingEvent={ title:"L'impôt du roi",
        text:"Un héraut du roi exige "+amount+" deniers pour la couronne. Le refroidissement de sa gratitude serait… regrettable.",
        choices:[
          { label:"Payer "+amount+" 🪙", act:"pay", amount, disabled:this.treasury<amount },
          { label:"Refuser (approbation −12, récoltes confisquées)", act:"refuseTax" },
        ]};
    }
    if(m===4 && this.time.year>=1177 && this.rnd()<0.55){
      const amount=Math.max(8, Math.round(6+this.families.length*1.5));
      this.pendingEvent={ title:"Des brigands en vue !",
        text:"Une bande de brigands rôde autour de la seigneurie. Ils exigent "+amount+" deniers pour passer leur chemin.",
        choices:[
          { label:"Payer "+amount+" 🪙", act:"payBandits", amount, disabled:this.treasury<amount },
          { label:"Refuser (ils pillent les réserves)", act:"hideBandits" },
        ]};
    }
    this.uiVersion++;
  }

  /* ---------- interrogation pour l'UI ---------- */
  buildingAt(tx:number, ty:number):Building|null{
    const id=this.occupied[ty*W+tx];
    if(id<0) return null;
    return this.buildings.find(b=>b.id===id) || null;
  }
  workStatus(b:Building):string{
    const d=BUILD_DEFS[b.def];
    if(!b.done) return "En construction ("+Math.round(b.progress*100)+" %)";
    if(d.fam>0 && b.families.length===0) return "Aucune famille affectée";
    switch(b.def){
      case "woodcutter": return this.findForestNear(b)<0 ? "Plus d'arbres à portée" : "Abattage en cours";
      case "forager": return !this.berrySeason() ? "Repos d'hiver" : (this.findBerryNear(b)<0 ? "Plus de baies à portée" : "Cueillette en cours");
      case "hunter": return this.findDeerNear(b) ? "Chasse en cours" : "Aucun gibier à portée";
      case "quarry": { const i=b.y*W+b.x; return this.stoneAmt[i]<=0 ? "Carrière épuisée" : "Extraction en cours"; }
      case "farm": return "Ferme ("+this.fields().length+" champ(s))";
      case "windmill": return this.stock.grain>0 ? "Mouture du grain" : "En attente de grain";
      case "market": return b.families.length>0 ? "Étals tenus" : "Marché inactif";
      default: return "";
    }
  }
  tileName(tx:number,ty:number):string{
    const i=ty*W+tx;
    switch(this.tiles[i]){
      case T_FOREST: return "Forêt (bois restant : "+Math.round(this.treeWood[i])+")";
      case T_BERRY: return "Baies : "+Math.round(this.berryY[i]);
      case T_STONE: return "Pierre : "+Math.round(this.stoneAmt[i]);
      case T_WATER: return "Étang";
      default: return "Prairie · fertilité "+Math.round(this.soil[i]*100)+" %";
    }
  }

  /* ---------- sauvegarde ---------- */
  serialize(){
    return {
      v:1,
      seed:this.seed,
      tiles:Array.from(this.tiles),
      treeWood:Array.from(this.treeWood),
      berryY:Array.from(this.berryY),
      stoneAmt:Array.from(this.stoneAmt),
      buildings:this.buildings,
      families:this.families,
      deer:this.deer,
      stock:this.stock,
      time:this.time,
      approval:this.approval,
      treasury:this.treasury,
      taxRate:this.taxRate,
      objectives:this.objectives,
      victory:this.victory,
      pendingEvent:this.pendingEvent,
      winterWarned:this.winterWarned,
    };
  }
  static load(data:any):GameState{
    if(!data || typeof data.seed!=="number" || !data.tiles) throw new Error("sauvegarde invalide");
    const g = new GameState(data.seed);
    g.tiles = Uint8Array.from(data.tiles);
    g.treeWood = Float32Array.from(data.treeWood);
    g.berryY = Float32Array.from(data.berryY);
    g.stoneAmt = Float32Array.from(data.stoneAmt);
    g.buildings = data.buildings || [];
    g.families = data.families || [];
    g.deer = data.deer || [];
    if(data.stock) g.stock = data.stock;
    if(data.time) g.time = data.time;
    if(typeof data.approval==="number") g.approval = data.approval;
    if(typeof data.treasury==="number") g.treasury = data.treasury;
    if(typeof data.taxRate==="number") g.taxRate = data.taxRate;
    if(data.objectives) g.objectives = data.objectives;
    g.victory = !!data.victory;
    g.pendingEvent = data.pendingEvent || null;
    g.winterWarned = !!data.winterWarned;
    g.nextB = Math.max(0, ...g.buildings.map(b=>b.id)) + 1;
    g.nextF = Math.max(0, ...g.families.map(f=>f.id)) + 1;
    g.nextD = Math.max(0, ...g.deer.map(d=>d.id)) + 1;
    // reconstruit l'occupation du sol à partir des bâtiments
    g.occupied = new Int32Array(W*H).fill(-1);
    for(const b of g.buildings)
      for(let yy=0;yy<b.h;yy++) for(let xx=0;xx<b.w;xx++)
        g.occupied[(b.y+yy)*W+(b.x+xx)] = b.id;
    return g;
  }
}
/*==SIM-END==*/

const SAVE_KEY = "seigneurie-save-v1";
function persist(g:GameState){
  try{ window.localStorage.setItem(SAVE_KEY, JSON.stringify(g.serialize())); }catch(e){}
}
function encodeSave(g:GameState){
  try{ return btoa(unescape(encodeURIComponent(JSON.stringify(g.serialize())))); }catch(e){ return ""; }
}
function decodeSave(code:string):GameState|null{
  try{ return GameState.load(JSON.parse(decodeURIComponent(escape(atob(code.trim()))))); }catch(e){ return null; }
}

export default function App(){
  const gRef = useRef<GameState|null>(null);
  if(!gRef.current){
    let restored:GameState|null = null;
    try{
      const raw = window.localStorage.getItem(SAVE_KEY);
      if(raw) restored = GameState.load(JSON.parse(raw));
    }catch(e){}
    gRef.current = restored || new GameState(Math.floor(Math.random()*2000000000));
  }
  const g = gRef.current;

  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const camRef = useRef({ x: W/2, y: H/2, zoom: 1.6 });
  const hoverRef = useRef<{ tx:number; ty:number; inside:boolean }>({ tx:0, ty:0, inside:false });
  const dragRef = useRef<{ down:boolean; sx:number; sy:number; cx:number; cy:number; moved:boolean }>({ down:false, sx:0, sy:0, cx:0, cy:0, moved:false });
  const pointersRef = useRef<Map<number,{x:number;y:number}>>(new Map());
  const pinchRef = useRef<{ dist:number; zoom:number; wx:number; wy:number }|null>(null);
  const keysRef = useRef<Set<string>>(new Set());

  const [buildSel, setBuildSel] = useState<string|null>(null);
  const [selId, setSelId] = useState<number|null>(null);
  const [tick, setTick] = useState(0);
  const [hoverInfo, setHoverInfo] = useState<string>("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [flash, setFlash] = useState<string|null>(null);
  const [saveModal, setSaveModal] = useState(false);
  const [loadModal, setLoadModal] = useState(false);
  const [codeInput, setCodeInput] = useState("");

  const buildSelRef = useRef(buildSel);
  buildSelRef.current = buildSel;
  const selIdRef = useRef(selId);
  selIdRef.current = selId;

  useEffect(()=>{
    g.toast("Bienvenue, monseigneur ! Commencez par un camp de bûcherons.","good");
  },[g]);

  useEffect(()=>{
    const canvas = canvasRef.current; if(!canvas) return;
    const wrap = wrapRef.current; if(!wrap) return;
    const ctx = canvas.getContext("2d"); if(!ctx) return;
    let raf = 0; let last = performance.now(); let acc = 0; let uiAcc = 0; let saveAcc = 0;

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      if(r.width<10 || r.height<10) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(r.width*dpr);
      canvas.height = Math.floor(r.height*dpr);
      canvas.style.width = r.width+"px";
      canvas.style.height = r.height+"px";
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap); resize();

    const loop = (now:number) => {
      const dt = Math.min(200, now-last); last = now;
      if(g.speed>0 && !g.pendingEvent){
        acc += dt*g.speed;
        let n = Math.floor(acc/100);
        if(n>60){ n = 60; acc = 0; } else acc -= n*100;
        for(let i=0;i<n;i++) g.step();
      }
      // pan clavier ZQSD/WASD/flèches
      const sp = 14*dt/1000;
      let pvx = 0, pvy = 0;
      if(keysRef.current.has("arrowleft")||keysRef.current.has("q")||keysRef.current.has("a")) pvx -= sp;
      if(keysRef.current.has("arrowright")||keysRef.current.has("d")) pvx += sp;
      if(keysRef.current.has("arrowup")||keysRef.current.has("z")||keysRef.current.has("w")) pvy -= sp;
      if(keysRef.current.has("arrowdown")||keysRef.current.has("s")) pvy += sp;
      if(pvx||pvy){
        const cam = camRef.current;
        cam.x = Math.max(-4, Math.min(W+4, cam.x+pvx));
        cam.y = Math.max(-4, Math.min(H+4, cam.y+pvy));
      }
      // autosave toutes les 5 s
      saveAcc += dt;
      if(saveAcc>5000){ saveAcc = 0; persist(g); }
      uiAcc += dt;
      if(uiAcc>350){ uiAcc = 0; setTick(t=>t+1); }
      drawGame(ctx, g, camRef.current, canvas, hoverRef.current, buildSelRef.current, selIdRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return ()=>{ cancelAnimationFrame(raf); ro.disconnect(); };
  },[g]);

  /* ---------- interaction carte ---------- */
  const toWorld = (clientX:number, clientY:number) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const cam = camRef.current;
    const wx = cam.x + (clientX - r.left - r.width/2)/(16*cam.zoom);
    const wy = cam.y + (clientY - r.top - r.height/2)/(16*cam.zoom);
    return { wx, wy, tx: Math.floor(wx), ty: Math.floor(wy) };
  };

  const onPointerDown = (e:React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if(pointersRef.current.size===2){
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
      const cam = camRef.current;
      const { wx, wy } = toWorld((pts[0].x+pts[1].x)/2, (pts[0].y+pts[1].y)/2);
      pinchRef.current = { dist, zoom:cam.zoom, wx, wy };
      dragRef.current.down = false; dragRef.current.moved = true;
      return;
    }
    const d = dragRef.current;
    d.down = true; d.moved = false;
    d.sx = e.clientX; d.sy = e.clientY;
    d.cx = camRef.current.x; d.cy = camRef.current.y;
  };
  const onPointerMove = (e:React.PointerEvent<HTMLCanvasElement>) => {
    if(pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, { x:e.clientX, y:e.clientY });
    // pinch zoom (2 doigts)
    if(pointersRef.current.size>=2 && pinchRef.current){
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
      const p = pinchRef.current;
      const z = Math.max(0.7, Math.min(4, p.zoom * dist/Math.max(20, p.dist)));
      const cam = camRef.current;
      cam.zoom = z;
      const canvas = canvasRef.current!;
      const r = canvas.getBoundingClientRect();
      const mx = (pts[0].x+pts[1].x)/2, my = (pts[0].y+pts[1].y)/2;
      cam.x = Math.max(-4, Math.min(W+4, p.wx - (mx - r.left - r.width/2)/(16*z)));
      cam.y = Math.max(-4, Math.min(H+4, p.wy - (my - r.top - r.height/2)/(16*z)));
      return;
    }
    const d = dragRef.current;
    const { tx, ty } = toWorld(e.clientX, e.clientY);
    const inside = tx>=0 && ty>=0 && tx<W && ty<H;
    const h = hoverRef.current;
    if(h.tx!==tx || h.ty!==ty || h.inside!==inside){
      h.tx=tx; h.ty=ty; h.inside=inside;
      if(inside){
        const b = g.buildingAt(tx,ty);
        setHoverInfo(b ? BUILD_DEFS[b.def].name+" — "+g.workStatus(b) : g.tileName(tx,ty));
      } else setHoverInfo("");
    }
    if(d.down){
      const dx = e.clientX-d.sx, dy = e.clientY-d.sy;
      if(Math.abs(dx)+Math.abs(dy)>7) d.moved = true;
      if(d.moved){
        const canvas = canvasRef.current!;
        const r = canvas.getBoundingClientRect();
        camRef.current.x = Math.max(-4, Math.min(W+4, d.cx - dx/(16*camRef.current.zoom)));
        camRef.current.y = Math.max(-4, Math.min(H+4, d.cy - dy/(16*camRef.current.zoom)));
      }
    }
  };
  const onPointerUp = (e:React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if(pointersRef.current.size<2) pinchRef.current = null;
    const d = dragRef.current;
    d.down = false;
    if(d.moved) return;
    if(pointersRef.current.size>0) return;
    // clic minimap ?
    const mm = g.mmRect;
    if(mm){
      const canvas = canvasRef.current!;
      const r = canvas.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      if(px>=mm.x-6 && px<=mm.x+mm.w+6 && py>=mm.y-6 && py<=mm.y+mm.h+6){
        const cam = camRef.current;
        cam.x = Math.max(-4, Math.min(W+4, (px-mm.x)/mm.ppt));
        cam.y = Math.max(-4, Math.min(H+4, (py-mm.y)/mm.ppt));
        return;
      }
    }
    const { tx, ty } = toWorld(e.clientX, e.clientY);
    if(tx<0||ty<0||tx>=W||ty>=H) return;
    if(buildSelRef.current){
      const err = g.place(buildSelRef.current, tx, ty);
      if(err){ setFlash(err); window.setTimeout(()=>setFlash(null), 1800); }
      else if(buildSelRef.current==="manor"||buildSelRef.current==="church"||buildSelRef.current==="windmill"){
        setBuildSel(null);
      }
    } else {
      const b = g.buildingAt(tx,ty);
      setSelId(b ? b.id : null);
    }
  };
  const onWheel = (e:React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const cam = camRef.current;
    const z = cam.zoom * (e.deltaY>0 ? 0.88 : 1.14);
    cam.zoom = Math.max(0.7, Math.min(4, z));
  };
  const onContextMenu = (e:React.MouseEvent) => { e.preventDefault(); setBuildSel(null); setSelId(null); };

  useEffect(()=>{
    const onKey = (e:KeyboardEvent) => {
      const tg = e.target as HTMLElement | null;
      if(tg && (tg.tagName==="TEXTAREA" || tg.tagName==="INPUT")) return; // saisie de code : ne pas intercepter
      if(e.key===" "){ e.preventDefault(); g.speed = g.speed===0 ? 1 : 0; setTick(t=>t+1); }
      if(e.key==="Escape"){ setBuildSel(null); setSelId(null); setHelpOpen(false); }
      if(e.key==="1") { g.speed=1; setTick(t=>t+1); }
      if(e.key==="2") { g.speed=2; setTick(t=>t+1); }
      if(e.key==="3") { g.speed=4; setTick(t=>t+1); }
      const k = e.key.toLowerCase();
      if(["arrowup","arrowdown","arrowleft","arrowright","z","q","s","d","w","a"].includes(k)){
        e.preventDefault();
        keysRef.current.add(k);
      }
    };
    const onKeyUp = (e:KeyboardEvent) => { keysRef.current.delete(e.key.toLowerCase()); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return ()=>{ window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp); };
  },[g]);

  const newGame = () => {
    try{ window.localStorage.removeItem(SAVE_KEY); }catch(e){}
    gRef.current = new GameState(Math.floor(Math.random()*2000000000));
    setSelId(null); setBuildSel(null); setTick(t=>t+1);
  };

  /* ---------- UI ---------- */
  const sel = selId!=null ? g.buildings.find(b=>b.id===selId) || null : null;
  const season = g.season();
  const seasonIcon = ["❄️","🌷","☀️","🍂"][season];
  const approvalColor = g.approval>=60 ? "#7bd88f" : g.approval>=40 ? "#e8c35a" : "#e86a5a";
  const now = Date.now();
  const toasts = g.toasts.filter(t=>now-t.t<6500);
  const homeless = g.families.filter(f=>f.home<0).length;

  const resList: [string,number][] = [
    ["timber", g.stock.timber], ["firewood", g.stock.firewood], ["stone", g.stock.stone],
    ["berries", g.stock.berries], ["meat", g.stock.meat], ["grain", g.stock.grain],
    ["bread", g.stock.bread], ["eggs", g.stock.eggs], ["veg", g.stock.veg],
  ];

  const familyAtBurgage = (b:Building) => g.families.find(f=>f.home===b.id) || null;

  return (
    <div className="flex h-[100dvh] w-screen flex-col bg-[#141a26] text-[#e8e4d8] select-none" style={{fontFamily:"ui-monospace, 'Courier New', monospace"}}>
      {/* ===== barre du haut ===== */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#2c3a52] bg-[#1b2434] px-3 py-1.5 text-sm">
        <span className="font-bold tracking-wide">🏰 SEIGNEURIE</span>
        <span className="rounded bg-[#2c3a52] px-2 py-0.5">{MONTHS[g.time.month]} {g.time.year} {seasonIcon} {SEASONS[season]}</span>
        <span className="rounded bg-[#2c3a52] px-2 py-0.5" title="Trésorerie">🪙 {Math.floor(g.treasury)}</span>
        <span className="rounded bg-[#2c3a52] px-2 py-0.5" title="Approbation" style={{color:approvalColor}}>😊 {g.approval}%</span>
        <span className="rounded bg-[#2c3a52] px-2 py-0.5" title="Familles">👨‍👩‍👧 {g.families.length}{homeless>0 ? " (!"+homeless+" sans toit)" : ""}</span>
        <div className="flex flex-wrap items-center gap-1">
          {resList.map(([k,v])=>(
            <span key={k} className="rounded bg-[#232f44] px-1.5 py-0.5 text-xs" title={k}>
              {RES_ICONS[k]} {Math.floor(v)}
            </span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {[0,1,2,4].map(s=>(
            <button key={s}
              className={"rounded px-2 py-0.5 text-xs "+(g.speed===s?"bg-[#4a6b3a] text-white":"bg-[#2c3a52] hover:bg-[#3a4c6b]")}
              onClick={()=>{ g.speed=s; setTick(t=>t+1); }}>
              {s===0?"⏸":s===1?"▶":"⏩"+(s===2?"2":"4")}
            </button>
          ))}
          <button className="rounded bg-[#2c3a52] px-2 py-0.5 text-xs hover:bg-[#3a4c6b]" onClick={()=>setSaveModal(true)}>💾</button>
          <button className="rounded bg-[#2c3a52] px-2 py-0.5 text-xs hover:bg-[#3a4c6b]" onClick={()=>{ setCodeInput(""); setLoadModal(true); }}>📥</button>
          <button className="rounded bg-[#2c3a52] px-2 py-0.5 text-xs hover:bg-[#3a4c6b]" onClick={()=>setHelpOpen(true)}>Aide ?</button>
          <button className="rounded bg-[#5a3a3a] px-2 py-0.5 text-xs hover:bg-[#6b4a4a]" onClick={newGame}>Nouveau</button>
        </div>
      </div>

      {/* ===== zone de jeu ===== */}
      <div className="relative flex-1 overflow-hidden" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full cursor-crosshair"
          style={{imageRendering:"pixelated", touchAction:"none"}}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={(e)=>{ pointersRef.current.delete(e.pointerId); if(pointersRef.current.size<2) pinchRef.current=null; dragRef.current.down=false; }}
          onWheel={onWheel}
          onContextMenu={onContextMenu}
        />

        {/* objectifs */}
        <div className="absolute left-2 top-2 rounded border border-[#2c3a52] bg-[#1b2434dd] p-2 text-xs leading-5">
          <div className="mb-1 font-bold">📜 Objectifs</div>
          <div>{g.objectives.wood?"✅":"⬜"} Camp de bûcherons actif</div>
          <div>{g.objectives.happy?"✅":"⬜"} Approbation ≥ 50 % (3 mois)</div>
          <div>{g.objectives.pop?"✅":"⬜"} 10 familles</div>
          <div>{g.objectives.manor?"✅":"⬜"} Un manoir</div>
          {g.victory && <div className="mt-1 text-[#e8c35a]">🏆 Seigneurie prospère !</div>}
        </div>

        {/* info tuile */}
        {hoverInfo && (
          <div className="absolute bottom-2 left-2 rounded border border-[#2c3a52] bg-[#1b2434dd] px-2 py-1 text-xs">
            {hoverInfo}
          </div>
        )}
        {flash && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-[#5a3a3a] px-3 py-1 text-xs text-[#ffb0a0]">
            {flash}
          </div>
        )}
        {buildSel && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-[#2c3a52] px-3 py-1 text-xs">
            Cliquez pour poser : {BUILD_DEFS[buildSel].name} · clic droit / Échap pour annuler
          </div>
        )}

        {/* toasts */}
        <div className="pointer-events-none absolute left-1/2 top-2 flex w-80 max-w-[92vw] -translate-x-1/2 flex-col gap-1">
          {toasts.map(t=>(
            <div key={t.id}
              className={"rounded px-3 py-1 text-center text-xs "+(t.kind==="good"?"bg-[#2f5a2fdd]":t.kind==="bad"?"bg-[#5a2f2fdd]":"bg-[#2c3a52dd]")}>
              {t.text}
            </div>
          ))}
        </div>

        {/* panneau de sélection */}
        {sel && (
          <div className="absolute right-2 top-2 w-64 max-w-[calc(100vw-1rem)] rounded border border-[#2c3a52] bg-[#1b2434ee] p-3 text-xs">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-bold">{BUILD_DEFS[sel.def].icon} {BUILD_DEFS[sel.def].name}{sel.def==="burgage"?" (niv. "+sel.lvl+")":""}</span>
              <button className="rounded bg-[#2c3a52] px-1.5" onClick={()=>setSelId(null)}>✕</button>
            </div>
            <div className="mb-2 text-[#a8b0c0] italic">{BUILD_DEFS[sel.def].desc}</div>
            <div className="mb-2">{g.workStatus(sel)}</div>

            {(BUILD_DEFS[sel.def].fam>0) && (
              <div className="mb-2 flex items-center gap-2">
                <span>Familles : {sel.families.length}/{BUILD_DEFS[sel.def].fam}</span>
                <button className="rounded bg-[#2c3a52] px-1.5 hover:bg-[#3a4c6b]" onClick={()=>g.unassign(sel.id)||setTick(t=>t+1)}>−</button>
                <button className="rounded bg-[#2c3a52] px-1.5 hover:bg-[#3a4c6b]" onClick={()=>{g.assign(sel.id); setTick(t=>t+1);}}>+</button>
                <span className="text-[#a8b0c0]">(oisifs : {g.unemployed()})</span>
              </div>
            )}

            {sel.def==="burgage" && (
              <div className="mb-2">
                <div>{familyAtBurgage(sel) ? "Résidente : "+familyAtBurgage(sel)!.name : "Vacante"}</div>
                {sel.monthsGood>0 && <div className="text-[#7bd88f]">Bilan positif : {sel.monthsGood} mois</div>}
                {!sel.ext && sel.done && (
                  <div className="mt-1 flex gap-2">
