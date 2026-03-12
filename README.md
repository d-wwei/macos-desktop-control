# macos-desktop-control

MCP Server for macOS desktop automation — screenshot, mouse, keyboard, window management, and more.

Built for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and any MCP-compatible client.

## Features

- **Screenshot** — Full screen or region capture, returns base64 image
- **Click** — Left/right/double/triple click with modifier keys, auto-focus target app
- **Type Text** — Three modes: `keystroke` (System Events), `cliclick`, or `direct` (bypasses input method)
- **Key Press** — Any key + modifier combo via AppleScript key codes
- **Mouse Move / Drag** — Precision cursor control
- **Scroll** — Directional scrolling at any position
- **Window Management** — List windows, focus by app/title, open apps
- **Run Shortcuts** — Execute macOS Shortcuts app workflows

## Prerequisites

- macOS
- Node.js 18+
- [cliclick](https://github.com/BlueM/cliclick) — `brew install cliclick`
- **Accessibility permission** — Grant your terminal app access in:
  System Settings → Privacy & Security → Accessibility

## Install

```bash
git clone https://github.com/d-wwei/macos-desktop-control.git
cd macos-desktop-control
npm install
```

## Register with Claude Code

```bash
claude mcp add macos-desktop-control -- node /path/to/macos-desktop-control/src/index.js
```

Or add to global scope:

```bash
claude mcp add macos-desktop-control -s user -- node /path/to/macos-desktop-control/src/index.js
```

## Tools

| Tool | Description |
|---|---|
| `screenshot` | Capture full screen or a region |
| `click` | Click at coordinates with optional app focus and modifiers |
| `move_mouse` | Move cursor to coordinates |
| `drag` | Drag from one position to another |
| `type_text` | Type text (keystroke / cliclick / direct mode) |
| `key_press` | Press key combos (e.g. Cmd+C, Ctrl+Alt+Delete) |
| `scroll` | Scroll in any direction |
| `get_mouse_position` | Get current cursor position |
| `get_screen_size` | Get display dimensions |
| `open_app` | Open/activate an app |
| `list_windows` | List all visible windows |
| `focus_window` | Focus a window by app name and title |
| `run_shortcut` | Run a macOS Shortcuts workflow |

## Usage Tips

### Focus Stealing Prevention

When Claude Code asks for permission approval, your terminal gets focus. Use the `app` parameter on `click`, `type_text`, and `key_press` to re-focus the target app before the action:

```json
{ "tool": "type_text", "args": { "text": "hello", "app": "TextEdit" } }
```

### Input Method (IME) Handling

If you use a Chinese/Japanese input method, text input via `keystroke` may trigger IME candidates. Solutions:

- **`mode: "direct"`** — Bypasses IME completely (works with TextEdit, Notes, etc.)
- **`switchToEnglish: true`** — Presses Caps Lock to toggle to English before typing

### Direct Text Mode

For apps that support AppleScript `set text` (TextEdit, Notes), use direct mode to write content without IME interference:

```json
{ "tool": "type_text", "args": { "text": "hello world", "app": "TextEdit", "mode": "direct" } }
```

## Architecture

```
screencapture (macOS built-in)  →  screenshot tool
cliclick (brew)                 →  click, move, drag, scroll tools
osascript / System Events       →  type, key press, window, app tools
shortcuts CLI (macOS built-in)  →  run_shortcut tool
```

All tools run natively on macOS — no Docker, no virtual display, no sandboxing. This controls your actual desktop.

## License

MIT
