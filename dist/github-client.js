/**
 * GitHub API client for commit scanning
 */
/**
 * Scan GitHub for commits by a user in a date range
 */
export async function scanGitHubCommits(username, startDate, endDate, token) {
    const headers = {
        "User-Agent": "timepro-mcp-server",
        "Accept": "application/vnd.github+json",
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    const allCommits = [];
    const seenHashes = new Set();
    // Paginate through results (up to 10 pages x 100 results)
    for (let page = 1; page <= 10; page++) {
        const query = encodeURIComponent(`author:${username} author-date:${startDate}..${endDate}`);
        const url = `https://api.github.com/search/commits?q=${query}&per_page=100&page=${page}`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
            if (response.status === 403 || response.status === 429) {
                // Rate limited - return what we have
                break;
            }
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
                message: item.commit.message.split("\n")[0], // First line only
                repository: item.repository.full_name,
                source: "github",
            });
        }
        // Stop if we got all results
        if (data.items.length < 100 || allCommits.length >= data.total_count) {
            break;
        }
    }
    // Group by day
    const dailyMap = new Map();
    for (const commit of allCommits) {
        const day = commit.date.split("T")[0];
        if (!dailyMap.has(day)) {
            dailyMap.set(day, []);
        }
        dailyMap.get(day).push(commit);
    }
    // Build daily activity
    const dailyActivity = Array.from(dailyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, commits]) => {
        const repositories = [...new Set(commits.map(c => c.repository))];
        return {
            date,
            totalCommits: commits.length,
            repositories,
            commits,
        };
    });
    return {
        username,
        startDate,
        endDate,
        totalCommits: allCommits.length,
        dailyActivity,
    };
}
//# sourceMappingURL=github-client.js.map