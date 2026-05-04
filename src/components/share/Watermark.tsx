export function Watermark({ email }: { email: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center px-6">
      <span className="text-xs text-gray-300">
        {email}
      </span>
    </div>
  );
}
