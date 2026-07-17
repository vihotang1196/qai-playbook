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
      <div className="min-h-screen flex items-center justify-center bg-[#0e1016] text-slate-300">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e1016] px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-7">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-slate-100 font-semibold leading-tight">Playbook Admin</h1>
            <p className="text-[11px] text-slate-400">团队管理后台</p>
          </div>
        </div>

        <label className="block text-xs text-slate-400 mt-5 mb-1">邮箱</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          className="w-full rounded-xl bg-[#171a22] border border-white/10 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-primary/60"
          placeholder="you@company.com"
          required
        />
        <label className="block text-xs text-slate-400 mt-3 mb-1">密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded-xl bg-[#171a22] border border-white/10 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-primary/60"
          placeholder="••••••••"
          required
        />

        {err && <p className="text-xs text-red-400 mt-3">{err}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full mt-5 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-70 inline-flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} 登录
        </button>
        <p className="text-[11px] text-slate-500 mt-4 text-center">仅限受邀团队成员 · 无公开注册</p>
      </form>
    </div>
  );
}
