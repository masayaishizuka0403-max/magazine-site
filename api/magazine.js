export default async function handler(req, res) {
  try {
    const magazines = [
      {
        name: "ヤングチャンピオン烈",
        url: "https://www.akitashoten.co.jp/yc-retsu"
      },
      {
        name: "月刊少年チャンピオン",
        url: "https://www.akitashoten.co.jp/m-champion"
      }
    ];

    const results = [];

    for (const magazine of magazines) {

      const response = await fetch(magazine.url);
      const html = await response.text();

      const matches = [
        ...html.matchAll(
          /https:\/\/www\.akitashoten\.co\.jp\/magazine\/\d+\/image/g
        )
      ].map(match => match[0]);

      const images = [...new Set(matches)];

      results.push({
        name: magazine.name,
        url: magazine.url,
        image: images[0] || null
      });
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
