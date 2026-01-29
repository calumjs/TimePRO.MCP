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
      "Search for clients to use in timesheets. Returns a list of clients with their IDs and names.",
    inputSchema: {
      type: "object" as const,
      properties: {
        search_text: {
          type: "string",
          description: "Optional text to filter clients by name",
        },
      },
    },
  },
  {
    name: "list_projects",
    description:
      "Get projects for a specific client. Use this after selecting a client to find available projects.",
    inputSchema: {
      type: "object" as const,
      properties: {
        client_id: {
          type: "string",
          description: "The client ID to get projects for (e.g., 'SSW')",
        },
      },
      required: ["client_id"],
    },
  },
  {
    name: "list_categories",
    description:
      "Get available timesheet categories (e.g., Development, Meeting, Admin). These categorize the type of work done.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "list_locations",
    description:
      "Get available work locations (e.g., Office, Client Site, Remote).",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_timesheet_defaults",
    description:
      "Get default values for creating a timesheet, including last used client, project, and rates. Call this before creating a timesheet to get sensible defaults.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Date for the timesheet in YYYY-MM-DD format",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "list_timesheets",
    description:
      "List timesheets for the current user within a date range. Returns summary information for each timesheet.",
    inputSchema: {
      type: "object" as const,
      properties: {
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format",
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format",
        },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "get_timesheet",
    description:
      "Get full details of a specific timesheet by its ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        timesheet_id: {
          type: "number",
          description: "The ID of the timesheet to retrieve",
        },
      },
      required: ["timesheet_id"],
    },
  },
  {
    name: "create_timesheet",
    description:
      "Create a new timesheet entry. Requires client, project, category, date, and time range. Returns the created timesheet ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        client_id: {
          type: "string",
          description: "Client ID (use list_clients to find, e.g., 'SSW')",
        },
        project_id: {
          type: "string",
          description: "Project ID (use list_projects to find)",
        },
        category_id: {
          type: "string",
          description: "Category ID (use list_categories to find, e.g., 'DEV')",
        },
        date: {
          type: "string",
          description: "Date of work in YYYY-MM-DD format",
        },
        start_time: {
          type: "string",
          description: "Start time in HH:MM format (24-hour)",
        },
        end_time: {
          type: "string",
          description: "End time in HH:MM format (24-hour)",
        },
        break_minutes: {
          type: "number",
          description: "Break time in minutes (default: 0)",
        },
        location_id: {
          type: "string",
          description: "Work location ID (optional)",
        },
        billable_id: {
          type: "string",
          description: "Billable category ID (optional)",
        },
        note: {
          type: "string",
          description: "Description of work done (optional)",
        },
      },
      required: [
        "client_id",
        "project_id",
        "category_id",
        "date",
        "start_time",
        "end_time",
      ],
    },
  },
  {
    name: "update_timesheet",
    description:
      "Update an existing timesheet. All fields except timesheet_id are optional - only provided fields will be updated.",
    inputSchema: {
      type: "object" as const,
      properties: {
        timesheet_id: {
          type: "number",
          description: "The ID of the timesheet to update",
        },
        client_id: {
          type: "string",
          description: "Client ID",
        },
        project_id: {
          type: "string",
          description: "Project ID",
        },
        category_id: {
          type: "string",
          description: "Category ID",
        },
        date: {
          type: "string",
          description: "Date of work in YYYY-MM-DD format",
        },
        start_time: {
          type: "string",
          description: "Start time in HH:MM format (24-hour)",
        },
        end_time: {
          type: "string",
          description: "End time in HH:MM format (24-hour)",
        },
        break_minutes: {
          type: "number",
          description: "Break time in minutes",
        },
        location_id: {
          type: "string",
          description: "Work location ID",
        },
        billable_id: {
          type: "string",
          description: "Billable category ID",
        },
        note: {
          type: "string",
          description: "Description of work done",
        },
      },
      required: ["timesheet_id"],
    },
  },
  {
    name: "delete_timesheet",
    description: "Delete a timesheet by its ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        timesheet_id: {
          type: "number",
          description: "The ID of the timesheet to delete",
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
        const locationId = args?.location_id as string | undefined;
        const billableId = args?.billable_id as string | undefined;
        const note = args?.note as string | undefined;

        if (
          !clientId ||
          !projectId ||
          !categoryId ||
          !date ||
          !startTime ||
          !endTime
        ) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "client_id, project_id, category_id, date, start_time, and end_time are required"
          );
        }

        const empId = await client.getEmployeeId();
        const { total, billable } = calculateHours(
          startTime,
          endTime,
          breakMinutes
        );

        // Get rate for this client (required by TimePRO)
        const rateInfo = await client.getClientRate(clientId);
        const sellPrice = rateInfo.Rate;

        const timesheet: TimesheetDto = {
          EmpID: empId,
          ClientID: clientId,
          ProjectID: projectId,
          CategoryID: categoryId,
          DateCreated: date,
          StartTime: startTime,
          EndTime: endTime,
          TimeLess: breakMinutes,
          TimeTotal: total,
          TimeBillable: billable,
          LocationID: locationId,
          BillableID: billableId,
          SellPrice: sellPrice,
          Note: note,
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
                  message: `Timesheet created successfully with ID ${result.TimesheetID}`,
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

        // Apply updates
        const clientId = (args?.client_id as string) || existing.ClientID;
        const projectId = (args?.project_id as string) || existing.ProjectID;
        const categoryId = (args?.category_id as string) || existing.CategoryID;
        const date = (args?.date as string) || existing.DateCreated.split("T")[0];
        const startTime = (args?.start_time as string) || existing.StartTime.substring(0, 5);
        const endTime = (args?.end_time as string) || existing.EndTime.substring(0, 5);
        const breakMinutes =
          args?.break_minutes !== undefined
            ? (args.break_minutes as number)
            : existing.TimeLess;
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

        const timesheet: TimesheetDto = {
          TimesheetID: timesheetId,
          EmpID: empId,
          ClientID: clientId,
          ProjectID: projectId,
          CategoryID: categoryId,
          DateCreated: date,
          StartTime: startTime,
          EndTime: endTime,
          TimeLess: breakMinutes,
          TimeTotal: total,
          TimeBillable: billable,
          LocationID: locationId,
          BillableID: billableId,
          SellPrice: existing.SellPrice,
          Note: note,
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
