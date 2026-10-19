import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "./i18n";
import { BreadcrumbProvider } from "./context/BreadcrumbProvider";
import { useBreadcrumbItems } from "./hooks/useBreadcrumb";
import Breadcrumb from "./components/common/Breadcrumb";
import Loader from "./components/common/Loader";
import SeasonPage from "./pages/SeasonPage";

// Стартова сторінка (календар) вантажиться одразу, решта — окремими
// чанками: Recharts важить більше за весь інший застосунок, а потрібен
// лише на сторінках етапу.
const DriverProfilePage = lazy(() => import("./pages/DriverProfilePage"));
const EventLayout = lazy(() => import("./pages/EventLayout"));
const EventOverview = lazy(() => import("./pages/EventOverview"));
const AnalysisPage = lazy(() => import("./pages/AnalysisPage"));
const SessionPage = lazy(() => import("./pages/SessionPage"));
const DriverPage = lazy(() => import("./pages/DriverPage"));
const ComparePage = lazy(() => import("./pages/ComparePage"));

const CURRENT_YEAR = new Date().getFullYear();

// Перемикач мови інтерфейсу — вибір зберігається (див. i18n/index.js).
function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex shrink-0 rounded-md border border-(--color-line) p-0.5" role="group" aria-label={t("app.language")}>
      {LANGUAGES.map((lng) => (
        <button
          key={lng}
          onClick={() => i18n.changeLanguage(lng)}
          aria-pressed={i18n.language === lng}
          className={`px-2 py-0.5 text-[11px] uppercase font-semibold rounded transition-colors ${
            i18n.language === lng ? "bg-(--color-surface-2) text-(--color-text)" : "text-(--color-text-dim) hover:text-(--color-text)"
          }`}
        >
          {lng}
        </button>
      ))}
    </div>
  );
}

function TopBar() {
  const { t } = useTranslation();
  const items = useBreadcrumbItems();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-10 border-b border-(--color-line) bg-(--color-bg)/95 backdrop-blur px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4 min-w-0">
      <Link to="/" className="flex items-center gap-2.5 shrink-0 rounded-md">
        {/* Той самий картатий прапор, що й у public/favicon.svg — замість
            емодзі, який на різних ОС виглядає по-різному. */}
        <svg viewBox="0 0 32 32" className="w-7 h-7 shrink-0" aria-hidden="true">
          <rect width="32" height="32" rx="7" fill="var(--color-accent)" />
          <path
            fill="#fff"
            d="M8 8h4v4H8zM16 8h4v4h-4zM12 12h4v4h-4zM20 12h4v4h-4zM8 16h4v4H8zM16 16h4v4h-4zM12 20h4v4h-4zM20 20h4v4h-4z"
          />
        </svg>
        <span className="text-sm font-extrabold tracking-tight uppercase">
          F1 <span className="text-(--color-accent)">Predictor</span>
        </span>
      </Link>

      {items.length > 0 && (
        <>
          <span className="text-(--color-line) shrink-0">|</span>
          <Breadcrumb items={items} />
        </>
      )}

      <div className="ml-auto flex items-center gap-2 shrink-0">
        {items.length > 1 && (
          <button
            onClick={() => navigate(-1)}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-(--color-text-dim) hover:text-(--color-text) transition-colors px-2.5 py-1.5 rounded-md hover:bg-(--color-surface)"
          >
            ← {t("app.back")}
          </button>
        )}
        <LanguageSwitch />
      </div>
    </header>
  );
}

function StandingsRedirect() {
  const { year } = useParams();
  return <Navigate to={`/${year}?tab=drivers`} replace />;
}

export default function App() {
  const { t, i18n } = useTranslation();
  return (
    <BrowserRouter>
      <BreadcrumbProvider>
        <div className="min-h-screen">
          <TopBar />

          {/* key — при зміні мови вміст перемонтовується, тож дати й підписи
              (зокрема в графіках, що не підписані на i18n) оновлюються всі
              одразу; дані беруться з кешу браузера, без нових запитів. */}
          <main key={i18n.language} className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <Suspense fallback={<Loader label={t("common.loadingPage")} />}>
              <Routes>
                <Route path="/" element={<Navigate to={`/${CURRENT_YEAR}`} replace />} />
                <Route path="/:year" element={<SeasonPage />} />
                {/* Чемпіонат тепер — вкладки на сторінці сезону; стара адреса веде туди. */}
                <Route path="/:year/standings" element={<StandingsRedirect />} />
                <Route path="/:year/drivers/:driverRef" element={<DriverProfilePage />} />
                <Route path="/:year/:round" element={<EventLayout />}>
                  <Route index element={<EventOverview />} />
                  {/* Стара адреса заглушки /predict — ведемо на справжню модель. */}
                  <Route path="predict" element={<Navigate to="../analysis" replace />} />
                  <Route path="analysis" element={<AnalysisPage />} />
                  <Route path=":session" element={<SessionPage />} />
                  <Route path=":session/driver/:driverCode" element={<DriverPage />} />
                  <Route path=":session/compare" element={<ComparePage />} />
                </Route>
                <Route path="*" element={<Navigate to={`/${CURRENT_YEAR}`} replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </BreadcrumbProvider>
    </BrowserRouter>
  );
}
