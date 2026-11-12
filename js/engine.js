/* Fieldwise — advisory engines: crop scoring, fertiliser maths, simulated forecast,
   irrigation water balance, simulated mandi prices. */
'use strict';

function recommend(){
  const D=DISTRICTS[P.district], temp=D.temp[P.season];
  const water=Math.round(D.rain*RAIN_SHARE[P.season]+IRR[P.irrigation].mm);
  const inS=[],out=[];
  for(const c of CROPS){
    if(!c.s.includes(P.season)){out.push(c);continue}
    let sc=0;const R=[];
    if(c.soil.includes(P.soil)){sc+=25;R.push([1,t('r_soil',L(SOILS[P.soil]))])}else{sc+=8;R.push([0,t('r_soilx',L(SOILS[P.soil]))])}
    const ph=+P.ph; if(ph>=c.ph[0]&&ph<=c.ph[1]){sc+=20;R.push([1,t('r_ph')])}else{const dd=ph<c.ph[0]?c.ph[0]-ph:ph-c.ph[1];sc+=Math.max(0,20-dd*14);R.push([0,t('r_phx',c.ph[0],c.ph[1])])}
    let wf;
    if(water<c.w[0]){wf=Math.max(0,water/c.w[0]);wf=wf*wf;R.push([0,t('r_wlow',water,c.w[0])])}
    else if(water>c.w[1]*1.6){wf=.7;R.push([0,t('r_whigh')])}
    else{wf=1;R.push([1,t('r_w',water)])}
    sc+=30*wf;
    if(temp>=c.t[0]&&temp<=c.t[1]){sc+=15;R.push([1,t('r_t')])}else{const dd=temp<c.t[0]?c.t[0]-temp:temp-c.t[1];sc+=Math.max(0,15-dd*3);R.push([0,t('r_tx',temp)])}
    if(c.leg){sc+=10;R.push([1,t('r_leg')])}else if(lvlN(+P.N)==='low'&&c.npk[0]>=100){sc+=6;R.push([0,t('r_nlow')])}else sc+=10;
    inS.push({c,score:Math.round(Math.min(100,sc)),R});
  }
  inS.sort((a,b)=>b.score-a.score);
  return {list:inS,out,water,temp};
}
function ensureCrop(){
  const r=recommend();
  if(!P.crop||!C(P.crop).s.includes(P.season)){P.crop=r.list[0].c.id;saveProfile()}
  return r;
}
function fertPlan(c){
  const lv=[lvlN(+P.N),lvlP(+P.P),lvlK(+P.K)];
  const f=l=>l==='low'?1.25:l==='high'?.75:1;
  const ha=c.npk.map((v,i)=>v*f(lv[i]));
  const acres=+P.area||1, perField=ha.map(v=>v*acres/2.471);
  const dap=perField[1]/.46, nFromDap=dap*.18, urea=Math.max(0,perField[0]-nFromDap)/.46, mop=perField[2]/.6;
  const kg={urea,dap,mop}, bags={}; let cost=0;
  for(const k in kg){bags[k]=Math.ceil(kg[k]/FERT[k].bag-0.05);if(kg[k]<1)bags[k]=0;cost+=bags[k]*FERT[k].cost}
  return {lv,ha,perField,kg,bags,cost};
}
function forecast(){
  const D=DISTRICTS[P.district], base=D.temp[P.season];
  const today=new Date(); const r=rng(hash(P.district+today.toDateString()));
  const rainBase={kharif:.55,rabi:.12,zaid:.15}[P.season];
  const out=[];
  for(let i=0;i<7;i++){
    const d=new Date(today);d.setDate(d.getDate()+i);
    const tmax=Math.round(base+5+(r()*4-2)), tmin=Math.round(base-6+(r()*4-2));
    let rp=Math.round(Math.min(95,Math.max(3,(rainBase+(r()-.5)*.5)*100)));
    const rain=r()*100<rp?Math.round((P.season==='kharif'?6:2)+r()*(P.season==='kharif'?30:10)):0;
    const hum=Math.round(Math.min(98,(P.season==='kharif'?72:48)+r()*20+(rain?10:0)));
    const wind=Math.round(5+r()*16);
    out.push({d,tmax,tmin,rp,rain,hum,wind});
  }
  return out;
}
function waterPlan(fc,c){
  const thr=SOIL_TAW[P.soil]; let def=thr*.55; const days=[];
  for(const f of fc){
    const tm=(f.tmax+f.tmin)/2, et0=.0023*(tm+17.8)*Math.sqrt(Math.max(1,f.tmax-f.tmin))*14;
    const etc=c.kc*et0; def=Math.max(0,def+etc-.8*f.rain);
    let irr=0; if(def>=thr){irr=Math.round(def/5)*5;def=0}
    days.push({et0,etc,def,irr,spray:f.rp<40&&f.wind<15&&f.rain===0});
  }
  return {days,thr};
}
function mandiData(c){
  const D=DISTRICTS[P.district]; const r=rng(hash(c.id+P.district+new Date().toDateString().slice(4,10)));
  const drift=(r()-.45)*.006;
  return D.mk.map((m,i)=>{
    const f=1+(r()-.5)*.08; let p=c.p*f*(1-drift*30); const s=[];
    for(let k=0;k<30;k++){p=p*(1+drift+(r()-.5)*.018);s.push(p)}
    return {m,s,today:s[29],ch:(s[29]-s[22])/s[22]*100};
  });
}
