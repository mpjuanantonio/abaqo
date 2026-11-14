import { useTranslation } from 'react-i18next';
import { useHealth } from '../api/useHealth';

export function HomePage() {
  const { t } = useTranslation();
  const health = useHealth();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t('app.name')}</h1>
        <p className="mt-2 text-slate-700 dark:text-slate-300">{t('app.tagline')}</p>
      </header>
      <section
        aria-labelledby="status-title"
        className="rounded-2xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
      >
        <h2 id="status-title" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('status.title')}
        </h2>
        <div className="mt-3 min-h-11" role="status" aria-live="polite">
          {health.isPending ? (
            <div data-testid="status-skeleton" className="animate-pulse">
              <div className="h-6 w-40 rounded bg-slate-200 dark:bg-slate-700" />
              <span className="sr-only">{t('status.loading')}</span>
            </div>
          ) : health.isError ? (
            <p className="flex items-center gap-2 font-medium text-red-800 dark:text-red-300">
              <span aria-hidden="true">✕</span>
              {t('status.unreachable')}
            </p>
          ) : (
            <p className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
              <span aria-hidden="true">✓</span>
              {t('status.ok')}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
