import nodemailer from "nodemailer";

export async function sendEmail(to: string, subject: string, markdownBody: string) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error("GMAIL_USER と GMAIL_APP_PASSWORD を .env に設定してください");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  const html = markdownToHtml(markdownBody);

  await transporter.sendMail({
    from: `"AI News Bot" <${user}>`,
    to,
    subject,
    html,
  });
}

// シンプルなMarkdown → HTML変換
function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const result: string[] = [
    '<div style="font-family:sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#222">',
  ];

  for (const line of lines) {
    if (line.startsWith("# "))      result.push(`<h1 style="color:#1a1a2e">${esc(line.slice(2))}</h1>`);
    else if (line.startsWith("## ")) result.push(`<h2 style="color:#16213e;border-bottom:2px solid #e0e0e0;padding-bottom:4px">${esc(line.slice(3))}</h2>`);
    else if (line.startsWith("### "))result.push(`<h3 style="color:#0f3460">${esc(line.slice(4))}</h3>`);
    else if (line.startsWith("> "))  result.push(`<blockquote style="border-left:4px solid #4a90d9;margin:16px 0;padding:8px 16px;background:#f0f6ff;color:#333">${esc(line.slice(2))}</blockquote>`);
    else if (line.startsWith("| "))  result.push(tableRow(line));
    else if (line.startsWith("- "))  result.push(`<li style="margin:4px 0">${inlineFormat(line.slice(2))}</li>`);
    else if (line === "---")         result.push(`<hr style="border:none;border-top:1px solid #ddd;margin:16px 0">`);
    else if (line.trim() === "")    result.push("<br>");
    else                             result.push(`<p style="margin:6px 0">${inlineFormat(line)}</p>`);
  }

  result.push("</div>");
  return result.join("\n");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineFormat(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, '<code style="background:#f4f4f4;padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>');
}

function tableRow(line: string): string {
  if (line.match(/^\|[-| ]+\|$/)) return ""; // 区切り行スキップ
  const cells = line.split("|").filter((_, i, a) => i > 0 && i < a.length - 1);
  const tds = cells.map((c) => `<td style="padding:6px 12px;border:1px solid #ddd">${inlineFormat(c.trim())}</td>`).join("");
  return `<tr>${tds}</tr>`;
}
