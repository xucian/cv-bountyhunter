import type { IRAGService, CodeChunk } from '../../types/services.js';
import type { Issue } from '../../types/index.js';

/**
 * Mock RAG service for development and testing
 * Simulates code indexing and retrieval without external dependencies
 */
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
        filePath: `src/services/user-${i}.ts`,
        chunkType: i % 3 === 0 ? 'function' : i % 3 === 1 ? 'class' : 'method',
        chunkName: i % 3 === 0 ? `handleLogin${i}` : i % 3 === 1 ? `UserService${i}` : `authenticate${i}`,
        code: `// Mock code chunk ${i + 1}\nfunction example${i}() {\n  // Relevant to: ${issue.title.slice(0, 30)}\n  return true;\n}`,
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
