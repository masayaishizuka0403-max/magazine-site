export default async function handler(req, res) {

  // ==========================================
  // キャッシュ設定
  // ==========================================
  // 1時間は同じ結果を利用。
  // 1時間経過後、次のアクセスで最新情報を取得する。
  res.setHeader(
    "Cache-Control",
    "s-maxage=3600, stale-while-revalidate=86400"
  );

  try {

    const magazines = [

      // ==========================================
      // 秋田書店
      // ==========================================

      {
        name: "ヤングチャンピオン烈",
        url: "https://www.akitashoten.co.jp/yc-retsu",
        type: "akita"
      },

      {
        name: "月刊少年チャンピオン",
        url: "https://www.akitashoten.co.jp/m-champion",
        type: "akita"
      },

      {
        name: "ヤングチャンピオン",
        url: "https://www.akitashoten.co.jp/youngchampion",
        type: "akita"
      },

      {
        name: "別冊ヤングチャンピオン",
        url: "https://www.akitashoten.co.jp/bessatsu-yc",
        type: "akita"
      },


      // ==========================================
      // ヤングガンガン
      // ==========================================

      {
        name: "ヤングガンガン",
        url: "https://magazine.jp.square-enix.com/yg/new/",
        type: "young_gangan"
      },


      // ==========================================
      // 週刊プレイボーイ
      // ==========================================

      {
        name: "週刊プレイボーイ",
        url: "https://www.grajapa.shueisha.co.jp/weeklyplayboy",
        type: "og_image"
      },


      // ==========================================
      // ヤングアニマル
      // ==========================================

      {
        name: "ヤングアニマル",
        url: "https://magazine.younganimal.com/",
        type: "young_animal"
      },


      // ==========================================
      // FRIDAY
      // ==========================================

      {
        name: "FRIDAY",
        url: "https://friday.gold/magazine/latest",
        type: "og_image"
      },


      // ==========================================
      // 月刊ヤングマガジン
      // ==========================================

      {
        name: "月刊ヤングマガジン",
        url: "https://magazine.yanmaga.jp/mym/",
        type: "og_image"
      }

    ];


    // ==========================================
    // User-Agent
    // ==========================================

    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
    };


    // ==========================================
    // 1誌を取得する関数
    // ==========================================

    async function getMagazine(magazine) {

      try {

        // --------------------------------------
        // タイムアウト
        // --------------------------------------

        const controller = new AbortController();

        const timeout = setTimeout(() => {
          controller.abort();
        }, 8000);


        const response = await fetch(magazine.url, {
          headers,
          signal: controller.signal
        });


        clearTimeout(timeout);


        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }


        const html = await response.text();


        let image = null;


        // ==========================================
        // 秋田書店
        // ==========================================

        if (magazine.type === "akita") {

          const matches = [
            ...html.matchAll(
              /https:\/\/www\.akitashoten\.co\.jp\/magazine\/\d+\/image/g
            )
          ].map(match => match[0]);


          const images = [
            ...new Set(matches)
          ];


          image = images[0] || null;
        }


        // ==========================================
        // ヤングガンガン
        // ==========================================

        else if (magazine.type === "young_gangan") {

          /*
           * 公式ページから最新号のNo.を取得
           */

          const issueMatch =
            html.match(
              /ヤングガンガン\s*(?:20\d{2})?\s*No\.(\d+)/i
            );


          if (issueMatch) {

            const issueNumber =
              issueMatch[1];


            /*
             * 年を取得
             */

            const yearMatch =
              html.match(
                /ヤングガンガン\s*(20\d{2})\s*No\.\d+/i
              );


            const year =
              yearMatch
                ? yearMatch[1]
                : new Date().getFullYear();


            image =
              `https://magazine.jp.square-enix.com/yg/new/images/${year}/${issueNumber}.jpg`;
          }
        }


        // ==========================================
        // ヤングアニマル
        // ==========================================

        else if (magazine.type === "young_animal") {

          image =
            "https://magazine.younganimal.com/manage/displays/img_view/younganimal_now_150";
        }


        // ==========================================
        // OG IMAGE
        // ==========================================

        else if (magazine.type === "og_image") {

          /*
           * property → content
           */

          const ogMatch =
            html.match(
              /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
            );


          if (ogMatch) {

            image =
              ogMatch[1];

          } else {

            /*
             * content → property
             */

            const ogMatch2 =
              html.match(
                /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
              );


            if (ogMatch2) {

              image =
                ogMatch2[1];
            }
          }
        }


        return {

          name: magazine.name,

          url: magazine.url,

          image,

          success: !!image

        };


      } catch (error) {

        return {

          name: magazine.name,

          url: magazine.url,

          image: null,

          success: false,

          error:
            error.name === "AbortError"
              ? "取得がタイムアウトしました"
              : error.message

        };

      }

    }


    // ==========================================
    // ★ ここが高速化のポイント
    // ==========================================
    // 9誌を「順番」ではなく「同時」に取得する

    const results =
      await Promise.all(
        magazines.map(
          magazine =>
            getMagazine(magazine)
        )
      );


    // ==========================================
    // JSONを返す
    // ==========================================

    res.status(200).json({

      success: true,

      magazines: results,

      updatedAt:
        new Date().toISOString()

    });


  } catch (error) {

    res.status(500).json({

      success: false,

      error: error.message

    });

  }

}
