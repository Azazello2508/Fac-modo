// Нагрузочная проверка Fac Modo: как приложение держит много данных (годы прогресса, большой дневник).
// Запуск: python3 -m http.server 8765 (в папке репозитория), затем  node tools/load_test.js [лет]
// Нужен Playwright (require('playwright')). Печатает размер данных, время запуска, сохранения и перерисовки.
const {chromium}=require('playwright');
const YEARS=+process.argv[2]||3,URL=process.env.FM_URL||'http://localhost:8765/index.html';
function bigState(){const st={done:{},custom:{},bonus:{},dr:{},_v:2},cats=['work','study','read','sport','health'],t0=new Date();
 for(let i=0;i<YEARS*365;i++){const d=new Date(t0);d.setDate(d.getDate()-i);const k=d.toISOString().slice(0,10),day={};
  for(let j=0;j<10;j++)day['b'+j]={x:10+j,c:cats[j%5]};st.done[k]=day;
  st.dr[k]={m:3,n:'Запись дневника за '+k+'. '+'Вахта прошла спокойно, проверил генераторы и щиты. '.repeat(4)}}
 return st}
(async()=>{const b=await chromium.launch(),ctx=await b.newContext(),p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
 const st=bigState(),json=JSON.stringify(st);console.log(`Данные: ${YEARS} г., ${Object.keys(st.done).length} дней, ${(json.length/1024/1024).toFixed(2)} МБ`);
 // данные кладём до запуска страницы (иначе приложение при перезагрузке сохранит поверх свои)
 await ctx.addInitScript(j=>{if(!sessionStorage.getItem('lt')){sessionStorage.setItem('lt','1');try{localStorage.setItem('quest-v2',j)}catch(e){console.error('⚠ Не влезло в память: '+e.name)}}},json);
 const t=Date.now();await p.goto(URL,{waitUntil:'load'});console.log('Запуск со всеми данными:',Date.now()-t,'мс');
 console.log('Дней в приложении:',await p.evaluate(()=>Object.keys(st.done).length));
 // каждое измерение — отдельным действием (кэш calc живёт в пределах одного действия)
 const r=await p.evaluate(async()=>{const m=async f=>{let s=0;for(let i=0;i<10;i++){await new Promise(r=>setTimeout(r,0));const a=performance.now();f();s+=performance.now()-a}return(s/10).toFixed(1)};
  return{save:await m(()=>save()),calc:typeof calc=='function'?await m(()=>calc()):'-',refresh:typeof refreshAll=='function'?await m(()=>refreshAll()):'-'}});
 console.log('Сохранение:',r.save,'мс · подсчёт XP (calc):',r.calc,'мс · перерисовка (refreshAll):',r.refresh,'мс');
 const tabs=await p.$$eval('[data-n]',x=>[...new Set(x.map(e=>e.dataset.n))]);let worst=0,wn='';
 for(const n of tabs){const ms=await p.evaluate(n=>{const a=performance.now();const x=document.querySelector('[data-n="'+n+'"]');x&&x.click();return performance.now()-a},n);if(ms>worst){worst=ms;wn=n}}
 console.log('Самая медленная вкладка:',wn,worst.toFixed(0),'мс');console.log(errs.length?'Ошибки: '+errs.slice(0,5).join(' | '):'Ошибок в консоли нет');await b.close()})();
