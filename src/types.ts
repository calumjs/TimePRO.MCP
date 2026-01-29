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
  ClientID: string;
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
  ProjectName?: string;
  CategoryID?: string;
  LocationID?: string;
  BillableID?: string;
  SellPrice?: number;
  Categories: CategoryInfo[];
  Locations: LocationInfo[];
  Billables: BillableInfo[];
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
  StartTime: string;
  EndTime: string;
  TimeLess: number; // minutes
  TimeTotal: number;
  TimeBillable: number;
  SellPrice: number;
  Note: string;
  IsOverridden: boolean;
  IsOverwriteRate: boolean;
  InvoiceID: string | null;
}

// DTO for creating/updating timesheets
export interface TimesheetDto {
  TimesheetID?: number;
  EmpID: string;
  ClientID: string;
  ProjectID: string;
  CategoryID: string;
  LocationID?: string;
  BillableID?: string;
  DateCreated: string;
  StartTime: string;
  EndTime: string;
  TimeLess: number; // minutes
  TimeTotal: number;
  TimeBillable: number;
  SellPrice?: number;
  Note?: string;
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
