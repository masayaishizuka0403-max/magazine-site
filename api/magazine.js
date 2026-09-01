export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://www.akitashoten.co.jp/yc-retsu"
    );

    const html = await response.text();

    // /magazine/数字/image の画像URLを探す
    const matches = [
      ...html.matchAll(
        /https:\/\/www\.akitashoten\.co\.jp\/magazine\/\d+\/image/g
      )
    ].map(match => match[0]);

    // 重複削除
    const images = [...new Set(matches)];

    res.status(200).json({
      success: true,
      images: images
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
