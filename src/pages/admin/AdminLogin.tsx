import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { signIn, signOut, whoami } from "@/lib/adminAuth";

/**
 * Admin Portal login (`/admin/login`). Email + password (Supabase Auth). Public
 * signup is OFF — accounts are created by the owner in Supabase and added to the
 * platform_admins allowlist. A valid login that isn't on the allowlist is signed
 * back out with a clear message.
 */
export default function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [err, setErr] = useState("");

  // Already a signed-in admin → skip the form.
  useEffect(() => {
    let cancelled = false;
    whoami()
      .then((a) => {
        if (cancelled) return;
        if (a) nav("/admin", { replace: true });
        else setChecking(false);
      })
      .catch(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await signIn(email.trim(), password);
      const a = await whoami();
      if (!a) {
        await signOut();
        setErr("此账号不是管理员，无法进入。");
        return;
      }
      nav("/admin", { replace: true });
    } catch {
      setErr("邮箱或密码错误。");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FCFDFF] text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-[#FCFDFF]">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-[15vh] -left-[10vw] w-[60vw] h-[60vh] rounded-full bg-[#FCE4F1] opacity-30 blur-[100px]" />
        <div className="absolute -bottom-[20vh] -right-[10vw] w-[60vw] h-[55vh] rounded-full bg-[#EAE2FF] opacity-25 blur-[100px]" />
      </div>
      <form onSubmit={submit} className="w-full max-w-sm glass-card rounded-3xl p-7">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display font-semibold leading-tight">Playbook Admin</h1>
            <p className="text-[11px] text-muted-foreground">团队管理后台</p>
          </div>
        </div>

        <label className="block text-xs text-muted-foreground mt-5 mb-1">邮箱</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          className="glass-input w-full px-3.5 py-2.5 text-sm"
          placeholder="you@company.com"
          required
        />
        <label className="block text-xs text-muted-foreground mt-3 mb-1">密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="glass-input w-full px-3.5 py-2.5 text-sm"
          placeholder="••••••••"
          required
        />

        {err && <p className="text-xs text-red-500 mt-3">{err}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full mt-5 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-70 inline-flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} 登录
        </button>
        <p className="text-[11px] text-muted-foreground mt-4 text-center">仅限受邀团队成员 · 无公开注册</p>
      </form>
    </div>
  );
}
