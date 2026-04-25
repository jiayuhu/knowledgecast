"use client";

import { useActionState } from "react";
import { requestShareAccess, verifyShareAccess, type ShareGateState } from "@/app/share/[token]/actions";

const initialState: ShareGateState = {
  message: ""
};

export function AccessGate({ token }: { token: string }) {
  const [requestState, requestAction, requestPending] = useActionState(
    requestShareAccess,
    initialState
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyShareAccess,
    initialState
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <div className="rounded-3xl border border-black/10 bg-white/80 p-8 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)] backdrop-blur">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-black/50">
          Private Access
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-black">
          Verify to view this training page
        </h1>
        <p className="mt-3 text-sm leading-6 text-black/60">
          Enter your email to generate a verification code, then use that code to unlock the page.
        </p>

        <form className="mt-8 space-y-3" action={requestAction}>
          <input type="hidden" name="shareToken" value={token} />
          <label className="block text-sm font-medium text-black/70">
            Email
            <input
              name="email"
              type="email"
              required
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/40"
              placeholder="name@company.com"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-black/85"
            disabled={requestPending}
          >
            {requestPending ? "Generating code..." : "Generate code"}
          </button>
        </form>

        {requestState.message ? (
          <p className="mt-4 rounded-2xl bg-black/5 px-4 py-3 text-sm text-black/70">
            {requestState.message}
            {requestState.debugCode ? (
              <span className="mt-2 block font-mono text-base text-black">
                Dev code: {requestState.debugCode}
              </span>
            ) : null}
          </p>
        ) : null}

        <form className="mt-6 space-y-3" action={verifyAction}>
          <input type="hidden" name="shareToken" value={token} />
          <label className="block text-sm font-medium text-black/70">
            Email
            <input
              name="email"
              type="email"
              required
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/40"
              placeholder="name@company.com"
            />
          </label>
          <label className="block text-sm font-medium text-black/70">
            Verification code
            <input
              name="code"
              type="text"
              inputMode="numeric"
              required
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 font-mono outline-none transition focus:border-black/40"
              placeholder="123456"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
            disabled={verifyPending}
          >
            {verifyPending ? "Verifying..." : "Unlock page"}
          </button>
        </form>

        {verifyState.message ? (
          <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {verifyState.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
