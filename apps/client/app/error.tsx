'use client';

export default function GlobalError({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <main className="site-shell" id="main-content">
      <section className="error-state" role="alert">
        <p className="eyebrow">Temporary problem</p>
        <h1>We could not load this page.</h1>
        <p>Your information has not been submitted. Please try again.</p>
        <button className="button" type="button" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
