export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

  const magazines = [
    { name: "ヤングチャンピオン烈", url: "https://www.akitashoten.co.jp/yc-retsu", type: "akita" },
    { name: "月刊少年チャンピオン", url: "https://www.akitashoten.co.jp/m-champion", type: "akita" },
    { name: "ヤングチャンピオン", url: "https://www.akitashoten.co.jp/youngchampion", type: "akita" },
    { name: "別冊ヤングチャンピオン", url: "https://www.akitashoten.co.jp/bessatsu-yc", type: "akita" },
    { name: "ヤングガンガン", url: "https://magazine.jp.square-enix.com/yg/new/", type: "young_gangan" },
    { name: "週刊プレイボーイ", url: "https://www.grajapa.shueisha.co.jp/weeklyplayboy", type: "og_image" },
    { name: "ヤングアニマル", url: "https://magazine.younganimal.com/", type: "young_animal" },
    { name: "FRIDAY", url: "https://friday.gold/magazine/latest", type: "friday" },
    { name: "月刊ヤングマガジン", url: "https://magazine.yanmaga.jp/mym/", type: "monthly_yanmaga" }
  ];

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.8,en;q=0.6"
  };

  function decode(value = "") {
    return value.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
      .replace(/&#39;|&#x27;/gi, "'").replace(/&#x2f;/gi, "/")
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
  }

  function attr(tag, name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = tag.match(new RegExp("(?:^|\\s)" + escaped + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i"));
    return match ? decode(match[1] ?? match[2] ?? match[3]) : "";
  }

  function absolute(value, base) {
    if (!value || /^(data:|blob:|javascript:)/i.test(value)) return null;
    try {
      const url = new URL(value.trim(), base);
      return /^https?:$/.test(url.protocol) ? url.href : null;
    } catch { return null; }
  }

  function imageTags(html, base) {
    return [...html.matchAll(/<img\b[^>]*>/gi)].map(match => {
      const tag = match[0];
      const srcset = attr(tag, "data-srcset") || attr(tag, "srcset");
      const srcsetLast = srcset ? srcset.split(/,\s+(?=https?:\/\/|\/)/).pop()?.trim().split(/\s+/)[0] : "";
      const src = attr(tag, "data-src") || attr(tag, "data-original") || attr(tag, "data-lazy-src") || attr(tag, "src") || srcsetLast;
      return { src: absolute(src, base), context: (tag + " " + html.slice(Math.max(0, match.index - 250), match.index)).toLowerCase(), index: match.index };
    }).filter(item => item.src);
  }

  function ogImage(html, base) {
    for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
      const key = (attr(tag, "property") || attr(tag, "name")).toLowerCase();
      if (key === "og:image" || key === "twitter:image") {
        const url = absolute(attr(tag, "content"), base);
        if (url) return url;
      }
    }
    return null;
  }

  function fridayImage(html, base) {
    const images = imageTags(html, base);
    const scored = images.map(item => {
      let score = 0;
      if (/assets\.friday\.gold/.test(item.src)) score += 30;
      if (/friday[_-]|\/friday-wp-production-assets\//i.test(item.src)) score += 35;
      if (/magazine|cover|表紙|最新号/.test(item.context)) score += 20;
      if (/logo|icon|banner|avatar|thumbnail/i.test(item.src)) score -= 50;
      return { ...item, score };
    }).sort((a, b) => b.score - a.score || a.index - b.index);
    return scored[0]?.score >= 45 ? scored[0].src : ogImage(html, base);
  }

  function monthlyYanmagaImage(html, base) {
    // 月刊ヤングマガジンの表紙は content/images/_monthly_cover/m_YYYY-MM_*.jpg
    // という専用ディレクトリにある。汎用的な画像スコアより優先する。
    const covers = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => {
      const tag = match[0];
      const src = attr(tag, "data-src") || attr(tag, "data-original") ||
        attr(tag, "data-lazy-src") || attr(tag, "src");
      const url = absolute(src, base);
      if (!url || !/\/_monthly_cover\/m_20\d{2}-\d{2}_[^/?#]+\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(url)) return null;
      const alt = attr(tag, "alt");
      const nearby = html.slice(Math.max(0, match.index - 350), match.index + tag.length + 200);
      const issue = url.match(/\/m_(20\d{2})-(\d{2})_/i);
      return {
        url,
        yearMonth: issue ? Number(issue[1]) * 100 + Number(issue[2]) : 0,
        isLatest: /最新号|最新刊|発売中/.test(nearby),
        isBackNumber: /バックナンバー|back[ _-]?number/i.test(nearby),
        isMagazine: /月刊ヤングマガジン/.test(alt),
        index: match.index
      };
    }).filter(Boolean);

    // 最新号と明記された表紙を優先し、なければ年月が新しい表紙を選ぶ。
    // サイトのバックナンバーが同じページに載っていても対応する。
    covers.sort((a, b) =>
      Number(b.isLatest && !b.isBackNumber) - Number(a.isLatest && !a.isBackNumber) ||
      b.yearMonth - a.yearMonth ||
      Number(b.isMagazine) - Number(a.isMagazine) || a.index - b.index
    );
    return covers[0]?.url || null;
  }

  async function getMagazine(magazine) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(magazine.url, { headers, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      let image = null;

      if (magazine.type === "akita") {
        image = [...new Set(html.match(/https:\/\/www\.akitashoten\.co\.jp\/magazine\/\d+\/image/g) || [])][0] || null;
      } else if (magazine.type === "young_gangan") {
        const issue = html.match(/ヤングガンガン\s*(?:20\d{2})?\s*No\.(\d+)/i);
        const year = html.match(/ヤングガンガン\s*(20\d{2})\s*No\.\d+/i)?.[1] || new Date().getFullYear();
        if (issue) image = `https://magazine.jp.square-enix.com/yg/new/images/${year}/${issue[1]}.jpg`;
      } else if (magazine.type === "young_animal") {
        image = "https://magazine.younganimal.com/manage/displays/img_view/younganimal_now_150";
      } else if (magazine.type === "friday") {
        image = fridayImage(html, magazine.url);
      } else if (magazine.type === "monthly_yanmaga") {
        image = monthlyYanmagaImage(html, magazine.url);
      } else {
        image = ogImage(html, magazine.url);
      }

      return { name: magazine.name, url: magazine.url, image, success: !!image };
    } catch (error) {
      return { name: magazine.name, url: magazine.url, image: null, success: false,
        error: error.name === "AbortError" ? "取得がタイムアウトしました" : error.message };
    } finally {
      clearTimeout(timeout);
    }
  }

  try {
    const results = await Promise.all(magazines.map(getMagazine));
    res.status(200).json({ success: true, magazines: results, updatedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
