# macos-desktop-control

[中文文档](./README.zh-CN.md)

MCP Server for **native macOS desktop automation** — screenshot, mouse, keyboard, window management, and more.

No Docker, no virtual display. Controls your **actual desktop**.

Works with any MCP-compatible client: Claude Code, Claude Desktop, OpenAI Codex CLI, Gemini CLI, Cursor, VS Code Copilot, and more.

## Features

| Category | Capabilities |
|---|---|
| **Screen** | Full screen / region screenshot, display info |
| **Mouse** | Click (left/right/double/triple), move, drag, scroll |
| **Keyboard** | Type text (3 modes), key combos with modifiers |
| **Window** | List all windows, focus by app/title, open apps |
| **System** | Run macOS Shortcuts workflows |

**Key highlights:**

- `app` parameter on click/type/keypress — **auto-refocuses** the target app before acting (solves focus-stealing when approving tool calls)
- `type_text` with `mode: "direct"` — writes content via AppleScript, **completely bypasses input method (IME)**
- `key_press` supports **any key + modifier combo** via AppleScript key codes (not limited to cliclick's named keys)

## Prerequisites

- macOS (tested on Sequoia 15.x)
- Node.js 18+
- [cliclick](https://github.com/BlueM/cliclick):
  ```bash
  brew install cliclick
  ```
- **Accessibility permission** — grant your terminal app in:
  **System Settings → Privacy & Security → Accessibility**

## Install

```bash
git clone https://github.com/d-wwei/macos-desktop-control.git
cd macos-desktop-control
npm install
```

## Client Configuration

This server uses **stdio transport**, the most universally supported MCP transport. Configuration is nearly identical across all clients.

### Claude Code

```bash
# Project scope
claude mcp add macos-desktop-control -- node /path/to/macos-desktop-control/src/index.js

# Global scope (available in all projects)
claude mcp add macos-desktop-control -s user -- node /path/to/macos-desktop-control/src/index.js
```

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "macos-desktop-control": {
      "command": "node",
      "args": ["/path/to/macos-desktop-control/src/index.js"]
    }
  }
}
```

### OpenAI Codex CLI

`.codex/mcp.json` or pass via `codex --mcp-config mcp.json`:

```json
{
  "mcpServers": {
    "macos-desktop-control": {
      "command": "node",
      "args": ["/path/to/macos-desktop-control/src/index.js"]
    }
  }
}
```

### Gemini CLI

`~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "macos-desktop-control": {
      "command": "node",
      "args": ["/path/to/macos-desktop-control/src/index.js"]
    }
  }
}
```

### Cursor

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "macos-desktop-control": {
      "command": "node",
      "args": ["/path/to/macos-desktop-control/src/index.js"]
    }
  }
}
```

### VS Code (GitHub Copilot)

`.vscode/mcp.json`:

```json
{
  "servers": {
    "macos-desktop-control": {
      "command": "node",
      "args": ["/path/to/macos-desktop-control/src/index.js"]
    }
  }
}
```

## Tools Reference

| Tool | Description | Key Params |
|---|---|---|
| `screenshot` | Capture full screen or region | `region`, `display` |
| `click` | Click at coordinates | `x`, `y`, `button`, `clicks`, `modifiers`, `app` |
| `move_mouse` | Move cursor | `x`, `y` |
| `drag` | Drag between positions | `fromX`, `fromY`, `toX`, `toY` |
| `type_text` | Type text (3 modes) | `text`, `app`, `mode`, `switchToEnglish` |
| `key_press` | Press key combo | `key`, `modifiers`, `app` |
| `scroll` | Scroll in any direction | `direction`, `amount`, `x`, `y` |
| `get_mouse_position` | Get cursor position | — |
| `get_screen_size` | Get display dimensions | — |
| `open_app` | Open/activate app | `app` |
| `list_windows` | List visible windows | — |
| `focus_window` | Focus specific window | `app`, `title` |
| `run_shortcut` | Run macOS Shortcut | `name`, `input` |

## Usage Tips

### Focus Stealing Prevention

When your AI client asks for permission approval in the terminal, focus shifts away from the target app. Use the `app` parameter to auto-refocus:

```json
{ "text": "hello", "app": "TextEdit" }
```

### Input Method (IME) Handling

If you use a CJK input method, `keystroke` mode may trigger IME candidates. Two solutions:

| Solution | How |
|---|---|
| **Direct mode** | `mode: "direct"` — bypasses IME entirely (TextEdit, Notes, etc.) |
| **Switch language** | `switchToEnglish: true` — presses Caps Lock before typing |

### type_text Modes

| Mode | Mechanism | IME Safe | Works With |
|---|---|---|---|
| `keystroke` (default) | System Events `keystroke` | No | Any app |
| `cliclick` | cliclick `t:` command | No | Any app |
| `direct` | AppleScript `set text` | **Yes** | TextEdit, Notes, etc. |

## Architecture

```
screencapture (macOS built-in)  →  screenshot, get_screen_size
cliclick (brew)                 →  click, move_mouse, drag, scroll, get_mouse_position
osascript / System Events       →  type_text, key_press, open_app, list_windows, focus_window
shortcuts CLI (macOS built-in)  →  run_shortcut
MCP SDK (stdio transport)       →  protocol layer
```

## Compared to Alternatives

| Solution | Platform | Scope | Docker Required | Controls Real Desktop |
|---|---|---|---|---|
| **This project** | **macOS** | **Full desktop** | **No** | **Yes** |
| Anthropic Computer Use | Linux | Full desktop | Yes | No (virtual) |
| MCPControl | Windows | Full desktop | No | Yes |
| Playwright MCP | Cross-platform | Browser only | No | Partial |

## License

MIT
