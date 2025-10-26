"use client";
import { Heart } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import { cn } from "@/lib/utils";

type Props = {
  title: string;
  location: string;
  price: string;
  rating?: number;
  imgSrc: string;
  imgAlt: string;
  onClick?: () => void;
  onToggleWishlist?: () => void;
  wishlisted?: boolean;
  className?: string;
};

export default function ExperienceCard({
  title,
  location,
  price,
  rating,
  imgSrc,
  imgAlt,
  onClick,
  onToggleWishlist,
  wishlisted,
  className,
}: Props) {
  return (
    <article
      className={cn(
        "experience-card relative overflow-hidden",
        "rounded-[var(--radius-lg)] bg-[color:var(--color-surface)] shadow-card",
        "button-press",
        className,
      )}
      onClick={onClick}
      role="button"
      aria-label={`Open ${title}`}
      tabIndex={0}
    >
      <div className="relative">
        <Image
          src={imgSrc}
          alt={imgAlt}
          width={800}
          height={800}
          className="listing-image aspect-square object-cover"
        />
        <button
          type="button"
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist?.();
          }}
          className={cn(
            "experience-card__wishlist absolute right-3 top-3 grid h-6 w-6 place-items-center",
            "rounded-full bg-white/90 backdrop-blur",
          )}
        >
          <Heart
            className={cn("h-4 w-4", wishlisted ? "fill-[var(--color-primary)] text-[var(--color-primary)]" : "text-black")}
            aria-hidden
          />
        </button>
      </div>
      <div className="experience-card__content px-4 py-3">
        <h3 className="text-card-title line-clamp-1">{title}</h3>
        <p className="mt-1 text-label">{location}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-body font-semibold">{price}</span>
          {rating ? (
            <span className="text-label" aria-label={`Rating ${rating} out of 5`}>
              ⭐ {rating.toFixed(1)}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

