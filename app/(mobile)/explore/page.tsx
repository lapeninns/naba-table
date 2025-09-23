"use client";
import { useState, useEffect } from "react";
import SearchBar from "@/components/mobile/SearchBar";
import CategoryTab from "@/components/mobile/CategoryTab";
import ExperienceCard from "@/components/mobile/ExperienceCard";

const categories = ["Homes", "Experiences", "Beach", "Mountains", "City"]; 

const sample = new Array(6).fill(0).map((_, i) => ({
  id: String(i + 1),
  title: ["Cozy apartment in Paris", "Beachfront villa", "Mountain cabin retreat", "Urban loft", "Countryside home", "Designer studio"][i % 6]!,
  location: ["Paris, France", "Bali, Indonesia", "Aspen, USA", "Tokyo, Japan", "Tuscany, Italy", "Copenhagen, Denmark"][i % 6]!,
  price: ["$120/night", "$350/night", "$220/night", "$180/night", "$200/night", "$140/night"][i % 6]!,
  rating: 4 + (i % 2 ? 0.6 : 0.2),
  img: `/images/sample-${(i % 3) + 1}.jpg`,
}));

export default function ExplorePage() {
  const [activeCat, setActiveCat] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="screen-transition">
      <header className="sticky top-0 z-10 bg-[color:var(--color-background)]/80 backdrop-blur py-3 shadow-header">
        <div className="mx-auto max-w-[393px] px-[var(--screen-margin)]">
          <h1 className="text-screen-title">Explore</h1>
          <div className="mt-3">
            <SearchBar />
          </div>
          <div className="mt-3 flex items-center gap-2 overflow-x-auto">
            {categories.map((label, i) => (
              <CategoryTab key={label} label={label} active={activeCat === i} onClick={() => setActiveCat(i)} />
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[393px] px-[var(--screen-margin)] py-4">
        <div className="grid grid-cols-1 gap-4">
          {sample.map((c) => (
            <div key={c.id} className={loading ? "loading rounded-[var(--radius-lg)]" : undefined}>
              <ExperienceCard
                title={c.title}
                location={c.location}
                price={c.price}
                rating={c.rating}
                imgSrc={c.img}
                imgAlt={`${c.title} in ${c.location}`}
                onClick={() => (window.location.href = `/experience/${c.id}`)}
              />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

