# Claude Code Viewer

[日本語](./README.md)

A web application for browsing and exporting Claude Code session history in your browser.

## Use Cases

- Review past conversations with Claude Code
- Share session content with others
- View markdown and code blocks with proper formatting

## Requirements

- Node.js 18.17.0 or later

## Setup

```bash
git clone https://github.com/f-tk-ttshp77/claude-code-viewer.git
cd claude-code-viewer
npm install
```

### Configuration (Optional)

If your Claude Code data is stored in a non-standard location, you can specify it via environment variables.

```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env to set the path
CLAUDE_DATA_PATH=/path/to/your/claude/projects
```

## Running the Application

```bash
npm run dev
```

Open http://localhost:3333 in your browser.

> **If sessions are not displayed**
> Follow the guidance shown in the app to check your configuration.

## How to Use

### 1. Session List

When you start the app, the home screen displays a list of sessions grouped by project.

- Sessions are grouped by project (directory)
- Sorted by most recently updated
- Session preview shows the first message summary

### 2. Session Details

Click on a session to view the full conversation.

**What's displayed:**
- User and Claude messages in chronological order
- Properly formatted markdown (headings, lists, tables, etc.)
- Code blocks with syntax highlighting

### 3. Collapsible Command Expansions

When using custom commands like `/rspec`, the expanded markdown file content is automatically collapsed in an accordion. Click "Open" to view the content.

### 4. HTML Export

Click the "Export HTML" button to download the session as an HTML file.

- CSS is embedded, so it can be viewed standalone
- Convenient for sharing with others
- Command expansion sections are clickable to open/close

## Data Location

Claude Code session data is stored in `~/.claude/projects/`. This app reads and displays that data.

```
~/.claude/projects/
├── -Users-username-project1/
│   ├── xxxx-xxxx-xxxx.jsonl  ← session file
│   └── ...
└── ...
```

## License

MIT
