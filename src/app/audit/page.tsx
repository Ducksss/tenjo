import Link from "next/link";
import { ArrowUpRight, ScanLine } from "lucide-react";
import { database } from "@/lib/db";
import { listDrops } from "@/lib/service";
import { formatJST } from "@/lib/format";
import { pageNumber } from "@/lib/http";
import { Lookup } from "@/components/lookup";
export const dynamic = "force-dynamic";
export const metadata = { title: "Public record" };
export default async function Audit({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = pageNumber((await searchParams).page);
  const drops = await listDrops(await database(), 21, (page - 1) * 20);
  return (
    <>
      <section className="page-heading">
        <span className="eyebrow">TRUST, WITH RECEIPTS</span>
        <h1>The public record.</h1>
        <p>
          Every entry. Every ticket. Every outcome. Find a drop to inspect the
          full draw.
        </p>
      </section>
      <div className="audit-intro">
        <ScanLine size={24} />
        <p>
          Phase 1 records are held on the server. They make the draw
          inspectable, but still require trust in the operator. Sui verification
          is the next phase.
        </p>
      </div>
      <div className="record-list">
        {drops.length ? (
          drops.slice(0, 20).map((drop) => (
            <Link href={`/drops/${drop.id}#record`} key={drop.id}>
              <div>
                <span className="eyebrow">
                  {drop.series_name}
                  {drop.is_demo ? " · LOCAL DEMO" : ""}
                </span>
                <h2>{drop.title}</h2>
                <span>
                  {formatJST(drop.closes_at)} · {drop.entry_count} entries
                </span>
              </div>
              <span className="record-list-end">
                <span className="pill">
                  {drop.state === "settled" ? "Settled" : "Awaiting draw"}
                </span>
                <ArrowUpRight size={23} />
              </span>
            </Link>
          ))
        ) : (
          <div className="empty-state">
            <h2>No drops recorded yet.</h2>
            <p>
              Real entries and results will appear here after the first drop. In
              the meantime, follow a sample draw from entry to pickup.
            </p>
            <Link className="button" href="/demo">
              Try the walkthrough
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
      <section className="standalone-lookup">
        <Lookup />
      </section>
    </>
  );
}
