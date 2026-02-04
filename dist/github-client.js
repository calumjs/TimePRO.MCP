/**
 * GitHub API client for commit, PR, and issue scanning
 */
function buildHeaders(token) {
    const headers = {
        "User-Agent": "timepro-mcp-server",
        "Accept": "application/vnd.github+json",
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}
/**
 * Extract repo full_name from repository_url
 * e.g. "https://api.github.com/repos/owner/repo" -> "owner/repo"
 */
function repoFromUrl(repositoryUrl) {
    const match = repositoryUrl.match(/repos\/(.+)$/);
    return match ? match[1] : repositoryUrl;
}
/**
 * Paginated search for GitHub issues/PRs
 */
async function searchIssues(query, headers, maxPages = 5) {
    const allItems = [];
    const seenIds = new Set();
    for (let page = 1; page <= maxPages; page++) {
        const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=100&page=${page}`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
            if (response.status === 403 || response.status === 429)
                break;
            throw new Error(`GitHub API error (${response.status}): ${response.statusText}`);
        }
        const data = await response.json();
        for (const item of data.items) {
            const key = `${item.repository_url}#${item.number}`;
            if (seenIds.has(key))
                continue;
            seenIds.add(key);
            allItems.push(item);
        }
        if (data.items.length < 100 || allItems.length >= data.total_count)
            break;
    }
    return allItems;
}
function toActivity(item, type) {
    return {
        number: item.number,
        title: item.title,
        url: item.html_url,
        repository: repoFromUrl(item.repository_url),
        state: item.state,
        type,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        closedAt: item.closed_at,
        labels: item.labels.map(l => l.name),
    };
}
/**
 * Scan GitHub for commits, PRs, and issues by a user in a date range
 */
export async function scanGitHubCommits(username, startDate, endDate, token) {
    const headers = buildHeaders(token);
    // Fetch all four sources in parallel
    const [commitsResult, prsAuthoredResult, prsReviewedResult, issuesResult] = await Promise.allSettled([
        fetchCommits(username, startDate, endDate, headers),
        searchIssues(`type:pr author:${username} created:${startDate}..${endDate}`, headers),
        searchIssues(`type:pr reviewed-by:${username} -author:${username} reviewed:${startDate}..${endDate}`, headers),
        searchIssues(`type:issue involves:${username} updated:${startDate}..${endDate}`, headers),
    ]);
    const allCommits = commitsResult.status === "fulfilled" ? commitsResult.value : [];
    const prsAuthored = prsAuthoredResult.status === "fulfilled"
        ? prsAuthoredResult.value.map(i => toActivity(i, "pr_authored"))
        : [];
    const prsReviewed = prsReviewedResult.status === "fulfilled"
        ? prsReviewedResult.value.map(i => toActivity(i, "pr_reviewed"))
        : [];
    const issuesInvolved = issuesResult.status === "fulfilled"
        ? issuesResult.value.map(i => toActivity(i, "issue"))
        : [];
    // Group commits by day
    const dailyMap = new Map();
    for (const commit of allCommits) {
        const day = commit.date.split("T")[0];
        if (!dailyMap.has(day)) {
            dailyMap.set(day, []);
        }
        dailyMap.get(day).push(commit);
    }
    const dailyActivity = Array.from(dailyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, commits]) => ({
        date,
        totalCommits: commits.length,
        repositories: [...new Set(commits.map(c => c.repository))],
        commits,
    }));
    return {
        username,
        startDate,
        endDate,
        totalCommits: allCommits.length,
        dailyActivity,
        pullRequestsAuthored: prsAuthored,
        pullRequestsReviewed: prsReviewed,
        issuesInvolved,
    };
}
/**
 * Fetch commits from GitHub Search Commits API
 */
async function fetchCommits(username, startDate, endDate, headers) {
    const allCommits = [];
    const seenHashes = new Set();
    for (let page = 1; page <= 10; page++) {
        const query = encodeURIComponent(`author:${username} author-date:${startDate}..${endDate}`);
        const url = `https://api.github.com/search/commits?q=${query}&per_page=100&page=${page}`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
            if (response.status === 403 || response.status === 429)
                break;
            throw new Error(`GitHub API error (${response.status}): ${response.statusText}`);
        }
        const data = await response.json();
        for (const item of data.items) {
            if (seenHashes.has(item.sha))
                continue;
            seenHashes.add(item.sha);
            allCommits.push({
                hash: item.sha,
                author: item.commit.author.name,
                email: item.commit.author.email,
                date: item.commit.author.date,
                message: item.commit.message.split("\n")[0],
                repository: item.repository.full_name,
                source: "github",
            });
        }
        if (data.items.length < 100 || allCommits.length >= data.total_count)
            break;
    }
    return allCommits;
}
//# sourceMappingURL=github-client.js.map