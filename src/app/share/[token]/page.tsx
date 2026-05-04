import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AccessGate } from "@/components/share/AccessGate";
import { Watermark } from "@/components/share/Watermark";
import {
  getAccessGrantByToken,
  getShareLinkByToken,
  getTrainingPageById
} from "@/server/share/access";
import { BUILT_IN_FRAMEWORKS } from "@/server/training/frameworks";

type Slide = {
  title: string;
  bullets: string[];
  speakerNotes: string;
  estimatedMinutes: number;
};

function TrainingContent({
  trainingPage,
  email,
  isPreview
}: {
  trainingPage: Awaited<ReturnType<typeof getTrainingPageById>>;
  email: string;
  isPreview: boolean;
}) {
  let slides: Slide[] = [];
  let outline: string[] = [];
  let content: string[] = [];
  let frameworkName = "";

  if (trainingPage) {
    if (trainingPage.slidesJson) {
      try {
        const parsed = JSON.parse(trainingPage.slidesJson);
        slides = parsed.slides ?? [];
        frameworkName = BUILT_IN_FRAMEWORKS.find((f) => f.id === parsed.framework)?.name ?? "";
      } catch {
        // fallback
      }
    }
    if (slides.length === 0) {
      outline = JSON.parse(trainingPage.outlineJson ?? "[]") as string[];
      content = JSON.parse(trainingPage.contentJson ?? "[]") as string[];
    }
  }

  const showSlides = slides.length > 0;
  const totalMinutes = slides.reduce((sum, s) => sum + (s.estimatedMinutes ?? 0), 0);

  return (
    <main className="min-h-screen bg-gray-50 px-8 py-12 text-gray-900">
      {isPreview && (
        <div className="mx-auto max-w-3xl mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-700">
          预览模式 — 正式分享时学员需要邮箱验证
        </div>
      )}

      <article className="mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            内部培训资料
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            {trainingPage?.title ?? "未生成"}
          </h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
            {frameworkName && <span>框架：{frameworkName}</span>}
            {showSlides && <span>{slides.length} 页幻灯片</span>}
            {totalMinutes > 0 && <span>约 {totalMinutes} 分钟</span>}
          </div>
        </div>

        {showSlides ? (
          <div className="space-y-6">
            {slides.map((slide, i) => (
              <section
                key={i}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                      {i + 1}
                    </span>
                    <h2 className="text-lg font-bold">{slide.title}</h2>
                  </div>
                  <span className="text-xs text-gray-400">{slide.estimatedMinutes} min</span>
                </div>

                <ul className="space-y-2">
                  {slide.bullets.map((bullet, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-3 text-sm leading-relaxed text-gray-700"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                      {bullet}
                    </li>
                  ))}
                </ul>

                {slide.speakerNotes && (
                  <details className="mt-4" open>
                    <summary className="cursor-pointer text-xs font-medium text-gray-400 hover:text-gray-600">
                      讲者备注
                    </summary>
                    <p className="mt-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 text-sm leading-relaxed text-gray-600">
                      {slide.speakerNotes}
                    </p>
                  </details>
                )}
              </section>
            ))}
          </div>
        ) : (
          <>
            {outline.length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 mb-4">
                  大纲
                </h2>
                <ul className="space-y-2">
                  {outline.map((item: string) => (
                    <li
                      key={item}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {content.length > 0 && (
              <section>
                <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 mb-4">
                  内容
                </h2>
                <div className="space-y-3 text-sm leading-relaxed text-gray-700">
                  {content.map((block: string, i: number) => (
                    <p
                      key={`${i}-${block}`}
                      className="rounded-lg border border-gray-200 bg-white p-4"
                    >
                      {block}
                    </p>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </article>

      <Watermark email={email} />
    </main>
  );
}

export default async function SharePage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { token } = await params;
  const { preview } = await searchParams;
  const isPreview = preview === "1";

  const shareLink = await getShareLinkByToken(token);
  if (!shareLink) notFound();

  const trainingPage = await getTrainingPageById(shareLink.trainingPageId);

  // 预览模式 — 创建者跳过邮箱验证
  if (isPreview) {
    return <TrainingContent trainingPage={trainingPage} email="preview" isPreview />;
  }

  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(`knowledgecast_access_${token}`)?.value;
  const grant = accessCookie ? await getAccessGrantByToken(accessCookie) : null;

  if (!grant || grant.shareLinkId !== shareLink.id) {
    return <AccessGate token={token} />;
  }

  return (
    <TrainingContent
      trainingPage={trainingPage}
      email={grant.email}
      isPreview={false}
    />
  );
}
