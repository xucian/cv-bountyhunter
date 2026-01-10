#!/usr/bin/env node
// IMPORTANT: Enable file logging BEFORE any other imports to ensure all console.log calls are captured
import { enableFileLogging } from '../utils/logger.js';
enableFileLogging();

import React from 'react';
import { render } from 'ink';
import { App } from './App.js';

// Render the TUI application
const { waitUntilExit } = render(<App />);

// Wait for the app to exit
waitUntilExit().then(() => {
  process.exit(0);
});
