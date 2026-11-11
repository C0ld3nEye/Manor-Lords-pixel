/* ================= SIMULATION (générée depuis le canvas Seigneurie) ================= */

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
function seasonOf(m        ){ return Math.floor(((m + 1) % 12) / 3); }

function mulberry32(a        ){
  return function(){
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x        , y        ){ return ((x * 73856093) ^ (y * 19349663)) >>> 0; }

                                      

                       
                                         
                       
                                            
              
                  
                                                                  
                                                         
               
 

const BUILD_DEFS                              = {
  burgage:   { id:"burgage",   name:"Bourgage",       icon:"🏠", w:1,h:1, cost:{timber:1}, fam:0, instant:true, buildRate:2, desc:"Loge une famille. Évolue si ses besoins sont satisfaits." },
  woodcutter:{ id:"woodcutter",name:"Camp de bûcherons",icon:"🪓", w:1,h:1, cost:{timber:2}, fam:2, radius:6, instant:false, desc:"Abat les arbres à proximité : bois d'œuvre + bois de chauffe." },
  forager:   { id:"forager",   name:"Cabane de cueilleuses", icon:"🍒", w:1,h:1, cost:{timber:2}, fam:2, radius:6, instant:false, desc:"Cueille des baies (mars → novembre)." },
  hunter:    { id:"hunter",    name:"Camp de chasse",  icon:"🏹", w:1,h:1, cost:{timber:2}, fam:2, radius:10, instant:false, desc:"Chasse le gibier des forêts : viande, toute l'année." },
  quarry:    { id:"quarry",    name:"Carrière",        icon:"🪨", w:1,h:1, cost:{timber:2}, fam:1, onStone:true, instant:false, desc:"À poser SUR un gisement de pierre. S'épuise avec le temps." },
  farm:      { id:"farm",      name:"Ferme",           icon:"🚜", w:2,h:2, cost:{timber:3}, fam:2, instant:false, desc:"Travaille les champs : labour/semailles au printemps, moisson en septembre." },
  field:     { id:"field",     name:"Champ",           icon:"🌾", w:4,h:4, uiSize:true, cost:{}, fam:0, instant:true,  desc:"Gratuit. Rendement selon la fertilité du sol (visible en mode pose). Jachère conseillée." },
  windmill:  { id:"windmill",  name:"Moulin",          icon:"💨", w:2,h:2, cost:{timber:2,stone:2}, fam:1, instant:false, desc:"Transforme le grain en pain (meilleur variété alimentaire)." },
  granary:   { id:"granary",   name:"Grange",          icon:"🏚️", w:1,h:1, cost:{timber:2}, fam:0, instant:false, desc:"Réduit fortement le pourrissement des denrées." },
  storehouse:{ id:"storehouse",name:"Entrepôt",        icon:"📦", w:1,h:1, cost:{timber:2}, fam:0, instant:false, desc:"+150 de capacité de stockage pour chaque ressource." },
  market:    { id:"market",    name:"Marché",          icon:"⛺", w:2,h:2, cost:{timber:2}, fam:3, instant:false, desc:"Sans marché actif, vos familles n'ont accès qu'à un seul type de nourriture." },
  church:    { id:"church",    name:"Église",          icon:"⛪", w:2,h:2, cost:{timber:2,stone:2}, fam:0, instant:false, desc:"+6 d'approbation. Requise pour les bourgages de niveau 3." },
  trade:     { id:"trade",     name:"Comptoir",       icon:"\u26fa", w:2,h:2, cost:{timber:3,stone:2}, fam:1, instant:false, desc:"Vente automatique des surplus chaque mois (prix fluctuants). +richesse régionale." },
  tower:     { id:"tower",     name:"Tour de guet",   icon:"\ud83d\udde1\ufe0f", w:1,h:1, cost:{timber:2,stone:3}, fam:0, instant:false, desc:"+4 approbation, repousse les raids (réduit le pillage de moitié)." },
  wall:      { id:"wall",      name:"Rempart",        icon:"⬛", w:1,h:1, cost:{stone:2}, fam:0, instant:false, wall:true, desc:"Mur défensif : les brigands ne passent pas dessus (case infranchissable)." },
  manor:     { id:"manor",     name:"Manoir",          icon:"🏰", w:2,h:2, cost:{timber:4,stone:3}, fam:0, instant:false, desc:"Permet de lever l'impôt (curseur dans le panneau du manoir)." },
};
const BUILD_ORDER = ["burgage","woodcutter","forager","hunter","quarry","farm","field","windmill","granary","storehouse","market","trade","church","tower","wall","manor"];

const FOOD_TYPES = ["berries","meat","bread","eggs","veg","apples","honey"];

const EXT_DEFS = {
  garden:  { id:"garden",  name:"Potager",            cost:{timber:1},           lvl:1, desc:"+0,5 légume par mois." },
  chicken: { id:"chicken", name:"Basse-cour",         cost:{timber:1},           lvl:1, desc:"+0,5 œuf par mois." },
  orchard: { id:"orchard", name:"Verger",             cost:{timber:2},           lvl:1, desc:"+1 pomme par mois (août → octobre). Nourrit aussi la famille." },
  beehive: { id:"beehive", name:"Rucher",             cost:{timber:2},           lvl:1, desc:"+0,5 miel par mois (avril → septembre)." },
  tailor:  { id:"tailor",  name:"Atelier du tailleur",cost:{timber:2},           lvl:2, desc:"Produit 1 vêtement par mois. Requiert le niveau 2." },
  brewer:  { id:"brewer",  name:"Brasserie",          cost:{timber:2,stone:1},   lvl:2, desc:"Produit 1 chope d'ale par mois. Requiert le niveau 2." },
};
const EXT_ORDER = ["garden","chicken","orchard","beehive","tailor","brewer"];

/* ---------- étape 3 : chantiers en étapes et parcelles de bourgage ---------- */
const BUILD_STAGES = [
  { id:"foundations", name:"Fondations" },
  { id:"frame",       name:"Charpente" },
  { id:"walls",       name:"Murs" },
  { id:"roof",        name:"Toit" },
];
// 0..3 = étape du chantier en cours, 4 = bâtiment achevé
function buildStage(b){
  if(b.done) return BUILD_STAGES.length;
  const p = typeof b.progress==="number" && isFinite(b.progress) ? b.progress : 0;
  return Math.max(0, Math.min(BUILD_STAGES.length-1, Math.floor(p*BUILD_STAGES.length)));
}
const DIRS4 = [[0,-1],[1,0],[0,1],[-1,0]]; // N, E, S, O
const PLOT_MAX_CELLS = 6;  // maison + 5 cases de cour au plus
const PLOT_MAX_DEPTH = 3;  // distance max (en cases) entre la maison et le fond de la cour

const CROP_DEFS = {
  wheat:  { id:"wheat",  name:"Bl\u00e9",     icon:"\ud83c\udf3e", yield:"grain",  fertCost:0.20, desc:"Bl\u00e9 -> grain -> pain (moulin). \u00c9puise le sol." },
  barley: { id:"barley", name:"Orge",     icon:"\ud83c\udf33", yield:"barley", fertCost:0.10, desc:"Orge -> brasserie -> ale. Moins \u00e9puisant." },
  fallow: { id:"fallow", name:"Jach\u00e8re", icon:"\ud83d\udfe4", yield:null,   fertCost:-0.12, desc:"Repos du sol : fertilit\u00e9 restaur\u00e9e." },
};
const CROP_ORDER = ["wheat","barley","fallow"];
const FIELD_SIZES = [3,4,6];

const REGION_DEFS = [
  { id:0, name:"Vallée du Cœur",   bonus:null,          desc:"Votre terre natale (au centre). Déjà à vous." },
  { id:1, name:"Marches de l'Ouest",bonus:{berries:2}, desc:"Réclamez-la : +2 baies par mois." },
  { id:2, name:"Hautes Terres",    bonus:{stone:1},    desc:"Réclamez-la (à l'est) : +1 pierre par mois." },
];
const REGION_COST = { treasury:30, wealth:15 };

const POLICY_DEFS = {
  tithe:         { id:"tithe",         name:"" + "Dîme ecclésiastique", desc:"+8 influence/mois, -4 approbation/mois." },
  freeMarket:    { id:"freeMarket",    name:"Marchés libres",        desc:"+6 richesse/mois, +3 approbation/mois, -5 deniers d'impôt." },
  militiaService:{ id:"militiaService",name:"Service militaire",    desc:"+1 soldat de milice en plus, -3 approbation/mois." },
};
const POLICY_ORDER = ["tithe","freeMarket","militiaService"];

const CHURCH_UPGRADES = {
  altar:  { id:"altar",  name:"Autel",   cost:{stone:3},           bonus:{approval:3, influence:2}, desc:"+3 approbation, +2 influence/mois." },
  bell:   { id:"bell",   name:"Clocher", cost:{timber:3,stone:2}, bonus:{approval:5, influence:3}, desc:"+5 approbation, +3 influence/mois." },
};
const CHURCH_UP_ORDER = ["altar","bell"];
const MODES = [
  { id:"prosperity", name:"Prospérité",       desc:"Sans combat : faites prospérer la seigneurie (objectifs classiques).", combat:false },
  { id:"peace",       name:"Restaurer la paix", desc:"Brigands fréquents : protégez vos réserves et détruisez leurs camps.", combat:true, bandits:1.8 },
  { id:"edge",        name:"Au bord du gouffre", desc:"Ressources de départ réduites. Survivez 3 ans.", combat:true, bandits:1.4, harsh:true },
  { id:"duel",        name:"Duel",             desc:"Le Baron est puissant et agressif : survivez à ses raids et réclamez tout.", combat:true, baron:1.8 },
  { id:"fractured",   name:"Royaume fracturé", desc:"Tout à la fois : brigands, Baron, hiver. Le défi ultime.", combat:true, bandits:2.0, baron:2.0, harsh:true },
];
const MODE_BY_ID = Object.fromEntries(MODES.map(m=>[m.id,m]));
const DIFFICULTIES = [
  { id:"easy",   name:"Paisible",  tax:0.8, raid:0.6, bandits:0.6 },
  { id:"normal", name:"Normal",    tax:1.0, raid:1.0, bandits:1.0 },
  { id:"hard",   name:"Difficile", tax:1.3, raid:1.5, bandits:1.5 },
];
const DIFF_BY_ID = Object.fromEntries(DIFFICULTIES.map(d=>[d.id,d]));

const SETTLEMENT_LEVELS = [
  { name:"Hameau", minPop:0 },
  { name:"Village", minPop:8 },
  { name:"Bourg", minPop:20 },
  { name:"Ville", minPop:40 },
];
const RES_ICONS                        = { timber:"🪵", firewood:"🔥", stone:"🪨", grain:"🌾", bread:"🍞", berries:"🍒", meat:"🍗", eggs:"🥚", veg:"🥕", apples:"🍎", honey:"🍯", clothes:"👕", ale:"🍺", barley:"🌾", ox:"🐂" };

const SURNAMES = ["Aldéric","Baptiste","Colin","Eudes","Garlin","Hersende","Mahaut","Odon","Perrot","Raoulin","Sanceline","Thomasse","Ysoré","Gaultier","Béatrice","Manessier","Ferrant","Alips","Jourdaine","Nicaise"];

                                                                                                                                       

                    
                                                                
                                                   
                                                 
               
 

                  
                                                   
                                      
                                                        
               
                                                                               
                                   
                                                                   
 

                                                                                  

                                                                 
                                                                                                                               

const WORK_TIME                        = { chop:14, gather:14, hunt:12, mine:20 };

class GameState {
  seed       ; rnd           ;
  tiles           ; treeWood             ; berryY             ; stoneAmt             ; soil             ; roads             ;
  wealth          ; prices                 ;
  occupied           ;
  buildings           ; nextB       ;
  families         ; nextF       ;
  deer       ; nextD       ; deerTimer       ; camps          ; nextC       ;
  units            ; nextU       ;
  stock                      ;
  capBase       ; capPer       ;
  time                                                       ;
  approval       ; treasury       ; taxRate       ;
  pendingEvent                  ;
  speed       ; toasts        ; toastId       ; log            ;
  uiVersion       ;
  objectives                                                                                ;
  victory        ;
  winterWarned        ;
  mmRect                                                            ;

  constructor(seed       , modeId       , diffId       ){
    this.modeId = modeId || "prosperity";
    this.diffId = diffId || "normal";
    this.seed = seed; this.rnd = mulberry32(seed);
    this.tiles = new Uint8Array(W*H);
    this.treeWood = new Float32Array(W*H);
    this.berryY = new Float32Array(W*H);
    this.stoneAmt = new Float32Array(W*H);
    this.soil = new Float32Array(W*H);
    this.roads = new Uint8Array(W*H);
    this.wealth = 0;
    this.regions = REGION_DEFS.map(r=>({ id:r.id, owned:r.id===0 }));
    this.baron = { name:"Baron von Graufeld", regions:[], power:0, nextClaim:6, nextRaid:10 };
    this.influence = 0;
    this.policies = { tithe:false, freeMarket:false, militiaService:false };
    this.prices = { bread:2, clothes:3, ale:2, apples:1, honey:4, meat:1, berries:1 };
    this.occupied = new Int32Array(W*H).fill(-1);
    this.buildings = []; this.nextB = 1;
    this.families = []; this.nextF = 1;
    this.deer = []; this.nextD = 1; this.deerTimer = 0;
    this.camps = []; this.nextC = 1;
    this.units = []; this.nextU = 1;
    this.stock = { timber:15, firewood:12, stone:0, grain:0, bread:6, berries:40, meat:25, eggs:0, veg:0, apples:0, honey:0, clothes:2, ale:0, barley:0, ox:0 };
    this.capBase = 300; this.capPer = 150;
    this.time = { tick:0, day:0, month:2, year:1176 }; // mars 1176
    this.approval = 62; this.treasury = 0; this.taxRate = 0.15;
    this.pendingEvent = null;
    this.speed = 1; this.toasts = []; this.toastId = 1; this.log = [];
    this.uiVersion = 0;
    this.objectives = { wood:false, happy:false, pop:false, manor:false, happyStreak:0 };
    this.victory = false; this.winterWarned = false;
    this.defeat = false; this.endReason = null;
    this.lowApprovalStreak = 0;
    this.weather = "clear"; // clear | rain | snow | fog
    this.weatherT = 0;
    if(MODE_BY_ID[this.modeId] && MODE_BY_ID[this.modeId].harsh){
      this.stock.timber = 8; this.stock.berries = 10; this.stock.meat = 6; this.stock.firewood = 4;
    }
    this.mmRect = null;
    this.genMap();
    this.placeStart();
  }

  /* ---------- génération de la carte ---------- */
  genMap(){
    const r = this.rnd;
    // fertilité du sol par bruit bilinéaire
    const gw = 9, gh = 7;
    const g             = [];
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
    const centers       = [];
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
  makeBuilding(def       , x       , y       )         {
    const d = BUILD_DEFS[def];
    const b          = { id:this.nextB++, def, x, y, w:d.w, h:d.h, done:false, progress:0, families:[], lvl:1, exts:[], monthsGood:0, f:null };
    if(def==="field"){
      let s=0; for(let yy=0;yy<d.h;yy++) for(let xx=0;xx<d.w;xx++) s += this.soil[(y+yy)*W+(x+xx)];
      b.f = { fert: Math.min(1, s/(d.w*d.h)), plow:0, sown:false, growth:0, harvestP:0, crop:"wheat", usedThisYear:false, usedLastYear:false };
    }
    this.buildings.push(b);
    for(let yy=0;yy<d.h;yy++) for(let xx=0;xx<d.w;xx++) this.occupied[(y+yy)*W+(x+xx)] = b.id;
    return b;
  }

  makeFamily()       {
    const f        = { id:this.nextF++, name:"Famille "+SURNAMES[Math.floor(this.rnd()*SURNAMES.length)], home:-1, work:-1,
      x:0.5, y:H/2, path:null, state:"settle", timer:0, task:null, carry:null,
      cool:0, starving:0, lastAte:2, lastVariety:1 };
    this.families.push(f);
    return f;
  }

  toast(text       , kind="info"){
    this.toasts.push({ id:this.toastId++, text, t:Date.now(), kind });
    if(this.toasts.length>6) this.toasts.shift();
    const t = this.time;
    this.log.push({ id:this.toastId, text, kind, month:t.month, year:t.year });
    if(this.log.length>120) this.log.splice(0, this.log.length-120);
    this.uiVersion++;
  }

  /* ---------- utilitaires économie ---------- */
  storehouseCount(){ return this.buildings.filter(b=>b.done && b.def==="storehouse").length; }
  capFor(res       ){ return this.capBase + this.capPer*this.storehouseCount(); }
  hasManor(){ return this.buildings.some(b=>b.done && b.def==="manor"); }
  hasChurch(){ return this.buildings.some(b=>b.done && b.def==="church"); }
  marketActive(){ return this.buildings.some(b=>b.done && b.def==="market"); }
  freeBurgages(){ return this.buildings.filter(b=>b.done && b.def==="burgage" && !this.families.some(f=>f.home===b.id)).length; }
  season(){ return seasonOf(this.time.month); }
  mode(){ return MODE_BY_ID[this.modeId] || MODE_BY_ID.prosperity; }
  diff(){ return DIFF_BY_ID[this.diffId] || DIFF_BY_ID.normal; }
  berrySeason(){ const m=this.time.month; return m>=2 && m<=10; } // mars → novembre
  unemployed(){ return this.families.filter(f=>f.work<0).length; }

  canAfford(def       ){ const c=BUILD_DEFS[def].cost; return this.stock.timber>=(c.timber||0) && this.stock.stone>=(c.stone||0); }
  costText(def       ){ const c=BUILD_DEFS[def].cost; const p         =[]; if(c.timber)p.push(c.timber+" 🪵"); if(c.stone)p.push(c.stone+" 🪨"); return p.length?p.join(" "):"Gratuit"; }

  /* ---------- placement ---------- */
  fieldSize(){ return (this._uiFieldSize||4); }
  setFieldSize(n       ){ this._uiFieldSize = n; }

  canPlace(def       , x       , y       )            {
    const d = BUILD_DEFS[def];
    const w = d.uiSize ? this.fieldSize() : d.w;
    const h = d.uiSize ? this.fieldSize() : d.h;
    if(x<0 || y<0 || x+w>W || y+h>H) return "Hors de la carte";
    if(!this.regionOwned(x) || !this.regionOwned(x+w-1)) return "Région non réclamée";
    for(let yy=0;yy<h;yy++) for(let xx=0;xx<w;xx++){
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

  place(def       , x       , y       )            {
    const err = this.canPlace(def, x, y);
    if(err) return err;
    const d = BUILD_DEFS[def];
    this.stock.timber -= (d.cost.timber||0);
    this.stock.stone -= (d.cost.stone||0);
    const b = this.makeBuilding(def, x, y);
    if(def==="field"){
      const n=this.fieldSize(); b.w=n; b.h=n;
      for(let yy=0;yy<n;yy++) for(let xx=0;xx<n;xx++) this.occupied[(y+yy)*W+(x+xx)] = b.id;
      let sf=0; for(let yy=0;yy<n;yy++) for(let xx=0;xx<n;xx++) sf += this.soil[(y+yy)*W+(x+xx)];
      b.f.fert = Math.min(1, sf/(n*n));
    }
    if(d.instant || d.id==="field"){ b.done = true; b.progress = 1; }
    this.uiVersion++;
    return null;
  }

  demolish(id       ){
    const idx = this.buildings.findIndex(b=>b.id===id);
    if(idx<0) return;
    const b = this.buildings[idx];
    const d = BUILD_DEFS[b.def];
    this.stock.timber += Math.floor((d.cost.timber||0)/2);
    this.stock.stone += Math.floor((d.cost.stone||0)/2);
    for(let yy=0;yy<b.h;yy++) for(let xx=0;xx<b.w;xx++) this.occupied[(b.y+yy)*W+(b.x+xx)] = -1;
    if(b.plot) for(const i of b.plot.cells) if(this.occupied[i]===b.id) this.occupied[i] = -1;
    for(const f of this.families){
      if(f.work===b.id){ f.work=-1; f.task=null; f.path=null; f.state="idle"; f.carry=null; }
      if(f.home===b.id) f.home = -1;
    }
    for(const o of this.buildings){ o.families = o.families.filter(fid=>this.families.some(ff=>ff.id===fid)); }
    this.buildings.splice(idx,1);
    this.toast(d.name+" démoli (moitié du coût remboursée)");
  }

  /* ---------- étape 3 : zones de bourgage le long des routes ---------- */
  // cases (indices) d'un rectangle tracé au doigt, bornées à la carte
  zoneRect(x0       , y0       , x1       , y1       )           {
    const ax=Math.max(0,Math.min(x0,x1)), bx=Math.min(W-1,Math.max(x0,x1));
    const ay=Math.max(0,Math.min(y0,y1)), by=Math.min(H-1,Math.max(y0,y1));
    const cells=[];
    for(let y=ay;y<=by;y++) for(let x=ax;x<=bx;x++) cells.push(y*W+x);
    return cells;
  }

  // Découpe une zone en parcelles SANS rien modifier (sert aussi d'aperçu à l'interface).
  // Chaque parcelle : maison en façade sur la route (cells[0]), cour derrière, au plus PLOT_MAX_CELLS cases.
  planZone(cells          ){
    const ok = new Set();
    for(const i of (Array.isArray(cells)?cells:[])){
      if(!Number.isInteger(i) || i<0 || i>=W*H) continue;
      if(this.tiles[i]!==T_GRASS || this.occupied[i]>=0 || this.roads[i] || !this.regionOwned(i%W)) continue;
      ok.add(i);
    }
    if(ok.size===0) return { plots:[], err:"Zone vide ou terrain impropre", limited:false };
    const sorted = Array.from(ok).sort((a,b)=>a-b);
    const fronts = [];
    for(const i of sorted){
      const x=i%W, y=(i/W)|0;
      for(let d=0;d<4;d++){ if(this.roadAt(x+DIRS4[d][0], y+DIRS4[d][1])){ fronts.push({ i, dir:d }); break; } }
    }
    if(fronts.length===0) return { plots:[], err:"La zone doit longer une route", limited:false };
    // une case de façade sur deux reçoit une maison (deux maisons ne se touchent pas)
    const seeds = [], taken = new Set();
    for(const f of fronts){
      const x=f.i%W, y=(f.i/W)|0;
      let adj=false;
      for(const [dx,dy] of DIRS4){
        const nx=x+dx, ny=y+dy;
        if(nx>=0&&ny>=0&&nx<W&&ny<H && taken.has(ny*W+nx)){ adj=true; break; }
      }
      if(!adj){ seeds.push(f); taken.add(f.i); }
    }
    const c = BUILD_DEFS.burgage.cost;
    const afford = Math.min(
      c.timber ? Math.floor((this.stock.timber||0)/c.timber) : Infinity,
      c.stone ? Math.floor((this.stock.stone||0)/c.stone) : Infinity);
    const limited = seeds.length > afford;
    const kept = seeds.slice(0, Math.max(0, afford));
    if(kept.length===0) return { plots:[], err:"Ressources insuffisantes", limited };
    // croissance en largeur, couche par couche, pour des parcelles équitables
    const owner = new Map();
    const plots = kept.map((s,k)=>{ owner.set(s.i,k); return { cells:[s.i], dir:s.dir }; });
    let frontier = kept.map((s,k)=>({ i:s.i, k, depth:0 }));
    while(frontier.length){
      const next = [];
      for(const n of frontier){
        if(n.depth>=PLOT_MAX_DEPTH) continue;
        const p = plots[n.k], x=n.i%W, y=(n.i/W)|0;
        for(const [dx,dy] of DIRS4){
          if(p.cells.length>=PLOT_MAX_CELLS) break;
          const nx=x+dx, ny=y+dy;
          if(nx<0||ny<0||nx>=W||ny>=H) continue;
          const j=ny*W+nx;
          if(!ok.has(j) || owner.has(j)) continue;
          owner.set(j, n.k); p.cells.push(j);
          next.push({ i:j, k:n.k, depth:n.depth+1 });
        }
      }
      frontier = next;
    }
    return { plots, err:null, limited };
  }

  // Trace la zone : une maison en chantier par parcelle, bâtie par les journaliers.
  traceZone(cells          )               {
    const plan = this.planZone(cells);
    if(plan.err) return plan.err;
    const c = BUILD_DEFS.burgage.cost;
    for(const p of plan.plots){
      this.stock.timber -= (c.timber||0);
      this.stock.stone -= (c.stone||0);
      const h = p.cells[0];
      const b = this.makeBuilding("burgage", h%W, (h/W)|0);
      b.plot = { cells:p.cells.slice(), dir:p.dir, extAt:{} };
      for(const i of p.cells) this.occupied[i] = b.id;
    }
    const n = plan.plots.length;
    this.toast(n+" parcelle"+(n>1?"s":"")+" tracée"+(n>1?"s":"")+" : les journaliers bâtissent les maisons."
      +(plan.limited?" (bois insuffisant pour toute la zone)":""), "good");
    this.uiVersion++;
    return null;
  }

  // cases de cour d'un bourgage tracé (hors maison) et celles encore libres
  yardCells(b         )           { return b.plot ? b.plot.cells.slice(1) : []; }
  freeYardCells(b         )           {
    if(!b.plot) return [];
    const used = new Set(Object.values(b.plot.extAt));
    return this.yardCells(b).filter(i=>!used.has(i));
  }

  // Clôture : chaque bord de case qui donne hors de la parcelle, sauf le portail de la maison côté route.
  plotFences(b         ){
    if(!b.plot) return { edges:[], gate:null };
    const set = new Set(b.plot.cells), edges = [];
    const house = b.plot.cells[0], gate = { i:house, d:b.plot.dir };
    for(const i of b.plot.cells){
      const x=i%W, y=(i/W)|0;
      for(let d=0;d<4;d++){
        const nx=x+DIRS4[d][0], ny=y+DIRS4[d][1];
        const inside = nx>=0&&ny>=0&&nx<W&&ny<H && set.has(ny*W+nx);
        if(inside || (i===gate.i && d===gate.d)) continue;
        edges.push({ i, d });
      }
    }
    return { edges, gate };
  }

  assign(bid       ){
    const b = this.buildings.find(x=>x.id===bid); if(!b) return;
    const d = BUILD_DEFS[b.def];
    if(d.fam<=0) return;
    if(b.families.length>=d.fam) return;
    const f = this.families.find(f=>f.work<0); if(!f) return;
    f.work = bid; b.families.push(f.id);
    this.resetWorker(f);
    this.uiVersion++;
  }
  unassign(bid       ){
    const b = this.buildings.find(x=>x.id===bid); if(!b) return;
    const fid = b.families.pop(); if(fid===undefined) return;
    const f = this.families.find(f=>f.id===fid); if(!f) return;
    f.work = -1; this.resetWorker(f);
    this.uiVersion++;
  }
  resetWorker(f       ){ f.task=null; f.path=null; f.state="idle"; f.carry=null; f.timer=0; f.cool=0; }

  setTax(v       ){ this.taxRate = Math.max(0, Math.min(1, v)); this.uiVersion++; }

  buyOx(){
    if(this.treasury < 20){ this.toast("Il faut 20 deniers pour acheter un boeuf.","bad"); return false; }
    this.treasury -= 20; this.stock.ox += 1;
    this.toast("Un boeuf rejoint l'écurie ! Labour et transport accélérés.","good");
    this.uiVersion++;
    return true;
  }
  oxSpeed(){ return 1 + Math.min(3, this.stock.ox) * 0.6; }
  setCrop(bid       , crop       ){
    const b=this.buildings.find(x=>x.id===bid);
    if(!b || b.def!=="field" || !CROP_DEFS[crop]) return false;
    if(b.f && b.f.sown && b.f.growth>0) return false;
    b.f.crop = crop; this.uiVersion++; return true;
  }

  buyExtension(bid       , ext       , cell        ){
    const b = this.buildings.find(x=>x.id===bid); if(!b || b.def!=="burgage" || !b.done) return;
    const d = EXT_DEFS[ext]; if(!d) return;
    if(b.exts.includes(ext)){ this.toast("Cet agrandissement existe d\u00e9j\u00e0.","bad"); return; }
    if(b.lvl < d.lvl){ this.toast("Il faut un bourgage de niveau "+d.lvl+" pour ceci.","bad"); return; }
    // parcelle tracée : l'agrandissement prend une case libre de la cour
    let slot = -1;
    if(b.plot){
      const free = this.freeYardCells(b);
      if(free.length===0){ this.toast("Plus de place dans la cour de ce bourgage.","bad"); return; }
      slot = (cell!==undefined && free.includes(cell)) ? cell : free[0];
    }
    for(const k of Object.keys(d.cost)){
      if((this.stock[k]||0) < d.cost[k]){ this.toast("Il manque des ressources pour "+d.name+".","bad"); return; }
    }
    for(const k of Object.keys(d.cost)) this.stock[k] -= d.cost[k];
    b.exts.push(ext);
    if(b.plot) b.plot.extAt[ext] = slot;
    this.toast("Agrandissement ajout\u00e9 : "+d.name);
    this.uiVersion++;
  }

  resolveEvent(choiceIndex       ){
    const ev = this.pendingEvent; if(!ev) return;
    const c = ev.choices[choiceIndex];
    if(c.act==="pay"){ this.treasury -= (c.amount||0); this.toast("Le roi a reçu son dû. La paix est préservée.","good"); }
    else if(c.act==="refuseTax"){ this.approval -= 12; const lost=this.stock.berries+this.stock.meat+this.stock.bread+this.stock.eggs+this.stock.veg;
      for(const k of FOOD_TYPES) this.stock[k]=Math.floor(this.stock[k]*0.75); this.toast("Le bailli confisque une partie des récoltes !","bad"); }
    else if(c.act==="payRaid"){ this.treasury -= (c.amount||0); this.toast("Le tribut est versé au Baron. Il se retire… pour l'instant.","good"); }
    else if(c.act==="refuseRaid"){ this.approval -= 15;
      const fort = this.buildings.some(b=>b.done&&b.def==="tower") ? 0.5 : 1.0;
      for(const k of ["berries","meat","bread","eggs","veg","apples","honey"]) this.stock[k]=Math.floor((this.stock[k]||0)*(1-0.3*fort));
      this.stock.timber=Math.floor(this.stock.timber*(1-0.15*fort));
      this.toast("Les cavaliers pillent la seigneurie !"+(fort<1?" (la tour en a limité les dégâts)":""),"bad"); }
    else if(c.act==="payBandits"){ this.treasury -= (c.amount||0); this.toast("Les brigands s'éloignent, bourse plus légère.","good"); }
    else if(c.act==="hideBandits"){ for(const k of ["berries","meat","bread","eggs","veg"]) this.stock[k]=Math.floor(this.stock[k]*0.8);
      this.stock.timber=Math.floor(this.stock.timber*0.9); this.toast("Les brigands pillent la seigneurie et repartent.","bad"); }
    this.pendingEvent = null;
    this.approval = Math.max(0, Math.min(100, this.approval));
    this.uiVersion++;
  }

  /* ---------- régions ---------- */
  regionAt(x       ){ return x < W/3 ? 1 : (x < (2*W)/3 ? 0 : 2); }
  regionOwned(x       ){ const r=this.regions[this.regionAt(x)]; return r ? r.owned : true; }
  claimRegion(rid       ){
    const r=this.regions[rid]; if(!r || r.owned) return false;
    if(this.treasury < REGION_COST.treasury || this.wealth < REGION_COST.wealth){
      this.toast("Réclamation impossible : il faut "+REGION_COST.treasury+" deniers et "+REGION_COST.wealth+" de richesse régionale.","bad");
      return false;
    }
    this.treasury -= REGION_COST.treasury; this.wealth -= REGION_COST.wealth;
    r.owned = true;
    this.influence += 10;
    this.toast("🗺️ "+REGION_DEFS[rid].name+" est désormais vôtre !","good");
    this.uiVersion++;
    return true;
  }

  /* ---------- église améliorable & niveaux de bourg ---------- */
  churchUp(bid       , up       ){
    const b = this.buildings.find(x=>x.id===bid);
    if(!b || b.def!=="church" || !b.done) return false;
    const d = CHURCH_UPGRADES[up]; if(!d) return false;
    if((b.churchUp||[]).includes(up)){ this.toast("Déjà installé.","bad"); return false; }
    for(const k of Object.keys(d.cost)) if((this.stock[k]||0) < d.cost[k]){ this.toast("Ressources insuffisantes pour "+d.name+".","bad"); return false; }
    for(const k of Object.keys(d.cost)) this.stock[k] -= d.cost[k];
    if(!b.churchUp) b.churchUp = [];
    b.churchUp.push(up);
    this.toast("Église améliorée : "+d.name+" !","good");
    this.uiVersion++;
    return true;
  }
  churchBonus(){
    let ap = 0, inf = 0;
    for(const b of this.buildings){
      if(b.def!=="church" || !b.done) continue;
      for(const up of (b.churchUp||[])){
        ap += CHURCH_UPGRADES[up].bonus.approval;
        inf += CHURCH_UPGRADES[up].bonus.influence;
      }
    }
    return { approval:ap, influence:inf };
  }
  settlementLevel(){
    const pop = this.families.length;
    let lvl = 0;
    for(let i=0;i<SETTLEMENT_LEVELS.length;i++) if(pop >= SETTLEMENT_LEVELS[i].minPop) lvl = i;
    return lvl;
  }
  settlementName(){ return SETTLEMENT_LEVELS[this.settlementLevel()].name; }

  /* ---------- influence & politiques ---------- */
  gainInfluence(n       ){ this.influence += n; }
  setPolicy(pid       , on       ){
    if(!POLICY_DEFS[pid]) return;
    this.policies[pid] = !!on;
    this.toast("Décret : "+(on?"activé":"abrogé")+" — "+POLICY_DEFS[pid].name, "info");
    this.uiVersion++;
  }
  militiaBonus(){ return this.policies.militiaService ? 1 : 0; }

  /* ---------- routes ---------- */
  toggleRoad(x       , y       ){
    if(x<0||y<0||x>=W||y>=H) return false;
    const i=y*W+x;
    if(this.occupied[i]>=0 || this.tiles[i]===T_WATER) return false;
    this.roads[i] = this.roads[i] ? 0 : 1;
    this.uiVersion++;
    return true;
  }
  roadAt(x       , y       ){ return x>=0&&y>=0&&x<W&&y<H && this.roads[y*W+x]===1; }
  passableCost(x       , y       ){
    return this.roadAt(x,y) ? 0.4 : 1.0;
  }

  /* ---------- pathfinding ---------- */
  passable(x       ,y       ){
    if(x<0||y<0||x>=W||y>=H) return false;
    if(!this.regionOwned(x)) return false;
    const i=y*W+x;
    if(this.tiles[i]===T_WATER) return false;
    const ob=this.occupied[i];
    if(ob>=0){
      const b=this.buildings.find(b=>b.id===ob);
      if(b && b.def==="wall" && b.done) return false; // rempart infranchissable
      return false;
    }
    return true;
  }
  astar(sx       ,sy       ,tx       ,ty       )           {
    if(sx===tx && sy===ty) return [];
    const N=W*H;
    // tas binaire min sur f=g+h : évite la recherche linéaire du meilleur nœud
    const heap=[]; // [f, node]
    const heapPush=(f,n)=>{ heap.push([f,n]); let i=heap.length-1;
      while(i>0){ const p=(i-1)>>1; if(heap[p][0]<=heap[i][0]) break; const t=heap[p]; heap[p]=heap[i]; heap[i]=t; i=p; } };
    const heapPop=()=>{ const top=heap[0]; const last=heap.pop();
      if(heap.length>0){ heap[0]=last; let i=0;
        for(;;){ const l=i*2+1, r=l+1; let m=i;
          if(l<heap.length&&heap[l][0]<heap[m][0]) m=l;
          if(r<heap.length&&heap[r][0]<heap[m][0]) m=r;
          if(m===i) break; const t=heap[m]; heap[m]=heap[i]; heap[i]=t; i=m; } }
      return top; };
    const gS=new Float32Array(N).fill(Infinity); gS[sy*W+sx]=0;
    const came=new Int32Array(N).fill(-1);
    const inO=new Uint8Array(N); inO[sy*W+sx]=1;
    const h=(n)=>Math.abs((n%W)-tx)+Math.abs(((n/W)|0)-ty);
    heapPush(h(sy*W+sx), sy*W+sx);
    let guard=0;
    while(heap.length>0 && guard++<4000){
      const cur=heapPop()[1]; inO[cur]=0;
      const cxx=cur%W, cyy=(cur/W)|0;
      if(cxx===tx && cyy===ty){
        const path      =[]; let c=cur;
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
        const ng=gS[cur]+this.passableCost(nx,ny);
        if(ng<gS[n]){ gS[n]=ng; came[n]=cur;
          if(!inO[n]){ inO[n]=1; heapPush(ng+h(n), n); }
          else heapPush(ng+h(n), n); // doublon autorisé, le meilleur sortira en premier
        }
      }
    }
    return null;
  }
  // trouve une case praticable adjacente au bâtiment (pour y travailler)
  spotFor(b         , fx       , fy       )         {
    if(!isFinite(b.x)||!isFinite(b.y)||!isFinite(b.w)||!isFinite(b.h)||b.w>W||b.h>H) return null;
    let best         =null, bd=Infinity;
    for(let r=1;r<=3;r++){
      for(let yy=Math.max(0,b.y-r); yy<=Math.min(H-1,b.y+b.h-1+r); yy++){
        for(let xx=Math.max(0,b.x-r); xx<=Math.min(W-1,b.x+b.w-1+r); xx++){
          const edge = (xx===Math.max(0,b.x-r)||xx===Math.min(W-1,b.x+b.w-1+r)||yy===Math.max(0,b.y-r)||yy===Math.min(H-1,b.y+b.h-1+r));
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
  sendTo(f       , tx       , ty       , task                                                             )        {
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
  sendToBuilding(f       , b         , task                          )        {
    const spot=this.spotFor(b, f.x, f.y);
    if(!spot){ f.cool=30; return false; }
    const sx=Math.floor(f.x), sy=Math.floor(f.y);
    if(sx===spot.x && sy===spot.y){ f.state="work"; f.timer=WORK_TIME[task.type]||15; f.task=task; return true; }
    const p=this.astar(sx,sy,spot.x,spot.y);
    if(!p){ f.cool=40; return false; }
    f.path=p; f.state="walk"; f.task=task;
    return true;
  }

  moveAlong(f                    , path           , speed       )        {
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
  findForestNear(b         )       {
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
  findBerryNear(b         )       {
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
  findDeerNear(b         )          {
    let best          =null, bd=Infinity;
    for(const d of this.deer){
      if(d.frozen) continue;
      const dist=Math.hypot(d.x-(b.x+0.5), d.y-(b.y+0.5));
      if(dist<=(BUILD_DEFS.hunter.radius||9) && dist<bd){ bd=dist; best=d; }
    }
    return best;
  }
  fields(){ return this.buildings.filter(b=>b.done && b.def==="field" && b.f); }

  assignTask(f       ){
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
          let target              =null, td=Infinity;
          for(const fd of fs){ if(fd.f && fd.f.plow<1){ const d=Math.hypot(fd.x-f.x,fd.y-f.y); if(d<td){td=d;target=fd;} } }
          if(target && target.f){ this.sendToBuilding(f, target, {type:"plow", bid:target.id}); return; }
          f.cool=40; return;
        }
        if(m===8 || m===9){ // septembre-octobre : moisson
          let target              =null, td=Infinity;
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
      case "trade":{
        this.sendToBuilding(f, b, {type:"trade"}); return;
      }
      default: f.cool=80; return;
    }
  }

  taskBuild(f       , site         ){
    const d=Math.hypot(site.x+site.w/2-f.x, site.y+site.h/2-f.y);
    if(d<1.8){ f.state="work"; f.task={type:"build", bid:site.id}; return; }
    this.sendToBuilding(f, site, {type:"build", bid:site.id});
  }

  stepFamily(f       ){
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

  doWork(f       ){
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
        site.progress += 0.0045 * (BUILD_DEFS[site.def].buildRate || 1);
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
          const cd = CROP_DEFS[fd.f.crop] || CROP_DEFS.wheat;
          const yieldQty = Math.round(fd.w*fd.h*4*fd.f.fert*fd.f.growth);
          if(cd.yield) this.stock[cd.yield] = Math.min(this.capFor(cd.yield), this.stock[cd.yield] + yieldQty);
          this.toast("Moisson de "+cd.name.toLowerCase()+" : "+yieldQty+" "+(RES_ICONS[cd.yield]||""),"good");
          fd.f.sown=false; fd.f.growth=0; fd.f.plow=0; fd.f.harvestP=0;
          fd.f.fert = Math.max(0.2, Math.min(1, fd.f.fert - cd.fertCost));
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
      case "trade":{
        f.timer++;
        if(f.timer>200){ f.timer=0; }
        break;
      }
    }
  }

  finishWork(f       ){
    const t=f.task;
    if(!t){ f.state="idle"; return; }
    f.task=null;
    const cap=(k       )=>this.capFor(k);
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

  deposit(f       ){
    if(!f.carry) return;
    for(const k in f.carry){
      const cap=this.capFor(k);
      const room=Math.max(0, cap-this.stock[k]);
      this.stock[k]+=Math.min(room, f.carry[k]);
    }
    f.carry=null;
  }

  /* ---------- camps de brigands & milice ---------- */
  campStep(){
    // spawn : un camp tous les ~2 ans à partir de 1178, max 2
    if(this.mode().combat && this.time.year>=1177 && this.camps.length<2 && this.rnd()<0.004*(this.mode().bandits||1)*this.diff().bandits){
      for(let tries=0; tries<30; tries++){
        const x=2+Math.floor(this.rnd()*(W-4)), y=2+Math.floor(this.rnd()*(H-4));
        if(this.passable(x,y)){
          this.camps.push({ id:this.nextC++, x:x+0.5, y:y+0.5, hp:20, maxHp:20 });
          this.toast("🏕️ Un camp de brigands s'installe aux alentours !","bad");
          break;
        }
      }
    }
    for(const c of this.camps){
      // les brigands pillent un peu de nourriture chaque mois (géré dans onMonth)
    }
  }
  militiaCount(){ return Math.floor(this.families.length/2) + this.militiaBonus(); }
  raiseMilitia(){
    const want = this.militiaCount();
    const have = this.units.length;
    if(want<=have) return 0;
    const n = want-have;
    for(let i=0;i<n;i++){
      const b = this.buildings.find(b=>b.done && b.def==="manor") || this.buildings[0];
      this.units.push({ id:this.nextU++, x:b.x+0.5, y:b.y+b.h+0.5, hp:10, maxHp:10, state:"guard", target:null, cool:0 });
    }
    this.toast("🛡️ Milice levée : "+n+" soldat(s) !","good");
    this.uiVersion++;
    return n;
  }
  unitStep(u){
    if(u.merc){ u.ttl--; if(u.ttl<=0){
      this.units.splice(this.units.indexOf(u),1);
      this.toast("Le mercenaire quitte la seigneurie (contrat terminé).");
      return;
    } }
    if(u.state==="guard"){
      // cherche le camp le plus proche
      let best=null, bd=Infinity;
      for(const c of this.camps){ const d=Math.hypot(c.x-u.x, c.y-u.y); if(d<bd){ bd=d; best=c; } }
      if(best && bd<14){ u.state="attack"; u.target=best.id; }
      else if(u.cool>0) u.cool--;
    } else if(u.state==="attack"){
      const c = this.camps.find(c=>c.id===u.target);
      if(!c){ u.state="guard"; u.target=null; return; }
      const d = Math.hypot(c.x-u.x, c.y-u.y);
      if(d>1.6){
        const p=this.astar(Math.floor(u.x),Math.floor(u.y),Math.floor(c.x),Math.floor(c.y));
        if(p && p.length){ u.path=p; this.moveAlong(u, u.path, 0.3); } else { u.x+=(c.x-u.x)/d*0.3; u.y+=(c.y-u.y)/d*0.3; }
      } else {
        // combat : le soldat tape (x6 par tick de combat), le camp riposte
        c.hp -= 0.30; u.hp -= 0.03;
        if(c.hp<=0){
          this.camps.splice(this.camps.indexOf(c),1);
          this.treasury += 15;
          this.wealth += 10;
          this.toast("🏆 Camp de brigands détruit ! +15 deniers de butin.","good");
          u.state="guard"; u.target=null; u.hp=u.maxHp;
        }
        if(u.hp<=0){
          this.units.splice(this.units.indexOf(u),1);
          this.approval=Math.max(0,this.approval-5);
          this.toast("💀 Un soldat est tombé au combat…","bad");
        }
      }
    }
  }
  hireMercenary(){
    const cost = 25;
    if(this.treasury < cost){ this.toast("Il faut "+cost+" deniers pour louer un mercenaire.","bad"); return false; }
    this.treasury -= cost;
    const b = this.buildings.find(b=>b.done && b.def==="manor") || this.buildings[0];
    this.units.push({ id:this.nextU++, x:b.x+0.5, y:b.y+b.h+0.5, hp:14, maxHp:14, state:"guard", target:null, cool:0, merc:true, ttl:96 }); // 6 mois (unitStep appelé tous les 10 ticks : 6*16*10/10)
    this.toast("\u2694\ufe0f Un mercenaire rejoint vos rangs (25 deniers).","good");
    this.uiVersion++;
    return true;
  }

  pillageCamps(){
    if(!this.camps.length) return 0;
    let lost=0;
    for(const c of this.camps){
      for(const k of FOOD_TYPES){ const take=Math.min(this.stock[k]||0, 1); this.stock[k]-=take; lost+=take; }
    }
    return lost;
  }

  /* ---------- progression du temps ---------- */
  step(){
    const t=this.time;
    t.tick++;
    // croissance des cultures (mai → août)
    if(t.month>=4 && t.month<=7){
      for(const b of this.buildings){
        if(b.done && b.def==="field" && b.f && b.f.sown && b.f.growth<1){
          const wMul = this.weather==="rain" ? 0.7 : 1;
          b.f.growth = Math.min(1, b.f.growth + 0.0016*wMul);
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
      // camps de brigands : spawn aléatoire + déplacement + pillage
      this.campStep();
      // milice : les soldats patrouillent et affrontent les brigands
      for(const u of this.units) this.unitStep(u);
      // libère les cerfs dont le chasseur a disparu
      if(t.tick%200===0){
        const hunting=new Set        ();
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
      if(!f.usedThisYear) f.fert=Math.min(1, f.fert+0.12); // jachère (champ non semé cette année)
      f.usedLastYear=f.usedThisYear; f.usedThisYear=false;
    }
  }

  onMonth(){
    const m=this.time.month;
    const winter=(seasonOf(m)===0);
    // ----- météo du mois : neige en hiver, sinon pluie/brouillard aléatoires -----
    if(winter){ this.weather = this.rnd()<0.5 ? "snow" : "clear"; }
    else {
      const r=this.rnd();
      this.weather = r<0.18 ? "rain" : r<0.30 ? "fog" : "clear";
    }
    this.weatherT = 0;
    // production des extensions de cour
    const summer = m>=7 && m<=9;
    const beeSeason = m>=3 && m<=8;
    for(const b of this.buildings){
      if(!b.done || b.def!=="burgage") continue;
      for(const e of b.exts){
        if(e==="garden")  this.stock.veg=Math.min(this.capFor("veg"), this.stock.veg+0.5);
        if(e==="chicken") this.stock.eggs=Math.min(this.capFor("eggs"), this.stock.eggs+0.5);
        if(e==="orchard" && summer) this.stock.apples=Math.min(this.capFor("apples"), this.stock.apples+1);
        if(e==="beehive" && beeSeason) this.stock.honey=Math.min(this.capFor("honey"), this.stock.honey+0.5);
        if(e==="tailor")  this.stock.clothes=Math.min(this.capFor("clothes"), this.stock.clothes+1);
        if(e==="brewer"){ if(this.stock.barley>=1){ this.stock.barley-=1; this.stock.ale=Math.min(this.capFor("ale"), this.stock.ale+1); } }
      }
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
    // bois de chauffe (neige = +1 par famille en plus)
    const fuelNeed=this.families.length*(winter?2:1)+(this.weather==="snow"?this.families.length:0);
    const fuelGot=Math.min(this.stock.firewood, fuelNeed);
    this.stock.firewood-=fuelGot;
    const fuelRatio=fuelNeed>0?fuelGot/fuelNeed:1;
    // v\u00eatements (1 tous les 2 mois par famille)
    let clothed=0;
    for(const f of this.families){
      f.clothCool=(f.clothCool||0)+1;
      if(f.clothCool>=2 && this.stock.clothes>0){ this.stock.clothes-=1; f.clothCool=0; clothed++; }
      else if(f.clothCool>=2){ f.clothCool=0; }
    }
    const clothRatio=this.families.length>0?clothed/this.families.length:1;
    // ale (1 par mois par famille adulte, hivernal)
    let drunk=0;
    if(winter){
      for(const f of this.families){
        if(this.stock.ale>0){ this.stock.ale-=1; drunk++; }
      }
    }
    const aleRatio=this.families.length>0?drunk/this.families.length:1;
    // pourrissement
    const spoil=this.buildings.some(b=>b.done&&b.def==="granary")?0.03:0.10;
    for(const k of FOOD_TYPES) this.stock[k]=Math.max(0,this.stock[k]*(1-spoil));
    // effets des décrets actifs
    if(this.policies.tithe){ this.influence += 8; }
    if(this.policies.freeMarket){ this.wealth += 6; }
    if(this.policies.militiaService){ /* milice déjà comptée dans militiaCount */ }
    // influence passive : église + manoir
    if(this.hasChurch()) this.influence += 1 + this.churchBonus().influence;
    if(this.hasManor()) this.influence += 1;
    // approbation
    let a=50;
    if(varietyVillage>=3) a+=12; else if(varietyVillage===2) a+=6; else if(varietyVillage===1) a-=2; else a-=8;
    if(fuelRatio>=1) a+=4; else if(fuelRatio>=0.5) a-=5; else a-=15;
    if(clothRatio>=1) a+=4; else if(clothRatio>=0.5) a-=3; else a-=8;
    if(winter){ if(aleRatio>=1) a+=3; else if(aleRatio<0.5) a-=6; }
    if(this.hasChurch()) a+=6 + this.churchBonus().approval;
    if(this.buildings.some(b=>b.done&&b.def==="tower")) a+=4;
    if(this.buildings.some(b=>b.done&&b.def==="market")) a+=4; else a-=4;
    const homeless=this.families.filter(f=>f.home<0).length;
    a-=Math.min(24, homeless*12);
    a-=(this.taxRate-0.1)*40;
    if(this.policies.tithe) a-=4;
    if(this.policies.freeMarket) a+=3;
    if(this.policies.militiaService) a-=3;
    if(starved>0) a-=8;
    this.approval=Math.max(0,Math.min(100,Math.round(a)));
    if(this.approval<=5 && this.families.length>0){ this.lowApprovalStreak++; } else { this.lowApprovalStreak=0; }
    if(this.lowApprovalStreak>=6){ this.defeat=true; this.endReason="approbation à 0 (6 mois)"; this.toast("💀 La seigneurie sombre dans le chaos…","bad"); }
    if(this.approval>=50) this.objectives.happyStreak=(this.objectives.happyStreak||0)+1; else this.objectives.happyStreak=0;
    if(this.approval>=50 && (this.objectives.happyStreak||0)>=3) this.objectives.happy=true;
    // impôts
    if(this.hasManor()){
      let levels=0;
      for(const b of this.buildings) if(b.done&&b.def==="burgage"&&this.families.some(f=>f.home===b.id)) levels+=[0,1,3,6][b.lvl];
      this.treasury+=levels*this.taxRate*(this.policies.freeMarket?0.9:1);
    }
    // ----- commerce régional : comptoir vend les surplus, prix fluctuants -----
    const tradeActive = this.buildings.some(b=>b.done && b.def==="trade" && b.families.length>0);
    if(tradeActive){
      let earned = 0;
      for(const k of Object.keys(this.prices)){
        const p = this.prices[k];
        const surplus = Math.floor(this.stock[k]||0);
        if(surplus >= 3){
          const sold = Math.min(surplus, 4 + Math.floor(this.rnd()*3));
          this.stock[k] -= sold;
          earned += sold * p;
        }
        // fluctuation des prix +-20%
        this.prices[k] = Math.max(1, Math.round(p * (0.8 + this.rnd()*0.4)));
      }
      this.treasury += earned;
      this.wealth += earned * 0.6; // la richesse régionale reflète l'activité commerciale
      if(earned>0) this.toast("Comptoir : +"+earned+" deniers de ventes.","good");
    } else {
      // sans comptoir, la richesse régionale vient des impôts locaux
      this.wealth = Math.max(0, this.wealth*0.98);
    }
    // cueilleurs : récolte passive de baies en saison, même sans ouvrier assigné
    if(this.berrySeason()){
      let anyBerry=false;
      for(let i=0;i<W*H;i++) if(this.tiles[i]===T_BERRY && this.berryY[i]>2){ anyBerry=true; break; }
      for(const b of this.buildings){
        if(b.done && b.def==="forager" && (this.findBerryNear(b)>=0 || anyBerry))
          this.stock.berries=Math.min(this.capFor("berries"), this.stock.berries+1.0);
      }
    }
    // chasseurs : un peu de viande passive si gibier proche
    for(const b of this.buildings){
      if(b.done && b.def==="hunter" && this.deer.length>0)
        this.stock.meat=Math.min(this.capFor("meat"), this.stock.meat+0.5);
    }
    // production passive de bois de chauffe par les camps de bûcherons (même sans ouvrier assigné)
    for(const b of this.buildings){
      if(b.done && b.def==="woodcutter" && this.findForestNear(b)>=0)
        this.stock.firewood=Math.min(this.capFor("firewood"), this.stock.firewood+0.6);
    }
    // pillage des camps de brigands
    if(this.camps.length){
      const lost=this.pillageCamps();
      if(lost>0) this.toast("🏕️ Les brigands ont pillé "+lost+" denrées !","bad");
    }
    // bonus des régions réclamées
    for(const r of this.regions){
      if(!r.owned) continue;
      const bd = REGION_DEFS[r.id].bonus;
      if(!bd) continue;
      for(const k of Object.keys(bd)) this.stock[k]=Math.min(this.capFor(k), (this.stock[k]||0)+bd[k]);
    }
    // évolution des bourgages
    for(const b of this.buildings){
      if(b.def!=="burgage"||!b.done) continue;
      const res=this.families.find(f=>f.home===b.id);
      if(!res) continue;
      const ok=res.lastAte>=1 && fuelRatio>=1 && market && varietyVillage>=2 && clothRatio>=1;
      if(ok) b.monthsGood++; else b.monthsGood=0;
      if(b.lvl===1 && b.monthsGood>=3 && this.stock.timber>=2){ this.stock.timber-=2; b.lvl=2; this.toast("Un bourgage évolue : niveau 2 !","good"); }
      else if(b.lvl===2 && b.monthsGood>=3 && this.approval>=65 && this.hasChurch() && this.stock.timber>=2 && this.stock.stone>=2){
        this.stock.timber-=2; this.stock.stone-=2; b.lvl=3; this.toast("Un bourgage évolue : niveau 3 ! Impôts accrus.","good");
      }
    }
    // migration (personne ne s'installe dans un village au bord de la famine)
    if(this.approval>=40){
      const free=this.freeBurgages();
      const foodTotal=FOOD_TYPES.reduce((s,k)=>s+this.stock[k],0);
      const n=(this.approval>=75)?2:1;
      for(let i=0;i<n && i<free;i++){
        if(foodTotal < (this.families.length+i+1)*0.8) break;
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
    this.objectives.wood=this.objectives.wood||this.buildings.some(b=>b.done&&b.def==="woodcutter");
    this.objectives.pop=this.objectives.pop||this.families.length>=8;
    this.objectives.manor=this.objectives.manor||this.hasManor();
    if(!this.victory && !this.defeat){
      const mode=this.mode();
      let win=false;
      if(mode.id==="prosperity"){
        win = this.objectives.wood&&this.objectives.happy&&this.objectives.pop&&this.objectives.manor;
      } else if(mode.id==="edge"){
        win = this.time.year>=1179;
      } else if(mode.id==="peace" || mode.id==="duel"){
        win = this.camps.length===0 && this.regions.every(r=>r.owned) && this.time.year>=1179;
      } else if(mode.id==="fractured"){
        win = this.regions.every(r=>r.owned) && this.baron.power===0 && this.time.year>=1180;
      }
      if(win){ this.victory=true; this.endReason="victoire"; this.toast("🏆 Victoire ! "+mode.name+" accomplie !","good"); }

      if(this.families.length===0 && this.time.year>1176){ this.defeat=true; this.endReason="plus aucune famille"; this.toast("💀 Toute la population a disparu…","bad"); }
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
          { label:"Payer "+amount+" 💰", act:"pay", amount, disabled:this.treasury<amount },
          { label:"Refuser (approbation −12, récoltes confisquées)", act:"refuseTax" },
        ]};
    }
    if(m===4 && this.time.year>=1177 && this.rnd()<0.55){
      const amount=Math.max(8, Math.round(6+this.families.length*1.5));
      this.pendingEvent={ title:"Des brigands en vue !",
        text:"Une bande de brigands rôde autour de la seigneurie. Ils exigent "+amount+" deniers pour passer leur chemin.",
        choices:[
          { label:"Payer "+amount+" 💰", act:"payBandits", amount, disabled:this.treasury<amount },
          { label:"Refuser (ils pillent les réserves)", act:"hideBandits" },
        ]};
    }
    // ----- menaces aléatoires (à partir de 1178) -----
    if(this.time.year>=1178 && this.rnd()<0.02){
      const roll=this.rnd();
      if(roll<0.33){
        // peste : quelques familles meurent ou partent
        const n=Math.min(this.families.length-1, 1+Math.floor(this.rnd()*2));
        for(let i=0;i<n;i++){
          const f=this.families[this.families.length-1];
          this.families.splice(this.families.indexOf(f),1);
          for(const o of this.buildings) o.families=o.families.filter(id=>id!==f.id);
        }
        this.approval=Math.max(0,this.approval-10);
        this.toast("☠️ Une peste frappe la seigneurie ! "+n+" famille(s) disparue(s).","bad");
      } else if(roll<0.66){
        // incendie : perte de bois et approbation
        this.stock.timber=Math.floor(this.stock.timber*0.6);
        this.approval=Math.max(0,this.approval-6);
        this.toast("🔥 Un incendie ravage une partie des réserves de bois !","bad");
      } else {
        // hiver rude : consommation de bois doublée ce mois-ci (déjà le cas), avertissement
        this.stock.firewood=Math.max(0,this.stock.firewood-this.families.length);
        this.toast("❄️ Un hiver précoce ! Surveillez le bois de chauffe.","bad");
      }
    }
    // ----- IA du Baron rival -----
    this.baronStep();
    this.uiVersion++;
  }

  baronStep(){
    const b = this.baron;
    if(!this.mode().combat) return; // pas de baron en mode prospérité
    if(this.time.year < 1177) return;
    // il réclame une région tous les ~6 mois s'il le peut (gratuit pour lui, il a ses propres terres)
    if(this.time.month % 6 === 0 && b.nextClaim <= 0){
      const free = this.regions.filter(r=>!r.owned && !b.regions.includes(r.id));
      if(free.length){
        const r = free[Math.floor(this.rnd()*free.length)];
        b.regions.push(r.id);
        b.power += 1;
        this.toast("⚔️ Le "+b.name+" réclame la région « "+REGION_DEFS[r.id].name+" » !","bad");
      }
      b.nextClaim = 6;
    }
    if(b.nextClaim > 0) b.nextClaim--;
    // tous les ~10 mois après 1178, un raid s'il a du pouvoir
    if(this.time.year >= 1177 && this.time.month % 4 === 0 && b.nextRaid <= 0 && b.power > 0){
      const amount = Math.round((10 + b.power * 8) * this.diff().raid * (this.mode().baron||1));
      this.pendingEvent = { title:"Raid du Baron !",
        text:"Des cavaliers du "+b.name+" fondent sur la seigneurie et exigent "+amount+" deniers de tribut !",
        choices:[
          { label:"Payer "+amount+" \u00a0💰", act:"payRaid", amount, disabled:this.treasury<amount },
          { label:"Refuser (pillage + approbation -15)", act:"refuseRaid" },
        ]};
      b.power = Math.max(0, b.power - 1);
      b.nextRaid = 10;
    }
    if(b.nextRaid > 0) b.nextRaid--;
  }

  /* ---------- interrogation pour l'UI ---------- */
  buildingAt(tx       , ty       )              {
    const id=this.occupied[ty*W+tx];
    if(id<0) return null;
    return this.buildings.find(b=>b.id===id) || null;
  }
  workStatus(b         )       {
    const d=BUILD_DEFS[b.def];
    if(!b.done) return "En construction : "+BUILD_STAGES[buildStage(b)].name.toLowerCase()+" ("+Math.round(b.progress*100)+" %)";
    if(d.fam>0 && b.families.length===0) return "Aucune famille affectée";
    switch(b.def){
      case "woodcutter": return this.findForestNear(b)<0 ? "Plus d'arbres à portée" : "Abattage en cours";
      case "forager": return !this.berrySeason() ? "Repos d'hiver" : (this.findBerryNear(b)<0 ? "Plus de baies à portée" : "Cueillette en cours");
      case "hunter": return this.findDeerNear(b) ? "Chasse en cours" : "Aucun gibier à portée";
      case "quarry": { const i=b.y*W+b.x; return this.stoneAmt[i]<=0 ? "Carrière épuisée" : "Extraction en cours"; }
      case "farm": return "Ferme ("+this.fields().length+" champ(s))";
      case "windmill": return this.stock.grain>0 ? "Mouture du grain" : "En attente de grain";
      case "market": return b.families.length>0 ? "Étals tenus" : "Marché inactif";
      case "trade": return b.families.length>0 ? "Comptoir actif (ventes auto)" : "Comptoir inactif";
      default: return "";
    }
  }
  tileName(tx       ,ty       )       {
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
      v:3, // v3 : parcelles de bourgage (b.plot), champ optionnel ignoré par les versions précédentes
      seed:this.seed,
      modeId:this.modeId,
      weather:this.weather,
      lowApprovalStreak:this.lowApprovalStreak,
      diffId:this.diffId,
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
      log:this.log,
      roads:Array.from(this.roads),
      regions:this.regions,
      baron:this.baron,
      influence:this.influence,
      policies:this.policies,
      camps:this.camps,
      units:this.units,
      wealth:this.wealth,
      prices:this.prices,
      victory:this.victory,
      pendingEvent:this.pendingEvent,
      winterWarned:this.winterWarned,
    };
  }
  static load(data    )          {
    if(!data || typeof data.seed!=="number" || !Array.isArray(data.tiles)) throw new Error("sauvegarde invalide");
    if(data.tiles.length!==W*H) throw new Error("sauvegarde invalide (taille de carte)");
    const num = (v)=>typeof v==="number" && isFinite(v);
    const g = new GameState(data.seed);
    g.tiles = Uint8Array.from(data.tiles);
    const arr = (a)=>Array.isArray(a) ? a : new Array(W*H).fill(0);
    g.treeWood = Float32Array.from(arr(data.treeWood));
    g.berryY = Float32Array.from(arr(data.berryY));
    g.stoneAmt = Float32Array.from(arr(data.stoneAmt));
    g.buildings = (data.buildings || []).map(b=>{
      if(b.ext !== undefined && b.ext !== null){
        if(!Array.isArray(b.exts) || b.exts.length===0) b.exts=[b.ext];
        delete b.ext;
      }
      if(!Array.isArray(b.exts)) b.exts=[];
      if(b.plot!==undefined){
        const p = b.plot;
        const cells = p && Array.isArray(p.cells) ? p.cells.filter(i=>Number.isInteger(i) && i>=0 && i<W*H) : [];
        if(cells.length===0 || cells[0]!==b.y*W+b.x) delete b.plot;
        else {
          const extAt = {};
          if(p.extAt && typeof p.extAt==="object") for(const k of Object.keys(p.extAt))
            if(EXT_DEFS[k] && b.exts.includes(k) && cells.indexOf(p.extAt[k])>0) extAt[k] = p.extAt[k];
          b.plot = { cells, dir: Number.isInteger(p.dir) && p.dir>=0 && p.dir<4 ? p.dir : 2, extAt };
        }
      }
      return b;
    });
    g.families = Array.isArray(data.families) ? data.families : [];
    g.deer = Array.isArray(data.deer) ? data.deer : [];
    if(data.stock && typeof data.stock==="object") g.stock = Object.assign(g.stock, data.stock);
    if(data.time && num(data.time.tick) && num(data.time.day) && num(data.time.month) && num(data.time.year)){
      g.time = { tick:Math.max(0,data.time.tick), day:Math.max(0,data.time.day),
                 month:Math.max(0,Math.min(11,data.time.month)), year:Math.max(0,data.time.year) };
    }
    if(typeof data.approval==="number") g.approval = data.approval;
    if(typeof data.treasury==="number") g.treasury = data.treasury;
    if(typeof data.taxRate==="number") g.taxRate = data.taxRate;
    if(data.objectives) g.objectives = data.objectives;
    g.log = Array.isArray(data.log) ? data.log : [];
    if(Array.isArray(data.roads) && data.roads.length===W*H) g.roads = Uint8Array.from(data.roads);
    if(data.baron && typeof data.baron==="object") g.baron = Object.assign(g.baron, data.baron);
    g.influence = typeof data.influence==="number" ? data.influence : 0;
    if(data.policies && typeof data.policies==="object") g.policies = Object.assign(g.policies, data.policies);
    g.camps = Array.isArray(data.camps) ? data.camps : [];
    g.units = Array.isArray(data.units) ? data.units : [];
    g.nextC = Math.max(0, ...g.camps.map(c=>typeof c.id==="number"?c.id:0)) + 1;
    g.nextU = Math.max(0, ...g.units.map(u=>typeof u.id==="number"?u.id:0)) + 1;
    if(Array.isArray(data.regions)) g.regions = REGION_DEFS.map(r=>({ id:r.id, owned: !!(data.regions[r.id] && data.regions[r.id].owned) || r.id===0 }));
    g.wealth = typeof data.wealth==="number" ? data.wealth : 0;
    if(data.prices && typeof data.prices==="object"){
      for(const k of Object.keys(data.prices)) if(num(data.prices[k])) g.prices[k] = Math.max(1, data.prices[k]);
    }
    g.victory = !!data.victory;
    g.defeat = !!data.defeat;
    g.endReason = data.endReason || null;
    if(typeof data.weather==="string") g.weather = data.weather;
    g.lowApprovalStreak = typeof data.lowApprovalStreak==="number" ? data.lowApprovalStreak : 0;
    if(typeof data.modeId==="string" && MODE_BY_ID[data.modeId]) g.modeId = data.modeId;
    if(typeof data.diffId==="string" && DIFF_BY_ID[data.diffId]) g.diffId = data.diffId;
    g.pendingEvent = data.pendingEvent || null;
    g.winterWarned = !!data.winterWarned;
    g.nextB = Math.max(0, ...g.buildings.map(b=>num(b.id)?b.id:0)) + 1;
    g.nextF = Math.max(0, ...g.families.map(f=>num(f.id)?f.id:0)) + 1;
    g.nextD = Math.max(0, ...g.deer.map(d=>num(d.id)?d.id:0)) + 1;
    // reconstruit l'occupation du sol à partir des bâtiments (bornes vérifiées)
    g.occupied = new Int32Array(W*H).fill(-1);
    for(const b of g.buildings){
      if(!num(b.x)||!num(b.y)||!num(b.w)||!num(b.h)||b.w>W||b.h>H||b.x>W||b.y>H) continue;
      for(let yy=0;yy<b.h;yy++) for(let xx=0;xx<b.w;xx++){
        const bx=b.x+xx, by=b.y+yy;
        if(bx>=0&&by>=0&&bx<W&&by<H) g.occupied[by*W+bx] = b.id;
      }
      if(b.plot) for(const i of b.plot.cells) if(g.occupied[i]<0) g.occupied[i] = b.id;
    }
    return g;
  }
}

if(typeof module!=="undefined" && module.exports){
  module.exports = { BUILD_STAGES, buildStage, DIRS4, PLOT_MAX_CELLS, PLOT_MAX_DEPTH, GameState, BUILD_DEFS, BUILD_ORDER, FOOD_TYPES, EXT_DEFS, EXT_ORDER, CROP_DEFS, CROP_ORDER, FIELD_SIZES, RES_ICONS, W, H,
    T_GRASS, T_FOREST, T_BERRY, T_STONE, T_WATER, MONTHS, SEASONS, seasonOf, REGION_DEFS, REGION_COST, POLICY_DEFS, POLICY_ORDER, CHURCH_UPGRADES, CHURCH_UP_ORDER, SETTLEMENT_LEVELS, MODES, MODE_BY_ID, DIFFICULTIES, DIFF_BY_ID };
}
