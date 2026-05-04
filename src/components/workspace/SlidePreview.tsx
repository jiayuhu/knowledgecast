"use client";

import { useState } from "react";

type Slide = {
  title: string;
  bullets: string[];
  speakerNotes: string;
  estimatedMinutes: number;
};

type Props = {
  slides: Slide[];
  title: string;
  totalMinutes: number;
  shareUrl: string;
};

export function SlidePreview({ slides, title, totalMinutes, shareUrl }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(true);

  if (slides.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
        <div className="text-4xl">📊</div>
        <p className="mt-4 text-sm text-gray-500">选择框架并点击生成后，幻灯片将展示在这里</p>
        <p className="mt-1 text-xs text-gray-400">AI 会将碎片素材组织为结构化的培训幻灯片</p>
      </div>
    );
  }

  const slide = slides[currentIndex];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-500">
              共 {slides.length} 页 · 预估时长 {totalMinutes} 分钟
            </p>
          </div>
          {shareUrl && (
            <div className="text-right">
              <a
                href={`${shareUrl}?preview=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                预览分享页
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Slide navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
        >
          ← 上一页
        </button>
        <span className="text-sm text-gray-400">
          {currentIndex + 1} / {slides.length}
        </span>
        <button
          onClick={() =>
            setCurrentIndex(Math.min(slides.length - 1, currentIndex + 1))
          }
          disabled={currentIndex === slides.length - 1}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
        >
          下一页 →
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setShowNotes(!showNotes)}
          className={`rounded-md border px-3 py-1.5 text-sm transition ${
            showNotes
              ? "border-blue-200 bg-blue-50 text-blue-700"
              : "border-gray-200 text-gray-500 hover:bg-gray-50"
          }`}
        >
          {showNotes ? "隐藏备注" : "讲者备注"}
        </button>
      </div>

      {/* Current slide */}
      <div className="rounded-xl border border-gray-200 bg-white p-8">
        <div className="flex items-center justify-between mb-6">
          <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-500">
            第 {currentIndex + 1} 页
          </span>
          <span className="text-xs text-gray-400">~{slide.estimatedMinutes} 分钟</span>
        </div>

        <h3 className="text-xl font-bold text-gray-900">{slide.title}</h3>

        <ul className="mt-6 space-y-3">
          {slide.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
              {bullet}
            </li>
          ))}
        </ul>

        {showNotes && slide.speakerNotes && (
          <div className="mt-8 rounded-lg border border-dashed border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium uppercase tracking-wide text-amber-700">
                讲者备注
              </span>
            </div>
            <p className="text-sm leading-relaxed text-amber-900">{slide.speakerNotes}</p>
          </div>
        )}
      </div>

      {/* All slides overview */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-medium uppercase tracking-wide text-gray-500 mb-4">
          全部幻灯片
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`rounded-lg border p-3 text-left transition ${
                i === currentIndex
                  ? "border-blue-300 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">#{i + 1}</span>
                <span className="text-xs text-gray-400">{s.estimatedMinutes}min</span>
              </div>
              <p className="mt-1 text-sm font-medium text-gray-900 line-clamp-2">{s.title}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
