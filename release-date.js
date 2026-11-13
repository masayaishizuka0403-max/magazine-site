(function(root){
  const DAY=86400000;
  function normalize(value){
    const m=String(value||'').normalize('NFKC').match(/^(20\d{2})[年./-]\s*(\d{1,2})[月./-]\s*(\d{1,2})(?:日)?(?:$|[T\s(（])/);
    if(!m)return '';
    const [y,month,d]=m.slice(1).map(Number),date=new Date(Date.UTC(y,month-1,d));
    return date.getUTCFullYear()===y&&date.getUTCMonth()===month-1&&date.getUTCDate()===d?date.toISOString().slice(0,10):'';
  }
  function extract(text){
    const date='20\\d{2}[年./-]\\s*\\d{1,2}[月./-]\\s*\\d{1,2}日?(?:\\s*[（(][^）)]{1,8}[）)])?';
    const values=[...String(text).normalize('NFKC').matchAll(new RegExp('(?:発売日\\s*[:：]?\\s*('+date+')|('+date+')\\s*発売)','g'))]
      .map(m=>normalize(m[1]||m[2])).filter(Boolean);
    // An archive with several release dates cannot identify this cover's release.
    return new Set(values).size===1?values[0]:'';
  }
  function isNew(value,now=new Date(),days=7){
    const date=normalize(value);if(!date)return false;
    const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    const age=(Date.parse(today)-Date.parse(date))/DAY;
    return age>=0&&age<days;
  }
  const api={normalize,extract,isNew};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ReleaseDate=api;
})(globalThis);
