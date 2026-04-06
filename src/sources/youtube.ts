export interface YouTubeVideo {
  title: string;
  url: string;
  channelName: string;
  description: string;
  publishedAt: string;
  viewCount: string;
}

export async function searchYouTube(query: string, limit = 5): Promise<YouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY が .env に設定されていません");

  // 動画検索
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", String(limit));
  searchUrl.searchParams.set("order", "date");
  searchUrl.searchParams.set("relevanceLanguage", "en");
  searchUrl.searchParams.set("key", apiKey);

  const res = await fetch(searchUrl.toString());
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube API error: ${res.status} ${err}`);
  }

  const data = await res.json() as any;
  const items = data.items ?? [];

  // 再生回数を取得
  const videoIds = items.map((i: any) => i.id.videoId).join(",");
  const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  statsUrl.searchParams.set("part", "statistics");
  statsUrl.searchParams.set("id", videoIds);
  statsUrl.searchParams.set("key", apiKey);

  const statsRes = await fetch(statsUrl.toString());
  const statsData = statsRes.ok ? await statsRes.json() as any : { items: [] };
  const statsMap: Record<string, string> = {};
  for (const v of statsData.items ?? []) {
    statsMap[v.id] = Number(v.statistics?.viewCount ?? 0).toLocaleString();
  }

  return items.map((item: any) => {
    const snippet = item.snippet;
    const videoId = item.id.videoId;
    return {
      title: snippet.title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      channelName: snippet.channelTitle,
      description: snippet.description.slice(0, 300),
      publishedAt: snippet.publishedAt,
      viewCount: statsMap[videoId] ?? "不明",
    };
  });
}
