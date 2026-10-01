export type SearchValue = string | number | boolean | null | undefined;

function normalizeSearchValue(value: SearchValue) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
    .replace(/\s+/g, " ");
}

export function matchesSearch(query: string, values: SearchValue[]) {
  const terms = normalizeSearchValue(query).split(" ").filter(Boolean);
  if (terms.length === 0) return true;

  const searchableText = values.map(normalizeSearchValue).join(" ");
  return terms.every((term) => searchableText.includes(term));
}
