# Voyage AI + MongoDB Atlas RAG Integration Plan

> **🔐 Setup & Secrets**: See [`todos/tmp-env.md`](./tmp-env.md) for environment setup, API keys, and MongoDB credentials.

## Context & Scope

### Hackathon Setup
- **Event**: Agentic Orchestration Hackathon (Cerebral Valley)
- **Team Size**: 4 people
- **Your Part**: Code indexing (chunking + embeddings) + RAG retrieval via MongoDB Atlas
- **Teammates' Parts**:
  - X402 payment integration (Coinbase 402)
  - Code generation (Fireworks AI LLM integration)
- **Requirements**: Must use MongoDB Atlas for embeddings/RAG, Voyage AI for embeddings

### Current Codebase State
- **Architecture**: Service abstraction pattern - every external service has Mock + Real implementations
- **Status**: Mocks implemented end-to-end, teammates have partially implemented their Real services
- **Recent Changes** (from git diff):
  - Removed reviewer service (now picks fastest successful agent)
  - Stubbed out Real implementations (throw errors)
  - Simplified orchestrator winner logic
- **Your Goal**: Add RAG without breaking existing mock flow, minimize merge conflicts

---

## Critical Design Decisions

### 1. RAG Service Integration Point
**Decision**: New `IRAGService` interface + Orchestrator enriches tasks

**Why**:
- Follows existing service abstraction pattern
- Orchestrator has centralized control over competition flow
- Agents stay simple (just receive enriched context)
- Easy to mock/test in isolation

**Flow**:
1. Orchestrator calls `ragService.indexRepo()` at competition start
2. Orchestrator calls `ragService.queryRelevantCode(issue)` to get context
3. Orchestrator enriches `SolveTask.codeContext` before sending to agents
4. Agents receive code context as part of their task

### 2. Code Chunking Strategy
**Decision**: AST-based function/class extraction

**Why**:
- More impressive than naive file splitting
- Semantic chunks (functions/classes are logical units)
- Good balance of complexity vs. hackathon time

**Implementation**:
- Use `@babel/parser` + `@babel/traverse` for JS/TS files
- Extract: functions, classes, methods, async functions
- Store metadata: file path, chunk type, chunk name

**Future TODOs** (out of scope for hackathon):
- FileReader fallback mode (if AST fails)
- File-level chunks (full file storage)
- Multi-language support (Python, Go, etc.)

### 3. Commit-Aware Caching
**Decision**: Use Git commit SHA as cache key

**Why**:
- Commit SHA is a content hash (same code = same hash)
- Prevents re-indexing same repo version
- Supports multi-version storage (different commits coexist)

**Schema**:
```typescript
{
  repoUrl: string,       // "https://github.com/owner/repo"
  commitId: string,      // Git SHA (e.g., "a3f2b1c...")
  filePath: string,      // "src/auth/login.ts"
  chunkType: string,     // "function" | "class" | "method"
  chunkName: string,     // "login" | "UserService"
  code: string,          // Full code of chunk
  embedding: number[],   // 1536-dim vector from Voyage AI (voyage-code-2)
  indexedAt: Date        // Timestamp
}
```

**Caching Logic**:
```typescript
// Before indexing:
const commitId = getCommitSHA(repoPath);
const alreadyIndexed = await ragService.isRepoIndexed(repoUrl, commitId);
if (alreadyIndexed) {
  console.log("Repo already indexed, skipping...");
  return;
}
// Proceed with chunking + embedding + storage
```

### 4. Repo Detection & Local Path Handling
**Decision**: CLI operates on local filesystem (current directory or temp clone)

**Flow**:
1. **User launches CLI**
2. **Pre-flight check**:
   - In git repo with remote? → Pre-populate repo URL in TUI, use current directory
   - In empty folder? → Show input field for GitHub URL, ask to clone to temp
   - In non-empty non-git OR git without remote? → Prompt:
     ```
     Not in a valid repo. Clone to temp directory?
     Location: /tmp/<unique-id>
     [Yes] [No]
     ```
     - If yes: clone there, continue from that directory
     - If no: exit or ask for different path

3. **Indexing always uses local filesystem**:
   - Read files from current working directory (or temp dir)
   - No GitHub API fetching during indexing
   - Parse files with AST, generate embeddings, store in MongoDB

**Why This Approach**:
- Simple for hackathon (no complex clone logic in orchestrator)
- Agents will run on Vercel (separate concern)
- CLI runs locally, can access filesystem
- Temp dirs persist during demo (won't auto-clean)

---

## ⚠️ Non-Obvious Conflicts & Solutions

**IMPORTANT**: Read this section carefully to avoid implementation issues that aren't immediately apparent.

### Conflict #1: MongoDB Connection Duplication ⚠️ MEDIUM

**Problem**: Both `RealStateStore` (teammates' code) and our `RealRAGService` create separate `MongoClient` instances. MongoDB best practice is one client per app (for connection pooling).

**Impact**:
- Inefficient connection pooling
- Potential connection limit issues on Atlas free tier (100-500 connections)
- Slower performance

**Solution for Hackathon**: Accept for now, document as TODO. Both services will connect independently - works fine for demo.

**Production Fix**: Share single MongoClient via service factory:
```typescript
// In services/index.ts
const mongoClient = new MongoClient(config.mongodb.uri);
await mongoClient.connect();
const state = new RealStateStore(mongoClient);
const rag = new RealRAGService(mongoClient);
```

---

### Conflict #2: Indexing Failure Recovery 🔴 CRITICAL

**Problem**: If indexing fails mid-way (Voyage API rate limit, parse errors), what happens to the competition?

**Current Plan**: Creates competition first, then indexes. If indexing fails, orphaned competition exists.

**Solution**: **Index BEFORE creating competition** (fail fast pattern)

```typescript
async startCompetition(repoUrl, issueNumber, bountyAmount) {
  // 1-2. Auth + fetch issue

  // 3. Index FIRST (if this fails, no competition record created)
  const currentDir = process.cwd();
  const { commitId, chunksIndexed } = await this.services.rag.indexRepo(currentDir, repoUrl);
  console.log(`[Orchestrator] Indexed ${chunksIndexed} chunks (commit: ${commitId})`);

  // 4. Only NOW create competition (indexing succeeded)
  const competition = { ... };
  await this.services.state.saveCompetition(competition);

  // 5-10. Rest of flow
}
```

**Why This Works**:
- User gets clear error if indexing fails
- No orphaned competitions in DB
- Clean retry flow (just run command again)

---

### Conflict #3: Large HTTP Context Bodies ⚠️ MEDIUM

**Problem**: `SolveTask.codeContext` contains ~10 chunks × 100 lines = ~1000 lines of code (~50-100KB). When `MOCK_AGENTS=false`, this is sent via HTTP POST to agent servers.

**Impact**:
- Express default body limit: 100KB (might be exceeded)
- Network latency
- Agent parsing overhead

**Solution**: Increase Express limit + add safety truncation

```typescript
// In src/agents/agent-server.ts
app.use(express.json({ limit: '1mb' })); // Increased from default

// In orchestrator formatCodeContext()
const MAX_CONTEXT_CHARS = 50000; // Safety limit
if (context.length > MAX_CONTEXT_CHARS) {
  context = context.slice(0, MAX_CONTEXT_CHARS) + '\n\n... (truncated for size)';
}
```

---

### Conflict #4: Vector Index Build Time 🔴 CRITICAL

**Problem**: When you first insert chunks into `code_chunks` collection, the Atlas Vector Search index takes **2-5 minutes to build** (async).

**Flow**:
1. Insert 500 chunks → MongoDB accepts them ✅
2. Immediately query vector search → **Returns 0 results** ❌ (index still building)
3. Agents get no context despite successful indexing

**Solution**: **Pre-create index BEFORE hackathon demo** + graceful fallback

**Pre-Demo Setup** (MUST DO):
1. Login to MongoDB Atlas
2. Navigate to `codebounty` database
3. Create `code_chunks` collection (if empty, insert a dummy doc: `{ test: true }`)
4. Go to "Search" tab → "Create Search Index"
5. Use JSON from section 5 below
6. **Wait for status: "Active"** (2-5 min)
7. Delete dummy doc

**Graceful Fallback** (in code):
```typescript
async queryRelevantCode(issue, limit) {
  try {
    const results = await this.chunksCollection.aggregate(pipeline).toArray();
    if (results.length === 0) {
      console.warn('[RAG] No results found - index may be building or no data indexed yet');
    }
    return results;
  } catch (error) {
    console.warn('[RAG] Vector search failed, continuing without context:', error);
    return [];
  }
}
```

---

### Conflict #5: Temp Directory Clone Flow Undefined 🔴 CRITICAL

**Problem**: Plan says "if not in git repo, clone to /tmp/xyz", but who does the cloning?

**Current Gap**:
- **TUI** doesn't have git clone logic (just renders UI)
- **Orchestrator** starts after user confirms, can't prompt
- **Service factory** runs before TUI

**Solution for Hackathon** (user response): the ui does the cloning, and cd's there, and it'll enter the same exact state as if we'd already been in a cloned repo (code should be aware of this -- but i hope we already have all of the .env files also present in memory so cd-ing won't clear them). this part doesn't have to be tested at the end of the implementation, but ideally it shold work.

**Simplified Flow**:
1. User must `cd` into repo before running `npm run dev:tui`
2. If not in git repo, show error: "Please run from a git repository directory"
3. Document as limitation: "Only works on locally cloned repos for v1"

**Future Enhancement** (if time permits):
```typescript
// In TUI, add pre-flight check:
const isGitRepo = await execAsync('git rev-parse --is-inside-work-tree').catch(() => false);
if (!isGitRepo) {
  showError('Please run this command from inside a git repository.');
  process.exit(1);
}
```

**Why This Works**:
- Avoids complex clone logic
- Still impressive for demo (most users will have repos locally)
- Clear error message prevents confusion

---

### Conflict #6: No Indexing Progress Updates ⚠️ MEDIUM

**Problem**: Indexing large repo takes **30-60 seconds**:
- AST parsing: 5-10s
- Voyage embeddings (4 batches × 4s): 16s
- MongoDB inserts: 2-3s
- Total: 20-35s

During this time, TUI shows "Starting competition..." with spinner - no progress updates. User might think it's frozen.

**Solution for Hackathon**: **Console logging** (simple, effective)

```typescript
// In RealRAGService.indexRepo()
console.log(`[RAG] Found ${files.length} source files`);
console.log(`[RAG] Extracted ${allChunks.length} code chunks`);

for (let i = 0; i < batches.length; i++) {
  console.log(`[RAG] Embedding batch ${i + 1}/${batches.length}...`);
  await voyageClient.embed(...);
}

console.log(`[RAG] Inserting ${documents.length} chunks into MongoDB...`);
await collection.insertMany(documents);
console.log(`[RAG] ✓ Indexing complete!`);
```

**Production Enhancement** (out of scope):
- Event emitter pattern
- TUI polls competition status for real-time updates
- Progress bar in TUI

---

## Implementation Plan

### 1. Types & Interfaces

**File**: `src/types/services.ts`

Add new interface:
```typescript
export interface IRAGService {
  /**
   * Index a local repository into MongoDB Atlas
   * @param repoPath - Local filesystem path to repo (e.g., "/Users/me/project")
   * @param repoUrl - GitHub URL (e.g., "https://github.com/owner/repo")
   * @returns Commit ID and number of chunks indexed
   */
  indexRepo(repoPath: string, repoUrl: string): Promise<{
    commitId: string;
    chunksIndexed: number;
  }>;

  /**
   * Query relevant code chunks for an issue
   * @param issue - The GitHub issue to find relevant code for
   * @param limit - Max number of chunks to return (default: 10)
   * @returns Array of relevant code chunks, sorted by relevance score
   */
  queryRelevantCode(issue: Issue, limit?: number): Promise<CodeChunk[]>;

  /**
   * Check if a repo is already indexed
   * @param repoUrl - GitHub URL
   * @param commitId - Git commit SHA
   * @returns True if already indexed
   */
  isRepoIndexed(repoUrl: string, commitId: string): Promise<boolean>;
}

export interface CodeChunk {
  filePath: string;
  chunkType: 'function' | 'class' | 'method';
  chunkName: string;
  code: string;
  score?: number; // Relevance score from vector search
}
```

**File**: `src/types/index.ts`

Update `SolveTask`:
```typescript
export interface SolveTask {
  agentId: string;
  issue: Issue;
  codeContext?: string;  // NEW: RAG-retrieved context (formatted chunks)
}
```

### 2. Configuration

**File**: `src/config.ts`

**IMPORTANT**: Teammates have already added `orchestrator`, `x402`, and `cdp` sections. Add our RAG sections AFTER theirs to avoid conflicts.

```typescript
export const config = {
  useMocks: {
    github: process.env.MOCK_GITHUB !== 'false',
    llm: process.env.MOCK_LLM !== 'false',
    state: process.env.MOCK_STATE !== 'false',
    payment: process.env.MOCK_PAYMENT !== 'false',
    agents: process.env.MOCK_AGENTS !== 'false',
    rag: process.env.MOCK_RAG !== 'false',  // ADD THIS LINE
  },

  agents: [ /* ... existing ... */ ],
  fireworks: { /* ... existing ... */ },

  // Teammates added these (already in origin/main):
  orchestrator: {
    privateKey: process.env.ORCHESTRATOR_PRIVATE_KEY || '',
    walletId: process.env.ORCHESTRATOR_WALLET_ID || '',
  },
  x402: {
    network: (process.env.X402_NETWORK || 'base-sepolia') as 'base' | 'base-sepolia',
    facilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://x402.coinbase.com',
    usdcAddress: process.env.USDC_CONTRACT_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
  cdp: {
    apiKeyId: process.env.CDP_API_KEY_ID || '',
    apiKeySecret: process.env.CDP_API_KEY_SECRET || '',
    walletSecret: process.env.CDP_WALLET_SECRET || '',
  },

  // ADD YOUR SECTIONS HERE (after teammates' sections):

  // RAG configuration
  rag: {
    indexMode: process.env.INDEX_MODE || 'ast',
    chunkLimit: parseInt(process.env.RAG_CHUNK_LIMIT || '10', 10),
  },

  // Voyage AI configuration
  voyage: {
    apiKey: process.env.VOYAGE_API_KEY || '',
    model: 'voyage-code-2',
    dimension: 1536,
  },

  // MongoDB Atlas configuration
  mongodb: {
    uri: process.env.MONGODB_URI || '',
    dbName: 'codebounty',
    collections: {
      chunks: 'code_chunks',           // YOUR collection
      competitions: 'competitions',    // Teammates' collection (state)
      payments: 'payments',            // Teammates' collection (payments)
    },
  },
};
```

**Notes**:
- Add `rag: process.env.MOCK_RAG !== 'false'` to `useMocks` object
- Add three new sections: `rag`, `voyage`, `mongodb` at the end
- Don't modify teammates' sections (`orchestrator`, `x402`, `cdp`)

### 3. Mock Implementation

**File**: `src/services/rag/mock.ts`

```typescript
import type { IRAGService } from '../../types/services.js';
import type { Issue } from '../../types/index.js';
import type { CodeChunk } from '../../types/services.js';

export class MockRAGService implements IRAGService {
  private indexedRepos = new Map<string, string>(); // repoUrl -> commitId

  async indexRepo(repoPath: string, repoUrl: string): Promise<{ commitId: string; chunksIndexed: number }> {
    console.log(`[MockRAG] Indexing repo at ${repoPath}`);
    console.log(`[MockRAG] Repo URL: ${repoUrl}`);

    // Simulate indexing delay
    await this.delay(1000);

    const mockCommitId = 'abc123mock';
    const mockChunkCount = Math.floor(Math.random() * 50) + 20; // 20-70 chunks

    this.indexedRepos.set(repoUrl, mockCommitId);

    console.log(`[MockRAG] Indexed ${mockChunkCount} chunks (commit: ${mockCommitId})`);
    return { commitId: mockCommitId, chunksIndexed: mockChunkCount };
  }

  async queryRelevantCode(issue: Issue, limit = 10): Promise<CodeChunk[]> {
    console.log(`[MockRAG] Querying relevant code for issue #${issue.number}`);
    console.log(`[MockRAG] Issue title: ${issue.title}`);

    // Simulate query delay
    await this.delay(500);

    // Generate mock chunks
    const chunks: CodeChunk[] = [];
    const chunkCount = Math.min(limit, 5); // Return 5 mock chunks max

    for (let i = 0; i < chunkCount; i++) {
      chunks.push({
        filePath: `src/auth/user-service.ts`,
        chunkType: i % 2 === 0 ? 'function' : 'class',
        chunkName: i % 2 === 0 ? `handleLogin` : `UserService`,
        code: `// Mock code chunk ${i + 1}\nfunction example() {\n  return true;\n}`,
        score: 0.9 - i * 0.1, // Decreasing relevance scores
      });
    }

    console.log(`[MockRAG] Found ${chunks.length} relevant chunks`);
    return chunks;
  }

  async isRepoIndexed(repoUrl: string, commitId: string): Promise<boolean> {
    const indexed = this.indexedRepos.get(repoUrl) === commitId;
    console.log(`[MockRAG] Checking if ${repoUrl}@${commitId} is indexed: ${indexed}`);
    return indexed;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 4. Real Implementation

**File**: `src/services/rag/real.ts`

**Key Components**:

#### A. Dependencies
```typescript
import { MongoClient } from 'mongodb';
import { VoyageAIClient } from 'voyageai';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { config } from '../../config.js';
```

#### B. Constructor
```typescript
export class RealRAGService implements IRAGService {
  private mongoClient: MongoClient;
  private voyageClient: VoyageAIClient;
  private db: any;
  private chunksCollection: any;

  constructor() {
    // Build MongoDB URI with user/pass if provided
    let mongoUri = config.mongodb.uri;
    if (!mongoUri && config.mongodb.user && config.mongodb.pass) {
      mongoUri = `mongodb+srv://${config.mongodb.user}:${config.mongodb.pass}@cluster.mongodb.net/`;
    }

    if (!mongoUri) {
      throw new Error('MongoDB URI or credentials not configured');
    }

    this.mongoClient = new MongoClient(mongoUri);
    this.voyageClient = new VoyageAIClient({ apiKey: config.voyage.apiKey });
  }

  async connect() {
    await this.mongoClient.connect();
    this.db = this.mongoClient.db(config.mongodb.dbName);
    this.chunksCollection = this.db.collection(config.mongodb.collections.chunks);
    console.log('[RealRAG] Connected to MongoDB Atlas');
  }
}
```

#### C. indexRepo Implementation
```typescript
async indexRepo(repoPath: string, repoUrl: string): Promise<{ commitId: string; chunksIndexed: number }> {
  await this.connect();

  // Get commit SHA
  const commitId = this.getCommitSHA(repoPath);
  console.log(`[RealRAG] Indexing ${repoUrl} (commit: ${commitId})`);

  // Check if already indexed
  const alreadyIndexed = await this.isRepoIndexed(repoUrl, commitId);
  if (alreadyIndexed) {
    const count = await this.chunksCollection.countDocuments({ repoUrl, commitId });
    console.log(`[RealRAG] Repo already indexed (${count} chunks found)`);
    return { commitId, chunksIndexed: count };
  }

  // Find all .ts, .tsx, .js, .jsx files
  const files = this.findSourceFiles(repoPath);
  console.log(`[RealRAG] Found ${files.length} source files`);

  // Parse and chunk
  const allChunks = [];
  for (const file of files) {
    const chunks = this.parseFile(file, repoPath);
    allChunks.push(...chunks);
  }
  console.log(`[RealRAG] Extracted ${allChunks.length} code chunks`);

  // Generate embeddings in batches (Voyage API has batch limits)
  const batchSize = 128; // Voyage supports up to 128 texts per request
  const documents = [];

  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    const texts = batch.map(c => c.code);

    console.log(`[RealRAG] Embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allChunks.length / batchSize)}`);
    const response = await this.voyageClient.embed({
      input: texts,
      model: config.voyage.model,
    });

    // Combine chunks with embeddings
    for (let j = 0; j < batch.length; j++) {
      documents.push({
        repoUrl,
        commitId,
        filePath: batch[j].filePath,
        chunkType: batch[j].chunkType,
        chunkName: batch[j].chunkName,
        code: batch[j].code,
        embedding: response.data[j].embedding,
        indexedAt: new Date(),
      });
    }
  }

  // Insert into MongoDB
  if (documents.length > 0) {
    await this.chunksCollection.insertMany(documents);
    console.log(`[RealRAG] Indexed ${documents.length} chunks to MongoDB Atlas`);
  }

  return { commitId, chunksIndexed: documents.length };
}

private getCommitSHA(repoPath: string): string {
  try {
    const sha = execSync('git rev-parse HEAD', { cwd: repoPath, encoding: 'utf-8' });
    return sha.trim();
  } catch (error) {
    throw new Error(`Failed to get commit SHA: ${error}`);
  }
}

private findSourceFiles(repoPath: string): string[] {
  const files: string[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];

  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip node_modules, .git, dist, build, etc.
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(entry.name)) {
          walk(fullPath);
        }
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  };

  walk(repoPath);
  return files;
}

private parseFile(filePath: string, repoPath: string): Array<{ filePath: string; chunkType: string; chunkName: string; code: string }> {
  const chunks = [];
  const code = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(repoPath, filePath);

  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    traverse(ast, {
      FunctionDeclaration(path) {
        if (path.node.id) {
          chunks.push({
            filePath: relativePath,
            chunkType: 'function',
            chunkName: path.node.id.name,
            code: code.slice(path.node.start, path.node.end),
          });
        }
      },
      ClassDeclaration(path) {
        if (path.node.id) {
          chunks.push({
            filePath: relativePath,
            chunkType: 'class',
            chunkName: path.node.id.name,
            code: code.slice(path.node.start, path.node.end),
          });
        }
      },
      ClassMethod(path) {
        if (path.node.key.type === 'Identifier') {
          chunks.push({
            filePath: relativePath,
            chunkType: 'method',
            chunkName: path.node.key.name,
            code: code.slice(path.node.start, path.node.end),
          });
        }
      },
    });
  } catch (error) {
    console.warn(`[RealRAG] Failed to parse ${filePath}: ${error.message}`);
  }

  return chunks;
}
```

#### D. queryRelevantCode Implementation
```typescript
async queryRelevantCode(issue: Issue, limit = 10): Promise<CodeChunk[]> {
  await this.connect();

  // Create query text from issue
  const queryText = `${issue.title}\n\n${issue.body}`;
  console.log(`[RealRAG] Querying for issue: ${issue.title.slice(0, 50)}...`);

  // Generate query embedding
  const response = await this.voyageClient.embed({
    input: [queryText],
    model: config.voyage.model,
  });
  const queryEmbedding = response.data[0].embedding;

  // Vector search in MongoDB Atlas
  const pipeline = [
    {
      $vectorSearch: {
        index: 'vector_index', // Name of the Atlas Vector Search index
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: limit,
        filter: {
          repoUrl: issue.repoUrl, // Only search within the issue's repo
        },
      },
    },
    {
      $project: {
        _id: 0,
        filePath: 1,
        chunkType: 1,
        chunkName: 1,
        code: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ];

  const results = await this.chunksCollection.aggregate(pipeline).toArray();
  console.log(`[RealRAG] Found ${results.length} relevant chunks`);

  return results;
}

async isRepoIndexed(repoUrl: string, commitId: string): Promise<boolean> {
  await this.connect();
  const count = await this.chunksCollection.countDocuments({ repoUrl, commitId });
  return count > 0;
}
```

### 5. MongoDB Atlas Setup

**Vector Search Index Configuration**:

1. Navigate to your collection in Atlas UI: `codebounty.code_chunks`
2. Click **Search** tab → **Create Search Index**
3. Select **JSON Editor** → **Next**
4. Index name: `vector_index`
5. Use this JSON:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "repoUrl"
    },
    {
      "type": "filter",
      "path": "commitId"
    }
  ]
}
```

**Compound Index** (for cache checks):

In Atlas UI, go to **Indexes** tab and create:
```json
{
  "repoUrl": 1,
  "commitId": 1,
  "filePath": 1
}
```

### 6. Service Factory

**File**: `src/services/index.ts`

Add imports:
```typescript
import { MockRAGService } from './rag/mock.js';
import { RealRAGService } from './rag/real.js';
```

Update `createServices()`:
```typescript
export function createServices(): Services {
  const { useMocks } = config;

  // ... existing services ...

  const rag = useMocks.rag
    ? new MockRAGService()
    : new RealRAGService();

  console.log('[Services] Initialized with:');
  console.log(`  - GitHub: ${useMocks.github ? 'MOCK' : 'REAL'}`);
  console.log(`  - LLM: ${useMocks.llm ? 'MOCK' : 'REAL'}`);
  console.log(`  - State: ${useMocks.state ? 'MOCK' : 'REAL'}`);
  console.log(`  - Payment: ${useMocks.payment ? 'MOCK' : 'REAL'}`);
  console.log(`  - Agents: ${useMocks.agents ? 'MOCK' : 'REAL'}`);
  console.log(`  - RAG: ${useMocks.rag ? 'MOCK' : 'REAL'}`);

  return {
    github,
    llm,
    state,
    payment,
    agentClient,
    rag, // NEW
  };
}
```

Update `Services` type in `src/types/services.ts`:
```typescript
export interface Services {
  github: IGitHubService;
  llm: ILLMService;
  state: IStateStore;
  payment: IPaymentService;
  agentClient: IAgentClient;
  rag: IRAGService; // NEW
}
```

### 7. Orchestrator Integration

**File**: `src/orchestrator/orchestrator.ts`

Update `startCompetition()`:

```typescript
async startCompetition(repoUrl: string, issueNumber: number, bountyAmount: number): Promise<Competition> {
  console.log(`[Orchestrator] Starting competition for ${repoUrl}#${issueNumber}`);

  // 1. Authenticate with GitHub
  const isAuth = await this.services.github.isAuthenticated();
  if (!isAuth) {
    throw new Error('Not authenticated with GitHub');
  }

  // 2. Fetch the issue
  const issue = await this.services.github.getIssue(repoUrl, issueNumber);
  console.log(`[Orchestrator] Issue fetched: "${issue.title}"`);

  // 3. NEW: Index the repository
  const currentDir = process.cwd();
  console.log(`[Orchestrator] Indexing repository at ${currentDir}`);

  const { commitId, chunksIndexed } = await this.services.rag.indexRepo(currentDir, repoUrl);
  console.log(`[Orchestrator] Repository indexed: ${chunksIndexed} chunks (commit: ${commitId})`);

  // 4. Create competition
  const competition: Competition = {
    id: nanoid(),
    issue,
    bountyAmount,
    status: 'pending',
    agents: config.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      status: 'idle',
    })),
    createdAt: Date.now(),
  };

  await this.services.state.saveCompetition(competition);
  console.log(`[Orchestrator] Competition created: ${competition.id}`);

  // 5. NEW: Query relevant code context
  console.log(`[Orchestrator] Querying relevant code for issue...`);
  const relevantChunks = await this.services.rag.queryRelevantCode(issue, config.rag.chunkLimit);

  const codeContext = this.formatCodeContext(relevantChunks);
  console.log(`[Orchestrator] Retrieved ${relevantChunks.length} relevant code chunks`);

  // 6. Update status to running
  await this.services.state.updateCompetition(competition.id, { status: 'running' });
  competition.status = 'running';

  // 7. Run all agents in parallel (with enriched context)
  await this.runAgents(competition, codeContext);

  // 8. Pick winner and pay them
  // ... rest of existing logic ...

  return competition;
}

/**
 * Format code chunks into context string for agents
 */
private formatCodeContext(chunks: CodeChunk[]): string {
  if (chunks.length === 0) {
    return 'No relevant code context found.';
  }

  let context = '# Relevant Code Context\n\n';
  context += `Found ${chunks.length} relevant code sections:\n\n`;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    context += `## ${i + 1}. ${chunk.chunkName} (${chunk.chunkType})\n`;
    context += `**File**: ${chunk.filePath}\n`;
    if (chunk.score) {
      context += `**Relevance**: ${(chunk.score * 100).toFixed(1)}%\n`;
    }
    context += `\`\`\`typescript\n${chunk.code}\n\`\`\`\n\n`;
  }

  return context;
}

/**
 * Run all agents in parallel
 */
private async runAgents(competition: Competition, codeContext: string): Promise<void> {
  const tasks = competition.agents.map(async (agent) => {
    const agentConfig = config.agents.find((a) => a.id === agent.id)!;
    const agentUrl = `http://localhost:${agentConfig.port}`;

    const task: SolveTask = {
      agentId: agent.id,
      issue: competition.issue,
      codeContext, // NEW: Include RAG context
    };

    // ... rest of existing agent execution logic ...
  });

  await Promise.all(tasks);
}
```

### 8. Environment Variables

**File**: `.env.example`

```bash
# Service toggles (all default to mock=true)
MOCK_GITHUB=true
MOCK_LLM=true
MOCK_STATE=true
MOCK_PAYMENT=true
MOCK_AGENTS=true
MOCK_RAG=true

# RAG Configuration
INDEX_MODE=ast
RAG_CHUNK_LIMIT=10

# MongoDB Atlas (choose one method)
# Method 1: Full URI
MONGODB_URI=mongodb+srv://cluster.mongodb.net/codebounty

# Method 2: User/Pass (will build URI automatically) - see tmp-env.md
MONGO_ATLAS_USER=<get-from-teammates>
MONGO_ATLAS_PASS=<get-from-teammates>

# Voyage AI - see tmp-env.md for setup instructions
VOYAGE_API_KEY=<get-from-voyageai.com>

# Real service credentials (only needed when mocks disabled)
FIREWORKS_API_KEY=<teammates-handle-this>
ORCHESTRATOR_PRIVATE_KEY=<teammates-handle-this>
AGENT_LLAMA_WALLET=<teammates-handle-this>
AGENT_QWEN_WALLET=<teammates-handle-this>
AGENT_DEEPSEEK_WALLET=<teammates-handle-this>
```

> **📝 Note**: See [`todos/tmp-env.md`](./tmp-env.md) for actual credentials and detailed setup instructions.

**File**: `.env` (your existing file)

Your `.env` has been updated with:
```bash
MOCK_RAG=true
INDEX_MODE=ast
RAG_CHUNK_LIMIT=10
```

**Next Steps**:
1. Get `MONGODB_URI` from teammates (already configured)
2. Sign up for Voyage AI and add `VOYAGE_API_KEY` to `.env`
3. See [`todos/tmp-env.md`](./tmp-env.md) for detailed setup
```

### 9. Dependencies

**File**: `package.json`

**IMPORTANT**: Teammates already added `mongodb@7.0.0`. Only add these new dependencies:

```json
{
  "dependencies": {
    "voyageai": "^0.0.3",
    "@babel/parser": "^7.23.0",
    "@babel/traverse": "^7.23.0",
    "@babel/types": "^7.23.0"
  },
  "devDependencies": {
    "@types/babel__traverse": "^7.20.4"
  }
}
```

Run:
```bash
npm install voyageai @babel/parser @babel/traverse @babel/types
npm install -D @types/babel__traverse

# or with bun:
bun add voyageai @babel/parser @babel/traverse @babel/types
bun add -D @types/babel__traverse
```

**Note**: `mongodb` is already installed by teammates (v7.0.0). Don't reinstall it.

---

## Testing Plan

### Phase 1: Mock Testing
```bash
# Ensure MOCK_RAG=true in .env
npm run dev:tui

# Expected behavior:
# 1. Start competition
# 2. Mock indexing logs appear (1s delay)
# 3. Mock query logs appear (500ms delay)
# 4. Agents receive fake code context
# 5. Competition completes normally
```

### Phase 2: Real Integration Testing

**Step 1**: Set up MongoDB Atlas Vector Search Index (see section 5 above)

**Step 2**: Get Voyage AI API Key
- Sign up at https://www.voyageai.com/
- Get API key from dashboard
- Add to `.env`: `VOYAGE_API_KEY=pa-xxx`

**Step 3**: Test indexing
```bash
# Update .env
MOCK_RAG=false
VOYAGE_API_KEY=<your-key>

# Run from a small test repo
cd /path/to/small-test-repo
npm run dev:tui

# Monitor logs for:
# - "[RealRAG] Connected to MongoDB Atlas"
# - "[RealRAG] Found X source files"
# - "[RealRAG] Extracted Y code chunks"
# - "[RealRAG] Embedding batch 1/N"
# - "[RealRAG] Indexed Y chunks to MongoDB Atlas"
```

**Step 4**: Verify in MongoDB Atlas
- Check collection `codebounty.code_chunks`
- Should see documents with `embedding` arrays
- Check `repoUrl`, `commitId`, `filePath` fields

**Step 5**: Test querying
- Start another competition on same repo
- Should see: "[RealRAG] Repo already indexed (X chunks found)"
- Query logs: "[RealRAG] Found Y relevant chunks"
- Agents should receive formatted code context

### Phase 3: Edge Cases

Test:
- Empty repo (no .ts/.js files) → Should index 0 chunks, graceful handling
- Parse errors in files → Should log warning, continue with other files
- Very large repo (1000+ files) → Monitor performance, consider adding file limit
- No Voyage API key → Should fail with clear error message
- MongoDB connection failure → Should fail with clear error message

---

## Collaboration & Merge Strategy

### Files You'll Modify
- `src/types/services.ts` - Add `IRAGService`, update `Services`
- `src/types/index.ts` - Update `SolveTask`
- `src/config.ts` - Add RAG, Voyage, MongoDB config
- `src/services/index.ts` - Add RAG service to factory
- `src/orchestrator/orchestrator.ts` - Add indexing + querying logic
- `.env.example` - Add new env vars
- `package.json` - Add dependencies

### Files You'll Create
- `src/services/rag/mock.ts`
- `src/services/rag/real.ts`

### Minimizing Merge Conflicts

1. **Coordinate on `src/services/index.ts`**:
   - Teammates may also modify this file (adding their services)
   - Solution: Add RAG service last, communicate before merging

2. **Coordinate on `src/config.ts`**:
   - Teammates may add Fireworks/X402 config
   - Solution: Add sections with clear comments (`// RAG configuration`)

3. **Orchestrator changes**:
   - You're adding indexing + querying logic
   - Teammates may modify payment logic
   - Solution: Work in different sections, test with mocks first

4. **Safe merge order**:
   ```bash
   # 1. Pull latest from main
   git pull origin main

   # 2. Create feature branch
   git checkout -b feat/rag-mongodb-atlas

   # 3. Implement with MOCK_RAG=true
   # 4. Test end-to-end with mocks
   # 5. Commit

   # 6. Before final merge, pull again and resolve conflicts
   git pull origin main
   # Resolve any conflicts in config.ts, services/index.ts

   # 7. Test again with mocks
   # 8. Merge to main
   ```

### Communication Checkpoints

Before merging, confirm with teammates:
- ✅ "I'm adding `rag` to the Services type and factory - does this conflict with your changes?"
- ✅ "I'm modifying orchestrator.startCompetition() to add indexing before agent execution - does this affect your flow?"
- ✅ "I'm updating SolveTask to include codeContext - agents will ignore it if not needed"

---

## Timeline Estimate

| Task | Time | Priority |
|------|------|----------|
| Setup types & interfaces | 15 min | Critical |
| Update config | 10 min | Critical |
| Mock RAG service | 15 min | Critical |
| Service factory integration | 10 min | Critical |
| Orchestrator integration | 30 min | Critical |
| **Test with mocks** | 20 min | Critical |
| Real RAG: AST chunking | 45 min | Critical |
| Real RAG: Voyage integration | 30 min | Critical |
| Real RAG: MongoDB vector search | 30 min | Critical |
| MongoDB Atlas index setup | 15 min | Critical |
| **Test with real services** | 30 min | Critical |
| Edge case handling | 20 min | Medium |
| Code cleanup & comments | 15 min | Low |
| **Total** | **~4.5h** | |

**Hackathon strategy**: Aim for 3h core implementation, 1h buffer for debugging. (update it: we need it much faster, you're claude code!)

---

## Future Enhancements (TODOs)

### File-Level Chunks
```typescript
// When indexing, also store full files:
{
  repoUrl,
  commitId,
  filePath,
  chunkType: 'file',  // Special type
  chunkName: path.basename(filePath),
  code: '<full file contents>',
  embedding: null,    // No embedding needed
}

// When querying, can fetch full file:
const fullFile = await chunksCollection.findOne({
  repoUrl: issue.repoUrl,
  commitId,
  filePath: 'src/auth/login.ts',
  chunkType: 'file',
});
```

### FileReader Fallback Mode
```typescript
// If AST parsing fails:
if (config.rag.indexMode === 'filereader' || astParseFailed) {
  // Simple chunking by line count (e.g., 50 lines per chunk)
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i += 50) {
    chunks.push({
      filePath: relativePath,
      chunkType: 'file-section',
      chunkName: `${relativePath}:${i}-${i + 50}`,
      code: lines.slice(i, i + 50).join('\n'),
    });
  }
}
```

### Multi-Language Support
- Python: Use `ast` module (similar to lucian-rag example)
- Go: Use `go/parser` package
- Java: Use JavaParser library

### Smart Context Retrieval
- Retrieve not just top-K chunks, but also their imports/dependencies
- Build a call graph to include related functions
- Detect and include test files for reference

---

## Troubleshooting

### "MongoDB connection failed"
- Check `MONGODB_URI` in `.env` (get from teammates or see `tmp-env.md`)
- Verify IP whitelist in Atlas (allow your IP or `0.0.0.0/0` for testing)
- Check network connectivity

### "Voyage API key invalid"
- Verify `VOYAGE_API_KEY` in `.env`
- Check API key hasn't expired
- Verify you have credits/quota

### "Vector search returns no results"
- Ensure Vector Search Index exists in Atlas (index name: `vector_index`)
- Check index is in "Active" state (takes a few minutes to build)
- Verify `numDimensions: 1536` matches `voyage-code-2` output
- Check `filter: { repoUrl }` matches your data

### "AST parsing fails on all files"
- Check Babel plugins: `['typescript', 'jsx']`
- Try parsing a simple file first to isolate issue
- Check file encoding (should be UTF-8)

### "Out of memory during indexing"
- Reduce batch size (default: 128 → try 64)
- Add file limit (e.g., max 500 files)
- Skip large files (e.g., > 10KB per file)

### "Agents don't receive context"
- Check `SolveTask.codeContext` is being set in orchestrator
- Verify `formatCodeContext()` returns non-empty string
- Check agent server logs to see if context is received

---

## Success Criteria

### Must Have (MVP)
- ✅ Indexing works with local repo (AST chunking)
- ✅ Voyage AI embeddings generated
- ✅ Chunks stored in MongoDB Atlas
- ✅ Vector search returns relevant results
- ✅ Agents receive code context in SolveTask
- ✅ Mock mode works end-to-end
- ✅ Commit-aware caching prevents re-indexing

### Nice to Have
- ✅ Formatted context looks good in TUI logs
- ✅ Relevance scores displayed
- ✅ Graceful error handling
- ✅ Performance logging (indexing time, query time)

### Demo-Ready
- ✅ Can demo indexing a real repo
- ✅ Can show MongoDB Atlas collection with embeddings
- ✅ Can show vector search results matching issue
- ✅ Can explain how agents use context

---

## Quick Start Checklist

1. ☐ Create types & interfaces
2. ☐ Update config with RAG/Voyage/MongoDB settings
3. ☐ Implement MockRAGService
4. ☐ Update service factory
5. ☐ Integrate into Orchestrator
6. ☐ Test with MOCK_RAG=true
7. ☐ Implement RealRAGService (AST chunking)
8. ☐ Implement RealRAGService (Voyage embeddings)
9. ☐ Implement RealRAGService (MongoDB storage + search)
10. ☐ Create MongoDB Atlas Vector Search Index
11. ☐ Get Voyage API key
12. ☐ Test with MOCK_RAG=false
13. ☐ Verify in MongoDB Atlas UI
14. ☐ Test end-to-end competition flow
15. ☐ Merge with teammates' code
16. ☐ Final integration test

---

## Notes

- This plan assumes teammates handle X402 payment flow and Fireworks AI LLM integration
- RAG service is independent - can be developed/tested in isolation with mocks
- Orchestrator is the only shared integration point - coordinate before modifying
- MongoDB Atlas Vector Search is critical - ensure index is created correctly
- Voyage AI `voyage-code-2` model is specifically designed for code embeddings
- Commit SHA provides natural caching mechanism - no custom cache invalidation needed
