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
   const d=await q.evaluate(()=>{document.querySelector('#fpw [data-fp=buy]').click();return{ord:window.__ord,own:fmPro.owned(),ecl:fmPro.has('ecl')}});
   ok(a.on&&a.left===3&&a.ecl&&a.price==='9,99 $'&&a.ota&&a.pro,'Play-сборка: покупка включена, 3 дня пробы, цена из магазина, самообновление выключено ('+JSON.stringify(a)+')');
   ok(!c.tr&&!c.ecl&&c.qz&&c.sh4&&c.wall&&c.inbox&&/9,99/.test(c.btn),'Play-сборка: после пробы платный раздел закрыт окном покупки, бесплатное открыто ('+JSON.stringify(c)+')');
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
