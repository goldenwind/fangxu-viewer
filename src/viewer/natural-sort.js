/**
 * Natural sort comparator matching Rust chunking logic
 * e.g. "img1.png", "img2.png", "img10.png"
 */
export function naturalCompare(a, b) {
  const ax = [];
  const bx = [];

  const strA = String(a || '');
  const strB = String(b || '');

  strA.replace(/(\d+)|(\D+)/g, (_, num, nonNum) => {
    ax.push(num ? [0, BigInt(num)] : [1, nonNum.toLowerCase()]);
  });

  strB.replace(/(\d+)|(\D+)/g, (_, num, nonNum) => {
    bx.push(num ? [0, BigInt(num)] : [1, nonNum.toLowerCase()]);
  });

  const len = Math.min(ax.length, bx.length);
  for (let i = 0; i < len; i += 1) {
    const [typeA, valA] = ax[i];
    const [typeB, valB] = bx[i];

    if (typeA !== typeB) {
      return typeA - typeB;
    }

    if (valA < valB) return -1;
    if (valA > valB) return 1;
  }

  if (ax.length !== bx.length) {
    return ax.length - bx.length;
  }

  return strA.localeCompare(strB);
}
