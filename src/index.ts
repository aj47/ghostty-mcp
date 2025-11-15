import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { GhosttyManager } from "./lib/ghostty.js";

async function main() {
  const server = new McpServer({
    name: "ghostty-mcp",
    version: "0.1.0",
  });

  const ghostty = new GhosttyManager();

  // list_sessions
  server.registerTool(
    "list_sessions",
    {
      title: "List Ghostty sessions",
      description: "List Ghostty sessions managed by this MCP server.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        sessions: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            createdAt: z.string(),
            note: z.string().optional(),
          }),
        ),
      }),
    },
    async () => {
      const sessions = ghostty.listSessions();
      const output = { sessions };
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(output, null, 2),
          },
        ],
        structuredContent: output,
      };
    },
  );

  // create_session
  server.registerTool(
    "create_session",
    {
      title: "Create Ghostty session",
      description: "Create a new Ghostty session (window/tab).",
      inputSchema: z.object({
        title: z.string().optional(),
        cwd: z.string().optional(),
        command: z.string().optional(),
      }),
      outputSchema: z.object({
        session: z.object({
          id: z.string(),
          title: z.string(),
          createdAt: z.string(),
          note: z.string().optional(),
        }),
      }),
    },
    async ({ title, cwd, command }) => {
      const session = await ghostty.createSession({ title, cwd, command });
      const output = { session };
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(output, null, 2),
          },
        ],
        structuredContent: output,
      };
    },
  );

  // send_keys
  server.registerTool(
    "send_keys",
    {
      title: "Send keys to Ghostty session",
      description: "Send text/keys to a Ghostty session.",
      inputSchema: z.object({
        sessionId: z.string(),
        text: z.string(),
        raw: z.boolean().optional().describe("If false (default), append a newline to the text."),
      }),
      outputSchema: z.object({ ok: z.boolean() }),
    },
    async ({ sessionId, text, raw }) => {
      await ghostty.sendKeys(sessionId, text, { raw });
      const output = { ok: true };
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(output),
          },
        ],
        structuredContent: output,
      };
    },
  );

  // read_session_output
  server.registerTool(
    "read_session_output",
    {
      title: "Read output from Ghostty session",
      description:
        "Read a slice of output from a Ghostty session using macOS accessibility.",
      inputSchema: z.object({
        sessionId: z.string(),
        startLine: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("1-based line to start reading from."),
        maxLines: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum number of lines to return."),
      }),
      outputSchema: z.object({
        sessionId: z.string(),
        totalLines: z.number().int().nonnegative(),
        startLine: z.number().int().positive(),
        lines: z.array(z.string()),
      }),
    },
    async ({ sessionId, startLine, maxLines }) => {
      const result = await ghostty.readSessionOutput(sessionId, {
        startLine,
        maxLines,
      });
      const output = { sessionId, ...result };
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(output, null, 2),
          },
        ],
        structuredContent: output,
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("ghostty-mcp server failed:", err);
  process.exit(1);
});

