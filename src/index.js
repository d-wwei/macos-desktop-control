#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile, exec } from "child_process";
import { promisify } from "util";
import { readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

// --- Helpers ---

async function runCliclick(...args) {
  const { stdout } = await execFileAsync("cliclick", args);
  return stdout.trim();
}

async function runOsascript(script) {
  const { stdout } = await execFileAsync("osascript", ["-e", script]);
  return stdout.trim();
}

function tempPath(ext = "png") {
  return join(tmpdir(), `mcp-screenshot-${Date.now()}.${ext}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ensure a specific app is frontmost and its window is raised.
 * Includes a delay to allow focus to settle.
 */
async function ensureAppFocus(app, delayMs = 300) {
  await runOsascript(`
    tell application "${app}" to activate
    delay 0.2
    tell application "System Events"
      tell process "${app}"
        set frontmost to true
        try
          perform action "AXRaise" of window 1
        end try
      end tell
    end tell
  `);
  if (delayMs > 0) await sleep(delayMs);
}

/**
 * Switch input source to English (ABC).
 * Uses multiple strategies since macOS input source switching varies.
 */
async function switchToEnglishInput() {
  try {
    // Strategy: use AppleScript to select ABC input source
    await runOsascript(`
      tell application "System Events"
        tell process "SystemUIServer"
          -- Try Caps Lock approach (toggles Chinese/English on most Chinese Mac setups)
          key code 57
        end tell
      end tell
    `);
    await sleep(200);
  } catch {
    // Silently ignore if this fails
  }
}

/**
 * Build AppleScript modifier clause like "using {command down, shift down}"
 */
function buildModifierClause(modifiers) {
  if (!modifiers?.length) return "";
  const modMap = {
    cmd: "command down",
    alt: "option down",
    ctrl: "control down",
    shift: "shift down",
  };
  const parts = modifiers.map((m) => modMap[m]).filter(Boolean);
  if (parts.length === 1) return ` using ${parts[0]}`;
  return ` using {${parts.join(", ")}}`;
}

// --- MCP Server ---

const server = new McpServer({
  name: "macos-desktop-control",
  version: "2.0.0",
});

// Tool: screenshot
server.tool(
  "screenshot",
  "Capture a screenshot of the entire screen or a specific region. Returns the image as base64.",
  {
    region: z
      .object({
        x: z.number().describe("Top-left x coordinate"),
        y: z.number().describe("Top-left y coordinate"),
        w: z.number().describe("Width"),
        h: z.number().describe("Height"),
      })
      .optional()
      .describe("Optional region to capture. Omit for full screen."),
    display: z
      .number()
      .optional()
      .describe("Display number (1 = main). Omit for main display."),
  },
  async ({ region, display }) => {
    const filePath = tempPath("png");
    try {
      const args = ["-x"]; // silent, no sound
      if (region) {
        args.push(
          "-R",
          `${region.x},${region.y},${region.w},${region.h}`
        );
      }
      if (display) {
        args.push("-D", String(display));
      }
      args.push(filePath);
      await execFileAsync("screencapture", args);
      const imageData = await readFile(filePath);
      const base64 = imageData.toString("base64");
      await unlink(filePath).catch(() => {});
      return {
        content: [
          {
            type: "image",
            data: base64,
            mimeType: "image/png",
          },
        ],
      };
    } catch (err) {
      await unlink(filePath).catch(() => {});
      return {
        content: [{ type: "text", text: `Screenshot failed: ${err.message}` }],
      };
    }
  }
);

// Tool: click
server.tool(
  "click",
  "Click at screen coordinates. Supports left/right/double/triple click. " +
    "Use 'app' param to ensure the target app is focused before clicking (prevents focus-stealing issues).",
  {
    x: z.number().describe("X coordinate"),
    y: z.number().describe("Y coordinate"),
    button: z
      .enum(["left", "right", "middle"])
      .default("left")
      .describe("Mouse button"),
    clicks: z
      .number()
      .min(1)
      .max(3)
      .default(1)
      .describe("Number of clicks (1=single, 2=double, 3=triple)"),
    modifiers: z
      .array(z.enum(["cmd", "alt", "ctrl", "shift"]))
      .optional()
      .describe("Modifier keys to hold during click"),
    app: z
      .string()
      .optional()
      .describe(
        "App name to focus before clicking (e.g. 'Safari'). Recommended to prevent focus-stealing."
      ),
  },
  async ({ x, y, button, clicks, modifiers, app }) => {
    try {
      // Re-focus target app if specified
      if (app) {
        await ensureAppFocus(app);
      }

      const actions = [];

      // Hold modifiers via cliclick
      if (modifiers?.length) {
        for (const m of modifiers) {
          actions.push(`kd:${m}`);
        }
      }

      // Click action
      const clickCmds = {
        left: { 1: "c", 2: "dc", 3: "tc" },
        right: { 1: "rc", 2: "rc", 3: "rc" },
        middle: { 1: "mc", 2: "mc", 3: "mc" },
      };
      const cmd = clickCmds[button]?.[clicks] || "c";
      actions.push(`${cmd}:${x},${y}`);

      // Release modifiers
      if (modifiers?.length) {
        for (const m of [...modifiers].reverse()) {
          actions.push(`ku:${m}`);
        }
      }

      const result = await runCliclick(...actions);
      return {
        content: [
          {
            type: "text",
            text: `Clicked ${button}(x${clicks}) at (${x}, ${y})${modifiers?.length ? ` with [${modifiers.join("+")}]` : ""}${app ? ` in ${app}` : ""}. ${result}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Click failed: ${err.message}` }],
      };
    }
  }
);

// Tool: move_mouse
server.tool(
  "move_mouse",
  "Move the mouse cursor to the specified coordinates.",
  {
    x: z.number().describe("X coordinate"),
    y: z.number().describe("Y coordinate"),
  },
  async ({ x, y }) => {
    try {
      await runCliclick(`m:${x},${y}`);
      return {
        content: [{ type: "text", text: `Mouse moved to (${x}, ${y})` }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Move failed: ${err.message}` }],
      };
    }
  }
);

// Tool: drag
server.tool(
  "drag",
  "Drag from one position to another.",
  {
    fromX: z.number().describe("Start X"),
    fromY: z.number().describe("Start Y"),
    toX: z.number().describe("End X"),
    toY: z.number().describe("End Y"),
  },
  async ({ fromX, fromY, toX, toY }) => {
    try {
      await runCliclick(`dd:${fromX},${fromY}`, `du:${toX},${toY}`);
      return {
        content: [
          {
            type: "text",
            text: `Dragged from (${fromX},${fromY}) to (${toX},${toY})`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Drag failed: ${err.message}` }],
      };
    }
  }
);

// Tool: type_text
server.tool(
  "type_text",
  "Type text into the focused application. Three modes available:\n" +
    "- 'keystroke' (default): Types via System Events keystroke. Works with any app but affected by input method.\n" +
    "- 'cliclick': Types via cliclick. Fast but also affected by input method.\n" +
    "- 'direct': Sets text directly via AppleScript (TextEdit, Notes, etc.). Bypasses input method completely.\n" +
    "Use 'app' param to ensure the correct app is focused first. " +
    "Set 'switchToEnglish' to auto-switch input method to English before typing.",
  {
    text: z.string().describe("The text to type"),
    app: z
      .string()
      .optional()
      .describe("App name to focus before typing (e.g. 'TextEdit'). Highly recommended."),
    mode: z
      .enum(["keystroke", "cliclick", "direct"])
      .default("keystroke")
      .describe(
        "'keystroke': via System Events (default). 'cliclick': via cliclick. " +
          "'direct': set text via AppleScript (bypasses input method, works with TextEdit/Notes)."
      ),
    switchToEnglish: z
      .boolean()
      .default(false)
      .describe("If true, press Caps Lock before typing to switch to English input."),
  },
  async ({ text, app, mode, switchToEnglish }) => {
    try {
      // Focus app if specified
      if (app) {
        await ensureAppFocus(app);
      }

      // Switch input method if requested
      if (switchToEnglish) {
        await switchToEnglishInput();
      }

      if (mode === "direct") {
        // Direct mode: set text via AppleScript (bypasses input method entirely)
        if (!app) {
          return {
            content: [
              {
                type: "text",
                text: 'Direct mode requires "app" parameter. Specify the app name (e.g. "TextEdit").',
              },
            ],
          };
        }
        // Escape special characters for AppleScript string
        const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        await runOsascript(`
          tell application "${app}"
            if (count of documents) > 0 then
              set text of document 1 to "${escaped}"
            end if
          end tell
        `);
        return {
          content: [{ type: "text", text: `Set text directly in ${app}: "${text}"` }],
        };
      } else if (mode === "cliclick") {
        await runCliclick(`t:${text}`);
        return {
          content: [{ type: "text", text: `Typed via cliclick: "${text}"` }],
        };
      } else {
        // keystroke mode: use System Events (supports any app)
        const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        await runOsascript(`
          tell application "System Events"
            keystroke "${escaped}"
          end tell
        `);
        return {
          content: [{ type: "text", text: `Typed via keystroke: "${text}"` }],
        };
      }
    } catch (err) {
      return {
        content: [{ type: "text", text: `Type failed: ${err.message}` }],
      };
    }
  }
);

// Tool: key_press
server.tool(
  "key_press",
  "Press a key or key combination. Uses AppleScript System Events for reliable key simulation.\n" +
    "For special keys, use key names: return, escape, tab, space, delete, " +
    "arrow-up/down/left/right, f1-f12, home, end, page-up, page-down.\n" +
    "For letter/number keys, just use the character: 'a', '1', etc.\n" +
    "Supports modifier combos: e.g. key='c', modifiers=['cmd'] for Cmd+C.",
  {
    key: z
      .string()
      .describe('Key to press. Special keys: "return", "escape", "tab", "space", "delete", "arrow-up", etc. Letters: "a", "b", "1".'),
    modifiers: z
      .array(z.enum(["cmd", "alt", "ctrl", "shift"]))
      .optional()
      .describe("Modifier keys to hold"),
    app: z
      .string()
      .optional()
      .describe("App name to focus before pressing key"),
  },
  async ({ key, modifiers, app }) => {
    try {
      if (app) {
        await ensureAppFocus(app);
      }

      // Map special key names to AppleScript key codes
      const keyCodeMap = {
        return: 36,
        enter: 36,
        escape: 53,
        esc: 53,
        tab: 48,
        space: 49,
        delete: 51,
        "fwd-delete": 117,
        "arrow-up": 126,
        "arrow-down": 125,
        "arrow-left": 123,
        "arrow-right": 124,
        home: 115,
        end: 119,
        "page-up": 116,
        "page-down": 121,
        f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97,
        f7: 98, f8: 100, f9: 101, f10: 109, f11: 103, f12: 111,
        capslock: 57,
      };

      const modClause = buildModifierClause(modifiers);
      const combo = modifiers?.length ? `${modifiers.join("+")}+${key}` : key;

      if (keyCodeMap[key] !== undefined) {
        // Use key code for special keys
        await runOsascript(`
          tell application "System Events"
            key code ${keyCodeMap[key]}${modClause}
          end tell
        `);
      } else if (key.length === 1) {
        // Single character: use keystroke
        const escaped = key.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        await runOsascript(`
          tell application "System Events"
            keystroke "${escaped}"${modClause}
          end tell
        `);
      } else {
        // Try cliclick for anything else (its named special keys)
        const actions = [];
        if (modifiers?.length) {
          for (const m of modifiers) actions.push(`kd:${m}`);
        }
        actions.push(`kp:${key}`);
        if (modifiers?.length) {
          for (const m of [...modifiers].reverse()) actions.push(`ku:${m}`);
        }
        await runCliclick(...actions);
      }

      return {
        content: [{ type: "text", text: `Pressed: ${combo}` }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Key press failed: ${err.message}` }],
      };
    }
  }
);

// Tool: scroll
server.tool(
  "scroll",
  "Scroll at the current mouse position or specified coordinates using cliclick.",
  {
    direction: z
      .enum(["up", "down", "left", "right"])
      .describe("Scroll direction"),
    amount: z
      .number()
      .min(1)
      .max(50)
      .default(3)
      .describe("Scroll amount (clicks of scroll wheel)"),
    x: z.number().optional().describe("X coordinate to move mouse to before scrolling"),
    y: z.number().optional().describe("Y coordinate to move mouse to before scrolling"),
  },
  async ({ direction, amount, x, y }) => {
    try {
      // Move to position first if specified
      if (x !== undefined && y !== undefined) {
        await runCliclick(`m:${x},${y}`);
      }

      // Use cliclick scroll: sc:x,y where x=horizontal, y=vertical
      // Positive y = scroll down, negative y = scroll up
      const scrollVec = {
        up: `0,-${amount}`,
        down: `0,${amount}`,
        left: `-${amount},0`,
        right: `${amount},0`,
      };

      await runCliclick(`sc:${scrollVec[direction]}`);

      return {
        content: [{ type: "text", text: `Scrolled ${direction} by ${amount}` }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Scroll failed: ${err.message}` }],
      };
    }
  }
);

// Tool: get_mouse_position
server.tool(
  "get_mouse_position",
  "Get the current mouse cursor position.",
  {},
  async () => {
    try {
      const result = await runCliclick("p:");
      return {
        content: [{ type: "text", text: `Mouse position: ${result}` }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Get position failed: ${err.message}` }],
      };
    }
  }
);

// Tool: get_screen_size
server.tool(
  "get_screen_size",
  "Get the screen dimensions of all connected displays.",
  {},
  async () => {
    try {
      const script = `
        tell application "Finder"
          set _bounds to bounds of window of desktop
          set _w to item 3 of _bounds
          set _h to item 4 of _bounds
          return ((_w as text) & "x" & (_h as text))
        end tell
      `;
      const finderSize = await runOsascript(script).catch(() => "unknown");
      const { stdout } = await execAsync(
        "system_profiler SPDisplaysDataType 2>/dev/null | grep -E 'Resolution|Display Type'"
      );
      return {
        content: [
          {
            type: "text",
            text: `Desktop: ${finderSize}\nDisplays:\n${stdout.trim()}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          { type: "text", text: `Get screen size failed: ${err.message}` },
        ],
      };
    }
  }
);

// Tool: open_app
server.tool(
  "open_app",
  "Open or activate a macOS application by name. Brings it to the front.",
  {
    app: z
      .string()
      .describe('Application name, e.g. "Safari", "Finder", "Terminal"'),
  },
  async ({ app }) => {
    try {
      await ensureAppFocus(app);
      return { content: [{ type: "text", text: `Activated: ${app}` }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Open app failed: ${err.message}` }],
      };
    }
  }
);

// Tool: list_windows
server.tool(
  "list_windows",
  "List all visible windows with their titles, positions, and sizes.",
  {},
  async () => {
    try {
      const script = `
        set output to ""
        tell application "System Events"
          set allProcesses to (every process whose visible is true)
          repeat with proc in allProcesses
            set procName to name of proc
            try
              set wins to every window of proc
              repeat with w in wins
                set wName to name of w
                set wPos to position of w
                set wSize to size of w
                set output to output & procName & " | " & wName & " | pos:" & (item 1 of wPos) & "," & (item 2 of wPos) & " | size:" & (item 1 of wSize) & "," & (item 2 of wSize) & linefeed
              end repeat
            end try
          end repeat
        end tell
        return output
      `;
      const result = await runOsascript(script);
      return {
        content: [
          { type: "text", text: result || "No visible windows found." },
        ],
      };
    } catch (err) {
      return {
        content: [
          { type: "text", text: `List windows failed: ${err.message}` },
        ],
      };
    }
  }
);

// Tool: focus_window
server.tool(
  "focus_window",
  "Focus a specific window by application name and optional window title.",
  {
    app: z.string().describe("Application name"),
    title: z
      .string()
      .optional()
      .describe("Window title substring to match"),
  },
  async ({ app, title }) => {
    try {
      if (title) {
        await runOsascript(`
          tell application "System Events"
            tell process "${app}"
              set frontmost to true
              set wins to (every window whose name contains "${title}")
              if (count of wins) > 0 then
                perform action "AXRaise" of item 1 of wins
              end if
            end tell
          end tell
        `);
      } else {
        await ensureAppFocus(app);
      }
      return {
        content: [
          {
            type: "text",
            text: `Focused: ${app}${title ? ` (window: "${title}")` : ""}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          { type: "text", text: `Focus window failed: ${err.message}` },
        ],
      };
    }
  }
);

// Tool: run_shortcut
server.tool(
  "run_shortcut",
  "Run a macOS Shortcuts app shortcut by name.",
  {
    name: z.string().describe("Name of the shortcut to run"),
    input: z.string().optional().describe("Optional input text for the shortcut"),
  },
  async ({ name, input }) => {
    try {
      const args = ["shortcuts", "run", name];
      if (input) {
        args.push("-i", input);
      }
      const { stdout } = await execFileAsync(args[0], args.slice(1), {
        timeout: 30000,
      });
      return {
        content: [
          {
            type: "text",
            text: `Shortcut "${name}" executed.${stdout ? ` Output: ${stdout.trim()}` : ""}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          { type: "text", text: `Shortcut failed: ${err.message}` },
        ],
      };
    }
  }
);

// --- Start ---
const transport = new StdioServerTransport();
await server.connect(transport);
