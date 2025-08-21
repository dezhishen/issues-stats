const fetch = require('node-fetch');
const fs = require('fs');

if (!process.env.TARGET_REPO) {
  throw new Error('TARGET_REPO env is required, e.g. owner/repo');
}
const [owner, repo] = process.env.TARGET_REPO.split('/');

const label = process.env.ENHANCEMENT_LABEL || 'enhancement';

const headers = {
  'Accept': 'application/vnd.github+json',
  'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
  'X-GitHub-Api-Version': '2022-11-28'
};

const reactionTypes = [
  '+1', '-1', 'laugh', 'confused', 'heart', 'hooray', 'rocket', 'eyes'
];
const reactionEmoji = {
  '+1': '👍', '-1': '👎', 'laugh': '😄', 'confused': '😕',
  'heart': '❤️', 'hooray': '🎉', 'rocket': '🚀', 'eyes': '👀'
};

async function fetchAllLabelIssues(page = 1, per_page = 100, acc = []) {
  // 只统计 open 状态
  const url = `https://api.github.com/repos/${owner}/${repo}/issues?labels=${encodeURIComponent(label)}&state=open&per_page=${per_page}&page=${page}`;
  const res = await fetch(url, { headers });
  const issues = await res.json();
  if (!Array.isArray(issues)) throw new Error('Failed to fetch issues');
  acc.push(...issues.filter(i => !i.pull_request));
  if (issues.length === per_page) {
    return fetchAllLabelIssues(page + 1, per_page, acc);
  }
  return acc;
}

async function fetchReactions(issue_number) {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issue_number}/reactions?per_page=100`;
  const res = await fetch(url, { headers });
  return await res.json();
}

(async () => {
  const issues = await fetchAllLabelIssues();
  const stats = [];
  for (const issue of issues) {
    const reactions = await fetchReactions(issue.number);
    const reactionCount = {};
    for (const type of reactionTypes) reactionCount[type] = 0;
    for (const r of reactions) {
      if (reactionCount[r.content] !== undefined) reactionCount[r.content]++;
    }
    stats.push({
      number: issue.number,
      title: issue.title,
      comments: issue.comments,
      reactions: reactionCount,
      url: issue.html_url
    });
  }

  let html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${label} Issues Stats for ${owner}/${repo}</title>
  <style>
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
    th { background: #f6f8fa; }
    caption { text-align: left; font-size: 1.2em; margin: 10px 0; }
  </style>
</head>
<body>
  <h1>“${label}” Issues Stats for ${owner}/${repo}</h1>
  <p>统计时间：${new Date().toLocaleString()}</p>
  <table>
    <caption>只统计 open 状态的 issues</caption>
    <thead>
      <tr>
        <th>Issue</th>
        <th>Title</th>
        <th>Comments</th>
        ${reactionTypes.map(type => `<th>${reactionEmoji[type]}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
`;

  for (const s of stats) {
    html += `<tr>
      <td><a href="${s.url}" target="_blank">#${s.number}</a></td>
      <td>${s.title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
      <td>${s.comments}</td>
      ${reactionTypes.map(type => `<td>${s.reactions[type]}</td>`).join('')}
    </tr>\n`;
  }

  html += `</tbody></table>
  <p>数据来源：<a href="https://github.com/${owner}/${repo}">${owner}/${repo}</a></p>
</body>
</html>
`;

  fs.mkdirSync('enhancement', { recursive: true });
  fs.writeFileSync('enhancement/enhancements-stats.html', html);
})();
