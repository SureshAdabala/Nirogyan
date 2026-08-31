export default function Loading() {
  return (
    <main className="site-shell" id="main-content">
      <div className="skeleton" role="status" aria-live="polite">
        <span>Loading health information…</span>
      </div>
    </main>
  );
}
