import { AdminForm } from "@/components/admin-form";
export const metadata = { title: "Create a drop" };
export default function Admin() {
  return (
    <>
      <section className="page-heading">
        <span className="eyebrow">FOR ORGANISERS</span>
        <h1>Make room for real fans.</h1>
        <p>Choose the item, set the window, and let every entry count.</p>
      </section>
      <section className="admin-panel">
        <AdminForm />
      </section>
    </>
  );
}
