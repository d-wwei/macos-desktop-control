# macos-desktop-control

[English](./README.md)

**原生 macOS 桌面控制** MCP Server — 截屏、鼠标、键盘、窗口管理，一站搞定。

无需 Docker，无需虚拟桌面，直接控制你的**真实 Mac 桌面**。

兼容所有 MCP 客户端：Claude Code、Claude Desktop、OpenAI Codex CLI、Gemini CLI、Cursor、VS Code Copilot 等。

## 功能一览

| 类别 | 能力 |
|---|---|
| **屏幕** | 全屏/区域截图，显示器信息 |
| **鼠标** | 点击（左/右/双击/三击）、移动、拖拽、滚动 |
| **键盘** | 文字输入（3 种模式）、任意按键+修饰键组合 |
| **窗口** | 列出所有窗口、按应用/标题聚焦、打开应用 |
| **系统** | 运行 macOS 快捷指令 |

**核心特点：**

- `app` 参数 — 操作前**自动聚焦目标应用**，解决 AI 客户端审批权限时焦点被抢的问题
- `type_text` 的 `direct` 模式 — 通过 AppleScript 直接写入内容，**完全绕过输入法**
- `key_press` 支持**任意按键+修饰键组合**，通过 AppleScript key code 实现，不受 cliclick 命名键限制

## 前置条件

- macOS（已在 Sequoia 15.x 上测试）
- Node.js 18+
- [cliclick](https://github.com/BlueM/cliclick)：
  ```bash
  brew install cliclick
  ```
- **辅助功能权限** — 在以下位置授权你的终端应用：
  **系统设置 → 隐私与安全性 → 辅助功能**

## 安装

```bash
git clone https://github.com/d-wwei/macos-desktop-control.git
cd macos-desktop-control
npm install
```

## 客户端配置

本服务使用 **stdio 传输**，这是最通用的 MCP 传输方式。各客户端配置几乎一致。

### Claude Code

```bash
# 项目级
claude mcp add macos-desktop-control -- node /path/to/macos-desktop-control/src/index.js

# 全局（所有项目可用）
claude mcp add macos-desktop-control -s user -- node /path/to/macos-desktop-control/src/index.js
```

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`：

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

`.codex/mcp.json` 或通过 `codex --mcp-config mcp.json` 传入：

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

`~/.gemini/settings.json`：

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

`.cursor/mcp.json`：

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

`.vscode/mcp.json`：

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

## 工具列表

| 工具 | 说明 | 主要参数 |
|---|---|---|
| `screenshot` | 全屏或区域截图 | `region`, `display` |
| `click` | 坐标点击 | `x`, `y`, `button`, `clicks`, `modifiers`, `app` |
| `move_mouse` | 移动光标 | `x`, `y` |
| `drag` | 拖拽 | `fromX`, `fromY`, `toX`, `toY` |
| `type_text` | 输入文字（3 种模式） | `text`, `app`, `mode`, `switchToEnglish` |
| `key_press` | 按键组合 | `key`, `modifiers`, `app` |
| `scroll` | 滚动 | `direction`, `amount`, `x`, `y` |
| `get_mouse_position` | 获取光标位置 | — |
| `get_screen_size` | 获取屏幕尺寸 | — |
| `open_app` | 打开/激活应用 | `app` |
| `list_windows` | 列出可见窗口 | — |
| `focus_window` | 聚焦指定窗口 | `app`, `title` |
| `run_shortcut` | 运行快捷指令 | `name`, `input` |

## 使用技巧

### 防止焦点被抢

当 AI 客户端在终端请求权限审批时，焦点会切到终端。在 `click`、`type_text`、`key_press` 中使用 `app` 参数，操作前自动切回目标应用：

```json
{ "text": "hello", "app": "TextEdit" }
```

### 输入法处理

如果你使用中文/日文输入法，`keystroke` 模式可能触发候选词。两种解决方案：

| 方案 | 用法 |
|---|---|
| **直接模式** | `mode: "direct"` — 完全绕过输入法（支持 TextEdit、备忘录等） |
| **切换语言** | `switchToEnglish: true` — 输入前按 Caps Lock 切换到英文 |

### type_text 三种模式

| 模式 | 机制 | 绕过输入法 | 适用范围 |
|---|---|---|---|
| `keystroke`（默认） | System Events `keystroke` | 否 | 所有应用 |
| `cliclick` | cliclick `t:` 命令 | 否 | 所有应用 |
| `direct` | AppleScript `set text` | **是** | TextEdit、备忘录等 |

## 架构

```
screencapture（macOS 内置）     →  screenshot, get_screen_size
cliclick（brew 安装）           →  click, move_mouse, drag, scroll, get_mouse_position
osascript / System Events      →  type_text, key_press, open_app, list_windows, focus_window
shortcuts CLI（macOS 内置）     →  run_shortcut
MCP SDK（stdio 传输）           →  协议层
```

## 方案对比

### 总览

| 方案 | 平台 | 控制范围 | 需要 Docker | 控制真实桌面 |
|---|---|---|---|---|
| **本项目** | **macOS** | **全桌面** | **否** | **是** |
| Anthropic Computer Use | Linux | 全桌面 | 是 | 否（虚拟桌面） |
| MCPControl | Windows | 全桌面 | 否 | 是 |
| Playwright MCP | 跨平台 | 仅浏览器 | 否 | 部分 |

### 与跨平台 Python MCP Server 的对比

市面上有基于 PyAutoGUI 的跨平台桌面控制 MCP Server，如 [computer-control-mcp](https://github.com/AB498/computer-control-mcp) 和 [mcp-desktop-controller](https://github.com/KumaVolt/mcp-desktop-controller)。以下是详细对比：

| 维度 | **本项目** | **computer-control-mcp** | **mcp-desktop-controller** |
|---|---|---|---|
| 语言 | Node.js | Python | Python |
| 底层工具 | cliclick + osascript + screencapture | PyAutoGUI + RapidOCR + ONNX | PyAutoGUI + FastMCP |
| 平台 | 仅 macOS | 跨平台 | 跨平台 |
| OCR | 无 | **有**（RapidOCR） | 无 |
| 输入法绕过 | **有**（`direct` 模式） | 无 | 无 |
| 焦点管理 | **有**（`app` 参数自动回焦） | 无 | 无 |
| macOS 快捷指令 | **有**（`run_shortcut`） | 无 | 无 |
| AppleScript 深度集成 | **有**（key code、窗口控制） | 无 | 无 |
| 安装方式 | npm + `brew install cliclick` | pip（依赖较重，含 ONNX） | pip |

### 为什么单独开发 macOS 原生方案

**1. 防止焦点被抢** — AI 客户端（Claude Code、Codex CLI 等）在终端请求权限审批时，焦点会切到终端窗口，后续的鼠标点击和键盘输入全部打到错误窗口。我们的 `app` 参数在每次操作前调用 `ensureAppFocus()` 自动切回目标应用。PyAutoGUI 方案完全没有处理这个问题。

**2. 输入法处理** — `direct` 模式通过 AppleScript `set text` 直接写入文本，完全绕过输入法。对于使用中文/日文输入法的用户，PyAutoGUI 的 `typewrite` 只支持 ASCII，`keystroke` 模式会触发候选词弹窗。

**3. 更深的 macOS 集成** — AppleScript `key code` 支持所有 macOS 键码 + 修饰键组合，不受 PyAutoGUI 键名映射限制。`run_shortcut` 可以调用任意 macOS 快捷指令，串联系统级自动化。窗口管理使用 System Events 的 `AXRaise`，比 PyAutoGUI 在 macOS 上的窗口操作更可靠。

**4. 轻量** — 只依赖 cliclick（一个 brew 包）+ 系统自带的 osascript 和 screencapture。无需 Python 运行环境、ONNX 推理引擎等重量级依赖。

### 什么时候该选跨平台方案

- 你需要同时控制 Windows、Linux 和 macOS
- 你需要 OCR 识别屏幕上的文字来定位元素（computer-control-mcp 有这个能力）
- 你不使用中文/日文输入法，且焦点被抢对你的工作流影响不大

**一句话总结：** 跨平台通用性不如他们，macOS 上的实际体验比他们好 — 尤其是使用中文输入法和需要审批的 AI 客户端时。

## 许可证

MIT
