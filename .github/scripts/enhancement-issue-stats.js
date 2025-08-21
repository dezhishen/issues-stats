const fetch = require('node-fetch');
const fs = require('fs');

if (!process.env.TARGET_REPO) {
  throw new Error('TARGET_REPO env is required, e.g. owner/repo');
}
const [owner, repo] = process.env.TARGET_REPO.split('/');

const headers = {
  'Accept': 'application/vnd.github+json',
  'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
  'X-GitHub-Api-Version': '2022-11-28'
};

async function fetchAllEnhancementIssues(page = 1, per_page = 100, acc = []) {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues?labels=enhancement&state=all&per_page=${per_page}&page=${page}`;
  const res = await fetch(url, { headers });
  const issues = await res.json();
  if (!Array.isArray(issues)) throw new Error('Failed to fetch issues');
  acc.push(...issues.filter(i => !i.pull_request));
  if (issues.length === per_page) {
    return fetchAllEnhancementIssues(page + 1, per_page, acc);
  }
  return acc;
}

async function fetchReactions(issue_number) {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issue_number}/reactions`;
  const res = await fetch(url, { headers });
  return await res.json();
}

(async () => {
  const issues = await fetchAllEnhancementIssues();
  const stats = [];
  for (const issue of issues) {
    const reactions = await fetchReactions(issue.number);
    stats.push({
      number: issue.number,
      title: issue.title,
      comments: issue.comments,
      reactions: reactions.length
    });
  }

  let md = `# Enhancement Issues Stats for ${owner}/${repo}\n\n`;
  md += `| Issue | Title | Comments | Reactions |\n`;
  md += `|-------|-------|----------|-----------|\n`;
  for (const s of stats) {
    md += `| [#${s.number}](https://github.com/${owner}/${repo}/issues/${s.number}) | ${s.title.replace(/\|/g, '\\|')} | ${s.comments} | ${s.reactions} |\n`;
  }

  fs.mkdirSync('stats', { recursive: true });
  fs.writeFileSync('stats/enhancements-stats.md', md);
})();
