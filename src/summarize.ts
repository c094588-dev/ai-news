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
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `以下はClaude Codeに関する最新の英語ニュース・情報です。日本語で要約してまとめてください。

要約のポイント：
- 各情報源の重要なアップデートや発表を簡潔にまとめる
- 新機能や変更点があれば具体的に記載
- 重複する内容はまとめて1つにする
- 最後に全体的な傾向や注目ポイントを一言で添える

情報：
${itemsText}`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type === "text") return block.text;
  return "要約の生成に失敗しました。";
}
