export function Watermark({ email }: { email: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center px-6">
      <div className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-black/50 backdrop-blur">
        Accessed by {email}
      </div>
    </div>
  );
}
