export function RouteLoading(){
  return <div className="page content-loading" role="status" aria-live="polite" aria-label="Carregando conteúdo">
    <span className="skeleton skeleton-short"/>
    <span className="skeleton skeleton-title"/>
    <span className="skeleton skeleton-copy"/>
    <div className="content-loading-grid">
      <span className="skeleton skeleton-card"/>
      <span className="skeleton skeleton-card"/>
    </div>
    <span className="skeleton skeleton-panel"/>
    <span className="sr-only">Carregando…</span>
  </div>;
}
