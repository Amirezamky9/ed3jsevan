import React, { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../utils/motion';

/**
 * FadeInImage — onLoad-driven opacity fade (zero-flash, minimal re-renders).
 *
 * - `loadedSrcs` remembers every src that has finished loading anywhere in
 *   the app so remounts, item steps, and category switches render immediately
 *   at opacity 1 with zero extra renders.
 * - Fallback swaps at most once per requested `src` without chained effects.
 */

const loadedSrcs = new Set<string>();
const decodedSrcs = new Set<string>();

const FADE_MS = 180;

/**
 * Preload and pre-decode an image off the main animation path so the first
 * frame it enters the viewport (e.g. entering 3D Front View) never drops frames.
 */
export function preloadAndDecodeImage(src: string): void {
  if (!src || decodedSrcs.has(src)) return;
  decodedSrcs.add(src);
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  const markLoaded = () => {
    loadedSrcs.add(src);
  };
  if (typeof img.decode === 'function') {
    img.decode().then(markLoaded).catch(() => {
      // Fallback: if decode rejects (e.g. aborted or unsupported), allow retry later
      decodedSrcs.delete(src);
    });
  } else {
    img.onload = markLoaded;
  }
}

/**
 * Maps a full-size menu photo URL to its 256px thumb variant:
 * `src/assets/images/<name>.webp` → `src/assets/images/thumbs/<name>.webp`.
 */
export function toThumbSrc(src: string): string {
  const prefix = 'src/assets/images/';
  if (!src.startsWith(prefix)) return src;
  const rest = src.slice(prefix.length);
  if (rest.includes('/')) return src;
  return `${prefix}thumbs/${rest}?v=5`;
}

/**
 * Maps a desktop cutout image URL to its mobile-sized WebP variant:
 * `src/assets/images/cutouts/<name>.webp` → `src/assets/images/cutouts/mobile/<name>.webp`.
 * Passes through external/backend URLs unchanged so backend uploads keep working.
 */
export function toMobileCutoutSrc(src: string): string {
  const prefix = 'src/assets/images/cutouts/';
  if (!src.startsWith(prefix)) return src;
  const rest = src.slice(prefix.length);
  if (rest.includes('/')) return src;
  return `${prefix}mobile/${rest}`;
}

/**
 * Returns true if the URL is one of our pre-baked RGBA topdown plates
 * (which already have brightness/contrast/radial-alpha baked into the WebP
 * so the GPU doesn't need live mix-blend-mode + filter + mask-image).
 */
export function isPrebakedTopdownSrc(src: string): boolean {
  return (
    src.startsWith('src/assets/images/topdown_') ||
    src.startsWith('src/assets/images/thumbs/topdown_')
  );
}

/** Intrinsic desktop dimensions of bundled cutouts to prevent layout shift. */
const CUTOUT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  'americano.webp': { width: 398, height: 540 },
  'berry_shake.webp': { width: 199, height: 540 },
  'blue_spirulina.webp': { width: 190, height: 540 },
  'brazilian-lemonade.webp': { width: 274, height: 540 },
  'caramel-macchiato.webp': { width: 806, height: 592 },
  'choco_shake.webp': { width: 199, height: 540 },
  'chocolate-milkshake.webp': { width: 279, height: 540 },
  'eyvan_berry_milkshake.webp': { width: 210, height: 540 },
  'eyvan_pina_colada_milkshake.webp': { width: 210, height: 540 },
  'eyvan_nutella_milkshake.webp': { width: 208, height: 540 },
  'eyvan_espresso_milkshake.webp': { width: 206, height: 540 },
  'eyvan_peanut_butter_milkshake.webp': { width: 209, height: 540 },
  'eyvan_lotus_milkshake.webp': { width: 205, height: 540 },
  'green_mojito.webp': { width: 247, height: 540 },
  'eyvan_green_rush.webp': { width: 374, height: 540 },
  'eyvan_coco_paradise.webp': { width: 237, height: 540 },
  'eyvan_red_mojito_v2.webp': { width: 194, height: 540 },
  'eyvan_khiar_sekanjabin.webp': { width: 230, height: 540 },
  'eyvan_bahar_narenj_v2.webp': { width: 251, height: 540 },
  'eyvan_bidmeshk.webp': { width: 254, height: 540 },
  'eyvan_green_tea_cold.webp': { width: 279, height: 540 },
  'eyvan_hot_spirulina_v3.webp': { width: 672, height: 497 },
  'eyvan_matcha_latte_v2_v3.webp': { width: 558, height: 459 },
  'eyvan_hot_matcha_v3.webp': { width: 799, height: 540 },
  'eyvan_iced_spirulina.webp': { width: 279, height: 540 },
  'eyvan_strawberry_matcha_v2.webp': { width: 269, height: 540 },
  'eyvan_iced_matcha_latte_v3.webp': { width: 271, height: 540 },
  'eyvan_iced_matcha_v3.webp': { width: 275, height: 540 },
  'hot-chocolate.webp': { width: 806, height: 618 },
  'hot-chocolate_v2.webp': { width: 806, height: 618 },
  'hot_chocolate.webp': { width: 806, height: 559 },
  'hot_espresso.webp': { width: 688, height: 513 },
  'eyvan_espresso_v2.webp': { width: 709, height: 540 },
  'hot_latte.webp': { width: 806, height: 511 },
  'hot_mocha.webp': { width: 806, height: 511 },
  'iced-americano.webp': { width: 384, height: 540 },
  'iced-espresso.webp': { width: 414, height: 540 },
  'iced-latte.webp': { width: 272, height: 540 },
  'iced_espresso.webp': { width: 190, height: 540 },
  'iced_latte.webp': { width: 190, height: 540 },
  'latte.webp': { width: 806, height: 569 },
  'matcha_latte.webp': { width: 190, height: 540 },
  'mojito.webp': { width: 300, height: 540 },
  'peach-iced-tea.webp': { width: 206, height: 540 },
  'persian_cold.webp': { width: 247, height: 540 },
  'eyvan_iced_saffron_tea.webp': { width: 297, height: 540 },
  'persian_tea.webp': { width: 603, height: 514 },
  'red-love.webp': { width: 333, height: 540 },
  'red_mocktail.webp': { width: 254, height: 540 },
  'rokato.webp': { width: 721, height: 692 },
  'strawberry_matcha.webp': { width: 190, height: 540 },
  'farang-herbal.webp': { width: 529, height: 540 },
  'white-hot-chocolate.webp': { width: 632, height: 540 },
  'white-hot-chocolate_v2.webp': { width: 632, height: 540 },
  'hot-lotus.webp': { width: 639, height: 540 },
  'hot-lotus_v2.webp': { width: 639, height: 540 },
  'hot-nutella.webp': { width: 614, height: 540 },
  'hot-nutella_v2.webp': { width: 614, height: 540 },
  'hot-almond.webp': { width: 619, height: 540 },
  'hot-almond_v2.webp': { width: 619, height: 540 },
  'carrot-milk.webp': { width: 668, height: 540 },
  'carrot-milk_v2.webp': { width: 668, height: 540 },
  'lemonade.webp': { width: 300, height: 540 },
  'farkhondeh-herbal.webp': { width: 538, height: 540 },
  'iran-herbal.webp': { width: 528, height: 540 },
  'narineh-herbal.webp': { width: 493, height: 540 },
  'shazdeh-herbal.webp': { width: 806, height: 798 },
  'lalehzar-herbal.webp': { width: 509, height: 540 },
  'tea.webp': { width: 523, height: 540 },
  'saffron-tea.webp': { width: 534, height: 540 },
  'eyvan_cortado.webp': { width: 798, height: 540 },
  'eyvan_croissant_v2.webp': { width: 755, height: 415 },
  'eyvan_croissant_v3.webp': { width: 947, height: 540 },
  'eyvan_croissant_v4.webp': { width: 830, height: 540 },
  'eyvan_croissant_v5.webp': { width: 860, height: 540 },
  'eyvan_croissant_v6.webp': { width: 822, height: 540 },
  'eyvan_iced_pomegranate_spirulina_v12.webp': { width: 267, height: 531 },
  'eyvan_chocolate_twist_v2.webp': { width: 957, height: 246 },
  'eyvan_chocolate_cheesecake_v3.webp': { width: 685, height: 439 },
  'eyvan_chocolate_cheesecake_v4.webp': { width: 830, height: 540 },
  'eyvan_chocolate_cheesecake_v5.webp': { width: 830, height: 540 },
  'eyvan_chocolate_cheesecake_v6.webp': { width: 772, height: 540 },
  'eyvan_chocolate_cheesecake_v7.webp': { width: 772, height: 540 },
  'eyvan_cake_of_day.webp': { width: 565, height: 540 },
  'eyvan_cappuccino.webp': { width: 714, height: 540 },
  'eyvan_mocha.webp': { width: 721, height: 540 },
  'eyvan_hot_mocha.webp': { width: 708, height: 540 },
  'eyvan_pumpkin_latte.webp': { width: 718, height: 540 },
  'eyvan_carrot_latte.webp': { width: 724, height: 540 },
  'eyvan_caramel_tea.webp': { width: 544, height: 540 },
  'tea-baklava.webp': { width: 597, height: 540 },
  'eyvan_iced_caramel.webp': { width: 275, height: 540 },
  'eyvan_iced_mocha.webp': { width: 272, height: 540 },
  'eyvan_iced_coconut_latte.webp': { width: 260, height: 540 },
  'eyvan_eyvan_iced_latte.webp': { width: 269, height: 540 },
  'eyvan_iced_date_latte.webp': { width: 270, height: 540 },
  'eyvan_red_fizz.webp': { width: 313, height: 540 },
  'eyvan_affogato.webp': { width: 392, height: 540 },
  'eyvan_bidmeshk_v2.webp': { width: 267, height: 540 },
  'eyvan_khiar_sekanjabin_v2.webp': { width: 267, height: 540 },
  'eyvan_khiar_sekanjabin_v3.webp': { width: 427, height: 540 },
  'eyvan_khiar_sekanjabin_v4.webp': { width: 426, height: 540 },
  'eyvan_khiar_sekanjabin_v5.webp': { width: 426, height: 540 },
  'eyvan_chocolate_milkshake_v2.webp': { width: 206, height: 540 },
  'eyvan_hot_spirulina_v4.webp': { width: 675, height: 540 },
  'eyvan_hot_matcha_v4.webp': { width: 614, height: 540 },
  'eyvan_matcha_latte_v4.webp': { width: 711, height: 540 },
  'eyvan_red_mojito_v3.webp': { width: 293, height: 540 },
  'eyvan_coco_paradise_v2.webp': { width: 272, height: 540 },
};

export function getCutoutDimensions(
  src: string,
): { width: number; height: number } | undefined {
  const filename = src.split('/').pop();
  return filename ? CUTOUT_DIMENSIONS[filename] : undefined;
}

/**
 * Measured glass-foot width as a fraction of the cutout image height
 * (alpha scan of the bottom 8% rows, 2026-11-24). The standing-drink
 * grounding shadow is sized from the real foot, not from a fixed
 * aspect guess: the old 0.29 (tall) / 0.64 (cup) constants are wrong
 * for the wide new cutouts — a rocks-glass foot is ~0.55-0.71 of its
 * height, a wide mug photo only ~0.47-0.52 — which left the new
 * glasses floating above a too-narrow shadow (tall) or under a
 * too-wide one (cups). Files not listed here keep the old constants
 * via the caller's fallback.
 */
const CUTOUT_FOOT_ASPECT: Record<string, number> = {
  'eyvan_coco_paradise.webp': 0.317,
  'eyvan_red_mojito_v2.webp': 0.315,
  'eyvan_khiar_sekanjabin.webp': 0.363,
  'eyvan_bahar_narenj_v2.webp': 0.372,
  'eyvan_bidmeshk.webp': 0.422,
  'eyvan_green_tea_cold.webp': 0.433,
  'eyvan_hot_spirulina_v3.webp': 0.74,
  'eyvan_matcha_latte_v2_v3.webp': 0.745,
  'eyvan_hot_matcha_v3.webp': 1.048,
  'eyvan_iced_spirulina.webp': 0.437,
  'eyvan_strawberry_matcha_v2.webp': 0.43,
  'eyvan_iced_matcha_latte_v3.webp': 0.424,
  'eyvan_iced_matcha_v3.webp': 0.428,
  'eyvan_green_rush.webp': 0.496,
  'eyvan_iced_saffron_tea.webp': 0.496,
  'americano.webp': 0.61,
  'brazilian-lemonade.webp': 0.36,
  'caramel-macchiato.webp': 0.47,
  'chocolate-milkshake.webp': 0.29,
  'eyvan_berry_milkshake.webp': 0.354,
  'eyvan_pina_colada_milkshake.webp': 0.354,
  'eyvan_nutella_milkshake.webp': 0.346,
  'eyvan_espresso_milkshake.webp': 0.344,
  'eyvan_peanut_butter_milkshake.webp': 0.343,
  'eyvan_lotus_milkshake.webp': 0.337,
  'hot-chocolate.webp': 0.52,
  'eyvan_espresso_v2.webp': 0.47,
  'hot-chocolate_v2.webp': 0.52,
  'iced-americano.webp': 0.62,
  'iced-espresso.webp': 0.71,
  'iced-latte.webp': 0.39,
  'latte.webp': 0.52,
  'mojito.webp': 0.35,
  'peach-iced-tea.webp': 0.32,
  'red-love.webp': 0.39,
  'rokato.webp': 0.55,
  'farang-herbal.webp': 0.63,
  'white-hot-chocolate.webp': 0.27,
  'white-hot-chocolate_v2.webp': 0.27,
  'hot-lotus.webp': 0.35,
  'hot-lotus_v2.webp': 0.35,
  'hot-nutella.webp': 0.32,
  'hot-nutella_v2.webp': 0.32,
  'hot-almond.webp': 0.23,
  'hot-almond_v2.webp': 0.23,
  'carrot-milk.webp': 0.29,
  'carrot-milk_v2.webp': 0.29,
  'lemonade.webp': 0.43,
  'farkhondeh-herbal.webp': 0.65,
  'iran-herbal.webp': 0.63,
  'narineh-herbal.webp': 0.59,
  'shazdeh-herbal.webp': 0.64,
  'lalehzar-herbal.webp': 0.61,
  'tea.webp': 0.61,
  'saffron-tea.webp': 0.62,
  'eyvan_cortado.webp': 0.6,
  'eyvan_croissant_v2.webp': 1.67,
  'eyvan_croissant_v3.webp': 1.381,
  'eyvan_croissant_v4.webp': 1.493,
  'eyvan_croissant_v5.webp': 1.563,
  'eyvan_croissant_v6.webp': 1.496,
  'eyvan_iced_pomegranate_spirulina_v12.webp': 0.414,
  'eyvan_chocolate_twist_v2.webp': 3.5,
  'eyvan_chocolate_cheesecake_v3.webp': 1.339,
  'eyvan_chocolate_cheesecake_v4.webp': 1.331,
  'eyvan_chocolate_cheesecake_v5.webp': 1.331,
  'eyvan_chocolate_cheesecake_v6.webp': 1.4,
  'eyvan_chocolate_cheesecake_v7.webp': 1.4,
  'eyvan_cake_of_day.webp': 0.82,
  'eyvan_cappuccino.webp': 0.5,
  'eyvan_mocha.webp': 0.48,
  'eyvan_hot_mocha.webp': 0.52,
  'eyvan_pumpkin_latte.webp': 0.47,
  'eyvan_carrot_latte.webp': 0.53,
  'eyvan_caramel_tea.webp': 0.53,
  'tea-baklava.webp': 0.72,
  'eyvan_iced_caramel.webp': 0.38,
  'eyvan_iced_mocha.webp': 0.38,
  'eyvan_iced_coconut_latte.webp': 0.378,
  'eyvan_eyvan_iced_latte.webp': 0.367,
  'eyvan_iced_date_latte.webp': 0.378,
  'eyvan_red_fizz.webp': 0.411,
  'eyvan_affogato.webp': 0.624,
  'eyvan_bidmeshk_v2.webp': 0.367,
  'eyvan_khiar_sekanjabin_v2.webp': 0.365,
  'eyvan_khiar_sekanjabin_v3.webp': 0.404,
  'eyvan_khiar_sekanjabin_v4.webp': 0.400,
  'eyvan_khiar_sekanjabin_v5.webp': 0.400,
  'eyvan_chocolate_milkshake_v2.webp': 0.35,
  'eyvan_hot_spirulina_v4.webp': 0.426,
  'eyvan_hot_matcha_v4.webp': 0.439,
  'eyvan_matcha_latte_v4.webp': 0.461,
  'eyvan_red_mojito_v3.webp': 0.37,
  'eyvan_coco_paradise_v2.webp': 0.354,
};

export function getCutoutFootAspect(src: string): number | undefined {
  const filename = src.split('/').pop();
  return filename ? CUTOUT_FOOT_ASPECT[filename] : undefined;
}

interface FadeInImageProps
  extends Omit<
    React.ImgHTMLAttributes<HTMLImageElement>,
    'onLoad' | 'src' | 'alt'
  > {
  src: string;
  alt: string;
  /**
   * Backup image used if `src` fails to load. Swaps at most once; a
   * failure of the fallback itself is handed to `onError` (if any).
   */
  fallbackSrc?: string;
}

export const FadeInImage: React.FC<FadeInImageProps> = ({
  src,
  alt,
  fallbackSrc,
  className,
  style,
  onError,
  ...rest
}) => {
  // Track which requested `src` has already fallen back (single-state, zero effect cascade)
  const [failedForSrc, setFailedForSrc] = useState<string | null>(null);
  const currentSrc =
    failedForSrc === src && fallbackSrc && fallbackSrc !== src
      ? fallbackSrc
      : src;

  const isAlreadyLoaded =
    loadedSrcs.has(currentSrc) || prefersReducedMotion();
  const [loadedSrcState, setLoadedSrcState] = useState<string | null>(
    isAlreadyLoaded ? currentSrc : null,
  );
  const imgRef = useRef<HTMLImageElement | null>(null);

  const loaded = isAlreadyLoaded || loadedSrcState === currentSrc;

  useEffect(() => {
    if (loaded) return;
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      loadedSrcs.add(currentSrc);
      setLoadedSrcState(currentSrc);
    }
  }, [currentSrc, loaded]);

  const handleLoad = () => {
    loadedSrcs.add(currentSrc);
    setLoadedSrcState(currentSrc);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (fallbackSrc && failedForSrc !== src && currentSrc !== fallbackSrc) {
      setFailedForSrc(src);
      return;
    }
    onError?.(e);
  };

  return (
    <img
      ref={imgRef}
      src={currentSrc}
      alt={alt}
      onLoad={handleLoad}
      onError={handleError}
      className={className}
      style={{
        opacity: loaded ? 1 : 0,
        transition: loaded ? undefined : `opacity ${FADE_MS}ms ease-out`,
        ...style,
      }}
      {...rest}
    />
  );
};
