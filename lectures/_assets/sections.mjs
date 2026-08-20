/* Section ids for lectures: derived from each <h2 data-mark> heading, shared by
   the build (writes id attributes) and the validator (checks question anchors). */
export const slug = (text) =>
  text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, 'and')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const H2 = /<h2([^>]*data-mark="[^"]*"[^>]*)>([\s\S]*?)<\/h2>/g

export const sectionsOf = (fragment) => {
  const out = []
  for (const m of fragment.matchAll(H2)) out.push({ id: slug(m[2]), title: m[2].replace(/<[^>]+>/g, '') })
  return out
}

/** Adds id="…" to every data-mark heading that lacks one. */
export const withIds = (fragment) =>
  fragment.replace(H2, (all, attrs, inner) => (/\sid=/.test(attrs) ? all : `<h2${attrs} id="${slug(inner)}">${inner}</h2>`))
