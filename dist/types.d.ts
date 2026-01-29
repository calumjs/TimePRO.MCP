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
//# sourceMappingURL=types.d.ts.map