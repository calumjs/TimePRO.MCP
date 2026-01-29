/**
 * HTTP client for TimePRO API
 */
import type { ClientInfo, ProjectInfo, CategoryInfo, LocationInfo, TimesheetDefaults, TimesheetSummary, TimesheetDetails, TimesheetDto, ClientRate } from "./types.js";
export declare class TimeProClient {
    private baseUrl;
    private apiKey;
    private tenantId;
    private employeeId;
    constructor(baseUrl: string, apiKey: string, tenantId: string);
    private fetch;
    /**
     * Get the current user's employee ID
     */
    getEmployeeId(): Promise<string>;
    /**
     * Search for clients by name
     */
    searchClients(searchText?: string): Promise<ClientInfo[]>;
    /**
     * Get projects for a specific client
     */
    getProjectsForClient(clientId: string): Promise<ProjectInfo[]>;
    /**
     * Get recent projects for the current employee
     */
    getRecentProjects(): Promise<ProjectInfo[]>;
    /**
     * Get available timesheet categories
     */
    getCategories(): Promise<CategoryInfo[]>;
    /**
     * Get available work locations
     */
    getLocations(): Promise<LocationInfo[]>;
    /**
     * Get default values for creating a timesheet
     */
    getTimesheetDefaults(date: string): Promise<TimesheetDefaults>;
    /**
     * Get billing rate for employee/client combination
     */
    getClientRate(clientId: string): Promise<ClientRate>;
    /**
     * List timesheets for a date range
     */
    listTimesheets(startDate: string, endDate: string): Promise<TimesheetSummary[]>;
    /**
     * Get details of a specific timesheet
     */
    getTimesheet(timesheetId: number): Promise<TimesheetDetails>;
    /**
     * Create a new timesheet
     * Returns the full created timesheet details
     */
    createTimesheet(timesheet: TimesheetDto): Promise<TimesheetDetails>;
    /**
     * Update an existing timesheet
     */
    updateTimesheet(timesheet: TimesheetDto): Promise<void>;
    /**
     * Delete a timesheet
     */
    deleteTimesheet(timesheetId: number): Promise<void>;
}
//# sourceMappingURL=timepro-client.d.ts.map