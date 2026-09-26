import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { database } from "@/lib/db";
import { codeHistory } from "@/lib/service";
import { AppError } from "@/lib/domain";
import { pageNumber } from "@/lib/http";
import { Lookup } from "@/components/lookup";
import { Notice } from "@/components/ui";
import { Capsules } from "@/components/capsules";
import { entryStatus } from "@/lib/entry-status";
export const dynamic = "force-dynamic";
export const metadata = { title: "Entry history" };
export default async function CodePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const code = (await params).code.toLowerCase();
  const page = pageNumber((await searchParams).page);
  let history;
  try {
    history = await codeHistory(await database(), code, page);
  } catch (error) {
    if (error instanceof AppError)
      return (
        <>
          <h1>Check that code.</h1>
          <Notice error>{error.message}</Notice>
          <Lookup />
        </>
      );
    throw error;
  }
  return (
    <>
      <Link className="back-link" href="/results">
        <ArrowLeft size={16} />
        Results
      </Link>
      <section className="page-heading">
        <span className="eyebrow">Your anonymous receipt</span>
        <h1>Every try, accounted for.</h1>
        <code className="full-code">{code}</code>
      </section>
      <div className="pity-grid">
        {history.pity.map((p) => (
          <article className="pity-card" key={p.series_id}>
            <span className="eyebrow">{p.name}</span>
            <strong>
              {1 + Math.min(5, p.losses)}
              <small>chances next time</small>
            </strong>
            <Capsules count={1 + Math.min(5, p.losses)} />
            <p>
              {p.losses} past loss{p.losses === 1 ? "" : "es"} · 6 chances
              maximum
            </p>
          </article>
        ))}
      </div>
      <div
        className="table-scroll"
        role="region"
        aria-label="Entry history"
        tabIndex={0}
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>Drop</th>
              <th>Chances</th>
              <th>Outcome</th>
              <th>Loss count</th>
            </tr>
          </thead>
          <tbody>
            {history.entries.length ? (
              history.entries.map((e) => (
                <tr key={e.drop_id}>
                  <td>
                    <Link href={`/drops/${e.drop_id}`}>{e.title}</Link>
                    {e.is_setup ? (
                      <span className="setup-label">Local setup</span>
                    ) : null}
                  </td>
                  <td>{e.tickets}</td>
                  <td>
                    {entryStatus(e)}
                    {e.sui_status === "pending" &&
                    e.drop_state === "settled" ? (
                      <p className="small muted">
                        This entry did not reach Sui. No loss was added.
                      </p>
                    ) : null}
                  </td>
                  <td>
                    {e.losses_before === null
                      ? "—"
                      : `${e.losses_before} → ${e.losses_after}`}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="table-empty" colSpan={4}>
                  No entries found for this code. Check your receipt or enter a
                  drop first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span>
          {history.total} entries · Page {page}
        </span>
        <div>
          {page > 1 ? <Link href={`?page=${page - 1}`}>Previous</Link> : null}
          {page * 20 < history.total ? (
            <Link href={`?page=${page + 1}`}>Next</Link>
          ) : null}
        </div>
      </div>
      <section className="standalone-lookup">
        <Lookup initial={code} />
      </section>
    </>
  );
}
