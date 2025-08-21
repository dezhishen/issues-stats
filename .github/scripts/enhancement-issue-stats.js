const fetch = require('node-fetch');
const fs = require('fs');

if (!process.env.TARGET_REPO) {
  throw new Error('TARGET_REPO env is required, e.g. owner/repo');
}
const [owner, repo] = process.env.TARGET_REPO.split('/');

// label变量名更正为ENHANCEMENT_LABEL，未设置时默认为'enhancement'
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
  const url = `https://api.github.com/repos/${owner}/${repo}/issues?labels=${encodeURIComponent(label)}&state=all&per_page=${per_page}&page=${page}`;
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
      reactions: reactionCount
    });
  }

  let md = `# "${label}" Issues Stats for ${owner}/${repo}\n\n`;
  md += `统计时间：${new Date().toISOString()}\n\n`;
  md += `| Issue | Title | Comments |`;
  for (const type of reactionTypes) {
    md += ` ${reactionEmoji[type]} |`;
  }
  md += '\n|-------|-------|----------|';
  for (const _ of reactionTypes) md += '---|';
  md += '\n';
  for (const s of stats) {
    md += `| [#${s.number}](https://github.com/${owner}/${repo}/issues/${s.number}) | ${s.title.replace(/\|/g, '\\|')} | ${s.comments} |`;
    for (const type of reactionTypes) {
      md += ` ${s.reactions[type]} |`;
    }
    md += '\n';
  }

  fs.mkdirSync('enhancement', { recursive: true });
  fs.writeFileSync('enhancement/enhancements-stats.md', md);
})();
