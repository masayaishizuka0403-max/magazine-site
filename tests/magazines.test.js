const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ReleaseDate=require('../release-date');

test('release dates exclude issue months, update dates, invalid dates and ambiguous archives',()=>{
  assert.equal(ReleaseDate.extract('発売日：2026年11月13日'),'2026-11-13');
  assert.equal(ReleaseDate.extract('2026.11.12（木）発売'),'2026-11-12');
  for(const value of ['2026年12月号','更新日 2026-11-13','発売日 2026-02-30','2026-11-13発売 / 2026-11-06発売'])assert.equal(ReleaseDate.extract(value),'');
});
test('NEW uses Tokyo calendar days and different weekly/monthly windows',()=>{
  const now=new Date('2026-11-12T15:00:00Z');
  assert.equal(ReleaseDate.isNew('2026-11-13',now,3),true);
  assert.equal(ReleaseDate.isNew('2026-11-11',now,3),true);
  assert.equal(ReleaseDate.isNew('2026-11-10',now,3),false);
  assert.equal(ReleaseDate.isNew('2026-11-07',now,7),true);
  assert.equal(ReleaseDate.isNew('2026-11-06',now,7),false);
  assert.equal(ReleaseDate.isNew('2026-11-14',now,7),false);
});

// A small DOM model verifies element identity, filtering and storage-independent loading.
class Element{
  constructor(){this.children=[];this.value='';this.dataset={};this.classList={toggle(){}};}
  setAttribute(){}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node)}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes)}
  insertBefore(node,before){if(node.parent){const i=node.parent.children.indexOf(node);if(i>=0)node.parent.children.splice(i,1)}const i=before?this.children.indexOf(before):-1;this.children.splice(i<0?this.children.length:i,0,node);node.parent=this}
  remove(){this.parent.children.splice(this.parent.children.indexOf(this),1)}
  get lastElementChild(){return this.children.at(-1)}
  set innerHTML(value){this.children=[];if(value)this.append(new Element())}
}
function browser(){
  const elements=new Map();
  const context=vm.createContext({console,ReleaseDate,AbortSignal,Date,Intl,JSON,Set,Map,Promise,
    document:{getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id)},createElement(){return new Element()},querySelectorAll(){return []}},
    localStorage:{getItem(){return null}},indexedDB:{open(){throw Error('disabled')}},
    setTimeout(){},requestAnimationFrame(){},fetch:async()=>({ok:true,json:async()=>({image:'data:image/png;base64,AA==',releaseDate:'2026-11-13',verifiedLatest:true})})});
  vm.runInContext(fs.readFileSync(require.resolve('../app.js'),'utf8').replace(/Promise\.race[\s\S]*$/, ''),context);
  return {context,elements,run:code=>vm.runInContext(code,context)};
}
test('unchanged cards retain their DOM nodes, including when filters change',()=>{
  const b=browser(),grid=b.elements.get('grid'),first=grid.children[0];
  b.run('render()');assert.equal(grid.children[0],first);
  b.run("cat='comic';render();cat='all';render()");assert.equal(grid.children[0],first);
  b.run("data[1].cover='image';data[1].status='found';render()");assert.equal(grid.children[0],first);
});
test('failed refresh retains an existing image and hides its NEW badge',async()=>{
  const b=browser();
  b.run("data[0].cover='saved';data[0].releaseDate='2026-11-13';fetch=async()=>{throw Error('offline')}");
  await b.run('lookup(data[0])');
  assert.equal(b.run('data[0].cover'),'saved');assert.equal(b.run('data[0].stale'),true);
  assert.equal(b.run('isNewIssue(data[0])'),false);
});
test('fresh saved covers skip requests; a forced refresh keeps them visible',async()=>{
  const b=browser();
  b.run("let calls=0;data.forEach(x=>{x.cover='saved';x.status='found';x.cachedAt=Date.now()});fetch=async()=>{calls++;return {ok:true,json:async()=>({image:'updated',verifiedLatest:true})}}");
  await b.run('load()');assert.equal(b.run('calls'),0);
  const loading=b.run('load(true)');assert.equal(b.run('data[0].cover'),'saved');
  await loading;assert.equal(b.run('calls'),b.run('data.length'));
  assert.equal(b.run('data[0].cover'),'updated');assert.equal(b.run('busy'),false);
});

test('API deduplicates requests, caches successful images and preserves them on refresh failure',async()=>{
  let requests=0,offline=false;
  const context=vm.createContext({require:require('node:module').createRequire(require.resolve('../api/cover')),module:{exports:{}},process,Buffer,TextDecoder,URL,AbortSignal,Date,Map,
    fetch:async url=>{requests++;if(offline)throw Error('offline');
      if(String(url).endsWith('.jpg'))return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/jpeg'}});
      const html='<title>週刊少年チャンピオン 最新号</title><p>発売日：2026年11月13日</p><img src="https://www.akitashoten.co.jp/magazine/cover.jpg" alt="表紙">';
      return {ok:true,url:String(url),headers:new Headers({'content-type':'text/html;charset=utf-8'}),arrayBuffer:async()=>Buffer.from(html)};
    }});
  vm.runInContext(fs.readFileSync(require.resolve('../api/cover'),'utf8'),context);
  async function request(refresh=false){const res={headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(value){this.value=value},send(){}};await context.module.exports({method:'GET',url:'/api/cover?name='+encodeURIComponent('週刊少年チャンピオン')+(refresh?'&refresh=1':'')},res);return res}
  const [a,b]=await Promise.all([request(),request()]);
  assert.equal(requests,2);assert.equal(a.value.image,b.value.image);
  assert.equal(a.value.releaseDate,'2026-11-13');
  await request();assert.equal(requests,2);
  offline=true;const stale=await request(true);
  assert.equal(stale.value.image,a.value.image);assert.equal(stale.value.stale,true);
  assert.equal(stale.headers['Cache-Control'],'no-store');
});
