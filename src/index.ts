import "dotenv/config";
import { fetchClaudeCodeReleases } from "./sources/github";
import { searchHackerNews } from "./sources/hackernews";
import { fetchAnthropicBlog } from "./sources/anthropic-blog";
import { summarizeNews, NewsItem } from "./summarize";
import { sendEmail } from "./mailer";
import { fetchClaudeCodeDocs } from "./sources/claude-docs";
import { fetchClaudeCodeGuide } from "./sources/github-guide";
import { fetchSubstackRSS } from "./sources/substack";
import { appendReport } from "./save-report";
import { commitAndPush } from "./git-push";

async function main() {
  console.log("Claude Code の最新情報を取得中...\n");

  const allItems: NewsItem[] = [];
  const errors: string[] = [];

  // GitHub リリース
  try {
    process.stdout.write("GitHub リリース情報を取得中... ");
    const releases = await fetchClaudeCodeReleases(5);
    console.log(`${releases.length} 件取得`);
    for (const r of releases) {
      allItems.push({
        source: "GitHub (anthropics/claude-code releases)",
        title: r.title,
        url: r.url,
        content: r.body,
        publishedAt: r.publishedAt,
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`失敗: ${msg}`);
    errors.push(`GitHub: ${msg}`);
  }

  // Hacker News
  try {
    process.stdout.write("Hacker News を検索中... ");
    const stories = await searchHackerNews("Claude Code", 5);
    console.log(`${stories.length} 件取得`);
    for (const s of stories) {
      allItems.push({
        source: "Hacker News",
        title: s.title,
        url: s.url,
        content: `スコア: ${s.score}, コメント: ${s.commentCount}`,
        publishedAt: s.publishedAt,
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`失敗: ${msg}`);
    errors.push(`Hacker News: ${msg}`);
  }

  // Anthropic ブログ
  try {
    process.stdout.write("Anthropic ブログを取得中... ");
    const posts = await fetchAnthropicBlog(5);
    console.log(`${posts.length} 件取得`);
    for (const p of posts) {
      allItems.push({
        source: "Anthropic 公式ブログ",
        title: p.title,
        url: p.url,
        content: p.description,
        publishedAt: p.publishedAt,
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`失敗: ${msg}`);
    errors.push(`Anthropic ブログ: ${msg}`);
  }

  // Claude Code 公式ドキュメント（リリースノート）
  try {
    process.stdout.write("Claude Code 公式ドキュメントを取得中... ");
    const entries = await fetchClaudeCodeDocs(5);
    console.log(`${entries.length} 件取得`);
    for (const e of entries) {
      allItems.push({
        source: "Claude Code 公式ドキュメント（リリースノート）",
        title: e.title,
        url: e.url,
        content: e.content,
        publishedAt: e.publishedAt,
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`失敗: ${msg}`);
    errors.push(`Claude Docs: ${msg}`);
  }

  // GitHub claude-code-ultimate-guide
  try {
    process.stdout.write("Claude Code Ultimate Guide (GitHub) を取得中... ");
    const commits = await fetchClaudeCodeGuide(5);
    console.log(`${commits.length} 件取得`);
    for (const c of commits) {
      allItems.push({
        source: "GitHub: claude-code-ultimate-guide",
        title: c.title,
        url: c.url,
        content: c.content,
        publishedAt: c.publishedAt,
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`失敗: ${msg}`);
    errors.push(`GitHub Guide: ${msg}`);
  }

  // Ethan Mollick (One Useful Thing - Substack)
  try {
    process.stdout.write("Ethan Mollick (One Useful Thing) を取得中... ");
    const posts = await fetchSubstackRSS("https://www.oneusefulthing.org", 3);
    const claudePosts = posts.filter((p) => /claude|anthropic|ai/i.test(p.title));
    console.log(`${claudePosts.length} 件取得`);
    for (const p of claudePosts) {
      allItems.push({
        source: "Ethan Mollick - One Useful Thing (Substack)",
        title: p.title,
        url: p.url,
        content: p.content,
        publishedAt: p.publishedAt,
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`失敗: ${msg}`);
    errors.push(`Substack (Mollick): ${msg}`);
  }

  console.log(`\n合計 ${allItems.length} 件の情報を取得しました。`);
  console.log("Claude API で日本語要約を生成中...\n");

  const summary = await summarizeNews(allItems);

  console.log("=".repeat(60));
  console.log("【Claude Code 最新情報まとめ】");
  console.log("=".repeat(60));
  console.log(summary);

  if (errors.length > 0) {
    console.log("\n※ 以下のソースでエラーが発生しました:");
    errors.forEach((e) => console.log(`  - ${e}`));
  }

  // MDファイルに追記
  appendReport(summary);

  // メール送信
  const to = "c094588@gmail.com";
  const date = new Date().toLocaleDateString("ja-JP");
  process.stdout.write(`\nメールを ${to} へ送信中... `);
  await sendEmail(to, `【Claude Code 最新情報】${date}`, summary);
  console.log("送信完了！");

  // GitHubへpush
  commitAndPush();
}

main().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
