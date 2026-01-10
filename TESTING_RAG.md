# Testing RAG Integration

## Quick Test Guide

### Important: Logging Behavior

**All console output goes to log files ONLY** - the TUI stays clean with no log pollution.

- ✅ **TUI Terminal**: Clean Ink UI, no console output
- ✅ **Log File**: All logs including errors with stack traces
- ✅ **Uncaught errors**: Captured via process-level handlers

### Step 1: Clear Old Logs
```bash
rm logs/codebounty-*.log
```

### Step 2: Start Log Monitoring (in a separate terminal)
```bash
tail -f logs/codebounty-*.log
```

### Step 3: Run the TUI with Real RAG
```bash
# Your .env already has:
# MOCK_RAG=false
# VOYAGE_API_KEY=pa-hKcT3zzBVtwKjqKia09U7rro_A8vnHxmDMxEX-WPEEx
# MONGODB_URI=mongodb+srv://...

npm run dev:tui
```

**Note**: You should see ZERO console output in the TUI terminal. All logs appear in the log file.

### Step 4: Start a Competition
1. In the TUI, select an issue (create a test one if needed)
2. Start the competition
3. **Watch the logs in the other terminal**

### Expected Log Output

```
[INFO] [Logger] Started - logging to /Users/luti/dev/cv-xcoin-hunter/logs/codebounty-2026-01-10.log
[INFO] [Services] Initialized with:
[INFO]   - GitHub: REAL
[INFO]   - LLM: REAL
[INFO]   - State: REAL
[INFO]   - Payment: REAL
[INFO]   - Agents: REAL
[INFO]   - Reviewer: REAL
[INFO]   - RAG: REAL

[INFO] [TUI] Starting competition via Orchestrator...

[INFO] [Orchestrator] Indexing repository at /Users/luti/dev/cv-xcoin-hunter
[INFO] [RealRAG] Connected to MongoDB Atlas
[INFO] [RealRAG] Indexing https://github.com/owner/repo (commit: af16344ac8049dc915c6b9a0e7ae01bcb87646a0)
[INFO] [RealRAG] Found 43 source files
[INFO] [RealRAG] Extracted 212 code chunks
[INFO] [RealRAG] Embedding batch 1/2...
[INFO] [RealRAG] Embedding batch 2/2...
[INFO] [RealRAG] ✓ Indexed 212 chunks to MongoDB Atlas
[INFO] [Orchestrator] Repository indexed: 212 chunks (commit: af16344...)

[INFO] [Orchestrator] Querying relevant code for issue...
[INFO] [RealRAG] Querying for issue: Fix authentication bug...
[INFO] [RealRAG] Found 10 relevant chunks
[INFO] [Orchestrator] Retrieved 10 relevant code chunks

[INFO] [Orchestrator] Reviewing 3 solutions...
[INFO] [Reviewer] Winner: qwen
```

### Step 5: Verify MongoDB

After the competition runs, check MongoDB Atlas:

1. Go to your cluster in MongoDB Atlas
2. Navigate to `codebounty` database
3. Check `code_chunks` collection
4. You should see **212 documents** with fields:
   - `repoUrl`
   - `commitId`
   - `filePath`
   - `chunkType`
   - `chunkName`
   - `code`
   - `embedding` (array of 1536 numbers)
   - `indexedAt`

### Troubleshooting

#### No RAG logs appear
- Check that `.env` has `MOCK_RAG=false`
- Verify services initialization shows `RAG: REAL`
- Check for errors in the log file

#### "Vector search failed"
- Ensure you've created the vector index in MongoDB Atlas
- Wait 2-5 minutes for index to build after creation
- Index name must be `vector_index`

#### "Voyage AI API error: 429"
- Rate limiting issue
- Wait a minute and try again
- Or use a smaller repo for testing

#### code_chunks still empty
- Check logs for embedding errors
- Verify Voyage API key is valid
- Ensure AST parsing succeeded (check for "Extracted X code chunks")

## Success Indicators

✅ **Logs show**:
- `[RealRAG] Connected to MongoDB Atlas`
- `[RealRAG] Extracted 212 code chunks`
- `[RealRAG] ✓ Indexed 212 chunks to MongoDB Atlas`
- `[RealRAG] Found 10 relevant chunks`

✅ **MongoDB**:
- `code_chunks` collection has documents
- Each document has `embedding` array with 1536 numbers

✅ **Subsequent runs** (same repo):
- Logs show: `[RealRAG] Repo already indexed (212 chunks found)`
- Indexing is skipped (cache working!)

## What Changed

### Before (Why RAG Wasn't Working)
```typescript
// App.tsx was doing this:
const runCompetition = async (comp) => {
  // Manually call LLM
  const code = await services.llm.generateSolution(prompt, model);
  // Manually review
  const winner = await services.reviewer.reviewSolutions(...);
  // Manually pay
  await services.payment.sendBonus(...);
}
```
❌ Orchestrator (where RAG lives) was never called!

### After (RAG Now Works)
```typescript
// App.tsx now does this:
const handleStartCompetition = async (issue) => {
  // Let orchestrator handle everything
  const competition = await orchestrator.startCompetition(
    issue.repoUrl,
    issue.number
  );
}
```
✅ Orchestrator runs, which includes RAG indexing and querying!

## Next Steps

1. Run with real services and verify logs
2. Check MongoDB for populated `code_chunks`
3. Run again on same repo - should see cache hit
4. Try with different repo - should index new chunks
