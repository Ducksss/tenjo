import Link from "next/link";
export default function NotFound() {
  return (
    <section className="page-heading">
      <span className="eyebrow">404 · Not found</span>
      <h1>This drop isn’t here.</h1>
      <p>Check the link or head back to the available drops.</p>
      <Link className="button" href="/">
        Discover drops
      </Link>
    </section>
  );
}
