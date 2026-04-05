import * as cheerio from "cheerio";

export interface BlogPost {
  title: string;
  url: string;
  description: string;
  publishedAt: string;
}

const CLAUDE_KEYWORDS = /claude/i;

export async function fetchAnthropicBlog(limit = 5): Promise<BlogPost[]> {
  const res = await fetch("https://www.anthropic.com/news", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Anthropic blog fetch error: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const posts: BlogPost[] = [];

  // Anthropic の記事カードを取得（Claude関連のみ）
  $("a[href^='/news/']").each((_, el) => {
    if (posts.length >= limit * 3) return false;

    const href = $(el).attr("href") || "";
    // /news/ 直下の記事のみ（カテゴリページ除外）
    if (!href.match(/^\/news\/[a-z0-9-]+$/)) return;

    const url = "https://www.anthropic.com" + href;
    // 重複除外
    if (posts.some((p) => p.url === url)) return;

    const title =
      $(el).find("h3, h2, [class*='title']").first().text().trim() ||
      $(el).text().trim();
    const description = $(el)
      .find("p, [class*='description'], [class*='excerpt']")
      .first()
      .text()
      .trim();
    const dateText =
      $(el).find("time").attr("datetime") ||
      $(el).find("[class*='date'], time").first().text().trim();

    if (title && CLAUDE_KEYWORDS.test(title)) {
      posts.push({ title, url, description, publishedAt: dateText });
    }
  });

  return posts.slice(0, limit);
}
