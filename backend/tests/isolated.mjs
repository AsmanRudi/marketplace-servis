import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import http from 'node:http'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const temp = mkdtempSync(join(tmpdir(), 'meja-service-test-'))
mkdirSync(join(temp, 'data'))
const env = { ...process.env, MONGODB_URI:'mongodb://127.0.0.1:57019', MONGODB_DB:'meja_test', PORT:'3302', HOST:'127.0.0.1', DEMO_DATA:'true', PADANG_DEMO_DATA:'true', DEMO_PASSWORD:randomBytes(16).toString('hex'), ADMIN_EMAIL:'admin@fixture.example', ADMIN_PASSWORD:randomBytes(16).toString('hex'), TEST_API_URL:'http://127.0.0.1:3302/api', MIDTRANS_SERVER_KEY:'', MIDTRANS_CLIENT_KEY:'', TEST_MIDTRANS_STATE:'' }
const children = []
const pause = ms => new Promise(r => setTimeout(r,ms))
function start(bin,args) { const child=spawn(bin,args,{ cwd:root,env,stdio:'ignore',windowsHide:true }); children.push(child); return child }
let server, socket
try {
  // Refuse occupied ports: never accidentally test the user's running API/database.
  for (const port of [57019,3302,5185]) await new Promise((ok,no) => { const probe=http.createServer(); probe.once('error',no); probe.listen(port,'127.0.0.1',()=>probe.close(ok)) })
  const mongo=start(resolve(root,'.local-mongo/mongod.exe'),['--dbpath',join(temp,'data'),'--port','57019','--bind_ip','127.0.0.1','--logpath',join(temp,'mongo.log')])
  await pause(1800)
  assert.equal(mongo.exitCode,null,'Test MongoDB could not start')
  execFileSync(process.execPath,['backend/dist/setup.js'],{cwd:root,env,stdio:'inherit'})
  start(process.execPath,['backend/dist/main.js'])
  for(let i=0;i<60;i++){ try { if((await fetch(env.TEST_API_URL+'/auth/me')).ok)break }catch{} await pause(150) }
  execFileSync(process.execPath,['backend/tests/service.mjs'],{cwd:root,env,stdio:'inherit'})
  const dist=resolve(root,'frontend/dist')
  server=http.createServer((req,res)=>{
    if(req.url.startsWith('/api/')){const proxy=http.request('http://127.0.0.1:3302'+req.url,{method:req.method,headers:req.headers},up=>{res.writeHead(up.statusCode,up.headers);up.pipe(res)});proxy.on('error',()=>{res.writeHead(502);res.end()});req.pipe(proxy);return}
    let file=resolve(dist,'.'+new URL(req.url,'http://localhost').pathname)
    if(!file.startsWith(dist+sep) && file!==dist){res.writeHead(403);res.end();return}
    if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=join(dist,'index.html')
    res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res)
  }); await new Promise(r=>server.listen(5185,'127.0.0.1',r))
  const profile=join(temp,'chrome')
  start('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'])
  for(let i=0;i<100&&!fs.existsSync(join(profile,'DevToolsActivePort'));i++)await pause(100)
  const port=fs.readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json`)).json()
  socket=new WebSocket(tabs[0].webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}))
  let id=0;const callbacks=new Map()
  socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){callbacks.get(m.id)?.(m);callbacks.delete(m.id)}})
  const call=(method,params={})=>new Promise((r,j)=>{const n=++id;callbacks.set(n,m=>m.error?j(m.error):r(m.result));socket.send(JSON.stringify({id:n,method,params}))})
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value}
  await call('Page.enable');await call('Network.enable')
  const customerEmail='browser@fixture.example'
  const customer=await fetch(env.TEST_API_URL+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Browser Customer',email:customerEmail,password:env.DEMO_PASSWORD})})
  assert.equal(customer.status,201)
  const customerCookie=customer.headers.get('set-cookie').split(';')[0]
  const shops=await(await fetch(env.TEST_API_URL+'/shops')).json()
  for(const device_model of ['Ponsel Alpha','Laptop Beta',...Array.from({length:6},(_,i)=>'Perangkat '+i)]) {
    const booked=await fetch(env.TEST_API_URL+'/orders',{method:'POST',headers:{'Content-Type':'application/json',Cookie:customerCookie},body:JSON.stringify({service_id:shops[0].services[0].id,preferred_id:null,device_model,complaint:'Keluhan simulasi untuk pemeriksaan browser'})})
    assert.equal(booked.status,201)
  }
  for(const [role,email,routes] of [
    ['customer',customerEmail,['/?halaman=servis','/?halaman=notifikasi','/?halaman=kasus']],
    ['manager','manager1@demo.example',['/?halaman=mitra','/?halaman=servis','/?halaman=kasus']],
    ['technician','technician1@demo.example',['/?halaman=workbench','/?halaman=servis']],
    ['admin',env.ADMIN_EMAIL,['/admin','/admin/kasus']],
  ]){
    const login=await fetch(env.TEST_API_URL+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:role==='admin'?env.ADMIN_PASSWORD:env.DEMO_PASSWORD})})
    assert.equal(login.status,201)
    const cookie=login.headers.get('set-cookie').split(';')[0];const split=cookie.indexOf('=')
    await call('Network.setCookie',{name:cookie.slice(0,split),value:cookie.slice(split+1),url:'http://127.0.0.1:5185',httpOnly:true})
    for(const route of routes){
      await call('Page.navigate',{url:'http://127.0.0.1:5185'+route})
      for(let i=0;i<80;i++){if(await evaluate("!!document.querySelector('h1') && !document.body.innerText.includes('Memuat')"))break;await pause(100)}
      for(const width of [390,768,1440]){
        await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await pause(450)
        const result=await evaluate("({heading:document.querySelector('h1')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth,login:!!document.querySelector('input[type=password]')})")
        assert(result.heading&&!result.login,role+' did not authenticate');assert(!result.overflow,role+' overflow '+width)
        console.log('Browser PASS',role,route,width,result.heading)
      }
      if(role==='customer' && route==='/?halaman=servis') {
        assert.equal(await evaluate("document.querySelectorAll('.ticket-row').length"),6)
        await evaluate("document.querySelector('[aria-label=\"Halaman berikutnya\"]').click()")
        await pause(150)
        assert.equal(await evaluate("document.querySelectorAll('.ticket-row').length"),2)
        await evaluate(`(()=>{const input=document.querySelector('input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Alpha');input.dispatchEvent(new Event('input',{bubbles:true}))})()`)
        await pause(150)
        assert.equal(await evaluate("document.querySelectorAll('.ticket-row').length"),1)
        await evaluate("document.querySelector('.ticket-tools .link').click()")
        await pause(150)
        assert.equal(await evaluate("document.querySelectorAll('.ticket-row').length"),6)
        await evaluate('window.scrollTo(0,600)')
        assert.equal(await evaluate("Math.round(document.querySelector('.site-header').getBoundingClientRect().top)"),0)
        await evaluate("document.querySelector('.ticket-row').click()")
        await pause(400)
        assert(await evaluate("!!document.querySelector('.tracker-line')"),'Ticket details did not load')
        console.log('Browser PASS pagination next, filter resets page, reset, sticky header, ticket detail')
      }
    }
  }
  await call('Browser.close')
  console.log('PASS: isolated service API + authenticated customer, manager, technician and admin layouts')
} finally {
  socket?.close();server?.close()
  for(const child of children.reverse()) { if(child.exitCode===null){child.kill();await Promise.race([new Promise(r=>child.once('exit',r)),pause(3000)])} }
  // Only the uniquely created temporary fixture directory is removed.
  try { rmSync(temp,{recursive:true,force:true,maxRetries:5,retryDelay:200}) } catch { console.log('Temporary test files remain:',temp) }
}

