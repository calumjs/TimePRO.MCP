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
import type { TimesheetDto } from "./types.js";

// Configuration from environment variables
const TIMEPRO_API_URL = process.env.TIMEPRO_API_URL;
const TIMEPRO_API_KEY = process.env.TIMEPRO_API_KEY;
const TIMEPRO_TENANT_ID = process.env.TIMEPRO_TENANT_ID;

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
      "Get projects for a specific client. Returns ProjectID and ProjectName. TIP: If multiple projects exist or names are unclear, use list_timesheets to find recent bookings for this client - reuse the same ProjectID. Projects with star emoji (⭐) are active/common. Projects starting with 'zz' or 'yy' are archived. If still unclear, ask user to confirm.",
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
      "Create a new timesheet entry. WORKFLOW: 1) Use list_clients to find client_id, 2) Use list_projects to find project_id (TIP: if unclear which project, use list_timesheets to check recent bookings for that client and reuse the same project, or infer from work description), 3) Use list_categories to find category_id. Default: 09:00-18:00 with 60 min break = 8 billable hours. Rate and GST (10%) are auto-fetched.",
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
          description: "Billable category ID (optional, usually auto-determined)",
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
    description: "Permanently delete a timesheet. This cannot be undone.",
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
        const breakMinutes = (args?.break_minutes as number) || 0;
        const locationId = args?.location_id as string;
        const billableId = args?.billable_id as string | undefined;
        const note = args?.note as string | undefined;

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

        const empId = await client.getEmployeeId();
        const { total, billable } = calculateHours(
          startTime,
          endTime,
          breakMinutes
        );

        // Validate that billable hours is positive
        if (billable <= 0) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid time range: break_minutes (${breakMinutes}) exceeds or equals total work time. ` +
            `Start: ${startTime}, End: ${endTime}, Total hours: ${total + breakMinutes/60}, Break: ${breakMinutes/60} hours. ` +
            `Billable hours must be positive.`
          );
        }

        // Get rate for this client (required by TimePRO)
        const rateInfo = await client.getClientRate(clientId);
        const sellPrice = rateInfo.Rate;

        // Convert break from minutes to hours for the API
        const breakHours = breakMinutes / 60;

        const timesheet: TimesheetDto = {
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
          TimeTotal: total + breakHours,  // Total time including break
          TimeBillable: billable,
          SellPrice: sellPrice,
          SalesTaxPct: 0.1,  // 10% GST for Australia
          Notes: note,
        };

        const result = await client.createTimesheet(timesheet);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  timesheet_id: result.TimesheetID,
                  message: `Timesheet created successfully`,
                  details: {
                    id: result.TimesheetID,
                    client: result.ClientName,
                    project: result.ProjectID,
                    date: result.DateCreated,
                    hours: result.TimeBillable,
                  }
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
        const billableId = (args?.billable_id as string) || existing.BillableID;
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

        await client.deleteTimesheet(timesheetId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Timesheet ${timesheetId} deleted successfully`,
                },
                null,
                2
              ),
            },
          ],
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
