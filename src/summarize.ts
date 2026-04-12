import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export interface NewsItem {
  source: string;
  title: string;
  url: string;
  content: string;
  publishedAt: string;
}

export async function summarizeNews(items: NewsItem[]): Promise<string> {
  if (items.length === 0) return "取得できたニュースがありませんでした。";

  const itemsText = items
    .map(
      (item, i) =>
        `[${i + 1}] 情報源: ${item.source}
タイトル: ${item.title}
URL: ${item.url}
日時: ${item.publishedAt}
内容: ${item.content.slice(0, 800)}`
    )
    .join("\n\n---\n\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `以下はAI・Claude Codeに関する有識者・YouTuberの本日の新着情報です。このレポート1本を読むだけで今日の有識者動向が完全に把握できるよう、詳細な日本語レポートを作成してください。

## レポート作成の方針

**YouTube動画の解説（最重要・最も充実させること）**
- 動画タイトル・チャンネル名・再生回数を冒頭に記載
- 動画を見なくても内容が完全にわかるよう、以下を全て網羅する：
  - 動画の主張・結論（何を伝えたい動画か）
  - 紹介されている具体的な手法・ツール・テクニック（あれば手順も）
  - デモや実演の内容（何を実際に見せているか）
  - 視聴者が得られる知見・学び
  - なぜ今この動画が注目されているかの背景・文脈
- 単なるタイトルの言い換えは禁止。動画説明文や文脈から内容を推測・補足して詳しく書く

**Substack・ニュースレターの解説**
- 記事タイトル・媒体名を冒頭に記載
- 記事の主張・重要ポイントを3〜5点箇条書きで整理
- 記事を読まなくても要点がわかる文章量で記述する

**構成**
- ## YouTube動画 と ## ニュースレター・有識者ブログ の2セクションに分ける
- 各セクション内は再生回数・注目度の高い順に並べる
- URLは各項目の末尾に記載
- 最後に「今日の総括」として全体のトレンドと注目ポイントをまとめる（200字程度）

情報：
${itemsText}`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type === "text") return block.text;
  return "要約の生成に失敗しました。";
}
