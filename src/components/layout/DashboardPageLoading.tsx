type DashboardPageLoadingProps = {
  metrics?: number;
  sidePanels?: number;
  className?: string;
  'data-testid'?: string;
};

export function DashboardPageLoading({
  metrics = 3,
  sidePanels = 2,
  className = '',
  'data-testid': dataTestId = 'dashboard-page-loading',
}: DashboardPageLoadingProps) {
  return (
    <div
      data-testid={dataTestId}
      className={`w-full space-y-6 pb-28 md:pb-8 ${className}`.trim()}
      aria-busy="true"
      aria-live="polite"
    >
      <section className="brand-panel rounded-[30px] p-6 sm:p-7">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-24 rounded-full bg-gray-200/80 dark:bg-gray-700/80" />
          <div className="h-10 w-full max-w-sm rounded-2xl bg-gray-200/80 dark:bg-gray-700/80" />
          <div className="h-4 w-full max-w-2xl rounded-full bg-gray-200/70 dark:bg-gray-700/70" />
          <div className="grid gap-4 pt-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: metrics }).map((_, index) => (
              <div
                key={index}
                className="h-36 rounded-[24px] border border-gray-200/70 bg-white/70 dark:border-white/10 dark:bg-white/5"
              />
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="card h-[24rem] animate-pulse rounded-[28px] bg-gray-100/80 dark:bg-gray-800/70" />
        <div className="space-y-6">
          {Array.from({ length: sidePanels }).map((_, index) => (
            <div
              key={index}
              className="card h-44 animate-pulse rounded-[28px] bg-gray-100/80 dark:bg-gray-800/70"
            />
          ))}
        </div>
      </div>

      <div className="card h-[22rem] animate-pulse rounded-[28px] bg-gray-100/80 dark:bg-gray-800/70" />
    </div>
  );
}
