export interface GuideCommit {
  title: string;
  url: string;
  content: string;
  publishedAt: string;
}

export async function fetchClaudeCodeGuide(limit = 5): Promise<GuideCommit[]> {
  const res = await fetch(
    `https://api.github.com/repos/FlorianBruniaux/claude-code-ultimate-guide/commits?per_page=${limit}`,
    {
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": "ai-news-fetcher",
      },
    }
  );

  if (!res.ok) throw new Error(`GitHub Guide API error: ${res.status}`);

  const data = await res.json() as any[];
  return data.map((c) => ({
    title: c.commit.message.split("\n")[0],
    url: c.html_url,
    content: c.commit.message,
    publishedAt: c.commit.author.date,
  }));
}
