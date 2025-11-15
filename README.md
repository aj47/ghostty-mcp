# ghostty-mcp

An experimental [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that lets MCP clients interact with Ghostty terminals on macOS.

> **Status:** early prototype. It currently manages sessions it creates itself and targets the *frontmost* Ghostty window for send/read operations.

## Features

Tools exposed to MCP clients:

- `list_sessions` – list Ghostty sessions created by this MCP server.
- `create_session` – create a new Ghostty window/tab.
- `send_keys` – send text/keys into a session.
- `read_session_output` – read a slice of output from a session (chunked by lines).

Implementation notes:

- **Platform:** macOS only (uses `open` and `osascript`).
- **Sessions:** tracked in-memory by the server. There is no discovery of arbitrary pre-existing Ghostty windows yet.
- **Target window:** `send_keys` and `read_session_output` currently operate on the *frontmost* Ghostty window via macOS accessibility.

## Installation

```bash
npm install
npm run build
```

## Running the MCP server

After building, the CLI entrypoint is `ghostty-mcp`:

```bash
npx ghostty-mcp
```

The server speaks MCP over stdio, so you normally do **not** run it directly. Instead, configure your MCP-aware client to spawn it.

### Example: Claude Desktop (local dev)

Configure a custom MCP server with something like:

- **Command:** `npx`
- **Args:** `[-y, ghostty-mcp]`

Then enable the server in Claude, and the `list_sessions`, `create_session`, `send_keys`, and `read_session_output` tools should appear.

## Tool semantics

### `list_sessions`

- **Input:** none
- **Output:**
  - `sessions: { id, title, createdAt, note? }[]`

Only sessions created by this `ghostty-mcp` process are returned.

### `create_session`

- **Input:**
  - `title?: string` – optional window title; defaults to a generated name.
  - `cwd?: string` – optional working directory.
  - `command?: string` – optional command to execute instead of the default shell.
- **Behavior:**
  - Spawns a new Ghostty window using `open -na Ghostty.app --args ...`.
  - Tracks the session in memory and returns its metadata.

### `send_keys`

- **Input:**
  - `sessionId: string`
  - `text: string`
  - `raw?: boolean` – if omitted/false, a trailing `\n` is appended.
- **Behavior:**
  - Uses `osascript` to send keystrokes to the *active* Ghostty window.
  - Today, it does **not** guarantee targeting a specific window beyond what macOS focus provides.

### `read_session_output`

- **Input:**
  - `sessionId: string`
  - `startLine?: number` – 1-based line index.
  - `maxLines?: number` – maximum lines to return (default ~200).
- **Behavior:**
  - Uses macOS accessibility (`System Events` → `Ghostty` process) to read text from the frontmost Ghostty window.
  - Splits into lines and returns a slice.
- **Output:**
  - `sessionId: string`
  - `totalLines: number`
  - `startLine: number`
  - `lines: string[]`

## Limitations / TODOs

- Properly bind each `sessionId` to a specific Ghostty window/tab rather than assuming frontmost.
- Add optional integration with Ghostty Shortcuts actions instead of raw `open`/`osascript`.
- Improve error reporting when Ghostty is not running or accessibility permissions are missing.
- Add automated tests (currently only TypeScript build is checked).

