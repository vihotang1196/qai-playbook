import { chromium } from 'playwright-core';
import path from 'node:path';

const FILE = 'file://' + path.resolve('gate-scroll-repro.html');
const NAV_H = 56;

const CASES = [
  // 只有有界建议区 → max-h-[40vh] 把面板高度锁死，恒矮于可视带
  { name: 'bounded-only',  suggestLines: 40, extraUnboundedH: 0,   aboveH: 900, belowH: 1200 },
  // 面板里另有不受 max-h 约束的内容 → 面板可以真的高过可视带
  { name: 'has-unbounded', suggestLines: 40, extraUnboundedH: 700, aboveH: 900, belowH: 1200 },
];
const VARIANTS = ['A', 'B'];
const VIEWPORTS = [
  { w: 1280, h: 800, label: '桌面 1280x800' },
  { w: 1024, h: 600, label: '横屏 1024x600' },
  { w: 390,  h: 844, label: '手机 390x844' },
];
// 三种落点策略都量：现状 center / 现状 nearest / 候选修正
const IMPLS = [
  ['currentImpl', 1, 'center '],
  ['currentImpl', 2, 'nearest'],
  ['proposedImpl', 0, '修正   '],
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  await page.goto(FILE);
  for (const variant of VARIANTS) {
    console.log(`\n--- ${vp.label} | 变体 ${variant} ---`);
    for (const c of CASES) {
      for (const [impl, level, tag] of IMPLS) {
        await page.evaluate(([variant, navH, c]) => {
          window.setup({ variant, navH, ...c });
          document.getElementById('col').scrollTop = 0;
        }, [variant, NAV_H, c]);
        await page.evaluate(([impl, level]) => window[impl](level), [impl, level]);
        const m = await page.evaluate(() => window.measure());
        const p = (n, w) => String(n).padStart(w);
        console.log(
          `${c.name.padEnd(14)} ${tag}` +
          ` band=${p(m.bandH,4)} panelH=${p(m.panelH,4)}` +
          ` ${m.tallerThanBand ? '高于带' : '矮于带'}` +
          ` panelTop=${p(m.panelTop,5)}` +
          ` Δ中心=${p(m.deltaFromBandCenter,5)}` +
          ` 顶部被盖=${p(m.hiddenUnderNav,3)}px` +
          ` 底部溢出=${p(Math.max(0, m.panelTop + m.panelH - m.bandBottom),4)}px`
        );
      }
    }
  }
  await page.close();
}
await browser.close();
