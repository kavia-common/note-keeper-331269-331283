/**
 * Normalizes a tag string for comparison and storage.
 * @param {string} tag
 */
function normalizeTag(tag) {
  return String(tag || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * PUBLIC_INTERFACE
 * Extracts a stable set of unique tags from notes.
 * Contract:
 * - Input: array of notes with `tags` as string[]
 * - Output: sorted array of unique tag strings (original casing preserved by first occurrence)
 */
export function extractTags(notes) {
  const map = new Map(); // normalized -> original
  (notes || []).forEach((n) => {
    (n.tags || []).forEach((t) => {
      const norm = normalizeTag(t);
      if (!norm) return;
      if (!map.has(norm)) map.set(norm, String(t).trim());
    });
  });
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}

/**
 * PUBLIC_INTERFACE
 * Filters notes by query and/or tag.
 * Invariants:
 * - Case-insensitive match across title/content/tags.
 */
export function filterNotes(notes, { q, tag } = {}) {
  const query = String(q || "").trim().toLowerCase();
  const tagNorm = normalizeTag(tag || "");

  return (notes || []).filter((n) => {
    const tags = (n.tags || []).map((t) => normalizeTag(t));
    const matchesTag = tagNorm ? tags.includes(tagNorm) : true;

    if (!query) return matchesTag;

    const haystack = `${n.title || ""}\n${n.content || ""}\n${(n.tags || []).join(" ")}`.toLowerCase();
    return matchesTag && haystack.includes(query);
  });
}

/**
 * PUBLIC_INTERFACE
 * Produces a human-friendly preview line for a note.
 */
export function notePreview(note) {
  const raw = String(note?.content || "").trim().replace(/\s+/g, " ");
  if (!raw) return "No content";
  return raw.length > 120 ? `${raw.slice(0, 120)}…` : raw;
}
