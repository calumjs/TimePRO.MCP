#!/usr/bin/env node

/**
 * TimePRO MCP Server
 *
 * An MCP server that wraps the TimePRO API for timesheet management.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { TimeProClient } from "./timepro-client.js";
import { scanGitHubCommits } from "./github-client.js";
import {
  createConfirmation,
  executeConfirmation,
} from "./confirmation-service.js";
import type { TimesheetDto } from "./types.js";

// Configuration from environment variables
const TIMEPRO_API_URL = process.env.TIMEPRO_API_URL;
const TIMEPRO_API_KEY = process.env.TIMEPRO_API_KEY;
const TIMEPRO_TENANT_ID = process.env.TIMEPRO_TENANT_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const TIMEPRO_CONFIRM_PHRASE = process.env.TIMEPRO_CONFIRM_PHRASE;

if (!TIMEPRO_API_URL || !TIMEPRO_API_KEY || !TIMEPRO_TENANT_ID) {
  console.error(
    "Error: Missing required environment variables. Please set:\n" +
      "  TIMEPRO_API_URL - TimePRO base URL (e.g., https://ssw.sswtimepro.com)\n" +
      "  TIMEPRO_API_KEY - Your personal access token\n" +
      "  TIMEPRO_TENANT_ID - Your tenant ID"
  );
  process.exit(1);
}

const client = new TimeProClient(
  TIMEPRO_API_URL,
  TIMEPRO_API_KEY,
  TIMEPRO_TENANT_ID
);

// Create MCP server
const server = new Server(
  {
    name: "timepro-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
const tools = [
  {
    name: "list_clients",
    description:
      "Search for clients/customers to use in timesheets. Returns array with Value (client ID string like 'SSW' or 'LR8R0L') and Text (display name). Use the Value field as client_id when creating timesheets.",
    inputSchema: {
      type: "object" as const,
      properties: {
        search_text: {
          type: "string",
          description: "Filter clients by name (optional). Leave empty to list all clients.",
        },
      },
    },
  },
  {
    name: "list_projects",
    description:
      "Get projects for a specific client. Returns ProjectID and ProjectName. TIP: If multiple projects exist or names are unclear, use list_timesheets to find recent bookings for this client - reuse the same ProjectID. Projects with star emoji are active/common. Projects starting with 'zz' or 'yy' are archived. If still unclear, ask user to confirm.",
    inputSchema: {
      type: "object" as const,
      properties: {
        client_id: {
          type: "string",
          description: "Client ID from list_clients Value field (e.g., 'SSW', 'LR8R0L')",
        },
      },
      required: ["client_id"],
    },
  },
  {
    name: "list_categories",
    description:
      "Get available timesheet categories. Returns array with CategoryID (string like 'BOT', 'MTAS', 'WEBDEV') and CategoryName. Common categories: BOT=Bot Development, MTAS=Meeting, WEBDEV=Web Development, ADMIN=Administration. Use CategoryID as category_id when creating timesheets.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "list_locations",
    description:
      "Get available work locations. Returns array with LocationID (string like 'SSW', 'Client', 'Home') and LocationName. Use LocationID as location_id when creating timesheets.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_timesheet_defaults",
    description:
      "Get default values based on last timesheet, including client, project, location, and rates. Returns TimesheetStartTime/TimesheetEndTime as suggested work hours. NOTE: Do NOT use TimeLess from this response for break_minutes - it may cause validation errors. Only set break_minutes if user explicitly requests it.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format (e.g., '2025-01-29')",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "list_timesheets",
    description:
      "List user's timesheets in a date range. Returns id, title (shows client + project name), start/end times. USEFUL FOR: 1) Finding which project was used for a client recently (check last few weeks), 2) Verifying timesheet was created, 3) Finding timesheet ID for updates/deletes. Use get_timesheet with id for full details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        start_date: {
          type: "string",
          description: "Start date YYYY-MM-DD (e.g., '2025-01-01'). TIP: Use last 2-4 weeks to find recent project usage",
        },
        end_date: {
          type: "string",
          description: "End date YYYY-MM-DD (e.g., '2025-01-31')",
        },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "get_timesheet",
    description:
      "Get full details of a specific timesheet including client, project, category, times, notes, and billing info. Use the numeric id from list_timesheets.",
    inputSchema: {
      type: "object" as const,
      properties: {
        timesheet_id: {
          type: "number",
          description: "Numeric timesheet ID from list_timesheets (e.g., 186232353)",
        },
      },
      required: ["timesheet_id"],
    },
  },
  {
    name: "create_timesheet",
    description:
      "Create a new timesheet entry (dry-run by default - returns a confirmation ID that must be confirmed with confirm_operation). WORKFLOW: 1) Use list_clients to find client_id, 2) Use list_projects to find project_id, 3) Use list_categories to find category_id. Default: 09:00-18:00 with 60 min break = 8 billable hours. Rate and GST (10%) are auto-fetched.",
    inputSchema: {
      type: "object" as const,
      properties: {
        client_id: {
          type: "string",
          description: "Client ID string from list_clients Value field (e.g., 'SSW', 'LR8R0L')",
        },
        project_id: {
          type: "string",
          description: "Project ID string from list_projects ProjectID field (e.g., 'TP', 'BM1001')",
        },
        category_id: {
          type: "string",
          description: "Category ID string from list_categories CategoryID field (e.g., 'BOT', 'MTAS', 'WEBDEV')",
        },
        date: {
          type: "string",
          description: "Date of work in YYYY-MM-DD format (e.g., '2025-01-29')",
        },
        start_time: {
          type: "string",
          description: "Start time in 24-hour HH:MM format. Default: '09:00' (9am). Examples: '08:30', '10:00'",
        },
        end_time: {
          type: "string",
          description: "End time in 24-hour HH:MM format. Default: '18:00' (6pm) for 8 billable hours with 1hr break. Examples: '17:00', '18:30'",
        },
        break_minutes: {
          type: "number",
          description: "Break/lunch time in minutes. Standard is 60 (1 hour lunch) for 09:00-18:00 = 8 billable hours. Must be less than total work time. Set to 0 for no break.",
        },
        location_id: {
          type: "string",
          description: "REQUIRED. Location ID from list_locations: 'SSW' (office), 'Client' (client site), 'Home' (remote), 'Travel', 'Other'",
        },
        billable_id: {
          type: "string",
          description: "Billing type (auto-set based on client): 'B'=Billable (green, client work), 'W'=WriteOff (black, internal), 'BPP'=Prepaid (green). SSW client defaults to 'W', others to 'B'. Override only if needed.",
        },
        note: {
          type: "string",
          description: "Description of work performed (optional but recommended)",
        },
      },
      required: [
        "client_id",
        "project_id",
        "category_id",
        "date",
        "start_time",
        "end_time",
        "location_id",
      ],
    },
  },
  {
    name: "update_timesheet",
    description:
      "Update an existing timesheet. Only provide fields you want to change - others will keep their current values. Use get_timesheet first to see current values.",
    inputSchema: {
      type: "object" as const,
      properties: {
        timesheet_id: {
          type: "number",
          description: "Numeric timesheet ID to update (e.g., 186232353)",
        },
        client_id: {
          type: "string",
          description: "New client ID string (e.g., 'SSW')",
        },
        project_id: {
          type: "string",
          description: "New project ID string (e.g., 'TP')",
        },
        category_id: {
          type: "string",
          description: "New category ID string (e.g., 'BOT')",
        },
        date: {
          type: "string",
          description: "New date in YYYY-MM-DD format",
        },
        start_time: {
          type: "string",
          description: "New start time in HH:MM format (e.g., '09:00')",
        },
        end_time: {
          type: "string",
          description: "New end time in HH:MM format (e.g., '17:00')",
        },
        break_minutes: {
          type: "number",
          description: "New break time in minutes",
        },
        location_id: {
          type: "string",
          description: "New location ID (e.g., 'SSW', 'Client', 'Home')",
        },
        billable_id: {
          type: "string",
          description: "New billable category ID",
        },
        note: {
          type: "string",
          description: "New description of work performed",
        },
      },
      required: ["timesheet_id"],
    },
  },
  {
    name: "delete_timesheet",
    description: "Delete a timesheet (dry-run by default - returns a confirmation ID that must be confirmed with confirm_operation). Shows a preview of the timesheet that will be deleted.",
    inputSchema: {
      type: "object" as const,
      properties: {
        timesheet_id: {
          type: "number",
          description: "Numeric timesheet ID to delete (e.g., 186232353)",
        },
      },
      required: ["timesheet_id"],
    },
  },
  {
    name: "get_client_rate",
    description:
      "Get the billing rate for the current employee and a specific client, optionally for a specific date. Returns Rate, PrepaidRate, and other billing details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        client_id: {
          type: "string",
          description: "Client ID string (e.g., 'SSW', 'LR8R0L')",
        },
        date: {
          type: "string",
          description: "Optional date in YYYY-MM-DD format to get rate effective on that date. Defaults to today.",
        },
      },
      required: ["client_id"],
    },
  },
  {
    name: "get_crm_bookings",
    description:
      "Fetch CRM appointments/bookings for the current employee. Note: CRM bookings work only on SSW production environment.",
    inputSchema: {
      type: "object" as const,
      properties: {
        start_date: {
          type: "string",
          description: "Start date YYYY-MM-DD. Defaults to Monday of current week.",
        },
        end_date: {
          type: "string",
          description: "End date YYYY-MM-DD. Defaults to Sunday of current week.",
        },
      },
    },
  },
  {
    name: "scan_github_commits",
    description:
      "Scan GitHub for commits authored by a user in a date range. Requires GITHUB_TOKEN environment variable. Returns daily activity grouped by repository with commit details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: {
          type: "string",
          description: "GitHub username to scan. Uses GITHUB_USERNAME env var if not provided.",
        },
        days: {
          type: "number",
          description: "Number of days to scan back from today. Default: 7.",
        },
      },
    },
  },
  {
    name: "recommend_day",
    description:
      "Get a daily timesheet recommendation by aggregating: existing timesheets, suggested timesheets, CRM bookings, GitHub commits, and recent projects. Each data source is fetched independently (failures don't block others).",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format. Defaults to today.",
        },
      },
    },
  },
  {
    name: "recommend_week",
    description:
      "Get weekly timesheet recommendations. Fetches GitHub commits and recent projects once for the whole week, then per-day: existing timesheets, suggested timesheets, CRM bookings. Returns weekly summary and per-day breakdowns.",
    inputSchema: {
      type: "object" as const,
      properties: {
        start_date: {
          type: "string",
          description: "Start date (Monday) in YYYY-MM-DD format. Defaults to Monday of current week.",
        },
      },
    },
  },
  {
    name: "confirm_operation",
    description:
      "Execute a pending dry-run operation (from create_timesheet or delete_timesheet). Validates the confirmation is still pending and not expired, then executes the stored operation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        confirmation_id: {
          type: "string",
          description: "The confirmation ID returned by the dry-run operation.",
        },
        passphrase: {
          type: "string",
          description: "Required if TIMEPRO_CONFIRM_PHRASE environment variable is set. Must match exactly.",
        },
      },
      required: ["confirmation_id"],
    },
  },
];

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Helper to calculate hours between times
function calculateHours(
  startTime: string,
  endTime: string,
  breakMinutes: number = 0
): { total: number; billable: number } {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const workedMinutes = endMinutes - startMinutes - breakMinutes;

  const total = workedMinutes / 60;
  return { total, billable: total };
}

// Helper to format full datetime for API (date + time -> YYYY-MM-DDTHH:MM:SS)
function formatDateTime(date: string, time: string): string {
  // Ensure time has seconds
  const timeParts = time.split(":");
  const formattedTime = timeParts.length === 3 ? time : `${time}:00`;
  return `${date}T${formattedTime}`;
}

// Helper to get today's date as YYYY-MM-DD
function today(): string {
  return new Date().toISOString().split("T")[0];
}

// Helper to get Monday of the current week
function getMonday(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

// Helper to get Sunday of the week starting from a Monday
function getSunday(mondayStr: string): string {
  const d = new Date(mondayStr);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split("T")[0];
}

// Helper to add days to a date string
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// Helper to build a TimesheetDto from create_timesheet args
async function buildTimesheetDto(args: Record<string, unknown>): Promise<TimesheetDto> {
  const clientId = args.client_id as string;
  const projectId = args.project_id as string;
  const categoryId = args.category_id as string;
  const date = args.date as string;
  const startTime = args.start_time as string;
  const endTime = args.end_time as string;
  const breakMinutes = (args.break_minutes as number) || 0;
  const locationId = args.location_id as string;
  const rawBillableId = args.billable_id;
  const billableId = (typeof rawBillableId === 'string' && rawBillableId.trim() !== '')
    ? rawBillableId.trim()
    : undefined;
  const note = args.note as string | undefined;

  const empId = await client.getEmployeeId();
  const { total, billable } = calculateHours(startTime, endTime, breakMinutes);

  if (billable <= 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid time range: break_minutes (${breakMinutes}) exceeds or equals total work time. ` +
      `Start: ${startTime}, End: ${endTime}, Total hours: ${total + breakMinutes/60}, Break: ${breakMinutes/60} hours. ` +
      `Billable hours must be positive.`
    );
  }

  const rateInfo = await client.getClientRate(clientId);
  const sellPrice = rateInfo.Rate;
  const breakHours = breakMinutes / 60;
  const defaultBillableId = clientId.toUpperCase() === "SSW" ? "W" : "B";
  const finalBillableId = billableId || defaultBillableId;

  return {
    EmpID: empId,
    ClientID: clientId,
    ProjectID: projectId,
    CategoryID: categoryId,
    LocationID: locationId,
    BillableID: finalBillableId,
    DateCreated: date,
    TimeStart: formatDateTime(date, startTime),
    TimeEnd: formatDateTime(date, endTime),
    TimeLess: breakHours,
    TimeTotal: total + breakHours,
    TimeBillable: billable,
    SellPrice: sellPrice,
    SalesTaxPct: 0.1,
    Notes: note,
  };
}

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_clients": {
        const searchText = (args?.search_text as string) || "";
        const clients = await client.searchClients(searchText);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(clients, null, 2),
            },
          ],
        };
      }

      case "list_projects": {
        const clientId = args?.client_id as string;
        if (!clientId) {
          throw new McpError(ErrorCode.InvalidParams, "client_id is required");
        }
        const projects = await client.getProjectsForClient(clientId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(projects, null, 2),
            },
          ],
        };
      }

      case "list_categories": {
        const categories = await client.getCategories();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(categories, null, 2),
            },
          ],
        };
      }

      case "list_locations": {
        const locations = await client.getLocations();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(locations, null, 2),
            },
          ],
        };
      }

      case "get_timesheet_defaults": {
        const date = args?.date as string;
        if (!date) {
          throw new McpError(ErrorCode.InvalidParams, "date is required");
        }
        const defaults = await client.getTimesheetDefaults(date);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(defaults, null, 2),
            },
          ],
        };
      }

      case "list_timesheets": {
        const startDate = args?.start_date as string;
        const endDate = args?.end_date as string;
        if (!startDate || !endDate) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "start_date and end_date are required"
          );
        }
        const timesheets = await client.listTimesheets(startDate, endDate);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(timesheets, null, 2),
            },
          ],
        };
      }

      case "get_timesheet": {
        const timesheetId = args?.timesheet_id as number;
        if (!timesheetId) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "timesheet_id is required"
          );
        }
        const timesheet = await client.getTimesheet(timesheetId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(timesheet, null, 2),
            },
          ],
        };
      }

      case "create_timesheet": {
        const clientId = args?.client_id as string;
        const projectId = args?.project_id as string;
        const categoryId = args?.category_id as string;
        const date = args?.date as string;
        const startTime = args?.start_time as string;
        const endTime = args?.end_time as string;
        const locationId = args?.location_id as string;

        if (
          !clientId ||
          !projectId ||
          !categoryId ||
          !date ||
          !startTime ||
          !endTime ||
          !locationId
        ) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "client_id, project_id, category_id, date, start_time, end_time, and location_id are all required"
          );
        }

        // Build the DTO to validate and get rate info
        const timesheetDto = await buildTimesheetDto(args as Record<string, unknown>);

        // Create dry-run confirmation
        const confirmation = createConfirmation(
          "create_timesheet",
          `Create timesheet for ${clientId}/${projectId} on ${date} (${startTime}-${endTime})`,
          {
            client: clientId,
            project: projectId,
            category: categoryId,
            date,
            startTime,
            endTime,
            breakHours: timesheetDto.TimeLess,
            billableHours: timesheetDto.TimeBillable,
            sellPrice: timesheetDto.SellPrice,
            note: timesheetDto.Notes || "",
          },
          { timesheet: timesheetDto }
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  dryRun: true,
                  confirmationId: confirmation.id,
                  expiresAt: confirmation.expiresAt,
                  message: "Timesheet prepared but NOT yet created. Use confirm_operation with the confirmationId to execute.",
                  preview: confirmation.preview,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "update_timesheet": {
        const timesheetId = args?.timesheet_id as number;
        if (!timesheetId) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "timesheet_id is required"
          );
        }

        // Fetch existing timesheet
        const existing = await client.getTimesheet(timesheetId);

        // Apply updates (existing.TimeLess is in minutes from the API)
        const clientId = (args?.client_id as string) || existing.ClientID;
        const projectId = (args?.project_id as string) || existing.ProjectID;
        const categoryId = (args?.category_id as string) || existing.CategoryID;
        const date = (args?.date as string) || existing.DateCreated.split("T")[0];
        const startTime = (args?.start_time as string) || existing.StartTime.substring(0, 5);
        const endTime = (args?.end_time as string) || existing.EndTime.substring(0, 5);
        const breakMinutes =
          args?.break_minutes !== undefined
            ? (args.break_minutes as number)
            : existing.TimeLess;  // Already in minutes from API
        const locationId = (args?.location_id as string) || existing.LocationID;
        // Normalize billable_id: treat empty string as "use existing"
        const rawBillableId = args?.billable_id;
        const billableId = (typeof rawBillableId === 'string' && rawBillableId.trim() !== '')
          ? rawBillableId.trim()
          : existing.BillableID;
        const note =
          args?.note !== undefined
            ? (args.note as string)
            : existing.Note;

        const empId = await client.getEmployeeId();
        const { total, billable } = calculateHours(
          startTime,
          endTime,
          breakMinutes
        );

        // Convert break from minutes to hours for the API
        const breakHours = breakMinutes / 60;

        const timesheet: TimesheetDto = {
          TimeID: timesheetId,
          EmpID: empId,
          ClientID: clientId,
          ProjectID: projectId,
          CategoryID: categoryId,
          LocationID: locationId,
          BillableID: billableId,
          DateCreated: date,
          TimeStart: formatDateTime(date, startTime),
          TimeEnd: formatDateTime(date, endTime),
          TimeLess: breakHours,
          TimeTotal: total + breakHours,
          TimeBillable: billable,
          SellPrice: existing.SellPrice,
          SalesTaxPct: existing.SalesTaxPct || 0.1,
          Notes: note,
        };

        await client.updateTimesheet(timesheet);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Timesheet ${timesheetId} updated successfully`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "delete_timesheet": {
        const timesheetId = args?.timesheet_id as number;
        if (!timesheetId) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "timesheet_id is required"
          );
        }

        // Fetch details for preview
        const existing = await client.getTimesheet(timesheetId);

        // Create dry-run confirmation
        const confirmation = createConfirmation(
          "delete_timesheet",
          `Delete timesheet ${timesheetId} (${existing.ClientName} - ${existing.ProjectID} on ${existing.DateCreated})`,
          {
            timesheetId,
            client: existing.ClientName,
            project: existing.ProjectID,
            category: existing.CategoryName,
            date: existing.DateCreated,
            startTime: existing.StartTime,
            endTime: existing.EndTime,
            billableHours: existing.TimeBillable,
            note: existing.Note,
          },
          { timesheetId }
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  dryRun: true,
                  confirmationId: confirmation.id,
                  expiresAt: confirmation.expiresAt,
                  message: "Timesheet will be deleted when confirmed. Use confirm_operation with the confirmationId to execute.",
                  preview: confirmation.preview,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_client_rate": {
        const clientId = args?.client_id as string;
        if (!clientId) {
          throw new McpError(ErrorCode.InvalidParams, "client_id is required");
        }
        const date = (args?.date as string) || today();
        const rate = await client.getClientRateForDate(clientId, date);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(rate, null, 2),
            },
          ],
        };
      }

      case "get_crm_bookings": {
        const empId = await client.getEmployeeId();
        const startDate = (args?.start_date as string) || getMonday();
        const endDate = (args?.end_date as string) || getSunday(startDate);

        const appointments = await client.getAppointments(empId, startDate, endDate);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  note: "CRM bookings work only on SSW production environment",
                  startDate,
                  endDate,
                  appointments,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "scan_github_commits": {
        const username = (args?.username as string) || GITHUB_USERNAME;
        if (!username) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "username is required (or set GITHUB_USERNAME environment variable)"
          );
        }
        if (!GITHUB_TOKEN) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "GITHUB_TOKEN environment variable is required for GitHub scanning"
          );
        }

        const days = (args?.days as number) || 7;
        const endDate = today();
        const startDate = addDays(endDate, -days);

        const result = await scanGitHubCommits(username, startDate, endDate, GITHUB_TOKEN);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "recommend_day": {
        const date = (args?.date as string) || today();
        const empId = await client.getEmployeeId();

        // Fetch all data sources independently
        const [
          existingResult,
          suggestedResult,
          crmResult,
          githubResult,
          recentResult,
        ] = await Promise.allSettled([
          client.getTimesheetsDetailed(date, date),
          client.getSuggestedTimesheets(date),
          client.getAppointments(empId, date, date),
          (GITHUB_TOKEN && GITHUB_USERNAME)
            ? scanGitHubCommits(GITHUB_USERNAME, date, date, GITHUB_TOKEN)
            : Promise.resolve(null),
          client.getRecentProjectsDetailed(),
        ]);

        const existingTimesheets = existingResult.status === "fulfilled"
          ? existingResult.value.filter(t => !t.IsSuggested)
          : [];
        const suggestedTimesheets = suggestedResult.status === "fulfilled"
          ? suggestedResult.value
          : [];
        const crmBookings = crmResult.status === "fulfilled"
          ? crmResult.value
          : [];
        const githubActivity = githubResult.status === "fulfilled"
          ? githubResult.value
          : null;
        const recentProjects = recentResult.status === "fulfilled"
          ? recentResult.value
          : [];

        const existingHours = existingTimesheets.reduce(
          (sum, t) => sum + t.TimeBillable, 0
        );
        const expectedHours = 8;
        const hoursNeeded = Math.max(0, expectedHours - existingHours);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  date,
                  existingHours,
                  expectedHours,
                  hoursNeeded,
                  existingTimesheets: existingTimesheets.map(t => ({
                    id: t.TimesheetID,
                    client: t.ClientName,
                    project: t.ProjectName,
                    category: t.CategoryName,
                    hours: t.TimeBillable,
                    note: t.Note,
                  })),
                  suggestedTimesheets: suggestedTimesheets.map(t => ({
                    client: t.ClientName,
                    project: t.ProjectName,
                    category: t.CategoryName,
                    hours: t.TimeBillable,
                    note: t.Note,
                  })),
                  crmBookings: crmBookings.map(a => ({
                    title: a.title,
                    start: a.start,
                    end: a.end,
                    clientId: a.clientId,
                    projectId: a.projectId,
                  })),
                  githubCommits: githubActivity?.dailyActivity?.[0]?.commits?.map(c => ({
                    repository: c.repository,
                    message: c.message,
                    date: c.date,
                  })) || [],
                  recentProjects: recentProjects.slice(0, 10).map(p => ({
                    client: p.Client,
                    clientId: p.ClientID,
                    project: p.Project,
                    projectId: p.ProjectID,
                    category: p.Category,
                    categoryId: p.CategoryID,
                    dateCreated: p.DateCreated,
                  })),
                  errors: [
                    existingResult.status === "rejected" ? `timesheets: ${existingResult.reason}` : null,
                    suggestedResult.status === "rejected" ? `suggested: ${suggestedResult.reason}` : null,
                    crmResult.status === "rejected" ? `crm: ${crmResult.reason}` : null,
                    githubResult.status === "rejected" ? `github: ${githubResult.reason}` : null,
                    recentResult.status === "rejected" ? `recent: ${recentResult.reason}` : null,
                  ].filter(Boolean),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "recommend_week": {
        const mondayStr = (args?.start_date as string) || getMonday();
        const sundayStr = getSunday(mondayStr);
        const empId = await client.getEmployeeId();

        // Fetch week-level data once
        const [githubResult, recentResult] = await Promise.allSettled([
          (GITHUB_TOKEN && GITHUB_USERNAME)
            ? scanGitHubCommits(GITHUB_USERNAME, mondayStr, sundayStr, GITHUB_TOKEN)
            : Promise.resolve(null),
          client.getRecentProjectsDetailed(),
        ]);

        const githubActivity = githubResult.status === "fulfilled" ? githubResult.value : null;
        const recentProjects = recentResult.status === "fulfilled" ? recentResult.value : [];

        // Fetch per-day data for Mon-Fri
        const days: Array<{
          date: string;
          existingHours: number;
          expectedHours: number;
          hoursNeeded: number;
          existingTimesheets: unknown[];
          suggestedTimesheets: unknown[];
          crmBookings: unknown[];
          githubCommits: unknown[];
        }> = [];

        let totalExistingHours = 0;
        const totalExpectedHours = 40; // 5 days x 8 hours

        for (let i = 0; i < 5; i++) {
          const dayDate = addDays(mondayStr, i);

          const [existingResult, suggestedResult, crmResult] = await Promise.allSettled([
            client.getTimesheetsDetailed(dayDate, dayDate),
            client.getSuggestedTimesheets(dayDate),
            client.getAppointments(empId, dayDate, dayDate),
          ]);

          const existingTimesheets = existingResult.status === "fulfilled"
            ? existingResult.value.filter(t => !t.IsSuggested)
            : [];
          const suggestedTimesheets = suggestedResult.status === "fulfilled"
            ? suggestedResult.value
            : [];
          const crmBookings = crmResult.status === "fulfilled"
            ? crmResult.value
            : [];

          const existingHours = existingTimesheets.reduce(
            (sum, t) => sum + t.TimeBillable, 0
          );
          totalExistingHours += existingHours;

          // Find GitHub commits for this day
          const dayCommits = githubActivity?.dailyActivity?.find(d => d.date === dayDate);

          days.push({
            date: dayDate,
            existingHours,
            expectedHours: 8,
            hoursNeeded: Math.max(0, 8 - existingHours),
            existingTimesheets: existingTimesheets.map(t => ({
              id: t.TimesheetID,
              client: t.ClientName,
              project: t.ProjectName,
              hours: t.TimeBillable,
              note: t.Note,
            })),
            suggestedTimesheets: suggestedTimesheets.map(t => ({
              client: t.ClientName,
              project: t.ProjectName,
              hours: t.TimeBillable,
              note: t.Note,
            })),
            crmBookings: crmBookings.map(a => ({
              title: a.title,
              start: a.start,
              end: a.end,
              clientId: a.clientId,
            })),
            githubCommits: dayCommits?.commits?.map(c => ({
              repository: c.repository,
              message: c.message,
            })) || [],
          });
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  weekStart: mondayStr,
                  weekEnd: sundayStr,
                  summary: {
                    existingHours: totalExistingHours,
                    expectedHours: totalExpectedHours,
                    hoursNeeded: Math.max(0, totalExpectedHours - totalExistingHours),
                    complete: totalExistingHours >= totalExpectedHours,
                  },
                  days,
                  recentProjects: recentProjects.slice(0, 10).map(p => ({
                    client: p.Client,
                    clientId: p.ClientID,
                    project: p.Project,
                    projectId: p.ProjectID,
                    category: p.Category,
                    categoryId: p.CategoryID,
                    dateCreated: p.DateCreated,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "confirm_operation": {
        const confirmationId = args?.confirmation_id as string;
        if (!confirmationId) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "confirmation_id is required"
          );
        }

        // Check passphrase if required
        if (TIMEPRO_CONFIRM_PHRASE) {
          const passphrase = args?.passphrase as string;
          if (passphrase !== TIMEPRO_CONFIRM_PHRASE) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "Invalid or missing passphrase. TIMEPRO_CONFIRM_PHRASE is configured and must be provided."
            );
          }
        }

        const result = await executeConfirmation(
          confirmationId,
          async (payload) => {
            // Determine which operation to execute based on the payload
            if ("timesheet" in payload) {
              // create_timesheet
              const timesheetDto = payload.timesheet as TimesheetDto;
              const created = await client.createTimesheet(timesheetDto);
              return {
                success: true,
                timesheet_id: created.TimesheetID,
                message: "Timesheet created successfully",
                details: {
                  id: created.TimesheetID,
                  client: created.ClientName,
                  project: created.ProjectID,
                  date: created.DateCreated,
                  hours: created.TimeBillable,
                },
              };
            } else if ("timesheetId" in payload) {
              // delete_timesheet
              const tsId = payload.timesheetId as number;
              await client.deleteTimesheet(tsId);
              return {
                success: true,
                message: `Timesheet ${tsId} deleted successfully`,
              };
            } else {
              throw new Error("Unknown operation payload");
            }
          }
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
          isError: !result.success,
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              error: errorMessage,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("TimePRO MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
