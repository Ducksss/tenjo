import Link from "next/link";
import { AdminForm } from "@/components/admin-form";
export const metadata = { title: "Create a drop" };
export default function Admin() {
  return (
    <>
      <section className="page-heading">
        <span className="eyebrow">For organisers</span>
        <h1>Make room for real fans.</h1>
        <p>Choose the item, set the window, and let every entry count.</p>
      </section>
      <div className="organiser-note">
        You’ll need your team’s organiser password to publish. Just exploring?{" "}
        <Link href="/demo">Try the walkthrough without an account.</Link>
      </div>
      <section className="admin-panel">
        <AdminForm />
      </section>
    </>
  );
}
