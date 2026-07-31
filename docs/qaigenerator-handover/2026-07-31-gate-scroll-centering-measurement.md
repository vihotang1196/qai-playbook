# #678 ② 居中实测 — `block:"center"` 到底落在哪

**2026-07-31，真 Chromium（`/opt/pw-browsers/chromium-1194`），非 headless shell 的合成器路径，
纯几何测量所以不受合成器影响。** 复现件：[`gate-scroll-repro.html`](gate-scroll-repro.html) +
[`measure2.mjs`](measure2.mjs)（`npm i playwright-core` 后 `node measure2.mjs`）。

⚠️ **这是布局的忠实模型，不是 qaigenerator 本体**（本仓库没有那份代码）。
几何语义与真实环境一致，但**哪一列适用取决于真实布局是变体 A 还是 B** —— 见文末唯一的待确认项。

复现件还原的结构：`TabBar` 浮层 z-30 高 56px、内层 `overflow-y-auto` 栏、
面板含「标题 + `max-h-[40vh] overscroll-contain` 有界建议区 + 滚动区外的按钮行」。

- **变体 A**：滚动容器 `top:0` 铺满，导航条浮在它上面（容器不知道被遮）
- **变体 B**：滚动容器已让开 56px

「可视带」= 扣掉浮层后真正能看见的区间 = `[max(容器顶, 导航下沿), min(容器底, 视口底)]`。
`Δ中心` = 面板中心 − 可视带中心；负数 = 偏高。

## 测量结果

| 面板 | 落点 | 变体 | 1280×800 | 1024×600 | 390×844 | 顶部被导航盖住 |
|---|---|---|---|---|---|---|
| 矮于可视带 | `center` | **A** | **Δ −28** | **Δ −28** | **Δ −28** | 0 |
| 矮于可视带 | `center` | B | Δ 0 | Δ 0 | Δ 0 | 0 |
| 矮于可视带 | `nearest` | A/B | Δ +167 | Δ +107 | Δ +153 | 0（但底边贴齐） |
| 高于可视带 | `center` | **A** | Δ −28 | Δ −28 | Δ −28 | **211 / 271 / 225px** |
| 高于可视带 | `center` | B | Δ 0 | Δ 0 | Δ 0 | 183 / 243 / 197px |
| 高于可视带 | `nearest` | **A** | — | — | — | **56px（恒等于导航高）** |
| 高于可视带 | `nearest` | B | — | — | — | 0 |

## 四条结论

### 1. 你的因素①成立，而且偏差是精确的 `导航高 / 2`

变体 A 下 `Δ = −28px`，三种视口**完全一致**（56 / 2 = 28）。不是"大概偏一点"，是解析解：
`scrollIntoView` 把面板居中到容器 scrollport，浮层吃掉顶部 `navH`，
于是可视带中心比容器中心低 `navH/2`，面板就高了 `navH/2`。

**所以别写死 `28px` 的偏移常量** —— 导航条改高度就错，而且变体 B 下补偏移会反向偏 28px。
要按实测的 `nav.getBoundingClientRect().bottom` 算。

### 2. 你的因素②只在变体 A 下成立

变体 B（容器已让开导航）`Δ = 0`，`block:"center"` **本来就是对的**，不用改。
两个因素其实是同一个因素：只有当浮层压在滚动容器上方时才偏。

### 3. `nearest` 在面板矮于带时把面板压到视口底边（变体 A、B 都中）

`Δ +107 ~ +167`，面板底沿正好贴住可视带底沿 —— **确认按钮落在屏幕最底边**。
真机上还要被浏览器工具栏 / home indicator 再切一刀。
级别2 只要在矮面板上误触发一次，按钮就在这个位置。所以**级别判定的阈值要对可视带比，
不能对裸视口高度比** —— 高度落在 `(H−navH, H)` 区间的面板会被判成"矮"，然后顶部藏进导航条。

### 4. ⚠️ ③ 的 `max-h-[40vh]` 很可能已经让级别2 变成死代码

`bounded-only` 那组：建议区塞 40 条，面板高度仍然只有 410 / 330 / 482px，**恒矮于可视带**。
因为面板高 ≈ `0.4H + 标题与按钮行 ~90px`，可视带 = `H − 56`；
要面板高过带需要 `H < 约 243px` —— 现实视口不存在。

**结论分两种情况**（这就是你要的"两种情况都对"）：

- **面板里只有有界建议区** → 级别2 永远不触发，`nearest` 那条分支是死代码。
  只需修级别1 的 `navH/2`，然后**把级别2 删掉**（或留着但明确标注不可达）。
- **面板里另有不受 `max-h` 约束的内容** → 级别2 可达，而且**现状两种落点都是坏的**：
  - `center`：顶部被导航盖住 **211~271px**，底部同时溢出 —— 红闪的上边框直接看不见
  - `nearest`：顶部被导航盖住 **恒 56px**，正好一个导航高 ——
    因为 `nearest` 把面板顶对齐到容器顶（`scrollTop=0`），而容器顶在浮层**底下**
  - 这是变体 A 独有的真 bug；变体 B 下 `nearest` 给出 `panelTop=56`，是对的

## 建议的修法

不用 `scrollIntoView`，按可视带自己算。复现件里 `proposedImpl` 已实测：
所有矮面板场景 `Δ=0`（A、B 两个变体都是），高面板场景顶部被盖 0px。

```js
const sc  = scrollAncestorOf(el);                       // 最近的滚动祖先
const scR = sc.getBoundingClientRect();
const navB = navEl?.getBoundingClientRect().bottom ?? 0; // 实测，不是常量
const bandTop    = Math.max(scR.top, navB);
const bandBottom = Math.min(scR.bottom, window.innerHeight);
const bandH      = bandBottom - bandTop;
const r = el.getBoundingClientRect();

sc.scrollTop += (r.height > bandH)
  ? (r.top - bandTop)                                    // 高于带：顶部贴带顶
  : ((r.top + r.height / 2) - (bandTop + bandH / 2));    // 矮于带：真视觉居中
```

⚠️ **高于带的那一支我不建议就这么收**：顶部贴齐会把按钮行推到屏幕外，
而 gate 的目的就是让人点按钮。`center` 藏顶部、`nearest` 藏顶部、顶部贴齐藏按钮 ——
三个选项都有损。**真正的修法是让面板永远装得下**：既然 ③ 已经把建议区收成有界，
把面板里剩下的不受约束内容也收进去，级别2 就自然消失，只剩一条always-centered 路径,
红闪整框可见、按钮可见。我倾向这个。

## 回归测试怎么钉

```
expect(Math.abs(panelCenter - bandCenter)).toBeLessThanOrEqual(2)
```

`bandTop` **必须**从浮层的 `getBoundingClientRect().bottom` 现算。
如果测试里把 56 写死，将来导航条改高度测试照样绿，而线上偏了。
两种视口各跑一遍（`1280×800` 和 `1024×600`）—— 偏差本身与视口无关，
但级别判定的阈值与视口有关，矮视口才测得出阈值错。

## 唯一的待确认项（一句话就能定）

**那个 `overflow-y-auto` 栏是从 TabBar 下面开始，还是 TabBar 浮在它上面？**

- 浮在上面（变体 A）→ 上面四条结论全部适用，② 现在是偏的，要改
- 已让开（变体 B）→ 级别1 本来就准，只有"面板高于带"和 `nearest` 压底边两个问题

在正式站控制台跑这一句就能定（只读，不改任何东西）：

```js
(() => {
  const nav = document.querySelector('[class*="z-30"], header, nav');
  const col = [...document.querySelectorAll('*')].find(e =>
    getComputedStyle(e).overflowY === 'auto' && e.clientHeight > 300);
  return {
    navBottom: nav?.getBoundingClientRect().bottom,
    colTop: col?.getBoundingClientRect().top,
    variant: col?.getBoundingClientRect().top >= (nav?.getBoundingClientRect().bottom ?? 0)
      ? 'B（已让开）' : 'A（被浮层覆盖）',
  };
})()
```
