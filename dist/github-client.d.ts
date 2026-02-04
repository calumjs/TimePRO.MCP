/**
 * GitHub API client for commit scanning
 */
import type { GitScanResult } from "./types.js";
/**
 * Scan GitHub for commits by a user in a date range
 */
export declare function scanGitHubCommits(username: string, startDate: string, endDate: string, token?: string): Promise<GitScanResult>;
//# sourceMappingURL=github-client.d.ts.map