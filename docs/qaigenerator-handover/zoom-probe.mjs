import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

const HTML = `<!doctype html><style>
  *{box-sizing:border-box;margin:0}
  #root{zoom:var(--z,0.75)}
  #probe{max-height:40vh;height:2000px;background:#eee}
  #sc{height:60vh;overflow-y:auto;border:1px solid #000}
  #tall{height:4000px}
  #mark{height:50px;background:#c00}
</style>
<div id="root">
  <div id="probe"></div>
  <div id="sc"><div id="tall"><div id="mark" style="margin-top:1500px"></div></div></div>
</div>`;

const probe = async (vh, z) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: vh } });
  await page.setContent(HTML);
  await page.evaluate(z => document.documentElement.style.setProperty('--z', z), z);
  const r = await page.evaluate(() => {
    const p = document.getElementById('probe');
    const sc = document.getElementById('sc');
    const mark = document.getElementById('mark');
    const cs = getComputedStyle(p);
    // 手写 scrollTop 数学：想把 mark 移到容器顶部
    const before = mark.getBoundingClientRect().top - sc.getBoundingClientRect().top;
    sc.scrollTop += before;                     // 用 rect 的差值（视觉 px）赋给 scrollTop（局部 px）
    const after = mark.getBoundingClientRect().top - sc.getBoundingClientRect().top;
    const scrollTopUsed = sc.scrollTop;
    // 复位，再用 scrollIntoView 对照
    sc.scrollTop = 0;
    mark.scrollIntoView({ block: 'start', behavior: 'instant' });
    const afterNative = mark.getBoundingClientRect().top - sc.getBoundingClientRect().top;
    return {
      computedMaxH: cs.maxHeight,
      probeClientH: p.clientHeight,             // 局部 px
      probeRectH: +p.getBoundingClientRect().height.toFixed(2), // 视觉 px
      scRectH: +sc.getBoundingClientRect().height.toFixed(2),
      scClientH: sc.clientHeight,
      handrolled_wanted: +before.toFixed(1),
      handrolled_residual: +after.toFixed(1),   // 0 = 手写数学正确；非 0 = 被 zoom 坑了
      scrollTopUsed: +scrollTopUsed.toFixed(1),
      native_residual: +afterNative.toFixed(1), // scrollIntoView 的残差
    };
  });
  await page.close();
  return r;
};

console.log('=== Chromium 里 40vh 在 zoom 容器内解析成什么 ===');
console.log('视口高  zoom   computed max-height   probe.clientHeight  probe rect 高  = 40vh 的多少倍');
for (const vh of [900, 1080, 1534, 1536]) {
  for (const z of [1, 0.75]) {
    const r = await probe(vh, z);
    const nominal = vh * 0.4;
    console.log(
      `${String(vh).padStart(5)}  ${String(z).padEnd(5)}  ${String(r.computedMaxH).padStart(12)}` +
      `${String(r.probeClientH).padStart(18)}${String(r.probeRectH).padStart(15)}` +
      `      ${(parseFloat(r.computedMaxH) / nominal).toFixed(3)}×(标称${nominal})`
    );
  }
}

console.log('\n=== 反解：computed max-height = 818.182px 对应什么视口高（zoom=0.75）===');
for (const vh of [1150, 1200, 1534, 1535, 1536, 1600]) {
  const r = await probe(vh, 0.75);
  console.log(`  视口高 ${String(vh).padStart(5)} ⇒ computed max-height = ${r.computedMaxH}`);
}

console.log('\n=== 手写 scrollTop 数学 vs scrollIntoView，在 zoom 容器里 ===');
for (const z of [1, 0.75]) {
  const r = await probe(900, z);
  console.log(`zoom=${z}  容器 rect高=${r.scRectH} clientHeight=${r.scClientH}` +
    `  想滚 ${r.handrolled_wanted}px → 赋给 scrollTop ${r.scrollTopUsed}` +
    `  ⇒ 手写残差 ${r.handrolled_residual}px | scrollIntoView 残差 ${r.native_residual}px`);
}
await browser.close();
