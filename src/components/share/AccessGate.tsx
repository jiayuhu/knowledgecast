"use client";

import { useActionState } from "react";
import {
  requestShareAccess,
  verifyShareAccess,
  type ShareGateState
} from "@/app/share/[token]/actions";

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
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-8 py-16">
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          需要验证
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900">
          验证身份以查看培训内容
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          输入邮箱获取验证码，然后用验证码解锁页面
        </p>

        <form className="mt-8 space-y-3" action={requestAction}>
          <input type="hidden" name="shareToken" value={token} />
          <label className="block text-sm font-medium text-gray-700">
            邮箱
            <input
              name="email"
              type="email"
              required
              className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
              placeholder="name@company.com"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            disabled={requestPending}
          >
            {requestPending ? "生成中..." : "获取验证码"}
          </button>
        </form>

        {requestState.message ? (
          <p className="mt-4 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
            {requestState.message}
            {requestState.debugCode ? (
              <span className="mt-2 block font-mono text-base text-gray-900">
                开发验证码: {requestState.debugCode}
              </span>
            ) : null}
          </p>
        ) : null}

        <form className="mt-6 space-y-3" action={verifyAction}>
          <input type="hidden" name="shareToken" value={token} />
          <label className="block text-sm font-medium text-gray-700">
            邮箱
            <input
              name="email"
              type="email"
              required
              className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
              placeholder="name@company.com"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            验证码
            <input
              name="code"
              type="text"
              inputMode="numeric"
              required
              className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
              placeholder="123456"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            disabled={verifyPending}
          >
            {verifyPending ? "验证中..." : "解锁查看"}
          </button>
        </form>

        {verifyState.message ? (
          <p className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
            {verifyState.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
