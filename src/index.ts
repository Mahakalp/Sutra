#!/usr/bin/env node

/**
 * Sutra — Entry point
 *
 * @mahakalp/salesforce-mcp
 * Open-source MCP server that makes any AI assistant a Salesforce expert.
 *
 * Usage:
 *   npx @mahakalp/salesforce-mcp
 *
 * Environment variables:
 *   MAHAKALP_API_URL  — Yantra API base URL (default: https://yantra.mahakalp.dev)
 *   MAHAKALP_API_KEY  — API key for paid tier tools (optional for free tools)
 */

import { startServer } from './server.js';

// Redirect all console output to stderr — stdout is reserved for MCP JSON-RPC
const write = (chunk: string) => process.stderr.write(chunk);
console.log = (...args: unknown[]) => write(args.map(String).join(' ') + '\n');
console.error = (...args: unknown[]) => write(args.map(String).join(' ') + '\n');
console.warn = (...args: unknown[]) => write(args.map(String).join(' ') + '\n');
console.info = (...args: unknown[]) => write(args.map(String).join(' ') + '\n');
console.debug = (...args: unknown[]) => write(args.map(String).join(' ') + '\n');

// Start server
startServer({
  apiBaseUrl: process.env.MAHAKALP_API_URL,
  apiKey: process.env.MAHAKALP_API_KEY,
}).catch((error) => {
  process.stderr.write(`[sutra] Failed to start: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
