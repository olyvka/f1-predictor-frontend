import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { t } from "../../i18n";

function initials(user) {
  const source = user.displayName || user.email || "?";
  return source.trim().charAt(0).toUpperCase();
}

// Кнопка акаунта в шапці: "Увійти" або аватар з меню (ім'я, пошта, вихід).
export default function AccountMenu() {
  const { user, ready, signOut } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.type === "keydown" ? e.key === "Escape" : !ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  // Поки невідомо, чи є сесія, — порожнє місце тієї ж ширини, без мигання.
  if (!ready) return <span className="w-8 h-8" aria-hidden="true" />;

  if (!user) {
    if (location.pathname === "/login") return null;
    const next = encodeURIComponent(location.pathname + location.search);
    return (
      <Link
        to={`/login?next=${next}`}
        className="text-xs uppercase tracking-wide font-semibold px-3 py-1.5 rounded-md border border-(--color-line) text-(--color-text) hover:border-(--color-accent) transition-colors"
      >
        {t("auth.signin.short")}
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("auth.account")}
        className="w-8 h-8 rounded-full overflow-hidden bg-(--color-accent) text-white text-sm font-bold flex items-center justify-center ring-offset-2 ring-offset-(--color-bg) hover:ring-2 hover:ring-(--color-accent)/60 transition-shadow"
      >
        {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : initials(user)}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-60 rounded-md border border-(--color-line) bg-(--color-surface) shadow-xl py-1 z-20">
          <div className="px-3 py-2 border-b border-(--color-line)">
            {user.displayName && <p className="text-sm font-semibold truncate">{user.displayName}</p>}
            <p className="text-xs text-(--color-text-dim) truncate">{user.email}</p>
          </div>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="w-full text-left px-3 py-2 text-sm text-(--color-text-dim) hover:text-(--color-text) hover:bg-(--color-surface-hover)"
          >
            {t("auth.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
