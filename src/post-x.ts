import { TwitterApi } from "twitter-api-v2";
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { NewsItem } from "./summarize";

const POSTED_FILE = path.join(__dirname, "../data/posted-x-urls.json");

function loadPosted(): Set<string> {
  try {
    if (!fs.existsSync(POSTED_FILE)) return new Set();
    const raw = fs.readFileSync(POSTED_FILE, "utf-8");
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function markPosted(url: string) {
  const posted = loadPosted();
  posted.add(url);
  const dir = path.dirname(POSTED_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(POSTED_FILE, JSON.stringify([...posted], null, 2));
}

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

// Twitterの重み付き文字数（日本語など全角=2カウント、URL=23固定）
function twitterWeightedLength(text: string): number {
  const urlPattern = /https?:\/\/\S+/g;
  const urls = text.match(urlPattern) ?? [];
  const textWithoutUrls = text.replace(urlPattern, "");

  let weight = 0;
  for (const char of textWithoutUrls) {
    const cp = char.codePointAt(0) ?? 0;
    const isWide =
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0x303f) ||
      (cp >= 0x3040 && cp <= 0x33ff) ||
      (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0x4e00 && cp <= 0x9fff) ||
      (cp >= 0xac00 && cp <= 0xd7ff) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe10 && cp <= 0xfe6f) ||
      (cp >= 0xff00 && cp <= 0xffef);
    weight += isWide ? 2 : 1;
  }
  weight += urls.length * 23;
  return weight;
}

// 動画の内容を詳細に解説するツリー投稿用テキストを生成
// 返り値: ツイートの配列（1本目＋続きのリプライ）
async function generateThreadTweets(video: NewsItem): Promise<string[]> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `以下のYouTube動画の内容を、Xのスレッド（ツリー投稿）形式で日本語解説してください。

## 最重要ルール：内容の具体性
- **動画を見なくても完全に内容がわかるレベルで書く**
- タイトルや「〜について解説」のような抽象的な表現は禁止
- 動画で紹介されている具体的な手法・手順・発見・数値・ツール名を必ず盛り込む
- 「なぜこの動画が有益か」ではなく「動画の中身そのもの」を書く

## フォーマット
- ツイート1本ごとに「---」で区切る
- 1本目：最も重要な発見・手法を具体的に（URLは含めない）
- 2本目以降：詳細な手順・補足・背景（必要な分だけ、最大4本まで）
- 最終ツイート：URLのみ（テキストなし）
- 各ツイートは日本語換算で**128文字以内**（全角1文字=2カウント、上限280カウント）
- ハッシュタグは最後のテキストツイートの末尾に1〜2個だけ
- 「---」と各ツイートのテキストのみ返答し、番号・説明・前置きは不要

## 動画情報
タイトル: ${video.title}
${video.content}`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("テキスト生成に失敗しました");

  // 「---」で区切ってツイート配列に変換
  const tweets = block.text
    .split("---")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  // 最終ツイートにURLを追加（最終ツイートがURLだけなら上書き、そうでなければ追加）
  const lastTweet = tweets[tweets.length - 1];
  if (!lastTweet?.startsWith("http")) {
    tweets.push(video.url);
  } else {
    tweets[tweets.length - 1] = video.url;
  }

  return tweets;
}

export async function postToX(youtubeItems: NewsItem[]): Promise<void> {
  if (youtubeItems.length === 0) throw new Error("投稿するYouTube動画がありません");

  // 投稿済みURLを除外
  const posted = loadPosted();
  const unpostedItems = youtubeItems.filter((v) => !posted.has(v.url));
  if (unpostedItems.length === 0) {
    console.log("投稿済みでない新しいYouTube動画がありませんでした。スキップします。");
    return;
  }

  // 日本語タイトル・チャンネルを除外して海外動画に絞る
  const japanesePattern = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf]/;
  const overseasItems = unpostedItems.filter(
    (v) => !japanesePattern.test(v.title) && !japanesePattern.test(v.source)
  );
  const candidates = overseasItems.length > 0 ? overseasItems : unpostedItems;

  // 再生回数が最も多い動画を選択
  const best = candidates.reduce((prev, curr) => {
    const prevViews = parseInt(prev.content.match(/再生回数: ([\d,]+)/)?.[1]?.replace(/,/g, "") ?? "0");
    const currViews = parseInt(curr.content.match(/再生回数: ([\d,]+)/)?.[1]?.replace(/,/g, "") ?? "0");
    return currViews > prevViews ? curr : prev;
  });

  const tweets = await generateThreadTweets(best);

  // 文字数チェック
  for (const [i, tweet] of tweets.entries()) {
    const w = twitterWeightedLength(tweet);
    if (w > 280) {
      throw new Error(`ツイート${i + 1}本目が280カウント超（${w}カウント）:\n${tweet}`);
    }
  }

  console.log("\n--- Xスレッド投稿内容 ---");
  tweets.forEach((t, i) => {
    console.log(`[${i + 1}/${tweets.length}] (${twitterWeightedLength(t)}カウント)\n${t}\n`);
  });
  console.log("-------------------------");

  const client = createXClient();

  // 1本目を投稿
  let lastTweetId: string;
  try {
    const res = await client.v2.tweet(tweets[0]);
    lastTweetId = res.data.id;
    console.log(`投稿完了 [1/${tweets.length}]`);
  } catch (e: any) {
    console.error("X投稿エラー:", e?.code, JSON.stringify(e?.data ?? e?.errors ?? e?.message, null, 2));
    throw e;
  }

  // 2本目以降をリプライとして繋げる
  for (let i = 1; i < tweets.length; i++) {
    try {
      const res = await client.v2.reply(tweets[i], lastTweetId);
      lastTweetId = res.data.id;
      console.log(`投稿完了 [${i + 1}/${tweets.length}]`);
    } catch (e: any) {
      console.error(`リプライエラー [${i + 1}本目]:`, e?.code, JSON.stringify(e?.data ?? e?.errors ?? e?.message, null, 2));
      throw e;
    }
  }

  markPosted(best.url);
  console.log("Xスレッド投稿が完了しました！");
}
