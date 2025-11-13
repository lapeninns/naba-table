import Link from "next/link";

import { categories } from "../_assets/content";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog categories · SajiloReserveX",
  description: "Jump into curated categories covering product updates, tutorials, and reservation strategy.",
};

export default function BlogCategoryDirectory() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-12">
      <header className="space-y-2 text-center">
        <p className="text-sm font-semibold text-primary">Categories</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Browse by topic</h1>
        <p className="text-base text-slate-600">
          Every post is organized so you can quickly find the tutorials or feature updates you need.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        {categories.map((category) => (
          <article key={category.slug} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{category.title}</h2>
            <p className="text-sm text-slate-600">{category.description}</p>
            <Link
              href={`/blog/category/${category.slug}`}
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
