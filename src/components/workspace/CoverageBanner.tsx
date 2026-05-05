"use client";

type Slide = {
  title: string;
  bullets: string[];
  speakerNotes: string;
  estimatedMinutes: number;
};

type Props = {
  slides: Slide[];
  frameworkSteps: number;
  materialCount: number;
};

function parseCoverage(slides: Slide[]): { totalSteps: number; missingSteps: string[]; suggestions: string[] } {
  const missingSteps: string[] = [];
  const suggestions: string[] = [];

  for (const slide of slides) {
    const match = slide.speakerNotes.match(/^\[素材不足\]\s*建议补充：(.+)$/m);
    if (match) {
      missingSteps.push(slide.title);
      suggestions.push(match[1].trim());
    }
  }

  return {
    totalSteps: slides.length,
    missingSteps,
    suggestions
  };
}

export function CoverageBanner({ slides, frameworkSteps, materialCount }: Props) {
  // Pre-generation hint
  if (slides.length === 0 && frameworkSteps > 0) {
    const ratio = materialCount / frameworkSteps;
    const color = ratio >= 2 ? "text-green-600" : ratio >= 1 ? "text-amber-600" : "text-red-600";
    return (
      <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-2 text-xs text-gray-500">
        你有 {materialCount} 条素材，当前框架有 {frameworkSteps} 个环节。
        <span className={`font-medium ${color}`}> 建议每个环节至少 2 条素材。</span>
      </div>
    );
  }

  // Post-generation coverage summary
  if (slides.length === 0) return null;

  const { totalSteps, missingSteps, suggestions } = parseCoverage(slides);
  const sufficientCount = totalSteps - missingSteps.length;

  if (missingSteps.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-xs text-green-700">
        ✓ 素材覆盖：{totalSteps}/{totalSteps} 环节充足
      </div>
    );
  }

  const borderColor = missingSteps.length >= 3
    ? "border-red-200"
    : "border-amber-200";
  const bgColor = missingSteps.length >= 3
    ? "bg-red-50"
    : "bg-amber-50";
  const textColor = missingSteps.length >= 3
    ? "text-red-700"
    : "text-amber-700";
  const icon = missingSteps.length >= 3 ? "✗" : "⚠️";

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} px-4 py-2 text-xs ${textColor}`}>
      {icon} 素材覆盖：{sufficientCount}/{totalSteps} 环节充足。
      「{missingSteps.join("」「")}」环节素材不足
      {suggestions.length > 0 && `，建议补充：${suggestions.join("；")}`}
    </div>
  );
}
