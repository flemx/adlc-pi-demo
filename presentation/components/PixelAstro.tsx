"use client";

import * as React from "react";

type Props = {
  /** Final on-screen size in pixels (square). Default 240. */
  size?: number;
  /** Optional alt text. */
  alt?: string;
  /** Optional className for layout positioning. */
  className?: string;
  /** Image src. Defaults to the transparent-PNG Astro in /public/images. */
  src?: string;
};

/**
 * Floating Astro mascot with a smooth bob animation and a soft Salesforce-blue
 * glow. The kept name is historical — the sprite is no longer pixelated; we
 * use the transparent-PNG cutout directly so the glow can wrap the silhouette
 * instead of the JPG's rectangular bounding box.
 */
export function PixelAstro({
  size = 240,
  alt = "Astro mascot",
  className,
  src = "/images/Agent_Astro_55443_Sunglasses_A_008_RGB.png",
}: Props) {
  return (
    <div
      className={`pixel-astro ${className || ""}`}
      style={{ width: size, height: size + 14 /* room for shadow */ }}
      aria-label={alt}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="pixel-astro-sprite"
        src={src}
        alt={alt}
        style={{ width: size, height: size }}
        draggable={false}
      />
      <div className="pixel-astro-shadow" aria-hidden />
    </div>
  );
}
