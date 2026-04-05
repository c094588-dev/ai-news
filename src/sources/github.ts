export interface GitHubRelease {
  title: string;
  body: string;
  url: string;
  publishedAt: string;
}

export async function fetchClaudeCodeReleases(limit = 5): Promise<GitHubRelease[]> {
  const res = await fetch(
    "https://api.github.com/repos/anthropics/claude-code/releases?per_page=" + limit,
    {
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": "ai-news-fetcher",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const data = await res.json() as any[];
  return data.map((r) => ({
    title: r.name || r.tag_name,
    body: r.body || "",
    url: r.html_url,
    publishedAt: r.published_at,
  }));
}
