import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Clock, Loader2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteHistoryItem, listHistory } from "@/lib/copywriter/api";
import type { HistoryItem } from "@/lib/copywriter/types";
import { useLang } from "@/i18n/LanguageContext";
import { T, type Language, uiLanguage } from "@/lib/copywriter/i18n";

/** Output-language chip. Not translated — "华文" reads the same in either
 *  interface, and these name the language of the COPY, not of the UI. */
const LANG_LABEL: Record<Language, string> = { zh: "华文", en: "English", ms: "Malay" };

function formatWhen(iso: string, lang: Language): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang === "zh" ? "zh-CN" : "en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The history list for THIS sub-account.
 *
 * Scoped by location_id server-side, which means it is shared by everyone
 * working under that account — the banner says so out loud rather than letting
 * someone assume these entries are private to them.
 */
export function History({
  locationId,
  onOpen,
  onBack,
}: {
  locationId: string;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const { lang: siteLang } = useLang();
  const lang: Language = uiLanguage(siteLang);
  const t = T[lang];

  const [items, setItems] = useState<HistoryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  /** The entry awaiting delete confirmation, or null. */
  const [pendingDelete, setPendingDelete] = useState<HistoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const { items: rows, nextCursor } = await listHistory(locationId);
      setItems(rows);
      setCursor(nextCursor);
    } catch {
      // The message is already localized server-side, but a failed LIST is a
      // whole-screen state, not a toast that scrolls away — see the retry block.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { items: rows, nextCursor } = await listHistory(locationId, cursor);
      setItems((prev) => [...prev, ...rows]);
      setCursor(nextCursor);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.historyLoadFail);
    } finally {
      setLoadingMore(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    const target = pendingDelete;
    try {
      const ok = await deleteHistoryItem(locationId, target.id);
      if (ok) {
        setItems((prev) => prev.filter((r) => r.id !== target.id));
        toast.success(t.historyDeleted);
      } else {
        // Nothing matched — it was already gone. Drop it from the list anyway so
        // the screen agrees with the server instead of showing a dead row.
        setItems((prev) => prev.filter((r) => r.id !== target.id));
        toast.message(t.historyNotFound);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.historyDeleteFail);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{t.historyTitle}</h1>
          {/* The sharing model, stated plainly. */}
          <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
            <Users className="mt-0.5 h-4 w-4 shrink-0" />
            {t.historyShared}
          </p>
        </div>
        <Button variant="outline" onClick={onBack} className="shrink-0">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {t.historyBackToForm}
        </Button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">{t.historyLoading}</p>
        </div>
      )}

      {!loading && failed && (
        <Card className="glass-panel flex flex-col items-center gap-4 p-10 text-center">
          <p className="text-sm text-muted-foreground">{t.historyLoadFail}</p>
          <Button variant="outline" onClick={() => void loadFirstPage()}>
            {t.historyRetry}
          </Button>
        </Card>
      )}

      {!loading && !failed && items.length === 0 && (
        <Card className="glass-panel flex flex-col items-center gap-2 p-12 text-center">
          <Clock className="mb-1 h-8 w-8 text-muted-foreground" />
          <p className="font-semibold">{t.historyEmptyTitle}</p>
          <p className="text-sm text-muted-foreground">{t.historyEmptyDesc}</p>
        </Card>
      )}

      {!loading && !failed && items.length > 0 && (
        <div className="space-y-3">
          {items.map((row) => (
            <Card key={row.id} className="glass-panel p-0">
              <div className="flex items-stretch">
                {/* The whole row opens the entry — a bigger tap target than a
                    link, which matters most on a phone. */}
                <button
                  type="button"
                  onClick={() => onOpen(row.id)}
                  className="min-w-0 flex-1 rounded-l-2xl px-4 py-4 text-left transition-colors hover:bg-[#fed50a]/10"
                >
                  {/* Never blank: rows stored before questionnaire capture have
                      no product name, so they fall back to a label rather than
                      rendering an empty line. */}
                  <p className="truncate font-semibold">
                    {row.product_name?.trim() || t.historyUntitled}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatWhen(row.created_at, lang)}
                    <span className="mx-1.5">·</span>
                    {LANG_LABEL[row.language] ?? row.language}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(row)}
                  aria-label={t.historyDelete}
                  title={t.historyDelete}
                  className="flex w-14 shrink-0 items-center justify-center rounded-r-2xl border-l border-[#141414]/10 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}

          {cursor && (
            <div className="pt-2 text-center">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {t.historyLoadMore}
              </Button>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.historyDeleteTitle}</AlertDialogTitle>
            {/* Deliberately does NOT promise recovery. The row is soft-deleted
                and an admin could restore it by hand, but that is an internal
                safety net, not a feature to advertise. */}
            <AlertDialogDescription>{t.historyDeleteDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t.historyCancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Keep the dialog mounted while the request is in flight so the
                // spinner is visible; it closes in confirmDelete's finally.
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {t.historyDeleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
