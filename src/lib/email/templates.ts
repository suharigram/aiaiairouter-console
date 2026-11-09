function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function brandedEmail({ title, body, action }: { title: string; body: string; action?: { label: string; url: string } }) {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);
  const button = action
    ? `<a href="${escapeHtml(action.url)}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600">${escapeHtml(action.label)}</a>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917"><div style="max-width:560px;margin:40px auto;padding:0 20px"><div style="font-size:18px;font-weight:700;margin-bottom:20px">AiAiAiRouter</div><div style="background:#ffffff;border:1px solid #e7e5e4;border-radius:10px;padding:32px"><h1 style="font-size:22px;margin:0 0 16px">${safeTitle}</h1><p style="font-size:15px;line-height:1.6;color:#57534e;margin:0 0 24px">${safeBody}</p>${button}</div><p style="font-size:12px;color:#78716c;line-height:1.5;margin-top:20px">AiAiAiRouter by GonidonCloud. This is a transactional account notification. Never share your API keys or password by email.</p></div></body></html>`;
  return { html, text: `${title}\n\n${body}${action ? `\n\n${action.label}: ${action.url}` : ""}\n\nAiAiAiRouter by GonidonCloud` };
}
