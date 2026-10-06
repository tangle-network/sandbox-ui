/** An MCP server attached to a sandbox backend, as the backend status API reports it. */
export interface McpServer {
  name: string
  command: string
  args?: string[]
  status?: "running" | "stopped" | "error"
}
