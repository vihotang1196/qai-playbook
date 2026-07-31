-- =====================================================================
-- P0-2 · 异常扣费只读诊断 —— 2026-07-27 (UTC+8) retry bug 重复扣费核查
-- 写于 2026-07-31。在 Supabase Dashboard SQL Editor 里由账号持有人手工执行。
-- =====================================================================
--
-- 【只读保证】
-- 全文只有 SELECT。没有 INSERT / UPDATE / DELETE / TRUNCATE / MERGE /
-- CREATE / ALTER / DROP / GRANT / COPY / SELECT INTO / 函数调用副作用。
-- 执行前可以自己验：搜一遍上面这些关键字，应该只在本注释里出现。
-- 每段都用 `BEGIN; SET TRANSACTION READ ONLY;` 包住，段尾 `ROLLBACK;` ——
-- 即使某处写错，数据库层也会直接拒绝写操作。
-- 如果编辑器不接受多语句批次，就只跑中间的 SELECT，同样安全。
--
-- 【执行顺序】Q0 → Q1 先跑，把输出贴回给我。这两段是校准，不是结论。
-- 我按真实列名和符号约定把 Q2–Q6 钉死之后你再跑后面的。
-- Q2–Q6 里凡是标了 🔧 的列名都是我的假设，Q0 会告诉我们哪些要改。
--
-- 【已知盲区，SQL 已按此设计】
-- 11 个扣费的 AI 调用路径目前完全不写 operation_logs（队列④ 才补）。
-- 所以"有扣费但没日志"对这些路径是**天然状态**，不是异常。
-- 本诊断因此不把"缺日志"当主判据：
--   · 主判据 = 重复扣费指纹（同账号 / 相近时间 / 相同金额的连发）—— 完全不依赖日志
--   · 辅判据 = 产物缺失（generation_history / marketplace_history）—— 也不依赖日志
--   · "缺日志"只对 Q2 实测覆盖率高的 operation 才当信号用，覆盖率≈0 的直接归为盲区
-- 这样避免把 11 条路径的正常扣费全部报成假阳性。
--
-- 【时区】UTC+8 无夏令时，'Asia/Singapore' 与 'Asia/Shanghai' 等价，随便哪个。
-- 【单位】输出是 credits。credit → 货币 的比率我没有，金额合计要你自己乘。
-- =====================================================================


-- =====================================================================
-- Q0 · 表结构探针（先跑这个，输出贴回给我）
-- =====================================================================
BEGIN; SET TRANSACTION READ ONLY;

SELECT table_name, ordinal_position, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'token_transactions',
    'operation_logs',
    'generation_history',
    'marketplace_history',
    'app_settings',
    'sub_accounts'
  )
ORDER BY table_name, ordinal_position;

ROLLBACK;
-- 关键要看的三件事：
--   a) token_transactions 的金额列叫什么（delta? amount? change? credits?）
--   b) created_at 是 timestamptz 还是 timestamp。如果是不带时区的 timestamp，
--      下面所有 `AT TIME ZONE` 的方向都要改，别自己改，告诉我
--   c) 有没有 operation / reason / type / description 之类的分类列，以及
--      有没有指回产物的外键（有的话就不用靠时间邻近关联了，精度高得多）


-- =====================================================================
-- Q1 · 符号约定 + 计费开关校准（先跑这个，输出贴回给我）
-- =====================================================================
BEGIN; SET TRANSACTION READ ONLY;

-- Q1a：消耗是负数还是正数？如果搞反了，后面所有 `delta < 0` 都是错的。
SELECT
  CASE WHEN delta < 0 THEN 'negative' WHEN delta > 0 THEN 'positive' ELSE 'zero' END AS sign,  -- 🔧 delta
  count(*)                                        AS rows,
  min(delta)                                      AS min_delta,                                -- 🔧
  max(delta)                                      AS max_delta,                                -- 🔧
  min(created_at)                                 AS first_seen,
  max(created_at)                                 AS last_seen
FROM public.token_transactions
WHERE created_at >= '2026-06-09'::date            -- billing_enabled 生效起点
GROUP BY 1
ORDER BY rows DESC;

-- Q1b：分类列有哪些取值、各自的典型金额。看清"一次生成扣多少"的基线。
SELECT
  operation                                       AS op,                                       -- 🔧
  count(*)                                        AS rows,
  count(DISTINCT abs(delta))                      AS distinct_amounts,                          -- 🔧
  mode() WITHIN GROUP (ORDER BY abs(delta))       AS typical_amount,                            -- 🔧
  sum(abs(delta))                                 AS total_credits                              -- 🔧
FROM public.token_transactions
WHERE created_at >= '2026-06-09'::date
  AND delta < 0                                                                                 -- 🔧
GROUP BY 1
ORDER BY rows DESC;

-- Q1c：billing_enabled 当时确实是 true。你已确认过，这里留个书面证据。
-- app_settings 若是 key/value 结构，用第一条；若是宽表列，用第二条（择一，另一条会报错，正常）。
SELECT * FROM public.app_settings;

ROLLBACK;


-- =====================================================================
-- Q2 · 日志覆盖率基线 —— 把「11 条无日志路径」和「真异常」分开的那把尺子
--       不硬编码那 11 条，实测每个 operation 历史上到底写不写日志。
-- =====================================================================
BEGIN; SET TRANSACTION READ ONLY;

WITH charges AS (
  SELECT t.id, t.sub_account_id, t.created_at,
         t.operation AS op,                                                                      -- 🔧
         abs(t.delta) AS amt                                                                     -- 🔧
  FROM public.token_transactions t
  WHERE t.created_at >= '2026-06-09'::date        -- 整个计费期当基线，样本够大才可信
    AND t.delta < 0                                                                              -- 🔧
),
matched AS (
  SELECT c.*,
         EXISTS (
           SELECT 1 FROM public.operation_logs l
           WHERE l.sub_account_id = c.sub_account_id
             AND l.created_at BETWEEN c.created_at - interval '2 minutes'
                                  AND c.created_at + interval '10 minutes'
         ) AS has_log
  FROM charges c
)
SELECT
  op,
  count(*)                                                        AS charges,
  count(*) FILTER (WHERE has_log)                                 AS with_log,
  round(100.0 * count(*) FILTER (WHERE has_log) / count(*), 1)     AS log_coverage_pct,
  CASE
    WHEN 100.0 * count(*) FILTER (WHERE has_log) / count(*) <  5 THEN 'BLIND SPOT — 缺日志无信息量，只看重复指纹和产物'
    WHEN 100.0 * count(*) FILTER (WHERE has_log) / count(*) > 80 THEN 'LOGGED — 缺日志是真信号'
    ELSE                                                              'MIXED — 缺日志仅供参考，别单独下结论'
  END                                                             AS verdict
FROM matched
GROUP BY op
ORDER BY charges DESC;

ROLLBACK;
-- 预期：这里应该正好浮现出一批 coverage ≈ 0 的 operation。
-- 它们就是队列④ 要补日志的那 11 条。数量对不上（不是 11）本身就是个发现。


-- =====================================================================
-- Q3 · 主判据：重复扣费指纹
--       同 sub_account_id + 相同金额 + 相同 operation，且时间连发成簇。
--       这是 7-27 那个 bug 的行为签名：界面无反应 → 用户重复点。
--       完全不依赖 operation_logs，所以 11 条盲区路径在这里照样测得出。
-- =====================================================================
BEGIN; SET TRANSACTION READ ONLY;

WITH cfg AS (
  SELECT 'Asia/Singapore'::text            AS tz,
         '2026-07-26 00:00'::timestamp     AS win_start_local,   -- 7-27 前后各留一天
         '2026-07-29 00:00'::timestamp     AS win_end_local,
         600::int                          AS cluster_gap_seconds -- 间隔 ≤10 分钟算同一簇
),
tx AS (
  SELECT t.id, t.sub_account_id, t.created_at,
         t.operation AS op,                                                                      -- 🔧
         abs(t.delta) AS amt                                                                     -- 🔧
  FROM public.token_transactions t CROSS JOIN cfg
  WHERE t.created_at >= (cfg.win_start_local AT TIME ZONE cfg.tz)
    AND t.created_at <  (cfg.win_end_local   AT TIME ZONE cfg.tz)
    AND t.delta < 0                                                                              -- 🔧
),
gapped AS (
  SELECT tx.*,
         CASE
           WHEN extract(epoch FROM (
                  tx.created_at - lag(tx.created_at) OVER (
                    PARTITION BY tx.sub_account_id, tx.op, tx.amt ORDER BY tx.created_at)
                )) <= (SELECT cluster_gap_seconds FROM cfg)
           THEN 0 ELSE 1
         END AS starts_cluster
  FROM tx
),
clustered AS (
  SELECT gapped.*,
         sum(starts_cluster) OVER (
           PARTITION BY sub_account_id, op, amt ORDER BY created_at
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cluster_no
  FROM gapped
)
SELECT
  c.sub_account_id,
  c.op,
  c.amt                                                          AS amount_each,
  count(*)                                                       AS charge_count,
  (min(c.created_at) AT TIME ZONE cfg.tz)                        AS first_local,
  (max(c.created_at) AT TIME ZONE cfg.tz)                        AS last_local,
  extract(epoch FROM (max(c.created_at) - min(c.created_at)))::int AS span_seconds,
  count(*) * c.amt                                               AS credits_charged,
  (count(*) - 1) * c.amt                                         AS credits_excess_if_one_expected,
  array_agg(c.id ORDER BY c.created_at)                          AS tx_ids
FROM clustered c CROSS JOIN cfg
GROUP BY c.sub_account_id, c.op, c.amt, c.cluster_no, cfg.tz
HAVING count(*) > 1
ORDER BY charge_count DESC, credits_charged DESC;

ROLLBACK;
-- 读法：`charge_count` 3、`span_seconds` 40 → 40 秒内同一账号同一操作扣了三次同样的钱。
-- 这就是"点了没反应、又点"。`credits_excess_if_one_expected` 是**假设本应只扣一次**
-- 的溢出额；真实应扣次数由 Q4 的产物数决定，别直接当结论。


-- =====================================================================
-- Q3b · 放宽版：同账号同 operation 的急促连发，金额允许不同
--        分段生成时每段金额可能不一样，Q3 的"相同金额"会漏掉这种。
-- =====================================================================
BEGIN; SET TRANSACTION READ ONLY;

WITH cfg AS (
  SELECT 'Asia/Singapore'::text        AS tz,
         '2026-07-26 00:00'::timestamp AS win_start_local,
         '2026-07-29 00:00'::timestamp AS win_end_local,
         120::int                      AS cluster_gap_seconds  -- 收紧到 2 分钟，抑制噪声
),
tx AS (
  SELECT t.id, t.sub_account_id, t.created_at,
         t.operation AS op, abs(t.delta) AS amt                                                  -- 🔧 🔧
  FROM public.token_transactions t CROSS JOIN cfg
  WHERE t.created_at >= (cfg.win_start_local AT TIME ZONE cfg.tz)
    AND t.created_at <  (cfg.win_end_local   AT TIME ZONE cfg.tz)
    AND t.delta < 0                                                                              -- 🔧
),
gapped AS (
  SELECT tx.*,
         CASE WHEN extract(epoch FROM (
                tx.created_at - lag(tx.created_at) OVER (
                  PARTITION BY tx.sub_account_id, tx.op ORDER BY tx.created_at)
              )) <= (SELECT cluster_gap_seconds FROM cfg)
              THEN 0 ELSE 1 END AS starts_cluster
  FROM tx
),
clustered AS (
  SELECT gapped.*,
         sum(starts_cluster) OVER (PARTITION BY sub_account_id, op ORDER BY created_at
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cluster_no
  FROM gapped
)
SELECT
  c.sub_account_id, c.op,
  count(*)                                                       AS charge_count,
  count(DISTINCT c.amt)                                          AS distinct_amounts,
  (min(c.created_at) AT TIME ZONE cfg.tz)                        AS first_local,
  extract(epoch FROM (max(c.created_at) - min(c.created_at)))::int AS span_seconds,
  sum(c.amt)                                                     AS credits_charged,
  array_agg(c.amt ORDER BY c.created_at)                         AS amounts_in_order
FROM clustered c CROSS JOIN cfg
GROUP BY c.sub_account_id, c.op, c.cluster_no, cfg.tz
HAVING count(*) > 2                    -- 3 次起，2 次在分段场景下太常见
ORDER BY charge_count DESC, credits_charged DESC;

ROLLBACK;


-- =====================================================================
-- Q4 · 扣费 ↔ 产物 对账：把"扣了几次"和"真做出几个东西"摆在一起
--       这是判定溢出额的**正确依据**（Q3 的 count-1 只是占位假设）。
--       靠时间邻近关联；Q0 若发现有外键，告诉我，我改成精确 join。
-- =====================================================================
BEGIN; SET TRANSACTION READ ONLY;

WITH cfg AS (
  SELECT 'Asia/Singapore'::text        AS tz,
         '2026-07-26 00:00'::timestamp AS win_start_local,
         '2026-07-29 00:00'::timestamp AS win_end_local,
         600::int                      AS cluster_gap_seconds
),
tx AS (
  SELECT t.id, t.sub_account_id, t.created_at,
         t.operation AS op, abs(t.delta) AS amt                                                  -- 🔧 🔧
  FROM public.token_transactions t CROSS JOIN cfg
  WHERE t.created_at >= (cfg.win_start_local AT TIME ZONE cfg.tz)
    AND t.created_at <  (cfg.win_end_local   AT TIME ZONE cfg.tz)
    AND t.delta < 0                                                                              -- 🔧
),
gapped AS (
  SELECT tx.*,
         CASE WHEN extract(epoch FROM (
                tx.created_at - lag(tx.created_at) OVER (
                  PARTITION BY tx.sub_account_id, tx.op, tx.amt ORDER BY tx.created_at)
              )) <= (SELECT cluster_gap_seconds FROM cfg)
              THEN 0 ELSE 1 END AS starts_cluster
  FROM tx
),
clustered AS (
  SELECT gapped.*,
         sum(starts_cluster) OVER (PARTITION BY sub_account_id, op, amt ORDER BY created_at
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cluster_no
  FROM gapped
),
clusters AS (
  SELECT sub_account_id, op, amt, cluster_no,
         count(*)          AS charge_count,
         min(created_at)   AS t_start,
         max(created_at)   AS t_end,
         count(*) * amt    AS credits_charged
  FROM clustered
  GROUP BY sub_account_id, op, amt, cluster_no
),
artifacts AS (
  SELECT sub_account_id, created_at, 'generation'::text  AS src FROM public.generation_history
  UNION ALL
  SELECT sub_account_id, created_at, 'marketplace'::text AS src FROM public.marketplace_history
)
SELECT
  k.sub_account_id,
  k.op,
  k.amt                                        AS amount_each,
  k.charge_count,
  (k.t_start AT TIME ZONE cfg.tz)              AS first_local,
  k.credits_charged,
  a.artifact_count,
  greatest(k.charge_count - a.artifact_count, 0)              AS excess_charges,
  greatest(k.charge_count - a.artifact_count, 0) * k.amt      AS credits_no_product,
  l.log_count,
  CASE
    WHEN a.artifact_count = 0 AND k.charge_count > 1 THEN 'A · 连发且零产物 —— 最强候选'
    WHEN a.artifact_count < k.charge_count          THEN 'B · 产物少于扣费次数 —— 候选'
    WHEN a.artifact_count >= k.charge_count         THEN 'C · 产物齐 —— 正常（多段生成本就多次扣费）'
  END                                          AS classification
FROM clusters k
CROSS JOIN cfg
LEFT JOIN LATERAL (
  SELECT count(*) AS artifact_count
  FROM artifacts x
  WHERE x.sub_account_id = k.sub_account_id
    AND x.created_at BETWEEN k.t_start - interval '2 minutes'
                         AND k.t_end   + interval '30 minutes'   -- 视频段落出片慢，窗口给宽
) a ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS log_count
  FROM public.operation_logs g
  WHERE g.sub_account_id = k.sub_account_id
    AND g.created_at BETWEEN k.t_start - interval '2 minutes'
                         AND k.t_end   + interval '30 minutes'
) l ON true
WHERE k.charge_count > 1
ORDER BY excess_charges DESC, credits_no_product DESC;

ROLLBACK;
-- `log_count` 只作参考栏，不参与 classification —— 因为那 11 条路径本来就是 0。
-- 拿它和 Q2 的 verdict 对着看：Q2 说 LOGGED 的 operation 这里 log_count=0，那是额外线索；
-- Q2 说 BLIND SPOT 的，log_count=0 什么都不说明。


-- =====================================================================
-- Q5 · 退款净额：已经退过的不算损失。不做这一步会高估。
-- =====================================================================
BEGIN; SET TRANSACTION READ ONLY;

WITH cfg AS (
  SELECT 'Asia/Singapore'::text        AS tz,
         '2026-07-26 00:00'::timestamp AS win_start_local,
         '2026-07-29 00:00'::timestamp AS win_end_local
),
w AS (
  SELECT (win_start_local AT TIME ZONE tz) AS t0,
         (win_end_local   AT TIME ZONE tz) AS t1, tz FROM cfg
)
SELECT
  t.sub_account_id,
  sum(abs(t.delta)) FILTER (WHERE t.delta < 0 AND t.created_at >= w.t0 AND t.created_at < w.t1) AS consumed_in_window,   -- 🔧
  count(*)          FILTER (WHERE t.delta < 0 AND t.created_at >= w.t0 AND t.created_at < w.t1) AS consume_rows,          -- 🔧
  sum(t.delta)      FILTER (WHERE t.delta > 0 AND t.created_at >= w.t0)                         AS credited_since_window, -- 🔧
  count(*)          FILTER (WHERE t.delta > 0 AND t.created_at >= w.t0)                         AS credit_rows            -- 🔧
FROM public.token_transactions t CROSS JOIN w
WHERE t.created_at >= w.t0
GROUP BY t.sub_account_id
HAVING sum(abs(t.delta)) FILTER (WHERE t.delta < 0 AND t.created_at >= w.t0 AND t.created_at < w.t1) > 0                  -- 🔧
ORDER BY consumed_in_window DESC;

ROLLBACK;
-- ⚠️ 这是**账号级上限净额**，不是逐笔配对。正数流水里可能混着充值、
-- 促销赠送、人工补偿，不全是退款。Q1b 的分类列若能区分 refund 和 topup，
-- 告诉我，我改成只算退款。在那之前：`credited_since_window > 0` 的账号
-- 要人工翻一眼，别直接从损失里减掉。


-- =====================================================================
-- Q6 · 汇总：笔数 + credits 合计（分档，别把三档加成一个数）
-- =====================================================================
BEGIN; SET TRANSACTION READ ONLY;

-- 结构同 Q4，只在末尾改成聚合。Q4 的列名确认后我把这段和 Q4 合成一个视图式查询，
-- 现在先保持两段独立，方便你逐档核对再汇总。
WITH cfg AS (
  SELECT 'Asia/Singapore'::text        AS tz,
         '2026-07-26 00:00'::timestamp AS win_start_local,
         '2026-07-29 00:00'::timestamp AS win_end_local,
         600::int                      AS cluster_gap_seconds
),
tx AS (
  SELECT t.id, t.sub_account_id, t.created_at,
         t.operation AS op, abs(t.delta) AS amt                                                  -- 🔧 🔧
  FROM public.token_transactions t CROSS JOIN cfg
  WHERE t.created_at >= (cfg.win_start_local AT TIME ZONE cfg.tz)
    AND t.created_at <  (cfg.win_end_local   AT TIME ZONE cfg.tz)
    AND t.delta < 0                                                                              -- 🔧
),
gapped AS (
  SELECT tx.*,
         CASE WHEN extract(epoch FROM (
                tx.created_at - lag(tx.created_at) OVER (
                  PARTITION BY tx.sub_account_id, tx.op, tx.amt ORDER BY tx.created_at)
              )) <= (SELECT cluster_gap_seconds FROM cfg)
              THEN 0 ELSE 1 END AS starts_cluster
  FROM tx
),
clustered AS (
  SELECT gapped.*,
         sum(starts_cluster) OVER (PARTITION BY sub_account_id, op, amt ORDER BY created_at
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cluster_no
  FROM gapped
),
clusters AS (
  SELECT sub_account_id, op, amt, cluster_no,
         count(*) AS charge_count, min(created_at) AS t_start, max(created_at) AS t_end
  FROM clustered GROUP BY sub_account_id, op, amt, cluster_no
),
artifacts AS (
  SELECT sub_account_id, created_at FROM public.generation_history
  UNION ALL
  SELECT sub_account_id, created_at FROM public.marketplace_history
),
scored AS (
  SELECT k.*,
         a.artifact_count,
         greatest(k.charge_count - a.artifact_count, 0) AS excess_charges,
         CASE
           WHEN a.artifact_count = 0 AND k.charge_count > 1 THEN 'A_burst_no_product'
           WHEN a.artifact_count < k.charge_count          THEN 'B_partial'
           ELSE                                                 'C_ok'
         END AS tier
  FROM clusters k
  LEFT JOIN LATERAL (
    SELECT count(*) AS artifact_count FROM artifacts x
    WHERE x.sub_account_id = k.sub_account_id
      AND x.created_at BETWEEN k.t_start - interval '2 minutes'
                           AND k.t_end   + interval '30 minutes'
  ) a ON true
  WHERE k.charge_count > 1
)
SELECT
  tier,
  count(*)                              AS clusters,
  count(DISTINCT sub_account_id)         AS accounts_affected,
  sum(charge_count)                      AS total_charge_rows,
  sum(excess_charges)                    AS excess_charge_rows,
  sum(excess_charges * amt)              AS credits_at_risk
FROM scored
GROUP BY tier
ORDER BY tier;

ROLLBACK;
-- 报给我：A 档的 `excess_charge_rows` 和 `credits_at_risk` 是可主张的重复扣费；
-- B 档要人工看；C 档不是问题。三档分开报，别合成一个数 —— A 是结论，B 是待查。


-- =====================================================================
-- 后续（等 Q0/Q1 输出回来我再补）
-- · 列名钉死，去掉所有 🔧
-- · 有外键就把时间邻近关联换成精确 join，excess 的精度会从"估"变成"准"
-- · Q1b 能区分 refund / topup 的话，Q5 改成只净退款
-- · A 档账号的逐笔时间线（给客服解释和退款用）
-- =====================================================================
