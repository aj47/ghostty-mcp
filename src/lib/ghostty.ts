import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

export type SessionId = string;

export interface SessionInfo {
  id: SessionId;
  title: string;
  createdAt: string; // ISO string
  note?: string;
}

export interface CreateSessionOptions {
  title?: string | undefined;
  cwd?: string | undefined;
  command?: string | undefined;
}

export interface ReadSessionOutputOptions {
  startLine?: number | undefined;
  maxLines?: number | undefined;
}

export interface ReadSessionOutputResult {
  totalLines: number;
  startLine: number;
  lines: string[];
}

/**
 * GhosttyManager currently tracks only sessions created by this MCP server
 * and uses macOS-specific mechanisms (Shortcuts / `open` / accessibility)
 * under the hood.
 */
export class GhosttyManager {
  private sessions: Map<SessionId, SessionInfo> = new Map();

  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  async createSession(options: CreateSessionOptions): Promise<SessionInfo> {
    const id = randomUUID();
    const title = options.title ?? `ghostty-mcp-${id.slice(0, 8)}`;

    // TODO: Implement real Ghostty integration.
    // For now, we just spawn a new Ghostty window via `open`.
    await this.spawnGhosttyWindow({ title, cwd: options.cwd, command: options.command });

    const session: SessionInfo = {
      id,
      title,
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(id, session);
    return session;
  }

  async sendKeys(sessionId: SessionId, text: string, opts?: { raw?: boolean | undefined }): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown sessionId: ${sessionId}`);
    }

    const toSend = opts?.raw ? text : `${text}\n`;

    // TODO: Route to the specific Ghostty window for this session.
    // For now, send to the active Ghostty window using a Shortcut or AppleScript.
    await this.sendKeysToActiveGhosttyWindow(toSend);
  }

  async readSessionOutput(
    sessionId: SessionId,
    options: ReadSessionOutputOptions,
  ): Promise<ReadSessionOutputResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown sessionId: ${sessionId}`);
    }

    const fullText = await this.readActiveGhosttyWindowText();
    const lines = fullText.split(/\r?\n/);

    const totalLines = lines.length;
    const maxLines = options.maxLines ?? 200;
    const requestedStart = options.startLine ?? Math.max(1, totalLines - maxLines + 1);

    const startIndex = Math.max(0, Math.min(totalLines, requestedStart) - 1);
    const endIndex = Math.min(totalLines, startIndex + maxLines);

    const slice = lines.slice(startIndex, endIndex);

    return {
      totalLines,
      startLine: startIndex + 1,
      lines: slice,
    };
  }

  private async spawnGhosttyWindow(opts: { title: string; cwd?: string | undefined; command?: string | undefined }): Promise<void> {
    // Simple implementation using `open` and Ghostty CLI args.
    // You can replace this with macOS Shortcuts integration if desired.
    const args: string[] = ["-na", "Ghostty.app", "--args"];

    if (opts.title) {
      args.push("--title", opts.title);
    }
    if (opts.cwd) {
      args.push("--working-directory", opts.cwd);
    }
    if (opts.command) {
      args.push("-e", opts.command);
    }

    await this.runCommand("open", args);
  }

  private async sendKeysToActiveGhosttyWindow(text: string): Promise<void> {
    // Placeholder: use `osascript` to send keystrokes to the active Ghostty window.
    const script = `tell application "System Events" to keystroke ${JSON.stringify(text)}`;
    await this.runCommand("osascript", ["-e", script]);
  }

  private async readActiveGhosttyWindowText(): Promise<string> {
    // Placeholder: use AppleScript accessibility to read the frontmost Ghostty window.
    const script = [
      "tell application \"System Events\"",
      "  tell application process \"Ghostty\"",
      "    if (count of windows) is 0 then return \"\"",
      "    tell window 1",
      "      set terminalText to value of attribute \"AXValue\" of text area 1",
      "    end tell",
      "  end tell",
      "end tell",
      "return terminalText",
    ].join("\n");

    const output = await this.runCommand("osascript", ["-e", script]);
    return output;
  }

  private runCommand(cmd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      child.on("error", (err: Error) => {
        reject(err);
      });

      child.on("close", (code: number | null) => {
        if (code === 0) {
          resolve(stdout.trimEnd());
        } else {
          reject(new Error(`${cmd} exited with code ${code}: ${stderr}`));
        }
      });
    });
  }
}

