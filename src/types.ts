/**
 * TypeScript interfaces for TimePRO API
 */

// Client returned from search
export interface ClientInfo {
  Value: string;  // ClientID
  Text: string;   // ClientName
}

// Project for a client
export interface ProjectInfo {
  ProjectID: string;
  ProjectName: string;
  ClientID?: string;
}

// Timesheet category
export interface CategoryInfo {
  CategoryID: string;
  CategoryName: string;
  IsNonWorking: boolean;
}

// Work location
export interface LocationInfo {
  LocationID: string;
  LocationName: string;
}

// Billable category
export interface BillableInfo {
  BillableID: string;
  BillableName: string;
}

// Employee info
export interface EmployeeInfo {
  EmpID: string;
  EmpName?: string;
}

// Timesheet defaults response from GetAddTimesheetsView
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

// Timesheet summary (from list) - calendar-style response
export interface TimesheetSummary {
  id: number;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  textColor: string;
}

// Full timesheet details (from edit view)
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
  StartTime: string;  // Time portion HH:MM:SS
  EndTime: string;    // Time portion HH:MM:SS
  TimeLess: number;   // Minutes in response
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

// DTO for creating/updating timesheets (matches backend TimesheetsDto)
export interface TimesheetDto {
  TimeID?: number;           // 0 for new, existing ID for update
  EmpID: string;
  ClientID: string;
  ProjectID: string;
  CategoryID: string;
  LocationID: string;        // Required!
  BillableID?: string;
  DateCreated: string;       // YYYY-MM-DD format
  TimeStart: string;         // Full datetime: YYYY-MM-DDTHH:MM:SS
  TimeEnd: string;           // Full datetime: YYYY-MM-DDTHH:MM:SS
  TimeLess: number;          // Hours as decimal (e.g., 1.0 for 1 hour)
  TimeTotal: number;         // Hours
  TimeBillable: number;      // Hours
  SellPrice: number;
  SalesTaxPct: number;       // 0.1 for 10% GST
  Notes?: string;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Client rate response
export interface ClientRate {
  EmpID: string;
  ClientID: string;
  Rate: number;
  PrepaidRate: number;
  ClientRateID: number;
  ExpiryDate: string;
}

// CRM appointment/booking
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

// Recent project from API
export interface RecentProjectInfo {
  ClientId: string;
  ProjectId: string;
  ClientName: string;
  ProjectName: string;
  CategoryId: string;
  BillableId: string;
  IsBillable: boolean;
  TotalHours: number;
  TimesheetCount: number;
  LastUsed: string;
}

// GitHub API response types
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

// Normalized commit from any source
export interface GitCommit {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
  repository: string;
  source: string;
}

// Scan result with daily activity grouping
export interface GitScanResult {
  username: string;
  startDate: string;
  endDate: string;
  totalCommits: number;
  dailyActivity: DayActivity[];
}

// Per-day commit summary
export interface DayActivity {
  date: string;
  totalCommits: number;
  repositories: string[];
  commits: GitCommit[];
}

// Dry-run confirmation types
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

// Timesheet list view model item (from GetTimesheetListViewModel)
export interface TimesheetListViewItem {
  TimesheetID: number;
  EmpID: string;
  ClientID: string;
  ClientName: string;
  ProjectID: string;
  ProjectName: string;
  CategoryID: string;
  CategoryName: string;
  LocationID: string;
  BillableID: string;
  DateCreated: string;
  StartTime: string;
  EndTime: string;
  TimeLess: number;
  TotalTime: number;
  TimeBillable: number;
  SellPrice: number;
  Note: string;
  IsSuggested: boolean;
}
