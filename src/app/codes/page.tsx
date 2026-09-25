import { Lookup } from "@/components/lookup";
export const metadata = { title: "My entries" };
export default function Codes() {
  return (
    <>
      <section className="page-heading">
        <span className="eyebrow">EVERY TRY IS PART OF YOUR STORY</span>
        <h1>Find your next chance.</h1>
        <p>
          Your anonymous code links your entries and results. No account, email
          or password needed.
        </p>
      </section>
      <section className="code-panel">
        <Lookup />
        <p className="muted small">
          Your full code appears after a successful entry. It is public, and
          anyone with it can view your history across series.
        </p>
      </section>
    </>
  );
}
