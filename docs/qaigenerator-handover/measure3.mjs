import { chromium } from 'playwright-core';
import path from 'node:path';

const FILE = 'file://' + path.resolve('repro3.html');
const NAV_H = 66;                       // 截图里 TabBar 下沿
const VP = { width: 1920, height: 900 };  // 与你截图一致

const PANELS = [
  { name: '矮   180px', panelH: 180 },
  { name: '中等 290px', panelH: 290 },   // ← 截图里的实际高度
  { name: '中等 465px', panelH: 465 },   // ← 若 gate 目标是整个 Q2 组
  { name: '高   600px', panelH: 600 },
  { name: '超高 1100px', panelH: 1100 }, // 高于可视带
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: VP });
await page.goto(FILE);

const run = async (variant, panelH, strat, args = []) => {
  await page.evaluate(([variant, navH, panelH]) =>
    window.setup({ variant, navH, panelH, boundBody: true }), [variant, NAV_H, panelH]);
  await page.evaluate(([strat, args]) => window.strategies[strat](...args), [strat, args]);
  return page.evaluate(() => window.measure());
};

for (const variant of ['A', 'B']) {
  const b = await run(variant, 290, 'center');
  console.log(`\n${'='.repeat(96)}`);
  console.log(`变体 ${variant}  (${variant === 'A' ? '容器 top:0，导航浮在上面' : '容器已让开导航'})` +
              `  视口 ${VP.width}x${VP.height}  导航下沿 y=${b.navBottom}` +
              `  可视带 y=[${b.bandTop},${b.bandBottom}] 高 ${b.bandH} 中心 y=${b.bandCenter}`);
  console.log('='.repeat(96));
  console.log('面板高       策略              面板 y=[顶,底]      中心y   上空   下空  顶被盖  按钮出界  占视口');
  for (const p of PANELS) {
    for (const [strat, args, label] of [
      ['center',    [],           'center(现状L1)'],
      ['nearest',   [],           'nearest(现状L2)'],
      ['ratio',     [0.5, 24],    'ratio R=0.5   '],
      ['ratio',     [0.32, 24],   'ratio R=0.32  '],
      ['topAlways', [24],         'topAlways(建议)'],
    ]) {
      const m = await run(variant, p.panelH, strat, args);
      const f = (n, w) => String(n).padStart(w);
      console.log(
        `${p.name.padEnd(12)} ${label}  [${f(m.panelTop,5)},${f(m.panelBottom,5)}]` +
        ` ${f(m.panelCenter,6)} ${f(m.gapAbove,6)} ${f(m.gapBelow,6)} ${f(m.hiddenUnderNav,6)} ${f(m.buttonsOffscreen,8)} ${f(m.pctOfViewport,5)}%`
      );
    }
    console.log('');
  }
}

// ---- 假设验证：滚完之后面板才长高 ----
console.log('\n' + '='.repeat(96));
console.log('假设验证：scrollIntoView(center) 跑在面板长高之前（建议列表后渲染），之后不再重新定位');
console.log('='.repeat(96));
for (const variant of ['A', 'B']) {
  for (const [from, to] of [[90, 290], [140, 290], [90, 465], [200, 465]]) {
    await page.evaluate(([variant, navH]) =>
      window.setup({ variant, navH, panelH: 290, boundBody: true }), [variant, NAV_H]);
    await page.evaluate(([from, to]) => window.scrollThenGrow(from, to), [from, to]);
    const m = await page.evaluate(() => window.measure());
    console.log(`变体${variant} 滚动时高${String(from).padStart(4)}px → 长到${String(to).padStart(4)}px` +
      ` ⇒ 面板 y=[${String(m.panelTop).padStart(5)},${String(m.panelBottom).padStart(5)}]` +
      ` 中心 y=${String(m.panelCenter).padStart(4)}` +
      ` 比带中心低 ${String(m.panelCenter - m.bandCenter).padStart(4)}px`);
  }
}

// ---- ① max-h-[40vh] 生效性判别 ----
console.log('\n' + '='.repeat(96));
console.log('① max-h-[40vh] 是否生效：同一段内容，两种视口高度');
console.log('='.repeat(96));
for (const h of [900, 400]) {
  for (const bound of [true, false]) {
    await page.setViewportSize({ width: 1920, height: h });
    await page.evaluate(([navH, bound]) =>
      window.setup({ variant: 'B', navH, panelH: 290, boundBody: bound }), [NAV_H, bound]);
    const m = await page.evaluate(() => window.measure());
    console.log(`视口高 ${String(h).padStart(4)}  max-h ${bound ? '接上' : '没接'}` +
      `  40vh=${Math.round(h * 0.4)}px  computed maxHeight=${String(m.bodyMaxH).padEnd(9)}` +
      `  面板高=${String(m.panelH).padStart(4)}  内部滚动条=${m.bodyScrolls ? '有' : '无'}`);
  }
}
await browser.close();
