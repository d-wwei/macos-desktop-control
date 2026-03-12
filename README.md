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

### Overview

| Solution | Platform | Scope | Docker Required | Controls Real Desktop |
|---|---|---|---|---|
| **This project** | **macOS** | **Full desktop** | **No** | **Yes** |
| Anthropic Computer Use | Linux | Full desktop | Yes | No (virtual) |
| MCPControl | Windows | Full desktop | No | Yes |
| Playwright MCP | Cross-platform | Browser only | No | Partial |

### vs. Cross-Platform Python MCP Servers

There are cross-platform desktop control MCP servers built on PyAutoGUI, such as [computer-control-mcp](https://github.com/AB498/computer-control-mcp) and [mcp-desktop-controller](https://github.com/KumaVolt/mcp-desktop-controller). Here's how we compare:

| Aspect | **This project** | **computer-control-mcp** | **mcp-desktop-controller** |
|---|---|---|---|
| Language | Node.js | Python | Python |
| Backend | cliclick + osascript + screencapture | PyAutoGUI + RapidOCR + ONNX | PyAutoGUI + FastMCP |
| Platform | macOS only | Cross-platform | Cross-platform |
| OCR | No | **Yes** (RapidOCR) | No |
| IME bypass | **Yes** (`direct` mode) | No | No |
| Focus management | **Yes** (`app` param auto-refocus) | No | No |
| macOS Shortcuts | **Yes** (`run_shortcut`) | No | No |
| AppleScript integration | **Yes** (key codes, window control) | No | No |
| Install | npm + `brew install cliclick` | pip (heavy deps: ONNX runtime) | pip |

### Why we built a separate macOS-native solution

**1. Focus-stealing prevention** — When AI clients (Claude Code, Codex CLI, etc.) ask for permission approval in the terminal, focus shifts away from the target app. Subsequent mouse clicks and keystrokes land in the wrong window. Our `app` parameter calls `ensureAppFocus()` before every action. PyAutoGUI-based solutions don't address this at all.

**2. Input method (IME) handling** — `direct` mode writes text via AppleScript `set text`, completely bypassing the input method. For CJK IME users, PyAutoGUI's `typewrite` only supports ASCII, and `keystroke` mode triggers IME candidate popups on spaces and punctuation.

**3. Deeper macOS integration** — AppleScript `key code` supports all macOS key codes + modifier combos without being limited to PyAutoGUI's key name mapping. `run_shortcut` can invoke any macOS Shortcuts workflow for system-level automation. Window management uses `AXRaise` via System Events, which is more reliable than PyAutoGUI's window operations on macOS.

**4. Lightweight** — Only depends on cliclick (a single brew package) plus built-in macOS tools (osascript, screencapture). No Python runtime, no ONNX, no heavy dependency chain.

### When to choose a cross-platform solution instead

- You need to control Windows, Linux, and macOS with a single tool
- You need OCR to locate on-screen elements by text (computer-control-mcp has this)
- You don't use a CJK input method and focus-stealing isn't an issue for your workflow

**TL;DR:** Less portable than cross-platform alternatives, but significantly better experience on macOS — especially with CJK input methods and approval-based AI clients.

## License

MIT
