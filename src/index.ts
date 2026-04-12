import "dotenv/config";
import { summarizeNews, NewsItem } from "./summarize";
import { sendEmail } from "./mailer";
import { fetchSubstackRSS } from "./sources/substack";
import { searchYouTube } from "./sources/youtube";
import { appendReport } from "./save-report";
import { commitAndPush } from "./git-push";
import { filterAndMarkSeen } from "./dedup";
import { postToX } from "./post-x";

async function main() {
  console.log("有識者の最新情報を取得中...\n");

  const allItems: NewsItem[] = [];
  const rawYoutubeItems: NewsItem[] = []; // dedup前の全YouTube動画（X投稿候補）
  const errors: string[] = [];

  // 過去2日間の範囲を設定
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  // YouTube（過去2日間・海外動画を幅広く取得）
  const youtubeQueries = ["Claude Code", "Anthropic Claude AI"];
  for (const query of youtubeQueries) {
    try {
      process.stdout.write(`YouTube「${query}」を検索中... `);
      const videos = await searchYouTube(query, 10, twoDaysAgo);
      console.log(`${videos.length} 件取得`);
      for (const v of videos) {
        const item: NewsItem = {
          source: `YouTube (${v.channelName})`,
          title: v.title,
          url: v.url,
          content: `チャンネル: ${v.channelName} / 再生回数: ${v.viewCount}\n${v.description}`,
          publishedAt: v.publishedAt,
        };
        allItems.push(item);
        rawYoutubeItems.push(item);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`失敗: ${msg}`);
      errors.push(`YouTube(${query}): ${msg}`);
    }
  }

  // 有識者 Substack
  const substacks = [
    { name: "Ethan Mollick (One Useful Thing)", url: "https://www.oneusefulthing.org" },
    { name: "The Neuron", url: "https://www.theneurondaily.com" },
    { name: "Ben's Bites", url: "https://www.bensbites.com" },
  ];
  for (const sub of substacks) {
    try {
      process.stdout.write(`${sub.name} を取得中... `);
      const posts = await fetchSubstackRSS(sub.url, 5);
      const relevant = posts.filter((p) => /claude|anthropic|ai/i.test(p.title + p.content));
      console.log(`${relevant.length} 件取得`);
      for (const p of relevant) {
        allItems.push({
          source: sub.name,
          title: p.title,
          url: p.url,
          content: p.content,
          publishedAt: p.publishedAt,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`失敗: ${msg}`);
      errors.push(`${sub.name}: ${msg}`);
    }
  }

  // 重複排除（過去に報告済みのURLを除外）
  const rawCount = allItems.length;
  const newItems = filterAndMarkSeen(allItems);
  const skipped = rawCount - newItems.length;
  if (skipped > 0) console.log(`\n重複除外: ${skipped} 件スキップ（過去報告済み）`);

  console.log(`\n合計 ${newItems.length} 件の新着情報を取得しました。`);
  if (newItems.length === 0) {
    console.log("新着情報がありませんでした。処理を終了します。");
    return;
  }

  console.log("Claude API で日本語要約を生成中...\n");

  const summary = await summarizeNews(newItems);

  console.log("=".repeat(60));
  console.log("【有識者 最新情報まとめ】");
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
  await sendEmail(to, `【AI最新情報】${date}`, summary);
  console.log("送信完了！");

  // Xへ投稿（過去2日間のYouTube動画から海外の最有益1本を選んで投稿）
  if (rawYoutubeItems.length > 0) {
    try {
      process.stdout.write("\nXへ投稿中... ");
      await postToX(rawYoutubeItems);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`失敗: ${msg}`);
    }
  } else {
    console.log("\nYouTube動画がないためX投稿をスキップしました。");
  }

  // GitHubへpush
  commitAndPush();
}

main().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
