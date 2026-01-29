# TimePRO MCP Server

An MCP (Model Context Protocol) server that wraps the TimePRO API, enabling AI assistants to automatically create and manage timesheets on behalf of authenticated users.

## Features

- **List clients** - Search for clients to use in timesheets
- **List projects** - Get projects for a specific client
- **List categories** - Get available timesheet categories (Development, Meeting, etc.)
- **List locations** - Get available work locations
- **Get timesheet defaults** - Get default values including last used client/project
- **List timesheets** - View timesheets for a date range
- **Get timesheet** - Get full details of a specific timesheet
- **Create timesheet** - Create a new timesheet entry
- **Update timesheet** - Modify an existing timesheet
- **Delete timesheet** - Remove a timesheet

## Quick Start (npx - No Installation Required)

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "timepro": {
      "command": "npx",
      "args": ["-y", "github:calumjs/TimePRO.MCP"],
      "env": {
        "TIMEPRO_API_URL": "https://ssw.sswtimepro.com",
        "TIMEPRO_API_KEY": "your-api-key-here",
        "TIMEPRO_TENANT_ID": "ssw"
      }
    }
  }
}
```

The config file location:
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

## Configuration

The server requires three environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `TIMEPRO_API_URL` | TimePRO base URL | `https://ssw.sswtimepro.com` |
| `TIMEPRO_API_KEY` | Your personal access token | `abc123...` |
| `TIMEPRO_TENANT_ID` | Your tenant ID | `ssw` |

### How to Get Your API Key

1. **Log into TimePRO**: Go to your TimePRO instance and sign in
2. **Navigate to API Key page**: Go to **Admin > API Key**
3. **Generate or Copy Key**: If you already have a key, it will be displayed. Click "Generate" to create a new key if needed.
4. **Copy the key**: Store it securely

### How to Find Your Tenant ID

The tenant ID is visible in:
1. The URL when logged into TimePRO (e.g., `https://ssw.sswtimepro.com/b/ssw/...` - tenant is "ssw")
2. The `x-timepro-tenant-id` header in browser dev tools (Network tab)
3. Ask your TimePRO administrator

## Alternative: Local Installation

If you prefer to install locally:

```bash
git clone https://github.com/calumjs/TimePRO.MCP.git
cd TimePRO.MCP
npm install
npm run build
```

Then use this config:

```json
{
  "mcpServers": {
    "timepro": {
      "command": "node",
      "args": ["/path/to/TimePRO.MCP/dist/index.js"],
      "env": {
        "TIMEPRO_API_URL": "https://ssw.sswtimepro.com",
        "TIMEPRO_API_KEY": "your-api-key-here",
        "TIMEPRO_TENANT_ID": "ssw"
      }
    }
  }
}
```

## Usage Examples

Once configured, you can ask Claude to manage your timesheets naturally:

- "What clients do I have access to?"
- "Show me my timesheets for this week"
- "Create a timesheet for SSW internal work today from 9am to 5pm"
- "Log 2 hours of development work on the SugarLearning project"
- "Delete my timesheet from yesterday"

## Tools Reference

### list_clients
Search for clients by name.

**Parameters:**
- `search_text` (optional): Filter clients by name

### list_projects
Get projects for a client.

**Parameters:**
- `client_id` (required): Client ID (string, e.g., "SSW")

### list_categories
Get available timesheet categories. No parameters.

### list_locations
Get available work locations. No parameters.

### get_timesheet_defaults
Get default values for creating a timesheet.

**Parameters:**
- `date` (required): Date in YYYY-MM-DD format

### list_timesheets
List timesheets in a date range.

**Parameters:**
- `start_date` (required): Start date in YYYY-MM-DD format
- `end_date` (required): End date in YYYY-MM-DD format

### get_timesheet
Get details of a specific timesheet.

**Parameters:**
- `timesheet_id` (required): Timesheet ID (number)

### create_timesheet
Create a new timesheet entry.

**Parameters:**
- `client_id` (required): Client ID (string)
- `project_id` (required): Project ID (string)
- `category_id` (required): Category ID (string)
- `date` (required): Date in YYYY-MM-DD format
- `start_time` (required): Start time in HH:MM format
- `end_time` (required): End time in HH:MM format
- `break_minutes` (optional): Break time in minutes (default: 0)
- `location_id` (optional): Work location ID
- `billable_id` (optional): Billable category ID
- `note` (optional): Description of work

### update_timesheet
Update an existing timesheet.

**Parameters:**
- `timesheet_id` (required): Timesheet ID (number)
- All other parameters from create_timesheet (optional)

### delete_timesheet
Delete a timesheet.

**Parameters:**
- `timesheet_id` (required): Timesheet ID (number)

## Troubleshooting

### "Missing required environment variables"
Ensure all three environment variables are set in your Claude Desktop config.

### "TimePRO API error (401)"
Your API key may be invalid or expired. Generate a new one from TimePRO Admin > API Key.

### "TimePRO API error (403)"
Your user account may not have permission for the requested operation.

### Connection issues
Verify the `TIMEPRO_API_URL` is correct and accessible from your network.

## License

MIT
