# Ghostty MCP Server

A Model Context Protocol (MCP) server that enables AI assistants to interact with [Ghostty](https://ghostty.org/) terminal emulator. This allows AI models to create sessions, send commands, and read terminal output programmatically.

## Features

- **List Sessions**: View all active Ghostty tabs and windows
- **Create Sessions**: Open new tabs or windows, optionally with a command
- **Send Keys**: Send text and commands to specific sessions
- **Read Output**: Read terminal output with chunking support for large outputs

## Platform Support

Currently supports **macOS only** using AppleScript to control Ghostty.

> **Note**: Linux support could be added in the future using D-Bus when Ghostty implements a D-Bus interface. See [Ghostty Discussion #2353](https://github.com/ghostty-org/ghostty/discussions/2353) for API development progress.

## Installation

### Prerequisites

- Node.js >= 18
- Ghostty terminal emulator installed on macOS
- macOS with AppleScript support

### Install via npm

```bash
npm install -g ghostty-mcp
```

### Build from source

```bash
git clone <repository-url>
cd ghostty-mcp
npm install
npm run build
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ghostty": {
      "command": "npx",
      "args": ["-y", "ghostty-mcp"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "ghostty": {
      "command": "ghostty-mcp"
    }
  }
}
```

## Available Tools

### 1. list_sessions

Lists all active Ghostty sessions (tabs and windows).

**Parameters**: None

**Returns**:
```json
[
  {
    "id": "window-1-tab-1",
    "name": "Terminal",
    "index": 1
  }
]
```

### 2. create_session

Creates a new Ghostty session.

**Parameters**:
- `type` (optional): `"tab"` or `"window"` (default: `"tab"`)
- `command` (optional): Command to execute in the new session

**Example**:
```json
{
  "type": "tab",
  "command": "cd ~/projects && ls -la"
}
```

**Returns**:
```json
{
  "success": true,
  "session": {
    "id": "window-1-tab-2",
    "name": "New Tab",
    "index": 2
  },
  "message": "Created new tab: New Tab"
}
```

### 3. send_keys

Sends text or commands to a specific session.

**Parameters**:
- `text` (required): Text to send to the session
- `session_id` (optional): Target session ID (uses active session if not provided)
- `press_enter` (optional): Whether to press Enter after sending text (default: `false`)

**Example**:
```json
{
  "session_id": "window-1-tab-1",
  "text": "echo 'Hello, World!'",
  "press_enter": true
}
```

**Returns**:
```json
{
  "success": true,
  "message": "Sent text to session window-1-tab-1"
}
```

### 4. read_from_session

Reads output from a Ghostty session with chunking support.

**Parameters**:
- `session_id` (optional): Target session ID (uses active session if not provided)
- `lines` (optional): Number of lines to read (default: `100`)
- `offset` (optional): Number of lines to skip from the end for pagination (default: `0`)

**Example**:
```json
{
  "session_id": "window-1-tab-1",
  "lines": 50,
  "offset": 0
}
```

**Returns**:
```json
{
  "session_id": "window-1-tab-1",
  "lines": ["line1", "line2", "..."],
  "total_lines": 150,
  "lines_returned": 50,
  "offset": 0
}
```

## Development

### Build

```bash
npm run build
```

### Watch mode

```bash
npm run watch
```

### Debugging

Use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) for debugging:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Limitations

1. **macOS Only**: Currently only supports macOS via AppleScript
2. **Ghostty AppleScript Support**: Requires Ghostty to support AppleScript commands
3. **Session IDs**: Session IDs are based on window/tab indices and may change if tabs are closed/reordered

## Future Enhancements

- [ ] Linux support via D-Bus (when Ghostty implements it)
- [ ] Windows support (when Ghostty provides a control API)
- [ ] Persistent session IDs
- [ ] Support for split panes
- [ ] Terminal output streaming
- [ ] Better error handling for edge cases

## References

- [Ghostty Documentation](https://ghostty.org/docs)
- [Ghostty Scripting API Discussion](https://github.com/ghostty-org/ghostty/discussions/2353)
- [MCP Discussion for Ghostty](https://github.com/ghostty-org/ghostty/discussions/6683)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.
