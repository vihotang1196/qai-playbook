import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const HTML = `<!doctype html><style>
  *{box-sizing:border-box;margin:0}
  #root{zoom:var(--z,0.75)}
  #col{height:100vh;overflow-y:auto;container-type:size}
  .box{height:3000px;background:#eee}
  #vh{max-height:40vh}     /* 现状 */
  #cqh{max-height:40cqh}   /* 候选：容器查询单位 */
  #pct{max-height:40%}     /* 候选：百分比 */
</style>
<div id="root"><div id="col">
  <div class="box" id="vh"></div><div class="box" id="cqh"></div><div class="box" id="pct"></div>
</div></div>`;

console.log('视口高  zoom  单位    computed     渲染(视觉px)  占视觉视口');
for (const vh of [900, 2045]) {
  for (const z of [1, 0.75]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: vh } });
    await page.setContent(HTML);
    await page.evaluate(z => document.documentElement.style.setProperty('--z', z), z);
    const r = await page.evaluate(() => ['vh','cqh','pct'].map(id => {
      const e = document.getElementById(id);
      return { id, computed: getComputedStyle(e).maxHeight,
               visual: +e.getBoundingClientRect().height.toFixed(1),
               local: e.clientHeight };
    }));
    for (const x of r) {
      console.log(`${String(vh).padStart(5)}  ${String(z).padEnd(5)} ${x.id.padEnd(5)} ${String(x.computed).padStart(10)}` +
        `${String(x.visual).padStart(13)}   ${(100*x.visual/vh).toFixed(1)}%   (local ${x.local})`);
    }
    console.log('');
    await page.close();
  }
}
await browser.close();
