export default function HomePage() {
  return (
    <main className="min-h-screen bg-ink-50 text-ink-900">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-20">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.3em] text-ink-900/60">
          KnowledgeCast
        </p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight sm:text-7xl">
          Capture knowledge, shape it, and share it as a private training page.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-900/70">
          A focused SaaS for turning fragmented notes into structured content and
          controlled web-based training material.
        </p>
      </section>
    </main>
  );
}
