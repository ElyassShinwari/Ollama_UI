/** If the model is stuck repeating, return a cutoff index to keep. */
export function repetitionCutoff(text: string): number | null {
  if (text.length < 48) return null;

  const lines = text.split(/\n/);
  if (lines.length >= 4) {
    const last = lines.filter((l) => l.trim().length > 0).slice(-4);
    if (last.length === 4 && last.every((l) => l === last[0]) && last[0]!.trim().length >= 8) {
      const keep = last[0]!;
      const idx = text.lastIndexOf(keep);
      const first = text.indexOf(keep);
      if (first >= 0 && idx > first) return first + keep.length;
    }
  }

  const minLen = 16;
  const maxLen = Math.min(280, Math.floor(text.length / 3));
  for (let n = maxLen; n >= minLen; n--) {
    const unit = text.slice(-n);
    if (unit.trim().length < 12) continue;
    if (/^[\s/\\|_=.-]+$/.test(unit)) continue;
    let count = 1;
    let pos = text.length - n;
    while (pos >= n && text.slice(pos - n, pos) === unit) {
      count += 1;
      pos -= n;
    }
    if (count >= 3) {
      return pos + n;
    }
  }

  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length >= 3) {
    const a = sentences[sentences.length - 1]!.trim();
    const b = sentences[sentences.length - 2]!.trim();
    const c = sentences[sentences.length - 3]!.trim();
    if (a.length >= 12 && a === b && b === c) {
      const keep = text.lastIndexOf(c);
      if (keep >= 0) return keep + c.length;
    }
  }

  return null;
}
