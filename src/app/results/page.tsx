import Link from "next/link";
import { ArrowUpRight, ScanLine } from "lucide-react";
import { database } from "@/lib/db";
import { listDrops } from "@/lib/service";
import { dropStatus, formatJST, statusLabel } from "@/lib/format";
import { pageNumber } from "@/lib/http";
import { suiStatus } from "@/lib/sui-status";
import { Lookup } from "@/components/lookup";
export const dynamic = "force-dynamic";
export const metadata = { title: "Results" };
/** Your own history by code, then every drop's public record: one page for "did I win?" and "who won?". */
export default async function Results({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = pageNumber((await searchParams).page);
  const drops = await listDrops(await database(), 21, (page - 1) * 20);
  const sui = suiStatus();
  return (
    <>
      <section className="page-heading">
        <span className="eyebrow">Results · open to everyone</span>
        <h1>Did you win? It’s on the record.</h1>
        <p>
          Look up your own entries with the code from your receipt, or open any
          drop to see every entry, chance and winner.
        </p>
      </section>
      <section className="lookup-section" aria-labelledby="lookup-heading">
        <div>
          <span className="chip">Your entries</span>
          <h2 id="lookup-heading">Kept your code?</h2>
          <p>
            See your entries, results and next chances. No account, email or
            password needed.
          </p>
        </div>
        <div>
          <Lookup />
          <p className="lookup-note">
            Your code appears on your receipt after you enter a drop. It’s
            public: anyone who has it can see your history across series.
          </p>
        </div>
      </section>
      <section className="results-drops" aria-labelledby="drops-heading">
        <div className="section-header">
          <h2 id="drops-heading">Every drop</h2>
        </div>
        <div className="audit-intro">
          <ScanLine size={24} />
          <p>
            {sui.ready
              ? "Drops drawn on Sui link their randomness, refunds and loss counts to real transactions on the drop page. Drops without a Sui record were drawn on Tenjō’s server, which still asks you to trust the operator."
              : "These records are held on Tenjō’s server. They make every draw inspectable, but still ask you to trust the operator. Moving the draw to Sui is the next phase."}
          </p>
        </div>
        <div className="record-list">
          {drops.length ? (
            drops.slice(0, 20).map((drop) => (
              <Link href={`/drops/${drop.id}#record`} key={drop.id}>
                <div>
                  <span className="eyebrow">
                    {drop.series_name}
                    {drop.is_demo ? " · Local demo" : ""}
                  </span>
                  <h3>{drop.title}</h3>
                  <span>
                    {formatJST(drop.closes_at)} · {drop.entry_count} entries
                  </span>
                </div>
                <span className="record-list-end">
                  <span className="pill">{statusLabel[dropStatus(drop)]}</span>
                  <ArrowUpRight size={23} />
                </span>
              </Link>
            ))
          ) : (
            <div className="empty-state">
              <h3>No drops recorded yet.</h3>
              <p>
                Real entries and results appear here after the first drop. In
                the meantime, follow an example ballot from entry to pickup.
              </p>
              <Link className="button" href="/#how">
                See how it works
              </Link>
            </div>
          )}
        </div>
        <div className="pagination">
          <span>Page {page}</span>
          <div>
            {page > 1 ? <Link href={`?page=${page - 1}`}>Previous</Link> : null}
            {drops.length > 20 ? (
              <Link href={`?page=${page + 1}`}>Next</Link>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
