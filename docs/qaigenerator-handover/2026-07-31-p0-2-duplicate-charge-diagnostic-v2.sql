-- =====================================================================
-- P0-2 · 异常扣费只读诊断 v2 —— 2026-07-27 (UTC+8) 重复扣费核查
-- 2026-07-31 重写。在 Supabase Dashboard SQL Editor 由账号持有人手工执行。
--
-- v2 相对 v1 的关键改动（因为 #672 根因查明了）：
--   根因：点 retry 毫无反应时，生成【实际已提交并完成扣费】，状态写进了已卸载的
--         组件所以界面无显示 → 用户重复点 → 重复扣费。
--   ⇒ 每次重复点击【都产出了真实产物】，产物数 = 扣费数。
--   ⇒ v1 把「产物齐」判为正常（多段生成本就多次扣费），会把要找的东西直接过滤掉。
--   ⇒ v2 的判据改成：产物是否【指向同一个目标】。
--        同目标多份  = 重复扣费（#672 签名）
--        不同目标    = 合法多段生成
-- =====================================================================
--
-- 【只读保证】
-- 全文只有 SELECT。没有 INSERT / UPDATE / DELETE / TRUNCATE / MERGE /
-- CREATE / ALTER / DROP / GRANT / COPY / SELECT INTO。
-- 执行前可自验：搜上面这些关键字，应只在本注释里出现。
-- 每段用 `BEGIN; SET TRANSACTION READ ONLY;` 包住，段尾 `ROLLBACK;` ——
-- 即使某处写错，数据库层也会直接拒绝写操作。
-- 编辑器不接受多语句批次的话，只跑中间的 SELECT，同样安全。
--
-- 【已知盲区，v2 的处理方式】
-- 11 个直连 LLM 的扣费路径完全不写 operation_logs（队列④才补）。
-- v2 【根本不用 operation_logs 做判据】：
--   主判据 = 扣费连发指纹（同账号 / 相近时间 / 相同金额）—— 不依赖日志
--   辅判据 = 产物目标是否重复                          —— 不依赖日志
--   operation_logs 只作【注释栏】，Q2 量出每个 operation 的日志覆盖率，
--   用来解释「这条为什么没日志」，不参与分类。
-- 所以那 11 条路径的正常扣费不会因为缺日志被报成假阳性。
--
-- 【时区】UTC+8 无夏令时，'Asia/Singapore' 与 'Asia/Shanghai' 等价。
-- 【单位】输出是 credits。credit → 货币的比率我没有，金额合计要自己乘。
--
-- 【执行顺序】Q0 先跑，把输出贴回来。Q3 之后需要「目标标识列」的真实列名，
-- 那个列是 v2 的核心，没有它 Q4/Q5 只能退化成时间邻近估算。
-- =====================================================================


-- =====================================================================
-- Q0 · 表结构 + 外键 + 约束（先跑这个，输出贴回来）
-- =====================================================================
BEGIN; SET TRANSACTION READ ONLY;

-- Q0a 列清单
SELECT table_name, ordinal_position, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('token_transactions','operation_logs',
                     'generation_history','marketplace_history',
                     'app_settings','sub_accounts')
ORDER BY table_name, ordinal_position;

-- Q0b 外键 —— 这是本次最值钱的一条。
-- 有外键 ⇒ Q4/Q5 用精确 join，结论从「估」变「准」；没有 ⇒ 只能靠时间邻近。
SELECT
  tc.table_name        AS from_table,
  kcu.column_name      AS from_column,
  ccu.table_name       AS to_table,
  ccu.column_name      AS to_column,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND (tc.table_name IN ('token_transactions','operation_logs',
                         'generation_history','marketplace_history')
    OR ccu.table_name IN ('token_transactions','operation_logs',
                          'generation_history','marketplace_history'))
ORDER BY from_table, from_column;

-- Q0c CHECK 约束 + 枚举 —— 顺带把队列④ 要确认的那件事一起答了
-- （新 operation 值在数据库层有没有 CHECK 约束，有就要先跑迁移）
SELECT rel.relname AS table_name, con.conname AS constraint_name,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = rel.relnamespace
WHERE ns.nspname = 'public' AND con.contype = 'c'
  AND rel.relname IN ('token_transactions','operation_logs',
                      'generation_history','marketplace_history')
ORDER BY table_name, constraint_name;

SELECT t.typname AS enum_type, e.enumsortorder AS ord, e.enumlabel AS value
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
ORDER BY enum_type, ord;

ROLLBACK;

-- 我需要从 Q0 得到的四件事：
--   a) token_transactions 的金额列名（delta? amount? change? credits?）与分类列名
--   b) created_at 是 timestamptz 还是 timestamp（后者所有时区换算方向都要改）
--   c) ⚠️【目标标识列】—— generation_history / marketplace_history 里
--      「这一行是为哪个东西生成的」是哪一列：task_id / parent_id / job_id /
--      segment_index / prompt_hash / target_id 之类。
--      v2 的核心判据靠它：同目标多份 = 重复；不同目标 = 合法多段。
--   d) 有没有从 token_transactions 指向产物表的外键


-- =====================================================================
-- Q1 · 符号约定 + 计费开关（先跑这个，输出贴回来）
-- =====================================================================
BEGIN; SET TRANSACTION READ ONLY;

-- Q1a 消耗是负数还是正数？搞反了后面全错。
SELECT
  CASE WHEN delta < 0 THEN 'negative' WHEN delta > 0 THEN 'positive' ELSE 'zero' END AS sign, -- 🔧 delta
  count(*) AS rows, min(delta) AS min_delta, max(delta) AS max_delta,                          -- 🔧
  min(created_at) AS first_seen, max(created_at) AS last_seen
FROM public.token_transactions
WHERE created_at >= '2026-06-09'::date          -- billing_enabled 生效起点
GROUP BY 1 ORDER BY rows DESC;

-- Q1b 分类列取值 + 典型金额（看清"一次生成扣多少"的基线）
SELECT operation AS op,                                                                        -- 🔧
       count(*) AS rows,
       count(DISTINCT abs(delta)) AS distinct_amounts,                                         -- 🔧
       mode() WITHIN GROUP (ORDER BY abs(delta)) AS typical_amount,                            -- 🔧
       sum(abs(delta)) AS total_credits                                                        -- 🔧
FROM public.token_transactions
WHERE created_at >= '2026-06-09'::date AND delta < 0                                           -- 🔧
GROUP BY 1 ORDER BY rows DESC;

-- Q1c billing_enabled 书面证据（key/value 结构就看这张表全量）
SELECT * FROM public.app_settings;

ROLLBACK;


-- =====================================================================
-- Q2 · 日志覆盖率基线 —— 只做注释栏，不参与分类
--       目的：解释「这条为什么没日志」，并顺带浮现那 11 条盲区路径。
-- =====================================================================
BEGIN; SET TRANSACTION READ ONLY;

WITH charges AS (
  SELECT t.id, t.sub_account_id, t.created_at, t.operation AS op                               -- 🔧
  FROM public.token_transactions t
  WHERE t.created_at >= '2026-06-09'::date AND t.delta < 0                                     -- 🔧
),
matched AS (
  SELECT c.*, EXISTS (
    SELECT 1 FROM public.operation_logs l
    WHERE l.sub_account_id = c.sub_account_id
      AND l.created_at BETWEEN c.created_at - interval '2 minutes'
                           AND c.created_at + interval '10 minutes'
  ) AS has_log
  FROM charges c
)
SELECT op,
       count(*)                                                    AS charges,
       count(*) FILTER (WHERE has_log)                             AS with_log,
       round(100.0 * count(*) FILTER (WHERE has_log) / count(*), 1) AS log_coverage_pct,
       CASE
         WHEN 100.0 * count(*) FILTER (WHERE has_log) / count(*) < 5
           THEN 'BLIND SPOT — 队列④ 要补日志的路径之一，缺日志属正常'
         WHEN 100.0 * count(*) FILTER (WHERE has_log) / count(*) > 80
           THEN 'LOGGED — 这类缺日志才异常'
         ELSE 'MIXED'
       END                                                         AS note
FROM matched GROUP BY op ORDER BY charges DESC;

ROLLBACK;
-- 预期浮现一批 coverage ≈ 0 的 operation，就是队列④ 的那 11 条。
-- 数量不是 11 本身就是个发现。


-- =====================================================================
-- Q3 · 主判据：扣费连发指纹（不依赖任何日志）
--       同 sub_account_id + 相同金额 + 相同 operation，时间上连成一簇。
--       这是「界面没反应 → 用户重复点」的行为签名。
-- =====================================================================
BEGIN; SET TRANSACTION READ ONLY;

WITH cfg AS (
  SELECT 'Asia/Singapore'::text        AS tz,
         '2026-07-26 00:00'::timestamp AS win_start_local,   -- 7-27 前后各留一天
         '2026-07-29 00:00'::timestamp AS win_end_local,
         600::int                      AS cluster_gap_seconds
),
tx AS (
  SELECT t.id, t.sub_account_id, t.created_at,
         t.operation AS op, abs(t.delta) AS amt                                                -- 🔧 🔧
  FROM public.token_transactions t CROSS JOIN cfg
  WHERE t.created_at >= (cfg.win_start_local AT TIME ZONE cfg.tz)
    AND t.created_at <  (cfg.win_end_local   AT TIME ZONE cfg.tz)
    AND t.delta < 0                                                                            -- 🔧
),
gapped AS (
  SELECT tx.*, CASE WHEN extract(epoch FROM (
           tx.created_at - lag(tx.created_at) OVER (
             PARTITION BY tx.sub_account_id, tx.op, tx.amt ORDER BY tx.created_at)
         )) <= (SELECT cluster_gap_seconds FROM cfg) THEN 0 ELSE 1 END AS starts_cluster
  FROM tx
),
clustered AS (
  SELECT gapped.*, sum(starts_cluster) OVER (
           PARTITION BY sub_account_id, op, amt ORDER BY created_at
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cluster_no
  FROM gapped
)
SELECT c.sub_account_id, c.op, c.amt AS amount_each,
       count(*)                                                        AS charge_count,
       (min(c.created_at) AT TIME ZONE cfg.tz)                         AS first_local,
       (max(c.created_at) AT TIME ZONE cfg.tz)                         AS last_local,
       extract(epoch FROM (max(c.created_at) - min(c.created_at)))::int AS span_seconds,
       count(*) * c.amt                                                AS credits_charged,
       array_agg(c.id ORDER BY c.created_at)                           AS tx_ids
FROM clustered c CROSS JOIN cfg
GROUP BY c.sub_account_id, c.op, c.amt, c.cluster_no, cfg.tz
HAVING count(*) > 1
ORDER BY charge_count DESC, credits_charged DESC;

ROLLBACK;
-- 读法：charge_count=4、span_seconds=35 → 35 秒内同账号同操作扣了四次同样的钱。
-- 这就是"点了没反应、又点"。真实溢出额由 Q4 的目标去重决定，不要直接用 count-1。


-- =====================================================================
-- Q4 · ⚠️ v2 的核心：产物【目标】是否重复
--       #672 的重复点击每次都真的做出了产物，所以不能靠"有没有产物"判断，
--       要看这些产物是不是【同一个目标的多份】。
--
-- 🔧 必须先把 TARGET_COL 换成 Q0c 找到的真实列名再跑。
--    换之前这段跑不出正确结论 —— 不要拿它的输出下判断。
-- =====================================================================
BEGIN; SET TRANSACTION READ ONLY;

WITH cfg AS (
  SELECT 'Asia/Singapore'::text        AS tz,
         '2026-07-26 00:00'::timestamp AS win_start_local,
         '2026-07-29 00:00'::timestamp AS win_end_local,
         600::int                      AS cluster_gap_seconds
),
tx AS (
  SELECT t.id, t.sub_account_id, t.created_at, t.operation AS op, abs(t.delta) AS amt          -- 🔧 🔧
  FROM public.token_transactions t CROSS JOIN cfg
  WHERE t.created_at >= (cfg.win_start_local AT TIME ZONE cfg.tz)
    AND t.created_at <  (cfg.win_end_local   AT TIME ZONE cfg.tz)
    AND t.delta < 0                                                                            -- 🔧
),
gapped AS (
  SELECT tx.*, CASE WHEN extract(epoch FROM (
           tx.created_at - lag(tx.created_at) OVER (
             PARTITION BY tx.sub_account_id, tx.op, tx.amt ORDER BY tx.created_at)
         )) <= (SELECT cluster_gap_seconds FROM cfg) THEN 0 ELSE 1 END AS starts_cluster
  FROM tx
),
clustered AS (
  SELECT gapped.*, sum(starts_cluster) OVER (
           PARTITION BY sub_account_id, op, amt ORDER BY created_at
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cluster_no
  FROM gapped
),
clusters AS (
  SELECT sub_account_id, op, amt, cluster_no,
         count(*) AS charge_count, min(created_at) AS t_start, max(created_at) AS t_end,
         count(*) * amt AS credits_charged
  FROM clustered GROUP BY sub_account_id, op, amt, cluster_no
),
artifacts AS (
  -- 🔧 把 TARGET_COL 换成真实列名（task_id / parent_id / job_id / segment_index …）
  SELECT sub_account_id, created_at, TARGET_COL::text AS target, 'generation'::text  AS src
  FROM public.generation_history
  UNION ALL
  SELECT sub_account_id, created_at, TARGET_COL::text AS target, 'marketplace'::text AS src
  FROM public.marketplace_history
)
SELECT
  k.sub_account_id, k.op, k.amt AS amount_each, k.charge_count,
  (k.t_start AT TIME ZONE cfg.tz)   AS first_local,
  k.credits_charged,
  a.artifact_count,
  a.distinct_targets,
  -- 同一目标被做了几份多余的
  greatest(a.artifact_count - a.distinct_targets, 0)          AS duplicate_artifacts,
  greatest(a.artifact_count - a.distinct_targets, 0) * k.amt  AS credits_duplicated,
  l.log_count,                                                -- 注释栏，不参与分类
  CASE
    WHEN a.artifact_count IS NULL OR a.distinct_targets IS NULL
      THEN 'D · 无法判定（缺目标列或关联不上）'
    WHEN a.artifact_count > a.distinct_targets
      THEN 'A · 同目标多份 —— 重复扣费（#672 签名）'
    WHEN a.artifact_count = 0
      THEN 'B · 扣了费零产物 —— 另一种故障，单独看'
    WHEN a.artifact_count < k.charge_count
      THEN 'B · 产物少于扣费次数 —— 单独看'
    ELSE 'C · 目标各不相同 —— 合法多段生成'
  END AS classification
FROM clusters k
CROSS JOIN cfg
LEFT JOIN LATERAL (
  SELECT count(*) AS artifact_count, count(DISTINCT x.target) AS distinct_targets
  FROM artifacts x
  WHERE x.sub_account_id = k.sub_account_id
    AND x.created_at BETWEEN k.t_start - interval '2 minutes'
                         AND k.t_end   + interval '30 minutes'   -- 视频出片慢，窗口给宽
) a ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS log_count FROM public.operation_logs g
  WHERE g.sub_account_id = k.sub_account_id
    AND g.created_at BETWEEN k.t_start - interval '2 minutes'
                         AND k.t_end   + interval '30 minutes'
) l ON true
WHERE k.charge_count > 1
ORDER BY duplicate_artifacts DESC, credits_duplicated DESC;

ROLLBACK;
-- ⚠️ A 档才是 #672 的重复扣费。v1 会把这些误判成 C 档「正常」。
-- log_count 只是参考：Q2 标了 BLIND SPOT 的 operation，这里 log_count=0 不说明任何问题。


-- =====================================================================
-- Q5 · #672 专属签名：retry 的目标此前已有失败记录
--       retry 按钮是从失败日志点进去的，所以重复扣费的目标应该先有一次失败。
--       这条能把「retry 重复扣费」和「首次生成时手抖点两下」分开。
-- 🔧 需要 TARGET_COL 和产物表的状态列名。
-- =====================================================================
BEGIN; SET TRANSACTION READ ONLY;

WITH cfg AS (
  SELECT 'Asia/Singapore'::text        AS tz,
         '2026-07-26 00:00'::timestamp AS win_start_local,
         '2026-07-29 00:00'::timestamp AS win_end_local
),
w AS (SELECT (win_start_local AT TIME ZONE tz) AS t0,
             (win_end_local   AT TIME ZONE tz) AS t1, tz FROM cfg),
art AS (
  SELECT sub_account_id, created_at, TARGET_COL::text AS target, status                         -- 🔧 🔧
  FROM public.generation_history
  UNION ALL
  SELECT sub_account_id, created_at, TARGET_COL::text AS target, status                         -- 🔧 🔧
  FROM public.marketplace_history
)
SELECT
  a.sub_account_id,
  a.target,
  count(*)                                                          AS attempts,
  count(*) FILTER (WHERE a.status IN ('failed','error'))             AS failed_attempts,        -- 🔧 状态取值
  count(*) FILTER (WHERE a.status NOT IN ('failed','error'))         AS ok_attempts,            -- 🔧
  (min(a.created_at) AT TIME ZONE w.tz)                              AS first_local,
  (max(a.created_at) AT TIME ZONE w.tz)                              AS last_local,
  extract(epoch FROM (max(a.created_at) - min(a.created_at)))::int    AS span_seconds
FROM art a CROSS JOIN w
WHERE a.created_at >= w.t0 AND a.created_at < w.t1
GROUP BY a.sub_account_id, a.target, w.tz
HAVING count(*) FILTER (WHERE a.status IN ('failed','error')) >= 1                              -- 🔧
   AND count(*) FILTER (WHERE a.status NOT IN ('failed','error')) >= 2                          -- 🔧
ORDER BY ok_attempts DESC, attempts DESC;

ROLLBACK;
-- 读法：同一个目标先失败过、随后成功了 ≥2 次 = retry 被重复点击、每次都真跑了。
-- 这是 #672 最干净的签名，和 Q4 的 A 档应该高度重合；重合度低就要查为什么。


-- =====================================================================
-- Q6 · 退款净额：已退过的不算损失，不做这一步会高估
-- =====================================================================
BEGIN; SET TRANSACTION READ ONLY;

WITH cfg AS (
  SELECT 'Asia/Singapore'::text AS tz,
         '2026-07-26 00:00'::timestamp AS win_start_local,
         '2026-07-29 00:00'::timestamp AS win_end_local
),
w AS (SELECT (win_start_local AT TIME ZONE tz) AS t0,
             (win_end_local   AT TIME ZONE tz) AS t1 FROM cfg)
SELECT t.sub_account_id,
       sum(abs(t.delta)) FILTER (WHERE t.delta < 0 AND t.created_at <  w.t1) AS consumed_in_window,  -- 🔧
       count(*)          FILTER (WHERE t.delta < 0 AND t.created_at <  w.t1) AS consume_rows,        -- 🔧
       sum(t.delta)      FILTER (WHERE t.delta > 0)                          AS credited_since,      -- 🔧
       count(*)          FILTER (WHERE t.delta > 0)                          AS credit_rows          -- 🔧
FROM public.token_transactions t CROSS JOIN w
WHERE t.created_at >= w.t0
GROUP BY t.sub_account_id
HAVING count(*) FILTER (WHERE t.delta < 0 AND t.created_at < w.t1) > 0                                -- 🔧
ORDER BY consumed_in_window DESC;

ROLLBACK;
-- ⚠️ 这是【账号级上限净额】，不是逐笔配对。正数流水里可能混着充值、促销赠送、
-- 人工补偿，不全是退款。Q1b 若能区分 refund / topup，告诉我，我改成只算退款。
-- 在那之前：credited_since > 0 的账号要人工翻一眼，别直接从损失里减掉。


-- =====================================================================
-- Q7 · 汇总：笔数 + credits 合计（分档，别把四档加成一个数）
--       结构同 Q4，末尾改成聚合。🔧 同样需要 TARGET_COL。
-- =====================================================================
BEGIN; SET TRANSACTION READ ONLY;

WITH cfg AS (
  SELECT 'Asia/Singapore'::text        AS tz,
         '2026-07-26 00:00'::timestamp AS win_start_local,
         '2026-07-29 00:00'::timestamp AS win_end_local,
         600::int                      AS cluster_gap_seconds
),
tx AS (
  SELECT t.id, t.sub_account_id, t.created_at, t.operation AS op, abs(t.delta) AS amt          -- 🔧 🔧
  FROM public.token_transactions t CROSS JOIN cfg
  WHERE t.created_at >= (cfg.win_start_local AT TIME ZONE cfg.tz)
    AND t.created_at <  (cfg.win_end_local   AT TIME ZONE cfg.tz)
    AND t.delta < 0                                                                            -- 🔧
),
gapped AS (
  SELECT tx.*, CASE WHEN extract(epoch FROM (
           tx.created_at - lag(tx.created_at) OVER (
             PARTITION BY tx.sub_account_id, tx.op, tx.amt ORDER BY tx.created_at)
         )) <= (SELECT cluster_gap_seconds FROM cfg) THEN 0 ELSE 1 END AS starts_cluster
  FROM tx
),
clustered AS (
  SELECT gapped.*, sum(starts_cluster) OVER (
           PARTITION BY sub_account_id, op, amt ORDER BY created_at
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cluster_no
  FROM gapped
),
clusters AS (
  SELECT sub_account_id, op, amt, cluster_no, count(*) AS charge_count,
         min(created_at) AS t_start, max(created_at) AS t_end
  FROM clustered GROUP BY sub_account_id, op, amt, cluster_no
),
artifacts AS (
  SELECT sub_account_id, created_at, TARGET_COL::text AS target FROM public.generation_history  -- 🔧
  UNION ALL
  SELECT sub_account_id, created_at, TARGET_COL::text AS target FROM public.marketplace_history -- 🔧
),
scored AS (
  SELECT k.*, a.artifact_count, a.distinct_targets,
         greatest(a.artifact_count - a.distinct_targets, 0) AS duplicate_artifacts,
         CASE
           WHEN a.artifact_count IS NULL OR a.distinct_targets IS NULL THEN 'D_unknown'
           WHEN a.artifact_count > a.distinct_targets                  THEN 'A_same_target_dup'
           WHEN a.artifact_count = 0                                   THEN 'B_no_product'
           WHEN a.artifact_count < k.charge_count                      THEN 'B_partial'
           ELSE                                                             'C_ok'
         END AS tier
  FROM clusters k
  LEFT JOIN LATERAL (
    SELECT count(*) AS artifact_count, count(DISTINCT x.target) AS distinct_targets
    FROM artifacts x
    WHERE x.sub_account_id = k.sub_account_id
      AND x.created_at BETWEEN k.t_start - interval '2 minutes'
                           AND k.t_end   + interval '30 minutes'
  ) a ON true
  WHERE k.charge_count > 1
)
SELECT tier,
       count(*)                            AS clusters,
       count(DISTINCT sub_account_id)       AS accounts_affected,
       sum(charge_count)                    AS total_charge_rows,
       sum(duplicate_artifacts)             AS duplicate_rows,
       sum(duplicate_artifacts * amt)       AS credits_at_risk
FROM scored GROUP BY tier ORDER BY tier;

ROLLBACK;
-- 报给我：
--   A 档 = 可主张的重复扣费（duplicate_rows + credits_at_risk）← 这才是结论
--   B 档 = 扣了费没做出东西，另一种故障，单独查
--   C 档 = 正常多段生成
--   D 档 = 缺目标列判不了，要先补 Q0c 的列名
-- 四档分开报，不要合成一个数。


-- =====================================================================
-- 我拿到 Q0 / Q1 之后会做的收尾
-- · 列名钉死，去掉所有 🔧
-- · 有外键就把时间邻近关联换成精确 join，溢出额从「估」变「准」
-- · Q1b 能区分 refund / topup 的话，Q6 改成只净退款
-- · A 档账号的逐笔时间线（给客服解释和退款用）
-- =====================================================================
