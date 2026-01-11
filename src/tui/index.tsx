#!/usr/bin/env node
import 'dotenv/config';

// IMPORTANT: Enable file logging BEFORE any other imports to ensure all console.log calls are captured
import { enableFileLogging } from '../utils/logger.js';
enableFileLogging();

import React from 'react';
import { render } from 'ink';
import { App } from './App.js';

// Check if we're in debug mode - if so, don't render TUI (just show console logs)
const TUI_DEBUG_MODE = process.env.TUI_DEBUG_MODE === 'true';

if (TUI_DEBUG_MODE) {
  console.log('[TUI] Running in DEBUG MODE - TUI disabled, showing console logs only');
  console.log('[TUI] Set TUI_DEBUG_MODE=false to enable TUI');

  // Run competition without TUI
  import('./debug-runner.js').then(({ runDebugMode }) => {
    runDebugMode();
  });
} else {
  // Render the TUI application
  const { waitUntilExit } = render(<App />);

  // Wait for the app to exit
  waitUntilExit().then(() => {
    process.exit(0);
  });
}
