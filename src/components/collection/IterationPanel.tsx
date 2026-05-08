"use client";

type Props = {
  instruction: string;
  onInstructionChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
};

export function IterationPanel({
  instruction,
  onInstructionChange,
  onSubmit,
  loading
}: Props) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (instruction.trim() && !loading) onSubmit();
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
          调整内容
        </h2>
      </div>

      <p className="mt-2 text-xs text-gray-400">
        描述你想要的调整，AI 会重新生成
      </p>

      <div className="mt-3 space-y-2">
        {[
          "把第三章展开，加一个案例",
          "删掉太技术的内容，面向非技术受众",
          "压缩到 30 分钟"
        ].map((hint) => (
          <button
            key={hint}
            type="button"
            onClick={() => onInstructionChange(hint)}
            className="block w-full rounded-md border border-dashed border-gray-200 px-3 py-1.5 text-left text-xs text-gray-400 transition hover:border-gray-300 hover:text-gray-600"
          >
            「{hint}」
          </button>
        ))}
      </div>

      <textarea
        value={instruction}
        onChange={(e) => onInstructionChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
        placeholder="输入调整指令，例如：让第三章更有故事性"
      />

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-400">Ctrl + Enter 快速发送</span>
        <button
          onClick={onSubmit}
          disabled={!instruction.trim() || loading}
          className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "调整中..." : "发送调整"}
        </button>
      </div>
    </div>
  );
}
