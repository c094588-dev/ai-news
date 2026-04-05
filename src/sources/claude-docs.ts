import * as cheerio from "cheerio";

export interface DocsEntry {
  title: string;
  url: string;
  content: string;
  publishedAt: string;
}

export async function fetchClaudeCodeDocs(limit = 5): Promise<DocsEntry[]> {
  const url = "https://docs.anthropic.com/en/release-notes/claude-code";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  if (!res.ok) throw new Error(`Claude Docs fetch error: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const entries: DocsEntry[] = [];

  // 各バージョンのセクションを取得
  $("h2, h3").each((_, el) => {
    if (entries.length >= limit) return false;

    const heading = $(el).text().trim();
    if (!heading) return;

    // 直後の ul/p テキストを内容として取得
    const content = $(el)
      .nextUntil("h2, h3", "ul, p")
      .map((_, c) => $(c).text().trim())
      .get()
      .join(" ")
      .slice(0, 600);

    entries.push({
      title: heading,
      url,
      content,
      publishedAt: "",
    });
  });

  return entries;
}
