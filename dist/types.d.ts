/**
 * TypeScript interfaces for TimePRO API
 */
export interface ClientInfo {
    Value: string;
    Text: string;
}
export interface ProjectInfo {
    ProjectID: string;
    ProjectName: string;
    ClientID?: string;
}
export interface CategoryInfo {
    CategoryID: string;
    CategoryName: string;
    IsNonWorking: boolean;
}
export interface LocationInfo {
    LocationID: string;
    LocationName: string;
}
export interface BillableInfo {
    BillableID: string;
    BillableName: string;
}
export interface EmployeeInfo {
    EmpID: string;
    EmpName?: string;
}
export interface TimesheetDefaults {
    EmpID: string;
    EmpName: string;
    ClientID?: string;
    ClientName?: string;
    ProjectID?: string;
    ProjectType?: string;
    CategoryID?: string;
    CategoryName?: string;
    LocationID?: string;
    Location?: string;
    BillableID?: string;
    SellPrice?: number;
    SalesTaxPct?: number;
    PrepaidRate?: number;
    RegularRate?: number;
    TimesheetStartTime?: string;
    TimesheetEndTime?: string;
    TimeLess?: number;
}
export interface TimesheetSummary {
    id: number;
    title: string;
    start: string;
    end: string;
    allDay: boolean;
    color: string;
    textColor: string;
}
export interface TimesheetDetails {
    TimesheetID: number;
    EmpID: string;
    EmpName: string;
    ClientID: string;
    ClientName: string;
    ProjectID: string;
    ProjectType: string;
    CategoryID: string;
    CategoryName: string;
    IsNonWorkingCategory: boolean;
    LocationID: string;
    Location: string;
    BillableID: string;
    DateCreated: string;
    DateUpdated: string;
    StartTime: string;
    EndTime: string;
    TimeLess: number;
    TimeTotal: number;
    TimeBillable: number;
    SellPrice: number;
    SalesTaxPct: number;
    Note: string;
    IsOverridden: boolean;
    IsOverwriteRate: boolean;
    InvoiceID: string | null;
    CreatedOn: string;
}
export interface TimesheetDto {
    TimeID?: number;
    EmpID: string;
    ClientID: string;
    ProjectID: string;
    CategoryID: string;
    LocationID: string;
    BillableID?: string;
    DateCreated: string;
    TimeStart: string;
    TimeEnd: string;
    TimeLess: number;
    TimeTotal: number;
    TimeBillable: number;
    SellPrice: number;
    SalesTaxPct: number;
    Notes?: string;
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
export interface ClientRate {
    EmpID: string;
    ClientID: string;
    Rate: number;
    PrepaidRate: number;
    ClientRateID: number;
    ExpiryDate: string;
}
export interface AppointmentItem {
    id: number;
    title: string;
    start: string;
    end: string;
    allDay: boolean;
    clientId?: string;
    projectId?: string;
    editable: boolean;
    timeZoneOffsetInMinutes?: number;
}
export interface RecentProjectInfo {
    Client: string;
    ClientID: string;
    Project: string;
    ProjectID: string;
    Iteration: string;
    IterationId: number | null;
    Category: string;
    CategoryID: string;
    DateCreated: string;
    BillableID: string;
    IsBillable: boolean;
    TimesheetWorkType: number;
}
export interface GitHubSearchResponse {
    total_count: number;
    incomplete_results: boolean;
    items: GitHubSearchCommitItem[];
}
export interface GitHubSearchCommitItem {
    sha: string;
    commit: GitHubCommitDetail;
    repository: GitHubSearchRepository;
}
export interface GitHubCommitDetail {
    author: GitHubCommitAuthor;
    message: string;
}
export interface GitHubCommitAuthor {
    name: string;
    email: string;
    date: string;
}
export interface GitHubSearchRepository {
    full_name: string;
}
export interface GitCommit {
    hash: string;
    author: string;
    email: string;
    date: string;
    message: string;
    repository: string;
    source: string;
}
export interface GitScanResult {
    username: string;
    startDate: string;
    endDate: string;
    totalCommits: number;
    dailyActivity: DayActivity[];
}
export interface DayActivity {
    date: string;
    totalCommits: number;
    repositories: string[];
    commits: GitCommit[];
}
export type ConfirmationStatus = "Pending" | "Confirmed" | "Failed" | "Expired" | "Cancelled";
export interface PendingConfirmation {
    id: string;
    operationType: string;
    status: ConfirmationStatus;
    createdAt: string;
    expiresAt: string;
    description: string;
    preview: Record<string, unknown>;
    payload: Record<string, unknown>;
}
export interface ConfirmationResult {
    success: boolean;
    message: string;
    data?: unknown;
}
export interface TimesheetListViewItem {
    TimeID: number;
    EmpID: string;
    EmpName: string;
    Client: string;
    ClientId: string;
    Project: string;
    ProjectID: string;
    Iteration: string;
    Category: string;
    Location: string;
    LocationID: string;
    Notes: string;
    Date: string;
    StartTime: string;
    EndTime: string;
    BillableID: string;
    IsBillable: boolean;
    Less: number;
    TotalTime: number;
    HasNotes: boolean;
    IsSuggested: boolean;
    IsLeave: boolean;
    InputSource: number | null;
}
//# sourceMappingURL=types.d.ts.map