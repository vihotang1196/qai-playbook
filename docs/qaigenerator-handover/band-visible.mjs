import { chromium } from 'playwright-core';
import path from 'node:path';
const FILE = 'file://' + path.resolve('band-perf.html');
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await page.context().newCDPSession(page);
await page.goto(FILE);

// 把所有框强制成小尺寸，保证 N 条光带【全部在视口内】—— 排除"离屏不绘制"的混淆
await page.addStyleTag({ content: '.frame{width:150px!important;height:90px!important}' });

console.log('全部光带都在视口内时，可见条数对帧时间的影响（实现 A）');
console.log('CPU   可见条数   视口内?  fps    p95   掉帧');
for (const throttle of [1, 4, 8]) {
  for (const n of [6, 12, 24, 48]) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await page.evaluate(a => window.build(a), { n, impl: 'A' });
    const vis = await page.evaluate(() => [...document.querySelectorAll('.frame')]
      .filter(f => { const r = f.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }).length);
    await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
    const m = await page.evaluate(ms => window.sampleFrames(ms), 2000);
    const f = (v, w) => String(v).padStart(w);
    console.log(`${f(throttle+'x',3)}   ${f(n,6)}   ${f(vis,6)}   ${f(m.fps,5)} ${f(m.p95,6)}  ${f(m.janky,3)}/${m.frames}`);
  }
  console.log('');
}
await browser.close();
