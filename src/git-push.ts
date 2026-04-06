import { execSync } from "child_process";
import * as path from "path";

const REPO_ROOT = path.join(__dirname, "..");

export function commitAndPush() {
  // GitHub Actions 環境ではワークフロー側でcommit/pushするためスキップ
  if (process.env.GITHUB_ACTIONS === "true") {
    console.log("GitHub Actions環境のためgit push はワークフローに委譲します");
    return;
  }

  const date = new Date().toLocaleDateString("ja-JP");
  try {
    execSync("git add reports/ data/", { cwd: REPO_ROOT, stdio: "pipe" });
    execSync(`git commit -m "daily report: ${date}"`, {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
    execSync("git push origin main", { cwd: REPO_ROOT, stdio: "pipe" });
    console.log("GitHubへのpushが完了しました");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("nothing to commit")) {
      console.log("GitHubへのpush: 変更なしのためスキップ");
    } else {
      throw new Error(`Git push 失敗: ${msg}`);
    }
  }
}
