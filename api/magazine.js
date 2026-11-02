/*
 * 女性グラビア雑誌・最新号表紙一覧
 * 使い方: node app.js -> http://localhost:3000
 * Node.js 20+ / npm不要。出版社公式サイトをサーバー側で読み込みます。
 * NOTE: 公式側のHTML変更・画像の外部参照制限・刊行停止には対応状況が左右されます。
 * 雑誌名はすべて『掲載実績のある候補』であり、各最新号の女性グラビアは保証しません。
 */
'use strict';

const CATEGORIES = ['週刊誌・写真週刊誌','漫画雑誌','グラビア専門誌・アイドル誌','セクシーグラビア誌'];
const CATALOG = [
  // 週刊誌・写真週刊誌
  ['weekly-playboy','週刊プレイボーイ',0,'https://wpb.shueisha.co.jp/','weekly'],
  ['friday','FRIDAY',0,'https://friday.kodansha.co.jp/latest-magazine','weekly'],
  ['flash','FLASH',0,'https://smart-flash.jp/flash-guidance/','weekly'],
  ['spa','週刊SPA!',0,'https://nikkan-spa.jp/magazine/','weekly'],
  ['taishu','週刊大衆',0,'https://www.futabasha.co.jp/magazine','publisher'],
  ['post','週刊ポスト',0,'https://www.shogakukan.co.jp/magazines/series/083000','publisher'],
  ['gendai','週刊現代',0,'https://gendai.media/list/magazine','auto'],
  ['asagei','週刊アサヒ芸能',0,'https://www.asagei.com/','auto'],
  ['jitsuwa','週刊実話',0,'https://nihonjournal.jp/jituwa/','weekly'],
  // 漫画雑誌
  ['young-jump','週刊ヤングジャンプ',1,'https://youngjump.jp/magazine/','weekly'],
  ['young-magazine','週刊ヤングマガジン',1,'https://magazine.yanmaga.jp/ym/','weekly'],
  ['monthly-young-magazine','月刊ヤングマガジン',1,'https://magazine.yanmaga.jp/mym/','monthly'],
  ['shonen-magazine','週刊少年マガジン',1,'https://shonenmagazine.com/smaga/','weekly'],
  ['shonen-sunday','週刊少年サンデー',1,'https://websunday.net/','weekly'],
  ['shonen-champion','週刊少年チャンピオン',1,'https://www.akitashoten.co.jp/w-champion/','weekly'],
  ['young-champion','ヤングチャンピオン',1,'https://www.akitashoten.co.jp/youngchampion/','weekly'],
  ['young-champion-retsu','ヤングチャンピオン烈',1,'https://www.akitashoten.co.jp/yc-retsu/','monthly'],
  ['bessatsu-young-champion','別冊ヤングチャンピオン',1,'https://www.akitashoten.co.jp/bessatsu-yc/','monthly'],
  ['monthly-shonen-champion','月刊少年チャンピオン',1,'https://www.akitashoten.co.jp/m-champion/','monthly'],
  ['young-animal','ヤングアニマル',1,'https://magazine.younganimal.com/','weekly'],
  ['young-animal-zero','ヤングアニマルZERO',1,'https://magazine.younganimal.com/','index'],
  ['big-spirits','ビッグコミックスピリッツ',1,'https://www.shogakukan.co.jp/magazines/series/024000','publisher'],
  ['sunday-gx','月刊サンデーGX',1,'https://sundaygx.com/','monthly'],
  ['young-gangan','ヤングガンガン',1,'https://magazine.jp.square-enix.com/yg/new/','weekly'],
  ['young-dragon-age','ヤングドラゴンエイジ',1,'https://www.kadokawa.co.jp/','index'],
  ['manga-action','漫画アクション',1,'https://www.futabasha.co.jp/magazine','publisher'],
  // グラビア専門誌・アイドル誌
  ['bomb','BOMB',2,'https://bombweb.jp/','monthly'],
  ['blt','B.L.T.',2,'https://bltweb.jp/','monthly'],
  ['blt-summer','B.L.T. SUMMER CANDY',2,'https://bltweb.jp/','index'],
  ['blt-graph','blt graph.',2,'https://bltweb.jp/','index'],
  ['utb','UTB（アップトゥボーイ）',2,'https://utb.wanibooks-newscrunch.com/','monthly'],
  ['ex-taishu','EX大衆',2,'https://www.futabasha.co.jp/magazine','publisher'],
  ['gravure-the-television','グラビアザテレビジョン',2,'https://www.kadokawa.co.jp/product/322603001451/','issue'],
  ['gravure-age','グラビアンエイジ',2,'https://www.kadokawa.co.jp/','index'],
  ['gravure-champion','グラビアチャンピオン',2,'https://www.akitashoten.co.jp/g-champion/','monthly'],
  ['girls-pedia','GIRLS-PEDIA',2,'https://www.kadokawa.co.jp/','index'],
  ['white-graph','WHITE graph',2,'https://www.kodansha.co.jp/','index'],
  ['brody','BRODY',2,'https://www.brodymag.com/','monthly'],
  ['entame','ENTAME',2,'https://www.tokuma.jp/','index'],
  ['top-yell-neo','Top Yell NEO',2,'https://www.takeshobo.co.jp/','index'],
  ['shunsatsu','旬撮GIRL',2,'https://nikkan-spa.jp/','index'],
  ['flash-special','FLASHスペシャル',2,'https://smart-flash.jp/','index'],
  ['friday-gold','FRIDAY GOLD',2,'https://friday.kodansha.co.jp/','index'],
  ['wpb-premium','週刊プレイボーイPREMIUM',2,'https://wpb.shueisha.co.jp/','index'],
  ['parade','PARAdE',2,'https://www.shogakukan.co.jp/','index'],
  ['sabra','sabra',2,'https://www.shogakukan.co.jp/','archive'],
  // セクシーグラビア誌（女性掲載）
  ['mens-dvd','MEN’S DVD',3,'https://www.sanwapub.com/','index'],
  ['mens-dvd-sexy','MEN’S DVD SEXY',3,'https://www.sanwapub.com/','index'],
  ['gra-fan','gra fan',3,'https://www.sanwapub.com/','index'],
  ['jitsuwa-knuckles','実話ナックルズ',3,'https://taiyohgroup.jp/','index'],
  ['jitsuwa-taboo','週刊実話ザ・タブー',3,'https://nihonjournal.jp/','index'],
  ['kin-ex-dvd','金のEX DVD',3,'https://taiyohgroup.jp/','index']
].map(([id,name,group,url,strategy]) => ({id,name,group:CATEGORIES[group],url,strategy}));

// 特定誌で公式の最新号ページURLや表紙画像URLが変わったらここで調整。
// cover は公式の画像URLを指定。ページ更新ごとに手動変更する場合のみ使用。
const OVERRIDES = {
  // 'bomb': {cover:'https://example.com/official-cover.jpg', issue:'2026年11月号'},
  // 'gravure-the-television': {url:'https://www.kadokawa.co.jp/product/新しい号/'},
};

if (typeof window === 'undefined') {
  // =========================== Node.js server ===========================
  const http = require('node:http');
  const fs = require('node:fs/promises');
  const path = require('node:path');
  const PORT = Math.max(1, Number(process.env.PORT)||3000);
  const TTL = 6*60*60*1000; // 6時間キャッシュ。最新情報が必要なら「再取得」を使う
  const MAX_HTML = 4_000_000;
  const cache = new Map();
  const pending = new Map();
  const htmlPath = path.join(__dirname, 'index.html');
  const jsPath = path.join(__dirname,'app.js');
  const BLOCKED = /(?:^|[\/_\.-])(logo|icon|favicon|banner|bnr|avatar|sprite|arrow|button|btn|menu|header|footer|advert|ad_|qrcode|qr-code|loading|spacer)(?:[\/_\.-]|$)/i;
  const COVER = /(cover|hyoshi|hyo[us]hi|magazine|mag_|_mag|issue|latest|new(?:_)?issue|front|topimage|mainvisual|main_visual|honshi|book)/i;

  function decode(s='') { return String(s).replace(/&(?:amp|quot|apos|lt|gt|nbsp|#(x[0-9a-f]+|\d+));/gi, (_,e)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}[e.toLowerCase()] || (e[0]==='#' ? String.fromCodePoint(parseInt(e.slice(e[1]==='x'?2:1), e[1]==='x'?16:10)||32):' '))); }
  function plain(s) {return decode(s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());}
  function attr(tag,key){const m=tag.match(new RegExp('(?:^|\\s)'+key+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))','i'));return decode(m?.[1]||m?.[2]||m?.[3]||'');}
  function resolveUrl(src,base){try{ if(!src || /^(data|javascript|blob):/i.test(src)) return '';const u=new URL(src.replace(/&amp;/g,'&'),base);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}}
  function candidates(html,base){const list=[];
    const add=(src,alt='',index=0,type='img')=>{let url=resolveUrl(src,base);if(url) list.push({url,alt,at:index,type});};
    for(const m of html.matchAll(/<meta\b[^>]*>/gi)){const tag=m[0],prop=attr(tag,'property')||attr(tag,'name');if(/^(?:og:image(?::url)?|twitter:image(?::src)?)$/i.test(prop)) add(attr(tag,'content'),'meta',m.index,'meta');}
    for(const m of html.matchAll(/<(?:img|source)\b[^>]*>/gi)) {const tag=m[0];const src=attr(tag,'data-src')||attr(tag,'data-original')||attr(tag,'data-lazy-src')||attr(tag,'src')||(attr(tag,'srcset').split(',')[0]||'').trim().split(/\s+/)[0];add(src,attr(tag,'alt')+' '+attr(tag,'class')+' '+attr(tag,'id'),m.index,'img');}
    for(const m of html.matchAll(/"(?:image|thumbnailUrl|contentUrl)"\s*:\s*"(https?:[^" ]+)"/gi))add(m[1].replace(/\\\//g,'/'),'structured',m.index,'json');
    return list;
  }
  function score(item,html,mag){const path=new URL(item.url).pathname;const desc=(item.url+' '+item.alt).toLowerCase();if(BLOCKED.test(path) || /logo|favicon|sprite|avatar|advert|banner|badge|button|instagram|twitter|youtube/i.test(item.alt))return -100;
    let n=0;
    if(item.type==='meta') n+=8;
    if(COVER.test(desc)) n+=10;
    if(/表紙|最新号|本誌|今号|雑誌|magazine|週刊|月刊|グラビア/i.test(item.alt))n+=18;
    if(/\.jpe?g|\.png|\.webp/i.test(path))n+=2;
    if(/\b(\d{3,4})[xX_\-](\d{3,4})\b/.test(desc))n+=3;
    const near=plain(html.slice(Math.max(0,item.at-320),Math.min(html.length,item.at+330)));
    if(/最新号|NEW RELEASE|NEW MAGAZINE|今号|表紙|発売中|latest.issue/i.test(near))n+=18;
    if(item.at<html.length*.30)n+=6;
    if(mag.strategy==='issue' && item.type==='meta')n+=20;
    if(/\/magazine\/|\/ym\/|\/mym\/|\/smaga\/|\/new\//.test(new URL(mag.url).pathname) && item.type==='meta')n+=3;
    if(/(ロゴ|カバー一覧|バックナンバー|次号予告)/.test(near))n-=6;
    return n;
  }
  function findIssue(html,name){ const txt=plain(html).slice(0,12000);
    const patterns=[/(?:最新号|今号|NEW RELEASE|NEW MAGAZINE)[^。]{0,110}?((?:20\d{2}年)?\s*(?:\d{1,2}月\d{1,2}日[・･\d月号]*|No\.?\s*\d{1,3}(?:[-・]\d+)?|第?\d{1,4}号|\d{1,2}月号))/i,/(20\d{2}年\s*\d{1,2}月(?:\d{1,2}日)?(?:・\d{1,2}日)?号)/,/(No\.\s*\d{1,3}(?:[-・]\d{1,3})?)/i];
    for(const re of patterns){let m=txt.match(re);if(m)return m[1].replace(/\s+/g,' ').trim();}return '';
  }
  async function fetchText(url){const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),12500);
    try{const res=await fetch(url,{signal:ctrl.signal,headers:{'user-agent':'Mozilla/5.0 (compatible; MagazineCoverChecker/1.0; personal use)','accept':'text/html,application/xhtml+xml'}});
      if(!res.ok)throw Error('HTTP '+res.status);
      const contentType=res.headers.get('content-type')||'';if(!/html|text\//i.test(contentType))throw Error('HTMLではありません');
      const reader=res.body.getReader();const chunks=[];let size=0;
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_HTML)throw Error('HTMLが大きすぎます');chunks.push(value);}
      const data=Buffer.concat(chunks);
      // 日本語サイトはほぼUTF-8。charset=shift_jis 等も判定。
      const char=(contentType.match(/charset=([^;\s]+)/i)?.[1] || data.subarray(0,3000).toString('latin1').match(/charset\s*=\s*["']?([^"'\s>;]+)/i)?.[1] || 'utf-8').toLowerCase();
      let html;try{html=new TextDecoder(char).decode(data);}catch{html=data.toString('utf8');}
      return {html,url:res.url};
    }finally{clearTimeout(timer);}
  }
  async function obtain(mag){
    const src=OVERRIDES[mag.id]||{};const page=src.url||mag.url;
    if(src.cover)return {...mag,url:page,cover:src.cover,issue:src.issue||'',status:'手動設定',updated:new Date().toISOString()};
    if(mag.strategy==='archive')return {...mag,cover:'',issue:'',status:'休刊・過去誌',updated:null};
    if(mag.strategy==='index')return {...mag,cover:'',issue:'',status:'個別の最新号URL未登録',updated:null};
    try{
      const {html,url}=await fetchText(page);
      // 出版社トップなどの「共通一覧」は誤認の可能性が高いため画像を自動確定させない。
      if(mag.strategy==='publisher')return {...mag,url,cover:'',issue:'',status:'出版社の一覧ページ（個別設定待ち）',updated:null};
      const images=candidates(html,url).map(x=>({...x,score:score(x,html,mag)})).sort((a,b)=>b.score-a.score);
      const top=images[0];const threshold=mag.strategy==='issue'?8:23;
      return {...mag,url,cover:top&&top.score>=threshold?top.url:'',issue:findIssue(html,mag.name),status:top&&top.score>=threshold?'表紙候補（自動推定）':'表紙画像を特定できません',updated:new Date().toISOString(),confidence:top?.score||0};
    }catch(e){return {...mag,url:page,cover:'',issue:'',status:'取得失敗：'+String(e.message).slice(0,64),updated:new Date().toISOString()};}
  }
  async function getOne(mag,force=false){const saved=cache.get(mag.id);if(!force && saved && Date.now()-saved.time<TTL)return saved.result;
    if(pending.has(mag.id))return pending.get(mag.id);
    const job=obtain(mag).then(result=>{cache.set(mag.id,{time:Date.now(),result});return result}).finally(()=>pending.delete(mag.id));pending.set(mag.id,job);return job;
  }
  async function batch(items,n=5){const out=[];let idx=0;async function worker(){while(idx<items.length){const my=idx++;out[my]=await getOne(items[my]);}}await Promise.all(Array.from({length:Math.min(n,items.length)},worker));return out;}
  function json(res,code,obj){const body=JSON.stringify(obj);res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'same-origin'});res.end(body);}
  const server=http.createServer(async(req,res)=>{try{
    const u=new URL(req.url,'http://localhost');
    if(u.pathname==='/api/covers'){
      if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
      // 攻撃的なリクエストを避けるため対象は固定の52誌のみ。
      const id=u.searchParams.get('id'); const force=u.searchParams.get('refresh')==='1';
      if(id){const mag=CATALOG.find(x=>x.id===id);if(!mag)return json(res,404,{error:'対象外の雑誌'});
        if(force)cache.delete(id);return json(res,200,{items:[await getOne(mag,force)],cachedAt:new Date().toISOString()});}
      if(force)cache.clear();return json(res,200,{items:await batch(CATALOG),cachedAt:new Date().toISOString()});
    }
    if(u.pathname==='/api/catalog')return json(res,200,{items:CATALOG});
    const file=u.pathname==='/'||u.pathname==='/index.html'?htmlPath:u.pathname==='/app.js'?jsPath:null;
    if(!file){res.writeHead(404);return res.end('Not Found');}
    const data=await fs.readFile(file);
    res.writeHead(200,{'content-type':file===htmlPath?'text/html; charset=utf-8':'application/javascript; charset=utf-8','cache-control':'no-cache','x-content-type-options':'nosniff'});res.end(data);
  }catch(err){console.error(err);json(res,500,{error:'サーバー内部エラー'});}});
  server.listen(PORT,()=>console.log(`女性グラビア雑誌一覧: http://localhost:${PORT}`));
} else {
  // =========================== Browser UI ===========================
  const $=selector=>document.querySelector(selector);
  const state={all:CATALOG.map(x=>({...x,cover:'',issue:'',status:'取得前'})),category:'すべて',query:'',mode:'all',busy:false};
  const initial=Object.fromEntries(CATALOG.map(x=>[x.id,x]));
  const placeholder=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 245"><rect width="180" height="245" fill="#1b2331"/><rect x="24" y="31" width="132" height="183" rx="9" fill="none" stroke="#536075" stroke-width="2" stroke-dasharray="6 6"/><path d="M66 126h48M90 102v48" stroke="#64748b" stroke-width="3" stroke-linecap="round"/><text x="90" y="179" font-size="12" fill="#b6c2d0" text-anchor="middle">画像未取得</text></svg>`;
  const ph='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(placeholder);
  const safe=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function render(){
    const visible=state.all.filter(x=>(state.category==='すべて'||x.group===state.category) && (x.name.toLowerCase().includes(state.query)||x.group.toLowerCase().includes(state.query)) && (state.mode==='all'||(state.mode==='has'?!!x.cover:!x.cover)));
    $('#count').textContent=`${visible.length}誌表示 ／ 全${state.all.length}誌 ・ 画像取得 ${state.all.filter(x=>x.cover).length}誌`;
    $('#grid').innerHTML=visible.map(x=>`<article class="magazine" data-id="${safe(x.id)}">
      <a class="cover" href="${safe(x.url)}" target="_blank" rel="noopener noreferrer" title="公式ページを開く">
        <img loading="lazy" decoding="async" src="${safe(x.cover||ph)}" alt="${safe(x.name)} の表紙画像${x.cover?'（自動推定）':'（未取得）'}" onerror="this.onerror=null;this.src='${ph}'"/>
        ${x.cover?'':'<span class="no-cover">NO COVER</span>'}
      </a>
      <div class="mag-info"><div class="mag-group">${safe(x.group)}</div><h2>${safe(x.name)}</h2><p class="issue">${safe(x.issue||'号数は未確認')}</p><p class="status ${x.cover?'yes':'not'}" title="${safe(x.status)}">${safe(x.status)}</p>
      <div class="actions"><a href="${safe(x.url)}" target="_blank" rel="noopener noreferrer">公式サイト <span aria-hidden="true">↗</span></a><button type="button" data-reload="${safe(x.id)}" aria-label="${safe(x.name)} を再取得">↻ 更新</button></div></div>
    </article>`).join('') || '<p class="empty">条件に一致する雑誌はありません。</p>';
  }
  function setProgress(s){$('#progress').textContent=s;}
  async function refreshAll(force=false){
    if(state.busy)return;
    state.busy=true;$('#refresh').disabled=true;
    let done=0,successful=0;
    setProgress(`公式サイトから取得中… ${done} / ${CATALOG.length}`);
    try{
      // 数誌ずつ読み込み、完了したカードから順次表示する。
      // API側の6時間キャッシュを利用する。強制更新時だけ全キャッシュを無視。
      let index=0;
      async function worker(){
        while(index<CATALOG.length){
          const magazine=CATALOG[index++];
          try{
            const endpoint='/api/covers?id='+encodeURIComponent(magazine.id)+(force?'&refresh=1':'');
            const response=await fetch(endpoint,{cache:'no-store'});
            if(!response.ok)throw Error('HTTP '+response.status);
            const body=await response.json();const updated=body.items[0];
            const position=state.all.findIndex(x=>x.id===magazine.id);
            if(position>=0)state.all[position]=updated;
            if(updated.cover)successful++;
          }catch(e){
            const position=state.all.findIndex(x=>x.id===magazine.id);
            if(position>=0)state.all[position]={...state.all[position],status:'通信エラー：'+e.message};
          }
          done++;render();setProgress(`取得中… ${done} / ${CATALOG.length}誌（表紙候補 ${successful}誌）`);
        }
      }
      await Promise.all(Array.from({length:7},worker));
      setProgress(`取得完了：${new Date().toLocaleString('ja-JP')} ／ 画像は自動推定です。公式サイトでご確認ください。`);
    }finally{state.busy=false;$('#refresh').disabled=false;}
  }
  async function refreshOne(id){const button=document.querySelector(`[data-reload="${id}"]`);if(button)button.disabled=true;
    try{const res=await fetch('/api/covers?id='+encodeURIComponent(id)+'&refresh=1');if(!res.ok)throw Error('HTTP '+res.status);const json=await res.json();const updated=json.items[0];const i=state.all.findIndex(x=>x.id===id);if(i>=0)state.all[i]=updated;render();setProgress(updated.name+'：'+updated.status);}
    catch(e){setProgress('更新失敗：'+e.message);}finally{const b=document.querySelector(`[data-reload="${id}"]`);if(b)b.disabled=false;}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const options=['すべて',...CATEGORIES];$('#filters').innerHTML=options.map((x,i)=>`<button class="pill ${i===0?'selected':''}" data-group="${safe(x)}">${safe(x)}</button>`).join('');
    $('#filters').addEventListener('click',e=>{const b=e.target.closest('[data-group]');if(!b)return;state.category=b.dataset.group;$('#filters').querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x===b));render();});
    $('#search').addEventListener('input',e=>{state.query=e.target.value.trim().toLowerCase();render();});
    $('#filter-status').addEventListener('change',e=>{state.mode=e.target.value;render();});
    $('#refresh').addEventListener('click',()=>refreshAll(true));
    $('#grid').addEventListener('click',e=>{const b=e.target.closest('[data-reload]');if(b)refreshOne(b.dataset.reload);});
    render();refreshAll();
  });
}
