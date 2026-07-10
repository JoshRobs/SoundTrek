export function displayLikes(s: { likes: number; rating_count: number | null }): number {
  return s.likes + (s.rating_count ?? 0)
}
