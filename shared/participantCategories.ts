/** Read legacy registrations without requiring a data migration. */
export function participantCategories(p: { categories?: string[]; category?: string | null }): string[] {
  return [...new Set((p.categories ?? (p.category ? [p.category] : [])).map(value => value.trim()).filter(Boolean))];
}

export function categoryLabel(p: { categories?: string[]; category?: string | null }): string {
  return participantCategories(p).join(" · ");
}
