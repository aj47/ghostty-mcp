#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { GhosttyController } from './ghostty.js';

/**
 * Ghostty MCP Server
 * Provides tools for interacting with Ghostty terminal emulator
 */
class GhosttyMCPServer {
  private server: Server;
  private ghostty: GhosttyController;

  constructor() {
    this.ghostty = new GhosttyController();
    this.server = new Server(
      {
        name: 'ghostty-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
        {
          name: 'list_sessions',
          description: 'List all active Ghostty sessions (tabs and windows)',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'create_session',
          description: 'Create a new Ghostty session (tab or window)',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['tab', 'window'],
                description: 'Type of session to create (tab or window)',
                default: 'tab',
              },
              command: {
                type: 'string',
                description: 'Optional command to execute in the new session',
              },
            },
          },
        },
        {
          name: 'send_keys',
          description: 'Send text/keys to a specific Ghostty session',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: {
                type: 'string',
                description: 'ID of the target session (from list_sessions)',
              },
              text: {
                type: 'string',
                description: 'Text to send to the session',
              },
              press_enter: {
                type: 'boolean',
                description: 'Whether to press Enter after sending the text',
                default: false,
              },
            },
            required: ['text'],
          },
        },
        {
          name: 'read_from_session',
          description: 'Read output from a Ghostty session with chunking support',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: {
                type: 'string',
                description: 'ID of the target session (from list_sessions). If not provided, reads from active session.',
              },
              lines: {
                type: 'number',
                description: 'Number of lines to read (default: 100)',
                default: 100,
              },
              offset: {
                type: 'number',
                description: 'Number of lines to skip from the end (for pagination, default: 0)',
                default: 0,
              },
            },
          },
        },
      ];

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'list_sessions': {
            const sessions = await this.ghostty.listSessions();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(sessions, null, 2),
                },
              ],
            };
          }

          case 'create_session': {
            const type = (args?.type as 'tab' | 'window') || 'tab';
            const command = args?.command as string | undefined;
            const session = await this.ghostty.createSession(type, command);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: true,
                      session,
                      message: `Created new ${type}: ${session.name}`,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case 'send_keys': {
            // Get session_id or use active session
            let sessionId = args?.session_id as string | undefined;

            if (!sessionId) {
              const activeSession = await this.ghostty.getActiveSession();
              if (!activeSession) {
                throw new Error('No active session found. Please specify session_id.');
              }
              sessionId = activeSession.id;
            }

            const text = args?.text as string;
            const pressEnter = (args?.press_enter as boolean) || false;

            if (!text) {
              throw new Error('text parameter is required');
            }

            await this.ghostty.sendKeys(sessionId, text, pressEnter);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `Sent text to session ${sessionId}`,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case 'read_from_session': {
            // Get session_id or use active session
            let sessionId = args?.session_id as string | undefined;

            if (!sessionId) {
              const activeSession = await this.ghostty.getActiveSession();
              if (!activeSession) {
                throw new Error('No active session found. Please specify session_id.');
              }
              sessionId = activeSession.id;
            }

            const lines = (args?.lines as number) || 100;
            const offset = (args?.offset as number) || 0;

            const output = await this.ghostty.readFromSession(sessionId, lines, offset);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      session_id: sessionId,
                      lines: output.lines,
                      total_lines: output.totalLines,
                      lines_returned: output.lines.length,
                      offset,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: error.message,
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
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Ghostty MCP server running on stdio');
  }
}

// Start the server
const server = new GhosttyMCPServer();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
