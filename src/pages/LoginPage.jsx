import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { authErrorMessage } from "../utils/authErrors";
import { useSetBreadcrumb } from "../hooks/useBreadcrumb";
import { t } from "../i18n";

const MODES = ["signin", "signup", "reset"];

const INPUT =
  "w-full rounded-md border border-(--color-line) bg-(--color-bg) px-3 py-2.5 text-sm outline-none focus:border-(--color-accent) transition-colors";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-4 h-4" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

// Вхід, реєстрація і скидання пароля (Firebase Auth). Після входу —
// назад на сторінку з ?next= (напр. Fantasy), інакше на головну.
export default function LoginPage() {
  const { user, ready, signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = MODES.includes(params.get("mode")) ? params.get("mode") : "signin";
  const next = params.get("next")?.startsWith("/") ? params.get("next") : "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  useSetBreadcrumb([{ label: t(`auth.${mode}.title`) }], [mode]);

  useEffect(() => {
    if (ready && user) navigate(next, { replace: true });
  }, [ready, user, next, navigate]);

  const switchMode = (m) => {
    setError(null);
    setInfo(null);
    const p = new URLSearchParams(params);
    p.set("mode", m);
    setParams(p, { replace: true });
  };

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      // Користувач сам закрив вікно Google — це не помилка.
      if (e?.code !== "auth/popup-closed-by-user" && e?.code !== "auth/cancelled-popup-request") setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (mode === "signin") run(() => signIn(email.trim(), password));
    else if (mode === "signup") run(() => signUp(email.trim(), password, name.trim()));
    else run(async () => {
      await resetPassword(email.trim());
      setInfo(t("auth.reset.sent", { email: email.trim() }));
    });
  };

  return (
    <div className="flex justify-center py-4 sm:py-10">
      <div className="w-full max-w-sm flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-extrabold">{t(`auth.${mode}.title`)}</h1>
          <p className="text-sm text-(--color-text-dim)">{t(`auth.${mode}.lead`)}</p>
        </div>

        {mode !== "reset" && (
          <>
            <button
              type="button"
              onClick={() => run(signInWithGoogle)}
              disabled={busy}
              className="flex items-center justify-center gap-2.5 rounded-md border border-(--color-line) bg-(--color-surface) px-4 py-2.5 text-sm font-semibold hover:border-(--color-text-dim) transition-colors disabled:opacity-50"
            >
              <GoogleIcon />
              {t("auth.google")}
            </button>
            <div className="flex items-center gap-3 text-xs text-(--color-text-dim)">
              <span className="flex-1 h-px bg-(--color-line)" />
              {t("auth.or")}
              <span className="flex-1 h-px bg-(--color-line)" />
            </div>
          </>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          {mode === "signup" && (
            <label className="flex flex-col gap-1.5 text-sm">
              {t("auth.name")}
              <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" maxLength={40} />
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-sm">
            {t("auth.email")}
            <input className={INPUT} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          {mode !== "reset" && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="flex items-baseline justify-between">
                {t("auth.password")}
                {mode === "signin" && (
                  <button type="button" onClick={() => switchMode("reset")} className="text-xs text-(--color-text-dim) hover:text-(--color-accent)">
                    {t("auth.forgot")}
                  </button>
                )}
              </span>
              <input
                className={INPUT}
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
              {mode === "signup" && <span className="text-xs text-(--color-text-dim)">{t("auth.passwordHint")}</span>}
            </label>
          )}

          {error && (
            <p role="alert" className="text-sm text-(--color-danger)">
              {error}
            </p>
          )}
          {info && (
            <p role="status" className="text-sm text-(--color-good)">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 rounded-md bg-(--color-accent) px-4 py-2.5 text-sm uppercase tracking-wide font-semibold text-white hover:brightness-110 transition-[filter] disabled:opacity-50"
          >
            {busy ? "…" : t(`auth.${mode}.submit`)}
          </button>
        </form>

        <p className="text-sm text-(--color-text-dim) text-center">
          {mode === "signin" ? (
            <>
              {t("auth.noAccount")}{" "}
              <button onClick={() => switchMode("signup")} className="text-(--color-accent) font-semibold hover:brightness-125">
                {t("auth.signup.title")}
              </button>
            </>
          ) : (
            <>
              {mode === "signup" && `${t("auth.haveAccount")} `}
              <button onClick={() => switchMode("signin")} className="text-(--color-accent) font-semibold hover:brightness-125">
                {mode === "signup" ? t("auth.signin.title") : t("auth.backToSignin")}
              </button>
            </>
          )}
        </p>
        <Link to="/" className="text-xs text-center text-(--color-text-dim) hover:text-(--color-text)">
          ← {t("auth.backHome")}
        </Link>
      </div>
    </div>
  );
}
