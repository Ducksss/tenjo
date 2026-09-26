import Link from "next/link";
import { AdminForm } from "@/components/admin-form";
import { database } from "@/lib/db";
import { listSeries } from "@/lib/service";
import { suiStatus } from "@/lib/sui-status";
export const dynamic = "force-dynamic";
export const metadata = { title: "Create a drop" };
export default async function Admin() {
  const sui = suiStatus();
  const series = await listSeries(await database());
  return (
    <>
      <section className="page-heading">
        <span className="eyebrow">For organisers</span>
        <h1>Create a drop.</h1>
        <p>
          Say what fans can win, pick its series and choose how long entries
          stay open. Tenjō handles the rest: World ID at entry, a draw anyone
          can run, and an extra chance for everyone who loses.
        </p>
      </section>
      <div className="organiser-note">
        You’ll need your team’s organiser password to publish. Just looking?{" "}
        <Link href="/#how">See how Tenjō works for fans.</Link>
      </div>
      <AdminForm suiNetwork={sui.ready ? sui.network : null} series={series} />
    </>
  );
}
