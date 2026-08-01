# 盘点交付 · 九模板 gate 映射 + 光带「生成中」框清单

读自 `vihotang1196/qaigenerator` @ `d365724`（#678 的合并提交）。**未改任何文件。**

---

## 一、九模板映射表

模板注册表在 `src/components/studio/MarketplaceTab.tsx` 的 `SECTIONS`（第 88–116 行，9 项）。
⚠️ **这就是 `GATE_COVERAGE` 穷尽性测试要的锚点 —— 它已经存在，②（测试守卫）可行。**

| # | 模板 | id | view | Pack | Form | AI 生成后需确认的面板 | gate |
|---|---|---|---|---|---|---|---|
| 1 | Lazy Pack | `real-estate` | `lazyPack` | RealEstateLazyPack | LazyPackForm | Q2 核心卖点建议 | ✅ 已接 |
| 2 | Detailed | `section-2` | `detailed` | DetailedAdPack | ⚠️ **无 Form，内联** | `AiPromptButton`×N（字段级）、`AiAutofillButton`、hero-text ×N | ❌ |
| 3 | Seeding | `section-3` | `seeding` | SeedingEntry | SeedingForm | **`series_theme`（AI theme）**、**`specified_topics`（AI topic）** | ❌ |
| 4 | Person+Scene+Service+Product | `section-4` | `aida-person` | AidaPersonPack | AidaPersonForm | **USP 1 / 2 / 3 各一个**（Replace/Regenerate/Dismiss） | ❌ |
| 5 | AI Influencer Selling | `section-5` | `influencer` | InfluencerPack | InfluencerForm | USP AI assist（同 PR-A 模式） | ❌ |
| 6 | AIDA Ad | `section-6` | `aida-storyboard` | AidaStoryboardPack | AidaStoryboardForm | USP AI assist（`uspAi`，第 148 行） | ❌ |
| 7 | Product Branding | `section-7` | `product-branding` | ProductBrandingPack | ProductBrandingForm | 特色 / 材质 AI-polish（`fieldAi`，第 147 行） | ❌ |
| 8 | Unboxing ASMR | `section-8` | `unboxing-asmr` | UnboxingAsmrPack | ⚠️ **无 Form，内联** | `AiAutofillButton`（带 fields override） | ❌ |
| 9 | AIDA + AI Character | `section-9` | `aida-character` | AidaCharacterPack | AidaCharacterForm | USP AI assist（`uspAi`，第 151 行） | ❌ |

**现状覆盖：9 个模板里只有 1 个接了 gate。**
（全仓 `useConfirmGate` 只出现在 `LazyPackForm` + `RealEstateLazyPack`；
`TabBar` / `LowBalanceBanner` 是逃生口不是接入点。）

### ⚠️「7 个表单组件」这个说法本身就漏了两个模板

Detailed 和 Unboxing ASMR **没有 Form 组件**，直接在 Pack 里内联渲染 AI 按钮。
按组件盘会整个漏掉这两个 —— 正是改成按模板验收要防的情况。

### "AI theme" / "AI topic" —— 确认漏了

在 `SeedingForm.tsx`：`series_theme`（系列主题，第 51 行）与 `specified_topics`（指定选题）。
各有独立的 AI 生成按钮（`themeBusy` / `topicsBusy`，第 254–277 行）。
**不属于任何"六个表单的 USP 字段"，之前的范围完全没覆盖。**

---

## 二、① 内联模板（Detailed / Unboxing ASMR）的 dim 标记方案

**有天然接缝，不用逐字段手打。**

`DetailedAdPack.tsx:755` 是一个**共享字段渲染函数**：

```tsx
{aiKind && <AiPromptButton kind={aiKind} value={answers[key]} context={aiFieldContext}
                           onReplace={(val) => set({ [key]: val })} />}
```

所有带 AI 的字段都从这一处出去。**方案：标记打在这个字段包装器上，不打在每个字段调用点。**
一处改动覆盖该模板全部字段级 AI 面板，`{...GATED}` 单值常量照样适用。

hero-text（第 948 行）是同一个 `AiPromptButton` 的另一处使用，单独标一次。
`AiAutofillButton`（第 811 行）是整表填充，标在它自己的面板上。

### ⚠️ 这个发现同时让 ②b（结构性守卫）变成可行

`AiPromptButton` 是**共享组件**，跨模板复用。所以
**「`AiPromptButton` 的每一处使用都必须在 gate 作用域内」是结构性检查，不需要任何形状猜测。**
之前那条"要盘点回答是否存在共享面板组件"——答案是**有**，这条守卫可以做。

---

## 三、② SeedingCandidatePicker：确认不需要接 gate

`SeedingCandidatePicker.tsx:58` 用的是共享 `Dialog` 原语（Radix）：
`<Dialog open onOpenChange><DialogContent>`。

Radix Dialog 自带焦点陷阱、外部点击拦截、`aria-modal` —— **天然阻塞外部交互，
再叠一层 gate 是重复且会互相打架**（两套焦点陷阱）。

**结论：不接 gate。** 但要在 `GATE_COVERAGE` 里给 Seeding 模板写
`noAiConfirm` 之外的说明 —— 它的 theme/topics 字段**仍然需要 gate**（见上表），
只有这个 picker 弹窗不需要。

### 顺带记一笔：「第四条继续」那个 bug

盘点时没有顺手看到成因（未专门查，按你说的）。但记录一条相关线索：
`SeedingCandidatePicker` 是**纯展示组件**（文件头注释自称 "Purely presentational"），
它只渲染上游传进来的候选列表 —— **所以截断/丢弃发生在上游**，
不在这个组件里。要查就查 `SeedingForm` 里生成候选的那段解析。

---

## 四、光带「生成中」框清单

### 已接（1 处）

- `ThreeViewGenerator.tsx` —— 表单阶段的 character reference sheet

### 最高价值目标：`LazyPackStepwise` 的 `SlotPanel`（第 2035 行）

**IMAGE 和 VIDEO 框走同一个共享组件** —— `generatingLabelKey` prop，
两处调用（第 1718 行 image / 第 1765 行 video）。**接一处，两种框同时覆盖。**

生成中分支在 `status === "running"`，现在只有
`<Loader2 className="animate-spin">` + `{t(generatingLabelKey)}`。

⚠️ **宿主框缺 `relative`**：

```
rounded-lg border-2 border-ink bg-gray-50 overflow-hidden flex items-center justify-center w-full max-h-[60vh]
```

`ScanBorder` 要求宿主 `position: relative`（`inset-0` 才有锚点）。
**必须加 `relative`。** 圆角已有（`rounded-lg`），`border-radius: inherit` 能拿到。

### 其余候选（按 `pollTask` / `pollSegmentAsset` 消费者 + `animate-spin` 密度）

| 文件 | 备注 |
|---|---|
| `studio/TemplateGeneratePanel.tsx` | 轮询消费者，`animate-spin` ×8 —— 槽位生成框，**高优先** |
| `marketplace/InfluencerCharacterGenerator.tsx` | 轮询消费者 |
| `marketplace/SeedingForm.tsx` | `animate-spin` ×8（含 theme/topics 按钮内的 spinner，那些是按钮态不是框） |
| `marketplace/DetailedAdPack.tsx` | ×5 |
| `marketplace/AidaStoryboardPack.tsx` / `AidaCharacterPack.tsx` | 各 ×5 |
| `marketplace/UnboxingAsmrPack.tsx` | ×3 |
| `marketplace/FourViewGenerator` / `ProductAngleGenerator` / `WhiteBgGenerator` | 用户点名 |
| `marketplace/MarketplaceVoiceGen` | 用户点名 |
| `studio/FBAdCoverPanel.tsx` | ×4 —— 用户之前问过要不要查，在这里 |
| `studio/PublishTab.tsx` | ×4 |

⚠️ **要区分「按钮里的 spinner」和「框」**：光带只接后者。
按钮态用 spinner 是对的，不该绕按钮跑光带。

### 合并（merge）进度框

`LazyPackStepwise` 内，尚未定位到独立组件 —— **待填**。

---

## 五、⑤「挂载即非空」——**七个表单全部安全，这条风险不存在**

逐个查了建议状态的初始化和**全部** setter 调用点：

| 表单 | 建议状态 | 初值 | setter 调用点 | 挂载即非空？ |
|---|---|---|---|---|
| LazyPackForm | `spAI` (82) | `null` | 生成 handler(94) / ×(224) / Replace(255) | **否** |
| AidaPersonForm | `uspAi` (146) | `null` | 172 / 241 / 264 | **否** |
| InfluencerForm | `uspAi` (143) | `null` | 176 / 257 / 269 | **否** |
| ProductBrandingForm | `fieldAi` (147) | `null` | 169 / 243 / 255 | **否** |
| AidaStoryboardForm | `uspAi` (148) | `null` | 172 / 252 / 264 | **否** |
| AidaCharacterForm | `uspAi` (151) | `null` | 同上模式 | **否** |
| SeedingForm | `themeCands` / `topicCands` (260/261) | `null` | 270 / 282 + 弹窗 onOpenChange | **否** |

**规律完全一致：每个状态恰好三个写入点** —— 一个用户发起的 async 生成 handler、
面板自己的 Replace、面板自己的 ×。**没有任何 `useEffect`、草稿恢复、记录 tab 回填、
URL 参数写这些状态**（`grep -A6 useEffect` 逐个确认过）。

→ **B①-1「用户什么都没做就被红闪锁住」这条风险，在这七个表单上不成立。**
铺开前不需要给任何表单加 result 清零。这条一直排在最高优先级，现在可以关掉。

⚠️ 唯一没覆盖的是 `AiPromptButton`（内联模板用的那个）：它的 `open` 初值也是
`false`（第 42 行），同样安全。

---

## 六、⑥ hero-text ×N ——**「单面板」前提对模板 2 不成立**

`DetailedAdPack.tsx:944` 是 `answers.hero.map((h, i) => ...)`，
每个 hero 槽位渲染**自己的一个** `AiPromptButton`（第 948 行）。

而 `AiPromptButton` 的开关状态是**每实例私有的**：

```tsx
// src/components/studio/AiPromptButton.tsx:42
const [open, setOpen] = useState(false);
```

**没有任何跨实例协调。所以模板 2 里可以同时开着多个建议面板。**

### 和其余表单的关键差别

其余六个表单用的是**单个** `uspAi` / `fieldAi` 状态holding `{ key, text }` ——
换一个字段生成就顶掉上一个，**天然「一次一个」**（文件注释也是这么写的：
"ONE active suggestion at a time"）。所以它们单 gate 就够。

**只有模板 2（Detailed）会有多面板并存。**

### 后果（两个，都要处理）

1. **N 个 gate 同时激活** → N 次滚动请求、N 个红闪、
   滚动锁必须是**引用计数**而不是布尔（工作单 A 节已经有这条断言，现在有了真实触发场景）
2. **dim 会叠加** → 同一片区域被 N 个 gate 各 dim 一次，`opacity` 相乘，
   正是要防的暗屏

### 建议方案（需要你拍板，因为动的是共享组件）

**方案 A（推荐）：给 `AiPromptButton` 加「一次一个」协调，让模板 2 和其余六个一致。**
用一个轻量 context（或模块级当前打开 id）在开新面板时关掉旧的。
好处：单 gate 方案对九个模板统一适用，dim 不可能叠加，
也不用把 `useConfirmGate` 改成多 allow 元素。
代价：`AiPromptButton` 是跨模板共享组件，行为变化影响所有用它的地方 ——
但那正是让它们一致，不是引入差异。

**方案 B：扩展 `useConfirmGate` 支持多个 allow 元素。**
`allowEl` 现在是单个 ref（`useRef<HTMLElement|null>`），只能白名单一个面板；
两个面板同开时第二个会被自己的 gate 挡住。改动面比 A 大得多。

⚠️ **不选就铺开的话，模板 2 会同时踩上面两个后果。**

---

## 七、顺带产出：F 节 `vh` / `vw` 清单（只报告）

`#root { zoom: 0.75 }` 下**每一处 `vh` 都渲染成标称值的 75%**。全仓 22 处：

| 渲染偏差 | 位置 |
|---|---|
| `max-h-[92vh]` → 实际 69vh | `marketplace/ImageEditor.tsx` |
| `max-h-[90vh]` → 67.5vh | `studio/PostDetailModal.tsx` |
| `max-h-[88vh]` → 66vh | `studio/TopUpDialog.tsx` |
| `max-h-[85vh]` → 63.75vh | `ui/ZoomableImage.tsx`、`studio/StarterLibrary.tsx` |
| `max-h-[80vh]` → 60vh | `LazyPackStepwise`、`LazyPackHistoryDetail` |
| `max-h-[70vh]` → 52.5vh | `TopUpDialog`×2、`StarterLibrary`×2、`HistoryDialog`×2 |
| `max-h-[60vh]` → 45vh | `LazyPackStepwise`×2、`PublishTab`、`HistoryDialog`、`InfluencerCharacterGenerator` |
| `max-h-[55vh]` → 41.25vh | `SeedingCandidatePicker` |
| `max-h-[50vh]` → 37.5vh | `PostDetailModal`×3 |
| `max-h-[48/44vh]` → 36/33vh | `TopUpDialog` |
| `max-h-[40vh]` → 30vh | `LazyPackForm`（#678 的建议区） |

**系统性偏差：所有 vh 上限都比设计值紧 25%。没有一处是「超出」——全部是「不足」。**

### ③ 分类：哪些是真问题，哪些改了反而不对

| 类 | 判据 | 影响 | 位置 |
|---|---|---|---|
| **A · 可滚内容被挤小 —— 真问题** | 容器内是需要滚动的长内容，窗口小了就要多滚 | **可用性下降** | `TopUpDialog`（70/48/44vh）、`HistoryDialog`（70/60vh）、`StarterLibrary`（70/85vh）、`PostDetailModal`（50vh×3 / 90vh）、`SeedingCandidatePicker`（55vh）、`LazyPackForm`（40vh 建议区）、`PublishTab`（60vh）、`LazyPackHistoryDetail`（80vh）、`LazyPackStepwise`（80vh 列表） |
| **B · 媒体等比缩放 —— 只是留白** | 内容是 `object-contain` 的图/视频，缩小只是四周多留白，不丢信息 | 观感，非可用性 | `ui/ZoomableImage`（85vh）、`ImageEditor`（92/62vh）、`LazyPackStepwise`（60vh 媒体框）、`InfluencerCharacterGenerator`（60vh） |

**A 类才是要修的**（尤其 `PostDetailModal` 的 50vh → 37.5vh，和 `TopUpDialog` 的
44vh → 33vh —— 三分之一屏放长列表）。
**B 类改了会让图更大，是改进不是修 bug**，可以在同一单里顺手调，但别当缺陷记。

⚠️ 分类依据是「容器里装的是什么」，由代码推断得出，动手前值得肉眼各开一个确认。

---

## 八、dim 标记计数 ——**实际约 63 处，比 ~41 的估计多一半**

### 计数方法：`fieldLabel(` 是可靠基数

LazyPackForm 已完成的标记数是 **9**，它的 `fieldLabel(` 出现次数也是 **9** —— 1:1。
用它作估算基数。

| 表单 / Pack | `fieldLabel(` | 其它单位 | dim 标记（估） | 状态 |
|---|---|---|---|---|
| LazyPackForm | 9 | | **9** | ✅ 已完成 |
| AidaPersonForm | 10 | | ~10 | |
| ProductBrandingForm | 9 | | ~9 | |
| InfluencerForm | 6 | | ~6 | |
| AidaStoryboardForm | 6 | | ~6 | |
| AidaCharacterForm | 6 | | ~6 | |
| **SeedingForm** | 12 | QLabel 9 | **~12** | |
| **DetailedAdPack**（内联） | 9 | **FormGroup 10** | **~10** | |
| **UnboxingAsmrPack**（内联） | 4 | | **~4** | |
| | | | **待做合计 ≈ 63** | |

### ⚠️ 为什么比估计多

`~41` 这个数来自「六个表单」的框架：
`AidaPerson 10 + ProductBranding 9 + Influencer 6 + AidaStoryboard 6 + AidaCharacter 6 = 37`，
接近 41。**它把 SeedingForm（12）和两个内联模板（14）整个漏在外面** ——
正是「按组件盘」漏掉的那部分。按模板验收之后，实际工作量约 **1.5 倍**。

⚠️ `fieldLabel` 是估算基数不是精确值：LazyPackForm 的 9 处里有一处（第 389 行
`space-y-6 lg:pr-1`）标在整列包装器上而不是字段上。实施时按实际结构放，
最后用**计数断言**核对（工作单已有这条）。

---

## 九、USP 个数：四个表单**各 3 个字段，但只有 1 个面板**

`AidaPersonForm` / `AidaStoryboardForm` / `AidaCharacterForm` / `InfluencerForm`
的 `UspKey` 都是 `"usp_1" | "usp_2" | "usp_3"` —— **各 3 个 AI generate 按钮**。

但它们共用**单个** `uspAi` 状态（`{ key, text } | null`），
所以**同一时刻只有一个面板**。3 个触发点 → 1 个 gate。

→ 这四个表单：**每个 1 个 gate，不是 3 个。**

---

## 十、光带：框 vs 按钮 spinner 的判定

### 判据（从代码实测出来的尺寸规律）

| 尺寸 | 归类 |
|---|---|
| `w-6 h-6` 及以上，或 `relative w-12 h-12` 的绝对定位圆环 | **框级**，接光带 |
| `w-3 h-3` / `w-3.5 h-3.5` / `w-4 h-4` | **按钮内**，不接（按钮态用 spinner 是对的） |

### 三个确定的接入点（都缺 `relative`，都要补）

| 位置 | 说明 |
|---|---|
| `LazyPackStepwise.tsx:2035` `SlotPanel` | **IMAGE + VIDEO 共用一个组件**，接一处覆盖两种框。生成中分支在 `status === "running"` |
| `LazyPackStepwise.tsx:1818` 合并进度框 | `mergeStatus === "running"`。盒子形状与 SlotPanel 相同：`rounded-card border-2 border-ink bg-gray-50 overflow-hidden … max-h-[60vh]`，**同样没有 `relative`** |
| `studio/TemplateGeneratePanel.tsx` | **3 个框级**：第 1464 行（`w-6 h-6` + 说明文字）、第 1553–1558 行（`relative w-12 h-12` 双圆环）、第 1700 行（`w-6 h-6` + 两行说明）。另有 5 个按钮内 spinner（1274 / 1604 / 1643 / 1764）不接 |

⚠️ **三处的宿主都缺 `position: relative`。** 补的时候注意它们都有 `overflow-hidden` ——
加 `relative` 不改变裁剪行为（`overflow` 的裁剪基于 border-box，与定位上下文无关），
但光带是 `inset-0` 铺满 border-box，会被同一个圆角裁剪，这正是想要的效果。

---

## 十一、⑥ 方案 A 的实施要求（已拍板）

给 `AiPromptButton` 加「一次一个」协调，让模板 2 与其余六个一致。四条：

1. **不要用全局单例变量** —— 用 context 或模块级 registry，
   并确认**卸载时清理干净**（否则切模板会残留一个永远关不掉的"当前打开 id"）
2. ⚠️ **顶掉上一个面板必须是「丢弃」不是「确认」** —— 和其余六个表单一致
   （换字段生成就顶掉，不落值）。别让用户以为顶掉 = 采用了。
   现有 `AiPromptButton` 的 Replace 是显式按钮，顶掉走的应该是等价于 × 的路径
3. **hero 槽位有 N 个**，用户连点两个 AI generate 时第一个面板会消失 ——
   **这是新行为，PR 描述里要写明**
4. `AiPromptButton` 跨模板共享，改完要**确认另外几个使用点没退化**
   （`DetailedAdPack` 字段级第 755 行、hero 第 948 行；其余模板的使用点一并过）

## 九、已关闭 / 已定案

| 项 | 结论 |
|---|---|
| 182px 偏移 | 不是坐标系混用 —— `useConfirmGate` 只有 `scrollIntoView`，且只在**被挡点击**时触发，gate 激活时不滚 |
| #678 临时诊断日志 | 零。分支内 `789d8d0` 加、`0eb9c8b` 删，合并结果干净 |
| 「挂载即非空」 | **七个表单全部安全**（本文第五节） |
| `GATE_COVERAGE` 锚点 | 存在 —— `MarketplaceTab.tsx` 的 `SECTIONS`（9 项） |
| ②b 结构性守卫 | **可做** —— `AiPromptButton` 是跨模板共享组件 |
| SeedingCandidatePicker | 不接 gate（Radix Dialog 自带焦点陷阱） |
| 「第四条继续」截断 | 在上游，不在 picker（该组件纯展示）。**记待办，未查** |
