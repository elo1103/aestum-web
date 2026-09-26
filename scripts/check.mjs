// Dependency-free browser smoke test. Requires Node 22+ and Google Chrome.
// Run: node scripts/check.mjs. Browser profiles/downloads/screenshots go to OS temp.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=await mkdtemp(path.join(tmpdir(),'aestum-web-qa-'));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.csv':'text/csv; charset=utf-8'};
const pages=['index.html','material-check.html','privacy.html'];
for(const page of pages){
  const html=await readFile(path.join(root,page),'utf8');
  const ids=Array.from(html.matchAll(/\bid="([^"]+)"/g),match=>match[1]);
  assert.equal(new Set(ids).size,ids.length,`${page}: duplicate IDs`);
  for(const [,reference] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)){
    if(/^(https?:|mailto:)/.test(reference))continue;
    const [resource,fragment]=reference.split('#'),file=resource.split('?')[0]||page;
    assert((await stat(path.join(root,file))).isFile(),`Missing ${reference}`);
    if(fragment&&file.endsWith('.html')){
      const target=await readFile(path.join(root,file),'utf8');
      assert(target.includes(`id="${fragment}"`),`Missing fragment ${reference}`);
    }
  }
}
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
    const target=path.resolve(root,'.'+relative);
    if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    const data=await readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const chrome=process.env.CHROME_PATH||path.join(process.env.PROGRAMFILES||'C:/Program Files','Google/Chrome/Application/chrome.exe');
const child=spawn(chrome,['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1',`--user-data-dir=${temp}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ws,call;
const errors=[],networkFailures=[];
try{
  let port;
  for(let i=0;i<100;i++){try{port=(await readFile(path.join(temp,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await sleep(100);}}
  assert(port,'Chrome did not expose a debugging port');
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let sequence=0;
  const pending=new Map();
  ws.onmessage=({data})=>{
    const message=JSON.parse(data);
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);
    if(message.method==='Network.responseReceived'&&message.params.response.status>=400)networkFailures.push(message.params.response.url);
    if(!message.id)return;
    const item=pending.get(message.id);if(!item)return;pending.delete(message.id);clearTimeout(item.timer);
    if(message.error)item.reject(new Error(JSON.stringify(message.error)));else item.resolve(message.result);
  };
  call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout: ${method}`));},10000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const response=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!response.exceptionDetails,JSON.stringify(response.exceptionDetails));return response.result.value;};
  const navigate=async(url,expected)=>{await call('Page.navigate',{url});for(let i=0;i<100;i++){if(await evaluate(`document.readyState==='complete' && document.title.includes(${JSON.stringify(expected)}) && !!window.Aestum`))return;await sleep(50);}throw new Error(`Navigation timeout: ${url}`);};
  const viewport=async(width,height)=>{await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(30);};
  const screenshot=async(name,full=false)=>{const dimensions=await evaluate('({width:innerWidth,height:document.documentElement.scrollHeight})');const result=await call('Page.captureScreenshot',{format:'png',...(full?{captureBeyondViewport:true,clip:{x:0,y:0,width:dimensions.width,height:dimensions.height,scale:1}}:{})});await writeFile(path.join(temp,name),Buffer.from(result.data,'base64'));};
  const noOverflow=async(label)=>{const sizes=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');if(sizes.scroll>sizes.width+1){console.log(await evaluate(`Array.from(document.querySelectorAll('body *')).filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width})).slice(0,18)`));await screenshot('overflow.png',true);console.log(`Failure screenshot: ${temp}`);}assert(sizes.scroll<=sizes.width+1,`${label}: page overflows ${JSON.stringify(sizes)}`);};
  const change=async(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));return el.value;})()`);
  const text=async selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent`);
  const click=async selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  await call('Runtime.enable');await call('Page.enable');await call('Network.enable');
  await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:temp});
  await viewport(1440,1050);
  await navigate(`${origin}/index.html?lang=zh`,'Aestum');
  for(const page of pages){
    await navigate(`${origin}/${page}?lang=zh`,'Aestum');
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('[data-i18n],[data-i18n-aria],[data-i18n-placeholder]')).flatMap(el=>[el.dataset.i18n,el.dataset.i18nAria,el.dataset.i18nPlaceholder].filter(Boolean)).filter(key=>!Aestum.englishKeys.includes(key))`),[],`${page}: missing translations`);
    for(const lang of ['zh','en']){
      await evaluate(`Aestum.applyLanguage('${lang}')`);
      for(const [width,height] of [[1440,1050],[1024,768],[768,1024],[390,844],[320,740]]){
        await viewport(width,height);await noOverflow(`${page} ${lang} ${width}`);
      }
    }
  }
  console.log('PASS: local links, language coverage, three pages in both languages at five widths.');
  await navigate(`${origin}/index.html?lang=zh`,'Aestum');
  await viewport(1440,1050);
  await screenshot('home-desktop.png');await screenshot('home-full.png',true);
  for(const id of ['materials','handoff','ai','capacity']){
    await click(`#tab-${id}`);
    assert.equal(await evaluate(`document.querySelector('[role="tab"][aria-selected="true"]').dataset.tab`),id);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('[role="tabpanel"]')).filter(el=>!el.hidden).length`),1);
  }
  await evaluate(`document.querySelector('#tab-capacity').focus()`);
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});
  assert.equal(await evaluate(`document.activeElement.id`),'tab-materials');
  await click('#tab-capacity');
  const uri=await evaluate(`Aestum.buildInquiry('materials',${JSON.stringify('A&B\n需要幫忙')})`);
  assert(uri.startsWith('mailto:ester.l@aestum.co?'));
  assert(decodeURIComponent(uri).includes('A&B\n需要幫忙'));
  await viewport(390,844);await evaluate(`scrollTo({top:0,behavior:'instant'})`);await screenshot('home-mobile.png');
  await click('.menu-toggle');assert.equal(await evaluate(`document.querySelector('#mobile-nav').hidden`),false);
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  assert.equal(await evaluate(`document.querySelector('#mobile-nav').hidden`),true);
  await click('.lang-toggle');assert.equal(await evaluate('document.documentElement.lang'),'en');
  assert.match(await evaluate(`document.querySelector('a.tool-preview[href*="material-check"]').getAttribute('href')`),/lang=en/);
  await viewport(1440,1050);await screenshot('home-english.png');
  console.log('PASS: scenario navigation, keyboard tabs, mobile menu, language switch, email draft encoding.');
  await navigate(`${origin}/material-check.html?lang=zh`,'Aestum');
  assert.equal(await text('#shortage-count'),'1');assert.match(await text('.row-status'),/缺 15/);
  await screenshot('tool-desktop.png');
  await viewport(390,844);await screenshot('tool-mobile.png');await noOverflow('tool table on mobile');
  await viewport(1440,1050);
  await change('#material-rows tr:first-child [data-field="stock"]','95');assert.equal(await text('#shortage-count'),'0');
  await change('#material-rows tr:first-child [data-field="reserved"]','100');assert.equal(await text('#invalid-count'),'1');assert.match(await text('.row-status'),/保留量超過/);
  await change('#material-rows tr:first-child [data-field="reserved"]','60');
  await change('#material-rows tr:first-child [data-field="required"]','-1');assert.equal(await text('#invalid-count'),'1');
  await change('#material-rows tr:first-child [data-field="required"]','');assert.equal(await text('#invalid-count'),'1');
  await change('#material-rows tr:first-child [data-field="required"]','35');
  await change('#material-rows tr:first-child [data-field="stock"]','80');
  await change('#needed-date','2026-10-08');await change('#material-rows tr:first-child [data-field="arrival"]','2026-10-10');
  assert.match(await text('.row-status'),/到貨晚於/);assert.equal(await text('#shortage-count'),'1');
  await change('#material-rows tr:first-child [data-field="arrival"]','2026-10-07');
  assert.match(await text('.row-status'),/尚未計入庫存/);assert.equal(await text('#shortage-count'),'1');
  const fractional=await evaluate(`AestumMaterial.calculate({name:'test',required:'0.3',stock:'0.4',reserved:'0.1',arrival:''})`);
  assert.equal(fractional.shortage,0);assert.equal(fractional.available,0.3);
  assert.equal(await evaluate(`AestumMaterial.quantity('Infinity')`),null);
  assert.equal(await evaluate(`AestumMaterial.quantity('0.0000001')`),null);
  assert.equal(await evaluate(`AestumMaterial.validDate('2026-02-30')`),false);
  assert.equal(await evaluate(`AestumMaterial.validDate('2028-02-29')`),true);
  await change('#material-rows tr:first-child [data-field="name"]','=1+1');await change('#job-name','@SUM(A1)');
  await click('#export-csv');
  let csv;
  for(let i=0;i<100;i++){try{csv=await readFile(path.join(temp,'aestum-material-readiness.csv'),'utf8');break;}catch{await sleep(50);}}
  assert(csv,'CSV download did not finish');assert(csv.startsWith('\uFEFF'));assert(csv.includes('"\'=1+1"'));assert(csv.includes('"\'@SUM(A1)"'));assert(csv.includes('"15"'));
  await evaluate(`window.confirm=()=>false`);await click('#load-sample');assert.equal(await evaluate('document.querySelector("#job-name").value'),'@SUM(A1)');
  await evaluate(`window.confirm=()=>true`);await click('#load-sample');assert.equal(await evaluate('document.querySelector("#job-name").value'),'WO-208');
  await change('#material-rows tr:first-child [data-field="name"]','Custom <img src=x onerror=alert(1)>');
  await click('.lang-toggle');assert.equal(await evaluate('document.documentElement.lang'),'en');assert.equal(await evaluate('document.querySelector("#material-rows input").value'),'Custom <img src=x onerror=alert(1)>');assert.match(await text('.row-status'),/15 short/);
  await click('.lang-toggle');assert.match(await text('.row-status'),/缺 15/);
  await click('#add-row');assert.equal(await text('#total-count'),'4');assert.equal(await text('#invalid-count'),'1');
  await evaluate(`Array.from(document.querySelectorAll('.remove-row')).forEach(el=>el.click())`);
  assert.equal(await text('#total-count'),'0');assert.equal(await evaluate('document.getElementById("export-csv").disabled'),true);
  await click('#add-row');assert.equal(await text('#total-count'),'1');
  await click('#load-sample');assert.equal(await text('#shortage-count'),'1');
  console.log('PASS: shortage math, decimals, invalid inputs, arrival semantics, data retention on language switch, reset confirmation, empty state, real CSV download and formula escaping.');
  // Opening the HTML directly must also work, without a development server.
  await navigate(`${pathToFileURL(path.join(root,'index.html'))}?lang=zh`,'Aestum');
  assert.equal(await text('h1'),'串起現場與辦公室，工作往前一步。');
  await navigate(`${pathToFileURL(path.join(root,'material-check.html'))}?lang=zh`,'Aestum');
  assert.equal(await text('#shortage-count'),'1');
  await call('Emulation.setEmulatedMedia',{media:'print'});
  await viewport(1000,1000);await screenshot('tool-print.png',true);
  await call('Emulation.setEmulatedMedia',{media:''});
  assert.deepEqual(errors,[],'Browser runtime exceptions');assert.deepEqual(networkFailures,[],'Missing network resources');
  console.log('PASS: direct-file preview, print layout, no browser exceptions or missing resources.');
  console.log(`QA artifacts: ${temp}`);
}finally{
  if(call&&ws?.readyState===WebSocket.OPEN){try{await call('Browser.close');}catch{/* closing the socket may precede the response */}}
  ws?.close();child.kill();await new Promise(resolve=>server.close(resolve));
}
