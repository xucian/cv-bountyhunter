#!/bin/bash
# Watch the log file in real-time
LOG_FILE="logs/codebounty-$(date +%Y-%m-%d).log"

echo "Watching log file: $LOG_FILE"
echo "========================================="
echo ""

# Create log file if it doesn't exist
mkdir -p logs
touch "$LOG_FILE"

# Tail the log file
tail -f "$LOG_FILE"
