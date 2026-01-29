/**
 * HTTP client for TimePRO API
 */

import type {
  ClientInfo,
  ProjectInfo,
  CategoryInfo,
  LocationInfo,
  TimesheetDefaults,
  TimesheetSummary,
  TimesheetDetails,
  TimesheetDto,
  ClientRate,
} from "./types.js";

export class TimeProClient {
  private baseUrl: string;
  private apiKey: string;
  private tenantId: string;
  private employeeId: string | null = null;

  constructor(baseUrl: string, apiKey: string, tenantId: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.apiKey = apiKey;
    this.tenantId = tenantId;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-timepro-api-key": this.apiKey,
      "x-timepro-tenant-id": this.tenantId,
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `TimePRO API error (${response.status}): ${errorText || response.statusText}`
      );
    }

    // Handle empty responses (e.g., DELETE)
    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  /**
   * Get the current user's employee ID
   */
  async getEmployeeId(): Promise<string> {
    if (this.employeeId !== null) {
      return this.employeeId;
    }

    const response = await this.fetch<{ EmpID: string }>("/api/Employees/GetEmployeeID");
    this.employeeId = response.EmpID;
    return response.EmpID;
  }

  /**
   * Search for clients by name
   */
  async searchClients(searchText: string = ""): Promise<ClientInfo[]> {
    const encoded = encodeURIComponent(searchText);
    return this.fetch<ClientInfo[]>(
      `/api/Timesheets/GetClientListForAddTimesheet?searchText=${encoded}`
    );
  }

  /**
   * Get projects for a specific client
   */
  async getProjectsForClient(clientId: string): Promise<ProjectInfo[]> {
    return this.fetch<ProjectInfo[]>(`/api/Projects/Client/${clientId}`);
  }

  /**
   * Get recent projects for the current employee
   */
  async getRecentProjects(): Promise<ProjectInfo[]> {
    const empId = await this.getEmployeeId();
    return this.fetch<ProjectInfo[]>(`/api/Projects/GetRecentProjects?empId=${empId}`);
  }

  /**
   * Get available timesheet categories
   */
  async getCategories(): Promise<CategoryInfo[]> {
    return this.fetch<CategoryInfo[]>("/api/Timesheets/GetTimesheetCategories");
  }

  /**
   * Get available work locations
   */
  async getLocations(): Promise<LocationInfo[]> {
    return this.fetch<LocationInfo[]>("/api/Timesheets/GetTimesheetLocation");
  }

  /**
   * Get default values for creating a timesheet
   */
  async getTimesheetDefaults(date: string): Promise<TimesheetDefaults> {
    const empId = await this.getEmployeeId();
    return this.fetch<TimesheetDefaults>(
      `/api/Timesheets/GetAddTimesheetsView?empID=${empId}&date=${date}`
    );
  }

  /**
   * Get billing rate for employee/client combination
   */
  async getClientRate(clientId: string): Promise<ClientRate> {
    const empId = await this.getEmployeeId();
    return this.fetch<ClientRate>(
      `/api/Timesheets/GetClientRate?empID=${empId}&clientID=${clientId}`
    );
  }

  /**
   * List timesheets for a date range
   */
  async listTimesheets(
    startDate: string,
    endDate: string
  ): Promise<TimesheetSummary[]> {
    const empId = await this.getEmployeeId();
    return this.fetch<TimesheetSummary[]>(
      `/api/Timesheets/Summary?employeeID=${empId}&start=${startDate}&end=${endDate}`
    );
  }

  /**
   * Get details of a specific timesheet
   */
  async getTimesheet(timesheetId: number): Promise<TimesheetDetails> {
    return this.fetch<TimesheetDetails>(
      `/api/Timesheets/GetEditTimesheetsView?timeID=${timesheetId}`
    );
  }

  /**
   * Create a new timesheet
   * Returns the full created timesheet details
   */
  async createTimesheet(timesheet: TimesheetDto): Promise<TimesheetDetails> {
    return this.fetch<TimesheetDetails>(
      "/api/Timesheets/SaveTimesheet?isEdit=false&isSuggested=false",
      {
        method: "POST",
        body: JSON.stringify(timesheet),
      }
    );
  }

  /**
   * Update an existing timesheet
   */
  async updateTimesheet(timesheet: TimesheetDto): Promise<void> {
    await this.fetch<void>(
      "/api/Timesheets/SaveTimesheet?isEdit=true&isSuggested=false",
      {
        method: "POST",
        body: JSON.stringify(timesheet),
      }
    );
  }

  /**
   * Delete a timesheet
   */
  async deleteTimesheet(timesheetId: number): Promise<void> {
    await this.fetch<void>(`/api/Timesheets/DeleteTimesheet/${timesheetId}`, {
      method: "DELETE",
    });
  }
}
