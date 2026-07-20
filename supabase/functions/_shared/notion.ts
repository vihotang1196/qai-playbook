// ════════════════════════════════════════════════════════════════════════
// Shared Notion helpers (Deno) — used by the Helpdesk sync (helpdesk-admin fn).
//
// ONE converter (the old export had two divergent copies). Text-only for P4b:
// media blocks (image/video/file/pdf) become placeholders; P4c will download
// them to Supabase Storage and rewrite the URLs here. Every Notion call goes
// through notionFetch, which RETRIES 429/5xx and THROWS on final failure — so a
// transient hiccup surfaces as an error instead of silently truncating an
// article (a real bug in the old code).
// ════════════════════════════════════════════════════════════════════════

const NOTION_VERSION = "2022-06-28";
const MAX_DEPTH = 8; // guard against pathological nesting (old code had none)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Notion API call with retry on 429 / 5xx. Throws on non-retryable errors and
 *  after exhausting retries (callers must handle — never silently truncate). */
export async function notionFetch(
  key: string,
  url: string,
  init: RequestInit = {},
): Promise<any> {
  const headers = {
    Authorization: `Bearer ${key}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const resp = await fetch(url, { ...init, headers });
    if (resp.ok) return await resp.json();
    if (resp.status === 429 || resp.status >= 500) {
      lastErr = new Error(`Notion ${resp.status}`);
      await sleep(600 * (attempt + 1));
      continue;
    }
    const body = await resp.text().catch(() => "");
    throw new Error(`Notion ${resp.status}: ${body.slice(0, 200)}`);
  }
  throw lastErr || new Error("Notion request failed");
}

/** All pages (id + last_edited_time) in a database, fully paginated. */
export async function fetchDatabasePages(
  key: string,
  databaseId: string,
): Promise<{ id: string; last_edited_time: string }[]> {
  const out: { id: string; last_edited_time: string }[] = [];
  let cursor: string | undefined = undefined;
  do {
    const data = await notionFetch(key, `https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });
    for (const p of data.results || []) out.push({ id: p.id, last_edited_time: p.last_edited_time });
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return out;
}

/** A Notion page object. */
export async function getPage(key: string, pageId: string): Promise<any> {
  return notionFetch(key, `https://api.notion.com/v1/pages/${pageId}`);
}

/** Title of a page (its `title`-type property joined to plain text). */
export function pageTitle(page: any): string {
  const props = page?.properties || {};
  for (const k of Object.keys(props)) {
    const p = props[k];
    if (p?.type === "title") return (p.title || []).map((t: any) => t?.plain_text || "").join("").trim();
  }
  return "";
}

/** Walk a Notion `parent` chain up to the containing PAGE id. Inline databases
 *  have a `block_id` parent (the embedding block), not a `page_id`, so we follow
 *  block parents until we reach a page (bounded depth). */
async function containingPageId(key: string, parent: any, depth = 0): Promise<string | null> {
  if (!parent || depth > 6) return null;
  if (parent.type === "page_id") return parent.page_id || null;
  if (parent.type === "block_id" && parent.block_id) {
    try {
      const block = await notionFetch(key, `https://api.notion.com/v1/blocks/${parent.block_id}`);
      return await containingPageId(key, block.parent, depth + 1);
    } catch {
      return null;
    }
  }
  return null; // workspace / database_id → no containing page
}

/** Folder name for a database = its containing PAGE's title (owner's option B),
 *  falling back to the database's own title, then "Notion". Handles inline
 *  databases (block-parent) by walking up to the page. */
export async function folderNameForDatabase(key: string, databaseId: string): Promise<string> {
  const db = await notionFetch(key, `https://api.notion.com/v1/databases/${databaseId}`);
  try {
    const pageId = await containingPageId(key, db.parent);
    if (pageId) {
      const page = await getPage(key, pageId);
      const t = pageTitle(page);
      if (t) return t;
    }
  } catch {
    /* fall through to db title */
  }
  const dbTitle = (db.title || []).map((t: any) => t?.plain_text || "").join("").trim();
  return dbTitle || "Notion";
}

// ── Rich text → markdown inline ─────────────────────────────────────────────
function richText(rich: any[]): string {
  if (!rich) return "";
  return rich
    .map((r) => {
      let t = r.plain_text ?? "";
      if (!t) return "";
      const a = r.annotations || {};
      if (a.code) t = "`" + t + "`";
      if (a.bold) t = "**" + t + "**";
      if (a.italic) t = "*" + t + "*";
      if (a.strikethrough) t = "~~" + t + "~~";
      if (r.href) t = `[${t}](${r.href})`;
      return t;
    })
    .join("");
}

const indent = (s: string, n = 2) =>
  s
    .split("\n")
    .map((line) => (line ? " ".repeat(n) + line : line))
    .join("\n");

async function fetchChildren(key: string, blockId: string): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | undefined = undefined;
  do {
    const url =
      `https://api.notion.com/v1/blocks/${blockId}/children?page_size=100` +
      (cursor ? `&start_cursor=${cursor}` : "");
    const data = await notionFetch(key, url);
    out.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return out;
}

function mediaPlaceholder(kind: string): string {
  return `*[${kind}]*`; // P4c replaces this with the persisted Storage URL
}

async function tableToMarkdown(key: string, tableBlockId: string): Promise<string> {
  const rows = await fetchChildren(key, tableBlockId);
  const trs = rows.filter((r) => r.type === "table_row");
  if (!trs.length) return "";
  const cell = (cells: any[]) =>
    "| " + cells.map((c) => (richText(c) || " ").replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ") + " |";
  const header = trs[0].table_row.cells;
  const lines = [cell(header), "| " + header.map(() => "---").join(" | ") + " |"];
  for (let i = 1; i < trs.length; i++) lines.push(cell(trs[i].table_row.cells));
  return lines.join("\n");
}

type Piece = { md: string; list: boolean };

/**
 * Convert a block's children to markdown, recursively. `blockId` is a page id
 * for the top-level call. Text-only: media → placeholders. Consecutive list
 * items are joined with single newlines; other blocks get a blank line between.
 */
export async function blocksToMarkdown(key: string, blockId: string, depth = 0): Promise<string> {
  if (depth > MAX_DEPTH) return "";
  const blocks = await fetchChildren(key, blockId);
  const pieces: Piece[] = [];
  let numIdx = 0;

  for (const b of blocks) {
    const type: string = b.type;
    if (type !== "numbered_list_item") numIdx = 0;

    const childMd = async () => (b.has_children ? await blocksToMarkdown(key, b.id, depth + 1) : "");

    switch (type) {
      case "paragraph": {
        pieces.push({ md: richText(b.paragraph.rich_text), list: false });
        const c = await childMd();
        if (c.trim()) pieces.push({ md: c, list: false });
        break;
      }
      case "heading_1":
        pieces.push({ md: "# " + richText(b.heading_1.rich_text), list: false });
        break;
      case "heading_2":
        pieces.push({ md: "## " + richText(b.heading_2.rich_text), list: false });
        break;
      case "heading_3":
        pieces.push({ md: "### " + richText(b.heading_3.rich_text), list: false });
        break;
      case "bulleted_list_item": {
        let md = "- " + richText(b.bulleted_list_item.rich_text);
        const c = await childMd();
        if (c.trim()) md += "\n" + indent(c, 2);
        pieces.push({ md, list: true });
        break;
      }
      case "numbered_list_item": {
        numIdx++;
        let md = `${numIdx}. ` + richText(b.numbered_list_item.rich_text);
        const c = await childMd();
        if (c.trim()) md += "\n" + indent(c, 3);
        pieces.push({ md, list: true });
        break;
      }
      case "to_do": {
        const done = b.to_do.checked ? "x" : " ";
        pieces.push({ md: `- [${done}] ` + richText(b.to_do.rich_text), list: true });
        break;
      }
      case "toggle": {
        pieces.push({ md: "**" + richText(b.toggle.rich_text) + "**", list: false });
        const c = await childMd();
        if (c.trim()) pieces.push({ md: c, list: false });
        break;
      }
      case "quote":
        pieces.push({ md: "> " + richText(b.quote.rich_text), list: false });
        break;
      case "callout": {
        const icon = b.callout.icon?.emoji ? b.callout.icon.emoji + " " : "";
        pieces.push({ md: "> " + icon + richText(b.callout.rich_text), list: false });
        break;
      }
      case "code": {
        const lang = b.code.language && b.code.language !== "plain text" ? b.code.language : "";
        pieces.push({ md: "```" + lang + "\n" + richText(b.code.rich_text) + "\n```", list: false });
        break;
      }
      case "divider":
        pieces.push({ md: "---", list: false });
        break;
      case "equation":
        pieces.push({ md: "$$\n" + (b.equation.expression || "") + "\n$$", list: false });
        break;
      case "image":
        pieces.push({ md: mediaPlaceholder("图片"), list: false });
        break;
      case "video":
        pieces.push({ md: mediaPlaceholder("视频"), list: false });
        break;
      case "file":
        pieces.push({ md: mediaPlaceholder("附件"), list: false });
        break;
      case "pdf":
        pieces.push({ md: mediaPlaceholder("PDF"), list: false });
        break;
      case "bookmark":
      case "embed":
      case "link_preview": {
        const url = b[type]?.url || "";
        if (url) pieces.push({ md: `[${url}](${url})`, list: false });
        break;
      }
      case "table": {
        const t = await tableToMarkdown(key, b.id);
        if (t) pieces.push({ md: t, list: false });
        break;
      }
      case "column_list":
      case "column":
      case "synced_block": {
        const c = await childMd();
        if (c.trim()) pieces.push({ md: c, list: false });
        break;
      }
      default: {
        const rt = b[type]?.rich_text;
        if (rt) pieces.push({ md: richText(rt), list: false });
        else {
          const c = await childMd();
          if (c.trim()) pieces.push({ md: c, list: false });
        }
      }
    }
  }

  // Join: single newline between consecutive list items, blank line otherwise.
  let out = "";
  for (let i = 0; i < pieces.length; i++) {
    if (i === 0) {
      out = pieces[i].md;
      continue;
    }
    const sep = pieces[i].list && pieces[i - 1].list ? "\n" : "\n\n";
    out += sep + pieces[i].md;
  }
  return out.trim();
}
