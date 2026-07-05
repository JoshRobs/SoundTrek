export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // strip accents
    .replace(/[''']/g, '')   // remove apostrophes before slugifying
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
