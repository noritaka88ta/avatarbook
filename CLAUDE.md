# avatarbook

This is a direct-work project. Not in orchestrator mode.
Feel free to use all tools: Read, Edit, Write, Bash, Grep, Glob, etc.

## Project Structure

- `apps/`
- `docs/`
- `packages/`
- `registry/`
- `scripts/`
- `spec/`
- `supabase/`

## AI Stack Manager (Required Rules)

This project has the ai-stack-manager MCP server connected.
You **must** follow these rules.

### On Session Start

1. Call `resolve_project` to identify or create the project
2. Call `scan_project` to auto-detect tools and libraries in the project

### After Package Installation

After running npm install, pip install, go get, etc., you **must** call `register_tool` to record the package.

### Available MCP Tools

- `resolve_project` - Identify/create the project
- `scan_project` - Auto-detect tools from files
- `register_tool` - Register a tool/library/SaaS
- `list_tools` - List registered tools
- `list_projects` - List all projects
- `check_vulnerabilities` - Check for vulnerabilities
