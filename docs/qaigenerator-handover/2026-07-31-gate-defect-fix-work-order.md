# 工作单 · gate 缺陷修复（**已被拆分，见下**）

> ⚠️ **2026-07-31 优先级调整后本单已拆成两半。**
> 「182px 坐标系修正」和「困住排查五问」已挪到
> [`2026-07-31-gate-rollout-work-order.md`](2026-07-31-gate-rollout-work-order.md)，
> 与六表单铺开同一个 PR，排在铺开之前。
>
> **本文件保留的是剩下那批、留给后续修复单的项**：
> 恒顶部对齐（D 节）、JS 现算 40% 相对整屏（E 节）、滚动锁 `defaultPrevented` 测试（A 节）、
> ①③ 对抗式复核完整版（B 节）、全仓 `vh`/`vw` 清单（F 节）。
> C 节（182px 定案）与 G 节（单位规则注释）**已移交**，此处仅作留档。

---

## 原文（拆分前）

**#678 已合入 main，本单的代码一行都还没做。** 所以下面每一条都是**修 main 上的已知缺陷**，
不再是合并前的收尾。

- **新分支从最新 main 开**，base=main，**DON'T merge —— 只推 PR**
- 排在队列③（铺六个表单）**之前**。现在缺陷只在 LazyPackForm 一处；
  先铺再修等于把 182px 复制六份，六处都要回头改，~41 处 dim 标记也会铺在错的落点规则上
- 队列：**本修复单 → ③ 铺六表单 → ④ 补日志 → ⑤ 单 3**

## ⚠️ 第 0 优先：先确认 main 上有没有「把用户困住」的路径

B 节的对抗式复核**没跑就合并了**，而其中 B①-3 正是查这个的。在做任何其它事之前先答这一条：

已知的两个缺陷会复合成一个真实风险 ——
① 让 gate 在 `result !== null` 时激活、③ 同时锁掉背景滚动、
定位又少滚 25% 让面板停在偏低位置。**如果按钮行落在视口下方而滚动已锁，
鼠标用户就到不了确认按钮。** 而 ① 顺带退休了 60 秒兜底 ——
原本唯一的自动逃生口没了，所以一旦成立就是永久卡住。

必须明确回答（每条给 file:line 证据）：

1. gate 激活后，**只用指针**能否到达确认/拒绝按钮？矮视口（约 600px 高）下呢？
2. `result` 有没有任何**挂载即非空**的路径（#676 记录 tab 回填 / 草稿恢复 / URL 参数）？
3. 除了点按钮，还有没有别的出口（Esc / 点遮罩 / 焦点陷阱内的键盘路径）？
4. 键盘滚动（Space / PageDown / 方向键）是否确实**没被**锁 —— 如果没被锁，
   它就是现成的逃生口，可以作为客服话术
5. 焦点陷阱（那 10 行手写实现）有没有 Esc 出口

**任何一条指向"用户会被困住"，立刻上报，不要先修 —— 仓库持有人要决定是否回退 main。**

---

## 0. 前提：三轮实测已定的结论，不要重新推导

实测记录在同目录三份文档 + 四个可复跑探针里。**以下都是已经量过的，直接用**：

| 结论 | 出处 |
|---|---|
| `max-h-[40vh]` 在 `zoom:0.75` 下**渲染成 30vh** —— 上限比原意**紧**，不是没有上限 | 第三轮 |
| `40vh` 的 computed 值不受 zoom 影响；`818.182px` ⇒ 那次测量视口高 2045px（非 900） | 第三轮 |
| `cqh` / `%` / `vh` 在 zoom 下**渲染完全相同**（都是 30%）→ **CSS 换单位无解** | 第三轮 |
| 手写 `sc.scrollTop += rect差值` 在 zoom 下**恒少滚 25%**（实测 281/1126）；`scrollIntoView` 原生正确（残差 1px） | 第三轮 |
| `728 × 0.25 = 182` ⇒ 截图那个 182px 偏移**指向坐标系混用**，不是落点算法 | 第三轮 |
| 比例阈值 `R=0.5` 三种面板高度下落点与现状**逐像素相同** → 永不触发，是死分支 | 第二轮 |
| `R=0.32` 与面板实际占比 32% 压线 → 落点会随「AI 吐了几条建议」翻转，不可维护 | 第二轮 |
| 恒顶部对齐在所有高度、两种布局变体下：上空 24、顶部被导航盖住 **0** | 第二轮 |
| 面板真高过可视带时**三种落点都保不住按钮** → 唯一解是让面板装得下 | 第一、二轮 |
| 浮层导航偏差恒为 `导航高 / 2`（解析解，与视口无关）→ **不许写死偏移常量** | 第一轮 |

---

## A. 补滚动锁测试（测契约，不测合成器）

方法：JS `dispatchEvent` 造事件，断言 `defaultPrevented`。**不用 `mouse.wheel`。**

- 事件必须 `cancelable: true` 构造，否则 `preventDefault()` 是空操作，测试会因错误的原因失败
- 三种输入各一条：`wheel`（`deltaMode:1` 鼠标）、`wheel`（`deltaMode:0` 触控板，另加一条 `ctrlKey:true` 捏合）、`touchmove`（触屏；jsdom 可能没有 `TouchEvent`，用 `new Event` + touches stub）
- **必须有的对照组**（上次失败的根因就是没有正向对照）：
  - gate 未激活 → 同样三个事件 → `defaultPrevented === false`
  - **有界滚动区内部的 wheel 必须放行** → `false`。捕获层无条件 `preventDefault` 会把建议区一起锁死，③ 的配套改动就白做了
  - spy `addEventListener`，断言 `{passive:false, capture:true}` —— passive 默认值会让锁静默失效
  - unmount 后再派发 → 不拦截
  - 两个 gate 同时激活、关掉一个 → 锁仍在（引用计数，不是布尔）

✅ **zoom 不影响这一节** —— `defaultPrevented` 是布尔契约，与坐标系无关。

---

## B. ①③ 对抗式复核

**① `active: result !== null`，去掉 busy**
1. **挂载即激活（最高优先）**：#676 的记录 tab 回填 / 草稿恢复会不会让 result 一进页面就非 null → 用户什么都没做就被红闪硬阻塞
2. **陈旧结果窗口**：已有结果 A → 改输入 → 再次生成。提交时是否先把 result 置 null？否则生成期间拿旧建议挡人
3. 退休 60 秒兜底后，是否存在 gate 激活但无 dismiss 出口的路径（成功后卸载 / 切 tab → 锁有没有解）
4. 删掉的"生成中提示"确认真不可达 —— grep 有没有其它 caller 能置那个 state
5. 确认 diff 一行没碰 `submitTask` / `spendForAction` / `buildSpec`（禁区）

**③ 取消 wheel/touchmove 手势**
1. A 节的白名单问题 —— 头号风险
2. **捏合缩放**：全局拦 `touchmove` 会杀掉 pinch-zoom。`e.touches.length > 1` 要放行（无障碍）
3. gate 期间挂载的 Radix Select / Popover / Dialog，内部列表滚动是否也被捕获层杀了
4. **`overscroll-contain` 和 `preventDefault` 有一个是死的** —— wheel 在捕获层被取消后 `overscroll-behavior` 永远轮不到。说清哪个真正承重，别留假信心
5. 键盘滚动（Space/PageDown/方向键）没锁 —— 焦点陷阱兜住多少？只要结论
6. **新增**：白名单选择器在 ③ 的上限改成 inline style 之后是否还匹配（见 E 节）

---

## C. ⚠️ 先做这个：182px 定案

grep 定位相关代码里的 **`scrollTop` / `scrollBy` / `scrollTo` / `scrollIntoView`**，
看有没有任何一处**接收 `getBoundingClientRect()` 派生的值**。

**结论必须明确写成一句话，二选一**（你的补充①）：

- **「是坐标系混用」** → 修法：视觉差值除以实测 zoom 系数再赋给 `scrollTop`。
  预期：182px 消失，且 zoom=1 时行为不变
- **「滚动压根没跑」**（ref 没挂上 / 调用时 element 为 null / 滚的是 window 而真容器是内层栏）
  → 修法：修 ref 时序，与坐标系无关

两者修法不同，**不许含糊带过**。如果两者都存在，两条都写。

⚠️ **定案过程中加的临时诊断日志现在会进 main**（#678 已合，本单是新 PR）。
**必须在本 PR 内删干净，一条都不许留到下一单。**
P0-3 已经攒了 12 处 `[retry]` 至今没清 —— 那批还等着正式站实测才能动，
不要再往上叠第二批。交付前 grep 一遍自证。

---

## D. ② 落点：取消阈值，恒顶部对齐

```js
// 边距与可视带都从实测 rect 取，同一坐标系（视觉 px）
const z    = host.getBoundingClientRect().height / host.offsetHeight || 1;
const navB = navEl?.getBoundingClientRect().bottom ?? 0;   // 实测，不写死 66
const scR  = sc.getBoundingClientRect();
const bandTop = Math.max(scR.top, navB);
const r = el.getBoundingClientRect();
const visualDelta = r.top - (bandTop + MARGIN);            // 视觉 px
sc.scrollTop += visualDelta / z;                           // ← 转成局部 px 再赋值
```

- 删掉级别1 / 级别2 分支和比例阈值 —— 三轮实测都指向它们是死分支
- `MARGIN` 按**视觉 px** 定义（关乎屏幕边缘留白，不是 UI 节奏），取 24
- ⚠️ **顺序要求**：E 节的上限必须**先**设好、布局稳定之后**再**定位。
  否则重演第二轮那个"滚完面板才长高"的家族问题（实测下移上限 +121~209px）

---

## E. ③ 上限：JS 现算，40% 相对整屏可视高度（已拍板）

```js
const z = box.getBoundingClientRect().height / box.offsetHeight || 1;
const bandVisual = bandBottom - bandTop;                  // 视觉 px
box.style.maxHeight = (0.4 * bandVisual / z) + 'px';      // 写回去要用局部 px
```

四个必须处理的陷阱：

1. **除零**：`offsetHeight === 0`（`display:none` / 首帧）→ `z` 变 `Infinity`/`NaN`。要 `|| 1` 兜底
2. **inline style 覆盖 class**：保留 `max-h-[40vh]` 当**首帧兜底**（JS 跑之前那一帧渲染成 30vh，够接近，不会跳版），JS 随后覆盖。别把 class 删了留空窗
3. **resize / zoom 变化要重算**：可视带高度会变。用 `ResizeObserver` 或 window resize，重算后**重新跑 D 节定位**
4. **别在 `box` 自己身上测 `z`**：它的高度正被你改。在稳定的宿主元素上测

---

## F. `vh` / `vw` 全仓盘点（只报告，这轮不修）

你的补充③。要两样：

1. **滚动栏用的是不是裸 `height:100vh`** —— 明确结论。
   裸 `100vh` 在 `zoom:0.75` 下渲染成视口的 75%，栏底短一截，
   会让第二轮算的「可视带下沿」比真实短 25%
2. **全仓 `vh` / `vw` 清单** —— `index.css:101-119` 那段注释说明这个坑吃过一次，
   但**可能不止一处**。每处列：`file:line`、用在什么属性、是否在 `#root` 的 zoom 子树内、
   渲染结果偏差多少（×0.75 还是无影响）。
   **不修，只要范围。** 这批可能是一堆没人发现的布局问题，值得单独开单

---

## G. 单位规则写成注释，放 hook 顶部显眼处（你的补充②）

```
// ⚠️ 这个文件里有两套坐标系，`#root { zoom: 0.75 }` 让它们不等价。
//
//   视觉 px（已含 zoom）：getBoundingClientRect()、window.innerHeight / innerWidth
//   局部 px（未含 zoom）：scrollTop、clientHeight、offsetHeight、scrollHeight、
//                        getComputedStyle()
//
// 两套【绝不能相减】。实测：把 rect 差值直接赋给 scrollTop 会恒定少滚 1-zoom
// = 25%（1126px 的目标少滚 281px）。这正是 PR #678 里那个 182px 偏移的成因
// （728 × 0.25 = 182）。
//
// 换算系数【现算，不要写死 0.75】：
//   const z = el.getBoundingClientRect().height / el.offsetHeight || 1
//   局部 = 视觉 / z
//
// 同理：`40vh` 的 computed 值不受 zoom 影响（恒为 0.4 × 真实视口高，局部 px），
// 但渲染出来要再乘 zoom —— 所以 max-h-[40vh] 实际只有 30vh。
// cqh 和 % 都躲不开这个乘数，实测三者渲染相同。换 CSS 单位无解，只能 JS 现算。
```

---

## H. 回归断言（四条，第 3 条是这轮最值钱的产出）

1. `panelTop - bandTop === MARGIN` —— 两边都从 rect 取（同一坐标系）；
   `bandTop` 从浮层 rect 现算，**不许写死 66**
2. 有界区渲染高度 ≤ `0.4 × 可视带高` + 1 —— **视觉 px 比视觉 px**
3. **`#root` 的 zoom 设成 `0.75` 和 `1` 两次跑定位，落点的「视觉 px 偏移」必须相同** ←
   专门钉坐标系混用。以后谁再混，当场红
4. 滚动锁三种输入的 `defaultPrevented`（A 节），含正向对照与有界区放行

---

## I. 交付前必跑

- `tsc -p tsconfig.app.json`，**和 base 做错误集逐条 diff**（root `npx tsc --noEmit` 是空转，返回 0 不算数）
- eslint 只报 **error** 数，既有 warning 不算
- 全量测试；确认那 8 个既有失败（adminStats / autofill-choice-validation）没变多也没变少
- **临时诊断日志全部删除**（C 节）—— 交付前 grep 一遍确认
- 报告回：C 节的一句话定案、错误集 diff、测试计数、B 节每条的结论（真问题 / 不成立 / 已修）、F 节的清单
- 推 `claude/confirm-gate-usp`，**只推不合**
