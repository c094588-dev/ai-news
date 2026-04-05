import * as fs from "fs";
import * as path from "path";

const REPORT_FILE = path.join(__dirname, "../reports/claude-code-news.md");

export function appendReport(summary: string) {
  const dir = path.dirname(REPORT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const date = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const time = new Date().toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const section = `\n---\n\n## ${date} ${time}\n\n${summary}\n`;

  // ファイルが存在しない場合はヘッダーから作成
  if (!fs.existsSync(REPORT_FILE)) {
    fs.writeFileSync(
      REPORT_FILE,
      `# Claude Code 最新情報まとめ\n\n自動収集・要約レポート（毎朝8時更新）\n${section}`
    );
  } else {
    fs.appendFileSync(REPORT_FILE, section);
  }

  console.log(`レポートを保存しました: ${REPORT_FILE}`);
}
