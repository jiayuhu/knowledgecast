export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f8f7f3] px-6 py-10 text-black">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-center">
        <div className="rounded-[2rem] border border-black/10 bg-white px-6 py-10 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.35)] sm:px-10 sm:py-14">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-black/45">
            KnowledgeCast
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight sm:text-7xl">
            Capture knowledge, shape it, and share it as a private training page.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-black/65">
            A focused SaaS for turning fragmented notes into structured content and
            controlled web-based training material.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/dashboard"
              className="rounded-full bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-black/85"
            >
              Open dashboard
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
