#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';

// Render the TUI application
const { waitUntilExit } = render(<App />);

// Wait for the app to exit
waitUntilExit().then(() => {
  process.exit(0);
});
