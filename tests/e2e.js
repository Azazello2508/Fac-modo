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
   const sv=JSON.stringify(st.stb||null),sh=st.shn&&st.shn.t;
   const btn=[...document.querySelectorAll('#shn [data-snt]')].find(b=>b.dataset.snt==='stb');if(btn)btn.click();const ui=!!document.querySelector('#shn #snxw [data-sbm]')&&/учебный|study|навчальний/i.test((document.querySelector('#shn .sbnote')||{}).textContent||'');
   st.stb.ld=[{n:'L',m:'2000',k:'7'},{n:'C',m:'3000',k:'5'},{n:'F',m:'500',k:'2'}];st.stb.v.km='6.5';st.stb.fs=[{n:'T',l:'10',b:'8',r:'1.025',f:''},{n:'U',f:'112.6667'}];const ch=T.chain();
   const back=[...document.querySelectorAll('#shn [data-snt]')].find(b=>b.dataset.snt==='cmp');if(back)back.click();const bk=!document.querySelector('#shn #snxw');
   st.stb=JSON.parse(sv);if(!st.stb)delete st.stb;if(sh)st.shn.t=sh;save();
   return{ld:near(l.D,5500)&&near(l.KG,5.454545)&&l.c===3,fs:near(fs,437.3333),tk:near(tk.S,550),gg:near(ch.gg,0.1)&&near(ch.GM,1.045455)&&near(ch.GMf,0.945455)&&near(ch.KGf,5.554545),
    heel:near(h.deg,5.4923,1e-3)&&h0.err==='GM',roll:near(r.C,0.3789)&&near(r.GM,1.020908),gz:near(g.y[1],0.131759)&&near(g.y[4],0.786062)&&near(g.a30,0.131880)&&near(g.a40,0.255568)&&near(g.a3040,0.123689),
    tf:g2.lim===35&&near(g2.a40,0.188299)&&near(g2.a3040,0.056419),max:near(g.ma,44.195,1e-2)&&near(g.mv,0.803868),crit:c.every(x=>x.ok===true),bad:c2.filter(x=>x.ok===false).map(x=>x.k).join(','),
    free:fmPro.has('stb')&&fmPro.pkg('stb')==='tools'&&fmPro.has('shn'),ui,back:bk,th:STBTEST.th>=10&&STBTEST.qz>=8}});
  ok(stb.ld&&stb.fs&&stb.tk&&stb.gg&&stb.heel&&stb.roll&&stb.gz&&stb.tf&&stb.max&&stb.crit&&stb.bad==='a30,a40,a3040,g30,gm'&&stb.free&&stb.ui&&stb.back&&stb.th,'Остойчивость: формулы сходятся с ручным счётом, критерии IS Code, теория, вкладка в «Инструментах штурмана» ('+JSON.stringify(stb)+')');
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
   const sv=JSON.stringify(st.dsv||null),sh=st.shn&&st.shn.t;
   const btn=[...document.querySelectorAll('#shn [data-snt]')].find(x=>x.dataset.snt==='dsv');if(btn)btn.click();
   const ui=!!document.querySelector('#shn #snxw [data-dvm]')&&/UN\/ECE/.test((document.querySelector('#shn .dvnote')||{}).textContent||'');
   st.dsv.c=JSON.parse(JSON.stringify(E.c));st.dsv.i=JSON.parse(JSON.stringify(E.i));st.dsv.i.dd=E.i.dd.map((w,i)=>({k:i,n:'',w:String(w)}));st.dsv.f=JSON.parse(JSON.stringify(E.f));st.dsv.f.dd=E.f.dd.map((w,i)=>({k:i,n:'',w:String(w)}));
   const run=T.run('i'),sm=T.sum(),ex=T.exTable();
   const back=[...document.querySelectorAll('#shn [data-snt]')].find(x=>x.dataset.snt==='cmp');if(back)back.click();const bk=!document.querySelector('#shn #snxw');
   st.dsv=JSON.parse(sv);if(!st.dsv)delete st.dsv;if(sh)st.shn.t=sh;save();
   return{perp:near(a.m.cF,-0.040046,1e-6)&&near(a.m.cM,-0.009611,1e-6)&&near(a.m.cA,0.083297,1e-6)&&near(a.m.t,2.883343,1e-6)&&near(a.m.LBM,172.3,1e-9),
    mmm:near(a.m.MMM,5.503198,1e-6)&&near(a.m.dfl,-0.051236,1e-6)&&near(b.m.MMM,10.672304,1e-6)&&b.m.dfl>0,
    hyd:near(a.h.D,24364.998)&&near(a.h.T,46.80320,1e-5)&&near(a.h.C,3.098401,1e-6)&&a.h.Di&&near(b.h.D,48330.197),
    trim:near(a.c1,232.2934)&&near(a.c2,31.17625)&&near(b.c1,11.68095)&&near(b.c2,0.589343,1e-5),dens:near(a.Dr,24460.273)&&near(b.Dr,48083.069),
    net:near(a.S,16239,1e-9)&&near(a.net,8221.273)&&near(b.net,46513.069)&&near(a.cst,371.273),cargo:near(c.w,38291.796)&&c.k==='ld'&&d.k==='ds',
    sign:near(g2.LBM,99,1e-9)&&lf.c1<0&&near(lf.c1,-232.2934),warn:bad.w.map(x=>x[0]).join(','),miss:miss.miss.join(','),
    free:fmPro.has('dsv')&&fmPro.pkg('dsv')==='tools'&&fmPro.has('shn'),ui,back:bk,run:/8221\.3/.test(run)&&/24460\.3/.test(run),sum:/38291\.8/.test(sm),ex:/38[ ,.]?291[,.]8/.test(ex),th:T.th>=12&&T.qz>=8}});
  ok(dsv.perp&&dsv.mmm&&dsv.hyd&&dsv.trim&&dsv.dens&&dsv.net&&dsv.cargo&&dsv.sign&&dsv.warn==='list,ro'&&dsv.miss==='M,A'&&dsv.free&&dsv.ui&&dsv.back&&dsv.run&&dsv.sum&&dsv.ex&&dsv.th,'Драфт-сюрвей: поправки, MMM, дифферент, плотность, вычеты и груз сходятся с ручным счётом, теория, вкладка в «Инструментах штурмана» ('+JSON.stringify(dsv)+')');
  const trn=await p.evaluate(()=>{const dec=id=>{try{return new TextDecoder().decode(Uint8Array.from(atob(document.getElementById(id).textContent.trim()),c=>c.charCodeAt(0)))}catch(e){return ''}};
   const o=dec('to-src'),a=dec('tr-src'),b=dec('tm-src'),c=dec('ts-src'),d=dec('te-src');return{o:/id:"bunker"/.test(o)&&/id:"mob"/.test(o)&&o.includes('FM_LANG'),i:[a,b,c,d].every(x=>x.includes('fm-i18n')&&x.includes('FM_LANG')),d:/SIMS\.shipgrid/.test(d)&&/SIMS\.bode/.test(d),c:/SIMS\.shipboiler/.test(c)&&/SIMS\.shipthruster/.test(c)&&/SIMS\.mainengine/.test(c)&&/SIMS\.navpower/.test(c),btn:document.querySelectorAll('#trs [data-trs]').length,e:/SIMS\.blackout/.test(a)&&/SIMS\.dgstart/.test(a)&&/SIMS\.generator/.test(a),m:/SIMS\.mainstart/.test(b)&&/SIMS\.coolsys/.test(b)}});
  ok(trn.btn===5&&trn.o&&trn.i&&trn.d&&trn.e&&trn.m&&trn.c,'Тренажёры: раздел с пятью наборами, игры встроены ('+JSON.stringify(trn)+')');
  const pro=await p.evaluate(()=>{const T=PROTEST.decide,t=localStorage.getItem('fm_pro'),o=JSON.parse(t||'null');
   return{free:fmPro.has('shn')&&fmPro.has('qz')&&fmPro.tier('shn')==='free'&&!fmPro.on(),st:!!o&&o.t0>0&&o.own===0,tr:fmPro.trial().on&&fmPro.trial().left===PROTEST.trial,
    // таблица решений: переключатель выключен — всё открыто; включён — платное закрыто, пока нет покупки или пробного периода
    t:T(0,1,0,0)&&T(1,0,0,0)&&T(1,1,1,0)&&T(1,1,0,1)&&!T(1,1,0,0)}});
  ok(pro.free&&pro.st&&pro.tr&&pro.t,'Покупка (заготовка): всё бесплатно, пробный период 3 дня, таблица решений верна');
  {const h=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');ok(h.includes('|ota|store|hc|pro|play)/')&&h.includes('|alert|broken|pro|play)/.test(k)'),'Покупка (заготовка): fm_pro не переносится и не попадает в копии')}
  {/* сборка для Google Play: покупка включена, мок плагина оплаты (настоящий Billing проверяется только в Play) */
   const c2=await b.newContext();await c2.addInitScript(()=>{localStorage.setItem('fm_play','1');window.__ord=0;const cb=[],own={v:0};
    const prod={owned:false,offers:[{pricingPhases:[{price:'9,99 $'}],order(){window.__ord++;own.v=1;prod.owned=true;cb.forEach(f=>f());return Promise.resolve()}}],getOffer(){return this.offers[0]}};
    window.CdvPurchase={Platform:{GOOGLE_PLAY:'android-playstore'},ProductType:{NON_CONSUMABLE:'non consumable'},store:{register(){},when(){const w={approved(){return w},productUpdated(f){cb.push(f);return w},receiptUpdated(){return w}};return w},error(){},initialize(){return Promise.resolve()},get(){return prod},owned(){return !!own.v},restorePurchases(){return Promise.resolve()}}}});
   const q=await c2.newPage(),qe=[];q.on('pageerror',e=>qe.push(e.message));await q.goto(URL+'index.html');await q.waitForTimeout(2500);
   const a=await q.evaluate(()=>({on:fmPro.on(),left:fmPro.trial().left,ecl:fmPro.has('ecl'),price:fmPro.price(),ota:fmOtaPlay()&&!fmOtaPre({build:99999999999,sig:'x'}),pro:!document.getElementById('pro').hidden}));
   await q.evaluate(()=>{localStorage.setItem('fm_pro',JSON.stringify({v:2,t0:1,b0:0,own:0,d:['2000-01-01','2000-01-02','2000-01-03']}))});
   const c=await q.evaluate(()=>{const g=id=>document.getElementById(id);g('ecl').previousElementSibling.click();return{tr:fmPro.trial().on,ecl:fmPro.has('ecl'),qz:fmPro.has('qz'),sh4:fmPro.has('sh4'),wall:!!g('fpw')&&g('fpw').classList.contains('on'),inbox:g('ecl').parentNode===g('mn'),btn:(document.querySelector('#fpw [data-fp=buy]')||{}).textContent||''}});
   const dv=await q.evaluate(()=>{const x=document.createElement('div'),sv=JSON.stringify(st.dsv||null);SNX.dsv.r(x);const r={has:fmPro.has('dsv'),stb:fmPro.has('stb'),shn:fmPro.has('shn'),g:SNX.dsv.g(),n:/🔒/.test(SNX.dsv.n()),lock:!!x.querySelector('[data-dvw]')&&!x.querySelector('[data-dvv]'),wall:document.getElementById('fpw').classList.contains('on')};st.dsv=JSON.parse(sv);if(!st.dsv)delete st.dsv;return r});
   const d=await q.evaluate(()=>{document.querySelector('#fpw [data-fp=buy]').click();return{ord:window.__ord,own:fmPro.owned(),ecl:fmPro.has('ecl')}});
   ok(a.on&&a.left===3&&a.ecl&&a.price==='9,99 $'&&a.ota&&a.pro,'Play-сборка: покупка включена, 3 дня пробы, цена из магазина, самообновление выключено ('+JSON.stringify(a)+')');
   ok(!c.tr&&!c.ecl&&c.qz&&c.sh4&&c.wall&&c.inbox&&/9,99/.test(c.btn),'Play-сборка: после пробы платный раздел закрыт окном покупки, бесплатное открыто ('+JSON.stringify(c)+')');
   ok(!dv.has&&!dv.stb&&dv.shn&&dv.g===false&&dv.n&&dv.lock&&dv.wall,'Play-сборка: «Драфт-сюрвей» закрыт (🔒, окно покупки), остальные «Инструменты штурмана» открыты ('+JSON.stringify(dv)+')');
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
