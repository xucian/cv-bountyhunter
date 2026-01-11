import { Collection, Db } from 'mongodb';
import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { config } from '../../config.js';
import { SharedMongoClient } from '../mongodb-client.js';
import type { IRAGService, CodeChunk, RAGProgressCallback } from '../../types/services.js';
import type { Issue } from '../../types/index.js';

// Handle @babel/traverse ESM/CJS compatibility
const traverse = (_traverse as any).default || _traverse;

/**
 * Voyage AI Client (simple wrapper since voyageai package may not have types)
 */
class VoyageAIClient {
  private apiKey: string;
  private baseUrl = 'https://api.voyageai.com/v1';

  constructor(options: { apiKey: string }) {
    this.apiKey = options.apiKey;
  }

  async embed(options: { input: string[]; model: string }): Promise<{ data: Array<{ embedding: number[] }> }> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: options.input,
        model: options.model,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Voyage AI API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }
}

/**
 * MongoDB document structure for code chunks
 */
interface CodeChunkDocument {
  repoUrl: string;
  commitId: string;
  filePath: string;
  chunkType: 'function' | 'class' | 'method';
  chunkName: string;
  code: string;
  embedding: number[];
  indexedAt: Date;
}

/**
 * Real RAG service using Voyage AI and MongoDB Atlas
 * Implements AST-based code chunking and vector search
 */
export class RealRAGService implements IRAGService {
  private voyageClient: VoyageAIClient;
  private db: Db | null = null;
  private chunksCollection: Collection<CodeChunkDocument> | null = null;
  private connected = false;

  constructor() {
    if (!config.voyage.apiKey) {
      throw new Error('VOYAGE_API_KEY not configured');
    }

    if (!config.mongodb.uri) {
      throw new Error('MONGODB_URI not configured');
    }

    this.voyageClient = new VoyageAIClient({ apiKey: config.voyage.apiKey });
  }

  /**
   * Connect to MongoDB Atlas using shared client
   */
  private async connect(): Promise<void> {
    if (this.connected && this.db && this.chunksCollection) {
      return;
    }

    try {
      const { db } = await SharedMongoClient.getClient();
      this.db = db;
      this.chunksCollection = this.db.collection<CodeChunkDocument>(config.mongodb.collections.chunks);
      this.connected = true;
      console.log('[RealRAG] ✓ Connected to MongoDB');
    } catch (error) {
      console.error('[RealRAG] ✗ Failed to connect:', error);
      throw error;
    }
  }

  /**
   * Index a repository into MongoDB Atlas
   */
  async indexRepo(
    repoPath: string,
    repoUrl: string,
    onProgress?: RAGProgressCallback
  ): Promise<{ commitId: string; chunksIndexed: number }> {
    await this.connect();

    // Get commit SHA
    const commitId = this.getCommitSHA(repoPath);
    console.log(`[RealRAG] Indexing ${repoUrl} (commit: ${commitId})`);
    onProgress?.('scanning', `Starting index for ${repoUrl} (commit: ${commitId.slice(0, 8)})`);

    // Check if already indexed
    const alreadyIndexed = await this.isRepoIndexed(repoUrl, commitId);
    if (alreadyIndexed) {
      const count = await this.chunksCollection!.countDocuments({ repoUrl, commitId });
      console.log(`[RealRAG] Repo already indexed (${count} chunks found)`);
      onProgress?.('scanning', `Repository already indexed (${count} chunks in database)`);
      return { commitId, chunksIndexed: count };
    }

    // Find all source files
    onProgress?.('scanning', `Scanning repository for source files...`);
    const files = this.findSourceFiles(repoPath);
    console.log(`[RealRAG] Found ${files.length} source files`);
    onProgress?.('scanning', `Found ${files.length} source files (.ts, .tsx, .js, .jsx)`);

    // Parse and chunk
    onProgress?.('parsing', `Parsing ${files.length} files with AST...`);
    const allChunks: Array<Omit<CodeChunkDocument, 'embedding' | 'indexedAt' | 'repoUrl' | 'commitId'>> = [];
    for (let i = 0; i < files.length; i++) {
      const chunks = this.parseFile(files[i], repoPath);
      allChunks.push(...chunks);
      if (i % 10 === 0 || i === files.length - 1) {
        onProgress?.('parsing', `Parsing files...`, i + 1, files.length);
      }
    }
    console.log(`[RealRAG] Extracted ${allChunks.length} code chunks`);
    onProgress?.('parsing', `Extracted ${allChunks.length} code chunks (functions, classes, methods)`);

    if (allChunks.length === 0) {
      console.log('[RealRAG] No chunks extracted, skipping embedding');
      onProgress?.('embedding', `No code chunks found to embed`);
      return { commitId, chunksIndexed: 0 };
    }

    // Generate embeddings in batches
    const batchSize = 128; // Voyage AI supports up to 128 texts per request
    const totalBatches = Math.ceil(allChunks.length / batchSize);
    const documents: CodeChunkDocument[] = [];

    onProgress?.('embedding', `Generating embeddings for ${allChunks.length} chunks...`);

    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batchNum = Math.floor(i / batchSize) + 1;
      const batch = allChunks.slice(i, i + batchSize);
      const texts = batch.map(c => c.code);

      console.log(`[RealRAG] Embedding batch ${batchNum}/${totalBatches}...`);
      onProgress?.('embedding', `Embedding batch ${batchNum}/${totalBatches}...`, batchNum, totalBatches);

      try {
        const response = await this.voyageClient.embed({
          input: texts,
          model: config.voyage.model,
        });

        // Combine chunks with embeddings
        for (let j = 0; j < batch.length; j++) {
          documents.push({
            repoUrl,
            commitId,
            ...batch[j],
            embedding: response.data[j].embedding,
            indexedAt: new Date(),
          });
        }
      } catch (error) {
        console.error(`[RealRAG] Failed to embed batch ${batchNum}:`, error);
        throw error;
      }
    }

    // Insert into MongoDB
    if (documents.length > 0) {
      onProgress?.('embedding', `Storing ${documents.length} chunks in vector database...`);
      await this.chunksCollection!.insertMany(documents);
      console.log(`[RealRAG] ✓ Indexed ${documents.length} chunks to MongoDB Atlas`);
      onProgress?.('embedding', `✓ Indexed ${documents.length} chunks to MongoDB Atlas`);
    }

    return { commitId, chunksIndexed: documents.length };
  }

  /**
   * Query relevant code chunks using vector search
   */
  async queryRelevantCode(
    issue: Issue,
    limit = 10,
    onProgress?: RAGProgressCallback
  ): Promise<CodeChunk[]> {
    await this.connect();

    // Create query text from issue
    const queryText = `${issue.title}\n\n${issue.body}`;
    console.log(`[RealRAG] Querying for issue: ${issue.title.slice(0, 50)}...`);
    onProgress?.('querying', `Searching for code relevant to: "${issue.title.slice(0, 50)}..."`);

    try {
      // Generate query embedding
      onProgress?.('querying', `Generating query embedding...`);
      const response = await this.voyageClient.embed({
        input: [queryText],
        model: config.voyage.model,
      });
      const queryEmbedding = response.data[0].embedding;

      // Vector search in MongoDB Atlas
      onProgress?.('querying', `Running vector similarity search...`);
      const pipeline = [
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: limit,
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

      const results = await this.chunksCollection!.aggregate(pipeline).toArray();
      console.log(`[RealRAG] Found ${results.length} relevant chunks`);
      onProgress?.('querying', `Found ${results.length} relevant code chunks`);

      return results as CodeChunk[];
    } catch (error) {
      console.warn('[RealRAG] Vector search failed, continuing without context:', error);
      onProgress?.('querying', `Vector search failed: ${error}`);
      return [];
    }
  }

  /**
   * Check if a repo is already indexed
   */
  async isRepoIndexed(repoUrl: string, commitId: string): Promise<boolean> {
    await this.connect();
    const count = await this.chunksCollection!.countDocuments({ repoUrl, commitId });
    return count > 0;
  }

  /**
   * Get git commit SHA from repository path
   */
  private getCommitSHA(repoPath: string): string {
    try {
      const sha = execSync('git rev-parse HEAD', { cwd: repoPath, encoding: 'utf-8' });
      return sha.trim();
    } catch (error) {
      throw new Error(`Failed to get commit SHA: ${error}`);
    }
  }

  /**
   * Find all source files in repository
   */
  private findSourceFiles(repoPath: string): string[] {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'out'];

    const walk = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
              walk(fullPath);
            }
          } else if (extensions.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.warn(`[RealRAG] Failed to read directory ${dir}:`, error);
      }
    };

    walk(repoPath);
    return files;
  }

  /**
   * Parse a file and extract code chunks using AST
   */
  private parseFile(
    filePath: string,
    repoPath: string
  ): Array<Omit<CodeChunkDocument, 'embedding' | 'indexedAt' | 'repoUrl' | 'commitId'>> {
    const chunks: Array<Omit<CodeChunkDocument, 'embedding' | 'indexedAt' | 'repoUrl' | 'commitId'>> = [];

    try {
      const code = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(repoPath, filePath);

      // Parse with Babel
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });

      // Traverse AST and extract chunks
      traverse(ast, {
        FunctionDeclaration(nodePath: any) {
          const node = nodePath.node;
          if (node.id && node.start !== null && node.end !== null) {
            chunks.push({
              filePath: relativePath,
              chunkType: 'function',
              chunkName: node.id.name,
              code: code.slice(node.start, node.end),
            });
          }
        },
        ClassDeclaration(nodePath: any) {
          const node = nodePath.node;
          if (node.id && node.start !== null && node.end !== null) {
            chunks.push({
              filePath: relativePath,
              chunkType: 'class',
              chunkName: node.id.name,
              code: code.slice(node.start, node.end),
            });
          }
        },
        ClassMethod(nodePath: any) {
          const node = nodePath.node;
          if (node.key.type === 'Identifier' && node.start !== null && node.end !== null) {
            chunks.push({
              filePath: relativePath,
              chunkType: 'method',
              chunkName: node.key.name,
              code: code.slice(node.start, node.end),
            });
          }
        },
      });
    } catch (error) {
      console.warn(`[RealRAG] Failed to parse ${filePath}:`, (error as Error).message);
    }

    return chunks;
  }

  /**
   * Close MongoDB connection (uses shared client, so just mark disconnected)
   */
  async close(): Promise<void> {
    this.connected = false;
    console.log('[RealRAG] Disconnected from MongoDB');
  }
}
