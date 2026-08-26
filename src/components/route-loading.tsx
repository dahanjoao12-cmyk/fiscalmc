export function RouteLoading(){
  return <div className="route-loading" role="status" aria-label="Carregando página">
    <div className="route-loading-sidebar"/>
    <main className="route-loading-main">
      <div className="route-loading-topbar"><span className="skeleton skeleton-short"/></div>
      <div className="route-loading-content">
        <span className="skeleton skeleton-title"/>
        <span className="skeleton skeleton-copy"/>
        <div className="route-loading-grid"><span className="skeleton skeleton-card"/><span className="skeleton skeleton-card"/></div>
        <span className="skeleton skeleton-panel"/>
      </div>
    </main>
  </div>;
}
