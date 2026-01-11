import type { IRAGService, CodeChunk, RAGProgressCallback } from '../../types/services.js';
import type { Issue } from '../../types/index.js';

/**
 * Mock RAG service for development and testing
 * Simulates code indexing and retrieval with progress streaming
 */
export class MockRAGService implements IRAGService {
  private indexedRepos = new Map<string, { commitId: string; chunks: number }>(); // repoUrl -> index info

  async indexRepo(
    repoPath: string,
    repoUrl: string,
    onProgress?: RAGProgressCallback
  ): Promise<{ commitId: string; chunksIndexed: number }> {
    console.log(`[MockRAG] Indexing repo at ${repoPath}`);

    const mockCommitId = 'abc123mock';
    const mockFileCount = Math.floor(Math.random() * 30) + 15; // 15-45 files
    const mockChunkCount = Math.floor(Math.random() * 50) + 30; // 30-80 chunks

    // Stage 1: Scanning
    onProgress?.('scanning', `Scanning repository ${repoUrl}...`);
    await this.delay(400);
    onProgress?.('scanning', `Found ${mockFileCount} source files (.ts, .tsx, .js, .jsx)`);
    await this.delay(300);

    // Stage 2: Parsing
    onProgress?.('parsing', `Parsing source files with AST analyzer...`);
    for (let i = 0; i < mockFileCount; i += Math.ceil(mockFileCount / 6)) {
      await this.delay(150);
      const current = Math.min(i + Math.ceil(mockFileCount / 6), mockFileCount);
      onProgress?.('parsing', `Extracting functions, classes, and methods...`, current, mockFileCount);
    }
    await this.delay(200);
    onProgress?.('parsing', `Extracted ${mockChunkCount} code chunks (functions, classes, methods)`);
    await this.delay(300);

    // Stage 3: Embedding
    const batchCount = Math.ceil(mockChunkCount / 20);
    onProgress?.('embedding', `Generating vector embeddings for ${mockChunkCount} code chunks...`);
    await this.delay(200);

    for (let i = 0; i < batchCount; i++) {
      await this.delay(250);
      onProgress?.('embedding', `Processing batch ${i + 1}/${batchCount} with Voyage AI...`, i + 1, batchCount);
    }
    await this.delay(200);
    onProgress?.('embedding', `Stored ${mockChunkCount} embeddings in vector database`);
    await this.delay(200);

    this.indexedRepos.set(repoUrl, { commitId: mockCommitId, chunks: mockChunkCount });

    console.log(`[MockRAG] Indexed ${mockChunkCount} chunks (commit: ${mockCommitId})`);
    return { commitId: mockCommitId, chunksIndexed: mockChunkCount };
  }

  async queryRelevantCode(
    issue: Issue,
    limit = 10,
    onProgress?: RAGProgressCallback
  ): Promise<CodeChunk[]> {
    console.log(`[MockRAG] Querying relevant code for issue #${issue.number}`);

    // Check if repo is indexed, if not simulate indexing first
    const repoUrl = issue.repoUrl;
    if (!this.indexedRepos.has(repoUrl)) {
      console.log(`[MockRAG] Repo not indexed, indexing first...`);
      await this.indexRepo('.', repoUrl, onProgress);
    }

    // Stage: Querying
    onProgress?.('querying', `Searching for code relevant to: "${issue.title.slice(0, 50)}..."`);
    await this.delay(300);
    onProgress?.('querying', `Generating query embedding from issue description...`);
    await this.delay(400);
    onProgress?.('querying', `Running vector similarity search in MongoDB Atlas...`);
    await this.delay(350);

    // Generate mock chunks
    const chunks: CodeChunk[] = [];
    const chunkCount = Math.min(limit, 5); // Return 5 mock chunks max

    for (let i = 0; i < chunkCount; i++) {
      chunks.push({
        filePath: `src/services/${['user', 'auth', 'api', 'utils', 'db'][i % 5]}.ts`,
        chunkType: i % 3 === 0 ? 'function' : i % 3 === 1 ? 'class' : 'method',
        chunkName: ['handleLogin', 'UserService', 'authenticate', 'validateInput', 'processRequest'][i % 5],
        code: `// Relevant code chunk ${i + 1}
export ${i % 2 === 0 ? 'function' : 'class'} ${['handleLogin', 'UserService', 'authenticate', 'validateInput', 'processRequest'][i % 5]}${i % 2 === 1 ? '' : '()'}${i % 2 === 1 ? ' {' : ' {'}
  // This code is relevant to: ${issue.title.slice(0, 30)}
  ${i % 2 === 0 ? `const result = processInput();
  if (!result) {
    throw new Error('Invalid input');
  }
  return result;` : `private data: any;

  constructor() {
    this.data = {};
  }

  process() {
    return this.data;
  }`}
}`,
        score: 0.95 - i * 0.08, // Decreasing relevance scores
      });
    }

    onProgress?.('querying', `Found ${chunks.length} relevant code chunks (scores: ${chunks.map(c => c.score?.toFixed(2)).join(', ')})`);
    console.log(`[MockRAG] Found ${chunks.length} relevant chunks`);
    return chunks;
  }

  async isRepoIndexed(repoUrl: string, commitId: string): Promise<boolean> {
    const indexed = this.indexedRepos.get(repoUrl)?.commitId === commitId;
    console.log(`[MockRAG] Checking if ${repoUrl}@${commitId} is indexed: ${indexed}`);
    return indexed;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
