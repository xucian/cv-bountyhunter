import type { IRAGService, CodeChunk, RAGProgressCallback } from '../../types/services.js';
import type { Issue } from '../../types/index.js';

/**
 * Mock RAG service for development and testing
 * Simulates code indexing and retrieval with progress streaming
 */
export class MockRAGService implements IRAGService {
  private indexedRepos = new Map<string, string>(); // repoUrl -> commitId

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
    await this.delay(300);
    onProgress?.('scanning', `Found ${mockFileCount} source files (.ts, .tsx, .js, .jsx)`);
    await this.delay(200);

    // Stage 2: Parsing
    onProgress?.('parsing', `Parsing source files...`);
    for (let i = 0; i < mockFileCount; i += Math.ceil(mockFileCount / 5)) {
      await this.delay(100);
      onProgress?.('parsing', `Parsing files...`, Math.min(i + Math.ceil(mockFileCount / 5), mockFileCount), mockFileCount);
    }
    onProgress?.('parsing', `Extracted ${mockChunkCount} code chunks (functions, classes, methods)`);
    await this.delay(200);

    // Stage 3: Embedding
    const batchCount = Math.ceil(mockChunkCount / 20);
    onProgress?.('embedding', `Generating embeddings for ${mockChunkCount} chunks...`);
    for (let i = 0; i < batchCount; i++) {
      await this.delay(150);
      onProgress?.('embedding', `Embedding batch ${i + 1}/${batchCount}...`, i + 1, batchCount);
    }
    onProgress?.('embedding', `Embeddings complete. Stored in vector database.`);
    await this.delay(200);

    this.indexedRepos.set(repoUrl, mockCommitId);

    console.log(`[MockRAG] Indexed ${mockChunkCount} chunks (commit: ${mockCommitId})`);
    return { commitId: mockCommitId, chunksIndexed: mockChunkCount };
  }

  async queryRelevantCode(
    issue: Issue,
    limit = 10,
    onProgress?: RAGProgressCallback
  ): Promise<CodeChunk[]> {
    console.log(`[MockRAG] Querying relevant code for issue #${issue.number}`);

    // Stage: Querying
    onProgress?.('querying', `Searching for code relevant to: "${issue.title.slice(0, 50)}..."`);
    await this.delay(200);
    onProgress?.('querying', `Generating query embedding...`);
    await this.delay(300);
    onProgress?.('querying', `Running vector similarity search...`);
    await this.delay(200);

    // Generate mock chunks
    const chunks: CodeChunk[] = [];
    const chunkCount = Math.min(limit, 5); // Return 5 mock chunks max

    for (let i = 0; i < chunkCount; i++) {
      chunks.push({
        filePath: `src/services/user-${i}.ts`,
        chunkType: i % 3 === 0 ? 'function' : i % 3 === 1 ? 'class' : 'method',
        chunkName: i % 3 === 0 ? `handleLogin${i}` : i % 3 === 1 ? `UserService${i}` : `authenticate${i}`,
        code: `// Relevant code chunk ${i + 1}
function example${i}() {
  // This code is relevant to: ${issue.title.slice(0, 30)}
  const result = processInput();
  if (!result) {
    throw new Error('Invalid input');
  }
  return result;
}`,
        score: 0.95 - i * 0.08, // Decreasing relevance scores
      });
    }

    onProgress?.('querying', `Found ${chunks.length} relevant code chunks`);
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
