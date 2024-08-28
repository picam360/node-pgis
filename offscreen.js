const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  // Puppeteerを起動
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // ローカルのindex.htmlファイルを読み込む
  const filePath = path.resolve(__dirname, 'www/index.html');
  const fileUrl = `file://${filePath}`;
  await page.goto(fileUrl);

  // スクリーンキャプチャを取得して保存
  await page.screenshot({ path: 'screenshot.png' });

  // Puppeteerを終了
  await browser.close();
})();
