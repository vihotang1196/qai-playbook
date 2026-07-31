import { chromium } from 'playwright-core';
import path from 'node:path';
const FILE = 'file://' + path.resolve('band-perf.html');
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-gpu-rasterization'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await page.context().newCDPSession(page);
await page.goto(FILE);

const run = async ({ n, impl, throttle }) => {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.evaluate(a => window.build(a), { n, impl });
  await page.evaluate(() => new Promise(r => setTimeout(r, 300)));   // 让动画稳定
  const m = await page.evaluate(ms => window.sampleFrames(ms), 2000);
  return m;
};

console.log('=== 并发光带的帧时间（headless Chromium，1440x900）===');
console.log('CPU  实现   框数   fps   avg    p50    p95   worst  掉帧(>20ms)');
for (const throttle of [1, 4, 8]) {
  for (const impl of ['none', 'A', 'B']) {
    for (const n of [1, 6, 12, 24]) {
      if (impl === 'none' && n !== 12) continue;      // 基线只跑一次
      const m = await run({ n, impl, throttle });
      const f = (v, w) => String(v).padStart(w);
      console.log(`${f(throttle+'x',3)}  ${impl.padEnd(5)} ${f(n,4)}  ${f(m.fps,5)} ${f(m.avgMs,6)} ${f(m.p50,6)} ${f(m.p95,6)} ${f(m.worst,6)}  ${f(m.janky,4)}/${m.frames}`);
    }
  }
  console.log('');
}
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

console.log('=== mask 自适应：四种尺寸/圆角 ===');
await page.evaluate(() => window.build({ n: 4, impl: 'A' }));
for (const r of await page.evaluate(() => window.checkMask())) {
  console.log(`宿主 ${r.hostW}x${r.hostH} r=${r.hostRadius.padEnd(5)} | 光带 ${r.bandW}x${r.bandH} r=${r.bandRadius.padEnd(5)}` +
    ` | 尺寸吻合=${r.sizeMatch} 圆角吻合=${r.radiusMatch} | 厚度 局部=${r.padLocal} 视觉=${r.padVisual}`);
}

console.log('\n=== zoom 对光带厚度的影响（padding 固定 3px）===');
for (const z of [1, 0.75]) {
  await page.evaluate(z => document.documentElement.style.setProperty('--z', z), z);
  await page.evaluate(() => window.build({ n: 1, impl: 'A' }));
  const r = (await page.evaluate(() => window.checkMask()))[0];
  console.log(`zoom=${z}  厚度 局部=${r.padLocal}  渲染=${r.padVisual}px  宿主渲染尺寸=${r.bandW}x${r.bandH}`);
}
await browser.close();
