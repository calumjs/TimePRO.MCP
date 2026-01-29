/**
 * HTTP client for TimePRO API
 */
export class TimeProClient {
    baseUrl;
    apiKey;
    tenantId;
    employeeId = null;
    constructor(baseUrl, apiKey, tenantId) {
        this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
        this.apiKey = apiKey;
        this.tenantId = tenantId;
    }
    async fetch(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            "Content-Type": "application/json",
            "x-timepro-api-key": this.apiKey,
            "x-timepro-tenant-id": this.tenantId,
            ...options.headers,
        };
        const response = await fetch(url, {
            ...options,
            headers,
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`TimePRO API error (${response.status}): ${errorText || response.statusText}`);
        }
        // Handle empty responses (e.g., DELETE)
        const text = await response.text();
        if (!text) {
            return {};
        }
        return JSON.parse(text);
    }
    /**
     * Get the current user's employee ID
     */
    async getEmployeeId() {
        if (this.employeeId !== null) {
            return this.employeeId;
        }
        const response = await this.fetch("/api/Employees/GetEmployeeID");
        this.employeeId = response.EmpID;
        return response.EmpID;
    }
    /**
     * Search for clients by name
     */
    async searchClients(searchText = "") {
        const encoded = encodeURIComponent(searchText);
        return this.fetch(`/api/Timesheets/GetClientListForAddTimesheet?searchText=${encoded}`);
    }
    /**
     * Get projects for a specific client
     */
    async getProjectsForClient(clientId) {
        return this.fetch(`/api/Projects/Client/${clientId}`);
    }
    /**
     * Get recent projects for the current employee
     */
    async getRecentProjects() {
        const empId = await this.getEmployeeId();
        return this.fetch(`/api/Projects/GetRecentProjects?empId=${empId}`);
    }
    /**
     * Get available timesheet categories
     */
    async getCategories() {
        return this.fetch("/api/Timesheets/GetTimesheetCategories");
    }
    /**
     * Get available work locations
     */
    async getLocations() {
        return this.fetch("/api/Timesheets/GetTimesheetLocation");
    }
    /**
     * Get default values for creating a timesheet
     */
    async getTimesheetDefaults(date) {
        const empId = await this.getEmployeeId();
        return this.fetch(`/api/Timesheets/GetAddTimesheetsView?empID=${empId}&date=${date}`);
    }
    /**
     * Get billing rate for employee/client combination
     */
    async getClientRate(clientId) {
        const empId = await this.getEmployeeId();
        return this.fetch(`/api/Timesheets/GetClientRate?empID=${empId}&clientID=${clientId}`);
    }
    /**
     * List timesheets for a date range
     */
    async listTimesheets(startDate, endDate) {
        const empId = await this.getEmployeeId();
        return this.fetch(`/api/Timesheets/Summary?employeeID=${empId}&start=${startDate}&end=${endDate}`);
    }
    /**
     * Get details of a specific timesheet
     */
    async getTimesheet(timesheetId) {
        return this.fetch(`/api/Timesheets/GetEditTimesheetsView?timeID=${timesheetId}`);
    }
    /**
     * Create a new timesheet
     * Returns the full created timesheet details
     */
    async createTimesheet(timesheet) {
        return this.fetch("/api/Timesheets/SaveTimesheet?isEdit=false&isSuggested=false", {
            method: "POST",
            body: JSON.stringify(timesheet),
        });
    }
    /**
     * Update an existing timesheet
     */
    async updateTimesheet(timesheet) {
        await this.fetch("/api/Timesheets/SaveTimesheet?isEdit=true&isSuggested=false", {
            method: "POST",
            body: JSON.stringify(timesheet),
        });
    }
    /**
     * Delete a timesheet
     */
    async deleteTimesheet(timesheetId) {
        await this.fetch(`/api/Timesheets/DeleteTimesheet/${timesheetId}`, {
            method: "DELETE",
        });
    }
}
//# sourceMappingURL=timepro-client.js.map