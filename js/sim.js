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
  camp:      { id:"camp",      name:"Campement",      icon:"⛺", w:2,h:1, cost:{}, fam:0, instant:true, desc:"Abri provisoire des survivants. Démonté quand toutes les familles ont une maison." },
  oxpost:    { id:"oxpost",    name:"Poteau du bœuf", icon:"🐂", w:1,h:1, cost:{timber:1}, fam:0, instant:true, desc:"Le bœuf y est attaché : il aide à porter les charges lourdes." },
  burgage:   { id:"burgage",   name:"Bourgage",       icon:"🏠", w:1,h:1, cost:{timber:1}, fam:0, instant:true, buildRate:2, desc:"Loge une famille. Évolue si ses besoins sont satisfaits." },
  woodcutter:{ id:"woodcutter",name:"Camp de bûcherons",icon:"🪓", w:1,h:1, cost:{timber:2}, fam:2, skill:"wood", radius:6, instant:false, desc:"Abat les arbres à proximité : bois d'œuvre + bois de chauffe." },
  forager:   { id:"forager",   name:"Cabane de cueilleuses", icon:"🍒", w:1,h:1, cost:{timber:2}, fam:2, skill:"gather", radius:6, instant:false, desc:"Cueille des baies (mars → novembre)." },
  hunter:    { id:"hunter",    name:"Camp de chasse",  icon:"🏹", w:1,h:1, cost:{timber:2}, fam:2, skill:"hunt", radius:10, instant:false, desc:"Chasse le gibier des forêts : viande, toute l'année." },
  quarry:    { id:"quarry",    name:"Carrière",        icon:"🪨", w:1,h:1, cost:{timber:2}, fam:1, skill:"stone", onStone:true, instant:false, desc:"À poser SUR un gisement de pierre. S'épuise avec le temps." },
  farm:      { id:"farm",      name:"Ferme",           icon:"🚜", w:2,h:2, cost:{timber:3}, fam:2, skill:"farm", instant:false, desc:"Ses fermiers travaillent les champs au fil des saisons (fumure, labour, semailles, moisson, fauche) et battent les gerbes l'hiver." },
  field:     { id:"field",     name:"Champ",           icon:"🌾", w:4,h:4, uiSize:true, cost:{}, fam:0, instant:true,  desc:"Gratuit. Rendement selon la fertilité du sol (visible en mode pose), la météo et la rotation des cultures." },
  windmill:  { id:"windmill",  name:"Moulin",          icon:"💨", w:2,h:2, cost:{timber:2,stone:2}, fam:1, skill:"craft", instant:false, desc:"Transforme le grain en pain (meilleur variété alimentaire)." },
  granary:   { id:"granary",   name:"Grange",          icon:"🏚️", w:1,h:1, cost:{timber:2}, fam:0, instant:false, desc:"Réduit fortement le pourrissement des denrées." },
  storehouse:{ id:"storehouse",name:"Entrepôt",        icon:"📦", w:1,h:1, cost:{timber:2}, fam:0, instant:false, desc:"+150 de capacité de stockage pour chaque ressource." },
  market:    { id:"market",    name:"Marché",          icon:"⛺", w:2,h:2, cost:{timber:2}, fam:3, skill:"trade", instant:false, desc:"Sans marché actif, vos familles n'ont accès qu'à un seul type de nourriture." },
  church:    { id:"church",    name:"Église",          icon:"⛪", w:2,h:2, cost:{timber:2,stone:2}, fam:0, instant:false, desc:"+6 d'approbation. Requise pour les bourgages de niveau 3." },
  trade:     { id:"trade",     name:"Comptoir",       icon:"\u26fa", w:2,h:2, cost:{timber:3,stone:2}, fam:1, skill:"trade", instant:false, desc:"Vente automatique des surplus chaque mois (prix fluctuants). +richesse régionale." },
  tower:     { id:"tower",     name:"Tour de guet",   icon:"\ud83d\udde1\ufe0f", w:1,h:1, cost:{timber:2,stone:3}, fam:0, instant:false, desc:"+4 approbation, repousse les raids (réduit le pillage de moitié)." },
  wall:      { id:"wall",      name:"Rempart",        icon:"⬛", w:1,h:1, cost:{stone:2}, fam:0, instant:false, wall:true, desc:"Mur défensif : les brigands ne passent pas dessus (case infranchissable)." },
  manor:     { id:"manor",     name:"Manoir",          icon:"🏰", w:2,h:2, cost:{timber:4,stone:3}, fam:0, instant:false, desc:"Permet de lever l'impôt (curseur dans le panneau du manoir)." },
  // étape 5 : enclos tracé librement (coût selon la longueur de clôture), un abri et un gardien
  pasture:   { id:"pasture",   name:"Pâturage",        icon:"🐑", w:1,h:1, cost:{timber:1}, fam:1, skill:"herd", instant:false, buildRate:3, zone:true, desc:"Enclos tracé librement : l'herbe nourrit un troupeau (moutons, vaches ou porcs) du printemps à l'automne ; l'hiver, il faut du foin. Un gardien soigne les bêtes, trait, tond." },
};
const BUILD_ORDER = ["woodcutter","forager","hunter","quarry","farm","field","windmill","granary","storehouse","market","trade","church","tower","wall","manor"];

const FOOD_TYPES = ["berries","meat","bread","eggs","veg","apples","honey","pulses","milk"];

const EXT_DEFS = {
  garden:  { id:"garden",  name:"Potager",            cost:{timber:1},           lvl:1, desc:"+0,5 légume par mois." },
  chicken: { id:"chicken", name:"Basse-cour",         cost:{timber:1},           lvl:1, desc:"+0,5 œuf par mois." },
  orchard: { id:"orchard", name:"Verger",             cost:{timber:2},           lvl:1, desc:"+1 pomme par mois (août → octobre). Nourrit aussi la famille." },
  beehive: { id:"beehive", name:"Rucher",             cost:{timber:2},           lvl:1, desc:"+0,5 miel par mois (avril → septembre)." },
  tailor:  { id:"tailor",  name:"Atelier du tailleur",cost:{timber:2},           lvl:2, desc:"1 vêtement par mois avec de la laine ou du lin, moitié moins sans fibre. Requiert le niveau 2." },
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
const PLOT_FRONT = 2;      // largeur visée d'une parcelle le long de la route (en cases)
const SNAP = 4;            // points du contour calés au quart de case
// géométrie des contours (coordonnées en cases)
function polyArea(p){ let a=0; for(let i=0,j=p.length-1;i<p.length;j=i++) a += p[j][0]*p[i][1] - p[i][0]*p[j][1]; return Math.abs(a)/2; }
function pointInPoly(x, y, p){
  let ins=false;
  for(let i=0,j=p.length-1;i<p.length;j=i++){
    const xi=p[i][0], yi=p[i][1], xj=p[j][0], yj=p[j][1];
    if((yi>y)!==(yj>y) && x < (xj-xi)*(y-yi)/(yj-yi)+xi) ins=!ins;
  }
  return ins;
}
function segCross(a, b, c, d){
  const o=(p,q,r)=>Math.sign((q[0]-p[0])*(r[1]-p[1]) - (q[1]-p[1])*(r[0]-p[0]));
  return o(a,b,c)*o(a,b,d)<0 && o(c,d,a)*o(c,d,b)<0;
}
function selfIntersects(p){
  const n=p.length;
  for(let i=0;i<n;i++) for(let j=i+2;j<n;j++){
    if(i===0 && j===n-1) continue;
    if(segCross(p[i], p[(i+1)%n], p[j], p[(j+1)%n])) return true;
  }
  return false;
}
// garde la partie du contour où sign*(coord - c) >= 0 (ax : 0 = x, 1 = y)
function clipHalf(p, ax, c, sign){
  const out=[];
  for(let i=0;i<p.length;i++){
    const A=p[i], B=p[(i+1)%p.length], da=sign*(A[ax]-c), db=sign*(B[ax]-c);
    if(da>=0) out.push(A);
    if((da>=0)!==(db>=0)){ const t=da/(da-db); out.push([A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t]); }
  }
  return out;
}
function cleanPoly(p){
  const out=[];
  for(const q of p){
    const r=[Math.round(q[0]*16)/16, Math.round(q[1]*16)/16], l=out[out.length-1];
    if(!l || l[0]!==r[0] || l[1]!==r[1]) out.push(r);
  }
  if(out.length>1 && out[0][0]===out[out.length-1][0] && out[0][1]===out[out.length-1][1]) out.pop();
  return out;
}

/* ---------- \u00e9tape 5 : cultures et calendrier agricole ----------
   season : "winter" (sem\u00e9e \u00e0 l'automne, moissonn\u00e9e l'\u00e9t\u00e9 suivant), "spring" (sem\u00e9e au printemps),
            "meadow" (pr\u00e9 : pas de labour, on fauche), "rest" (jach\u00e8re).
   yield  : ressource produite ; sheaf : les c\u00e9r\u00e9ales sont moissonn\u00e9es en gerbes, battues ensuite \u00e0 la ferme.
   mul    : rendement relatif ; fertCost : ce que la culture prend au sol (n\u00e9gatif : elle le recharge). */
const CROP_DEFS = {
  wheat:  { id:"wheat", of:"du blé d'hiver",  name:"Bl\u00e9 d'hiver",   short:"Bl\u00e9",    icon:"\ud83c\udf3e", yield:"grain",  sheaf:"sh_grain",  season:"winter", fertCost:0.20, mul:1.0, cereal:true,
            desc:"Sem\u00e9 \u00e0 l'automne, moissonn\u00e9 l'\u00e9t\u00e9 suivant. Grain \u2192 moulin \u2192 pain. \u00c9puise le sol." },
  rye:    { id:"rye", of:"du seigle",    name:"Seigle",        short:"Seigle", icon:"\ud83c\udf3e", yield:"grain",  sheaf:"sh_grain",  season:"winter", fertCost:0.12, mul:0.85, cereal:true, hardy:true,
            desc:"C\u00e9r\u00e9ale d'hiver rustique : r\u00e9siste au gel et aux sols pauvres, rend un peu moins que le bl\u00e9." },
  barley: { id:"barley", of:"de l'orge", name:"Orge",          short:"Orge",   icon:"\ud83c\udf3e", yield:"barley", sheaf:"sh_barley", season:"spring", fertCost:0.10, mul:1.0, cereal:true,
            desc:"Sem\u00e9e au printemps. Orge \u2192 brasserie \u2192 ale." },
  oats:   { id:"oats", of:"de l'avoine",   name:"Avoine",        short:"Avoine", icon:"\ud83c\udf31", yield:"oats",   sheaf:"sh_oats",   season:"spring", fertCost:0.08, mul:1.0, cereal:true,
            desc:"Sem\u00e9e au printemps. Fourrage riche pour l'hiver des b\u00eates (1 avoine vaut 1,5 foin)." },
  flax:   { id:"flax", of:"du lin",   name:"Lin",           short:"Lin",    icon:"\ud83e\udebb", yield:"flax",   season:"spring", fertCost:0.15, mul:0.5,
            desc:"Sem\u00e9 au printemps, arrach\u00e9 l'\u00e9t\u00e9. Fibre pour le tailleur. Ne le remettez pas deux ans de suite." },
  peas:   { id:"peas", of:"des pois et fèves",   name:"Pois et f\u00e8ves", short:"Pois",   icon:"\ud83e\udedb", yield:"pulses", season:"spring", fertCost:-0.10, mul:0.8,
            desc:"Sem\u00e9s au printemps. Une nourriture qui se garde, et ils rechargent le sol." },
  hay:    { id:"hay", of:"du pré",    name:"Pr\u00e9 de fauche", short:"Pr\u00e9",    icon:"\ud83c\udf3f", yield:"hay",    season:"meadow", fertCost:0, mul:1.2,
            desc:"Pas de labour : l'herbe repousse seule chaque printemps, on la fauche en juin-juillet. Foin pour l'hiver des b\u00eates." },
  fallow: { id:"fallow", of:"de la jachère", name:"Jach\u00e8re",       short:"Jach\u00e8re", icon:"\ud83d\udfe4", yield:null,    season:"rest",   fertCost:-0.12, mul:0,
            desc:"Repos du sol : la fertilit\u00e9 remonte, davantage si un troupeau p\u00e2ture \u00e0 c\u00f4t\u00e9 (fumier)." },
};
const CROP_ORDER = ["wheat","rye","barley","oats","flax","peas","hay","fallow"];
// mois (0 = janvier) o\u00f9 l'on laboure, s\u00e8me, o\u00f9 la culture pousse (et \u00e0 quelle vitesse), o\u00f9 on la r\u00e9colte
const CROP_CAL = {
  winter: { plow:[7,8,9],    sow:[8,9], grow:{ 8:0.5, 9:0.5, 10:0.5, 2:1, 3:1, 4:1, 5:1 }, harvest:[6,7,8] },
  spring: { plow:[9,10,2,3], sow:[2,3], grow:{ 3:1, 4:1, 5:1, 6:1, 7:0.6 },               harvest:[7,8,9] },
  meadow: { plow:[],         sow:[],    grow:{ 3:1.3, 4:1.3, 5:1.3 },                     harvest:[5,6] },
  rest:   { plow:[],         sow:[],    grow:{},                                          harvest:[] },
};
const GROW_RATE = 0.0016;   // pousse par tick \u00e0 pleine vitesse : environ 4 mois pour m\u00fbrir
const SHEAF_RES = { sh_grain:"grain", sh_barley:"barley", sh_oats:"oats" };   // gerbes \u2192 grain battu
const FIELD_SIZES = [3,4,6];
const MONTHS_ABBR = ["janv.","f\u00e9vr.","mars","avril","mai","juin","juil.","ao\u00fbt","sept.","oct.","nov.","d\u00e9c."];
// \u00ab sept.\u2013oct. \u00bb pour une suite de mois
function monthsTxt(list){
  if(!list || !list.length) return "\u2014";
  return list.length===1 ? MONTHS_ABBR[list[0]] : MONTHS_ABBR[list[0]]+"\u2013"+MONTHS_ABBR[list[list.length-1]];
}

/* ---------- \u00e9tape 5 : \u00e9levage ----------
   area : cases d'herbe par b\u00eate adulte (un petit compte pour moiti\u00e9) ; fodder : foin par b\u00eate et par mois d'hiver ;
   adultAt / life : en mois ; litter : port\u00e9es possibles ; birthP : chance qu'une femelle mette bas dans l'ann\u00e9e ;
   mort : mortalit\u00e9 mensuelle d'une b\u00eate malade ; manure : fumier par b\u00eate et par mois pass\u00e9 \u00e0 l'abri. */
const LIVESTOCK = {
  sheep:  { id:"sheep",  name:"Moutons", one:"mouton", ones:"moutons", icon:"\ud83d\udc11", f:"Brebis", fs:"brebis", m:"B\u00e9lier", ms:"b\u00e9liers",
            young:"Agneau", youngs:"agneaux", area:0.5, fodder:0.25, adultAt:12, life:120, buy:4, sell:2, meat:1.5, litter:[1,1,2], birthP:0.85,
            mort:0.12, manure:0.25, disease:"la gale", birth:"Agnelage", job:["Berger","Berg\u00e8re"], shelter:"Bergerie",
            desc:"Laine \u00e0 la tonte de mai, un peu de viande. Peu exigeants en foin." },
  cattle: { id:"cattle", name:"Vaches", one:"vache", ones:"vaches", icon:"\ud83d\udc04", f:"Vache", fs:"vaches", m:"Taureau", ms:"taureaux",
            young:"Veau", youngs:"veaux", area:1.0, fodder:1.0, adultAt:24, life:180, buy:12, sell:6, meat:4, litter:[1], birthP:0.7,
            mort:0.08, manure:1.0, disease:"la fi\u00e8vre aphteuse", birth:"V\u00ealage", job:["Vacher","Vach\u00e8re"], shelter:"\u00c9table",
            desc:"Lait toute l'ann\u00e9e apr\u00e8s un v\u00ealage, beaucoup de fumier ; les jeunes taureaux deviennent des b\u0153ufs. Gros mangeurs de foin." },
  pig:    { id:"pig",    name:"Porcs", one:"porc", ones:"porcs", icon:"\ud83d\udc16", f:"Truie", fs:"truies", m:"Verrat", ms:"verrats",
            young:"Porcelet", youngs:"porcelets", area:0.5, fodder:0.4, adultAt:10, life:96, buy:4, sell:2, meat:3, litter:[2,3,4], birthP:0.5,
            mort:0.15, manure:0.4, disease:"le rouget", birth:"Mise bas", job:["Porcher","Porch\u00e8re"], shelter:"Soue",
            desc:"Prolifiques ; l'automne, le porcher les m\u00e8ne en for\u00eat manger les glands (gland\u00e9e) : ils s'engraissent pour l'abattage de novembre." },
};
const LIVESTOCK_ORDER = ["sheep","cattle","pig"];
const GRASS = [0, 0, 0.7, 1.1, 1.2, 1.1, 1.0, 0.9, 0.9, 0.8, 0.6, 0];   // herbe des p\u00e2turages selon le mois
const WINTER_MONTHS = [11, 0, 1];                                          // les b\u00eates mangent du foin
function isWinterMonth(m){ return m===11 || m===0 || m===1; }
const PASTURE_MIN = 4, PASTURE_MAX = 90;

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
const RES_ICONS                        = { timber:"🪵", firewood:"🔥", stone:"🪨", grain:"🌾", bread:"🍞", berries:"🍒", meat:"🍗", eggs:"🥚", veg:"🥕", apples:"🍎", honey:"🍯", clothes:"👕", ale:"🍺", barley:"🌾", ox:"🐂",
  oats:"🌱", flax:"🪻", pulses:"🫛", milk:"🥛", wool:"🧶", hay:"🌿", manure:"🟫", sh_grain:"🎋", sh_barley:"🎋", sh_oats:"🎋" };

/* ---------- étape 4 : villageois individuels ---------- */
const SURNAMES = ["Lefèvre","Charpentier","Dubois","Meunier","Fournier","Mercier","Bouvier","Berger","Tisserand","Lebrun",
  "Leroux","Moreau","Fontaine","Desprez","Delorme","Vasseur","Marchand","Picard","Lenoir","Pasquier","Fauvel","Taillefer",
  "Brisebois","Lacombe","Rivière","Granger","Vigneron","Chaumont"];
const NAMES_M = ["Aldéric","Baudouin","Colin","Eudes","Gaultier","Guillaume","Hugues","Jehan","Josselin","Lambert","Mathieu",
  "Nicaise","Odon","Perrot","Raoul","Renaud","Robin","Thibaut","Yvon","Enguerrand","Arnaud","Bertrand","Étienne","Garnier"];
const NAMES_F = ["Adèle","Alips","Aude","Béatrice","Berthe","Clémence","Ermengarde","Guillemette","Hersende","Isabeau","Jehanne",
  "Jourdaine","Mahaut","Margot","Perrine","Sanceline","Thomasse","Ysabel","Agnès","Aliénor","Blanche","Héloïse","Ide","Sibylle"];
// âges charnières : enfant < 12 ≤ adolescent (apprenti possible) < 16 ≤ adulte < 55 ≤ ancien ; retraite à 65 ans
const AGE_TEEN = 12, AGE_ADULT = 16, AGE_ELDER = 55, AGE_RETIRE = 65;
const STAGE_NAMES = { baby:"Nourrisson", child:"Enfant", teen:"Adolescent", adult:"Adulte", elder:"Ancien" };
// nourriture par mois selon l'âge (une famille de l'ancienne version mangeait 1 ; un foyer type mange à peu près autant)
const FOOD_NEED = { baby:0.1, child:0.2, teen:0.3, adult:0.35, elder:0.3 };
const SKILL_DEFS = {
  farm:   { id:"farm",   name:"Champs" },
  wood:   { id:"wood",   name:"Bois" },
  gather: { id:"gather", name:"Cueillette" },
  hunt:   { id:"hunt",   name:"Chasse" },
  stone:  { id:"stone",  name:"Pierre" },
  craft:  { id:"craft",  name:"Artisanat" },
  trade:  { id:"trade",  name:"Commerce" },
  build:  { id:"build",  name:"Construction" },
  herd:   { id:"herd",   name:"Élevage" },
};
const SKILL_ORDER = ["farm","wood","gather","hunt","stone","craft","trade","build","herd"];
const SKILL_LEVELS = ["Novice","Initié","Compagnon","Confirmé","Maître"]; // tranches de 20 points
function skillLevel(s){ return SKILL_LEVELS[Math.max(0, Math.min(4, Math.floor((Number(s)||0)/20)))]; }
// métier exercé dans chaque bâtiment (masculin, féminin)
const JOB_TITLES = {
  woodcutter:["Bûcheron","Bûcheronne"], forager:["Cueilleur","Cueilleuse"], hunter:["Chasseur","Chasseresse"],
  quarry:["Tailleur de pierre","Tailleuse de pierre"], farm:["Fermier","Fermière"], windmill:["Meunier","Meunière"],
  market:["Marchand","Marchande"], trade:["Négociant","Négociante"],
};

                                                                                                                                       

                    
                                                                
                                                   
                                                 
               
 

                  
                                                   
                                      
                                                        
               
                                                                               
                                   
                                                                   
 

                                                                                  

                                                                 
                                                                                                                               

const WORK_TIME                        = { chop:14, gather:14, hunt:12, mine:20 };
const FIELD_TASKS = { plow:1, spread:1, sow:1, harvest:1, mow:1 };   // étape 5 : travaux des champs

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
    this.prices = { bread:2, clothes:3, ale:2, apples:1, honey:4, meat:1, berries:1, wool:2 };
    this.occupied = new Int32Array(W*H).fill(-1);
    this.buildings = []; this.nextB = 1;
    this.families = []; this.nextF = 1;      // foyers (une maison, une marmite)
    this.villagers = []; this.nextV = 1;     // étape 4 : chaque habitant, avec son âge, ses compétences, sa santé
    this.approvalWhy = [];                    // détail de l'approbation du dernier mois [libellé, effet]
    this.deer = []; this.nextD = 1; this.deerTimer = 0;
    this.camps = []; this.nextC = 1;
    this.units = []; this.nextU = 1;
    this.stock = { timber:15, firewood:12, stone:0, grain:0, bread:6, berries:40, meat:25, eggs:0, veg:0, apples:0, honey:0, clothes:2, ale:0, barley:0, ox:0,
                   oats:0, flax:0, pulses:0, milk:0, wool:0, hay:6, manure:0, sh_grain:0, sh_barley:0, sh_oats:0 };   // une petite meule de foin pour le bœuf
    this.oxen = []; this.nextA = 1;           // étape 5 : bœufs de trait ; identifiants des bêtes
    this.wx = null;                            // étape 5 : aléa agricole du mois (drought | wet | null)
    this.pastureCell = new Uint8Array(W*H);   // étape 5 : cases de pâturage (franchissables)
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

  // Départ façon Manor Lords : un campement de survivants, le poteau du bœuf et un bout de chemin.
  // Aucune maison : le joueur trace sa première zone le long du chemin.
  placeStart(){
    const cx = Math.floor(W/2), cy = Math.floor(H/2);
    const free = (x,y)=>x>=0&&y>=0&&x<W&&y<H && this.tiles[y*W+x]===T_GRASS && this.occupied[y*W+x]<0 && this.regionOwned(x);
    let spot = null;
    for(let r=0; r<10 && !spot; r++) for(let dy=-r; dy<=r && !spot; dy++) for(let dx=-r; dx<=r && !spot; dx++){
      const x=cx+dx, y=cy+dy;
      let ok = true;
      for(let k=-3; k<=5 && ok; k++){ if(!free(x+k, y+1)) ok=false; if(k>=0 && k<=2 && !free(x+k, y)) ok=false; }
      if(ok) spot = { x, y };
    }
    if(!spot) spot = { x:cx, y:cy };
    const camp = this.makeBuilding("camp", spot.x, spot.y); camp.done = true; camp.progress = 1;
    if(free(spot.x+2, spot.y)){ const post = this.makeBuilding("oxpost", spot.x+2, spot.y); post.done = true; post.progress = 1; }
    for(let k=-3; k<=5; k++) if(free(spot.x+k, spot.y+1)) this.roads[(spot.y+1)*W+spot.x+k] = 1;
    this.oxen = [this.makeOx(60)];   // un bœuf de cinq ans au poteau
    this.syncOx();
    // trois familles de survivants : un couple avec un adolescent et un enfant, un jeune couple avec un petit,
    // un ancien avec un jeune adulte encore célibataire et un adolescent
    const kinds = ["family", "young", "elder"];
    for(let n=0; n<3; n++){
      const f = this.makeFamily(); f.home = camp.id;
      f.founder = true; // survivants du départ : ils ne quittent jamais la seigneurie
      this.populateFamily(f, kinds[n], spot.x+0.5+n*0.6, spot.y+0.8);
    }
    this.toast("Les survivants campent au bord du chemin. Tracez une zone de maisons le long de la route (tiroir Maisons).");
  }

  // Les familles du campement emménagent dès qu'une maison est prête ; le campement vide est démonté.
  rehouseCamp(){
    const camp = this.buildings.find(b=>b.def==="camp"); if(!camp) return;
    for(const f of this.families){
      if(f.home!==camp.id) continue;
      const fb = this.buildings.find(bd=>bd.done && bd.def==="burgage" && !this.families.some(o=>o.home===bd.id));
      if(!fb) break;
      f.home = fb.id;
      this.toast("Une famille quitte le campement pour sa maison.","good");
    }
    if(!this.families.some(f=>f.home===camp.id)){
      for(let yy=0;yy<camp.h;yy++) for(let xx=0;xx<camp.w;xx++) if(this.occupied[(camp.y+yy)*W+camp.x+xx]===camp.id) this.occupied[(camp.y+yy)*W+camp.x+xx] = -1;
      this.buildings.splice(this.buildings.indexOf(camp), 1);
      this.toast("Toutes les familles sont logées : le campement est démonté.","good");
    }
    this.uiVersion++;
  }


  /* ---------- fabriques ---------- */
  makeBuilding(def       , x       , y       )         {
    const d = BUILD_DEFS[def];
    const b          = { id:this.nextB++, def, x, y, w:d.w, h:d.h, done:false, progress:0, want:0, lvl:1, exts:[], monthsGood:0, f:null };
    if(def==="field"){
      let s=0; for(let yy=0;yy<d.h;yy++) for(let xx=0;xx<d.w;xx++) s += this.soil[(y+yy)*W+(x+xx)];
      b.f = this.normField({ fert: Math.min(1, s/(d.w*d.h)), crop:this.defaultCrop() });
    }
    this.buildings.push(b);
    for(let yy=0;yy<d.h;yy++) for(let xx=0;xx<d.w;xx++) this.occupied[(y+yy)*W+(x+xx)] = b.id;
    return b;
  }

  // un foyer : une maison, une marmite, un nom ; ses membres sont dans this.villagers (v.fam)
  makeFamily(surname        ){
    let sn = surname;
    if(!sn){
      const used = new Set(this.families.map(f=>this.surnameOf(f)));
      const free = SURNAMES.filter(n=>!used.has(n));
      const pool = free.length ? free : SURNAMES;
      sn = pool[Math.floor(this.rnd()*pool.length)];
    }
    const f = { id:this.nextF++, name:"Famille "+sn, home:-1, starving:0, lastAte:1, fed:1, lastVariety:1, clothCool:0 };
    this.families.push(f);
    return f;
  }
  surnameOf(f){ return f && typeof f.name==="string" ? f.name.replace(/^Famille\s+/, "") : "?"; }

  /* ---------- étape 4 : les villageois ---------- */
  monthIdx(){ return this.time.year*12 + this.time.month; }
  // nourriture mangée chaque mois par tout le village
  foodNeed(){ return this.villagers.reduce((s, v)=>s+FOOD_NEED[this.stageOf(v)], 0); }
  ageOf(v){ return Math.max(0, Math.floor((this.monthIdx() - (Number(v.bornAt)||0))/12)); }
  stageOf(v){
    const a = this.ageOf(v);
    return a<3 ? "baby" : a<AGE_TEEN ? "child" : a<AGE_ADULT ? "teen" : a<AGE_ELDER ? "adult" : "elder";
  }
  isAdult(v){ const s=this.stageOf(v); return s==="adult" || s==="elder"; }
  famOf(v){ return this.families.find(f=>f.id===v.fam) || null; }
  membersOf(fid){ return this.villagers.filter(v=>v.fam===fid); }
  villager(id){ return this.villagers.find(v=>v.id===id) || null; }
  fullName(v){ return v ? v.first+" "+this.surnameOf(this.famOf(v)) : "?"; }
  homeOf(v){ const f=this.famOf(v); return f && f.home>0 ? this.buildings.find(b=>b.id===f.home) || null : null; }
  // peut tenir un poste : adulte ou ancien de moins de 65 ans, pas alité
  canWork(v){
    const s=this.stageOf(v);
    return (s==="adult" || (s==="elder" && this.ageOf(v)<AGE_RETIRE)) && !(v.sick>0) && v.health>=25;
  }
  workersOf(b){ return this.villagers.filter(v=>v.work===b.id && !v.appr); }
  apprenticeOf(b){ return this.villagers.find(v=>v.work===b.id && v.appr) || null; }
  jobSkill(b){ const d=b && BUILD_DEFS[b.def]; return d && d.skill ? d.skill : null; }
  bestSkill(v){ let k="build", m=-1; for(const s of SKILL_ORDER){ const x=v.skills[s]||0; if(x>m){ m=x; k=s; } } return k; }
  jobTitle(v){
    const b = v.work>0 ? this.buildings.find(x=>x.id===v.work) : null;
    // étape 5 : le gardien d'un pâturage prend le nom de ses bêtes (berger, vacher, porcher)
    const t = b && (b.def==="pasture" ? (LIVESTOCK[b.herd && b.herd.sp] || { job:["Gardien","Gardienne"] }).job : JOB_TITLES[b.def]);
    return t ? t[v.sex==="f" ? 1 : 0] : null;
  }
  // vitesse de travail : 0,75 pour un novice, 1,25 pour un maître ; moins pour un ancien, un apprenti, un malade
  skillMul(v, skill){
    let m = 0.75 + 0.5*Math.max(0, Math.min(100, (v.skills && v.skills[skill]) || 0))/100;
    if(this.stageOf(v)==="elder") m *= 0.75;
    if(v.appr) m *= 0.5;
    if(v.health<50) m *= 0.85;
    return m;
  }
  noteWork(v, skill){ if(!v.wt) v.wt = {}; v.wt[skill] = (v.wt[skill]||0) + 1; }

  // un prénom que personne ne porte encore dans la seigneurie (sinon, au moins pas dans la famille)
  pickName(sex, fid){
    const pool = sex==="f" ? NAMES_F : NAMES_M;
    const village = new Set(this.villagers.map(o=>o.first));
    const family = new Set(this.villagers.filter(o=>o.fam===fid).map(o=>o.first));
    let list = pool.filter(n=>!village.has(n));
    if(!list.length) list = pool.filter(n=>!family.has(n));
    if(!list.length) list = pool;
    return list[Math.floor(this.rnd()*list.length)];
  }
  // un nouveau villageois ; age en années, skills = compétences de départ (0 à 100)
  makePerson(fam, sex, age, opts){
    opts = opts || {};
    const r = this.rnd;
    const skills = {};
    for(const s of SKILL_ORDER) skills[s] = 0;
    if(age>=AGE_ADULT){
      // un adulte sait déjà un peu de tout, et beaucoup d'une ou deux choses
      for(const s of SKILL_ORDER) skills[s] = Math.round(4 + r()*14);
      const n = age>=24 ? 2 : 1;
      for(let k=0;k<n;k++){ const s=SKILL_ORDER[Math.floor(r()*SKILL_ORDER.length)]; skills[s] = Math.max(skills[s], Math.round(25 + r()*Math.min(45, (age-16)*2.5))); }
    } else if(age>=8){
      for(const s of SKILL_ORDER) skills[s] = Math.round(r()*8);
    }
    const v = {
      id:this.nextV++, fam:fam.id, first:opts.first || this.pickName(sex, fam.id), sex,
      bornAt: this.monthIdx() - age*12 - Math.floor(r()*12),
      skills, health:100, sick:0, spouse:-1, mother:opts.mother||-1, father:opts.father||-1,
      work:-1, appr:false, grief:0, griefFor:"", joy:0, joyFor:"", mood:this.approval, why:[], wt:{},
      x:opts.x!==undefined ? opts.x : W/2, y:opts.y!==undefined ? opts.y : H/2,
      path:null, state:"idle", timer:0, task:null, carry:null, cool:Math.floor(r()*20),
    };
    this.villagers.push(v);
    return v;
  }
  marry(a, b){ a.spouse = b.id; b.spouse = a.id; }
  // compose un foyer type autour d'un point de départ
  populateFamily(f, kind, x, y){
    const r = this.rnd, sx = ()=>r()<0.5 ? "m" : "f";
    const at = (k)=>({ x:x + (k%3)*0.35, y:y + Math.floor(k/3)*0.3 });
    let k = 0;
    const mk = (sex, age, o)=>this.makePerson(f, sex, age, Object.assign(at(k++), o||{}));
    const couple = (a0, a1)=>{ const h=mk("m", a0), w=mk("f", a1); this.marry(h, w); return [h, w]; };
    const kids = (h, w, ages)=>ages.forEach(a=>mk(sx(), a, { mother:w.id, father:h.id }));
    if(kind==="family"){ const [h,w]=couple(31+Math.floor(r()*7), 28+Math.floor(r()*6)); kids(h, w, [13+Math.floor(r()*3), 5+Math.floor(r()*5)]); }
    else if(kind==="young"){ const [h,w]=couple(22+Math.floor(r()*5), 20+Math.floor(r()*5)); kids(h, w, [Math.floor(r()*3)]); }
    else if(kind==="elder"){
      const e = mk(sx(), 56+Math.floor(r()*7));
      mk(e.sex==="m" ? "f" : "m", 18+Math.floor(r()*5), e.sex==="m" ? { father:e.id } : { mother:e.id });
      mk(sx(), 12+Math.floor(r()*3), e.sex==="m" ? { father:e.id } : { mother:e.id });
    }
    else if(kind==="couple"){ const [h,w]=couple(18+Math.floor(r()*8), 17+Math.floor(r()*8)); }
    else if(kind==="single"){ mk(sx(), 19+Math.floor(r()*14)); }
    else if(kind==="parents"){ const [h,w]=couple(24+Math.floor(r()*12), 22+Math.floor(r()*12)); mk(sx(), 52+Math.floor(r()*10)); kids(h, w, [Math.floor(r()*9)]); }
    else { // foyer courant : un couple et 0 à 2 enfants
      const [h,w]=couple(25+Math.floor(r()*14), 23+Math.floor(r()*13));
      const n = Math.floor(r()*3), ages = [];
      for(let i=0;i<n;i++) ages.push(Math.floor(r()*13));
      kids(h, w, ages);
    }
    return this.membersOf(f.id);
  }
  // composition tirée au hasard pour une famille qui arrive
  randomFamilyKind(){
    const x = this.rnd();
    return x<0.55 ? "household" : x<0.75 ? "couple" : x<0.9 ? "single" : "parents";
  }
  // retire un foyer et tous ses membres (départ)
  removeFamily(fid){
    for(const v of this.membersOf(fid)) this.dropVillager(v);
    this.families = this.families.filter(x=>x.id!==fid);
  }
  // retire un villageois de la simulation (décès ou départ) sans aucun message
  dropVillager(v){
    const i = this.villagers.indexOf(v); if(i<0) return;
    this.villagers.splice(i, 1);
    for(const o of this.villagers){
      if(o.spouse===v.id) o.spouse = -1;
    }
    if(v.task && v.task.type==="hunt"){ const d=this.deer.find(dd=>dd.id===v.task.deer); if(d) d.frozen = false; }
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
  // journaliers : adultes sans poste, qui bâtissent les chantiers
  unemployed(){ return this.villagers.filter(v=>v.work<0 && !v.appr && this.canWork(v)).length; }

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
    for(const v of this.villagers) if(v.work===b.id){ v.work=-1; v.appr=false; this.resetWorker(v); }
    for(const f of this.families) if(f.home===b.id) f.home = -1;
    this.buildings.splice(idx,1);
    // un pâturage démoli : la clôture est remboursée à moitié, les bêtes sont vendues
    if(b.def==="pasture"){
      if(b.plot) this.stock.timber += Math.floor(this.pastureCost(b.plot.cells)/2);
      const h = b.herd, ld = h && LIVESTOCK[h.sp];
      if(ld && h.an.length){
        const earn = h.an.reduce((s, a)=>s + (a.a>=ld.adultAt ? ld.sell : ld.sell/2), 0);
        this.treasury += Math.round(earn);
        this.toast("Pâturage démoli : "+h.an.length+" "+(h.an.length>1 ? ld.ones : ld.one)+" vendu"+(h.an.length>1?"s":"")+" (+"+Math.round(earn)+" 💰).");
      } else this.toast("Pâturage démoli (moitié de la clôture remboursée)");
      this.markPastures();
      this.uiVersion++;
      return;
    }
    this.toast(d.name+" démoli (moitié du coût remboursée)");
  }

  /* ---------- étape 3 : zones de bourgage tracées point par point ---------- */
  // Découpe un contour libre en parcelles SANS rien modifier (sert aussi d'aperçu à l'interface).
  // pts : points du contour en cases (calés au quart de case). n : nombre de maisons voulu (sinon proposé).
  planZone(pts        , n        ){
    const fail = (err, extra)=>Object.assign({ plots:[], err, limited:false, n:0, nMin:0, nMax:0, suggested:0, poly:null }, extra||{});
    if(!Array.isArray(pts) || pts.length<3) return fail("Posez au moins 3 points");
    const poly = pts.map(q=>[Math.max(0, Math.min(W, Math.round(Number(q[0])*SNAP)/SNAP)),
                             Math.max(0, Math.min(H, Math.round(Number(q[1])*SNAP)/SNAP))]);
    if(poly.some(q=>!isFinite(q[0]) || !isFinite(q[1]))) return fail("Contour invalide");
    if(selfIntersects(poly)) return fail("Le contour se croise", { poly });
    // cases couvertes : celles dont le centre est dans le contour
    let x0=W, y0=H, x1=0, y1=0;
    for(const q of poly){ x0=Math.min(x0,q[0]); y0=Math.min(y0,q[1]); x1=Math.max(x1,q[0]); y1=Math.max(y1,q[1]); }
    const inside = [];
    for(let y=Math.max(0,Math.floor(y0)); y<Math.min(H,Math.ceil(y1)); y++) for(let x=Math.max(0,Math.floor(x0)); x<Math.min(W,Math.ceil(x1)); x++){
      if(!pointInPoly(x+0.5, y+0.5, poly)) continue;
      const i=y*W+x;
      if(this.roads[i]) return fail("La zone empiète sur une route", { poly });
      if(this.occupied[i]>=0) return fail("La zone empiète sur un bâtiment", { poly });
      if(this.tiles[i]!==T_GRASS) return fail("Terrain impropre dans la zone (eau, forêt ou rocher)", { poly });
      if(!this.regionOwned(x)) return fail("Région non réclamée", { poly });
      inside.push(i);
    }
    if(inside.length<2) return fail("Zone trop petite", { poly });
    // façade : cases de la zone qui touchent la route, du côté le plus représenté
    const byDir=[[],[],[],[]];
    for(const i of inside){
      const x=i%W, y=(i/W)|0;
      for(let d=0;d<4;d++) if(this.roadAt(x+DIRS4[d][0], y+DIRS4[d][1])){ byDir[d].push(i); break; }
    }
    let dir=0; for(let d=1;d<4;d++) if(byDir[d].length>byDir[dir].length) dir=d;
    if(byDir[dir].length===0) return fail("La zone doit longer une route", { poly });
    const ax = (dir===0 || dir===2) ? 0 : 1;           // route au nord/sud : façade le long de x
    const axis = (i)=>ax===0 ? i%W : (i/W)|0;
    const front = new Map();
    for(const i of byDir[dir]){ const a=axis(i); if(!front.has(a)) front.set(a, i); }
    const keys = Array.from(front.keys()).sort((a,b)=>a-b);
    const runs = [];
    for(const a of keys){ const r=runs[runs.length-1]; if(r && a===r.end) r.end++; else runs.push({ start:a, end:a+1 }); }
    const nMin = runs.length, nMax = keys.length;
    const suggested = runs.reduce((s,r)=>s + Math.max(1, Math.min(r.end-r.start, Math.round((r.end-r.start)/PLOT_FRONT))), 0);
    let want = Number.isInteger(n) ? Math.max(nMin, Math.min(nMax, n)) : suggested;
    const c = BUILD_DEFS.burgage.cost;
    const afford = Math.min(c.timber ? Math.floor((this.stock.timber||0)/c.timber) : Infinity,
                            c.stone ? Math.floor((this.stock.stone||0)/c.stone) : Infinity);
    const info = { poly, nMin, nMax, suggested };
    let limited = false;
    if(want>afford){ want = Math.max(0, afford); limited = true; }
    if(want<=0) return fail("Ressources insuffisantes", Object.assign({ limited:true }, info));
    const use = want<runs.length ? runs.slice(0, want) : runs;
    // une maison par façade, puis on en ajoute là où les parcelles sont les plus larges
    const k = use.map(()=>1);
    for(let left=want-use.length; left>0; left--){
      let best=-1, bw=-1;
      use.forEach((r,j)=>{ const L=r.end-r.start; if(k[j]<L && L/k[j]>bw){ bw=L/k[j]; best=j; } });
      if(best<0) break; k[best]++;
    }
    // limites entre parcelles : perpendiculaires à la route, sur les bords de case
    const cuts = [];
    use.forEach((r,j)=>{
      const L=r.end-r.start;
      for(let q=1;q<k[j];q++) cuts.push(Math.round(r.start + q*L/k[j]));
      if(j<use.length-1) cuts.push(Math.round((r.end + use[j+1].start)/2));
    });
    const plots = [];
    for(let sI=0; sI<=cuts.length; sI++){
      const lo = sI===0 ? -Infinity : cuts[sI-1], hi = sI===cuts.length ? Infinity : cuts[sI];
      const fr = keys.filter(a=>a>=lo && a<hi);
      if(fr.length===0) continue;
      const house = front.get(fr[Math.floor((fr.length-1)/2)]);
      const cells = [house].concat(inside.filter(i=>i!==house && axis(i)>=lo && axis(i)<hi));
      let pp = poly;
      if(isFinite(lo)) pp = clipHalf(pp, ax, lo, 1);
      if(isFinite(hi)) pp = clipHalf(pp, ax, hi, -1);
      plots.push({ cells, dir, poly:cleanPoly(pp) });
    }
    return { plots, err:null, limited, n:plots.length, nMin, nMax, suggested, poly };
  }

  // Point du contour « aimanté » : collé au bord d'une route à moins d'une demi-case,
  // et un trait presque parallèle à la route reste bien droit (prev = point précédent).
  snapZonePoint(x        , y        , prev        ){
    const R = 0.5;
    let sx = Math.round(x*SNAP)/SNAP, sy = Math.round(y*SNAP)/SNAP, bx = null, by = null, bdx = R, bdy = R;
    const tx = Math.floor(x), ty = Math.floor(y);
    for(let yy=ty-1; yy<=ty+1; yy++) for(let xx=tx-1; xx<=tx+1; xx++){
      if(!this.roadAt(xx, yy)) continue;
      if(x>=xx-0.25 && x<=xx+1.25) for(const [ly, ny] of [[yy, yy-1], [yy+1, yy+1]])
        if(!this.roadAt(xx, ny)){ const d=Math.abs(y-ly); if(d<bdy){ bdy=d; by=ly; } }
      if(y>=yy-0.25 && y<=yy+1.25) for(const [lx, nx] of [[xx, xx-1], [xx+1, xx+1]])
        if(!this.roadAt(nx, yy)){ const d=Math.abs(x-lx); if(d<bdx){ bdx=d; bx=lx; } }
    }
    if(by!==null) sy = by;
    if(bx!==null) sx = bx;
    if(prev && Array.isArray(prev)){
      const edgeH = (p)=>Number.isInteger(p[1]) && [Math.floor(p[0]), Math.floor(p[0]-0.01)].some(c=>this.roadAt(c, p[1]-1)!==this.roadAt(c, p[1]));
      const edgeV = (p)=>Number.isInteger(p[0]) && [Math.floor(p[1]), Math.floor(p[1]-0.01)].some(c=>this.roadAt(p[0]-1, c)!==this.roadAt(p[0], c));
      if(by===null && edgeH(prev) && Math.abs(y-prev[1])<0.6 && Math.abs(x-prev[0])>=1) sy = prev[1];
      if(bx===null && edgeV(prev) && Math.abs(x-prev[0])<0.6 && Math.abs(y-prev[1])>=1) sx = prev[0];
    }
    return [Math.max(0, Math.min(W, sx)), Math.max(0, Math.min(H, sy))];
  }

  // Trace la zone : une maison en chantier par parcelle, bâtie par les journaliers.
  traceZone(pts        , n        )               {
    const plan = this.planZone(pts, n);
    if(plan.err) return plan.err;
    const c = BUILD_DEFS.burgage.cost;
    for(const p of plan.plots){
      this.stock.timber -= (c.timber||0);
      this.stock.stone -= (c.stone||0);
      const h = p.cells[0];
      const b = this.makeBuilding("burgage", h%W, (h/W)|0);
      b.plot = { cells:p.cells.slice(), dir:p.dir, poly:p.poly };
      for(const i of p.cells) this.occupied[i] = b.id;
    }
    const nb = plan.plots.length;
    this.toast(nb+" parcelle"+(nb>1?"s":"")+" tracée"+(nb>1?"s":"")+" : les journaliers bâtissent les maisons."
      +(plan.limited?" (bois insuffisant pour toute la zone)":""), "good");
    this.uiVersion++;
    return null;
  }

  // arrière-cour d'un bourgage tracé : ses cases hors maison, et le rendement qu'elle permet
  yardCells(b         )           { return b.plot ? b.plot.cells.slice(1) : []; }
  yardSize(b         )         { return b.plot ? b.plot.cells.length-1 : 0; }
  // 1 case → ×1, 4 cases → ×1,5, 9 cases → ×2, plafonné à ×2,5 : plus grand rapporte plus, mais de moins en moins
  yardFactor(b         )         {
    if(!b.plot) return 1;
    const n = this.yardSize(b);
    return n<=0 ? 0 : Math.min(2.5, 0.5 + 0.5*Math.sqrt(n));
  }
  // retire l'agrandissement d'une arrière-cour (moitié du prix rendue)
  removeExtension(bid       ){
    const b = this.buildings.find(x=>x.id===bid);
    if(!b || !b.plot || b.exts.length===0) return;
    const d = EXT_DEFS[b.exts[0]];
    if(d) for(const k of Object.keys(d.cost)) this.stock[k] = (this.stock[k]||0) + Math.floor(d.cost[k]/2);
    b.exts = [];
    this.toast("Arrière-cour libérée"+(d ? " ("+d.name+" retiré)" : "")+".");
    this.uiVersion++;
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

  /* ---------- étape 4 : postes de travail, un par adulte ----------
     b.want = nombre d'ouvriers voulus. Le jeu y place tout seul l'adulte libre le plus compétent,
     tout de suite s'il y en a un, sinon dès qu'il y en a un (adolescent devenu adulte, nouvel arrivant…). */
  // note d'un candidat pour un poste : sa compétence, un peu moins pour un ancien
  jobScore(v, skill){ return ((v.skills && v.skills[skill]) || 0) * (this.stageOf(v)==="elder" ? 0.75 : 1); }
  freeAdults(){ return this.villagers.filter(v=>v.work<0 && !v.appr && this.canWork(v)); }
  // pourvoit les postes voulus d'un bâtiment (ou de tous) ; renvoie le nombre d'embauches
  fillJobs(only){
    let n = 0;
    for(const b of this.buildings){
      if(only && b!==only) continue;
      const d = BUILD_DEFS[b.def]; if(!d || d.fam<=0) continue;
      const want = Math.max(0, Math.min(d.fam, Number(b.want)||0));
      let have = this.workersOf(b).length;
      while(have<want){
        const free = this.freeAdults(); if(!free.length) return n;
        const sk = d.skill || "build";
        free.sort((a, c)=>this.jobScore(c, sk) - this.jobScore(a, sk) || a.id - c.id);
        const v = free[0];
        v.work = b.id; this.resetWorker(v); have++; n++;
      }
    }
    if(n) this.uiVersion++;
    return n;
  }
  // + : un ouvrier de plus (le plus compétent des adultes libres)
  assign(bid       ){
    const b = this.buildings.find(x=>x.id===bid); if(!b) return false;
    const d = BUILD_DEFS[b.def];
    if(d.fam<=0) return false;
    const have = this.workersOf(b).length;
    if(have>=d.fam) return false;
    b.want = Math.min(d.fam, Math.max(Number(b.want)||0, have) + 1);
    const n = this.fillJobs(b);
    if(!n) this.toast("Aucun adulte libre : le poste sera pourvu dès que quelqu'un se libère.");
    this.uiVersion++;
    return n>0;
  }
  // − : un ouvrier de moins (le moins compétent repart comme journalier)
  unassign(bid       ){
    const b = this.buildings.find(x=>x.id===bid); if(!b) return;
    const ws = this.workersOf(b);
    b.want = Math.max(0, Math.min(Number(b.want)||0, ws.length) - 1);
    if(ws.length>b.want && ws.length){
      const sk = this.jobSkill(b) || "build";
      ws.sort((a, c)=>this.jobScore(a, sk) - this.jobScore(c, sk) || c.id - a.id);
      const v = ws[0]; v.work = -1; this.resetWorker(v);
    }
    this.uiVersion++;
  }
  // affectation à la main depuis la fiche d'un villageois (bid < 0 : redevient journalier)
  assignVillager(vid, bid){
    const v = this.villager(vid); if(!v) return "Villageois introuvable";
    if(bid>0){
      const b = this.buildings.find(x=>x.id===bid); if(!b) return "Bâtiment introuvable";
      const d = BUILD_DEFS[b.def];
      if(!d || d.fam<=0) return "Ce bâtiment n'emploie personne";
      if(!this.canWork(v)) return this.stageOf(v)==="elder" ? "Trop âgé pour travailler" : (v.sick>0 || v.health<25 ? "Trop faible pour travailler" : "Trop jeune pour travailler");
      if(v.work===bid && !v.appr) return null;
      if(this.workersOf(b).length>=d.fam) return "Plus de place : "+d.name+" est complet";
      this.leaveJob(v);
      v.work = bid; v.appr = false; this.resetWorker(v);
      b.want = Math.max(Number(b.want)||0, this.workersOf(b).length);
      this.toast(this.fullName(v)+" travaille désormais : "+d.name+".");
    } else {
      if(v.work<0) return null;
      this.leaveJob(v);
      this.toast(this.fullName(v)+(v.appr ? " quitte son apprentissage." : " redevient journalier."));
      v.appr = false;
    }
    this.uiVersion++;
    return null;
  }
  // quitte son poste ; le bâtiment ne cherche pas à le remplacer (choix du joueur)
  leaveJob(v){
    const b = v.work>0 ? this.buildings.find(x=>x.id===v.work) : null;
    if(b && !v.appr) b.want = Math.max(0, Math.min(Number(b.want)||0, this.workersOf(b).length) - 1);
    v.work = -1; this.resetWorker(v);
  }
  // apprentissage : un adolescent (12-15 ans) par atelier, formé par le meilleur ouvrier du lieu
  canApprentice(v){ const a=this.ageOf(v); return a>=AGE_TEEN && a<AGE_ADULT && !(v.sick>0); }
  takeApprentice(bid, vid){
    const b = this.buildings.find(x=>x.id===bid); if(!b) return "Bâtiment introuvable";
    if(!this.jobSkill(b)) return "Pas d'apprentissage ici";
    if(this.apprenticeOf(b)) return "Il y a déjà un apprenti";
    let v = vid ? this.villager(vid) : null;
    if(vid && !v) return "Villageois introuvable";
    if(v && !this.canApprentice(v)) return "Seul un adolescent de 12 à 15 ans peut être apprenti";
    if(!v){
      const sk = this.jobSkill(b);
      const c = this.villagers.filter(o=>this.canApprentice(o) && (o.work<0 || !o.appr));
      if(!c.length) return "Aucun adolescent disponible";
      c.sort((a, d)=>(d.skills[sk]||0)-(a.skills[sk]||0) || this.ageOf(d)-this.ageOf(a));
      v = c[0];
    }
    v.work = b.id; v.appr = true; this.resetWorker(v);
    const m = this.masterOf(b), sk = this.jobSkill(b);
    this.toast(this.fullName(v)+" entre en apprentissage : "+BUILD_DEFS[b.def].name
      +(m && (m.skills[sk]||0)>=40 ? ", auprès de "+this.fullName(m)+"." : " (sans maître confirmé : "+(v.sex==="f"?"elle":"il")+" apprendra lentement)."));
    this.uiVersion++;
    return null;
  }
  dropApprentice(bid){
    const b = this.buildings.find(x=>x.id===bid); if(!b) return;
    const a = this.apprenticeOf(b); if(!a) return;
    a.work = -1; a.appr = false; this.resetWorker(a);
    this.uiVersion++;
  }
  // le maître d'un atelier : son ouvrier le plus compétent
  masterOf(b){
    const sk = this.jobSkill(b); if(!sk) return null;
    let best = null;
    for(const v of this.workersOf(b)) if(!best || (v.skills[sk]||0)>(best.skills[sk]||0)) best = v;
    return best;
  }
  resetWorker(f       ){ f.task=null; f.path=null; f.state="idle"; f.carry=null; f.timer=0; f.cool=0; }

  setTax(v       ){ this.taxRate = Math.max(0, Math.min(1, v)); this.uiVersion++; }

  /* ================= étape 5 : bœufs de trait ================= */
  makeOx(age){ return { id:this.nextA++, a:age, h:100 }; }
  syncOx(){ this.stock.ox = this.oxen.length; }
  buyOx(){
    if(this.treasury < 20){ this.toast("Il faut 20 deniers pour acheter un bœuf.","bad"); return false; }
    this.treasury -= 20; this.oxen.push(this.makeOx(36)); this.syncOx();
    this.toast("Un bœuf de trois ans rejoint l'attelage ! Les labours iront plus vite.","good");
    this.uiVersion++;
    return true;
  }
  // réforme le plus vieux bœuf : il finit chez le boucher
  retireOx(){
    if(!this.oxen.length) return false;
    const o = this.oxen.reduce((a, b)=>b.a>a.a ? b : a);
    this.oxen.splice(this.oxen.indexOf(o), 1); this.syncOx();
    this.stock.meat = Math.min(this.capFor("meat"), (this.stock.meat||0) + 4);
    this.toast("Le plus vieux bœuf ("+Math.floor(o.a/12)+" ans) est réformé : +4 🍗.");
    this.uiVersion++;
    return true;
  }
  // bœufs en état de tirer la charrue (adultes, pas affaiblis)
  workingOxen(){ return this.oxen.filter(o=>o.h>=50 && o.a>=24).length; }
  oxSpeed(){ return 1 + Math.min(3, this.stock.ox) * 0.6; }
  // un attelage accélère le labour : ×1,5 avec un bœuf, ×2 avec deux
  plowMul(){ return 1 + 0.5*Math.min(2, this.workingOxen()); }

  /* ================= étape 5 : les champs ================= */
  // culture proposée pour un nouveau champ : la prochaine qu'on pourra semer
  defaultCrop(){ const m = this.time.month; return (m>=4 && m<=9) ? "wheat" : "peas"; }
  // remet d'aplomb l'état d'un champ (nouveau champ ou ancienne sauvegarde)
  normField(f){
    const num = (v, d)=>typeof v==="number" && isFinite(v) ? v : d;
    const cl = (v, a, b, d)=>Math.max(a, Math.min(b, num(v, d)));
    f.fert = cl(f.fert, 0.2, 1, 0.6);
    if(!CROP_DEFS[f.crop]) f.crop = "wheat";
    f.sown = !!f.sown;
    if(f.sown){ if(!CROP_DEFS[f.sownCrop]) f.sownCrop = f.crop; } else delete f.sownCrop;
    f.plow = cl(f.plow, 0, 1, 0);
    f.sowP = cl(f.sowP, 0, 1, f.sown ? 1 : 0);
    f.dungP = cl(f.dungP, 0, 1, 0);
    f.dunged = !!f.dunged;
    f.growth = cl(f.growth, 0, 1, 0);
    f.harvestP = cl(f.harvestP, 0, 1, 0);
    f.cond = cl(f.cond, 0.1, 1.2, 1);
    f.hist = Array.isArray(f.hist) ? f.hist.filter(h=>h && CROP_DEFS[h.crop] && num(h.y, null)!==null && num(h.q, null)!==null).slice(-4) : [];
    f.hits = Array.isArray(f.hits) ? f.hits.filter(h=>Array.isArray(h) && typeof h[0]==="string" && num(h[1], null)!==null).slice(-4) : [];
    f.prev = CROP_DEFS[f.prev] ? f.prev : null;
    f.prevAt = num(f.prevAt, -999);
    // (sauvegarde d'avant l'étape 5 : on semait en mars-avril, on suppose avril dernier)
    f.sownAt = num(f.sownAt, (this.time.month>=3 ? this.time.year : this.time.year-1)*12 + 3);
    f.stubAt = num(f.stubAt, -999);
    f.rested = !!f.rested;
    f.grazed = !!f.grazed;
    f.usedThisYear = !!f.usedThisYear; f.usedLastYear = !!f.usedLastYear;
    return f;
  }
  // culture en terre (figée une fois semée), sinon culture prévue
  liveCrop(f){ return CROP_DEFS[(f && f.sown && f.sownCrop) || (f && f.crop)] || CROP_DEFS.wheat; }
  cropCal(cd){ return CROP_CAL[cd && cd.season] || CROP_CAL.rest; }
  setCrop(bid       , crop       ){
    const b=this.buildings.find(x=>x.id===bid);
    if(!b || b.def!=="field" || !b.f || !CROP_DEFS[crop]) return false;
    if(b.f.sown) return false;   // la culture en terre ne change plus jusqu'à la récolte
    b.f.crop = crop;
    if(crop==="hay" && (this.time.month===2 || this.time.month===3)) this.establishMeadow(b);
    this.uiVersion++; return true;
  }
  // un pré de fauche reprend chaque printemps, sans labour ni semailles
  establishMeadow(b){
    const f = b.f;
    f.sown = true; f.sownCrop = "hay"; f.growth = 0; f.harvestP = 0; f.cond = 1; f.hits = []; f.sownAt = this.monthIdx();
    f.plow = 0; f.sowP = 0; f.usedThisYear = true;
  }
  // la récolte peut-elle se faire ce mois-ci ? (un mois de retard reste possible, à perte)
  harvestable(b){
    const f = b && b.f;
    if(!f || !f.sown || f.growth<0.5) return false;
    const cal = this.cropCal(this.liveCrop(f)), m = this.time.month;
    if(!cal.harvest.length || this.monthIdx() - f.sownAt < 3) return false;
    const last = cal.harvest[cal.harvest.length-1], late = m===(last+1)%12;
    if(f.growth>=0.85) return cal.harvest.includes(m) || late;
    return m===last || late;   // pas tout à fait mûre : on se résigne à récolter en fin de saison
  }
  // la fertilité utile : le seigle se contente de sols pauvres, l'herbe d'un pré aussi
  fertEff(f, cd){ return cd.hardy ? 0.5 + 0.5*f.fert : cd.season==="meadow" ? 0.6 + 0.4*f.fert : f.fert; }
  // effet de la culture précédente sur ce champ
  rotationMul(f, cd){
    if(!cd.yield || cd.season==="meadow") return [1, ""];
    if(f.rested) return [1.1, "Après une jachère"];
    const p = (f.prev && f.prevAt >= this.monthIdx()-20) ? CROP_DEFS[f.prev] : null;
    if(!p || p.season==="meadow" || p.season==="rest") return [1, ""];
    if(p.id==="peas") return cd.id==="peas" ? [1, ""] : [1.15, "Après des pois"];
    if(cd.id==="flax" && p.id==="flax") return [0.7, "Lin deux ans de suite"];
    if(cd.cereal && p.id===cd.id) return [0.8, "Même céréale deux ans de suite"];
    if(cd.cereal && p.cereal) return [0.92, "Céréale après céréale"];
    return [1, ""];
  }
  // rendement attendu d'un champ (final : à la moisson, avec la pousse réelle)
  forecast(b, final){
    const f = b && b.f;
    if(!f) return { qty:0, parts:[], unit:null };
    const cd = this.liveCrop(f);
    if(!cd.yield) return { qty:0, parts:[], unit:null };
    const n = b.w*b.h, fe = this.fertEff(f, cd), rot = this.rotationMul(f, cd);
    const cond = f.sown ? f.cond : 1, gr = final ? Math.min(1, f.growth) : 1;
    const qty = Math.max(0, Math.round(n*4*cd.mul*fe*rot[0]*cond*gr));
    const parts = [["Fertilité", fe]];
    if(rot[0]!==1) parts.push([rot[1], rot[0]]);
    if(f.sown && Math.abs(cond-1)>0.005) parts.push(["État de la culture", cond]);
    if(final && gr<0.999) parts.push(["Pas tout à fait mûr", gr]);
    return { qty, parts, unit: cd.sheaf || cd.yield };
  }
  // moisson terminée : gerbes (céréales) ou récolte directe, historique, sol, remise à zéro
  harvestField(b){
    const f = b.f, cd = this.liveCrop(f), q = this.forecast(b, true).qty;
    const key = cd.sheaf || cd.yield;
    if(key) this.stock[key] = Math.min(this.capFor(key), (this.stock[key]||0) + q);
    const verb = cd.season==="meadow" ? "Fauche du pré" : cd.id==="flax" ? "Arrachage du lin" : cd.cereal ? "Moisson "+cd.of : "Récolte des pois et fèves";
    this.toast(verb+" : "+q+(cd.sheaf ? " gerbes à battre 🎋" : " "+(RES_ICONS[cd.yield]||"")), "good");
    f.hist.push({ y:this.time.year, crop:cd.id, q });
    if(f.hist.length>4) f.hist.shift();
    f.prev = cd.id; f.prevAt = this.monthIdx(); f.stubAt = this.monthIdx();
    f.fert = Math.max(0.2, Math.min(1, f.fert - cd.fertCost));
    f.sown = false; delete f.sownCrop;
    f.growth = 0; f.harvestP = 0; f.plow = 0; f.sowP = 0; f.dungP = 0; f.dunged = false; f.cond = 1; f.hits = [];
    f.usedThisYear = true; f.rested = false;
    this.uiVersion++;
    return q;
  }
  sheafTotal(){ return Object.keys(SHEAF_RES).reduce((s, k)=>s + (this.stock[k]||0), 0); }
  // battage : une gerbe donne une mesure de grain et un peu de paille (comptée dans le foin)
  threshOne(){
    const keys = Object.keys(SHEAF_RES).filter(k=>(this.stock[k]||0)>0 && (this.stock[SHEAF_RES[k]]||0) < this.capFor(SHEAF_RES[k]));
    if(!keys.length) return false;
    keys.sort((a, b)=>(this.stock[b]||0) - (this.stock[a]||0));
    const k = keys[0], res = SHEAF_RES[k], q = Math.min(1, this.stock[k]);
    this.stock[k] -= q;
    this.stock[res] = Math.min(this.capFor(res), (this.stock[res]||0) + q);
    this.stock.hay = Math.min(this.capFor("hay"), (this.stock.hay||0) + 0.25*q);
    return true;
  }
  // le travail le plus urgent pour un fermier : moisson/fauche, puis fumure, labour et semailles, sinon battage
  farmJob(v){
    const m = this.time.month;
    let best = null, bd = Infinity, bp = 9;
    for(const fd of this.fields()){
      const f = fd.f, cd = this.liveCrop(f), cal = this.cropCal(cd);
      let type = null, pr = 9;
      if(this.harvestable(fd)){ type = cd.season==="meadow" ? "mow" : "harvest"; pr = 0; }
      else if(!f.sown && (cd.season==="winter" || cd.season==="spring")){
        if(f.plow<1 && cal.plow.includes(m)){
          if(!f.dunged && (this.stock.manure||0)>=1 && f.fert<0.95){ type = "spread"; pr = 2; }
          else { type = "plow"; pr = 1; }
        } else if(f.plow>=1 && cal.sow.includes(m)){ type = "sow"; pr = 1; }
      }
      if(!type) continue;
      const d = Math.hypot(fd.x+fd.w/2-v.x, fd.y+fd.h/2-v.y);
      if(pr<bp || (pr===bp && d<bd)){ bp = pr; bd = d; best = { type, bid:fd.id }; }
    }
    if(best) return best;
    if(this.sheafTotal()>=0.5 && this.threshRoom()) return { type:"thresh" };
    return null;
  }
  threshRoom(){ return Object.keys(SHEAF_RES).some(k=>(this.stock[k]||0)>0 && (this.stock[SHEAF_RES[k]]||0) < this.capFor(SHEAF_RES[k])); }
  // vitesse d'un travail des champs, à la mesure de la taille du champ (un 4×4 sert de repère)
  fieldRate(fd, base){ return base*16/Math.max(1, fd.w*fd.h); }
  // une étape du travail d'un champ (labour, fumure, semailles, moisson, fauche)
  fieldWork(v, t){
    const fd = t.bid!==undefined ? this.buildings.find(x=>x.id===t.bid) : null;
    const stop = (c)=>{ v.task=null; v.state="idle"; v.cool=c; };
    if(!fd || !fd.f){ stop(5); return; }
    const f = fd.f, m = this.time.month, cal = this.cropCal(this.liveCrop(f)), sk = this.skillMul(v, "farm");
    if(t.type==="harvest" || t.type==="mow"){
      if(!this.harvestable(fd)){ stop(10); return; }
      f.harvestP = Math.min(1, f.harvestP + this.fieldRate(fd, t.type==="mow" ? 0.01 : 0.008)*sk*(this.wx==="wet" ? 0.6 : 1));
      if(f.harvestP>=1){ this.harvestField(fd); stop(5); }
      return;
    }
    if(f.sown || (t.type==="sow" ? !cal.sow.includes(m) : !cal.plow.includes(m))){ stop(10); return; }
    if(t.type==="spread"){
      if(f.dunged || (this.stock.manure||0)<1){ stop(3); return; }
      f.dungP = Math.min(1, f.dungP + this.fieldRate(fd, 0.02)*sk);
      if(f.dungP>=1){
        const n = fd.w*fd.h, use = Math.min(this.stock.manure, n*0.5);
        this.stock.manure -= use;
        f.fert = Math.min(1, f.fert + use/n*0.3);
        f.dunged = true;
        stop(3);
      }
    } else if(t.type==="plow"){
      f.plow = Math.min(1, f.plow + this.fieldRate(fd, 0.008)*sk*this.plowMul());
      if(f.plow>=1) stop(5);
    } else if(t.type==="sow"){
      if(f.plow<1){ stop(5); return; }
      f.sowP = Math.min(1, f.sowP + this.fieldRate(fd, 0.02)*sk);
      if(f.sowP>=1){
        const cd = this.liveCrop(f);
        f.sown = true; f.sownCrop = cd.id; f.growth = 0; f.harvestP = 0; f.cond = 1; f.hits = []; f.sownAt = this.monthIdx();
        f.usedThisYear = true;
        this.toast("Semailles faites : "+cd.name.toLowerCase()+".", "good");
        stop(5);
      }
    }
  }
  // en quelques mots, où en est un champ (pour l'interface)
  fieldStatus(b){
    const f = b.f; if(!f) return "";
    const cd = this.liveCrop(f), cal = this.cropCal(cd);
    if(cd.season==="rest") return "Jachère : le sol se repose";
    if(f.sown){
      if(this.harvestable(b)) return cd.name+" · "+(cd.season==="meadow" ? "prêt à faucher" : "prêt à moissonner")+(f.harvestP>0 ? " ("+Math.round(f.harvestP*100)+" %)" : "");
      if(f.growth>=0.85) return cd.name+" · mûr, "+(cd.season==="meadow" ? "fauche" : "moisson")+" en "+monthsTxt(cal.harvest);
      return cd.name+" · "+(isWinterMonth(this.time.month) && !cal.grow[this.time.month] ? "repos d'hiver ("+Math.round(f.growth*100)+" %)" : "pousse "+Math.round(f.growth*100)+" %");
    }
    if(cd.season==="meadow") return cd.name+" · l'herbe reprendra en mars";
    if(f.plow>=1) return cd.name+" · labouré, semailles en "+monthsTxt(cal.sow);
    if(f.plow>0) return cd.name+" · labour "+Math.round(f.plow*100)+" %";
    return cd.name+" · labour en "+monthsTxt(cal.plow.slice().sort((a, c)=>((a+12-7)%12)-((c+12-7)%12)));
  }
  farmStatus(b){
    const names = { plow:"labour", spread:"fumure", sow:"semailles", harvest:"moisson", mow:"fauche", thresh:"battage" };
    const cur = [];
    for(const v of this.workersOf(b)){ const n = v.task && names[v.task.type]; if(n && cur.indexOf(n)<0) cur.push(n); }
    if(cur.length) return cur.join(" et ").replace(/^./, c=>c.toUpperCase())+" en cours";
    return this.fields().length ? "Rien à faire aux champs pour l'instant" : "Aucun champ : posez-en autour";
  }

  /* ---------- étape 5 : la météo des champs, mois après mois ---------- */
  farmMonth(m){
    const r = this.rnd, fs = this.fields();
    this.wx = null;
    const hit = (b, label, pct)=>{
      const f = b.f; f.cond = Math.max(0.1, f.cond*(1-pct));
      f.hits.push([label, -Math.round(pct*100)]); if(f.hits.length>4) f.hits.shift();
    };
    // le pré de fauche reprend en mars
    if(m===2) for(const b of fs) if(b.f.crop==="hay" && !b.f.sown) this.establishMeadow(b);
    const sown = fs.filter(b=>b.f.sown);
    const young = sown.filter(b=>{ const cd = this.liveCrop(b.f); return cd.season==="spring" || (cd.season==="winter" && b.f.growth>0) || cd.season==="meadow"; });
    const roll = r();
    if((m===2 || m===3) && roll<0.12){
      // gel tardif : les jeunes pousses souffrent ; le seigle résiste
      let n = 0;
      for(const b of young){ const cd = this.liveCrop(b.f); hit(b, "Gel tardif", cd.hardy ? 0.06 : cd.id==="peas" ? 0.2 : cd.season==="meadow" ? 0.05 : 0.14); n++; }
      if(n) this.toast("❄️ Gel tardif : les jeunes pousses ont souffert dans "+n+" champ"+(n>1?"s":"")+".", "bad");
    } else if((m===3 || m===4) && roll<0.26){
      // printemps sec : la pousse ralentit ce mois-ci
      this.wx = "drought";
      for(const b of sown){ const cd = this.liveCrop(b.f); hit(b, "Printemps sec", cd.season==="winter" ? 0.04 : 0.08); }
      if(sown.length) this.toast("☀️ Printemps sec : les champs ont soif, la pousse ralentit.", "bad");
    } else if(m>=5 && m<=7 && roll<0.06){
      // grêle : un ou deux champs hachés
      const tg = sown.filter(b=>this.liveCrop(b.f).yield && b.f.growth>0.2);
      for(let k=0; k<(r()<0.3 ? 2 : 1) && tg.length; k++){
        const b = tg.splice(Math.floor(r()*tg.length), 1)[0], pct = 0.3 + r()*0.25;
        hit(b, "Grêle", pct);
        this.toast("🌩️ La grêle s'abat sur le champ de "+this.liveCrop(b.f).name.toLowerCase()+" (−"+Math.round(pct*100)+" %).", "bad");
      }
    } else if((m===6 || m===7) && this.weather==="rain" && roll<0.5){
      // été pourri : la moisson traîne, le grain mûr germe sur pied
      this.wx = "wet";
      let n = 0;
      for(const b of sown){ const cd = this.liveCrop(b.f); if(cd.cereal && b.f.growth>0.6){ hit(b, "Été pourri", 0.07); n++; } }
      if(n) this.toast("🌧️ Été pourri : la moisson traîne et le grain germe sur pied.", "bad");
    } else if((m===0 || m===1) && roll<0.1){
      // hiver rigoureux : le blé d'hiver souffre, le seigle tient bon
      let n = 0;
      for(const b of sown){ const cd = this.liveCrop(b.f); if(cd.season==="winter"){ hit(b, "Hiver rigoureux", cd.hardy ? 0.03 : 0.12); n++; } }
      if(n) this.toast("❄️ Hiver rigoureux : le blé d'hiver souffre, le seigle tient bon.", "bad");
    } else if(this.weather==="clear" && roll>0.75){
      // un mois idéal : la culture se porte un peu mieux
      for(const b of sown) if(this.cropCal(this.liveCrop(b.f)).grow[m]) b.f.cond = Math.min(1.15, b.f.cond + 0.03);
    }
    // récolte en retard : le grain tombe, puis tout est perdu
    for(const b of sown){
      const f = b.f, cd = this.liveCrop(f), cal = this.cropCal(cd);
      if(!cal.harvest.length || this.monthIdx() - f.sownAt < 4) continue;
      const last = cal.harvest[cal.harvest.length-1];
      const lost = m===(last+2)%12 || (m===(last+1)%12 && f.growth<0.5);
      if(!lost && m===(last+1)%12){ hit(b, "Récolte en retard", 0.35); this.toast("La récolte "+cd.of+" attend trop : le grain tombe. Il faut plus de fermiers.", "bad"); }
      else if(lost){
        this.toast(f.growth<0.5 ? "La culture "+cd.of+" n'a pas mûri à temps : elle est perdue." : "La récolte "+cd.of+" a pourri sur pied, faute de bras.", "bad");
        f.prev = cd.id; f.prevAt = this.monthIdx();
        f.sown = false; delete f.sownCrop; f.growth = 0; f.harvestP = 0; f.plow = 0; f.sowP = 0; f.dunged = false; f.cond = 1; f.hits = [];
      }
    }
    // jachère pâturée : un troupeau à côté y laisse son fumier
    if(m>=2 && m<=10){
      const herds = this.pastures().filter(p=>p.done && p.herd.an.length);
      for(const b of fs){
        b.f.grazed = false;
        if(b.f.crop!=="fallow" || b.f.sown) continue;
        if(herds.some(p=>Math.abs(p.x-(b.x+b.w/2))<=10 && Math.abs(p.y-(b.y+b.h/2))<=10)){ b.f.fert = Math.min(1, b.f.fert + 0.015); b.f.grazed = true; }
      }
    }
    // prévision de récolte au début de l'été
    if(m===5){
      const list = fs.filter(b=>b.f.sown && this.liveCrop(b.f).cereal);
      if(list.length){
        const avg = list.reduce((s, b)=>s + b.f.cond, 0)/list.length;
        this.toast("Prévisions de moisson : "+(avg>=1 ? "belle année" : avg>=0.85 ? "année moyenne" : "mauvaise année")+" ("+list.reduce((s, b)=>s + this.forecast(b).qty, 0)+" gerbes attendues).", avg>=0.85 ? "info" : "bad");
      }
    }
  }

  /* ================= étape 5 : pâturages et troupeaux ================= */
  pastures(){ return this.buildings.filter(b=>b.def==="pasture" && b.herd); }
  markPastures(){
    this.pastureCell = new Uint8Array(W*H);
    for(const b of this.buildings){
      if(b.def!=="pasture" || !b.plot) continue;
      for(let k=1; k<b.plot.cells.length; k++) if(this.occupied[b.plot.cells[k]]===b.id) this.pastureCell[b.plot.cells[k]] = 1;
    }
  }
  // longueur de clôture d'un ensemble de cases (en bords de case)
  perimeterOf(cells){
    const set = new Set(cells); let n = 0;
    for(const i of cells){ const x=i%W, y=(i/W)|0; for(const d of DIRS4){ const nx=x+d[0], ny=y+d[1]; if(!(nx>=0&&ny>=0&&nx<W&&ny<H && set.has(ny*W+nx))) n++; } }
    return n;
  }
  pastureCost(cells){ return 1 + Math.ceil(this.perimeterOf(cells)/8); }
  // Découpe un contour libre en pâturage SANS rien modifier (sert aussi d'aperçu).
  planPasture(pts){
    const fail = (err, extra)=>Object.assign({ cells:[], plots:[], err, poly:null, cost:0, anchor:-1, n:0 }, extra||{});
    if(!Array.isArray(pts) || pts.length<3) return fail("Posez au moins 3 points");
    const poly = pts.map(q=>[Math.max(0, Math.min(W, Math.round(Number(q[0])*SNAP)/SNAP)),
                             Math.max(0, Math.min(H, Math.round(Number(q[1])*SNAP)/SNAP))]);
    if(poly.some(q=>!isFinite(q[0]) || !isFinite(q[1]))) return fail("Contour invalide");
    if(selfIntersects(poly)) return fail("Le contour se croise", { poly });
    let x0=W, y0=H, x1=0, y1=0;
    for(const q of poly){ x0=Math.min(x0,q[0]); y0=Math.min(y0,q[1]); x1=Math.max(x1,q[0]); y1=Math.max(y1,q[1]); }
    const inside = [];
    for(let y=Math.max(0,Math.floor(y0)); y<Math.min(H,Math.ceil(y1)); y++) for(let x=Math.max(0,Math.floor(x0)); x<Math.min(W,Math.ceil(x1)); x++){
      if(!pointInPoly(x+0.5, y+0.5, poly)) continue;
      const i=y*W+x;
      if(this.roads[i]) return fail("Le pâturage empiète sur une route", { poly });
      if(this.occupied[i]>=0) return fail("Le pâturage empiète sur un bâtiment ou un champ", { poly });
      if(this.tiles[i]!==T_GRASS) return fail("Terrain impropre dans l'enclos (eau, forêt ou rocher)", { poly });
      if(!this.regionOwned(x)) return fail("Région non réclamée", { poly });
      inside.push(i);
    }
    if(inside.length<PASTURE_MIN) return fail("Pâturage trop petit ("+PASTURE_MIN+" cases au moins)", { poly, n:inside.length });
    if(inside.length>PASTURE_MAX) return fail("Pâturage trop grand ("+PASTURE_MAX+" cases au plus)", { poly, n:inside.length });
    // l'abri : une case du bord, ouverte sur un passage, au plus près d'une route (sinon du village)
    const set = new Set(inside), roadCells = [];
    for(let i=0;i<W*H;i++) if(this.roads[i]) roadCells.push(i);
    const camp = this.buildings[0];
    let anchor = -1, best = Infinity;
    for(const i of inside){
      const x=i%W, y=(i/W)|0;
      let open = false;
      for(const d of DIRS4){ const nx=x+d[0], ny=y+d[1]; if(nx>=0&&ny>=0&&nx<W&&ny<H && !set.has(ny*W+nx) && this.passable(nx, ny)) open = true; }
      if(!open) continue;
      let sc = Infinity;
      for(const ri of roadCells) sc = Math.min(sc, Math.abs(ri%W - x) + Math.abs(((ri/W)|0) - y));
      if(!roadCells.length) sc = camp ? Math.abs(camp.x-x)+Math.abs(camp.y-y) : 0;
      if(sc<best){ best = sc; anchor = i; }
    }
    if(anchor<0) return fail("L'enclos doit s'ouvrir sur un passage", { poly });
    const cells = [anchor].concat(inside.filter(i=>i!==anchor));
    const cost = this.pastureCost(cells);
    const info = { poly, cells, plots:[{ cells, dir:-1, poly:cleanPoly(poly) }], cost, anchor, n:inside.length };
    if((this.stock.timber||0) < cost) return fail("Bois insuffisant : la clôture demande "+cost+" 🪵", Object.assign({ limited:true }, info));
    return Object.assign({ err:null }, info);
  }
  // Trace le pâturage : clôture et abri en chantier, bâtis par les journaliers.
  tracePasture(pts){
    const plan = this.planPasture(pts);
    if(plan.err) return plan.err;
    this.stock.timber -= plan.cost;
    const a = plan.anchor;
    const b = this.makeBuilding("pasture", a%W, (a/W)|0);
    b.plot = { cells:plan.cells.slice(), dir:-1, poly:cleanPoly(plan.poly) };
    b.herd = this.newHerd();
    for(const i of plan.cells) this.occupied[i] = b.id;
    this.markPastures();
    this.toast("Pâturage tracé ("+(plan.cells.length-1)+" cases d'herbe) : les journaliers posent la clôture et l'abri.", "good");
    this.uiVersion++;
    return null;
  }
  newHerd(){ return { sp:null, an:[], keep:null, fed:1, out:-1, last:{} }; }
  // troupeau d'une sauvegarde : espèce connue, bêtes vérifiées une à une
  normHerd(h){
    const num = (v)=>typeof v==="number" && isFinite(v);
    const o = this.newHerd();
    if(!h || typeof h!=="object") return o;
    o.sp = LIVESTOCK[h.sp] ? h.sp : null;
    if(o.sp && Array.isArray(h.an)) for(const a of h.an.slice(0, 400)){
      if(!a || typeof a!=="object" || !num(a.a)) continue;
      o.an.push({ id:num(a.id) ? a.id : 0, a:Math.max(0, Math.round(a.a)), f:a.f ? 1 : 0, s:num(a.s) ? Math.max(0, Math.min(6, Math.round(a.s))) : 0,
                  fat:num(a.fat) ? Math.max(0, Math.min(1, a.fat)) : 0, lac:num(a.lac) ? Math.max(0, Math.min(12, Math.round(a.lac))) : 0 });
    }
    if(!o.an.length && !LIVESTOCK[h.sp]) o.sp = null;
    o.keep = num(h.keep) ? Math.max(0, Math.min(200, Math.round(h.keep))) : null;
    o.fed = num(h.fed) ? Math.max(0, Math.min(1, h.fed)) : 1;
    o.out = Number.isInteger(h.out) && h.out>=0 && h.out<W*H ? h.out : -1;
    o.last = h.last && typeof h.last==="object" ? h.last : {};
    return o;
  }
  makeAnimal(sp, female, age){ return { id:this.nextA++, a:Math.max(0, Math.round(age)), f:female ? 1 : 0, s:0, fat:0, lac:0 }; }
  isGrown(sp, a){ const d = LIVESTOCK[sp]; return !!d && a.a>=d.adultAt; }
  herdEq(h){ const d = LIVESTOCK[h.sp]; return d ? h.an.reduce((s, a)=>s + (a.a>=d.adultAt ? 1 : 0.5), 0) : 0; }
  grassCells(b){ return b.plot ? Math.max(0, b.plot.cells.length-1) : 0; }   // l'abri ne compte pas
  // bêtes (adultes) que l'herbe nourrit ce mois-ci, jachères voisines comprises
  pastureCap(b, m){
    const d = b.herd && LIVESTOCK[b.herd.sp]; if(!d) return 0;
    let fallow = 0;
    for(const fd of this.fields()) if(fd.f.crop==="fallow" && !fd.f.sown && Math.abs(b.x-(fd.x+fd.w/2))<=10 && Math.abs(b.y-(fd.y+fd.h/2))<=10) fallow += fd.w*fd.h;
    return (this.grassCells(b) + fallow*0.5)/d.area*GRASS[m];
  }
  keeperOf(b){ return this.workersOf(b).find(v=>this.canWork(v)) || null; }
  // forêt la plus proche de l'abri (glandée des porcs), -1 s'il n'y en a pas à portée
  forestNear(b, R){
    let best = -1, bd = Infinity;
    for(let y=Math.max(0,b.y-R); y<=Math.min(H-1,b.y+R); y++) for(let x=Math.max(0,b.x-R); x<=Math.min(W-1,b.x+R); x++){
      const i = y*W+x;
      if(this.tiles[i]!==T_FOREST || this.treeWood[i]<=0) continue;
      const d = Math.hypot(x-b.x, y-b.y);
      if(d<=R && d<bd){ bd = d; best = i; }
    }
    return best;
  }
  // prend du fourrage dans les réserves : le foin d'abord, puis l'avoine (1 avoine = 1,5 foin)
  takeFodder(need){
    let got = Math.min(this.stock.hay||0, need);
    this.stock.hay -= got;
    if(got<need){ const o = Math.min(this.stock.oats||0, (need-got)/1.5); this.stock.oats -= o; got += o*1.5; }
    return got;
  }
  // fourrage nécessaire par mois d'hiver (bœufs compris)
  winterNeed(){
    let n = this.oxen.length;
    for(const b of this.pastures()){ const d = LIVESTOCK[b.herd.sp]; if(d) n += this.herdEq(b.herd)*d.fodder; }
    return n;
  }
  fodderStock(){ return (this.stock.hay||0) + 1.5*(this.stock.oats||0); }
  // quelle bête abattre (ou vendre) d'abord : les mâles adultes en trop, puis les plus vieux
  pickCull(h){
    const d = LIVESTOCK[h.sp]; if(!d || !h.an.length) return null;
    const males = h.an.filter(a=>!a.f && a.a>=d.adultAt).sort((a, b)=>b.a-a.a);
    if(males.length>1) return males[0];
    const pool = h.an.filter(a=>a.f || a.a<d.adultAt || males.length!==1 || a!==males[0]);
    return (pool.length ? pool : h.an).slice().sort((a, b)=>b.a-a.a)[0];
  }
  pastureOf(bid){ const b = this.buildings.find(x=>x.id===bid); return b && b.def==="pasture" && b.herd ? b : null; }
  buyAnimal(bid, sp, female){
    const b = this.pastureOf(bid); if(!b) return "Pâturage introuvable";
    if(!b.done) return "La clôture est encore en chantier";
    const d = LIVESTOCK[sp]; if(!d) return "Espèce inconnue";
    const h = b.herd;
    if(h.sp && h.sp!==sp && h.an.length) return "Ce pâturage accueille déjà des "+LIVESTOCK[h.sp].ones;
    if(this.treasury<d.buy) return "Il faut "+d.buy+" deniers";
    this.treasury -= d.buy; h.sp = sp;
    h.an.push(this.makeAnimal(sp, female, d.adultAt + 4 + Math.floor(this.rnd()*24)));
    this.toast(d.icon+" "+(female ? d.f+" achetée" : d.m+" acheté")+" pour "+d.buy+" 💰.", "good");
    this.uiVersion++;
    return null;
  }
  sellAnimal(bid){
    const b = this.pastureOf(bid); if(!b || !b.herd.an.length) return "Aucune bête à vendre";
    const h = b.herd, d = LIVESTOCK[h.sp], a = this.pickCull(h);
    const p = a.a>=d.adultAt ? d.sell : Math.max(1, Math.round(d.sell/2));
    h.an.splice(h.an.indexOf(a), 1);
    this.treasury += p;
    this.toast(d.icon+" Une bête vendue au marché : +"+p+" 💰.");
    this.uiVersion++;
    return null;
  }
  // viande d'une bête abattue (rien pour une bête malade, plus pour un porc engraissé)
  meatOf(d, a){ return a.s>0 ? 0 : d.meat*(a.a>=d.adultAt ? 1 : 0.5) + (a.fat||0)*3; }
  slaughter(bid){
    const b = this.pastureOf(bid); if(!b || !b.herd.an.length) return "Aucune bête à abattre";
    const h = b.herd, d = LIVESTOCK[h.sp], a = this.pickCull(h), q = this.meatOf(d, a);
    h.an.splice(h.an.indexOf(a), 1);
    this.stock.meat = Math.min(this.capFor("meat"), (this.stock.meat||0) + q);
    this.toast(d.icon+" Une bête abattue : "+(q>0 ? "+"+(Math.round(q*10)/10)+" 🍗." : "malade, sa viande est perdue."));
    this.uiVersion++;
    return null;
  }
  // abattre les bêtes malades arrête la contagion (leur viande est perdue)
  cullSick(bid){
    const b = this.pastureOf(bid); if(!b) return "Pâturage introuvable";
    const h = b.herd, d = LIVESTOCK[h.sp], n = h.an.filter(a=>a.s>0).length;
    if(!n) return "Aucune bête malade";
    h.an = h.an.filter(a=>!(a.s>0));
    this.toast(d.icon+" "+n+" bête"+(n>1?"s":"")+" malade"+(n>1?"s":"")+" abattue"+(n>1?"s":"")+" : la contagion s'arrête là.");
    this.uiVersion++;
    return null;
  }
  // combien de bêtes garder pour l'hiver (abattage de novembre) ; null : on garde tout
  setKeep(bid, n){
    const b = this.pastureOf(bid); if(!b) return;
    b.herd.keep = (n===null || n===undefined || !isFinite(n)) ? null : Math.max(0, Math.min(200, Math.round(n)));
    this.uiVersion++;
  }
  setKeepOxen(on){ this.keepCalves = !!on; this.uiVersion++; }
  pastureStatus(b){
    const h = b.herd, d = h && LIVESTOCK[h.sp];
    if(!b.done) return "Clôture en chantier : "+BUILD_STAGES[buildStage(b)].name.toLowerCase()+" ("+Math.round(b.progress*100)+" %)";
    if(!d || !h.an.length) return "Vide : achetez des bêtes";
    const n = h.an.length, sick = h.an.filter(a=>a.s>0).length;
    let s = n+" "+(n>1 ? d.ones : d.one);
    if(h.out>=0) s += " · glandée en forêt";
    else if(isWinterMonth(this.time.month)) s += " · au foin";
    else s += h.fed<0.95 ? " · herbe trop courte" : " · herbe suffisante";
    if(sick) s += " · "+sick+" malade"+(sick>1?"s":"");
    return s;
  }
  // le gardien : il va et vient parmi ses bêtes (en forêt pendant la glandée)
  herdWork(v, t){
    const b = t.bid!==undefined ? this.buildings.find(x=>x.id===t.bid) : null;
    if(!b || !b.herd || !b.herd.an.length || !b.plot){ v.task=null; v.state="idle"; v.cool=20; return; }
    t.n = (t.n||0) + 1;
    if(t.n>320 && !t.pt){ v.task=null; v.state="idle"; v.cool=10; return; }
    if(t.wait>0){ t.wait--; return; }
    if(!t.pt){
      let i;
      if(b.herd.out>=0){ const ox = (b.herd.out%W), oy = ((b.herd.out/W)|0); i = Math.max(0, Math.min(H-1, oy + Math.floor(this.rnd()*3)-1))*W + Math.max(0, Math.min(W-1, ox + Math.floor(this.rnd()*3)-1)); }
      else i = b.plot.cells.length>1 ? b.plot.cells[1+Math.floor(this.rnd()*(b.plot.cells.length-1))] : b.plot.cells[0];
      t.pt = { x:(i%W)+0.25+this.rnd()*0.5, y:((i/W)|0)+0.4+this.rnd()*0.5 };
    }
    const tx = t.pt.x - v.x, ty = t.pt.y - v.y, dist = Math.hypot(tx, ty);
    if(dist<0.06){ t.pt = null; t.wait = 30 + Math.floor(this.rnd()*60); return; }
    const st = Math.min(0.1, dist); v.x += tx/dist*st; v.y += ty/dist*st;
  }

  /* ---------- étape 5 : la vie des troupeaux, mois après mois ---------- */
  herdMonth(m){
    const r = this.rnd, winter = isWinterMonth(m);
    // 1) les bœufs de trait passent en premier pour le foin
    for(const o of this.oxen.slice()){
      o.a++;
      if(winter){ const got = this.takeFodder(1); o.h = Math.max(0, Math.min(100, o.h + (got>=0.999 ? 10 : -30*(1-got)))); }
      else o.h = Math.min(100, o.h + 15);
      this.stock.manure = Math.min(this.capFor("manure"), (this.stock.manure||0) + (winter ? 1 : 0.5));
      let why = null;
      if(o.h<=0) why = "de faim";
      else if(o.a>168 && r()<0.08) why = "de vieillesse";
      if(why){ this.oxen.splice(this.oxen.indexOf(o), 1); this.toast("🐂 Un bœuf meurt "+why+" ("+Math.floor(o.a/12)+" ans).", "bad"); }
    }
    if(winter && this.oxen.some(o=>o.h<60) && !this._oxWarned){ this._oxWarned = true; this.toast("🐂 Les bœufs manquent de foin et s'affaiblissent.", "bad"); }
    if(!winter) this._oxWarned = false;
    this.syncOx();
    // 2) chaque troupeau
    for(const b of this.pastures()){
      const h = b.herd, d = LIVESTOCK[h.sp];
      h.out = -1;
      if(!d || !h.an.length || !b.done){ h.fed = 1; h.last = {}; continue; }
      const keeper = this.keeperOf(b), sk = keeper ? (keeper.skills.herd||0) : 0, skf = 0.8 + sk/250;
      const L = { born:0, starved:0, old:0, sickDead:0, wool:0, milk:0, hay:0, culled:0, meat:0, ox:0, fell:0 };
      const eq = this.herdEq(h), cap = this.pastureCap(b, m);
      // a) nourriture : herbe, foin l'hiver, glands à l'automne pour les porcs
      let fed = 1;
      if(winter){ const need = eq*d.fodder; fed = need>0 ? Math.min(1, this.takeFodder(need)/need) : 1; }
      else {
        if(h.sp==="pig" && m>=8 && m<=10 && keeper){ const fo = this.forestNear(b, 9); if(fo>=0) h.out = fo; }
        if(h.out>=0){ for(const a of h.an) a.fat = Math.min(1, (a.fat||0) + 0.34); }
        else fed = eq>0 ? Math.min(1, cap/eq) : 1;
        // fenaison : l'herbe en trop est fauchée en juin et juillet
        // (le gardien fauche seul : environ une botte pour trois cases d'herbe libre, dix au plus par mois)
        if((m===5 || m===6) && keeper && cap>eq){ L.hay = Math.round(Math.min(10, (cap-eq)*d.area/GRASS[m]*0.3*skf)*10)/10; this.stock.hay = Math.min(this.capFor("hay"), (this.stock.hay||0) + L.hay); }
      }
      h.fed = Math.round(fed*100)/100;
      // b) fumier : ramassé à l'abri l'hiver, laissé sur l'herbe le reste de l'année
      this.stock.manure = Math.min(this.capFor("manure"), (this.stock.manure||0) + eq*d.manure*(winter ? 1 : 0.3));
      if(!winter){ const g = 0.01*eq*d.area/Math.max(1, this.grassCells(b)); for(let k=1; k<b.plot.cells.length; k++){ const i = b.plot.cells[k]; this.soil[i] = Math.min(1, this.soil[i] + g); } }
      // c) maladie : déclaration, contagion, guérison ou mort
      const sick0 = h.an.filter(a=>a.s>0).length;
      if(!sick0){
        let p = 0.008 + (fed<0.8 ? 0.015 : 0) + (!keeper ? 0.012 : 0) + (cap<eq && !winter ? 0.012 : 0) + (this.weather==="rain" ? 0.004 : 0);
        p *= Math.min(1, h.an.length/5) * (1 - sk/250);
        // contagion depuis un troupeau voisin de la même espèce
        if(this.pastures().some(o=>o!==b && o.herd.sp===h.sp && o.herd.an.some(a=>a.s>0) && Math.abs(o.x-b.x)+Math.abs(o.y-b.y)<=8)) p += 0.15;
        if(r()<p){
          const a = h.an[Math.floor(r()*h.an.length)]; a.s = 2 + Math.floor(r()*2);
          this.toast(d.icon+" "+d.disease.charAt(0).toUpperCase()+d.disease.slice(1)+" se déclare chez les "+d.ones+" ! Abattez les bêtes malades ou espérez qu'elle passe.", "bad");
        }
      } else {
        const spread = 0.35*sick0/h.an.length*(keeper ? 1 - sk/200 : 1.2);
        for(const a of h.an) if(!(a.s>0) && r()<spread) a.s = -(2 + Math.floor(r()*2));   // tombe malade (compté le mois prochain)
      }
      for(const a of h.an.slice()){
        if(a.s>0){
          if(r() < d.mort*(fed<0.8 ? 1.5 : 1)*(keeper ? 1 - sk/300 : 1.3)){ h.an.splice(h.an.indexOf(a), 1); L.sickDead++; continue; }
          a.s--;
        } else if(a.s<0) a.s = -a.s;
      }
      // d) âge, faim, vieillesse
      for(const a of h.an.slice()){
        a.a++;
        if(winter && a.fat) a.fat = Math.round(a.fat*0.7*100)/100;   // un porc gras maigrit l'hiver
        const frail = a.a<d.adultAt/2 || a.a>d.life ? 1.5 : 1;
        if(fed<0.6 && r() < (0.6-fed)*0.5*frail){ h.an.splice(h.an.indexOf(a), 1); L.starved++; continue; }
        if(a.a>d.life && r()<0.2){ h.an.splice(h.an.indexOf(a), 1); L.old++; continue; }
        // un jeune taureau de trop est dressé à l'attelage : un bœuf de plus
        if(h.sp==="cattle" && !a.f && a.a===d.adultAt && this.keepCalves!==false && h.an.some(o=>o!==a && !o.f && o.a>=d.adultAt)){
          h.an.splice(h.an.indexOf(a), 1); this.oxen.push(this.makeOx(a.a)); L.ox++;
        }
      }
      // e) naissances : au printemps (et à la fin de l'été pour les truies), s'il y a un mâle et de quoi manger
      if((m===2 || (h.sp==="pig" && m===7)) && fed>=0.7){
        const male = h.an.some(a=>!a.f && a.a>=d.adultAt && !(a.s>0));
        if(male){
          const crowd = this.pastureCap(b, 5) < eq*1.2 ? 0.5 : 1;
          for(const a of h.an.slice()){
            if(!a.f || a.a<d.adultAt || a.s>0 || a.a>d.life-6) continue;
            if(r() < d.birthP*(keeper ? 1 : 0.6)*(0.9 + sk/500)*crowd){
              const n = d.litter[Math.floor(r()*d.litter.length)];
              for(let k=0; k<n; k++) h.an.push(this.makeAnimal(h.sp, r()<0.5, 0));
              L.born += n;
              if(h.sp==="cattle") a.lac = 10;
            }
          }
        }
      }
      // f) produits : lait des vaches qui ont vêlé, laine à la tonte de mai
      for(const a of h.an){
        if(h.sp==="cattle" && a.lac>0){ if(keeper && !(a.s>0)) L.milk += 1.5*skf*(fed>=0.6 ? 1 : 0.5); a.lac--; }
        if(h.sp==="sheep" && m===4 && keeper && a.a>=d.adultAt && !(a.s>0)) L.wool += skf;
      }
      if(L.milk) this.stock.milk = Math.min(this.capFor("milk"), (this.stock.milk||0) + L.milk);
      if(L.wool) this.stock.wool = Math.min(this.capFor("wool"), (this.stock.wool||0) + L.wool);
      // g) abattage de novembre : on ne garde que ce que le foin nourrira
      if(m===10 && h.keep!==null && h.keep!==undefined){
        while(h.an.length>h.keep){
          const a = this.pickCull(h); if(!a) break;
          L.meat += this.meatOf(d, a); L.culled++;
          h.an.splice(h.an.indexOf(a), 1);
        }
        if(L.meat) this.stock.meat = Math.min(this.capFor("meat"), (this.stock.meat||0) + L.meat);
      }
      h.last = { m, born:L.born, dead:L.starved+L.old+L.sickDead, wool:Math.round(L.wool*10)/10, milk:Math.round(L.milk*10)/10, hay:L.hay, culled:L.culled };
      // h) ce que le seigneur doit savoir
      if(L.born) this.toast(d.icon+" "+d.birth+" : "+L.born+" "+(L.born>1 ? d.youngs : d.young.toLowerCase())+" au pâturage.", "good");
      if(L.wool>=1) this.toast(d.icon+" Tonte des moutons : "+Math.round(L.wool)+" 🧶.", "good");
      if(L.ox) this.toast("🐂 Un jeune taureau est dressé à l'attelage : un bœuf de plus.", "good");
      if(L.culled) this.toast(d.icon+" Abattage de novembre : "+L.culled+" "+(L.culled>1 ? d.ones : d.one)+" (+"+Math.round(L.meat)+" 🍗).", "good");
      if(L.starved) this.toast(d.icon+" Faute "+(winter ? "de foin" : "d'herbe")+", "+L.starved+" "+(L.starved>1 ? d.ones+" sont morts" : d.one+" est mort")+".", "bad");
      if(L.sickDead) this.toast(d.icon+" "+d.disease.charAt(0).toUpperCase()+d.disease.slice(1)+" emporte "+L.sickDead+" "+(L.sickDead>1 ? d.ones : d.one)+".", "bad");
    }
    this.syncOx();
    // avertissement d'automne : assez de foin pour l'hiver ?
    if(m===9){
      const need = this.winterNeed()*3, have = this.fodderStock();
      if(need>0 && have<need) this.toast("⚠️ Fourrage : il en faudra environ "+Math.ceil(need)+" pour l'hiver, vous en avez "+Math.floor(have)+". Fauchez, gardez de l'avoine ou réduisez les troupeaux en novembre.", "bad");
    }
  }

  buyExtension(bid       , ext       ){
    const b = this.buildings.find(x=>x.id===bid); if(!b || b.def!=="burgage" || !b.done) return;
    const d = EXT_DEFS[ext]; if(!d) return;
    if(b.exts.includes(ext)){ this.toast("Cet agrandissement existe d\u00e9j\u00e0.","bad"); return; }
    if(b.lvl < d.lvl){ this.toast("Il faut un bourgage de niveau "+d.lvl+" pour ceci.","bad"); return; }
    // parcelle tracée : une seule chose dans l'arrière-cour, qui occupe toute la cour
    if(b.plot){
      if(this.yardSize(b)===0){ this.toast("Cette parcelle n'a pas d'arrière-cour.","bad"); return; }
      if(b.exts.length>0){ this.toast("L'arrière-cour accueille déjà : "+EXT_DEFS[b.exts[0]].name+". Retirez-le d'abord.","bad"); return; }
    }
    for(const k of Object.keys(d.cost)){
      if((this.stock[k]||0) < d.cost[k]){ this.toast("Il manque des ressources pour "+d.name+".","bad"); return; }
    }
    for(const k of Object.keys(d.cost)) this.stock[k] -= d.cost[k];
    b.exts.push(ext);
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
    else if(c.act==="fairWood" || c.act==="fairCoin") this.fairDeal(ev.fair, c.act==="fairWood");
    else if(c.act==="fairNo") this.toast("Le marchand de bestiaux reprend la route.");
    else if(c.act==="hideBandits"){ for(const k of ["berries","meat","bread","eggs","veg"]) this.stock[k]=Math.floor(this.stock[k]*0.8);
      this.stock.timber=Math.floor(this.stock.timber*0.9); this.toast("Les brigands pillent la seigneurie et repartent.","bad"); }
    this.pendingEvent = null;
    this.approval = Math.max(0, Math.min(100, this.approval));
    this.uiVersion++;
  }

  // étape 5 : au printemps, un marchand de bestiaux passe parfois (troc contre du bois, ou deniers)
  livestockFair(){
    if(this.pendingEvent) return;
    const ps = this.pastures().filter(b=>b.done);
    if(!ps.length || this.rnd()>=0.6) return;
    const empty = ps.find(b=>!b.herd.an.length);
    const b = empty || ps[Math.floor(this.rnd()*ps.length)];
    const sp = b.herd.an.length ? b.herd.sp : LIVESTOCK_ORDER[Math.floor(this.rnd()*LIVESTOCK_ORDER.length)];
    const d = LIVESTOCK[sp];
    const lot = sp==="cattle" ? [1,0] : [1,1,0];   // 1 = femelle
    const coin = Math.round(lot.length*d.buy*0.8), wood = Math.round(lot.length*d.buy*0.9)+2;
    const nf = lot.filter(x=>x).length, nm = lot.length-nf;
    const what = nf+" "+(nf>1 ? d.fs : d.f.toLowerCase())+" et "+nm+" "+(nm>1 ? d.ms : d.m.toLowerCase());
    this.pendingEvent = { title:"Un marchand de bestiaux",
      text:"Un marchand mène ses bêtes à la foire. Il vous propose "+what+" pour votre pâturage, contre "+wood+" bois d'œuvre ou "+coin+" deniers.",
      fair:{ bid:b.id, sp, lot, wood, coin },
      choices:[ { label:"Troquer contre "+wood+" 🪵", act:"fairWood", disabled:this.stock.timber<wood },
                { label:"Payer "+coin+" 💰", act:"fairCoin", disabled:this.treasury<coin },
                { label:"Passer son chemin", act:"fairNo" } ] };
  }
  fairDeal(fair, wood){
    const b = fair && this.pastureOf(fair.bid), d = fair && LIVESTOCK[fair.sp];
    if(!b || !d || (b.herd.an.length && b.herd.sp!==fair.sp)){ this.toast("Le pâturage n'est plus libre : le marchand repart."); return; }
    if(wood){ if(this.stock.timber<fair.wood) return; this.stock.timber -= fair.wood; }
    else { if(this.treasury<fair.coin) return; this.treasury -= fair.coin; }
    b.herd.sp = fair.sp;
    for(const f of fair.lot) b.herd.an.push(this.makeAnimal(fair.sp, !!f, d.adultAt + 4 + Math.floor(this.rnd()*18)));
    this.toast(d.icon+" Marché conclu : "+fair.lot.length+" "+d.ones+" rejoignent le pâturage.", "good");
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
    return this.roadAt(x,y) ? 0.4 : (this.pastureCell[y*W+x] ? 1.6 : 1.0);
  }

  /* ---------- pathfinding ---------- */
  passable(x       ,y       ){
    if(x<0||y<0||x>=W||y>=H) return false;
    if(!this.regionOwned(x)) return false;
    const i=y*W+x;
    if(this.tiles[i]===T_WATER) return false;
    const ob=this.occupied[i];
    if(ob>=0){
      if(this.pastureCell[i]) return true;   // étape 5 : on traverse un pâturage (barrières), pas son abri
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
    if(sx===gx && sy===gy){ f.state="work"; f.timer=this.workTime(f, task.type); f.task=task; return true; }
    const p=this.astar(sx,sy,gx,gy);
    if(!p){ f.cool=40; return false; }
    f.path=p; f.state="walk"; f.task=task;
    return true;
  }
  sendToBuilding(f       , b         , task                          )        {
    const spot=this.spotFor(b, f.x, f.y);
    if(!spot){ f.cool=30; return false; }
    const sx=Math.floor(f.x), sy=Math.floor(f.y);
    if(sx===spot.x && sy===spot.y){ f.state="work"; f.timer=this.workTime(f, task.type); f.task=task; return true; }
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

  // durée d'une tâche selon le savoir-faire de celui qui l'exécute
  workTime(f, type){
    const base = WORK_TIME[type]||15;
    const b = f.work>0 ? this.buildings.find(x=>x.id===f.work) : null;
    return Math.max(4, Math.round(base / this.skillMul(f, this.jobSkill(b) || "build")));
  }
  // enfants, anciens, malades, ou adultes sans rien à faire : ils restent autour de la maison
  idleNearHome(f){
    if(this.stageOf(f)==="baby"){ f.cool = 200; return; }   // un nourrisson reste à la maison
    const kid = !this.isAdult(f);
    if(this.rnd() < (kid ? 0.5 : 0.3)){
      const home = this.homeOf(f);
      const hx = home?home.x:W/2, hy = home?home.y:H/2;
      const R = kid ? 3 : 5;
      const tx=Math.max(0,Math.min(W-1,Math.floor(hx+this.rnd()*R-(R>>1))));
      const ty=Math.max(0,Math.min(H-1,Math.floor(hy+1+this.rnd()*R-(R>>1))));
      if(this.passable(tx,ty)){
        const p=this.astar(Math.floor(f.x),Math.floor(f.y),tx,ty);
        if(p && p.length<=12){ f.path=p; f.state="wander"; return; }
      }
    }
    f.cool = 20 + Math.floor(this.rnd()*20);
  }
  assignTask(f       ){
    if(f.cool>0){ f.cool--; return; }
    // seuls les adultes valides (et les apprentis) travaillent
    if(!(this.canWork(f) || (f.appr && this.canApprentice(f)))){ this.idleNearHome(f); return; }
    const b = f.work>0 ? this.buildings.find(x=>x.id===f.work && x.done) : undefined;
    const site = f.work>0 ? this.buildings.find(x=>x.id===f.work && !x.done) : undefined;

    // chantier : les ouvriers affectés à un bâtiment non terminé participent au chantier
    if(site){ this.taskBuild(f, site); return; }
    if(!b){
      // journaliers : construisent le chantier le plus proche, sinon flânent (pas les apprentis)
      const sites = f.appr ? [] : this.buildings.filter(s=>!s.done);
      if(sites.length>0){
        let nearest=sites[0], nd=Infinity;
        for(const s of sites){ const d=Math.hypot(s.x-f.x,s.y-f.y); if(d<nd){nd=d;nearest=s;} }
        this.taskBuild(f, nearest); return;
      }
      this.idleNearHome(f);
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
        // étape 5 : le travail du moment (moisson, fauche, fumure, labour, semailles), sinon le battage à la ferme
        const job = this.farmJob(f);
        if(!job){ f.cool=40; return; }
        if(job.type==="thresh"){ this.sendToBuilding(f, b, {type:"thresh"}); return; }
        const fd = this.buildings.find(x=>x.id===job.bid);
        if(fd) this.sendToBuilding(f, fd, job); else f.cool=20;
        return;
      }
      case "pasture":{
        // étape 5 : le gardien rejoint ses bêtes
        if(!b.herd || !b.herd.an.length){ f.cool=60; return; }
        this.sendToBuilding(f, b, {type:"herd", bid:b.id});
        return;
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

  stepVillager(f       ){
    const st = this.stageOf(f), sp = (st==="child" || st==="baby" || st==="elder") ? 0.8 : 1;
    switch(f.state){
      case "settle":
        if(this.moveAlong(f, f.path, 0.25*sp) || !f.path){ f.state="idle"; f.cool=0; f.path=null; }
        break;
      case "wander":
        if(this.moveAlong(f, f.path, 0.18*sp)){ f.state="idle"; f.cool=25; f.path=null; }
        break;
      case "walk":
        if(this.moveAlong(f, f.path, 0.25*sp)){
          f.path=null;
          const t=f.task;
          if(!t){ f.state="idle"; break; }
          if(t.type==="build"||t.type==="mill"||t.type==="stall"||FIELD_TASKS[t.type]||t.type==="thresh"||t.type==="herd"){ f.state="work"; f.timer=0; }
          else { f.state="work"; f.timer=this.workTime(f, t.type); }
        }
        break;
      case "work":
        this.doWork(f);
        break;
      case "return":
        if(this.moveAlong(f, f.path, 0.25*sp)){
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
    // chaque moment passé à l'ouvrage fait progresser le savoir-faire correspondant (bilan mensuel)
    const sk = t.type==="build" ? "build" : (FIELD_TASKS[t.type] || t.type==="thresh") ? "farm" : t.type==="herd" ? "herd" : t.type==="mill" ? "craft"
             : (t.type==="stall" || t.type==="trade") ? "trade" : (this.jobSkill(b) || "build");
    this.noteWork(f, sk);
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
        site.progress += 0.0045 * (BUILD_DEFS[site.def].buildRate || 1) * this.skillMul(f, "build");
        if(site.progress>=1){
          site.done=true; site.progress=1;
          this.toast(BUILD_DEFS[site.def].name+" est achevé(e) !","good");
          if(site.def==="burgage") this.rehouseCamp();
          if(site.def==="manor") this.toast("Vous pouvez désormais lever l'impôt.","good");
          f.task=null; f.state="idle"; f.cool=5;
        }
        break;
      }
      case "plow": case "spread": case "sow": case "harvest": case "mow":{
        this.fieldWork(f, t);
        break;
      }
      case "thresh":{
        // battage au fléau, à la ferme
        f.timer++;
        if(f.timer>=Math.round(8/this.skillMul(f, "farm"))){
          f.timer=0;
          if(!this.threshOne()){ f.task=null; f.state="idle"; f.cool=20; }
          else if(this.farmJob(f) && this.farmJob(f).type!=="thresh"){ f.task=null; f.state="idle"; f.cool=0; }   // un travail des champs passe avant
        }
        break;
      }
      case "herd":{
        this.herdWork(f, t);
        break;
      }
      case "mill":{
        f.timer++;
        if(f.timer>=Math.round(12/this.skillMul(f, "craft"))){
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

  /* ---------- étape 4 : la vie des villageois, mois après mois ---------- */
  related(a, b){
    const par = (x, y)=>x.mother===y.id || x.father===y.id;
    if(par(a, b) || par(b, a)) return true;
    if((a.mother>=0 && a.mother===b.mother) || (a.father>=0 && a.father===b.father)) return true;
    return false;
  }
  // une maison libre, sauf si des familles attendent encore au campement ou sont sans logis
  freeHouseFor(){
    const camp = this.buildings.find(b=>b.def==="camp");
    if(this.families.some(f=>f.home<0 || (camp && f.home===camp.id))) return null;
    return this.buildings.find(bd=>bd.done && bd.def==="burgage" && !this.families.some(f=>f.home===bd.id)) || null;
  }
  // un couple (et ses enfants encore à charge) fonde son propre foyer dans la maison donnée
  moveOut(h, w, house){
    const fh = this.famOf(h), fw = this.famOf(w);
    const nf = this.makeFamily(this.surnameOf(fh));
    nf.home = house.id; nf.founder = !!((fh && fh.founder) || (fw && fw.founder));
    const kids = this.villagers.filter(c=>(c.mother===w.id || c.father===h.id || c.mother===h.id || c.father===w.id)
      && c.spouse<0 && this.ageOf(c)<AGE_ADULT && (c.fam===h.fam || c.fam===w.fam));
    if(fw && fw!==fh && !w.maiden) w.maiden = this.surnameOf(fw);
    for(const v of [h, w].concat(kids)) v.fam = nf.id;
    this.cleanFamilies();
    return nf;
  }
  wed(h, w){
    this.marry(h, w);
    const fh = this.famOf(h), fw = this.famOf(w);
    const wName = w.first+" "+(w.maiden || this.surnameOf(fw));
    for(const v of [h, w]){ v.joy = 3; v.joyFor = "Mariage avec "+(v===h ? w : h).first; }
    const house = this.freeHouseFor();
    let where;
    if(house){ this.moveOut(h, w, house); where = " Ils s'installent dans leur propre maison."; }
    else {
      // faute de maison libre, l'épouse rejoint la famille de son mari
      if(fw && fw!==fh){ w.maiden = w.maiden || this.surnameOf(fw); w.fam = h.fam; }
      where = " Faute de maison libre, ils vivent chez les "+this.surnameOf(fh)+".";
      this.cleanFamilies();
    }
    this.toast("Mariage de "+h.first+" "+this.surnameOf(fh)+" et "+wName+"."+where, "good");
  }
  // les jeunes couples logés chez leurs parents prennent une maison dès qu'il y en a une
  rehouseCouples(){
    for(const f of this.families.slice()){
      const mem = this.membersOf(f.id);
      const couples = [];
      for(const v of mem) if(v.sex==="m" && v.spouse>=0){ const w = mem.find(o=>o.id===v.spouse); if(w) couples.push([v, w]); }
      if(couples.length<2) continue;
      couples.sort((a, b)=>this.ageOf(b[0]) - this.ageOf(a[0]));   // le couple le plus âgé garde la maison
      for(const c of couples.slice(1)){
        const house = this.freeHouseFor(); if(!house) return;
        this.moveOut(c[0], c[1], house);
        this.toast(c[0].first+" et "+c[1].first+" quittent la maison familiale pour la leur.", "good");
      }
    }
  }
  // un foyer sans plus personne disparaît (sa maison se libère)
  cleanFamilies(){
    const n = this.families.length;
    this.families = this.families.filter(f=>this.villagers.some(v=>v.fam===f.id));
    if(this.families.length!==n) this.uiVersion++;
  }
  die(v, cause, silent){
    if(this.villagers.indexOf(v)<0) return;
    const f = this.famOf(v), age = this.ageOf(v), name = this.fullName(v);
    // un savoir-faire de haut niveau que personne d'autre n'a appris disparaît avec lui
    const lost = [];
    for(const sk of SKILL_ORDER){
      if((v.skills[sk]||0) < 60) continue;
      if(!this.villagers.some(o=>o!==v && (o.skills[sk]||0)>=40)) lost.push(SKILL_DEFS[sk].name.toLowerCase());
    }
    for(const o of this.villagers){
      if(o===v) continue;
      if(o.id===v.spouse || o.fam===v.fam || o.id===v.mother || o.id===v.father || o.mother===v.id || o.father===v.id){ o.grief = 6; o.griefFor = v.first; }
    }
    this.dropVillager(v);
    if(!silent) this.toast("Décès de "+name+", "+age+" an"+(age>1?"s":"")+", "+cause+".", cause==="de vieillesse" ? "info" : "bad");
    if(lost.length) this.toast("Le savoir-faire ("+lost.join(", ")+") disparaît avec "+name+" : personne ne l'avait appris.", "bad");
    // orphelins : recueillis par une autre famille s'il ne reste aucun adulte au foyer
    if(f){
      const mem = this.membersOf(f.id);
      if(mem.length && !mem.some(o=>this.isAdult(o))){
        const hosts = this.families.filter(o=>o!==f && this.membersOf(o.id).some(x=>this.isAdult(x)));
        hosts.sort((a, b)=>this.membersOf(a.id).length - this.membersOf(b.id).length);
        if(hosts.length){
          for(const c of mem){ c.maiden = c.maiden || this.surnameOf(f); c.fam = hosts[0].id; }
          this.toast("Les enfants "+this.surnameOf(f)+" sont recueillis par la famille "+this.surnameOf(hosts[0])+".", "info");
        }
      }
    }
    this.cleanFamilies();
    this.uiVersion++;
  }
  demography(winter, fuelRatio){
    const r = this.rnd, now = this.monthIdx();
    for(const v of this.villagers){ if(v.grief>0) v.grief--; if(v.joy>0) v.joy--; }
    // 1) anniversaires : 12 ans (apprentissage possible), 16 ans (âge de travailler), 65 ans (retraite)
    for(const v of this.villagers.slice()){
      if(now<=v.bornAt || (now - v.bornAt) % 12 !== 0) continue;
      const age = this.ageOf(v), name = this.fullName(v);
      if(age===AGE_TEEN && v.work<0) this.toast(name+" a 12 ans : "+(v.sex==="f"?"elle":"il")+" peut entrer en apprentissage.");
      if(age===AGE_ADULT){
        const b = v.appr ? this.buildings.find(x=>x.id===v.work) : null;
        if(b){
          const d = BUILD_DEFS[b.def], sk = this.jobSkill(b), n = this.workersOf(b).length;
          v.appr = false;
          if(n<d.fam){
            b.want = Math.max(Number(b.want)||0, n+1);
            this.toast(name+" a fini son apprentissage : "+this.jobTitle(v).toLowerCase()+" ("+skillLevel(v.skills[sk]).toLowerCase()+").", "good");
          } else {
            v.work = -1; this.resetWorker(v);
            this.toast(name+" a fini son apprentissage ("+skillLevel(v.skills[sk]).toLowerCase()+"), mais l'atelier est complet : "+(v.sex==="f"?"journalière":"journalier")+".", "good");
          }
        } else this.toast(name+" a 16 ans : "+(v.sex==="f"?"elle":"il")+" est en âge de travailler.");
      }
      if(age===AGE_RETIRE && v.work>0 && !v.appr){
        v.work = -1; this.resetWorker(v);   // le poste reste voulu : un autre adulte le reprendra
        this.toast(name+" prend sa retraite à 65 ans.");
      }
    }
    // 2) santé : faim, froid, maladie ; on se remet quand tout va bien
    for(const v of this.villagers){
      const st = this.stageOf(v), age = this.ageOf(v), f = this.famOf(v);
      const fed = f ? (f.fed===undefined ? 1 : f.fed) : 1;
      const frag = (st==="baby" || st==="elder") ? 1.4 : 1;
      let dh = 0;
      v.cause = null;
      if(fed<0.5){ dh -= 15*frag; v.cause = "de faim"; } else if(fed<0.999) dh -= 5*frag;
      if(winter && fuelRatio<1){ dh -= (fuelRatio<0.5 ? 10 : 4)*frag; if(!v.cause) v.cause = "de froid"; }
      if(!f || f.home<0) dh -= 3;
      if(v.sick>0){ dh -= 12*frag; v.sick--; if(!v.cause) v.cause = "de maladie"; }
      else {
        const p = 0.006 + (winter ? 0.008 : 0) + (fed<0.999 ? 0.01 : 0) + (winter && fuelRatio<1 ? 0.01 : 0) + (st==="elder" ? 0.006 : 0);
        if(r()<p){ v.sick = 1 + Math.floor(r()*3); dh -= 8; if(!v.cause) v.cause = "de maladie"; }
      }
      if(dh===0) dh = 6;
      const cap = age>=60 ? Math.max(40, 100-(age-60)*2) : 100;
      v.health = Math.round(Math.max(0, Math.min(cap, v.health + dh)));
    }
    // 3) décès
    for(const v of this.villagers.slice()){
      const age = this.ageOf(v);
      let cause = null;
      if(v.health<=0) cause = v.cause || "de maladie";
      else if(age>=AGE_ELDER && r() < 0.002*Math.pow(1.12, age-AGE_ELDER)*(v.health<50 ? 2 : 1)) cause = "de vieillesse";
      if(cause) this.die(v, cause);
    }
    // 4) naissances : un couple logé dans une maison, bien nourri, dans un village pas trop malheureux
    for(const f of this.families){
      const home = f.home>0 ? this.buildings.find(b=>b.id===f.home) : null;
      if(!home || home.def!=="burgage" || !home.done) continue;
      if((f.fed===undefined ? 1 : f.fed) < 0.999 || this.approval < 25) continue;
      const mem = this.membersOf(f.id);
      if(mem.filter(v=>this.ageOf(v)<AGE_TEEN).length>=3) continue;
      for(const w of mem){
        if(w.sex!=="f" || w.spouse<0 || w.sick>0 || w.health<50) continue;
        const h = mem.find(o=>o.id===w.spouse); if(!h) continue;
        const a = this.ageOf(w); if(a<17 || a>42) continue;
        if(this.villagers.some(c=>c.mother===w.id && now - c.bornAt < 15)) continue;
        if(r() < 1/36){
          const sex = r()<0.5 ? "m" : "f";
          const baby = this.makePerson(f, sex, 0, { mother:w.id, father:h.id, x:w.x, y:w.y });
          baby.bornAt = now;
          for(const o of mem){ o.joy = 3; o.joyFor = "Naissance de "+baby.first; }
          this.toast("Naissance de "+baby.first+" "+this.surnameOf(f)+", "+(sex==="f" ? "fille" : "fils")+" de "+w.first+" et "+h.first+".", "good");
          break;
        }
      }
    }
    // 5) mariages : deux célibataires d'âge voisin, sans lien de parenté
    if(r()<0.3){
      const singles = this.villagers.filter(v=>v.spouse<0 && !(v.sick>0) && this.ageOf(v)>=17 && this.ageOf(v)<=50);
      let best = null, bd = Infinity;
      for(const h of singles) if(h.sex==="m") for(const w of singles) if(w.sex==="f"){
        if(this.related(h, w)) continue;
        const d = Math.abs(this.ageOf(h) - this.ageOf(w) - 2);
        if(d>12) continue;
        const sc = d + r()*4;
        if(sc<bd){ bd = sc; best = [h, w]; }
      }
      if(best) this.wed(best[0], best[1]);
    }
    // 6) savoir-faire : on progresse en travaillant ; l'apprenti progresse vite auprès d'un bon maître
    const up = (v, sk, g)=>{ const s0 = v.skills[sk]||0; v.skills[sk] = Math.round(Math.min(100, s0 + g*(1 - s0/105))*10)/10; };
    for(const v of this.villagers){
      const wt = v.wt || {};
      const total = Object.keys(wt).reduce((s, k)=>s+(wt[k]||0), 0);
      if(v.appr && v.work>0){
        const b = this.buildings.find(x=>x.id===v.work), sk = this.jobSkill(b);
        if(sk){
          const mst = this.masterOf(b), ms = mst ? (mst.skills[sk]||0) : 0;
          up(v, sk, Math.min(1, total/60) * (1.5 + (ms>=40 ? 6*ms/100 : 0)));
        }
      } else {
        for(const sk of Object.keys(wt)) if(SKILL_DEFS[sk]) up(v, sk, Math.min(1, wt[sk]/60) * 4);
      }
      v.wt = {};
      // les enfants apprennent un peu le métier de leurs parents en les regardant faire
      const age = this.ageOf(v);
      if(age>=6 && age<AGE_ADULT){
        for(const pid of [v.mother, v.father]){
          const p = pid>=0 ? this.villager(pid) : null;
          if(!p || p.work<=0 || p.appr) continue;
          const sk = this.jobSkill(this.buildings.find(x=>x.id===p.work)); if(!sk) continue;
          const target = 0.4*(p.skills[sk]||0), cur = v.skills[sk]||0;
          if(cur<target) v.skills[sk] = Math.round((cur + 0.03*(target - cur))*10)/10;
        }
      }
    }
  }
  // ce qui rend un villageois plus ou moins heureux que l'ambiance du village
  personalMood(v, campB){
    const why = [];
    const f = this.famOf(v);
    const fed = f ? (f.fed===undefined ? 1 : f.fed) : 1;
    if(fed<0.5) why.push(["A faim", -15]); else if(fed<0.999) why.push(["Mange trop peu", -6]);
    if(v.sick>0) why.push(["Malade", -10]); else if(v.health<40) why.push(["Santé fragile", -5]);
    if(v.grief>0) why.push(["En deuil"+(v.griefFor ? " de "+v.griefFor : ""), -12]);
    if(v.joy>0) why.push([v.joyFor || "Heureux événement", 8]);
    if(!f || f.home<0) why.push(["Sans logis", -10]);
    else if(campB && f.home===campB.id) why.push(["Vit au campement", -4]);
    if(v.work>0 && !v.appr && this.canWork(v)){
      const b = this.buildings.find(x=>x.id===v.work), sk = this.jobSkill(b);
      if(sk){
        const best = this.bestSkill(v), bs = v.skills[best]||0, js = v.skills[sk]||0;
        if(js>=30 && js>=bs-5) why.push(["Aime son métier", 4]);
        else if(bs>=40 && js<bs-25) why.push(["Voudrait travailler : "+SKILL_DEFS[best].name.toLowerCase(), -5]);
      }
      if(this.stageOf(v)==="elder") why.push(["Fatigué par l'âge", -3]);
    }
    if(v.appr) why.push(["Apprend un métier", 3]);
    return { total: why.reduce((s, w)=>s+w[1], 0), why };
  }
  // ce que fait un villageois, en quelques mots (pour l'interface)
  villagerStatus(v){
    const st = this.stageOf(v), fem = v.sex==="f";
    const b = v.work>0 ? this.buildings.find(x=>x.id===v.work) : null;
    let s;
    if(v.appr && b) s = "Apprenti"+(fem?"e":"")+" · "+BUILD_DEFS[b.def].name;
    else if(st==="baby") s = "Nourrisson";
    else if(st==="child") s = "Enfant";
    else if(st==="teen") s = "Adolescent"+(fem?"e":"")+(v.work<0 ? " · peut être apprenti"+(fem?"e":"") : "");
    else if(st==="elder" && this.ageOf(v)>=AGE_RETIRE) s = "Retraité"+(fem?"e":"");
    else if(b) s = (this.jobTitle(v) || BUILD_DEFS[b.def].name)+(b.done ? "" : " (chantier)");
    else s = fem ? "Journalière" : "Journalier";
    if(v.sick>0) s += " · malade";
    return s;
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
    // croissance des cultures : selon le calendrier de chaque culture, la pluie et la sécheresse
    const wMul = (this.weather==="rain" ? 1.1 : this.weather==="snow" ? 0 : 1) * (this.wx==="drought" ? 0.4 : 1);
    for(const b of this.buildings){
      if(!b.done || b.def!=="field" || !b.f || !b.f.sown || b.f.growth>=1) continue;
      const k = this.cropCal(this.liveCrop(b.f)).grow[t.month];
      if(k) b.f.growth = Math.min(1, b.f.growth + GROW_RATE*k*wMul);
    }
    for(const v of this.villagers) this.stepVillager(v);
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
        for(const f of this.villagers) if(f.task && f.task.type==="hunt" && f.task.deer!==undefined && f.state!=="idle") hunting.add(f.task.deer);
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
      if(!f.usedThisYear){ f.fert=Math.min(1, f.fert+0.12); f.rested=true; } // jachère (ni semé ni récolté cette année)
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
    // ----- étape 5 : aléas des champs, puis la vie des troupeaux (lait, laine, naissances, foin) -----
    this.farmMonth(m);
    this.herdMonth(m);
    // production des extensions de cour
    const summer = m>=7 && m<=9;
    const beeSeason = m>=3 && m<=8;
    for(const b of this.buildings){
      if(!b.done || b.def!=="burgage") continue;
      const yf = this.yardFactor(b); // parcelle tracée : production à la mesure de l'arrière-cour
      for(const e of b.exts){
        if(e==="garden")  this.stock.veg=Math.min(this.capFor("veg"), this.stock.veg+0.5*yf);
        if(e==="chicken") this.stock.eggs=Math.min(this.capFor("eggs"), this.stock.eggs+0.5*yf);
        if(e==="orchard" && summer) this.stock.apples=Math.min(this.capFor("apples"), this.stock.apples+1*yf);
        if(e==="beehive" && beeSeason) this.stock.honey=Math.min(this.capFor("honey"), this.stock.honey+0.5*yf);
        if(e==="tailor"){
          // étape 5 : le tailleur file la laine ou le lin ; sans fibre, il rapièce (moitié moins)
          const want=1*yf, w=Math.min(this.stock.wool||0, want), fl=Math.min(this.stock.flax||0, want-w);
          this.stock.wool-=w; this.stock.flax-=fl;
          this.stock.clothes=Math.min(this.capFor("clothes"), this.stock.clothes + w + fl + (want-w-fl)*0.5);
        }
        if(e==="brewer"){ const nb=Math.min(this.stock.barley, yf); if(nb>=1 || (nb>0 && yf<1)){ this.stock.barley-=nb; this.stock.ale=Math.min(this.capFor("ale"), this.stock.ale+nb); } }
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
    // ----- consommation des foyers : chacun mange selon son âge ; bois de chauffe par maison -----
    const market=this.marketActive();
    const available=FOOD_TYPES.filter(k=>this.stock[k]>0.5);
    const accessible=market?available:available.slice(0,1);
    const varietyVillage=accessible.length; // variété offerte par le marché
    let starved=0;
    for(const f of this.families){
      const mem = this.membersOf(f.id);
      let need = mem.reduce((s,v)=>s+FOOD_NEED[this.stageOf(v)], 0);
      const want = need;
      let ate=0, turn=0;
      while(need>0.001 && accessible.length>0){
        accessible.sort((a,b)=>this.stock[b]-this.stock[a]);
        // on alterne les types pour la variété alimentaire (comme les étals d'un marché)
        const k = (turn%2===1 && accessible.length>1) ? accessible[1] : accessible[0];
        turn++;
        const bite = Math.min(need, 0.5);
        if(this.stock[k]<bite) break;
        this.stock[k]-=bite; ate+=bite; need-=bite;
        if(this.stock[k]<0.5){ const ix=accessible.indexOf(k); if(ix>=0) accessible.splice(ix,1); }
      }
      f.lastAte=Math.round(ate*100)/100; f.lastVariety=varietyVillage;
      f.fed = want>0 ? Math.min(1, ate/want) : 1;
      if(want>0 && f.fed<0.5){ f.starving=(f.starving||0)+1; starved++; } else f.starving=0;
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
    // étape 5 : le lait tourne vite (pas encore de laiterie), les pois secs se gardent
    for(const k of FOOD_TYPES) this.stock[k]=Math.max(0,this.stock[k]*(1-(k==="milk" ? 0.5 : k==="pulses" ? spoil*0.3 : spoil)));
    // effets des décrets actifs
    if(this.policies.tithe){ this.influence += 8; }
    if(this.policies.freeMarket){ this.wealth += 6; }
    if(this.policies.militiaService){ /* milice déjà comptée dans militiaCount */ }
    // influence passive : église + manoir
    if(this.hasChurch()) this.influence += 1 + this.churchBonus().influence;
    if(this.hasManor()) this.influence += 1;
    // ----- étape 4 : la vie des villageois (santé, naissances, mariages, décès, apprentissage) -----
    this.demography(winter, fuelRatio);
    // approbation : chaque cause est gardée pour être expliquée au joueur
    const why = [["Base", 50]];
    const add = (label, v)=>{ if(v) why.push([label, v]); };
    add(varietyVillage>=3 ? "Nourriture variée ("+varietyVillage+" sortes)" : varietyVillage===2 ? "Deux sortes de nourriture" : varietyVillage===1 ? "Une seule sorte de nourriture" : "Plus rien à manger",
        varietyVillage>=3 ? 12 : varietyVillage===2 ? 6 : varietyVillage===1 ? -2 : -8);
    add(fuelRatio>=1 ? "Bois de chauffe suffisant" : "Manque de bois de chauffe", fuelRatio>=1 ? 4 : fuelRatio>=0.5 ? -5 : -15);
    add(clothRatio>=1 ? "Vêtements pour tous" : "Manque de vêtements", clothRatio>=1 ? 4 : clothRatio>=0.5 ? -3 : -8);
    if(winter) add(aleRatio>=1 ? "Ale pour l'hiver" : "Pas d'ale cet hiver", aleRatio>=1 ? 3 : aleRatio<0.5 ? -6 : 0);
    if(this.hasChurch()) add("Église", 6 + this.churchBonus().approval);
    if(this.buildings.some(b=>b.done&&b.def==="tower")) add("Tour de guet", 4);
    add(this.buildings.some(b=>b.done&&b.def==="market") ? "Marché" : "Pas de marché", this.buildings.some(b=>b.done&&b.def==="market") ? 4 : -4);
    const homeless=this.families.filter(f=>f.home<0).length;
    add("Familles sans logis", -Math.min(24, homeless*12));
    const campB=this.buildings.find(b=>b.def==="camp");
    if(campB) add("Vie au campement", -Math.min(6, this.families.filter(f=>f.home===campB.id).length*2)); // (léger)
    add("Impôt de "+Math.round(this.taxRate*100)+" %", -(this.taxRate-0.1)*40);
    if(this.policies.tithe) add("Dîme", -4);
    if(this.policies.freeMarket) add("Marchés libres", 3);
    if(this.policies.militiaService) add("Service militaire", -3);
    if(starved>0) add("Des familles ont faim", -8);
    // humeur des habitants : deuils, maladies, joies, métier (effet modéré sur l'ensemble)
    const pers = this.villagers.map(v=>this.personalMood(v, campB));
    if(pers.length){
      const avg = pers.reduce((s,p)=>s+p.total, 0)/pers.length;
      add("Humeur des habitants", Math.max(-6, Math.min(3, Math.round(avg/2))));
    }
    let a = why.reduce((s,w)=>s+w[1], 0);
    this.approvalWhy = why.map(w=>[w[0], Math.round(w[1])]);
    this.approval=Math.max(0,Math.min(100,Math.round(a)));
    this.villagers.forEach((v, i)=>{ v.mood = Math.max(0, Math.min(100, Math.round(this.approval + pers[i].total))); v.why = pers[i].why; });
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
    const tradeActive = this.buildings.some(b=>b.done && b.def==="trade" && this.workersOf(b).length>0);
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
      // un négociant habile vend mieux (de −10 % pour un novice à +10 % pour un maître)
      let ts = 0;
      for(const tb of this.buildings) if(tb.done && tb.def==="trade") for(const v of this.workersOf(tb)) ts = Math.max(ts, v.skills.trade||0);
      earned = Math.round(earned * (0.9 + 0.2*ts/100));
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
      const ok=(res.fed!==undefined ? res.fed>=0.999 : res.lastAte>=1) && fuelRatio>=1 && market && varietyVillage>=2 && clothRatio>=1;
      if(ok) b.monthsGood++; else b.monthsGood=0;
      if(b.lvl===1 && b.monthsGood>=3 && this.stock.timber>=2){ this.stock.timber-=2; b.lvl=2; this.toast("Un bourgage évolue : niveau 2 !","good"); }
      else if(b.lvl===2 && b.monthsGood>=3 && this.approval>=65 && this.hasChurch() && this.stock.timber>=2 && this.stock.stone>=2){
        this.stock.timber-=2; this.stock.stone-=2; b.lvl=3; this.toast("Un bourgage évolue : niveau 3 ! Impôts accrus.","good");
      }
    }
    this.rehouseCamp();
    // les jeunes couples qui vivent chez leurs parents prennent les maisons libres avant les nouveaux venus
    this.rehouseCouples();
    // migration (personne ne s'installe dans un village au bord de la famine)
    if(this.approval>=40){
      const free=this.freeBurgages();
      const foodTotal=FOOD_TYPES.reduce((s,k)=>s+this.stock[k],0);
      const n=(this.approval>=75)?2:1;
      for(let i=0;i<n && i<free;i++){
        if(foodTotal < (this.foodNeed()+i+1)*0.8) break;
        const fb=this.buildings.find(bd=>bd.done&&bd.def==="burgage"&&!this.families.some(f=>f.home===bd.id));
        if(!fb) break;
        const f=this.makeFamily();
        f.home=fb.id;
        // point d'entrée praticable sur le bord ouest : toute la famille arrive à pied
        let ey=Math.floor(H/2);
        for(let y2=0;y2<H;y2++){ const yy=(Math.floor(H/2)+y2)%H; if(this.passable(0,yy)){ ey=yy; break; } }
        const mem = this.populateFamily(f, this.randomFamilyKind(), 0.5, ey+0.5);
        const spot=this.spotFor(fb, 0.5, ey+0.5);
        const p0 = spot ? this.astar(0,ey,spot.x,spot.y) : null;
        mem.forEach((v, k)=>{
          v.x = 0.5 - k*0.4; v.y = ey+0.5;
          if(p0 && p0.length>0){ v.path = p0.map(q=>({ x:q.x, y:q.y })); v.state="settle"; }
          else if(spot){ v.x=spot.x+0.5; v.y=spot.y+0.5; v.state="idle"; }
          else { v.x=fb.x+0.5; v.y=fb.y+0.5; v.state="idle"; }
        });
        this.toast(f.name+" s'installe dans la seigneurie ("+mem.length+" personne"+(mem.length>1?"s":"")+") !","good");
      }
    }
    const leavers=this.families.filter(c=>!c.founder);
    if(this.approval<30 && this.families.length>1 && leavers.length>0){
      // les nouveaux arrivants repartent en premier ; les survivants du départ restent toujours
      let f=leavers[0];
      for(const c of leavers) if(c.id>f.id && c.id<100000) f=c;
      this.removeFamily(f.id);
      this.toast(f.name+" quitte la seigneurie, déçue…","bad");
    }
    // postes voulus : on y place les adultes devenus libres
    this.fillJobs();
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
    if(m===3) this.livestockFair();
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
        this.plague();
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

  // peste : les plus fragiles (anciens, petits, malades) en meurent, d'autres tombent malades
  plague(){
    const n=Math.max(0, Math.min(this.villagers.length-1, 2+Math.floor(this.rnd()*3)));
    const frail=(v)=>v.health - (this.stageOf(v)==="elder" ? 30 : this.stageOf(v)==="baby" ? 20 : 0) + this.rnd()*25;
    const victims=this.villagers.slice().sort((a,b)=>frail(a)-frail(b)).slice(0, n);
    for(const v of this.villagers) if(victims.indexOf(v)<0 && this.rnd()<0.25){ v.sick=Math.max(v.sick||0, 2); }
    this.approval=Math.max(0,this.approval-10);
    this.toast("☠️ Une peste frappe la seigneurie ! "+(victims.length ? victims.map(v=>this.fullName(v)).join(", ")+" en "+(victims.length>1?"meurent":"meurt")+"." : ""),"bad");
    for(const v of victims) this.die(v, "de la peste", true);
    this.cleanFamilies();
    return victims.length;
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
    if(b.def==="pasture") return this.pastureStatus(b);
    if(b.def==="field") return this.fieldStatus(b);
    if(!b.done) return "En construction : "+BUILD_STAGES[buildStage(b)].name.toLowerCase()+" ("+Math.round(b.progress*100)+" %)";
    const nw = d.fam>0 ? this.workersOf(b).length : 0;
    if(d.fam>0 && nw===0) return (Number(b.want)||0)>0 ? "En attente d'un adulte libre" : "Aucun ouvrier";
    switch(b.def){
      case "woodcutter": return this.findForestNear(b)<0 ? "Plus d'arbres à portée" : "Abattage en cours";
      case "forager": return !this.berrySeason() ? "Repos d'hiver" : (this.findBerryNear(b)<0 ? "Plus de baies à portée" : "Cueillette en cours");
      case "hunter": return this.findDeerNear(b) ? "Chasse en cours" : "Aucun gibier à portée";
      case "quarry": { const i=b.y*W+b.x; return this.stoneAmt[i]<=0 ? "Carrière épuisée" : "Extraction en cours"; }
      case "farm": return this.farmStatus(b);
      case "windmill": return this.stock.grain>0 ? "Mouture du grain" : "En attente de grain";
      case "market": return nw>0 ? "Étals tenus" : "Marché inactif";
      case "trade": return nw>0 ? "Comptoir actif (ventes auto)" : "Comptoir inactif";
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
  // villageois d'une sauvegarde : vérifiés un par un ; une sauvegarde v3 ou plus ancienne (familles
  // anonymes qui marchaient elles-mêmes) est convertie : chaque famille reçoit ses membres, et le
  // premier adulte reprend la place, le métier et la tâche en cours de l'ancienne famille.
  loadVillagers(data){
    const num = (v)=>typeof v==="number" && isFinite(v);
    const bIds = new Set(this.buildings.map(b=>b.id));
    this.villagers = [];
    if(Array.isArray(data.villagers)){
      const fIds = new Set(this.families.map(f=>f.id));
      for(const v of data.villagers){
        if(!v || typeof v!=="object" || !num(v.id) || !fIds.has(v.fam)) continue;
        const sk = {};
        for(const k of SKILL_ORDER) sk[k] = Math.max(0, Math.min(100, num(v.skills && v.skills[k]) ? v.skills[k] : 0));
        const o = Object.assign({}, v, {
          first: typeof v.first==="string" ? v.first : "?", sex: v.sex==="f" ? "f" : "m",
          bornAt: num(v.bornAt) ? Math.round(v.bornAt) : this.monthIdx() - 25*12, skills: sk,
          health: num(v.health) ? Math.max(0, Math.min(100, v.health)) : 100, sick: num(v.sick) ? Math.max(0, v.sick) : 0,
          spouse: num(v.spouse) ? v.spouse : -1, mother: num(v.mother) ? v.mother : -1, father: num(v.father) ? v.father : -1,
          work: num(v.work) && bIds.has(v.work) ? v.work : -1, appr: !!v.appr,
          grief: num(v.grief) ? v.grief : 0, joy: num(v.joy) ? v.joy : 0, mood: num(v.mood) ? v.mood : this.approval,
          why: Array.isArray(v.why) ? v.why : [], wt: (v.wt && typeof v.wt==="object") ? v.wt : {},
          x: num(v.x) ? Math.max(0, Math.min(W, v.x)) : W/2, y: num(v.y) ? Math.max(0, Math.min(H, v.y)) : H/2,
          path: Array.isArray(v.path) ? v.path : null, timer: num(v.timer) ? v.timer : 0, cool: num(v.cool) ? v.cool : 0,
          state: typeof v.state==="string" ? v.state : "idle",
        });
        if(o.work<0) o.appr = false;
        this.villagers.push(o);
      }
      const vIds = new Set(this.villagers.map(v=>v.id));
      for(const v of this.villagers) if(v.spouse>=0 && !vIds.has(v.spouse)) v.spouse = -1;
    } else {
      const first = new Map();
      for(const f of this.families){
        const kind = f.founder ? (this.rnd()<0.5 ? "family" : "household") : this.randomFamilyKind();
        const fx = num(f.x) ? f.x : W/2, fy = num(f.y) ? f.y : H/2;
        const mem = this.populateFamily(f, kind==="single" ? "household" : kind, fx, fy);
        const lead = mem.find(v=>this.isAdult(v)) || mem[0];
        if(lead){
          first.set(f.id, lead);
          for(const k of ["path","state","timer","task","carry","cool"]) if(f[k]!==undefined) lead[k] = f[k];
          lead.x = fx; lead.y = fy;
          lead.work = num(f.work) && bIds.has(f.work) ? f.work : -1;
        }
        for(const k of ["x","y","path","state","timer","task","carry","cool","work"]) delete f[k];
        f.fed = num(f.lastAte) && f.lastAte>=1 ? 1 : 0.5;
      }
      // les postes : autant d'ouvriers voulus qu'il y avait de familles affectées
      for(const b of this.buildings) if(Array.isArray(b.families)) b.want = b.families.filter(id=>first.has(id)).length;
    }
    for(const b of this.buildings){
      delete b.families;
      if(!num(b.want)) b.want = this.workersOf(b).length;
      const d = BUILD_DEFS[b.def];
      b.want = Math.max(0, Math.min(d ? d.fam : 0, b.want));
    }
    this.cleanFamilies();
    this.nextV = Math.max(0, ...this.villagers.map(v=>v.id)) + 1;
    if(Array.isArray(data.approvalWhy)) this.approvalWhy = data.approvalWhy.filter(w=>Array.isArray(w) && w.length===2 && typeof w[0]==="string" && num(w[1]));
  }
  serialize(){
    return {
      v:5, // v5 : champs détaillés (b.f), pâturages (b.herd), bœufs (oxen) ; v4 : villageois ; v3 : parcelles de bourgage (b.plot)
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
      villagers:this.villagers,
      approvalWhy:this.approvalWhy,
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
      oxen:this.oxen,
      nextA:this.nextA,
      wx:this.wx,
      keepCalves:this.keepCalves,
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
          b.plot = { cells, dir: b.def==="pasture" ? -1 : Number.isInteger(p.dir) && p.dir>=0 && p.dir<4 ? p.dir : 2 };
          if(Array.isArray(p.poly) && p.poly.length>=3 && p.poly.every(q=>Array.isArray(q) && q.length===2 && q.every(v=>typeof v==="number" && isFinite(v)) && q[0]>=0 && q[0]<=W && q[1]>=0 && q[1]<=H))
            b.plot.poly = p.poly.map(q=>[q[0], q[1]]);
        }
      }
      if(b.def==="pasture") b.herd = g.normHerd(b.herd);
      return b;
    }).filter(b=>b.def!=="pasture" || (b.plot && b.plot.cells.length>=2));
    g.families = Array.isArray(data.families) ? data.families.filter(f=>f && typeof f==="object" && num(f.id)) : [];
    for(const f of g.families){ if(typeof f.name!=="string") f.name = "Famille ?"; if(!num(f.home)) f.home = -1; }
    g.deer = Array.isArray(data.deer) ? data.deer : [];
    if(data.stock && typeof data.stock==="object") g.stock = Object.assign(g.stock, data.stock);
    // une seule chose par arrière-cour : les agrandissements en trop des anciennes sauvegardes sont remboursés
    for(const b of g.buildings) if(b.plot && b.exts.length>1){
      for(const e of b.exts.slice(1)){ const d=EXT_DEFS[e]; if(d) for(const k of Object.keys(d.cost)) g.stock[k]=(g.stock[k]||0)+d.cost[k]; }
      b.exts = b.exts.slice(0,1);
    }
    if(data.time && num(data.time.tick) && num(data.time.day) && num(data.time.month) && num(data.time.year)){
      g.time = { tick:Math.max(0,data.time.tick), day:Math.max(0,data.time.day),
                 month:Math.max(0,Math.min(11,data.time.month)), year:Math.max(0,data.time.year) };
    }
    // étape 5 : champs (anciennes sauvegardes : la jachère n'est plus labourée ni semée)
    for(const b of g.buildings) if(b.def==="field"){
      b.f = g.normField(b.f && typeof b.f==="object" ? b.f : {});
      if(b.f.crop==="fallow" && b.f.sown){ b.f.sown=false; delete b.f.sownCrop; b.f.plow=0; b.f.sowP=0; b.f.growth=0; b.f.harvestP=0; b.f.usedThisYear=false; }
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
    g.loadVillagers(data);
    g.nextD = Math.max(0, ...g.deer.map(d=>num(d.id)?d.id:0)) + 1;
    // étape 5 : bœufs (une sauvegarde v4 n'avait qu'un nombre), identifiants des bêtes, aléa du mois
    if(Array.isArray(data.oxen)) g.oxen = data.oxen.filter(o=>o && num(o.a)).map(o=>({ id:num(o.id) ? o.id : 0, a:Math.max(0, Math.round(o.a)), h:num(o.h) ? Math.max(0, Math.min(100, o.h)) : 100 }));
    else { g.oxen = []; for(let k=0; k<Math.max(0, Math.min(20, Math.floor(num(g.stock.ox) ? g.stock.ox : 0))); k++) g.oxen.push({ id:0, a:60, h:100 }); }
    let na = Math.max(0, num(data.nextA) ? data.nextA : 0);
    for(const o of g.oxen) na = Math.max(na, o.id+1);
    for(const b of g.buildings) if(b.herd) for(const a of b.herd.an) na = Math.max(na, a.id+1);
    g.nextA = Math.max(1, na);
    for(const o of g.oxen) if(!o.id) o.id = g.nextA++;
    for(const b of g.buildings) if(b.herd) for(const a of b.herd.an) if(!a.id) a.id = g.nextA++;
    g.syncOx();
    // une sauvegarde d'avant l'étape 5 n'a pas de foin : une meule pour que ses bœufs passent l'hiver
    if(!data.stock || !num(data.stock.hay)) g.stock.hay = 6 + 3*g.oxen.length;
    g.wx = data.wx==="drought" || data.wx==="wet" ? data.wx : null;
    if(data.keepCalves===false) g.keepCalves = false;
    for(const k of Object.keys(g.stock)) if(!num(g.stock[k])) g.stock[k] = 0;
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
    g.markPastures();
    return g;
  }
}

if(typeof module!=="undefined" && module.exports){
  module.exports = { CROP_CAL, GROW_RATE, SHEAF_RES, LIVESTOCK, LIVESTOCK_ORDER, GRASS, PASTURE_MIN, PASTURE_MAX, monthsTxt, isWinterMonth, MONTHS_ABBR, SKILL_DEFS, SKILL_ORDER, SKILL_LEVELS, skillLevel, FOOD_NEED, AGE_TEEN, AGE_ADULT, AGE_ELDER, AGE_RETIRE, STAGE_NAMES, JOB_TITLES, NAMES_M, NAMES_F, SURNAMES, BUILD_STAGES, buildStage, DIRS4, PLOT_FRONT, polyArea, pointInPoly, GameState, BUILD_DEFS, BUILD_ORDER, FOOD_TYPES, EXT_DEFS, EXT_ORDER, CROP_DEFS, CROP_ORDER, FIELD_SIZES, RES_ICONS, W, H,
    T_GRASS, T_FOREST, T_BERRY, T_STONE, T_WATER, MONTHS, SEASONS, seasonOf, REGION_DEFS, REGION_COST, POLICY_DEFS, POLICY_ORDER, CHURCH_UPGRADES, CHURCH_UP_ORDER, SETTLEMENT_LEVELS, MODES, MODE_BY_ID, DIFFICULTIES, DIFF_BY_ID };
}
