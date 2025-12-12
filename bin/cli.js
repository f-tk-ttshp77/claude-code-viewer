#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');

// Package info
const packageJson = require('../package.json');
const VERSION = packageJson.version;
const NAME = packageJson.name;

// Default configuration
const DEFAULT_PORT = 3333;
const DEFAULT_CLAUDE_PATH = path.join(process.env.HOME || '', '.claude', 'projects');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

// Help message
const HELP = `
${colors.bright}${NAME}${colors.reset} v${VERSION}

${colors.dim}Browse and export your Claude Code session history${colors.reset}

${colors.bright}USAGE${colors.reset}
  $ npx ${NAME} [options]

${colors.bright}OPTIONS${colors.reset}
  -p, --port <port>     Port to run the server on (default: ${DEFAULT_PORT})
  -d, --data <path>     Path to Claude Code data directory
                        (default: ~/.claude/projects)
  -o, --open            Open browser automatically
  -h, --help            Show this help message
  -v, --version         Show version number

${colors.bright}EXAMPLES${colors.reset}
  $ npx ${NAME}
  $ npx ${NAME} --port 8080
  $ npx ${NAME} --open
  $ npx ${NAME} -d /path/to/claude/data -p 4000 --open

${colors.bright}ENVIRONMENT VARIABLES${colors.reset}
  CLAUDE_DATA_PATH      Path to Claude Code data directory
  ANTHROPIC_API_KEY     API key for AI summary generation (optional)
  PORT                  Port to run the server on

${colors.bright}DOCUMENTATION${colors.reset}
  ${packageJson.homepage || 'https://github.com/f-tk-ttshp77/claude-code-viewer'}
`;

// Parse command line arguments
function parseArgs(args) {
  const options = {
    port: parseInt(process.env.PORT, 10) || DEFAULT_PORT,
    dataPath: process.env.CLAUDE_DATA_PATH || DEFAULT_CLAUDE_PATH,
    open: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '-p':
      case '--port':
        if (next && !next.startsWith('-')) {
          options.port = parseInt(next, 10);
          i++;
        }
        break;
      case '-d':
      case '--data':
        if (next && !next.startsWith('-')) {
          options.dataPath = path.resolve(next);
          i++;
        }
        break;
      case '-o':
      case '--open':
        options.open = true;
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-v':
      case '--version':
        options.version = true;
        break;
    }
  }

  return options;
}

// Check if a port is available
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

// Find an available port starting from the given port
async function findAvailablePort(startPort, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`Could not find an available port after ${maxAttempts} attempts`);
}

// Open URL in default browser
function openBrowser(url) {
  const platform = process.platform;
  let command;

  switch (platform) {
    case 'darwin':
      command = 'open';
      break;
    case 'win32':
      command = 'start';
      break;
    default:
      command = 'xdg-open';
  }

  try {
    execSync(`${command} ${url}`, { stdio: 'ignore' });
  } catch (error) {
    console.log(`${colors.yellow}Could not open browser automatically.${colors.reset}`);
    console.log(`Please open ${colors.cyan}${url}${colors.reset} in your browser.`);
  }
}

// Print startup banner
function printBanner(port, dataPath) {
  console.log('');
  console.log(`  ${colors.bright}${colors.blue}Claude Code Viewer${colors.reset}`);
  console.log(`  ${colors.dim}v${VERSION}${colors.reset}`);
  console.log('');
  console.log(`  ${colors.green}Server running at:${colors.reset}  ${colors.cyan}http://localhost:${port}${colors.reset}`);
  console.log(`  ${colors.green}Data path:${colors.reset}          ${colors.dim}${dataPath}${colors.reset}`);
  console.log('');
  console.log(`  ${colors.dim}Press Ctrl+C to stop${colors.reset}`);
  console.log('');
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  // Handle help and version
  if (options.help) {
    console.log(HELP);
    process.exit(0);
  }

  if (options.version) {
    console.log(VERSION);
    process.exit(0);
  }

  // Validate data path
  if (!fs.existsSync(options.dataPath)) {
    console.log(`${colors.yellow}Warning:${colors.reset} Data directory not found: ${options.dataPath}`);
    console.log(`${colors.dim}The app will still start, but no sessions will be displayed.${colors.reset}`);
    console.log('');
  }

  // Find available port
  let port = options.port;
  const isAvailable = await isPortAvailable(port);

  if (!isAvailable) {
    console.log(`${colors.yellow}Port ${port} is in use.${colors.reset}`);
    try {
      port = await findAvailablePort(port + 1);
      console.log(`${colors.green}Using port ${port} instead.${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
      process.exit(1);
    }
  }

  // Get the directory where this CLI is located
  const cliDir = path.dirname(__dirname);

  // Set environment variables
  const env = {
    ...process.env,
    CLAUDE_DATA_PATH: options.dataPath,
    PORT: String(port),
  };

  // Check if next is available
  const nextBin = path.join(cliDir, 'node_modules', '.bin', 'next');
  const useLocalNext = fs.existsSync(nextBin);

  // Start Next.js dev server
  const nextCommand = useLocalNext ? nextBin : 'npx';
  const nextArgs = useLocalNext
    ? ['dev', '-p', String(port)]
    : ['next', 'dev', '-p', String(port)];

  console.log(`${colors.dim}Starting server...${colors.reset}`);

  const child = spawn(nextCommand, nextArgs, {
    cwd: cliDir,
    env,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  let serverStarted = false;

  // Handle stdout
  child.stdout.on('data', (data) => {
    const output = data.toString();

    // Detect when the server is ready
    if (!serverStarted && (output.includes('Ready') || output.includes('ready') || output.includes('started'))) {
      serverStarted = true;
      printBanner(port, options.dataPath);

      if (options.open) {
        openBrowser(`http://localhost:${port}`);
      }
    }

    // Only show relevant output, filter out noisy Next.js logs
    if (output.includes('error') || output.includes('Error') || output.includes('warn')) {
      process.stdout.write(data);
    }
  });

  // Handle stderr
  child.stderr.on('data', (data) => {
    const output = data.toString();
    // Filter out common non-error messages
    if (!output.includes('ExperimentalWarning') && !output.includes('punycode')) {
      process.stderr.write(data);
    }
  });

  // Handle process exit
  child.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${colors.red}Server exited with code ${code}${colors.reset}`);
    }
    process.exit(code || 0);
  });

  // Handle signals
  const cleanup = () => {
    console.log('');
    console.log(`${colors.dim}Shutting down...${colors.reset}`);
    child.kill('SIGTERM');
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// Run
main().catch((error) => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
});
