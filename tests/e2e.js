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
 // 4. Доступность
 let axe=null;try{axe=require.resolve('axe-core/axe.min.js')}catch(e){}
 if(!axe)console.log('ℹ axe-core не установлен — проверка доступности пропущена (npm i axe-core)');
 else{const {ctx,p}=await open();await p.addScriptTag({path:axe});
  // meta-viewport: увеличение экрана отключено намеренно (см. CLAUDE.md «Без увеличения экрана»)
  const v=await p.evaluate(async()=>(await axe.run(document,{rules:{'meta-viewport':{enabled:false}}})).violations.filter(v=>v.impact==='critical').map(v=>v.id+' ×'+v.nodes.length));
  ok(v.length===0,'Доступность: нет критических нарушений'+(v.length?' — '+v.join(', '):''));await ctx.close()}
 await b.close();srv.close();console.log(fails?`\n${fails} проверок не прошли`:'\nВсе проверки прошли');process.exit(fails?1:0)})().catch(e=>{console.error(e);process.exit(1)});
