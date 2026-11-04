// Cover Grid server: Node.js 20+, no dependencies.
// Covers are extracted only from configured official magazine/publisher pages.
const fs=require('node:fs'),path=require('node:path');
const ROOT=process.cwd(),TTL=6*60*60*1000;
const cache=new Map(),pending=new Map();
const manual=()=>{try{return JSON.parse(fs.readFileSync(path.join(ROOT,'covers.json'),'utf8'))}catch{return {}}};
const sources=()=>{try{return JSON.parse(fs.readFileSync(path.join(ROOT,'sources.json'),'utf8'))}catch{return {}}};
const agent={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36','Accept-Language':'ja-JP,ja;q=0.9,en;q=0.7'};
const decode=s=>String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#(?:39|x27);/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/\\\//g,'/').trim();
const strip=s=>decode(s).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s.・\-ー　]/g,'');
function safeOfficial(u,base){if(!String(u||'').trim())return null;try{const x=new URL(decode(u),base);return x.protocol==='https:'?x.href:null}catch{return null}}
function parseAttrs(tag){const a={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))a[m[1].toLowerCase()]=decode(m[2]??m[3]??m[4]);return a}
function extract(html,source,name){
 const baseTag=html.match(/<base\b[^>]*>/i);const base=baseTag?(safeOfficial(parseAttrs(baseTag[0]).href,source.url)||source.url):source.url,title=strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||name);
 let ogImage='';for(const m of html.matchAll(/<meta\b[^>]*>/gi)){const a=parseAttrs(m[0]);if((a.property||a.name||'').toLowerCase()==='og:image'&&a.content){ogImage=safeOfficial(a.content,base);break}}
 const images=[];
 for(const m of html.matchAll(/<img\b[^>]*>/gi)){const a=parseAttrs(m[0]);let src=a['data-src']||a['data-original']||a.src||'';if(!src&&a.srcset)src=a.srcset.split(',')[0].trim().split(/\s+/)[0];const url=safeOfficial(src,base);if(!url)continue;const alt=[a.alt,a.title,a.class,a.id,url].filter(Boolean).join(' ');if(/logo|icon|avatar|sprite|banner|button|sns|qr/i.test(alt))continue;images.push({url,alt})}
 if(ogImage&&!images.some(x=>x.url===ogImage))images.unshift({url:ogImage,alt:'og:image'});
 const pageNorm=norm(title+' '+strip(html.slice(0,90000)));const nameNorm=norm(name);
 const ranked=images.map((im,i)=>{const n=norm(im.alt);let score=0;if(/cover|表紙|magazine|issue|\d{4}[-_年]/i.test(im.alt))score+=3;if(n.includes(nameNorm))score+=10;if(/og:image/.test(im.alt))score+=1;if(/\.svg(?:\?|$)|\.png(?:\?|$)/i.test(im.url))score-=3;if(/sample|banner|logo|icon/i.test(im.alt))score-=8;
   // Magazine pages often name the cover asset by issue number or date.
   if(/cover|hyoshi|表紙|_w_?\d{4}|\d{4}[-_]\d{1,2}/i.test(im.url))score+=6;
   if(source.imageHint&&new RegExp(source.imageHint,'i').test(im.url+' '+im.alt))score+=20;
   else if(source.requireHint)score=-100;
   if(source.matchName&&!n.includes(nameNorm))score=-100;return {...im,score,i}}).sort((a,b)=>b.score-a.score||a.i-b.i);
 let chosen=ranked.find(x=>x.score>=3);
 
 if(!chosen)return {status:'missing',officialUrl:base,source:source.label||new URL(base).hostname,error:'公式ページから表紙画像を判別できませんでした。公式ページを開いて確認してください。'};
 const pageText=strip(html);
 const dates=[...pageText.matchAll(/(?:20\d{2})[./年-](?:0?[1-9]|1[0-2])(?:[./月-](?:0?[1-9]|[12]\d|3[01])日?)?/g)].map(m=>m[0]);
 const date=dates.find(d=>d.slice(0,4)>=String(new Date().getFullYear()-1))||'';
 return {status:'found',image:chosen.url,title,officialUrl:source.url,url:source.url,date,source:source.label||new URL(base).hostname,verifiedLatest:!!source.verifiedLatest};
}
async function get(url){const r=await fetch(url,{headers:agent,signal:AbortSignal.timeout(15000),redirect:'follow'});if(!r.ok)throw Error('HTTP '+r.status);const ct=r.headers.get('content-type')||'';if(!/html|xhtml/i.test(ct))throw Error('公式ページがHTMLを返しませんでした');const bytes=Buffer.from(await r.arrayBuffer());const prefix=bytes.subarray(0,4096).toString('latin1');const charset=(ct.match(/charset\s*=\s*["']?([^;"'\s]+)/i)||prefix.match(/<meta\b[^>]*charset\s*=\s*["']?([^\s"'/>]+)/i)||[])[1]||'utf-8';let html;try{html=new TextDecoder(charset).decode(bytes)}catch{html=new TextDecoder('utf-8').decode(bytes)}if(/<title>Site Unavailable<\/title>/i.test(html))throw Error('公式ページがSite Unavailableを返しました');return {html,url:r.url}}
// Shogakukan Sunday: the official homepage marks the current weekly cover with this alt text.
async function sundayCover(source){
 const page=await get(source.url);
 for(const m of page.html.matchAll(/<img\b[^>]*>/gi)){
  const a=parseAttrs(m[0]);
  if(a.alt!=='今週のサンデー')continue;
  const image=safeOfficial(a['data-src']||a['data-original']||a.src,page.url);
  if(image)return {status:'found',image,title:'週刊少年サンデー 今週号',officialUrl:page.url,url:page.url,date:'',source:source.label,verifiedLatest:true};
 }
 throw Error('公式トップページに「今週のサンデー」表紙画像がありません');
}
async function wpbCover(source){
 const index=await get(source.url),candidates=[];
 for(const m of index.html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)){
  const tag=m[0],head=tag.slice(0,tag.indexOf('>')+1),a=parseAttrs(head),url=a.href&&safeOfficial(a.href,index.url);
  if(!url||!/^\/item\/detail\/weeklyplayboy\//.test(new URL(url).pathname))continue;
  for(const im of tag.matchAll(/<img\b[^>]*>/gi)){
   const attrs=parseAttrs(im[0]),title=attrs.alt||attrs.title||'';
   if(!/^週プレ\s*20\d{2}年.*No[.．]?\d+/i.test(title))continue;
   const image=safeOfficial(attrs['data-src']||attrs['data-original']||attrs.src,url);if(!image)continue;
   const number=Number((title.match(/No[.．]?\s*(\d+)/i)||[])[1]||0);
   candidates.push({url,image,title,number});
  }
 }
 candidates.sort((a,b)=>b.number-a.number);const latest=candidates[0];
 if(!latest)throw Error('集英社公式グラジャパの最新号表紙が見つかりませんでした');
 return {status:'found',image:latest.image,title:latest.title,url:latest.url,officialUrl:latest.url,date:'',source:source.label,verifiedLatest:true};
}
function imageCandidates(html,base){
 const out=[];
 for(const m of html.matchAll(/<img\b[^>]*>/gi)){
  const a=parseAttrs(m[0]);let raw=a['data-src']||a['data-original']||a['data-lazy-src']||a['data-original-src']||a.src||'';
  if(!raw&&(a['data-srcset']||a.srcset))raw=(a['data-srcset']||a.srcset).split(',').at(-1).trim().split(/\s+/)[0];
  if(!raw)continue;const url=safeOfficial(raw,base);if(!url)continue;
  const alt=[a.alt,a.title,a.class,a.id].filter(Boolean).join(' ');
  if(/logo|icon|avatar|sprite|button|sns|qr|youtube|facebook|instagram|twitter/i.test(alt+' '+url))continue;
  out.push({url,alt,width:Number(a.width)||0,height:Number(a.height)||0,index:out.length});
 }
 for(const m of html.matchAll(/<[^>]+>/gi)){
  const tag=m[0],a=parseAttrs(tag),style=a.style||'';
  let raw=a['data-background']||a['data-bg']||a['data-bg-src']||'';
  if(!raw)raw=(style.match(/url\(\s*["']?([^"')]+)["']?\s*\)/i)||[])[1]||'';
  if(!raw)continue;const url=safeOfficial(raw,base);if(!url||out.some(x=>x.url===url))continue;
  const alt=[a.alt,a.title,a.class,a.id,'background image'].filter(Boolean).join(' ');
  if(/logo|icon|avatar|sprite|button|sns|qr|youtube|facebook|instagram|twitter/i.test(alt+' '+url))continue;
  out.push({url,alt,width:Number(a.width)||0,height:Number(a.height)||0,index:out.length});
 }
 return out;
}
function portraitCover(html,base,options={}){
 let fragment=html;
 if(options.after){const at=html.toLowerCase().indexOf(options.after.toLowerCase());if(at>=0)fragment=html.slice(at)}
 if(options.before){const at=fragment.toLowerCase().indexOf(options.before.toLowerCase());if(at>=0)fragment=fragment.slice(0,at)}
 const candidates=imageCandidates(fragment,base);
 const scored=candidates.map((x,i)=>{
  const ratio=x.width&&x.height?x.height/x.width:0;
  let score=0;
  if(ratio>=1.2)score+=16;else if(ratio>=1)score+=8;else if(ratio>0)score-=10;
  if(x.width*x.height>100000)score+=1;
  if(/cover|hyoshi|表紙|magazine|issue/i.test(x.alt+' '+x.url))score+=5;
  if(/sample|banner|logo|icon|thumbnail/i.test(x.alt+' '+x.url))score-=15;
  score-=i*3;
  return {...x,score};
 }).sort((a,b)=>b.score-a.score||a.index-b.index);
 const chosen=scored.find(x=>x.score>=0)||candidates[0];
 return chosen||null;
}
function resultFor(source,page,image,title,extra={}){
 const pageDate=strip(page.html).match(/20\d{2}[./年-]\s*0?\d{1,2}(?:[./月-]\s*0?\d{1,2}日?)?/);
 return {status:'found',image:image.url,title:title||'',officialUrl:page.url,url:page.url,date:extra.date||pageDate?.[0]||'',source:source.label||new URL(page.url).hostname,verifiedLatest:true};
}
async function utbCover(source){
 const page=await get(source.url);
 // The TOPICS lead card describes the current cover as a 「表紙巻頭」 appearance.
 // Match that card's image alt text so the adjacent gravure cards are not mistaken for the cover.
 const candidates=imageCandidates(page.html,page.url);
 const img=candidates.find(x=>/表紙\s*巻頭/.test(x.alt))||portraitCover(page.html,page.url);
 if(!img)throw Error('TOPICS先頭の記事の表紙画像を見つけられませんでした');
 return resultFor(source,page,img,'Up To Boy 最新号');
}
async function youngAnimalCover(source){
 const page=await get(source.url);
 for(const m of page.html.matchAll(/<img\b[^>]*>/gi)){
  const a=parseAttrs(m[0]);
  if(!/ヤングアニマル表紙/.test(a.alt||''))continue;
  const image=safeOfficial(a['data-src']||a['data-original']||a.src,page.url);
  if(image)return resultFor(source,page,{url:image,alt:a.alt},'ヤングアニマル 最新号');
 }
 const img=portraitCover(page.html,page.url,{after:'今号紹介',before:'ヤングアニマルZERO'});
 if(img)return resultFor(source,page,img,'ヤングアニマル 最新号');
 throw Error('公式トップページの最新号表紙が見つかりませんでした');
}
async function hakusenshaYoungAnimalCover(source){
 const index=await get(source.url),candidates=[];
 for(const m of index.html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)){
  const tag=m[0],head=tag.slice(0,tag.indexOf('>')+1),a=parseAttrs(head),title=strip(tag).normalize('NFKC').replace(/\s+/g,' ').trim();
  const issue=title.match(/^ヤングアニマル\s*(\d+)号(?:\s|$|　)/);const url=a.href&&safeOfficial(a.href,index.url);
  if(issue&&url&&new URL(url).hostname==='www.hakusensha.co.jp'&&/^\/news\/\d+\/?$/.test(new URL(url).pathname))candidates.push({url,title,number:Number(issue[1])});
 }
 if(!candidates.length)throw Error('白泉社の公式ニュース一覧に最新ヤングアニマル号がありません');
 const page=await get(candidates[0].url);let image=null;
 for(const m of page.html.matchAll(/<meta\b[^>]*>/gi)){const a=parseAttrs(m[0]);if((a.property||'').toLowerCase()==='og:image'){image=safeOfficial(a.content,page.url);if(image)break}}
 image=image||portraitCover(page.html,page.url)?.url;
 if(!image)throw Error('白泉社の最新号告知に表紙画像がありません');
 const date=(strip(page.html).match(/20\d{2}\.\s*\d{1,2}\.\s*\d{1,2}/)||[])[0]||'';
 return {status:'found',image,title:candidates[0].title,url:page.url,officialUrl:page.url,date,source:source.label,verifiedLatest:true};
}
async function bltCover(source,name){
 const index=await get(source.url),candidates=[];
 for(const m of index.html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)){
  const tag=m[0],head=tag.slice(0,tag.indexOf('>')+1),a=parseAttrs(head),url=a.href&&safeOfficial(a.href,index.url),title=strip(tag);
  if(!url||new URL(url).hostname!=='bltweb.jp')continue;
  if(name==='B.L.T. graph.'){
   const vol=title.match(/blt\s*graph\s*\.\s*vol\.?\s*(\d+)/i);
   if(vol)candidates.push({url,title,vol:Number(vol[1])});
  }else{
   if(/graph\s*\.\s*vol/i.test(title))continue;
   const issue=title.match(/B\.L\.T\.\s*(20\d{2})年\s*(\d{1,2})月号/i);
   if(issue)candidates.push({url,title,year:Number(issue[1]),month:Number(issue[2])});
  }
 }
 candidates.sort(name==='B.L.T. graph.'?(a,b)=>b.vol-a.vol:(a,b)=>b.year-a.year||b.month-a.month);
 const target=candidates[0];if(!target)throw Error('B.L.T.webの公式号告知から最新号を見つけられませんでした');
 const page=await get(target.url),img=portraitCover(page.html,page.url);
 if(!img)throw Error('B.L.T.webの号告知から表紙画像を見つけられませんでした');
 return resultFor(source,page,img,target.title);
}
async function dmagazineCover(source){
 const page=await get(source.url);
 const title=strip((page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'旬撮GIRL 最新号');
 let image='';for(const m of page.html.matchAll(/<meta\b[^>]*>/gi)){const a=parseAttrs(m[0]);if((a.property||'').toLowerCase()==='og:image'){image=safeOfficial(a.content,page.url);if(image)break}}
 image=image||imageCandidates(page.html,page.url).find(x=>/旬撮GIRL/i.test(x.alt))?.url;
 if(!image)throw Error('dマガジン公式配信ページに旬撮GIRLの表紙がありません');
 const date=(strip(page.html).match(/20\d{2}[./年-]\s*0?\d{1,2}[./月-]\s*\d{1,2}/)||[])[0]||'';
 return {status:'found',image,title,officialUrl:page.url,url:page.url,date,source:source.label,verifiedLatest:true};
}
async function tokumaCover(source,name){
 const index=await get(source.url),items=[];
 for(const m of index.html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)){
  const head=m[0].slice(0,m[0].indexOf('>')+1),a=parseAttrs(head),url=a.href&&safeOfficial(a.href,index.url);
  if(!url||!/^\/book\/b\d+\.html$/i.test(new URL(url).pathname))continue;
  const title=strip(m[0]).normalize('NFKC').replace(/\s+/g,' ').trim();
  if(!title)continue;
  const vol=(title.match(/(?:ENTAME\s*)?36\s*(?:℃|°C)\s*vol\.?\s*(\d+)/i)||[])[1];
  const isTarget=name==='Navy'?/^Navy$/i.test(title):!!vol;
  if(isTarget)items.push({url,title,vol:Number(vol||0)});
 }
 items.sort((a,b)=>b.vol-a.vol);
 const target=items[0];if(!target)throw Error('徳間書店の雑誌一覧から最新号を見つけられませんでした');
 const page=await get(target.url);
 const titleMatch=page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i),title=strip(titleMatch?.[1]||target.title).replace(/\s*-\s*徳間書店.*$/,'').normalize('NFKC').replace(/\s+/g,' ').trim();
 const main=[...page.html.matchAll(/<img\b[^>]*>/gi)].map(m=>parseAttrs(m[0])).find(a=>/^(Navy|ENTAME\s*36\s*(?:℃|°C))/i.test((a.alt||'').normalize('NFKC')));
 const image=safeOfficial(main?.src||main?.['data-src']||'',page.url);
 if(!image)throw Error('徳間書店の商品詳細ページから表紙画像を見つけられませんでした');
 return resultFor(source,page,{url:image},title);
}
async function flashSpecialCover(source){
 const page=await get(source.url);
 const area=page.html.match(/<[a-z][\w:-]*\b[^>]*class=["'][^"']*\bMagazineImg\b[^"']*["'][^>]*>([\s\S]{0,10000}?)<\/[a-z][\w:-]*>/i);
 if(!area)throw Error('FLASHスペシャルの表紙画像エリア（MagazineImg）が見つかりませんでした');
 const tag=area[1].match(/<img\b[^>]*>/i),attrs=tag&&parseAttrs(tag[0]);
 const image=attrs&&safeOfficial(attrs.src||attrs['data-src']||attrs['data-original'],page.url);
 if(!image)throw Error('FLASHスペシャルのMagazineImgに画像がありません');
 return resultFor(source,page,{url:image,alt:attrs.alt||'FLASHスペシャル表紙'},'FLASHスペシャル 最新号');
}
async function fujisanSeriesCover(source){
 const page=await get(source.url),attrs=[...page.html.matchAll(/<img\b[^>]*>/gi)].map(m=>parseAttrs(m[0])).find(a=>/subscription-cover-img/.test(a.class||'')&&/旬撮GIRL.*Vol\.?\s*\d+/i.test(a.alt||''));
 const image=attrs&&safeOfficial(attrs.src||attrs['data-src']||attrs['data-replace'],page.url);
 if(!image)throw Error('旬撮GIRLの最新号カバー画像が見つかりませんでした');
 const title=attrs.alt.normalize('NFKC').replace(/\s+/g,' ').trim();
 return resultFor(source,page,{url:image,alt:attrs.alt},title);
}
async function bltMonsterCover(source){
 const index=await get(source.url),items=[];
 for(const m of index.html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)){
  const a=parseAttrs(m[0].slice(0,m[0].indexOf('>')+1)),title=strip(m[0]),round=(title.match(/BLT\s*MONSTER\s*Round\s*(\d+)/i)||[])[1],url=a.href&&safeOfficial(a.href,index.url);
  if(round&&url&&new URL(url).hostname==='bltweb.jp')items.push({url,title,round:Number(round)});
 }
 items.sort((a,b)=>b.round-a.round);const target=items[0];
 if(!target)throw Error('B.L.T.webでBLT MONSTERの最新ラウンドを見つけられませんでした');
 const page=await get(target.url),images=imageCandidates(page.html,page.url);
 const img=images.find(x=>/BLT\s*MONSTER\s*Round\s*\d+/i.test(x.alt))||portraitCover(page.html,page.url);
 if(!img)throw Error('BLT MONSTER最新号の表紙画像が見つかりませんでした');
 return resultFor(source,page,img,target.title);
}
async function byakuyaCover(source,name){
 const index=await get(source.url),items=[];
 for(const m of index.html.matchAll(/<img\b[^>]*>/gi)){
  const img=parseAttrs(m[0]),text=(img.alt||'').normalize('NFKC').replace(/\s+/g,' ').trim();
  const issue=name==='ブブカ'?text.match(/(?:ブブカ|BUBKA).*?(20\d{2})年\s*(\d{1,2})月号/i):text.match(/DOLCE\s*Vol\.?\s*(\d+)/i);
  if(!issue)continue;
  const around=index.html.slice(Math.max(0,m.index-1200),m.index+1800),href=around.match(/href=["']([^"']*\/shopdetail\/[^"']+)["']/i),url=href&&safeOfficial(href[1],index.url);
  if(url&&new URL(url).hostname==='store.byakuya-shobo.co.jp')items.push({url,text,year:name==='ブブカ'?Number(issue[1]):0,month:name==='ブブカ'?Number(issue[2]):0,vol:name==='DOLCE'?Number(issue[1]):0});
 }
 items.sort(name==='ブブカ'?(a,b)=>b.year-a.year||b.month-a.month:(a,b)=>b.vol-a.vol);const target=items[0];
 if(!target)throw Error('白夜書房公式通販で最新号を見つけられませんでした');
 const page=await get(target.url),images=imageCandidates(page.html,page.url),exact=images.find(x=>/akamaized\.net\/moebshop\/itemimages\//.test(x.url)&&norm(x.alt).includes(norm(target.text)));
 const img=exact||portraitCover(page.html,page.url,{after:'itemImgBox',before:'</div>\\s*<div'});
 if(!img)throw Error('商品詳細ページで誌面の表紙画像を見つけられませんでした');
 return resultFor(source,page,img,target.text);
}
async function publisherSeriesCover(source,name){
 const index=await get(source.url),items=[];
 for(const m of index.html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)){
  const a=parseAttrs(m[0].slice(0,m[0].indexOf('>')+1)),title=strip(m[0]).normalize('NFKC').replace(/\s+/g,' '),url=a.href&&safeOfficial(a.href,index.url);
  if(!url||!new URL(url).hostname.endsWith('prtimes.jp')||!/(PARADE|パレード)/i.test(title))continue;
  const vol=(title.match(/(?:第\s*)?(\d+)\s*号|Vol\.?\s*(\d+)/i)||[]),date=title.match(/20(\d{2})年\s*(\d{1,2})月/);
  items.push({url,title,vol:Number(vol[1]||vol[2]||0),year:Number(date?.[1]||0),month:Number(date?.[2]||0)});
 }
 items.sort((a,b)=>b.vol-a.vol||b.year-a.year||b.month-a.month);const target=items[0];
 if(!target)throw Error('小学館の公式告知一覧からPARADE最新号を見つけられませんでした');
 const page=await get(target.url),images=imageCandidates(page.html,page.url),img=images.find(x=>/PARADE.*表紙|表紙.*PARADE/i.test(x.alt))||portraitCover(page.html,page.url);
 if(!img)throw Error('PARADEの公式告知に表紙画像がありません');
 return resultFor(source,page,img,target.title);
}
async function kodanshaFridayGoldCover(source){
 const page=await get(source.url),imgs=imageCandidates(page.html,page.url);
 const cover=imgs.find(x=>/FRIDAY\s*GOLD/i.test(x.alt)&&/2026/i.test(x.alt))||portraitCover(page.html,page.url);
 if(!cover)throw Error('講談社のFRIDAY GOLD最新号告知に表紙画像がありません');
 return resultFor(source,page,cover,'FRIDAY GOLD 最新号');
}
function latestIssueLink(html,base,name){
 const candidates=[];
 for(const m of html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)){
  const a=parseAttrs(m[0].slice(0,m[0].indexOf('>')+1));if(!a.href)continue;
  const text=strip(m[0]);
  // Normalize full-width digits/spaces and tolerate small labels appended to an issue link.
  // Keep an exact title boundary so ヤングキング never matches ヤングキングBULL.
  const normalized=text.normalize('NFKC').replace(/\s+/g,' ').trim();
  const issueRe=name==='ヤングキング'?/^ヤングキング\s+(20\d{2})年\s*(\d+)号(?:$|\s|[【(（])/:/^ヤングキングBULL\s+(20\d{2})年\s*(\d+)号(?:$|\s|[【(（])/;
  const issue=normalized.match(issueRe);if(!issue)continue;
  const url=safeOfficial(a.href,base);if(!url||new URL(url).hostname!=='www.shonengahosha.co.jp'||!/\/book_Info\.php\?/.test(url))continue;
  candidates.push({url,text,year:Number(issue[1]),number:Number(issue[2])});
 }
 candidates.sort((a,b)=>b.year-a.year||b.number-a.number);
 return candidates[0]||null;
}
async function shonengahoshaCover(source,name){
 const index=await get(source.url);const latest=latestIssueLink(index.html,index.url,name);
 if(!latest)throw Error('雑誌一覧に一致する号の詳細ページがありません: '+name);
 const page=await get(latest.url);
 // The page has an empty decorative h1 before the issue title. Read the explicit
 // detailTitle heading first, then fall back to the first non-empty content heading.
 const titleBlock=page.html.match(/<[a-z][\w:-]*\b[^>]*\bid=["']detailTitle["'][^>]*>([\s\S]*?)<\/[a-z][\w:-]*>/i);
 const heading=strip(titleBlock?.[1]||[...page.html.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map(x=>strip(x[1])).find(Boolean)||'').normalize('NFKC').replace(/\s+/g,' ').trim();
 const expected=new RegExp('^'+name+'\\s+'+latest.year+'年\\s*'+latest.number+'号(?:\\s|$)');
 if(!expected.test(heading))throw Error('詳細ページの誌名・号数が不一致: '+heading);
 const tags=[...page.html.matchAll(/<img\b[^>]*>/gi)].map(x=>({tag:x[0],attrs:parseAttrs(x[0]),index:x.index}));
 const thumbOpen=page.html.match(/<[a-z][\w:-]*\b[^>]*\bid=["']detailThumb["'][^>]*>/i);
 const thumbIndex=thumbOpen?thumbOpen.index:-1;
 const thumbEnd=thumbIndex>=0?Math.min(page.html.length,thumbIndex+12000):-1;
 let chosen=thumbIndex>=0?tags.filter(x=>x.index>thumbIndex&&x.index<thumbEnd):[];
 chosen=chosen.find(x=>/\bfrmImg\b/i.test(x.attrs.class||''))||chosen[0];
 // The publisher has changed the wrapper and class names over time. The left imageColumn
 // remains the detail page's dedicated cover area, so use it as a bounded fallback.
 if(!chosen){
  const column=page.html.match(/<[a-z][\w:-]*\b[^>]*class=["'][^"']*\bimageColumn\b[^"']*["'][^>]*>/i);
  if(column){const end=Math.min(page.html.length,column.index+18000);const inColumn=tags.filter(x=>x.index>column.index&&x.index<end);chosen=inColumn.find(x=>/\bfrmImg\b/i.test(x.attrs.class||''))||inColumn[0]}
 }
 if(!chosen)throw Error('詳細ページの表紙画像が見つかりません');
 const attrs=chosen.attrs;
 const image=safeOfficial(attrs.src||attrs['data-src']||attrs['data-original']||attrs['data-lazy-src']||(attrs.srcset||'').split(',')[0].trim().split(/\s+/)[0],page.url);
 if(!image)throw Error('表紙画像srcが無効です');
 const releaseDate=strip(page.html).match(/\[発売日\]\s*(20\d{2}-\d{2}-\d{2})/);
 return resultFor(source,page,{url:image},heading,{date:releaseDate?.[1]||''});
}
// Read the exact current-issue image element from the publisher's Spirits page.
// Do not hardcode the issue number, model name, or image filename.
async function spiritsCover(source){
 const page=await get(source.url);
 const container=page.html.match(/<div\b[^>]*class\s*=\s*["'][^"']*\bp1s1-card-f__box02__img\b[^"']*["'][^>]*>([\s\S]*?)<\/div\s*>/i);
 if(!container)throw Error('公式ページに最新号の画像エリアがありません（p1s1-card-f__box02__img）');
 const tag=container[1].match(/<img\b[^>]*>/i);
 if(!tag)throw Error('最新号の画像エリアにimgタグがありません');
 const attrs=parseAttrs(tag[0]);
 const image=safeOfficial(attrs.src||attrs['data-src']||attrs['data-original'],page.url);
 if(!image)throw Error('最新号のimgタグに有効な画像URLがありません');
 const title=strip(page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'週刊スピリッツ 最新号');
 return {status:'found',image,title,officialUrl:source.url,url:source.url,date:'',source:'ビッグコミックBROS.NET',verifiedLatest:true};
}
// Big Comic Superior: select the exact image inside the official current-issue panel.
// Read its src dynamically; never pin the image filename or issue number.
async function superiorCover(source){
 const page=await get(source.url);
 const container=page.html.match(/<div\b[^>]*class\s*=\s*["'][^"']*\bp1s1-card-f__box02__img\b[^"']*["'][^>]*>([\s\S]*?)<\/div\s*>/i);
 if(!container)throw Error('公式ページに表紙画像エリアがありません（p1s1-card-f__box02__img）');
 const tag=container[1].match(/<img\b[^>]*>/i);
 if(!tag)throw Error('表紙画像エリアにimgタグがありません');
 const attrs=parseAttrs(tag[0]);
 const image=safeOfficial(attrs.src||attrs['data-src']||attrs['data-original'],page.url);
 if(!image)throw Error('表紙画像のsrcが取得できませんでした');
 const title=strip(page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'ビッグコミックスペリオール 最新号');
 return {status:'found',image,title,officialUrl:source.url,url:source.url,date:'',source:'ビッグコミックBROS.NET',verifiedLatest:true};
}
async function bigComicBrosCover(source,name){
 const page=await get(source.url);
 // These two publisher pages place the current issue cover in the small portrait panel at upper right.
 const img=portraitCover(page.html,page.url,{before:'新刊コミックス'});
 if(!img)throw Error('最新号欄の右上にある表紙画像が見つかりませんでした');
 return resultFor(source,page,img,name+' 最新号');
}
async function actionCover(source){
 // The Futabasha page is a client-rendered Vue application. Its HTML may be
 // unavailable to Node; never let a failed HTML request prevent API fallback.
 let htmlError='';
 try{
  const page=await get(source.url);
  const active=page.html.match(/<div\b[^>]*class=["'][^"']*swiper-slide-active[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  const region=active?.[1]||page.html;
  const exact=[...region.matchAll(/<img\b[^>]*>/gi)].map(m=>parseAttrs(m[0])).find(a=>(a.class||'').split(/\s+/).includes('content-detail__top__image'));
  const direct=exact&&safeOfficial(exact.src||exact['data-src'],page.url);
  if(direct)return resultFor(source,page,{url:direct},'漫画アクション 最新号');
 }catch(e){htmlError=e.message}
 const apiBase='https://book-api.futabasha.co.jp/';
 const failures=[];
 // Find the current published issue rather than pinning a specific barcode.
 for(const grouping of ['マンガアクションザッシ','漫画アクションザッシ','マンガアクション','漫画アクション']){
  try{
   const params=new URLSearchParams({v:'2',request_mode:'1',media:'1',age_verification:'3',publication_form:'1',grouping,per_page:'30',display_order:'0'});
   const r=await fetch(apiBase+'books?'+params,{headers:{...agent,Accept:'application/json',Origin:'https://www.futabasha.co.jp',Referer:source.url},signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw Error('HTTP '+r.status);
   const data=await r.json();
   const entries=data?.books?.book_informations||data?.books?.data||data?.book_informations||data?.books||[];
   const books=Array.isArray(entries)?entries:[];
   const now=new Date().toISOString().slice(0,10);
   const matches=books.filter(x=>/^(漫画|マンガ)アクション\s*20\d{2}年/.test(x.book_name||'')&&(!x.release_dt||x.release_dt<=now));
   matches.sort((x,y)=>(y.release_dt||'').localeCompare(x.release_dt||''));
   for(const item of matches){
    let book=item;
    if(!book.book_images?.length&&book.jdcn_code){
     const q=new URLSearchParams({media:'1',jdcn_code:String(book.jdcn_code),image_size:'330 55 1000'});
     const detail=await fetch(apiBase+'book_details?'+q,{headers:{...agent,Accept:'application/json',Origin:'https://www.futabasha.co.jp',Referer:source.url},signal:AbortSignal.timeout(15000)});
     if(detail.ok)book=(await detail.json())?.book_details?.book_informations||book;
    }
    const cover=book.book_images?.find(x=>Number(x.display_order)===1)||book.book_images?.[0];
    const image=safeOfficial(cover?.filename1000||cover?.filename330,source.url);
    if(image)return {status:'found',image,title:book.book_name||item.book_name,officialUrl:source.url,url:source.url,date:book.release_dt||item.release_dt||'',source:source.label,verifiedLatest:true};
   }
   failures.push(grouping+': 対象の発売済み号が見つかりません（候補'+books.length+'件）');
  }catch(e){failures.push(grouping+': '+e.message)}
 }
 // Last-resort known official API detail. This is a dated fallback, NOT auto-latest.
 try{
  const code='49122440311690000000';
  const q=new URLSearchParams({media:'1',jdcn_code:code,image_size:'330 55 1000'});
  const r=await fetch(apiBase+'book_details?'+q,{headers:{...agent,Accept:'application/json',Origin:'https://www.futabasha.co.jp',Referer:source.url},signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('HTTP '+r.status);
  const book=(await r.json())?.book_details?.book_informations;
  if(!/^(漫画|マンガ)アクション/.test(book?.book_name||''))throw Error('誌名不一致');
  const cover=book.book_images?.find(x=>Number(x.display_order)===1);
  const image=safeOfficial(cover?.filename1000||cover?.filename330,source.url);
  if(!image)throw Error('表紙画像なし');
  return {status:'found',image,title:book.book_name,officialUrl:source.url,url:source.url,date:book.release_dt||'',source:'双葉社公式API（2026年11月17日号・最新号未確認）',verifiedLatest:false};
 }catch(e){failures.push('詳細API: '+e.message)}
 throw Error('漫画アクション取得失敗。HTML: '+(htmlError||'対象画像なし')+' / API: '+failures.join(' | '));
}
async function futabashaCover(source,name){
 // Futabasha's magazine detail page is an empty Vue shell in server-side HTML.
 // Its official book API returns the current issue and image URL directly.
 if(!source.grouping)throw Error('双葉社API用の誌名グループがsources.jsonにありません');
 const params=new URLSearchParams({v:'2',request_mode:'1',media:String(source.media||1),age_verification:'3',request_from:'',request_to:new Date().toISOString().slice(0,10).replace(/-/g,''),grouping:source.grouping,publication_form:'1',per_page:'1',display_order:'0'});
 const api=await fetch('https://book-api.futabasha.co.jp/books?'+params.toString(),{headers:{...agent,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
 if(!api.ok)throw Error(`双葉社API HTTP ${api.status}`);
 const data=await api.json(),book=data?.books?.book_informations?.[0];
 if(!book)throw Error('双葉社APIから最新号を取得できませんでした');
 const image=safeOfficial(book.book_images?.[0]?.filename330||book.book_images?.[0]?.filename175,'https://www.futabasha.co.jp/');
 if(!image)throw Error('双葉社APIの最新号に表紙画像URLがありません');
 return {status:'found',image,title:book.book_name||name+' 最新号',officialUrl:source.url,url:source.url,date:book.release_dt||'',source:source.label||'双葉社公式',verifiedLatest:true};
}
async function dragonAgeCover(source){
 const page=await get(source.url);const links=[];
 for(const m of page.html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)){
  if(!/クリックで拡大/.test(strip(m[0])))continue;
  const a=parseAttrs(m[0].slice(0,m[0].indexOf('>')+1));const url=safeOfficial(a.href,page.url);
  if(url)links.push(url);
 }
 const img=links.length?{url:links[0],alt:'Young Dragon Age cover page 1'}:portraitCover(page.html,page.url,{after:'最新号 VOL.'});
 if(!img)throw Error('最新号の1ページ目の表紙画像が見つかりませんでした');
 return resultFor(source,page,img,'ヤングドラゴンエイジ 最新号');
}
async function kadokawaCover(source,name){
 const index=await get(source.url),candidates=[];
 for(const m of index.html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)){
  const tag=m[0],head=tag.slice(0,tag.indexOf('>')+1),a=parseAttrs(head),url=a.href&&safeOfficial(a.href,index.url);
  if(!url||new URL(url).hostname!=='store.kadokawa.co.jp')continue;
  const img=[...tag.matchAll(/<img\b[^>]*>/gi)].map(x=>parseAttrs(x[0])).find(x=>new RegExp('^'+name+'\\s+vol\\.?\\s*\\d+','i').test(x.alt||''));
  if(!img)continue;const vol=(img.alt.match(/vol\.?\s*(\d+)/i)||[])[1],image=safeOfficial(img['data-src']||img['data-original']||img.src,index.url);
  if(image)candidates.push({url,image,vol:Number(vol),title:img.alt});
 }
 candidates.sort((a,b)=>b.vol-a.vol);
 if(!candidates.length)throw Error('KADOKAWA公式ストアで誌名とvol.が一致する最新号を見つけられませんでした');
 // Upcoming catalog entries can appear before KADOKAWA publishes their cover JPG.
 // Check the actual image response and fall back to the newest available issue.
 for(const target of candidates.slice(0,5)){
  try{
   const r=await fetch(target.image,{headers:{...agent,Accept:'image/*',Referer:index.url},signal:AbortSignal.timeout(10000),redirect:'follow'});
   const type=r.headers.get('content-type')||'';
   if(r.ok&&/^image\//i.test(type))return {status:'found',image:target.image,title:target.title,officialUrl:target.url,url:target.url,date:'',source:source.label,verifiedLatest:true};
  }catch{}
 }
 throw Error('KADOKAWA公式ストアの最新号表紙画像を取得できませんでした');
}
async function brodyCover(source){
 const page=await get(source.url);
 // Match the official latest-issue image's alt text; never use the blurred publisher header collage.
 const img=imageCandidates(page.html,page.url).find(x=>/^BRODY\s*\(ブロディ\).*20\d{2}年.*号/i.test(x.alt))||portraitCover(page.html,page.url);
 if(!img)throw Error('最新号欄の表紙画像が見つかりませんでした');
 return resultFor(source,page,img,'BRODY 最新号');
}
async function nikkanSpaCover(source,name){
 const needle=source.titleMatch||'',index=await get(source.url);let target=null;
 const findTarget=page=>{
  const candidates=[];
  for(const m of page.html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)){
   const head=m[0].slice(0,m[0].indexOf('>')+1),a=parseAttrs(head),text=strip(m[0]);
   if(!a.href||!text.includes(needle))continue;
   const url=safeOfficial(a.href,page.url),vol=text.match(/vol\.?\s*(\d+)/i);
   if(url&&new URL(url).hostname==='nikkan-spa.jp')candidates.push({url,text,vol:Number(vol?.[1]||0)});
  }
  candidates.sort((a,b)=>b.vol-a.vol);
  return candidates[0]||null;
 };
 target=findTarget(index);
 // The topic archive can omit the current announcement. Search the same official domain by title as a fallback.
 if(!target){const searchUrl=new URL('/',source.url);searchUrl.searchParams.set('s',needle);target=findTarget(await get(searchUrl.href))}
 if(!target)throw Error('日刊SPA!公式ページから最新号・特集の記事を見つけられませんでした');
 const page=await get(target.url),images=imageCandidates(page.html,page.url);
 const img=images.find(x=>/表紙画像/.test(x.alt))||portraitCover(page.html,page.url);
 if(!img)throw Error('日刊SPA!公式ページで表紙画像を見つけられませんでした');
 return resultFor(source,page,img,target.text||name);
}
async function myFaveVisualCover(source){
 const index=await get(source.url),links=[];
 for(const m of index.html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)){
  const head=m[0].slice(0,m[0].indexOf('>')+1),a=parseAttrs(head),text=strip(m[0]);
  if(!a.href||!/my\s*fave\s*visual/i.test(text))continue;
  const url=safeOfficial(a.href,index.url),vol=text.match(/vol\.?\s*(\d+)/i);
  if(url&&new URL(url).hostname==='myfaveweb.jp')links.push({url,text,vol:Number(vol?.[1]||0)});
 }
 links.sort((a,b)=>b.vol-a.vol);const target=links[0];
 const page=target?await get(target.url):index;
 const img=portraitCover(page.html,page.url);
 if(!img)throw Error('my fave公式ページで最新ビジュアル誌の表紙画像を見つけられませんでした');
 return resultFor(source,page,img,target?.text||'my fave visual 最新号');
}
async function publisherPressCover(source,name){
 const page=await get(source.url),images=imageCandidates(page.html,page.url);
 const img=images.find(x=>/表紙/.test(x.alt))||portraitCover(page.html,page.url);
 if(!img)throw Error('出版社の最新号告知で表紙画像を見つけられませんでした');
 return resultFor(source,page,img,name+' 最新号');
}
async function lookup(name){
 const custom=manual()[name];if(custom?.image){const image=safeOfficial(custom.image,custom.officialUrl||custom.url||'https://invalid.local');if(image)return {...custom,image,status:'found',source:custom.source||'手動登録',verifiedLatest:!!custom.verifiedLatest}}
 const source=sources()[name];if(!source?.url)return {status:'missing',error:'この雑誌の公式取得先をまだ登録していません。公式ページのURLをsources.jsonに追加してください。'};
 if(source.disabled)return {status:'missing',officialUrl:source.url,error:source.disabled};
 try{
  if(source.adapter==='websunday')return await sundayCover(source);
  if(source.adapter==='wpb')return await wpbCover(source);
  if(source.adapter==='utb')return await utbCover(source);
  if(source.adapter==='younganimal')return await youngAnimalCover(source);
  if(source.adapter==='hakusensha-ya')return await hakusenshaYoungAnimalCover(source);
  if(source.adapter==='blt')return await bltCover(source,name);
  if(source.adapter==='blt-monster')return await bltMonsterCover(source);
  if(source.adapter==='dmagazine')return await dmagazineCover(source);
  if(source.adapter==='fujisan-series')return await fujisanSeriesCover(source);
  if(source.adapter==='tokuma')return await tokumaCover(source,name);
  if(source.adapter==='flash-special')return await flashSpecialCover(source);
  if(source.adapter==='shonengahosha')return await shonengahoshaCover(source,name);
  if(source.adapter==='spirits')return await spiritsCover(source);
  if(source.adapter==='superior')return await superiorCover(source);
  if(source.adapter==='bigcomicbros')return await bigComicBrosCover(source,name);
  if(source.adapter==='futabasha-action')return await actionCover(source);
  if(source.adapter==='futabasha')return await futabashaCover(source,name);
  if(source.adapter==='dragonage')return await dragonAgeCover(source);
  if(source.adapter==='kadokawa')return await kadokawaCover(source,name);
  if(source.adapter==='brody')return await brodyCover(source);
  if(source.adapter==='spa')return await nikkanSpaCover(source,name);
  if(source.adapter==='myfave')return await myFaveVisualCover(source);
  if(source.adapter==='byakuya')return await byakuyaCover(source,name);
  if(source.adapter==='publisher-series')return await publisherSeriesCover(source,name);
  if(source.adapter==='kodansha-friday-gold')return await kodanshaFridayGoldCover(source);
  if(source.adapter==='publisher-press')return await publisherPressCover(source,name);
  const page=await get(source.url);return extract(page.html,{...source,url:page.url},name)
 }catch(e){return {status:'missing',officialUrl:source.url,source:source.label||'',error:`公式ページから取得できませんでした（${e.message}）。公式サイト側の制限・構成変更の可能性があります。`}}
}
async function downloadCover(value){
 // Fetch the official cover image server-side and return it as data for the browser.
 const r=await fetch(value.image,{headers:{...agent,Accept:'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',Referer:value.officialUrl||value.url||value.image},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error(`画像 HTTP ${r.status} (${r.url})`);
 const type=(r.headers.get('content-type')||'').split(';')[0];
 if(!/^image\/(jpeg|png|webp|gif|avif)$/.test(type))throw Error(`画像ではない応答: ${type} (HTTP ${r.status}, ${r.url})`);
 const chunks=[];let size=0;
 for await(const chunk of r.body){size+=chunk.length;if(size>12*1024*1024)throw Error('画像が12MBを超えています');chunks.push(chunk)}
 if(!size)throw Error('画像が空です');
 return {...value,originalImage:value.image,image:'data:'+type+';base64,'+Buffer.concat(chunks).toString('base64'),checkedAt:new Date().toISOString()};
}

async function cover(name,refresh){
 if(refresh)cache.delete(name);
 const hit=cache.get(name);if(hit&&Date.now()-hit.time<TTL)return hit.value;
 if(pending.has(name))return pending.get(name);
 const job=(async()=>{
  let value=await lookup(name);
  if(value.image){try{value=await downloadCover(value)}catch(e){value={status:'missing',officialUrl:value.officialUrl,error:e.message}}}
  cache.set(name,{value,time:Date.now()});return value;
 })().finally(()=>pending.delete(name));pending.set(name,job);return job;
}

module.exports=async function handler(req,res){
 try{
  if(req.method!=='GET'){res.setHeader('Allow','GET');res.status(405).send('Method Not Allowed');return}
  const u=new URL(req.url,'https://vercel.app');
  if(u.pathname!=='/api/cover'){res.status(404).send('Not Found');return}
  const name=(u.searchParams.get('name')||'').trim();
  if(!name||name.length>80){res.status(400).send('invalid name');return}
  const result=await cover(name,u.searchParams.get('refresh')==='1');
  res.setHeader('Cache-Control','no-store');res.status(200).json(result);
 }catch(e){res.status(500).json({error:e.message})}
};
