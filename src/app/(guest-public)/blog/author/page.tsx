import Link from "next/link";

import { authors } from "../_assets/content";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog authors · SajiloReserveX",
  description: "Browse all contributors publishing updates and best practices on the SajiloReserveX blog.",
};

export default function BlogAuthorDirectory() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-12">
      <header className="space-y-2 text-center">
        <p className="text-sm font-semibold text-primary">Authors</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Meet the writers</h1>
        <p className="text-base text-slate-600">
          Explore every contributor and jump into their articles.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        {authors.map((author) => (
          <article key={author.slug} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{author.name}</h2>
            <p className="text-sm text-slate-500">{author.job}</p>
            <p className="mt-2 text-sm text-slate-600">{author.description}</p>
            <Link
              href={`/blog/author/${author.slug}`}
              className="mt-4 inline-flex items-center text-sm font-semibold text-primary transition hover:text-primary/80"
            >
              View posts →
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
