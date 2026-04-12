import { TwitterApi } from "twitter-api-v2";
import Anthropic from "@anthropic-ai/sdk";
import { NewsItem } from "./summarize";

const anthropic = new Anthropic();

function createXClient() {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error(
      "X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET を .env に設定してください"
    );
  }

  return new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret });
}

// YouTube動画1件からX投稿テキストを生成（280文字ギリギリ）
// TwitterはURLを23文字として換算するため、本文は最大257文字（280 - 23）
async function generateTweetText(video: NewsItem): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `以下のYouTube動画についてX（Twitter）投稿文を日本語で作成してください。

## 条件
- 本文は**257文字以内**（URLは別途末尾に付けるため本文には含めない）
- 動画を見なくても内容がわかるよう、具体的な手法・学びを盛り込む
- タイトルの言い換えは禁止。動画の中身・価値を伝える文章にする
- ハッシュタグは末尾に1〜2個だけ付ける（例：#ClaudeCode #AI）
- 文章のみ返答し、説明・前置き・URLは不要

## 動画情報
タイトル: ${video.title}
${video.content}`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text.trim() : "";
}

export async function postToX(youtubeItems: NewsItem[]): Promise<void> {
  if (youtubeItems.length === 0) throw new Error("投稿するYouTube動画がありません");

  // 日本語タイトル・チャンネルを除外して海外動画に絞る
  const japanesePattern = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf]/;
  const overseasItems = youtubeItems.filter(
    (v) => !japanesePattern.test(v.title) && !japanesePattern.test(v.source)
  );
  const candidates = overseasItems.length > 0 ? overseasItems : youtubeItems;

  // 再生回数が最も多い動画を選択
  const best = candidates.reduce((prev, curr) => {
    const prevViews = parseInt(prev.content.match(/再生回数: ([\d,]+)/)?.[1]?.replace(/,/g, "") ?? "0");
    const currViews = parseInt(curr.content.match(/再生回数: ([\d,]+)/)?.[1]?.replace(/,/g, "") ?? "0");
    return currViews > prevViews ? curr : prev;
  });

  const client = createXClient();
  const tweetBody = await generateTweetText(best);

  if (!tweetBody) throw new Error("投稿テキストの生成に失敗しました");

  const tweetText = `${tweetBody}\n${best.url}`;
  const bodyLength = [...tweetBody].length;

  console.log("\n--- X投稿内容 ---");
  console.log(tweetText);
  console.log(`本文: ${bodyLength}文字 + URL`);
  console.log("-----------------");

  await client.v2.tweet(tweetText);
  console.log("Xへの投稿が完了しました！");
}
