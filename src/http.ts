import express from 'express';
import {
  hostHeaderValidation,
  originValidation,
  toNodeHandler,
} from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';
import {
  getAllowedHosts,
  getAllowedOrigins,
  getConfiguredHost,
  getConfiguredPort,
} from './httpConfig.js';
import { createEzzyBillsMcpServer } from './server.js';

const app = express();
app.disable('x-powered-by');

const mcpHandler = createMcpHandler(() => createEzzyBillsMcpServer());
const nodeMcpHandler = toNodeHandler(mcpHandler);
const validateHost = hostHeaderValidation(getAllowedHosts());
const validateOrigin = originValidation(getAllowedOrigins());

app.all('/mcp', async (req, res) => {
  if (!validateHost(req, res) || !validateOrigin(req, res)) {
    return;
  }

  await nodeMcpHandler(req, res);
});

app.get('/', (_req, res) => {
  res.send('EzzyBills MCP server is running');
});

const port = getConfiguredPort();
const host = getConfiguredHost();

const httpServer = app.listen(port, host, () => {
  console.log(`EzzyBills MCP server running on http://${host}:${port}`);
  console.log(`MCP endpoint: http://${host}:${port}/mcp`);
});

httpServer.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${port} is already in use. Specify a different port using the PORT environment variable (e.g. PORT=3001).`
    );
  } else {
    console.error('HTTP SERVER ERROR:', error);
  }
  process.exit(1);
});

httpServer.on('close', () => {
  console.log('HTTP SERVER CLOSED');
});

process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

process.on('beforeExit', (code) => {
  console.log('PROCESS BEFORE EXIT:', code);
});

process.on('exit', (code) => {
  console.log('PROCESS EXIT:', code);
});
