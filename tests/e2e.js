// Автотесты Fac Modo (запуск: node tests/e2e.js). Нужен Playwright; для проверки доступности — axe-core (по желанию).
// Сами поднимают локальный сервер из папки репозитория. Проверяют:
//  1) E2E: приложение открывается, все вкладки работают, нет ошибок; квест даёт XP; автокопия и восстановление (restore test).
//  2) Мобильный браузер: экран iPhone с касаниями — нет ошибок и горизонтальной прокрутки.
//  3) Контракты: сообщения игр по сети (как игры разговаривают с приложением и между телефонами).
//  4) Доступность (axe-core): нет новых серьёзных нарушений.
const {chromium,devices}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');let fails=0;const ok=(c,m)=>{console.log((c?'✅ ':'❌ ')+m);if(!c)fails++};
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
const HARNESS=`<!doctype html><body><script>const g=new URLSearchParams(location.search).get('g');window.LOG=[];
const A=document.createElement('iframe'),B=document.createElement('iframe');A.src=B.src='games/'+g+'.html';document.body.append(A,B);
addEventListener('message',e=>{const m=e.data;if(!m||!m.fm)return;const from=e.source===A.contentWindow?'A':'B';LOG.push({from,m:JSON.parse(JSON.stringify(m))});
 if(m.fm==='net-send'){const to=from==='A'?B:A;setTimeout(()=>to.contentWindow.postMessage({fm:'net-msg',d:m.d},'*'),5)}});
window.go=()=>{A.contentWindow.postMessage({fm:'net-ready',host:true},'*');B.contentWindow.postMessage({fm:'net-ready',host:false},'*')};</script></body>`;
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/__harness.html'){r.writeHead(200,{'Content-Type':'text/html'});return r.end(HARNESS)}
 if(u.endsWith('/'))u+='index.html';const f=path.join(ROOT,u);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end()}
 r.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)});
(async()=>{await new Promise(r=>srv.listen(0,r));const URL='http://localhost:'+srv.address().port+'/';const b=await chromium.launch();
 async function open(opts){const ctx=await b.newContext(opts||{}),p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))});
  await p.goto(URL+'index.html');await p.waitForTimeout(2500);return {ctx,p,errs}}
 async function tabs(p){const t=await p.$$eval('[data-n]',x=>[...new Set(x.map(e=>e.dataset.n))]);for(const n of t){await p.evaluate(n=>{const x=document.querySelector('[data-n="'+n+'"]');x&&x.click()},n);await p.waitForTimeout(120)}return t.length}
 // 1. E2E
 {const {ctx,p,errs}=await open();const n=await tabs(p);ok(n>=4,'E2E: открываются вкладки ('+n+')');
  const xp=await p.evaluate(()=>{const a=calc().xp;const d=st.done[today]=st.done[today]||{};d.e2e={x:25,c:'read'};save();const b=calc().xp;delete d.e2e;save();return b-a});ok(xp===25,'E2E: отметка задания даёт XP');
  const r=await p.evaluate(async()=>{if(!window.abSnap)return 'нет abSnap';st.name='E2E';save();await abSnap('manual');const m=JSON.parse(localStorage.getItem('fm_bkx')).sort((a,b)=>b.id-a.id)[0];st.name='Другое';save();window.confirm=()=>true;
   const x=document.createElement('button');x.dataset.abk='restore';x.dataset.v=m.id;document.body.appendChild(x);x.click();await new Promise(r=>setTimeout(r,800));return m.ok&&st.name==='E2E'});
  ok(r===true,'Restore test: копия проверена и восстанавливается');
  ok(await p.evaluate(()=>{try{applyData('{"broken":1}');return false}catch(e){return true}}),'E2E: повреждённый файл копии не принимается');
  const cal=await p.evaluate(()=>{const R=(s,c,v)=>CALTEST.run(s,c,v),near=(a,b)=>Math.abs(a-b)<=Math.max(Math.abs(b)*.002,.01);
   const om=R('ecl','om',{u:230,r:10}),rr=R('ecl','rr',{r1:100,r2:100}),ti=R('ecl','ti',{r:100,t:20,u:440}),tr=R('ecl','tr',{s:1000,a:6600,b:440,p:'3'}),
    fc=R('mcl','fc',{p:10000,s:180,h:24}),vs=R('mcl','vs',{a:380,ta:50,b:35,tb:100,tx:50}),vk=R('mcl','vk',{mu:90,r:900}),pm=R('mcl','pm',{q:100,h:30,r:1000,e:70});
   return{n:CALTEST.count().join(','),ohm:near(om[1][2],23)&&near(om[3][2],5290),par:near(rr[0][2],200)&&near(rr[1][2],50),iso:near(ti[0][2],25),tr:near(tr[0][2],87.48)&&near(tr[2][2],15),
    fuel:near(fc[2][2],1800)&&near(fc[3][2],43.2),visc:near(vs[0][2],380),vk:near(vk[0][2],100),pump:near(pm[2][2],11.679),
    bad:!!R('ecl','om',{u:5,r:0}).err&&!!R('ecl','om',{}).hint,ui:!!document.getElementById('ecl').querySelector('[data-cal]')&&!!document.getElementById('mcl').querySelector('[data-cal]')}});
  ok(cal.n==='16,9'&&cal.ohm&&cal.par&&cal.iso&&cal.tr&&cal.fuel&&cal.visc&&cal.vk&&cal.pump&&cal.bad&&cal.ui,'Расчёты электромеханика и механика: формулы сходятся с ручным счётом ('+JSON.stringify(cal)+')');
  /* Остойчивость (stb-js). Ручной счёт:
     загрузка 2000 т·7,0 м + 3000 т·5,0 м + 500 т·2,0 м: Δ=5500 т, Σm·KG=14000+15000+1000=30000, KG=30000/5500=5,4545 м; KM=6,5 → GM=1,0455 м;
     цистерна 10×8 м, ρ=1,025: FSM=1,025·10·8³/12=437,333 т·м; + готовый FSM 112,667 → Σ=550 т·м, GG′=550/5500=0,100 м, GM испр.=0,9455 м, KG испр.=5,5545 м;
     крен w=50 т, d=10 м: tanθ=500/(5500·0,9455)=0,09615 → θ=5,49°; GM≤0 → предупреждение, не число;
     качка T=15 с, B=20, d=8, L=120: C=0,373+0,023·2,5−0,043·1,2=0,3789; GM=(2·0,3789·20/15)²=1,0209 м;
     KN 0/1,0/2,05/3,1/4,0/4,6/4,9 при KG=5: GZ=KN−5·sinθ → 0; 0,1318; 0,3399; 0,6; 0,7861; 0,7698; 0,5699;
     A0–30 (Симпсон 3/8)=3·h/8·(0+3·0,1318+3·0,3399+0,6)=0,13188; A0–40 (Симпсон 1/3)=h/3·(0+4·0,1318+2·0,3399+4·0,6+0,7861)=0,25557; A30–40=0,12369 (h=10°=0,17453 рад);
     θf=35°: A0–35=0,13188+(5°=0,08727 рад)·(0,6+0,6930)/2=0,18830, A30–35=0,05642; максимум (парабола 30–40–50): 44,2°, GZ 0,8039 м — все 6 критериев ✅.
     Плохой случай KN 0/0,1/0,2/0,3/0,35/0,38/0,38 при KG=0,5 и GM=0,1: GZ 0; 0,013; 0,029; 0,05; 0,029; −0,003; −0,053 — не проходят площади, GZ≥0,20 и GM, угол максимума ≈30° проходит. */
  const stb=await p.evaluate(()=>{const T=STBTEST,near=(a,b,e)=>Math.abs(a-b)<=(e||1e-4);
   const l=T.load([{m:2000,k:7},{m:3000,k:5},{m:500,k:2},{m:'',k:3}]),fs=T.fsm(10,8,1.025),tk=T.tanks([{l:10,b:8,r:1.025},{f:112.6667}]),h=T.heel(50,10,5500,0.945454545),h0=T.heel(50,10,5500,0),
    r=T.roll(15,20,8,120),g=T.gz([0,1.0,2.05,3.1,4.0,4.6,4.9],5),g2=T.gz([0,1.0,2.05,3.1,4.0,4.6,4.9],5,35),c=T.crit(g,0.9455),c2=T.crit(T.gz([0,0.1,0.2,0.3,0.35,0.38,0.38],0.5),0.1);
   const sv=JSON.stringify(st.stb||null),sd=JSON.stringify(st.dsv||null),sc=JSON.stringify(st.cgo||null);
   const btn=document.querySelector('#cgo [data-cgt=stb]');if(btn)btn.click();const ui=!!document.querySelector('#cgo #cgxw [data-sbm]')&&/учебный|study|навчальний/i.test((document.querySelector('#cgo .sbnote')||{}).textContent||'')&&!document.querySelector('#shn [data-snt=stb]');
   st.stb.ld=[{n:'L',m:'2000',k:'7'},{n:'C',m:'3000',k:'5'},{n:'F',m:'500',k:'2'}];st.stb.v.km='6.5';st.stb.fs=[{n:'T',l:'10',b:'8',r:'1.025',f:''},{n:'U',f:'112.6667'}];const ch=T.chain();
   const back=document.querySelector('#cgo [data-cgt=dsv]');if(back)back.click();const bk=!document.querySelector('#cgo [data-sbm]')&&!!document.querySelector('#cgo #cgxw [data-dvm]')&&st.cgo.t==='dsv'&&st.stb.on===0;
   st.stb=JSON.parse(sv);if(!st.stb)delete st.stb;st.dsv=JSON.parse(sd);if(!st.dsv)delete st.dsv;st.cgo=JSON.parse(sc);if(!st.cgo)delete st.cgo;save();cgoR();
   return{ld:near(l.D,5500)&&near(l.KG,5.454545)&&l.c===3,fs:near(fs,437.3333),tk:near(tk.S,550),gg:near(ch.gg,0.1)&&near(ch.GM,1.045455)&&near(ch.GMf,0.945455)&&near(ch.KGf,5.554545),
    heel:near(h.deg,5.4923,1e-3)&&h0.err==='GM',roll:near(r.C,0.3789)&&near(r.GM,1.020908),gz:near(g.y[1],0.131759)&&near(g.y[4],0.786062)&&near(g.a30,0.131880)&&near(g.a40,0.255568)&&near(g.a3040,0.123689),
    tf:g2.lim===35&&near(g2.a40,0.188299)&&near(g2.a3040,0.056419),max:near(g.ma,44.195,1e-2)&&near(g.mv,0.803868),crit:c.every(x=>x.ok===true),bad:c2.filter(x=>x.ok===false).map(x=>x.k).join(','),
    free:fmPro.has('stb')&&fmPro.pkg('stb')==='tools'&&fmPro.has('shn'),ui,back:bk,th:STBTEST.th>=10&&STBTEST.qz>=8}});
  ok(stb.ld&&stb.fs&&stb.tk&&stb.gg&&stb.heel&&stb.roll&&stb.gz&&stb.tf&&stb.max&&stb.crit&&stb.bad==='a30,a40,a3040,g30,gm'&&stb.free&&stb.ui&&stb.back&&stb.th,'Остойчивость: формулы сходятся с ручным счётом, критерии IS Code, теория, вкладка в «⚓ Груз и остойчивость» ('+JSON.stringify(stb)+')');
  /* Драфт-сюрвей (dsv-js). Ручной счёт учебного примера (DSVTEST.ex): LBP=180; dF=2,50 в корму от FP, dM=0,60 в корму от миделя, dA=5,20 в нос от AP → LBM=180−2,5−5,2=172,3 м.
     Начальный: F=(4,13+4,15)/2=4,14; M=5,50; A=6,90; t=6,90−4,14=2,76 (на корму).
       Fp=4,14−2,76·2,5/172,3=4,14−0,040046=4,099954; Mp=5,50−2,76·0,6/172,3=5,490389; Ap=6,90+2,76·5,2/172,3=6,983297; t испр.=2,883343;
       Mp−(Fp+Ap)/2=−0,0512 (перегиб); MMM=(4,099954+6,983297+6·5,490389)/8=44,025585/8=5,503198.
       Таблица 5,50/5,60: Δ=24350+0,03198·469=24364,998; TPC=46,8032; LCF=3,10−0,03198·0,05=3,09840 в корму.
       1-я=2,883343·3,09840·46,8032·100/180=+232,293; 2-я=50·2,883343²·(432,0−418,5)/180=+31,176; Δ испр.=24628,468;
       Δρ=24628,468·1,018/1,025=24460,273; вычеты 15000+280+820+95+32+12=16239 → чистое 8221,273; константа 8221,273−7850=371,273.
     Конечный: F=10,50; M=10,68; A=10,80; t=0,30; Fp=10,495647; Mp=10,678955; Ap=10,809054; t испр.=0,313407; прогиб +0,0266; MMM=10,672304.
       Таблица 10,60/10,70: Δ=47960+0,72304·512=48330,197; TPC=51,2723; LCF=1,308456 в корму. 1-я=+11,681; 2-я=50·0,313407²·21,6/180=+0,589;
       Δ испр.=48342,467; Δρ=·1,0195/1,025=48083,069; вычеты 1570 → чистое 46513,069. Груз = 46513,069−8221,273 = 38291,796 т (погружено).
     Знаки: LCF в нос при дифференте на корму → 1-я с минусом; марки в нос от FP → LBM больше LBP−dA; выгрузка → «ds». */
  const dsv=await p.evaluate(()=>{const T=DSVTEST,E=T.ex,near=(a,b,e)=>Math.abs(a-b)<=(e||1e-3);
   const a=T.survey(E.i,E.c),b=T.survey(E.f,E.c),c=T.cargo(a.net,b.net),d=T.cargo(b.net,a.net);
   const g2=T.ship({L:'100',dF:'2',dFd:'f',dA:'3'}),lf=T.survey(Object.assign({},E.i,{lcd:'f'}),E.c),bad=T.survey(Object.assign({},E.i,{fs:'4.20',ro:'1.040'}),E.c),miss=T.survey({fp:'4'},E.c);
   const sv=JSON.stringify(st.dsv||null),sb=JSON.stringify(st.stb||null),sc=JSON.stringify(st.cgo||null);
   const btn=document.querySelector('#cgo [data-cgt=dsv]');if(btn)btn.click();
   const ui=!!document.querySelector('#cgo #cgxw [data-dvm]')&&/UN\/ECE/.test((document.querySelector('#cgo .dvnote')||{}).textContent||'')&&!document.querySelector('#shn [data-snt=dsv]');
   st.dsv.c=JSON.parse(JSON.stringify(E.c));st.dsv.i=JSON.parse(JSON.stringify(E.i));st.dsv.i.dd=E.i.dd.map((w,i)=>({k:i,n:'',w:String(w)}));st.dsv.f=JSON.parse(JSON.stringify(E.f));st.dsv.f.dd=E.f.dd.map((w,i)=>({k:i,n:'',w:String(w)}));
   const run=T.run('i'),sm=T.sum(),ex=T.exTable();
   const back=document.querySelector('#cgo [data-cgt=stb]');if(back)back.click();const bk=!document.querySelector('#cgo [data-dvm]')&&!!document.querySelector('#cgo #cgxw [data-sbm]')&&st.dsv.on===0;
   st.dsv=JSON.parse(sv);if(!st.dsv)delete st.dsv;st.stb=JSON.parse(sb);if(!st.stb)delete st.stb;st.cgo=JSON.parse(sc);if(!st.cgo)delete st.cgo;save();cgoR();
   return{perp:near(a.m.cF,-0.040046,1e-6)&&near(a.m.cM,-0.009611,1e-6)&&near(a.m.cA,0.083297,1e-6)&&near(a.m.t,2.883343,1e-6)&&near(a.m.LBM,172.3,1e-9),
    mmm:near(a.m.MMM,5.503198,1e-6)&&near(a.m.dfl,-0.051236,1e-6)&&near(b.m.MMM,10.672304,1e-6)&&b.m.dfl>0,
    hyd:near(a.h.D,24364.998)&&near(a.h.T,46.80320,1e-5)&&near(a.h.C,3.098401,1e-6)&&a.h.Di&&near(b.h.D,48330.197),
    trim:near(a.c1,232.2934)&&near(a.c2,31.17625)&&near(b.c1,11.68095)&&near(b.c2,0.589343,1e-5),dens:near(a.Dr,24460.273)&&near(b.Dr,48083.069),
    net:near(a.S,16239,1e-9)&&near(a.net,8221.273)&&near(b.net,46513.069)&&near(a.cst,371.273),cargo:near(c.w,38291.796)&&c.k==='ld'&&d.k==='ds',
    sign:near(g2.LBM,99,1e-9)&&lf.c1<0&&near(lf.c1,-232.2934),warn:bad.w.map(x=>x[0]).join(','),miss:miss.miss.join(','),
    free:fmPro.has('dsv')&&fmPro.pkg('dsv')==='tools'&&fmPro.has('shn'),ui,back:bk,run:/8221\.3/.test(run)&&/24460\.3/.test(run),sum:/38291\.8/.test(sm),ex:/38[ ,.]?291[,.]8/.test(ex),th:T.th>=12&&T.qz>=8}});
  ok(dsv.perp&&dsv.mmm&&dsv.hyd&&dsv.trim&&dsv.dens&&dsv.net&&dsv.cargo&&dsv.sign&&dsv.warn==='list,ro'&&dsv.miss==='M,A'&&dsv.free&&dsv.ui&&dsv.back&&dsv.run&&dsv.sum&&dsv.ex&&dsv.th,'Драфт-сюрвей: поправки, MMM, дифферент, плотность, вычеты и груз сходятся с ручным счётом, теория, вкладка в «⚓ Груз и остойчивость» ('+JSON.stringify(dsv)+')');
  /* Поправка компаса (cpc-js). Ручной счёт:
     створ: ИП 312,0 − КП 309,5 → ΔК = +2,5° E; d = +1,0° E → δ = ΔК − d = +1,5° E (КК 0,5° → строка таблицы КК 0°).
     амплитуда: φ = 40° N, δ⊙ = +15°: sin A = 0,258819/0,766044 = 0,337864 → A = 19,7468°; восход ИП = 90 − 19,7468 = 70,2532° (≈ 70,3°); заход ИП = 270 + 19,7468 = 289,7468°;
       δ⊙ = −15° (S): восход ИП = 90 + 19,7468 = 109,7468°; φ = 70° N, δ⊙ = +23,4°: sin 23,4/cos 70 = 0,3971/0,3420 > 1 → полярный день. КП 68,0 → ΔК = 70,2532 − 68 = +2,3° E.
     гирокомпас: ИК = ГКК 120,0 + ΔГК (−1,0) = 119,0; ΔК = 119,0 − КК 117,5 = +1,5° E; d = +3,0° E → δ = −1,5° W.
     ΔГК: ИП 245,0 − ГКП 245,8 = −0,8° W; через 0°: ИП 1,0 − ГКП 359,5 = +1,5° E.
     склонение с карты: 3°30′E 2015 (8′E) на 2026: 3,5 + 11·8′/60 = 4,9667° E; 2°10′W 2016 (6′E) на 2026: −2,1667 + 1 = −1,1667° (1°10′ W).
     девиация δ на N…NW = −0,2; 1,7; 2,2; 2,1; 1,8; 0,3; −1,8; −2,1:
       A = 4,0/8 = 0,5; B = (0,70711·(1,7+2,1−0,3+2,1) + 2,2+1,8)/4 = (3,95980+4)/4 = 1,98995; C = (−0,2−1,8 + 0,70711·(1,7−2,1−0,3−2,1))/4 = (−2−1,97990)/4 = −0,994975;
       D = (1,7−2,1+0,3+2,1)/4 = 0,5; E = (−0,2−2,2+1,8+1,8)/4 = 0,3;
       δ(15°) = 0,5 + 1,98995·0,258819 − 0,994975·0,965926 + 0,5·0,5 + 0,3·0,866025 = 0,563773; δ(30°) = 0,5 + 0,994975 − 0,861673 + 0,433013 + 0,15 = 1,216315;
       таблица «Компаса» через 45° по формуле: −0,2; 1,7; 2,2; 2,1; 1,8; 0,3; −1,8; −2,1.
     Полярная: склонение ≈ 89,37°, на φ = 40° азимут не дальше asin(cos 89,37°/cos 40°) ≈ 0,8° от N и совпадает с «Азимутом Полярной сейчас» (SNTEST.alt). */
  const cpc=await p.evaluate(()=>{const T=CPCTEST,near=(a,b,e)=>Math.abs(a-b)<=(e||1e-3);
   const a=T.amp(40,15,true),a2=T.amp(40,15,false),a3=T.amp(40,-15,true),a4=T.amp(70,23.4,true),g=T.gyr(120,-1,117.5),c=T.coef([-0.2,1.7,2.2,2.1,1.8,0.3,-1.8,-2.1]);
   const ms=Date.UTC(2026,10,20,18,0,0),pz=T.body('pol',ms,40,30),pi=T.polI(),old=SNTEST.alt(SNTEST.bod('s'+pi,ms),40,30),su=T.body('sun',Date.UTC(2026,10,20,8,0,0),40,30),so=SNTEST.alt(SNTEST.bod('sl',Date.UTC(2026,10,20,8,0,0)),40,30);
   const sv=JSON.stringify(st.cpc||null),sh=st.shn&&st.shn.t,sdev=JSON.stringify((st.shn&&st.shn.dev)||[]),svv=JSON.stringify((st.shn&&st.shn.v)||{});
   shnGo('comp');const keys=[...document.querySelectorAll('#shn [data-snt]')].map(x=>x.dataset.snt),pos=keys.indexOf('cpc')===keys.indexOf('cmp')+1&&st.shn.g==='comp';
   const btn=document.querySelector('#shn [data-snt=cpc]');if(btn)btn.click();
   st.cpc.p='c';st.cpc.m='rng';Object.assign(st.cpc.v,{ip:'312.0',kp:'309.5',kk:'0.5'});Object.assign(st.shn.v,{sn_vd_d:'1',sn_vd_m:'0',sn_vd_h:'E',sn_vy:'',sn_va:''});shnR();
   const ui=!!document.querySelector('#shn #snxw [data-cpm]')&&/Учебный расчёт|study calculation|Навчальний розрахунок/.test((document.querySelector('#shn .cpnote')||{}).textContent||''),r1=T.run('rng');
   const wb=document.querySelector('#shn #cpo [data-cpw]');if(wb)wb.click();const w0=st.shn.dev[0];
   st.cpc.m='amp';Object.assign(st.cpc.v,{ev:'r',la_d:'40',la_m:'0',la_h:'N',dm:'m',dc_d:'15',dc_m:'0',dc_h:'N',kpa:'68.0',kk:''});const r2=T.run('amp');
   st.cpc.m='str';Object.assign(st.cpc.v,{bd:'pol',dt:'2026-11-20',tm:'18:00:00',tz:'0',lo_d:'30',lo_m:'0',lo_h:'E',kps:'359.0'});const r3=T.run('str');
   st.cpc.m='gyr';Object.assign(st.cpc.v,{gkk:'120',dgk:'-1',kk:'117.5'});st.shn.v.sn_vd_d='3';const r4=T.run('gyr');
   st.cpc.m='dgk';Object.assign(st.cpc.v,{src:'ip',ipg:'245.0',gkp:'245.8'});const r5=T.run('dgk');
   st.cpc.m='dev';st.cpc.dw=['-0.2','1.7','2.2','2.1','1.8','0.3','-1.8','-2.1'];shnR();const r6=T.run('dev'),db=document.querySelector('#shn #cpo [data-cpdw]');if(db)db.click();
   const dv=st.shn.dev.slice(0,8).join(','),da=SNA.devAt(22.5);
   st.cpc.p='t';shnR();const th=document.querySelectorAll('#shn .cpth').length,fig=document.querySelectorAll('#shn .cpth svg').length;
   const back=document.querySelector('#shn [data-snt=cmp]');if(back)back.click();const bk=!document.querySelector('#shn #snxw')&&!!document.querySelector('#shn #sno');
   st.cpc=JSON.parse(sv);if(!st.cpc)delete st.cpc;st.shn.dev=JSON.parse(sdev);st.shn.v=JSON.parse(svv);if(sh)st.shn.t=sh;save();shnR();
   return{rng:near(T.rng(312,309.5),2.5)&&/\+2\.5° E/.test(r1)&&/\+1\.5° E/.test(r1)&&w0==='1.5',
    amp:near(a.A,19.7468)&&near(a.ip,70.2532)&&near(a2.ip,289.7468)&&near(a3.ip,109.7468)&&a4.err==='day'&&/70\.3°/.test(r2)&&/\+2\.3° E/.test(r2),
    gyr:near(g.ik,119)&&near(g.dk,1.5)&&/119\.0°/.test(r4)&&/\+1\.5° E/.test(r4)&&/−1\.5° W/.test(r4),dgk:near(T.dgk(245,245.8),-0.8)&&near(T.dgk(1,359.5),1.5)&&/−0\.8° W/.test(r5),
    vari:near(T.vari({sn_vd_d:'3',sn_vd_m:'30',sn_vd_h:'E',sn_vy:'2015',sn_va:'8',sn_vh:'E'},2026),4.96667)&&near(T.vari({sn_vd_d:'2',sn_vd_m:'10',sn_vd_h:'W',sn_vy:'2016',sn_va:'6',sn_vh:'E'},2026),-1.16667),
    coef:near(c.A,0.5)&&near(c.B,1.98995)&&near(c.C,-0.994975)&&near(c.D,0.5)&&near(c.E,0.3)&&near(T.devK(c,15),0.563773)&&near(T.devK(c,30),1.216315)&&/\+2\.0°/.test(r6)&&/−1\.0°/.test(r6),
    tab:dv==='-0.2,1.7,2.2,2.1,1.8,0.3,-1.8,-2.1'&&near(da,0.75),pol:!!pz&&near(pz.z,old.z,1e-9)&&Math.abs(((pz.z+180)%360)-180)<1&&pz.h>39&&pz.h<41&&/Истинный азимут|True azimuth|Істинний азимут/.test(r3),
    sun:!!su&&near(su.z,so.z,1e-9),pos,ui,th:th>=10&&T.th>=10&&T.qz>=8&&fig>=4,back:bk,free:fmPro.has('cpc')&&fmPro.pkg('cpc')==='tools'&&fmPro.has('shn')}});
  ok(Object.values(cpc).every(x=>x===true),'Поправка компаса: створ, амплитуда, Полярная, гирокомпас, ΔГК, склонение, коэффициенты девиации сходятся с ручным счётом, таблица «Компаса» общая, вкладка после «🧭 Компас» ('+JSON.stringify(cpc)+')');
  /* Живые схемы теории (dga-js): в «Остойчивости», «Драфт-сюрвее» и «Поправке компаса» есть живые схемы, кнопки и ползунки срабатывают. Ручной счёт:
     крен 15°, GM 1,20 → GZ = 1,20·sin 15° = 0,3106 м; «груз высоко» GM = −0,36 → GZ < 0 (красная подсказка); переборка: FSM 1125 → 281 т·м;
     поправки к перпендикулярам, t = 2: F = 8 − 2·86/180 = 7,0444, A = 8 + 2·78/180 = 8,8667, t марок = 1,8222 → Fp = 7,0444 − 1,8222·4/164 = 7,00, Ap = 8,8667 + 1,8222·12/164 = 9,00;
     прогиб +0,12: Mp = 8,22, MMM = (7,80 + 8,40 + 6·8,22)/8 = 8,19; погрузка 2000 т при TPC 33,3 т/см → +0,60 м (4,00 → 4,60);
     три севера: d = +12, δ = −5 → КК = 55 − 12 + 5 = 48°, ΔК = +7° E; створ: КП 042,0°, ΔК = 045,0 − 042,0 = +3,0° E; амплитуда δ⊙ 15° N, φ 40°: A = 19,7468°, ИП = 070,3°;
     δ(090°) = 0,5 + 2,0·1 − 1,0·0 + 0,5·0 + 0,3·(−1) = +2,2° E. */
  const dga=await p.evaluate(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms)),D=DGATEST,near=(a,b,e)=>Math.abs(a-b)<=(e||1e-3),o={};
   const sv={stb:JSON.stringify(st.stb||null),dsv:JSON.stringify(st.dsv||null),cpc:JSON.stringify(st.cpc||null),cgo:JSON.stringify(st.cgo||null),sh:st.shn&&st.shn.t,g:st.shn&&st.shn.g};
   const fg=k=>document.querySelector('figure.dga[data-dga="'+k+'"]'),cap=k=>((fg(k)||document).querySelector('.dgat')||{}).textContent||'',st0=k=>D.state(fg(k))||{},
    clk=(k,a)=>fg(k).querySelector('[data-dgb="'+a+'"]').click(),rg=(k,a,v)=>{const i=fg(k).querySelector('[data-dgr="'+a+'"]');i.value=v;i.dispatchEvent(new Event('input',{bubbles:true}))},
    opn=q=>document.querySelectorAll(q).forEach(d=>d.open=true);
   o.math=near(D.heel(1.2,15),0.31058)&&near(D.mmm(7.8,8.4,8.22),8.19)&&near(D.perp(2).Fp,7)&&near(D.perp(2).Ap,9)&&near(D.amp(15,40).ip,70.2532)&&near(D.dev(90),2.2);
   document.querySelector('#cgo [data-cgt=stb]').click();st.stb.p='t';cgoR();opn('#cgo details.sbth');await W(200);
   o.stb=['heel','fs','gz'].every(k=>fg(k)&&D.state(fg(k)))&&document.querySelectorAll('#cgo .dg:not(.dga) svg[data-dgi]').length>=5;
   let s=st0('heel');s.auto=false;s.a=s.th=15;D.draw(fg('heel'));const h1=cap('heel'),hb=!fg('heel').querySelector('.dgat.bad');clk('heel','b');
   o.heel=/0[,.]31/.test(h1)&&hb&&st0('heel').bad===true&&!!fg('heel').querySelector('.dgat.bad')&&/−0[,.]36/.test(cap('heel'));
   rg('heel','h',-10);o.heelR=st0('heel').th===-10&&st0('heel').auto===false;
   const f1=cap('fs');clk('fs','w');o.fs=/1125/.test(f1)&&st0('fs').w===true&&/281/.test(cap('fs'));
   rg('gz','t',45);o.gz=st0('gz').p===1&&/0[,.]46/.test(cap('gz'));
   document.querySelector('#cgo [data-cgt=dsv]').click();st.dsv.p='t';cgoR();opn('#cgo details.dvth');await W(200);
   o.dsv=['load','perp','hog'].every(k=>fg(k)&&D.state(fg(k)));
   clk('load','ld');o.load=st0('load').n===1&&near(st0('load').tg,4.6);clk('load','un');o.load=o.load&&st0('load').n===0;
   rg('perp','t',2);o.perp=/7[,.]00 /.test(cap('perp')+' ')&&/9[,.]00 /.test(cap('perp')+' ');
   rg('hog','p',0.12);o.hog=/8[,.]19/.test(cap('hog'))&&/8[,.]22/.test(cap('hog'));
   shnGo('comp');document.querySelector('#shn [data-snt=cpc]').click();st.cpc.p='t';shnR();opn('#shn details.cpth');await W(200);
   o.cpc=['north','rng','amp','dev'].every(k=>fg(k)&&D.state(fg(k)))&&!!fg('north').closest('.cpth')&&document.querySelectorAll('#shn .cpth svg.cpfig[data-dgi]').length>=1;
   rg('north','d',12);rg('north','e',-5);o.north=/48°/.test(cap('north'))&&/7° E/.test(cap('north'));clk('north','go');o.north=o.north&&(st0('north').st===1||D.rm());
   rg('rng','x',125);o.rng=/\+3[,.]0° E/.test(cap('rng'))&&!!fg('rng').querySelector('.dgat.okk');rg('rng','x',40);o.rng=o.rng&&!fg('rng').querySelector('.dgat.okk');
   o.amp=/070[,.]3°/.test(cap('amp'))&&/19[,.]7° N/.test(cap('amp'));rg('amp','dc',-15);o.amp=o.amp&&/109[,.]7°/.test(cap('amp'));
   rg('dev','k',90);o.dev=/\+2[,.]2° E/.test(cap('dev'));
   st.stb=JSON.parse(sv.stb);if(!st.stb)delete st.stb;st.dsv=JSON.parse(sv.dsv);if(!st.dsv)delete st.dsv;st.cpc=JSON.parse(sv.cpc);if(!st.cpc)delete st.cpc;st.cgo=JSON.parse(sv.cgo);if(!st.cgo)delete st.cgo;
   if(sv.sh)st.shn.t=sv.sh;if(sv.g)st.shn.g=sv.g;save();cgoR();shnR();return o});
  ok(Object.values(dga).every(x=>x===true),'Живые схемы теории: остойчивость, драфт-сюрвей, поправка компаса — схемы есть, кнопки и ползунки работают, числа сходятся с ручным счётом ('+JSON.stringify(dga)+')');
  /* Новые инструменты штурмана (nvt-js). Ручной счёт:
     Запас под килем: 12,0 + 1,2 = 13,2; 13,2 − 10,5 = 2,70 без хода; squat = 0,80·10²/100 = 0,80 → UKC 1,90 ≥ 1,05 (10 % от 10,5) ✅;
       V max = √((2,70 − 1,05)·100/0,80) = √206,25 = 14,361 уз; канал: squat 0,80·100/50 = 1,60, UKC 1,10, V max = √103,125 = 10,155; на 8 уз squat 0,80·64/100 = 0,512;
       11,0 + 0,5 − 10,5 = 1,00 < 1,05 → даже без хода не хватает (V max нет).
     Переход Батуми → Стамбул, 41°39′N 041°38′E → 41°01′N 028°59′E (шар, 1′ = 1 миля): РШ = −38,0′, РД = −759,0′;
       локсодромия: МЧ = 7915,7045·lg tg(45° + φ/2): МЧ1 (41,65°) = 2753,531, МЧ2 (41,016667°) = 2702,923, РМЧ = −50,608; tg K = 759,0/50,608 = 14,998 → K = 266,185° (S 86,185° W);
         S = 38,0 / cos 86,185° = 38,0/0,066535 = 571,18 мили (то же: q = 38/50,608 = 0,75087, √(38² + (0,75087·759)²) = √(1444 + 324798) = 571,18);
       ортодромия: cos D = sin 41,65·sin 41,016667 + cos 41,65·cos 41,016667·cos 12,65 = 0,664579·0,656279 + 0,747218·0,754519·0,975726 = 0,436148 + 0,550105 = 0,986253
         → D = 9,51115° = 570,67 мили; K0 = atan2(sin(−12,65°)·cos φ2, cos φ1·sin φ2 − sin φ1·cos φ2·cos Δλ) = 270,39°; локсодромия длиннее на 0,51 мили.
       12 уз, выход 2026-11-21 08:00 (UTC+3): локсодромия 571,18/12 = 47,598 ч = 2856 мин = 1 сут 23 ч 36 мин → ETA 2026-11-23 07:36; ортодромия 2853 мин → 07:33;
         топливо 25 т/сут: 25·2856/1440 = 49,58 т (локсодромия), 25·2853/1440 = 49,53 т. По экватору 0° → 10° E: 600 миль, курс 90°; через 180°: 179° E → 179° W = 120 миль.
     Под мостом: от HAT: 35,0 + (4,2 − 1,5) = 37,7; air draft 44,0 − 9,0 = 35,0; запас 2,7 ≥ 2,0 ✅; прилив до 35,0 + 4,2 − 35,0 − 2,0 = 2,2 м;
       от нуля глубин: 35,0 − 1,5 = 33,5 → запас −1,5 ⚠️, прилив до 35 − 35 − 2 = −2 → не пройдём.
     Якорь: H = 15 + 0; ×4 = 60 м → ⌈60/27,5⌉ = 3 смычки = 82,5 м; R = √(82,5² − 15²) + 180 = √6581,25 + 180 = 81,125 + 180 = 261,12 м;
       25√15 = 96,825 м → 4 смычки = 110 м, R = √(12100 − 225) + 180 = 108,972 + 180 = 288,97; шторм, клюз 5: H = 20, ×7 = 140 м → 6 смычек; 13,75 × 4 = 55 = ровно 2 смычки.
     Истинный ветер: курс 090°, 12 уз, видимый 30° пр. б. (с 120°) 20 уз: E = 20·sin120 − 12·sin90 = 17,3205 − 12 = 5,3205; N = 20·cos120 − 0 = −10;
       с atan2(5,3205; −10) = 151,98° (SSE), √(5,3205² + 10²) = 11,327 уз = 5,827 м/с → 4 балла (5,5–7,9); КУ истинного 62° пр. б.;
       обратно: (5,3205 + 12; −10) → с 120°, 20 уз, КУ 30° пр. б.; 30° л. б. (с 060°): (17,3205 − 12; 10) → с 028,0°; встречный 20 уз при 12 уз → истинный 8 уз с носа. */
  const nvt=await p.evaluate(()=>{const T=NVTEST,near=(a,b,e)=>Math.abs(a-b)<=(e||1e-3),A={la:41+39/60,lo:41+38/60},B={la:41+1/60,lo:28+59/60};
   const u=T.ukc({D:12,h:1.2,T:10.5,V:10,cb:0.8,ch:0,rq:NaN}),uc=T.ukc({D:12,h:1.2,T:10.5,V:10,cb:0.8,ch:1,rq:NaN}),u8=T.ukc({D:12,h:1.2,T:10.5,V:8,cb:0.8,ch:0,rq:NaN}),ub=T.ukc({D:11,h:0.5,T:10.5,V:5,cb:0.8,ch:0,rq:NaN});
   const r=T.rl(A,B),g=T.gc(A,B),M={la:41+20/60,lo:35},rt=T.route([A,M,B],true),eq=T.rl({la:0,lo:0},{la:0,lo:10}),eg=T.gc({la:0,lo:0},{la:0,lo:10}),dl=T.rl({la:0,lo:179},{la:0,lo:-179});
   const a=T.air({Hc:35,ref:'hat',hat:4.2,h:1.5,ad:35,rq:2}),ac=T.air({Hc:35,ref:'cd',hat:NaN,h:1.5,ad:35,rq:2});
   const n1=T.anc({d:15,hc:NaN,Ls:180,w:'n',r:'k'}),n2=T.anc({d:15,hc:0,Ls:180,w:'n',r:'25'}),n3=T.anc({d:15,hc:5,Ls:180,w:'s',r:'k'}),n4=T.anc({d:13.75,hc:0,Ls:0,w:'n',r:'k'});
   const w=T.twd(90,12,120,20),wi=T.twi(90,12,w.d,w.s),wp=T.twd(90,12,60,20),wh=T.twd(0,12,0,20);
   const sv={},sh=JSON.stringify(st.shn||{});['ukc','psg','air','anc','twd'].forEach(k=>sv[k]=JSON.stringify(st[k]||null));
   const q=s=>document.querySelector(s),keys=()=>[...document.querySelectorAll('#shn .sngr+.sntb [data-snt]')].map(x=>x.dataset.snt).join(',');
   shnGo('ukc');const gc1=st.shn.g==='coast'&&keys()==='lmk,tide,ukc,air,anc';shnGo('twd');const gs=st.shn.g==='sail'&&keys()==='dr,cur,cpa,psg,twd';
   const R={},TH={},err=[];
   for(const k of ['ukc','psg','air','anc','twd']){shnGo(k);const b=q('#shn [data-snt='+k+']');if(b)b.click();st[k].p='c';shnR();const ex=q('#shn #snxw [data-nxex]');if(ex)ex.click();R[k]=(q('#shn #nxo')||{}).textContent||'';
    const tb=q('#shn [data-nxpg=t]');if(tb)tb.click();TH[k]=document.querySelectorAll('#shn .nxth').length+'/'+document.querySelectorAll('#shn .nxth svg').length+'/'+T.th(k).q;
    if(!/Учебный расчёт|study calculation|Навчальний розрахунок/.test((q('#shn .nxnote')||{}).textContent||''))err.push(k);const cb=q('#shn [data-nxpg=c]');if(cb)cb.click()}
   const pr=R.psg;st.psg.m='g';shnGo('psg');{const b=q('#shn [data-snt=psg]');if(b)b.click()}const pg=(q('#shn #nxo')||{}).textContent||'';
   const qb=q('#shn [data-nxpg=t]');if(qb)qb.click();const qz=q('#shn [data-nxq="0:0"]');if(qz)qz.click();const qa=st.psg.qa&&st.psg.qa[0]===0&&!!q('#shn #nxq0 .nxqe');
   ['ukc','psg','air','anc','twd'].forEach(k=>{st[k]=JSON.parse(sv[k]);if(!st[k])delete st[k]});st.shn=JSON.parse(sh);save();shnR();
   return{ukc:near(u.wd,13.2)&&near(u.s0,2.7)&&near(u.sq,0.8)&&near(u.u,1.9)&&near(u.rq,1.05)&&u.ok&&near(u.vm,14.3614)&&near(uc.sq,1.6)&&near(uc.u,1.1)&&uc.ok&&near(uc.vm,10.1550)&&near(u8.sq,0.512)&&!ub.ok&&isNaN(ub.vm)&&near(ub.s0,1.0),
    rl:near(r.d,571.176,0.01)&&near(r.c,266.185,0.01)&&near(r.mp,-50.608,0.01),gc:near(g.d,570.669,0.01)&&near(g.c,270.388,0.01)&&r.d>g.d,
    route:near(rt.d,T.gc(A,M).d+T.gc(M,B).d,1e-9)&&rt.l.length===2&&rt.d>g.d&&near(rt.o,T.rl(A,M).d+T.rl(M,B).d,1e-9),eq:near(eq.d,600)&&near(eq.c,90)&&near(eg.d,600)&&near(dl.d,120)&&near(dl.c,90),
    time:T.mins(r.d,12)===2856&&T.mins(g.d,12)===2853&&T.dur(2856).replace(/\D+/g,' ').trim()==='1 23 36',
    air:near(a.cl,37.7)&&near(a.mg,2.7)&&a.ok&&near(a.hm,2.2)&&near(ac.cl,33.5)&&near(ac.mg,-1.5)&&!ac.ok&&near(ac.hm,-2),
    anc:near(n1.H,15)&&near(n1.L,60)&&n1.n===3&&near(n1.Lp,82.5)&&near(n1.R,261.1249,1e-3)&&near(n2.L,96.8246)&&n2.n===4&&near(n2.R,288.9725,1e-3)&&near(n3.H,20)&&n3.n===6&&n4.n===2,
    twd:near(w.d,151.9846,1e-3)&&near(w.s,11.3274,1e-3)&&T.bft(w.s*1852/3600)===4&&T.rumb(w.d)==='SSE'&&near(w.q,61.9846,1e-3)&&near(wi.d,120)&&near(wi.s,20)&&near(wi.q,30)&&near(wp.d,28.0154,1e-3)&&near(wh.d,0)&&near(wh.s,8),
    bft:T.bft(0.2)===0&&T.bft(5.4)===3&&T.bft(5.5)===4&&T.bft(32.7)===12,gc1,gs,
    ui:/1\.90/.test(R.ukc)&&/14\.4/.test(R.ukc)&&/37\.70/.test(R.air)&&/2\.20/.test(R.air)&&/261\.1/.test(R.anc)&&/152\.0°/.test(R.twd)&&/SSE/.test(R.twd)&&/11\.3/.test(R.twd)&&/571\.2/.test(pr)&&/2026-11-23 07:36/.test(pr)&&/49\.6/.test(pr)&&/570\.7/.test(pg)&&/07:33/.test(pg),
    th:JSON.stringify(TH),note:err.join(','),qa,free:['ukc','psg','air','anc','twd'].every(k=>fmPro.has(k)&&fmPro.pkg(k)==='tools')}});
  ok(nvt.ukc&&nvt.rl&&nvt.gc&&nvt.route&&nvt.eq&&nvt.time&&nvt.air&&nvt.anc&&nvt.twd&&nvt.bft&&nvt.gc1&&nvt.gs&&nvt.ui&&nvt.note===''&&nvt.qa&&nvt.free
   &&Object.values(JSON.parse(nvt.th)).every(x=>{const a=x.split('/').map(Number);return a[0]>=4&&a[1]>=1&&a[2]>=4}),'Новые инструменты штурмана: запас под килем, переход (обе формулы, ETA, топливо), мост, якорь, истинный ветер сходятся с ручным счётом, группы, теория ('+JSON.stringify(nvt)+')');
  /* Группы #shn: 4 группы сверху, инструменты выбранной группы под ними; группа и инструмент запоминаются; старое st.shn.t открывается в своей группе;
     вкладка SNX с полем grp встаёт в свою группу; «⚓ Груз и остойчивость» (#cgo) — отдельный раздел на Мостике с остойчивостью и драфт-сюрвеем. */
  const grp=await p.evaluate(()=>{const sv=JSON.stringify(st.shn||{}),q=s=>document.querySelector(s),keys=()=>[...document.querySelectorAll('#shn .sngr+.sntb [data-snt]')].map(x=>x.dataset.snt).join(',');
   const gb=[...document.querySelectorAll('#shn .sngr [data-sng]')].map(x=>x.dataset.sng).join(','),G={};
   ['comp','astro','sail','coast'].forEach(g=>{q('#shn [data-sng='+g+']').click();G[g]=keys()+'|'+(q('#shn [data-sng='+g+']').classList.contains('cur')&&st.shn.g===g)});
   q('#shn [data-sng=sail]').click();q('#shn [data-snt=cpa]').click();q('#shn [data-sng=comp]').click();q('#shn [data-sng=sail]').click();const mem=st.shn.t==='cpa'&&!!q('#shn [data-snt=cpa].cur');
   const old={};['lmk','tide','sxt','str','dr','cur','cpa','cmp','cpc','ukc','psg'].forEach(t=>{st.shn.t=t;shnR();old[t]=st.shn.g+(q('#shn [data-snt='+t+'].cur')?'':'!')});
   st.shn.t='stb';shnR();const moved=st.shn.t==='cmp'&&st.shn.g==='comp';
   q('#shn [data-sng=coast]').click();shnGo('cpc');const go=!!q('#shn [data-snt=cpc]')&&st.shn.g==='comp';
   SNX.zz={grp:'coast',n:'ZZ',r(x){x.textContent='zz'}};shnR();q('#shn [data-sng=coast]').click();const add=/,zz$/.test(keys());delete SNX.zz;
   const fl=!!q('#shn .snwarn')&&!!q('#shn .sngr');st.shn=JSON.parse(sv);save();shnR();
   const c=q('#cgo'),cg=[...document.querySelectorAll('#cgo [data-cgt]')].map(x=>x.dataset.cgt).join(',');
   const kw=window.uxKW?uxKW('cgo'):'',kws=window.uxKW?uxKW('shn'):'';
   return{gb:gb==='comp,astro,sail,coast',G:JSON.stringify(G),mem,old:JSON.stringify(old),moved,go,add,fl,cg,
    room:!!c&&c.dataset.t==='r-brg',tile:!!(window.uxP&&uxP.cgo)&&/Груз|Cargo|Вантаж/.test(uxP.cgo.b.textContent),free:fmPro.has('cgo')&&fmPro.tier('cgo')==='free',
    kw:/осадк/.test(kw)&&/остойчив/.test(kw)&&!/остойчив/.test(kws)&&/поправка компаса/.test(kws)}});
  ok(grp.gb&&grp.G==='{"comp":"cmp,cpc|true","astro":"sxt,str|true","sail":"dr,cur,cpa,psg,twd|true","coast":"lmk,tide,ukc,air,anc|true"}'&&grp.mem&&grp.old==='{"lmk":"coast","tide":"coast","sxt":"astro","str":"astro","dr":"sail","cur":"sail","cpa":"sail","cmp":"comp","cpc":"comp","ukc":"coast","psg":"sail"}'
   &&grp.moved&&grp.go&&grp.add&&grp.fl&&grp.cg==='stb,dsv'&&grp.room&&grp.tile&&grp.free&&grp.kw,'Инструменты штурмана: 4 группы, инструменты по группам, память группы, старые вкладки в своих группах; «⚓ Груз и остойчивость» на Мостике ('+JSON.stringify(grp)+')');
  /* поиск «Все разделы»: остойчивость, драфт, осадка → «Груз и остойчивость»; поправка компаса → «Инструменты штурмана» */
  const srch=await p.evaluate(async()=>{const r={},sv=JSON.stringify(st.ux||{});st.ux=st.ux||{};st.ux.all=1;if(window.uxApply)uxApply();uxOpen();const Q=document.getElementById('uxq');
   for(const w of ['остойчивость','драфт','осадка','поправка компаса','stability','остійність','запас под килем','squat','проседание','ETA','переход','мост','air draft','якорь','смычки','истинный ветер']){Q.value=w;Q.dispatchEvent(new Event('input'));await new Promise(z=>setTimeout(z,30));r[w]=[...document.querySelectorAll('#uxl [data-k]')].map(x=>x.dataset.k).filter((x,i,a)=>a.indexOf(x)===i).join(',')}
   Q.value='';Q.dispatchEvent(new Event('input'));document.getElementById('uxc').classList.remove('on');document.documentElement.classList.remove('uxo');st.ux=JSON.parse(sv);save();if(window.uxApply)uxApply();return r});
  ok(['запас под килем','squat','проседание','ETA','переход','мост','air draft','якорь','смычки','истинный ветер'].every(w=>/shn/.test(srch[w]))&&/cgo/.test(srch['остойчивость'])&&/cgo/.test(srch['драфт'])&&/cgo/.test(srch['осадка'])&&/cgo/.test(srch['stability'])&&/cgo/.test(srch['остійність'])&&/shn/.test(srch['поправка компаса'])&&!/shn/.test(srch['остойчивость']),'Поиск: остойчивость, драфт, осадка → «Груз и остойчивость», поправка компаса → «Инструменты штурмана» ('+JSON.stringify(srch)+')');
  const trn=await p.evaluate(()=>{const dec=id=>{try{return new TextDecoder().decode(Uint8Array.from(atob(document.getElementById(id).textContent.trim()),c=>c.charCodeAt(0)))}catch(e){return ''}};
   const o=dec('to-src'),a=dec('tr-src'),b=dec('tm-src'),c=dec('ts-src'),d=dec('te-src');return{o:/id:"bunker"/.test(o)&&/id:"mob"/.test(o)&&o.includes('FM_LANG'),i:[a,b,c,d].every(x=>x.includes('fm-i18n')&&x.includes('FM_LANG')),d:/SIMS\.shipgrid/.test(d)&&/SIMS\.bode/.test(d),c:/SIMS\.shipboiler/.test(c)&&/SIMS\.shipthruster/.test(c)&&/SIMS\.mainengine/.test(c)&&/SIMS\.navpower/.test(c),btn:document.querySelectorAll('#trs [data-trs]').length,e:/SIMS\.blackout/.test(a)&&/SIMS\.dgstart/.test(a)&&/SIMS\.generator/.test(a),m:/SIMS\.mainstart/.test(b)&&/SIMS\.coolsys/.test(b)}});
  ok(trn.btn===5&&trn.o&&trn.i&&trn.d&&trn.e&&trn.m&&trn.c,'Тренажёры: раздел с пятью наборами, игры встроены ('+JSON.stringify(trn)+')');
  const pro=await p.evaluate(()=>{const T=PROTEST.decide,t=localStorage.getItem('fm_pro'),o=JSON.parse(t||'null');
   return{free:fmPro.has('shn')&&fmPro.has('qz')&&fmPro.tier('shn')==='free'&&!fmPro.on(),st:!!o&&o.t0>0&&o.own===0,tr:fmPro.trial().on&&fmPro.trial().left===PROTEST.trial,
    // таблица решений: переключатель выключен — всё открыто; включён — платное закрыто, пока нет покупки или пробного периода
    t:T(0,1,0,0)&&T(1,0,0,0)&&T(1,1,1,0)&&T(1,1,0,1)&&!T(1,1,0,0)}});
  ok(pro.free&&pro.st&&pro.tr&&pro.t,'Покупка (заготовка): всё бесплатно, пробный период 3 дня, таблица решений верна');
  {const h=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');ok(h.includes('|ota|store|hc|pro|play|rvw)/')&&h.includes('|alert|broken|pro|play|rvw)/.test(k)'),'Покупка и оценка: fm_pro и fm_rvw не переносятся и не попадают в копии')}
  {/* сборка для Google Play: покупка включена, мок плагина оплаты (настоящий Billing проверяется только в Play) */
   const c2=await b.newContext();await c2.addInitScript(()=>{localStorage.setItem('fm_play','1');window.__ord=0;const cb=[],own={v:0};
    const prod={owned:false,offers:[{pricingPhases:[{price:'9,99 $'}],order(){window.__ord++;own.v=1;prod.owned=true;cb.forEach(f=>f());return Promise.resolve()}}],getOffer(){return this.offers[0]}};
    window.CdvPurchase={Platform:{GOOGLE_PLAY:'android-playstore'},ProductType:{NON_CONSUMABLE:'non consumable'},store:{register(){},when(){const w={approved(){return w},productUpdated(f){cb.push(f);return w},receiptUpdated(){return w}};return w},error(){},initialize(){return Promise.resolve()},get(){return prod},owned(){return !!own.v},restorePurchases(){return Promise.resolve()}}}});
   const q=await c2.newPage(),qe=[];q.on('pageerror',e=>qe.push(e.message));await q.goto(URL+'index.html');await q.waitForTimeout(2500);
   const a=await q.evaluate(()=>({on:fmPro.on(),left:fmPro.trial().left,ecl:fmPro.has('ecl'),price:fmPro.price(),ota:fmOtaPlay()&&!fmOtaPre({build:99999999999,sig:'x'}),pro:!document.getElementById('pro').hidden}));
   await q.evaluate(()=>{localStorage.setItem('fm_pro',JSON.stringify({v:2,t0:1,b0:0,own:0,d:['2000-01-01','2000-01-02','2000-01-03']}))});
   const c=await q.evaluate(()=>{const g=id=>document.getElementById(id);g('ecl').previousElementSibling.click();return{tr:fmPro.trial().on,ecl:fmPro.has('ecl'),qz:fmPro.has('qz'),sh4:fmPro.has('sh4'),wall:!!g('fpw')&&g('fpw').classList.contains('on'),inbox:g('ecl').parentNode===g('mn'),btn:(document.querySelector('#fpw [data-fp=buy]')||{}).textContent||''}});
   const dv=await q.evaluate(()=>{const x=document.createElement('div'),sv=JSON.stringify(st.dsv||null);cgoR();CGX.dsv.r(x);const r={has:fmPro.has('dsv'),stb:fmPro.has('stb'),shn:fmPro.has('shn')&&fmPro.has('cgo'),g:CGX.dsv.g(),n:/🔒/.test(CGX.dsv.n())&&/🔒/.test(CGX.stb.n())&&/🔒/.test(document.querySelector('#cgo [data-cgt=dsv]').textContent),lock:!!x.querySelector('[data-dvw]')&&!x.querySelector('[data-dvv]'),wall:document.getElementById('fpw').classList.contains('on')};st.dsv=JSON.parse(sv);if(!st.dsv)delete st.dsv;return r});
   const cp=await q.evaluate(()=>{const x=document.createElement('div'),sv=JSON.stringify(st.cpc||null),W=document.getElementById('fpw');W.classList.remove('on');const g=SNX.cpc.g(),wall=W.classList.contains('on');W.classList.remove('on');
    SNX.cpc.r(x);shnGo('comp');const cm=document.querySelector('#shn [data-snt=cmp]');if(cm)cm.click();
    const r={has:fmPro.has('cpc'),shn:fmPro.has('shn'),g,wall,n:/🔒/.test(SNX.cpc.n()),lock:!!x.querySelector('[data-cpwl]')&&!x.querySelector('[data-cpv]'),cmp:!!document.querySelector('#shn #sno')&&!document.querySelector('#shn #snxw')};st.cpc=JSON.parse(sv);if(!st.cpc)delete st.cpc;return r});
   ok(!cp.has&&cp.shn&&cp.g===false&&cp.wall&&cp.n&&cp.lock&&cp.cmp,'Play-сборка: «Поправка компаса» закрыта (🔒, окно покупки), «🧭 Компас» открыт ('+JSON.stringify(cp)+')');
   const nv=await q.evaluate(()=>{const K=['ukc','psg','air','anc','twd'],W=document.getElementById('fpw'),sv=JSON.stringify(st.shn||{}),r={};
    r.has=K.filter(k=>fmPro.has(k)).join(',');r.n=K.every(k=>/🔒/.test(SNX[k].n()));W.classList.remove('on');r.g=K.map(k=>SNX[k].g()).join(',');r.wall=W.classList.contains('on');W.classList.remove('on');
    const x=document.createElement('div');SNX.ukc.r(x);r.lock=!!x.querySelector('[data-nxwl]')&&!x.querySelector('[data-nxv]');
    shnGo('coast');const t=document.querySelector('#shn [data-snt=tide]');if(t)t.click();const u=document.querySelector('#shn [data-snt=ukc]');if(u)u.click();r.tide=st.shn.t==='tide'&&!!document.querySelector('#shn #sno');
    shnGo('sail');const d=document.querySelector('#shn [data-snt=dr]');if(d)d.click();r.dr=st.shn.t==='dr'&&!!document.querySelector('#shn #sno');W.classList.remove('on');st.shn=JSON.parse(sv);shnR();return r});
   ok(nv.has===''&&nv.n&&nv.g==='false,false,false,false,false'&&nv.wall&&nv.lock&&nv.tide&&nv.dr,'Play-сборка: новые инструменты штурмана закрыты (🔒, окно покупки), «🌗 Прилив» и «✏️ Счисление» открыты ('+JSON.stringify(nv)+')');
   const d=await q.evaluate(()=>{document.querySelector('#fpw [data-fp=buy]').click();return{ord:window.__ord,own:fmPro.owned(),ecl:fmPro.has('ecl')}});
   ok(a.on&&a.left===3&&a.ecl&&a.price==='9,99 $'&&a.ota&&a.pro,'Play-сборка: покупка включена, 3 дня пробы, цена из магазина, самообновление выключено ('+JSON.stringify(a)+')');
   ok(!c.tr&&!c.ecl&&c.qz&&c.sh4&&c.wall&&c.inbox&&/9,99/.test(c.btn),'Play-сборка: после пробы платный раздел закрыт окном покупки, бесплатное открыто ('+JSON.stringify(c)+')');
   ok(!dv.has&&!dv.stb&&dv.shn&&dv.g===false&&dv.n&&dv.lock&&dv.wall,'Play-сборка: «Остойчивость» и «Драфт-сюрвей» закрыты (🔒, окно покупки), разделы «Груз и остойчивость» и «Инструменты штурмана» открыты ('+JSON.stringify(dv)+')');
   ok(d.ord===1&&d.own&&d.ecl,'Play-сборка: кнопка «Купить» вызывает оплату, после покупки всё открыто ('+JSON.stringify(d)+')');
   {/* код доступа для друзей и тестировщиков: пара ключей одноразовая, только для теста */
    const cr=require('crypto'),kp=cr.generateKeyPairSync('ec',{namedCurve:'P-256'}),u=b=>Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const mk=o=>{const d=Buffer.from(JSON.stringify(o));return 'FM1.'+u(d)+'.'+u(cr.sign('sha256',d,{key:kp.privateKey,dsaEncoding:'ieee-p1363'}))};
    const pub=kp.publicKey.export({type:'spki',format:'der'}).toString('base64');
    const good=mk({n:'Друг'}),old=mk({n:'Давно',e:'2000-01-01'}),other=cr.generateKeyPairSync('ec',{namedCurve:'P-256'}),od=Buffer.from('{"n":"x"}'),forged='FM1.'+u(od)+'.'+u(cr.sign('sha256',od,{key:other.privateKey,dsaEncoding:'ieee-p1363'}));
    const r=await q.evaluate(async([pub,good,old,forged])=>{localStorage.setItem('fm_pro',JSON.stringify({v:2,t0:1,b0:0,own:0,d:['2000-01-01','2000-01-02','2000-01-03']}));PROTEST.pub(pub);
     const a=await fmPro.redeem('мусор'),b=await fmPro.redeem(forged),c=await fmPro.redeem(old),before=fmPro.has('ecl'),g=await fmPro.redeem(good);
     return{a,b,c,before,g,own:fmPro.owned(),free:fmPro.free(),ecl:fmPro.has('ecl')}},[pub,good,old,forged]);
    ok(!r.a&&!r.b&&!r.c&&!r.before&&r.g&&r.own&&r.free&&r.ecl,'Код доступа: мусор, чужая подпись и просроченный код не работают, настоящий открывает всё ('+JSON.stringify(r)+')')}
   ok(qe.length===0,'Play-сборка: нет ошибок в консоли'+(qe.length?' — '+qe.slice(0,3).join(' | '):''));await c2.close()}
  {/* Оценка в Google Play и «Поделиться приложением» (rvw-js): мок плагина In-App Review, настоящее окно Google проверяется только на телефоне со сборкой из Play */
   const PLAY='https://play.google.com/store/apps/details?id=io.github.azazello2508.facmodo',SITE='https://azazello2508.github.io/Fac-modo/';
   const nw=await p.evaluate(async()=>{let sh=null,cb=null;Object.defineProperty(navigator,'share',{value:a=>{sh=a;return Promise.resolve()},configurable:true});const m=fmShareApp();
    Object.defineProperty(navigator,'share',{value:undefined,configurable:true});Object.defineProperty(navigator,'clipboard',{value:{writeText:t=>{cb=t;return Promise.resolve()}},configurable:true});const m2=fmShareApp();await new Promise(r=>setTimeout(r,50));
    delete navigator.share;delete navigator.clipboard;let rv=0;RVWTEST.plug({requestReview(){rv++;return Promise.resolve()}});localStorage.setItem('fm_rvw',JSON.stringify({n:30,a:[]}));const w=RVWTEST.why(),a=RVWTEST.ask('t');RVWTEST.plug(null);localStorage.removeItem('fm_rvw');
    return{m,m2,sh,cb,w,a,rv,on:RVWTEST.on(),rate:!!document.querySelector('#rvwb [data-rvw=rate]'),share:!!document.querySelector('#rvwb [data-rvw=share]')}});
   ok(nw.m==='web'&&nw.sh&&nw.sh.url===SITE&&/помощник для моряков.*навигация.*без интернета/.test(nw.sh.text)&&!/бесплатн/i.test(nw.sh.text)&&nw.m2==='copy'&&nw.cb===nw.sh.text+'\n'+SITE,'Поделиться приложением: navigator.share с текстом и ссылкой на сайт, без него — копия в буфер ('+JSON.stringify({m:nw.m,m2:nw.m2,url:nw.sh&&nw.sh.url})+')');
   ok(!nw.on&&nw.w==='off'&&!nw.a&&nw.rv===0&&!nw.rate&&nw.share,'Оценка: не в Play-сборке не просит, кнопки «Оценить» нет, «Поделиться» есть ('+JSON.stringify({w:nw.w,rate:nw.rate,share:nw.share})+')');
   const c3=await b.newContext();await c3.addInitScript(()=>{if(sessionStorage.getItem('rv0'))return;sessionStorage.setItem('rv0','1');localStorage.setItem('fm_play','1');
    localStorage.setItem('fm_pro',JSON.stringify({v:2,t0:1,b0:0,own:0,d:['2000-01-01','2000-01-02','2000-01-03','2000-01-04']}));localStorage.setItem('fm_rvw',JSON.stringify({n:5,l:'2000-01-05',a:[]}))});
   const q=await c3.newPage(),qe=[];q.on('pageerror',e=>qe.push(e.message));await q.goto(URL+'index.html');await q.waitForTimeout(2500);
   const r1=await q.evaluate(()=>{window.__rv=0;RVWTEST.plug({requestReview(){window.__rv++;return Promise.resolve()}});const n6=RVWTEST.st().n,w6=RVWTEST.why(),a6=RVWTEST.ask('t');RVWTEST.bump('2099-01-01');
    return{n6,w6,a6,n7:RVWTEST.st().n,rate:!!document.querySelector('#rvwb [data-rvw=rate]'),url:RVWTEST.url()}});
   const left=await q.evaluate(async()=>{for(let i=0;i<60;i++){const c=document.querySelector('#list input[type=checkbox]:not(:checked)');if(!c)break;c.click();await new Promise(r=>setTimeout(r,30))}return document.querySelectorAll('#list input[type=checkbox]:not(:checked)').length});
   await q.waitForTimeout(5000);
   const r2=await q.evaluate(()=>{const c1=window.__rv,o=RVWTEST.st(),t=o.a[0]||Date.now(),D=864e5,log=localStorage.getItem('fm_log')||'';
    const g=RVWTEST.why(),g59=RVWTEST.why(t+59*D),a2=RVWTEST.ask('t',t+61*D),a3=RVWTEST.ask('t',t+125*D),mx=RVWTEST.why(t+400*D),a4=RVWTEST.ask('t',t+400*D);
    localStorage.setItem('fm_rvw',JSON.stringify({n:9,a:[]}));const W=document.createElement('div');W.id='fpw';W.className='on';document.body.appendChild(W);const wall=RVWTEST.why();W.remove();
    return{calls:c1,k:o.a.length,log:/review-ask/.test(log)&&/quests/.test(log),g,g59,a2,a3,mx,a4,calls2:window.__rv,wall,free:RVWTEST.why()}});
   await q.evaluate(()=>{Object.defineProperty(navigator,'share',{value:a=>{window.__sh=a;return Promise.resolve()},configurable:true});document.querySelector('#rvwb [data-rvw=share]').click()});const sh=await q.evaluate(()=>window.__sh);
   ok(r1.n6===6&&r1.w6==='days'&&!r1.a6&&r1.n7===7,'Оценка: на 6-й день использования не просит ('+JSON.stringify(r1)+')');
   ok(left===0&&r2.calls===1&&r2.k===1&&r2.log,'Оценка: на 7-й день после «все квесты закрыты» вызывает окно Google и пишет review-ask в журнал ('+JSON.stringify({left,calls:r2.calls,log:r2.log})+')');
   ok(r2.g==='gap'&&r2.g59==='gap'&&r2.a2&&r2.a3&&r2.mx==='max'&&!r2.a4&&r2.calls2===3,'Оценка: не раньше чем через 60 дней и не больше 3 раз ('+JSON.stringify(r2)+')');
   ok(r2.wall==='wall'&&r2.free==='','Оценка: не во время окна покупки');
   ok(r1.rate&&r1.url===PLAY&&sh&&sh.url===PLAY,'Play-сборка: кнопка «⭐ Оценить в Google Play» есть, «Поделиться» даёт ссылку на Google Play');
   ok(qe.length===0,'Оценка (Play-сборка): нет ошибок'+(qe.length?' — '+qe.slice(0,3).join(' | '):''));await c3.close()}
  ok(errs.length===0,'E2E: нет ошибок в консоли'+(errs.length?' — '+errs.slice(0,3).join(' | '):''));await ctx.close()}
 // 2. Мобильный браузер
 {const {ctx,p,errs}=await open({...devices['iPhone 13'],defaultBrowserType:undefined});await tabs(p);
  const sc=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);ok(sc<=1,'Мобильный: нет горизонтальной прокрутки ('+sc+' px)');
  ok(errs.length===0,'Мобильный: нет ошибок'+(errs.length?' — '+errs.slice(0,3).join(' | '):''));await ctx.close()}
 // 3. Контракты игр по сети
 {const ctx=await b.newContext(),p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
  const run=async(g,act)=>{await p.goto(URL+'__harness.html?g='+g);await p.waitForTimeout(800);await p.evaluate(()=>go());await p.waitForTimeout(400);const [A,B]=p.frames().slice(1);if(act)await act(A,B);await p.waitForTimeout(500);return p.evaluate(()=>LOG.filter(x=>x.m.fm==='net-send').map(x=>x.m.d))};
  let L=await run('chess',async A=>A.evaluate(()=>{const m=legal(S)[0];doMove(m)}));ok(L.some(d=>d.t==='mv'&&Number.isInteger(d.f)&&Number.isInteger(d.to)),'Контракт шахмат: ход {t:"mv", f, to}');
  L=await run('checkers',async A=>A.evaluate(()=>{const m=allMoves(b,turn)[0];doMove(m,turn)}));ok(L.some(d=>d.t==='mv'&&Number.isInteger(d.from)&&Array.isArray(d.path)),'Контракт шашек: ход {t:"mv", from, path, taken}');
  L=await run('morboy');ok(L.filter(d=>d.t==='fleet2'&&/^[0-9a-f]{64}$/.test(d.h)).length===2&&!L.some(d=>d.t==='fleet'),'Контракт морского боя: только отпечаток флота fleet2, сам флот не отправляется');
  L=await run('nardy',async(A,B)=>{const w=await A.evaluate(()=>cur===NET.me)?A:B;await w.evaluate(()=>playerRoll())});const t=L.map(d=>d.t).join(',');ok(/rc.*rb.*rr/.test(t),'Контракт нард: честный бросок rc → rb → rr ('+t+')');
  await p.goto(URL+'games/chess.html');const open1=await p.evaluate(()=>new Promise(r=>{const f=document.createElement('iframe');f.src='chess.html';addEventListener('message',e=>{if(e.data&&e.data.fm==='net-open')r(e.data)});f.onload=()=>f.contentWindow.netOpen();document.body.appendChild(f)}));
  ok(open1.g==='chess','Контракт игра → приложение: net-open с названием игры');ok(errs.length===0,'Контракты: нет ошибок'+(errs.length?' — '+errs.slice(0,3).join(' | '):''));await ctx.close()}
 // 3b. Песочница игр (флаг gamebox): игра рисуется, сохранение живёт после выхода, quest-v2 недоступен
 {const {ctx,p,errs}=await open();await p.evaluate(()=>{localStorage.setItem('fm_flags','{"gamebox":true}');localStorage.setItem('fm_chess','{"m":"ai","l":1}')});
  const og=async()=>{await p.evaluate(()=>fmGame('cs-src','Шахматы'));await p.waitForTimeout(1200);return (await p.$('#tkw iframe')).contentFrame()};
  let F=await og();ok(await p.$eval('#tkw iframe',f=>f.getAttribute('sandbox'))==='allow-scripts','Песочница игр: iframe с sandbox="allow-scripts"');
  ok(await F.evaluate(()=>!!document.querySelector('canvas,table,button')&&LVL===1),'Песочница игр: шахматы отрисовались и прочитали своё сохранение');
  const sec=await F.evaluate(()=>{let a='',b='';try{parent.localStorage.length;a='open'}catch(e){a='blocked'}try{top.document.title;b='open'}catch(e){b='blocked'}return [a,b,localStorage.getItem('quest-v2')]});
  ok(sec[0]==='blocked'&&sec[1]==='blocked'&&sec[2]===null,'Песочница игр: нет доступа к данным приложения и quest-v2 ('+sec.join(',')+')');
  await F.evaluate(()=>localStorage.setItem('fm_chess','{"m":"ai","l":2}'));await p.waitForTimeout(200);await F.evaluate(()=>parent.postMessage({fmgs:1,k:'quest-v2',v:'x'},'*'));await p.waitForTimeout(200);
  await p.evaluate(()=>document.getElementById('tkx').click());F=await og();
  ok(await F.evaluate(()=>LVL===2)&&await p.evaluate(()=>localStorage.getItem('quest-v2')!=='x'),'Песочница игр: сохранение живёт после выхода, чужой ключ не записан');
  ok(errs.length===0,'Песочница игр: нет ошибок'+(errs.length?' — '+errs.slice(0,3).join(' | '):''));await ctx.close()}
 // 3c. Самообновление не перезапускает приложение, пока человек печатает (fmOtaBusy/fmOtaGo)
 {const {ctx,p,errs}=await open();
  await p.evaluate(()=>{const t=document.createElement('textarea');t.id='e2eota';document.body.prepend(t)});
  ok(await p.evaluate(()=>fmOtaBusy()===false),'Обновление: без набора текста переход разрешён');
  await p.focus('#e2eota');await p.keyboard.type('Пишу запись');
  ok(await p.evaluate(()=>fmOtaBusy()&&fmOtaGo(location.href.split('?')[0]+'?ota=1')===false),'Обновление: пока поле в фокусе, перезапуск отложен');
  await p.evaluate(()=>document.activeElement.blur());
  ok(await p.evaluate(()=>fmOtaBusy()===true&&document.getElementById('e2eota').value==='Пишу запись'),'Обновление: несохранённый текст в поле тоже откладывает перезапуск');
  ok(!p.url().includes('ota=1'),'Обновление: страница не перезагрузилась, текст на месте');
  await p.evaluate(()=>document.getElementById('e2eota').remove());
  await Promise.all([p.waitForURL(/ota=1/,{timeout:15000}),p.evaluate(()=>fmOtaGo(location.href.split('?')[0]+'?ota=1'))]);
  ok(p.url().includes('ota=1'),'Обновление: без набора текста новая версия включается');
  ok(errs.length===0,'Обновление: нет ошибок'+(errs.length?' — '+errs.slice(0,3).join(' | '):''));await ctx.close()}
 // 4. Доступность
 let axe=null;try{axe=require.resolve('axe-core/axe.min.js')}catch(e){}
 if(!axe)console.log('ℹ axe-core не установлен — проверка доступности пропущена (npm i axe-core)');
 else{const {ctx,p}=await open();await p.addScriptTag({path:axe});
  // meta-viewport: увеличение экрана отключено намеренно (см. CLAUDE.md «Без увеличения экрана»)
  const v=await p.evaluate(async()=>(await axe.run(document,{rules:{'meta-viewport':{enabled:false}}})).violations.filter(v=>v.impact==='critical').map(v=>v.id+' ×'+v.nodes.length));
  ok(v.length===0,'Доступность: нет критических нарушений'+(v.length?' — '+v.join(', '):''));await ctx.close()}
 await b.close();srv.close();console.log(fails?`\n${fails} проверок не прошли`:'\nВсе проверки прошли');process.exit(fails?1:0)})().catch(e=>{console.error(e);process.exit(1)});
