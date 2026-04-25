import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AccessGate } from "@/components/share/AccessGate";
import { Watermark } from "@/components/share/Watermark";
import {
  getAccessGrantByToken,
  getShareLinkByToken,
  getTrainingPageById
} from "@/server/share/access";

export default async function SharePage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shareLink = await getShareLinkByToken(token);

  if (!shareLink) {
    notFound();
  }

  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(`knowledgecast_access_${token}`)?.value;
  const grant = accessCookie ? await getAccessGrantByToken(accessCookie) : null;

  if (!grant || grant.shareLinkId !== shareLink.id) {
    return <AccessGate token={token} />;
  }

  const trainingPage = await getTrainingPageById(shareLink.trainingPageId);
  const outline = trainingPage ? JSON.parse(trainingPage.outlineJson) : [];
  const content = trainingPage ? JSON.parse(trainingPage.contentJson) : [];

  return (
    <main className="min-h-screen bg-[#f8f7f3] px-6 py-12 text-black">
      <article className="mx-auto max-w-4xl rounded-[2rem] border border-black/10 bg-white px-6 py-10 shadow-[0_30px_120px_-60px_rgba(0,0,0,0.35)] sm:px-10">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-black/40">
          Internal Training
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
          {trainingPage?.title ?? "Training page not generated yet"}
        </h1>

        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-[0.24em] text-black/40">
            Outline
          </h2>
          <ul className="mt-4 space-y-3">
            {outline.length > 0 ? (
              outline.map((item: string) => (
                <li key={item} className="rounded-2xl bg-black/5 px-4 py-3">
                  {item}
                </li>
              ))
            ) : (
              <li className="rounded-2xl bg-black/5 px-4 py-3 text-black/50">
                Outline will appear after AI generation.
              </li>
            )}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-[0.24em] text-black/40">
            Content
          </h2>
          <div className="mt-4 space-y-4 text-base leading-7 text-black/75">
            {content.length > 0 ? (
              content.map((block: string, index: number) => <p key={`${index}-${block}`}>{block}</p>)
            ) : (
              <p>Content will appear after AI generation.</p>
            )}
          </div>
        </section>
      </article>

      <Watermark email={grant.email} />
    </main>
  );
}
