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
        content: `以下はClaude Codeに関する本日の新着情報です。このメール1通を読むだけで今日の動向が完全に把握できるよう、詳細な日本語レポートを作成してください。

## レポート作成の方針

**詳細度について**
- 各トピックは「何が・なぜ・どう使えるか」まで掘り下げて説明する
- 新機能は具体的な使い方・ユースケースまで記載する
- YouTubeや有識者の発信は、動画・記事の主な主張・デモ内容・視聴者の反応まで詳しく書く
- コミュニティの議論は賛否両論・注目コメントの内容まで含める
- 単なる箇条書きではなく、文章で文脈を補足する

**構成について**
- ## セクションで情報源カテゴリを分ける
- 各セクション内は重要度順に並べる
- URLは各項目の末尾に記載する
- 最後に「今日の総括」として全体のトレンドと注目ポイントをまとめる（200字程度）

**YouTube・有識者セクションは特に充実させること**
- 動画タイトル・チャンネル名・再生回数
- 動画の主なトピック・デモ内容・見どころ
- その動画がなぜ今注目されているかの背景

情報：
${itemsText}`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type === "text") return block.text;
  return "要約の生成に失敗しました。";
}
