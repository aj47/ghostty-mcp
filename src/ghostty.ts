import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GhosttySession {
  id: string;
  name: string;
  index: number;
}

export interface SessionOutput {
  lines: string[];
  totalLines: number;
}

/**
 * Ghostty interaction layer
 * Uses AppleScript on macOS to control Ghostty terminal
 */
export class GhosttyController {
  /**
   * Check if running on macOS
   */
  private isMacOS(): boolean {
    return process.platform === 'darwin';
  }

  /**
   * Execute AppleScript command
   */
  private async runAppleScript(script: string): Promise<string> {
    if (!this.isMacOS()) {
      throw new Error('AppleScript is only supported on macOS');
    }

    try {
      const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "\\'")}'`);
      return stdout.trim();
    } catch (error: any) {
      throw new Error(`AppleScript execution failed: ${error.message}`);
    }
  }

  /**
   * List all Ghostty sessions (tabs/windows)
   */
  async listSessions(): Promise<GhosttySession[]> {
    const script = `
      tell application "Ghostty"
        set sessionList to {}
        set windowCount to count of windows

        repeat with w from 1 to windowCount
          set tabCount to count of tabs of window w
          repeat with t from 1 to tabCount
            set tabName to name of tab t of window w
            set sessionId to "window-" & w & "-tab-" & t
            set end of sessionList to {sessionId:sessionId, tabName:tabName, tabIndex:t, windowIndex:w}
          end repeat
        end repeat

        set output to ""
        repeat with s in sessionList
          set output to output & sessionId of s & "|" & tabName of s & "|" & tabIndex of s & linefeed
        end repeat

        return output
      end tell
    `;

    try {
      const result = await this.runAppleScript(script);

      if (!result) {
        return [];
      }

      const sessions: GhosttySession[] = [];
      const lines = result.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const [id, name, indexStr] = line.split('|');
        if (id && name !== undefined && indexStr) {
          sessions.push({
            id: id.trim(),
            name: name.trim(),
            index: parseInt(indexStr.trim(), 10)
          });
        }
      }

      return sessions;
    } catch (error: any) {
      // If Ghostty is not running or doesn't support AppleScript, return empty array
      console.error('Error listing sessions:', error.message);
      return [];
    }
  }

  /**
   * Create a new session (tab or window)
   */
  async createSession(type: 'tab' | 'window' = 'tab', command?: string): Promise<GhosttySession> {
    let script: string;

    if (type === 'window') {
      script = `
        tell application "Ghostty"
          set newWindow to make new window
          ${command ? `do script "${command.replace(/"/g, '\\"')}" in newWindow` : ''}
          set windowIndex to index of newWindow
          return "window-" & windowIndex & "-tab-1|New Window|1"
        end tell
      `;
    } else {
      script = `
        tell application "Ghostty"
          tell front window
            set newTab to make new tab
            ${command ? `do script "${command.replace(/"/g, '\\"')}" in newTab` : ''}
            set tabIndex to index of newTab
            set windowIndex to index of front window
            return "window-" & windowIndex & "-tab-" & tabIndex & "|New Tab|" & tabIndex
          end tell
        end tell
      `;
    }

    const result = await this.runAppleScript(script);
    const [id, name, indexStr] = result.split('|');

    return {
      id: id.trim(),
      name: name.trim(),
      index: parseInt(indexStr.trim(), 10)
    };
  }

  /**
   * Send keys/text to a specific session
   */
  async sendKeys(sessionId: string, text: string, pressEnter: boolean = false): Promise<void> {
    const [, windowIdx, , tabIdx] = sessionId.split('-');

    const script = `
      tell application "Ghostty"
        tell window ${windowIdx}
          tell tab ${tabIdx}
            do script "${text.replace(/"/g, '\\"')}${pressEnter ? '\\n' : ''}" in it
          end tell
        end tell
      end tell
    `;

    await this.runAppleScript(script);
  }

  /**
   * Read output from a session with chunking support
   */
  async readFromSession(
    sessionId: string,
    lines: number = 100,
    offset: number = 0
  ): Promise<SessionOutput> {
    const [, windowIdx, , tabIdx] = sessionId.split('-');

    const script = `
      tell application "Ghostty"
        tell window ${windowIdx}
          tell tab ${tabIdx}
            set textContent to text of it
            return textContent
          end tell
        end tell
      end tell
    `;

    try {
      const result = await this.runAppleScript(script);
      const allLines = result.split('\n');
      const totalLines = allLines.length;

      // Apply offset and limit
      const startIdx = Math.max(0, totalLines - offset - lines);
      const endIdx = Math.max(0, totalLines - offset);
      const selectedLines = allLines.slice(startIdx, endIdx);

      return {
        lines: selectedLines,
        totalLines
      };
    } catch (error: any) {
      throw new Error(`Failed to read from session: ${error.message}`);
    }
  }

  /**
   * Get the current active session
   */
  async getActiveSession(): Promise<GhosttySession | null> {
    const script = `
      tell application "Ghostty"
        if (count of windows) > 0 then
          tell front window
            set windowIdx to index of it
            if (count of tabs) > 0 then
              set currentTab to current tab
              set tabIdx to index of currentTab
              set tabName to name of currentTab
              return "window-" & windowIdx & "-tab-" & tabIdx & "|" & tabName & "|" & tabIdx
            end if
          end tell
        end if
        return ""
      end tell
    `;

    try {
      const result = await this.runAppleScript(script);

      if (!result) {
        return null;
      }

      const [id, name, indexStr] = result.split('|');

      return {
        id: id.trim(),
        name: name.trim(),
        index: parseInt(indexStr.trim(), 10)
      };
    } catch (error) {
      return null;
    }
  }
}
