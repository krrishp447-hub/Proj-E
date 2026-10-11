/** Index of the item whose centre is closest to `mid` (the viewport centre of the track). */
export function nearestIndex(centers: number[], mid: number): number {
  let best = 0;
  for (let i = 1; i < centers.length; i++) {
    if (Math.abs(centers[i] - mid) < Math.abs(centers[best] - mid)) best = i;
  }
  return best;
}

export const clampIndex = (i: number, length: number) => Math.max(0, Math.min(length - 1, i));
