const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  // Puppeteerを起動
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-first-run',
      '--no-sandbox',
      '--no-zygote',
      '--single-process'
    ],
    executablePath: '/usr/bin/chromium-browser' // ここにChromiumのパスを指定
  });

  const page = await browser.newPage();

  // ローカルのindex.htmlファイルを読み込む
  const url = `http://localhost:9001/index.html`;
  await page.goto(url);

  // スクリーンキャプチャを取得して保存
  setInterval(async () => {
    await page.screenshot({ path: 'screenshot.png' });
  }, 1000)

  // Puppeteerを終了
  //await browser.close();
})();
