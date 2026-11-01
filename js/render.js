/* ================= RENDU PIXEL ================= */
function seasonPalette(season       ){
  switch(season){
    case 0: return { grass:"#dfe4ea", grassD:"#c9d2da", treeA:"#4a6b52", treeB:"#3a5a44", trunk:"#5a4632", water:"#7aa0c4", wave:"#9ab8d4", berry:"#8a2a2a", soil:"#9aa4ae" };
    case 1: return { grass:"#7cb342", grassD:"#6a9c3a", treeA:"#4e8f3a", treeB:"#3a732c", trunk:"#6a4a2a", water:"#3f6fae", wave:"#6b95c8", berry:"#c43a3a", soil:"#8a7a4e" };
    case 2: return { grass:"#6aa84f", grassD:"#5a9440", treeA:"#3f7f33", treeB:"#2f6626", trunk:"#6a4a2a", water:"#3668a4", wave:"#6b95c8", berry:"#c43a3a", soil:"#8a7a4e" };
    default: return { grass:"#a89a4e", grassD:"#948540", treeA:"#b0743a", treeB:"#965e2c", trunk:"#6a4a2a", water:"#3f6f9e", wave:"#6b95c8", berry:"#c43a3a", soil:"#8a7a4e" };
  }
}

function px(ctx                         , x       , y       , w       , h       , c       ){
  ctx.fillStyle=c; ctx.fillRect(x,y,w,h);
}

function drawTile(ctx                         , g          , x       , y       , pal                                 ){
  const i=y*W+x;
  const h=hash2(x,y);
  const t=g.tiles[i];
  const base = t===T_WATER ? pal.water : pal.grass;
  px(ctx, x, y, 1.02, 1.02, base);
  if(t===T_GRASS || t===T_FOREST || t===T_BERRY){
    // touffes d'herbe
    const n=2+ (h%3);
    for(let k=0;k<n;k++){
      const ox=((h>>(k*3))%10)/10, oy=((h>>(k*3+7))%10)/10;
      px(ctx, x+ox*0.8, y+oy*0.8, 0.1, 0.12, pal.grassD);
    }
  }
  if(t===T_WATER){
    const w=Math.floor(g.time.tick/24);
    if(((x*3+y*5+w)%7)===0) px(ctx, x+0.1, y+((x+y)%2===0?0.3:0.6), 0.5, 0.08, pal.wave);
    return;
  }
  if(t===T_FOREST){
    // tronc + houppier pixel
    px(ctx, x+0.44, y+0.55, 0.12, 0.34, pal.trunk);
    const big=(h%2)===0;
    const cw=big?0.76:0.6, chh=big?0.52:0.42;
    px(ctx, x+(1-cw)/2, y+0.18, cw, chh, pal.treeA);
    px(ctx, x+(1-cw)/2+0.06, y+0.08, cw-0.12, 0.16, pal.treeB);
    if(seasonOf(g.time.month)===0) px(ctx, x+(1-cw)/2+0.1, y+0.06, cw-0.2, 0.07, "#eef2f6");
  }
  if(t===T_BERRY){
    px(ctx, x+0.15, y+0.28, 0.7, 0.5, pal.treeB);
    px(ctx, x+0.25, y+0.2, 0.5, 0.18, pal.treeA);
    const amount=g.berryY[i];
    const inSeason=g.berrySeason();
    if(inSeason && amount>0.5){
      const dots = amount>4?3:amount>2?2:1;
      const pos=[[0.3,0.5],[0.6,0.42],[0.45,0.68]];
      for(let k=0;k<dots;k++) px(ctx, x+pos[k][0], y+pos[k][1], 0.09, 0.09, pal.berry);
    }
  }
  if(t===T_STONE){
    px(ctx, x+0.2, y+0.35, 0.6, 0.4, "#8a8f96");
    px(ctx, x+0.3, y+0.22, 0.4, 0.2, "#9aa0a8");
    px(ctx, x+0.38, y+0.3, 0.22, 0.14, "#b8bec6");
  }
}

function drawBuilding(ctx                         , g          , b         ){
  const {x,y,w,h}=b;
  // ombre
  ctx.fillStyle="rgba(0,0,0,0.18)";
  ctx.fillRect(x+0.06, y+h-0.14, w-0.1, 0.14);
  if(!b.done){
    // chantier
    px(ctx, x+0.1, y+0.3, 0.08, h-0.35, "#7a5a34");
    px(ctx, x+w-0.18, y+0.3, 0.08, h-0.35, "#7a5a34");
    px(ctx, x+0.1, y+0.3, w-0.2, 0.07, "#9a7a4a");
    px(ctx, x+0.1, y+h*0.6, w-0.2, 0.07, "#9a7a4a");
    // tas de matériaux
    px(ctx, x+w*0.3, y+h-0.4, w*0.4, 0.22, "#6a4a2a");
    // barre de progression
    px(ctx, x-0.05, y-0.28, w+0.1, 0.12, "#222");
    px(ctx, x-0.05, y-0.28, (w+0.1)*b.progress, 0.12, "#7bd88f");
    return;
  }
  switch(b.def){
    case "burgage":{
      px(ctx, x+0.04, y+0.04, 0.92, 0.92, "#9c8a5a"); // cour
      const hw=0.66, hh=0.5;
      px(ctx, x+(1-hw)/2, y+0.12, hw, hh, "#c9b088"); // mur
      const roof=b.lvl===1?"#a8823c":b.lvl===2?"#8a5138":"#55606e";
      px(ctx, x+(1-hw)/2-0.04, y+0.04, hw+0.08, 0.2, roof);
      px(ctx, x+(1-hw)/2+0.02, y+0.06, hw-0.04, 0.06, "#00000022");
      px(ctx, x+0.5-0.05, y+0.38, 0.1, 0.24, "#5a4328"); // porte
      if(b.lvl>=3) px(ctx, x+0.78, y+0.06, 0.06, 0.22, "#b03030"); // bannière
      const exts = b.exts || [];
      if(exts.includes("garden")){ for(let k=0;k<3;k++) px(ctx, x+0.08+k*0.13, y+0.80, 0.08, 0.14, "#4f8f3a"); }
      if(exts.includes("chicken")){ px(ctx, x+0.70, y+0.78, 0.09, 0.09, "#f0ead8"); px(ctx, x+0.82, y+0.82, 0.07, 0.07, "#f0ead8"); }
      if(exts.includes("orchard")){ px(ctx, x+0.78, y+0.62, 0.14, 0.16, "#3a6b2a"); px(ctx, x+0.80, y+0.64, 0.05, 0.05, "#c43a3a"); }
      if(exts.includes("beehive")){ px(ctx, x+0.12, y+0.66, 0.14, 0.12, "#d4a83a"); px(ctx, x+0.14, y+0.64, 0.1, 0.04, "#8a6a2a"); }
      if(exts.includes("tailor")){ px(ctx, x+0.62, y+0.80, 0.12, 0.12, "#7a5a8a"); }
      if(exts.includes("brewer")){ px(ctx, x+0.30, y+0.80, 0.12, 0.14, "#8a6a2a"); }
      break;
    }
    case "woodcutter":{
      px(ctx, x+0.1, y+0.55, 0.8, 0.12, "#7a5a34");
      px(ctx, x+0.2, y+0.45, 0.6, 0.1, "#8a6a3c");
      px(ctx, x+0.28, y+0.35, 0.44, 0.1, "#9a7a4a");
      px(ctx, x+0.6, y+0.1, 0.3, 0.26, "#c9b088");
      px(ctx, x+0.56, y+0.04, 0.38, 0.1, "#6a4a2a");
      break;
    }
    case "forager":{
      px(ctx, x+0.22, y+0.2, 0.56, 0.5, "#8a6a3c");
      px(ctx, x+0.18, y+0.12, 0.64, 0.12, "#5f8f3a");
      px(ctx, x+0.66, y+0.72, 0.22, 0.2, "#b08a4a"); // panier
      px(ctx, x+0.68, y+0.74, 0.18, 0.08, "#c43a3a");
      break;
    }
    case "hunter":{
      // tente
      px(ctx, x+0.2, y+0.3, 0.6, 0.06, "#6a4a2a");
      px(ctx, x+0.26, y+0.36, 0.48, 0.06, "#7a5a34");
      px(ctx, x+0.32, y+0.42, 0.36, 0.06, "#8a6a4a");
      px(ctx, x+0.38, y+0.48, 0.24, 0.06, "#9a7a5a");
      px(ctx, x+0.42, y+0.54, 0.16, 0.3, "#6a4a2a"); // mât
      px(ctx, x+0.86, y+0.66, 0.1, 0.3, "#8a8f96"); // pointe de flèche
      break;
    }
    case "quarry":{
      px(ctx, x+0.05, y+0.05, 0.9, 0.9, "#6f7276");
      px(ctx, x+0.2, y+0.2, 0.6, 0.6, "#5a5d62");
      px(ctx, x+0.3, y+0.3, 0.24, 0.24, "#8a8f96");
      px(ctx, x+0.58, y+0.5, 0.18, 0.18, "#9aa0a8");
      break;
    }
    case "tower":{
      px(ctx, x+0.2, y+0.2, 0.6, 0.7, "#8a8f96");
      px(ctx, x+0.14, y+0.1, 0.72, 0.16, "#6f7276");
      px(ctx, x+0.4, y-0.06, 0.2, 0.2, "#5a5d62");
      px(ctx, x+0.44, y+0.24, 0.12, 0.2, "#3a3d42"); // meurtrière
      break;
    }
    case "wall":{
      px(ctx, x+0.05, y+0.05, 0.9, 0.9, "#9aa0a8");
      px(ctx, x+0.05, y+0.05, 0.9, 0.22, "#b8bdc4");
      px(ctx, x+0.05, y+0.45, 0.9, 0.06, "#6f7276");
      px(ctx, x+0.4, y+0.45, 0.2, 0.06, "#6f7276");
      break;
    }
    case "trade":{
      px(ctx, x+0.08, y+0.08, w-0.16, h-0.16, "#7a5a34");
      px(ctx, x+0.04, y+0.02, w-0.08, 0.22, "#5a3a26");
      px(ctx, x+w/2-0.14, y+0.3, 0.28, h-0.4, "#4a3420"); // porte
      px(ctx, x+0.2, y+0.3, 0.24, 0.18, "#e8c35a"); // enseigne dorée
      px(ctx, x+w-0.4, y+0.3, 0.24, 0.18, "#e8c35a");
      break;
    }
    case "farm":{
      px(ctx, x+0.08, y+0.08, w-0.16, h-0.16, "#8a5138"); // mur
      px(ctx, x+0.04, y+0.02, w-0.08, 0.24, "#5a3a26"); // toit
      px(ctx, x+w/2-0.16, y+0.34, 0.32, h-0.44, "#5a3a26"); // grande porte
      px(ctx, x+0.2, y+0.3, 0.1, 0.1, "#e8e4d8");
      break;
    }
    case "field":{
      const f=b.f; if(!f) break;
      px(ctx, x+0.03, y+0.03, w-0.06, h-0.06, "#7a5230");
      for(let r=0;r<h*2;r++) px(ctx, x+0.05, y+0.1+r*0.5, w-0.1, 0.06, "#6a4426"); // sillons
      if(f.sown || f.growth>0){
        const base = f.crop==="barley" ? (f.growth>0.85 ? "#c8c05a" : f.growth>0.4 ? "#6b9a3c" : "#4a7a35")
                   : f.crop==="fallow" ? "#7a6a4a"
                   : (f.growth>0.85 ? "#d4a83a" : f.growth>0.4 ? "#7ba33c" : "#4f8f3a");
        const c = base;
        for(let r=0;r<h*2;r++){
          const gh=Math.min(0.34, f.growth*0.34);
          px(ctx, x+0.1, y+0.12+r*0.5, w-0.2, gh, c);
        }
      }
      if(f.harvestP>0) px(ctx, x+w/2-0.3, y-0.24, 0.6, 0.1, "#d4a83a");
      break;
    }
    case "windmill":{
      px(ctx, x+w/2-0.28, y+0.2, 0.56, h-0.3, "#d8d4c8");
      px(ctx, x+w/2-0.34, y+0.12, 0.68, 0.16, "#5a4a3a");
      px(ctx, x+w/2-0.1, y+h-0.34, 0.2, 0.26, "#5a4328");
      // ailes
      const ang=g.time.tick*0.02;
      ctx.save();
      ctx.translate(x+w/2, y+0.2);
      ctx.rotate(ang);
      for(let k=0;k<4;k++){
        ctx.rotate(Math.PI/2);
        px(ctx, 0.04, -0.03, 0.72, 0.07, "#3a2f26");
      }
      ctx.restore();
      break;
    }
    case "granary":{
      px(ctx, x+0.15, y+0.3, 0.7, 0.5, "#b08a4a");
      px(ctx, x+0.2, y+0.34, 0.24, 0.2, "#c2a86a");
      px(ctx, x+0.5, y+0.38, 0.24, 0.2, "#c2a86a");
      px(ctx, x+0.35, y+0.58, 0.24, 0.18, "#a8925a");
      break;
    }
    case "storehouse":{
      px(ctx, x+0.12, y+0.3, 0.76, 0.55, "#8a6a3c");
      px(ctx, x+0.12, y+0.3, 0.76, 0.1, "#6a4a2a");
      px(ctx, x+0.2, y+0.42, 0.28, 0.26, "#a8845a");
      px(ctx, x+0.54, y+0.42, 0.28, 0.26, "#a8845a");
      break;
    }
    case "market":{
      // 3 étals rayés
      for(let s=0;s<3;s++){
        const sx2=x+0.1+s*((w-0.2)/3);
        const sw=(w-0.2)/3-0.06;
        px(ctx, sx2, y+0.55, sw, 0.14, "#8a6a3c"); // table
        for(let r=0;r<Math.max(2,Math.floor(sw/0.14));r++){
          px(ctx, sx2+r*0.14, y+0.2, Math.min(0.07,sw-r*0.14), 0.3, r%2===0?"#c94a3a":"#e8e4d8");
        }
      }
      break;
    }
    case "church":{
      px(ctx, x+0.1, y+0.34, w-0.2, h-0.4, "#d8d3c8");
      px(ctx, x+0.06, y+0.16, w-0.12, 0.24, "#3f5a7a");
      px(ctx, x+w/2-0.06, y+0.02, 0.12, 0.18, "#d8d3c8");
      px(ctx, x+w/2-0.02, y-0.1, 0.04, 0.14, "#e8c35a");
      px(ctx, x+w/2-0.05, y-0.06, 0.1, 0.04, "#e8c35a");
      px(ctx, x+w/2-0.08, y+h-0.3, 0.16, 0.26, "#5a4328");
      break;
    }
    case "manor":{
      px(ctx, x+0.06, y+0.24, w-0.12, h-0.32, "#6a4a34");
      px(ctx, x+0.02, y+0.1, w-0.04, 0.2, "#3a2f26");
      for(let k=0;k<4;k++) px(ctx, x+0.1+k*(w/4.6), y+0.26, 0.05, h-0.36, "#3a2f26"); // colombages
      px(ctx, x+w/2-0.14, y+h-0.36, 0.28, 0.3, "#4a3220");
      px(ctx, x+w-0.22, y+0.14, 0.05, 0.4, "#8a8f96");
      px(ctx, x+w-0.21, y+0.14, 0.16, 0.12, "#b03030"); // bannière
      break;
    }
  }
}

const JOB_COLORS                        = {
  laborer:"#8a8a7a", woodcutter:"#a05a2c", forager:"#5a8a3a", hunter:"#6a4a2a",
  quarry:"#7a7a8a", farm:"#3a6a8a", windmill:"#6a5a9a", market:"#a88a3a",
};

function jobColor(g          , f       )       {
  if(f.work<0) return JOB_COLORS.laborer;
  const b=g.buildings.find(x=>x.id===f.work);
  return (b && JOB_COLORS[b.def]) || JOB_COLORS.laborer;
}

function drawWorker(ctx                         , g          , f       ){
  const moving = f.state==="walk" || f.state==="return" || f.state==="settle" || f.state==="wander";
  const bob = moving ? Math.sin(g.time.tick*0.9+f.id)*0.03 : 0;
  const x=f.x-0.16, y=f.y-0.42+bob;
  ctx.fillStyle="rgba(0,0,0,0.2)";
  ctx.fillRect(f.x-0.14, f.y-0.06, 0.28, 0.1);
  px(ctx, x, y, 0.32, 0.34, jobColor(g,f));       // tunique
  px(ctx, x+0.08, y-0.13, 0.16, 0.15, "#e8c39a"); // tête
  px(ctx, x+0.1, y-0.17, 0.12, 0.06, "#5a4632");  // cheveux
  px(ctx, x+0.05, y+0.34, 0.08, 0.1, "#3a2f26");   // jambes
  px(ctx, x+0.19, y+0.34, 0.08, 0.1, "#3a2f26");
  if(f.carry) px(ctx, x+0.2, y-0.08, 0.14, 0.12, "#b08a4a"); // hotte
}

function drawDeer(ctx                         , g          , d     ){
  const bob=Math.sin(g.time.tick*0.5+d.id)*0.02;
  const x=d.x-0.2, y=d.y-0.3+bob;
  ctx.fillStyle="rgba(0,0,0,0.2)";
  ctx.fillRect(d.x-0.18, d.y+0.02, 0.36, 0.08);
  px(ctx, x, y, 0.4, 0.22, "#a8814e");
  px(ctx, x+0.36, y-0.08, 0.14, 0.14, "#96703e");
  px(ctx, x+0.4, y-0.16, 0.03, 0.1, "#d8c8a8");
  px(ctx, x+0.44, y-0.16, 0.03, 0.1, "#d8c8a8");
  px(ctx, x+0.06, y+0.22, 0.05, 0.12, "#7a5c34");
  px(ctx, x+0.28, y+0.22, 0.05, 0.12, "#7a5c34");
}

function drawGame(
  ctx                         , g          , cam                                ,
  canvas                  , hover                                     ,
  buildSel            , selId            , layers          
){
  const dpr = canvas.width/(canvas.clientWidth||1);
  const cw = canvas.width, ch = canvas.height;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.imageSmoothingEnabled = false;
  px(ctx, 0, 0, cw, ch, "#141a26");
  const z = cam.zoom;
  const s = 16*z*dpr;
  const halfW = (canvas.clientWidth||1)/2/(16*z);
  const halfHh = (canvas.clientHeight||1)/2/(16*z);
  ctx.setTransform(s, 0, 0, s, dpr*(canvas.clientWidth||1)/2 - cam.x*s, dpr*(canvas.clientHeight||1)/2 - cam.y*s);

  const pal = seasonPalette(g.season());
  const x0 = Math.max(0, Math.floor(cam.x-halfW)-1), x1 = Math.min(W-1, Math.ceil(cam.x+halfW)+1);
  const y0 = Math.max(0, Math.floor(cam.y-halfHh)-1), y1 = Math.min(H-1, Math.ceil(cam.y+halfHh)+1);

  // sol
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) drawTile(ctx, g, x, y, pal);

  // surtinte des régions non réclamées + frontières
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
    if(!g.regionOwned(x)){
      ctx.globalAlpha=0.25; ctx.fillStyle="#3a2a2a"; ctx.fillRect(x,y,1.02,1.02); ctx.globalAlpha=1;
    }
  }
  const xb1 = Math.floor(W/3), xb2 = Math.floor(2*W/3);
  ctx.strokeStyle="#e8c35a"; ctx.lineWidth=0.06; ctx.setLineDash([0.4,0.3]);
  ctx.beginPath(); ctx.moveTo(xb1, y0); ctx.lineTo(xb1, y1+1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(xb2, y0); ctx.lineTo(xb2, y1+1); ctx.stroke();
  ctx.setLineDash([]);

  // routes
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
    if(g.roads[y*W+x]){
      ctx.fillStyle="#8a7a5a";
      ctx.fillRect(x+0.25,y+0.25,0.5,0.5);
      ctx.fillStyle="#a8946a";
      ctx.fillRect(x+0.38,y+0.38,0.24,0.24);
    }
  }

  // surtintes de filtres de carte (overlays)
  if(layers){
    ctx.globalAlpha=0.30;
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
      const i=y*W+x, t=g.tiles[i];
      if(layers.forest && t===T_FOREST){ ctx.fillStyle="#1d5a2a"; ctx.fillRect(x,y,1.02,1.02); }
      else if(layers.stone && t===T_STONE){ ctx.fillStyle="#9aa0a8"; ctx.fillRect(x,y,1.02,1.02); }
      else if(layers.berry && t===T_BERRY){ ctx.fillStyle="#8f3a7a"; ctx.fillRect(x,y,1.02,1.02); }
      else if(layers.soil && t===T_GRASS){
        const f=g.soil[i];
        ctx.fillStyle = f>0.66?"#3ad44a":f>0.4?"#c8d43a":"#d47a3a";
        ctx.fillRect(x,y,1.02,1.02);
      }
    }
    ctx.globalAlpha=1;
  }

  // surtinte fertilité en mode champ
  if(buildSel==="field"){
    ctx.globalAlpha=0.35;
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
      const f=g.soil[y*W+x];
      if(g.tiles[y*W+x]===T_GRASS){
        ctx.fillStyle = f>0.66?"#3ad44a":f>0.4?"#c8d43a":"#d47a3a";
        ctx.fillRect(x,y,1.02,1.02);
        ctx.fillStyle="#141a26";
        ctx.globalAlpha=1;
        ctx.font="0.4px monospace";
        ctx.fillText(String(Math.round(f*100)), x+0.1, y+0.65);
        ctx.globalAlpha=0.35;
      }
    }
    ctx.globalAlpha=1;
  }

  // grille en mode construction
  if(buildSel){
    ctx.globalAlpha=0.15;
    ctx.strokeStyle="#000"; ctx.lineWidth=0.02;
    for(let x=x0;x<=x1+1;x++){ ctx.beginPath(); ctx.moveTo(x,y0); ctx.lineTo(x,y1+1); ctx.stroke(); }
    for(let y=y0;y<=y1+1;y++){ ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x1+1,y); ctx.stroke(); }
    ctx.globalAlpha=1;
  }

  // bâtiments (triés par y pour l'empilement)
  const bs = [...g.buildings].sort((a,b)=>(a.y+a.h)-(b.y+b.h));
  for(const b of bs) drawBuilding(ctx, g, b);

  // camps de brigands
  for(const c of g.camps){
    px(ctx, c.x-0.4, c.y-0.3, 0.8, 0.5, "#5a3a2a");
    px(ctx, c.x-0.3, c.y-0.4, 0.6, 0.2, "#4a2f22");
    px(ctx, c.x+0.2, c.y-0.1, 0.14, 0.2, "#2a1a12");
    // barre de vie
    px(ctx, c.x-0.45, c.y-0.55, 0.9, 0.1, "#222");
    px(ctx, c.x-0.45, c.y-0.55, 0.9*Math.max(0,c.hp/c.maxHp), 0.1, "#e05a3a");
  }
  // soldats de la milice
  for(const u of g.units){
    px(ctx, u.x-0.12, u.y-0.12, 0.24, 0.24, "#5a6a8a");
    px(ctx, u.x-0.08, u.y-0.16, 0.16, 0.08, "#8a8f96");
    px(ctx, u.x+0.12, u.y-0.05, 0.05, 0.18, "#8a8f96");
    px(ctx, u.x-0.14, u.y-0.14, 0.28, 0.07, "#222");
    px(ctx, u.x-0.14, u.y-0.14, 0.28*Math.max(0,u.hp/u.maxHp), 0.07, "#7bd88f");
  }

  // cerfs
  for(const d of g.deer) drawDeer(ctx, g, d);

  // villageois
  const fs = [...g.families].sort((a,b)=>a.y-b.y);
  for(const f of fs) drawWorker(ctx, g, f);

  // sélection
  if(selId!=null){
    const b=g.buildings.find(x=>x.id===selId);
    if(b){
      ctx.strokeStyle="#ffffff"; ctx.lineWidth=0.06;
      ctx.strokeRect(b.x-0.06, b.y-0.06, b.w+0.12, b.h+0.12);
      const d=BUILD_DEFS[b.def];
      if(d.radius){
        ctx.globalAlpha=0.35; ctx.strokeStyle="#e8c35a"; ctx.lineWidth=0.05;
        ctx.setLineDash([0.3,0.2]);
        ctx.beginPath();
        ctx.arc(b.x+b.w/2, b.y+b.h/2, d.radius, 0, Math.PI*2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha=1;
      }
    }
  }

  // aperçu de construction
  if(buildSel && hover.inside){
    const d=BUILD_DEFS[buildSel];
    const pw = d.uiSize ? g.fieldSize() : d.w;
    const ph = d.uiSize ? g.fieldSize() : d.h;
    const err=g.canPlace(buildSel, hover.tx, hover.ty);
    ctx.globalAlpha=0.4;
    px(ctx, hover.tx, hover.ty, pw, ph, err?"#e05a3a":"#4ae06a");
    ctx.globalAlpha=1;
    ctx.strokeStyle=err?"#e05a3a":"#4ae06a"; ctx.lineWidth=0.06;
    ctx.strokeRect(hover.tx, hover.ty, pw, ph);
    if(d.radius){
      ctx.globalAlpha=0.4; ctx.strokeStyle="#e8c35a"; ctx.setLineDash([0.3,0.2]);
      ctx.beginPath();
      ctx.arc(hover.tx+d.w/2, hover.ty+d.h/2, d.radius, 0, Math.PI*2);
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
    }
  }

  // ===== minimap =====
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const ppt = 2;
  const mw = W*ppt, mh = H*ppt;
  const mmx = (canvas.clientWidth||1) - 8 - mw;
  const mmy = (canvas.clientHeight||1) - 8 - mh;
  if(mmx > 40 && mmy > 40){
    // fond
    ctx.fillStyle = "#1b2434";
    ctx.fillRect(mmx-1, mmy-1, mw+2, mh+2);
    // terrain
    const mmColors = ["#7cb342","#3a5a44","#5f8f5a","#8a8f96","#3f6f9e"];
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const t = g.tiles[y*W+x];
      ctx.fillStyle = mmColors[t];
      ctx.fillRect(mmx+x*ppt, mmy+y*ppt, ppt, ppt);
    }
    // routes
    ctx.fillStyle = "#c9b088";
    for(let y=0;y<H;y++) for(let x=0;x<W;x++) if(g.roads[y*W+x]) ctx.fillRect(mmx+x*ppt, mmy+y*ppt, ppt, ppt);
    // bâtiments
    for(const b of g.buildings){
      ctx.fillStyle = b.done ? "#e8c35a" : "#c97a4a";
      ctx.fillRect(mmx+b.x*ppt, mmy+b.y*ppt, Math.max(ppt,b.w*ppt), Math.max(ppt,b.h*ppt));
    }
    // camps de brigands
    ctx.fillStyle = "#c43a3a";
    for(const c of g.camps) ctx.fillRect(mmx+c.x*ppt-1, mmy+c.y*ppt-1, 3, 3);
    // rectangle de vue
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      mmx + (cam.x - halfW)*ppt, mmy + (cam.y - halfHh)*ppt,
      (halfW*2)*ppt, (halfHh*2)*ppt
    );
    g.mmRect = { x:mmx, y:mmy, w:mw, h:mh, ppt };
  } else {
    g.mmRect = null;
  }
}
