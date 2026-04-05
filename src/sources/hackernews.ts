export interface HNStory {
  title: string;
  url: string;
  score: number;
  commentCount: number;
  publishedAt: string;
}

export async function searchHackerNews(query: string, limit = 5): Promise<HNStory[]> {
  const encoded = encodeURIComponent(query);
  // 多めに取得してフィルタリング
  const res = await fetch(
    `https://hn.algolia.com/api/v1/search?query=${encoded}&tags=story&hitsPerPage=${limit * 3}`
  );

  if (!res.ok) {
    throw new Error(`HN API error: ${res.status}`);
  }

  const data = await res.json() as any;
  const claudeKeywords = /claude/i;
  return data.hits
    .filter((h: any) => claudeKeywords.test(h.title))
    .slice(0, limit)
    .map((h: any) => ({
      title: h.title,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      score: h.points ?? 0,
      commentCount: h.num_comments ?? 0,
      publishedAt: h.created_at,
    }));
}
