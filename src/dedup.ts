import * as fs from "fs";
import * as path from "path";
import { NewsItem } from "./summarize";

const SEEN_FILE = path.join(__dirname, "../data/seen-urls.json");

function loadSeen(): Set<string> {
  try {
    if (!fs.existsSync(SEEN_FILE)) return new Set();
    const raw = fs.readFileSync(SEEN_FILE, "utf-8");
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<string>) {
  const dir = path.dirname(SEEN_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen], null, 2));
}

export function filterAndMarkSeen(items: NewsItem[]): NewsItem[] {
  const seen = loadSeen();
  const newItems = items.filter((item) => !seen.has(item.url));
  // 今回の新規URLを記録
  for (const item of newItems) seen.add(item.url);
  saveSeen(seen);
  return newItems;
}
