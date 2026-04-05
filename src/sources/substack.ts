export interface SubstackPost {
  title: string;
  url: string;
  content: string;
  publishedAt: string;
}

// RSSをXMLパースして取得
export async function fetchSubstackRSS(
  substackUrl: string,
  limit = 3
): Promise<SubstackPost[]> {
  const rssUrl = substackUrl.replace(/\/?$/, "/feed");
  const res = await fetch(rssUrl, {
    headers: { "User-Agent": "ai-news-fetcher" },
  });

  if (!res.ok) throw new Error(`Substack RSS fetch error: ${res.status}`);

  const xml = await res.text();
  const posts: SubstackPost[] = [];

  // シンプルな正規表現でRSSをパース
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && posts.length < limit) {
    const item = match[1];
    const title = (/<title><!\[CDATA\[(.*?)\]\]>/.exec(item) || /<title>(.*?)<\/title>/.exec(item))?.[1] ?? "";
    const link = /<link>(.*?)<\/link>/.exec(item)?.[1] ?? "";
    const description = (/<description><!\[CDATA\[(.*?)\]\]>/.exec(item) || /<description>(.*?)<\/description>/.exec(item))?.[1] ?? "";
    const pubDate = /<pubDate>(.*?)<\/pubDate>/.exec(item)?.[1] ?? "";

    // HTMLタグを除去して本文テキストのみ残す
    const plainText = description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);

    if (title) {
      posts.push({ title, url: link, content: plainText, publishedAt: pubDate });
    }
  }

  return posts;
}
