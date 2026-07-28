import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

/**
 * The app's confirmation dialog — the replacement for window.confirm/alert/prompt.
 *
 * WHY THIS EXISTS: a native confirm() returns FALSE when the browser suppresses
 * dialogs (the "prevent this page from creating additional dialogs" checkbox,
 * an embedding iframe, automation). Every guarded action built on it then did
 * NOTHING, silently — no request, no message — which is indistinguishable from a
 * broken button. Worse, an alert() carrying a server's refusal reason could be
 * swallowed the same way, hiding WHY something didn't happen. This dialog is
 * ordinary DOM: it cannot be suppressed.
 *
 * `danger` renders the black/yellow treatment used for destructive and
 * money-affecting actions, so "delete forever" never looks like "save".
 *
 * Pass `inputLabel` to collect a value (the window.prompt replacement); onConfirm
 * then receives the typed string.
 */
export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** Plain text or rich nodes — spell out the consequence, not just "are you sure". */
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive / money-affecting → stronger styling. */
  danger?: boolean;
  /** Disables both buttons and shows a spinner while the action runs. */
  busy?: boolean;
  /** Present = prompt mode: renders a text field and passes its value on confirm. */
  inputLabel?: string;
  inputDefaultValue?: string;
  inputPlaceholder?: string;
  onConfirm: (inputValue: string) => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  danger = false,
  busy = false,
  inputLabel,
  inputDefaultValue = "",
  inputPlaceholder,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [value, setValue] = useState(inputDefaultValue);

  // Reset the field each time the dialog opens, so a previous edit never leaks
  // into the next confirmation.
  useEffect(() => {
    if (open) setValue(inputDefaultValue);
  }, [open, inputDefaultValue]);

  // Esc closes (unless an action is in flight) — matches native dialog muscle memory.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={() => !busy && onCancel()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white border-2 border-[#141414] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {danger && (
            <div className="w-10 h-10 rounded-xl bg-[#141414] flex items-center justify-center text-[#fed50a] shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display font-bold">{title}</p>
            {description && (
              <div className="text-sm text-muted-foreground mt-1 break-words">{description}</div>
            )}
          </div>
        </div>

        {inputLabel && (
          <div className="mt-3">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              {inputLabel}
            </label>
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={inputPlaceholder}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy) onConfirm(value);
              }}
              className="mt-1 w-full h-10 rounded-xl border-2 border-[#141414]/30 bg-white px-3 text-sm outline-none focus:border-[#141414]"
            />
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 h-10 rounded-xl border-2 border-[#141414] bg-white text-sm font-medium disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(value)}
            disabled={busy}
            className={`flex-1 h-10 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${
              danger
                ? "bg-[#141414] text-[#fed50a]"
                : "bg-[#fed50a] text-[#141414] border-2 border-[#141414]"
            }`}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
