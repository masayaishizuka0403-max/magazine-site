export default async function handler(req, res) {

  try {

    const magazines = [

      // =========================
      // 秋田書店
      // =========================

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


      // =========================
      // ヤングガンガン
      // =========================

      {
        name: "ヤングガンガン",
        url: "https://magazine.jp.square-enix.com/yg/new/",
        type: "young_gangan"
      },


      // =========================
      // 週刊プレイボーイ
      // =========================

      {
        name: "週刊プレイボーイ",
        url: "https://www.grajapa.shueisha.co.jp/weeklyplayboy",
        type: "og_image"
      },


      // =========================
      // ヤングアニマル
      // =========================

      {
        name: "ヤングアニマル",
        url: "https://magazine.younganimal.com/",
        type: "young_animal"
      },


      // =========================
      // FRIDAY
      // =========================

      {
        name: "FRIDAY",
        url: "https://friday.gold/magazine/latest",
        type: "og_image"
      },


      // =========================
      // 月刊ヤングマガジン
      // =========================

      {
        name: "月刊ヤングマガジン",
        url: "https://magazine.yanmaga.jp/mym/",
        type: "og_image"
      }

    ];


    const results = [];


    for (const magazine of magazines) {

      try {

        const response = await fetch(magazine.url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
          }
        });

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

          const images = [...new Set(matches)];

          image = images[0] || null;
        }


        // ==========================================
        // ヤングガンガン
        // ==========================================

        else if (magazine.type === "young_gangan") {

          /*
           * 公式ページには
           *
           * ヤングガンガン 2026 No.17
           *
           * のように最新号が掲載されている。
           */

          const issueMatch =
            html.match(/ヤングガンガン\s*2026\s*No\.(\d+)/);

          if (issueMatch) {

            const issueNumber = issueMatch[1];

            image =
              `https://magazine.jp.square-enix.com/yg/new/images/2026/${issueNumber}.jpg`;
          }
        }


        // ==========================================
        // ヤングアニマル
        // ==========================================

        else if (magazine.type === "young_animal") {

          /*
           * この画像URLは現在号を指す固定エンドポイント。
           * 白泉社側で中身が更新されるタイプ。
           */

          image =
            "https://magazine.younganimal.com/manage/displays/img_view/younganimal_now_150";
        }


        // ==========================================
        // OG IMAGE方式
        // ==========================================

        else if (magazine.type === "og_image") {

          const ogMatch =
            html.match(
              /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
            );

          if (ogMatch) {

            image = ogMatch[1];

          } else {

            // property/contentの順番が逆の場合

            const ogMatch2 =
              html.match(
                /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
              );

            if (ogMatch2) {
              image = ogMatch2[1];
            }
          }
        }


        results.push({

          name: magazine.name,

          url: magazine.url,

          image: image,

          success: !!image

        });


      } catch (error) {

        results.push({

          name: magazine.name,

          url: magazine.url,

          image: null,

          success: false,

          error: error.message

        });

      }

    }


    res.status(200).json({

      success: true,

      magazines: results

    });


  } catch (error) {

    res.status(500).json({

      success: false,

      error: error.message

    });

  }

}
