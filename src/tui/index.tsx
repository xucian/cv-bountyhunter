#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { enableFileLogging } from '../utils/logger.js';

// Enable file logging (logs to ./logs/codebounty-YYYY-MM-DD.log)
enableFileLogging();

// Render the TUI application
const { waitUntilExit } = render(<App />);

// Wait for the app to exit
waitUntilExit().then(() => {
  process.exit(0);
});
