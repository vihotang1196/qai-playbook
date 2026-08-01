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
| 6 | AIDA Ad | `section-6` | `aida-storyboard` | AidaStoryboardPack | AidaStoryboardForm | 待填 | ❌ |
| 7 | Product Branding | `section-7` | `product-branding` | ProductBrandingPack | ProductBrandingForm | 特色 / 材质 AI-polish（一次一个 active suggestion） | ❌ |
| 8 | Unboxing ASMR | `section-8` | `unboxing-asmr` | UnboxingAsmrPack | ⚠️ **无 Form，内联** | `AiAutofillButton`（带 fields override） | ❌ |
| 9 | AIDA + AI Character | `section-9` | `aida-character` | AidaCharacterPack | AidaCharacterForm | 待填 | ❌ |

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

## 五、顺带产出：F 节 `vh` / `vw` 清单（只报告）

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

**系统性偏差：所有弹窗高度上限都比设计值紧 25%。** 不是本单范围，但值得单开一单。

---

## 六、还没填满的（需要继续）

- 模板 6 / 9（AidaStoryboard / AidaCharacter）的 AI 面板逐个列
- 每个面板的 `active` 条件（`previewUrl !== null` / `result !== null` 形式）
- **每个面板的「挂载即非空？」** —— 决定各表单要不要各加一道 result 清零
- 每处的 dim 标记数（对齐 ~41 这个估计）
- 合并进度框的位置
- 「按钮 spinner vs 框」的逐个判定
