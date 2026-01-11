import { Collection, Db } from 'mongodb';
import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { config } from '../../config.js';
import { SharedMongoClient } from '../mongodb-client.js';
import type { IRAGService, CodeChunk } from '../../types/services.js';
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
  async indexRepo(repoPath: string, repoUrl: string): Promise<{ commitId: string; chunksIndexed: number }> {
    await this.connect();

    // Get commit SHA
    const commitId = this.getCommitSHA(repoPath);
    console.log(`[RealRAG] Indexing ${repoUrl} (commit: ${commitId})`);

    // Check if already indexed
    console.log(`[RealRAG] Checking if repo is already indexed...`);
    console.log(`[RealRAG]   - repoUrl: ${repoUrl}`);
    console.log(`[RealRAG]   - commitId: ${commitId}`);
    const alreadyIndexed = await this.isRepoIndexed(repoUrl, commitId);
    if (alreadyIndexed) {
      const count = await this.chunksCollection!.countDocuments({ repoUrl, commitId });
      console.log(`[RealRAG] ✓ Repo already indexed (${count} chunks found) - SKIPPING INDEXING`);
      return { commitId, chunksIndexed: count };
    }
    console.log(`[RealRAG] ✗ Repo not indexed, proceeding with fresh indexing...`);

    // Find all source files
    console.log(`[RealRAG] Scanning repository for source files...`);
    console.log(`[RealRAG]   - repoPath: ${repoPath}`);
    const files = this.findSourceFiles(repoPath);
    console.log(`[RealRAG] ✓ Found ${files.length} source files to parse`);
    if (files.length > 0 && files.length <= 10) {
      console.log(`[RealRAG] Files to parse:`);
      files.forEach(f => console.log(`[RealRAG]   - ${path.relative(repoPath, f)}`));
    } else if (files.length > 10) {
      console.log(`[RealRAG] First 10 files to parse:`);
      files.slice(0, 10).forEach(f => console.log(`[RealRAG]   - ${path.relative(repoPath, f)}`));
      console.log(`[RealRAG]   ... and ${files.length - 10} more`);
    }

    // Parse and chunk
    console.log(`[RealRAG] Starting AST parsing and chunking...`);
    const allChunks: Array<Omit<CodeChunkDocument, 'embedding' | 'indexedAt' | 'repoUrl' | 'commitId'>> = [];
    let parsedCount = 0;
    let failedCount = 0;

    for (const file of files) {
      const chunks = this.parseFile(file, repoPath);
      if (chunks.length > 0) {
        allChunks.push(...chunks);
        parsedCount++;
        if (parsedCount <= 5 || parsedCount % 50 === 0) {
          console.log(`[RealRAG] Parsed ${parsedCount}/${files.length}: ${path.relative(repoPath, file)} → ${chunks.length} chunks`);
        }
      } else {
        failedCount++;
      }
    }

    console.log(`[RealRAG] ✓ Parsing complete:`);
    console.log(`[RealRAG]   - Successfully parsed: ${parsedCount} files`);
    console.log(`[RealRAG]   - Failed/No chunks: ${failedCount} files`);
    console.log(`[RealRAG]   - Total chunks extracted: ${allChunks.length}`);

    if (allChunks.length === 0) {
      console.log('[RealRAG] ⚠️  WARNING: No chunks extracted, skipping embedding');
      console.log('[RealRAG]   This likely means:');
      console.log('[RealRAG]   - The repo has no .ts/.tsx/.js/.jsx/.py files, OR');
      console.log('[RealRAG]   - All files failed to parse (check syntax errors)');
      console.log('[RealRAG]   - Files had no extractable functions/classes');
      return { commitId, chunksIndexed: 0 };
    }

    // Generate embeddings in batches
    console.log(`[RealRAG] Starting embedding generation...`);
    const batchSize = 128; // Voyage AI supports up to 128 texts per request
    const totalBatches = Math.ceil(allChunks.length / batchSize);
    console.log(`[RealRAG]   - Total chunks: ${allChunks.length}`);
    console.log(`[RealRAG]   - Batch size: ${batchSize}`);
    console.log(`[RealRAG]   - Total batches: ${totalBatches}`);

    const documents: CodeChunkDocument[] = [];

    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      const texts = batch.map(c => c.code);
      const batchNum = Math.floor(i / batchSize) + 1;

      console.log(`[RealRAG] Embedding batch ${batchNum}/${totalBatches} (${batch.length} chunks)...`);

      try {
        const startTime = Date.now();
        const response = await this.voyageClient.embed({
          input: texts,
          model: config.voyage.model,
        });
        const elapsedMs = Date.now() - startTime;

        console.log(`[RealRAG] ✓ Batch ${batchNum} embedded in ${elapsedMs}ms`);

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
        console.error(`[RealRAG] ✗ Failed to embed batch ${batchNum}:`, error);
        throw error;
      }
    }

    // Insert into MongoDB
    console.log(`[RealRAG] Inserting ${documents.length} documents into MongoDB...`);
    if (documents.length > 0) {
      const startTime = Date.now();
      await this.chunksCollection!.insertMany(documents);
      const elapsedMs = Date.now() - startTime;
      console.log(`[RealRAG] ✓ Indexed ${documents.length} chunks to MongoDB Atlas in ${elapsedMs}ms`);
    }

    return { commitId, chunksIndexed: documents.length };
  }

  /**
   * Query relevant code chunks using vector search
   */
  async queryRelevantCode(issue: Issue, limit = 10): Promise<CodeChunk[]> {
    await this.connect();

    // Create query text from issue
    const queryText = `${issue.title}\n\n${issue.body}`;
    console.log(`[RealRAG] Querying for issue: ${issue.title.slice(0, 50)}...`);

    try {
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

      return results as CodeChunk[];
    } catch (error) {
      console.warn('[RealRAG] Vector search failed, continuing without context:', error);
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
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py'];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'out', '__pycache__', '.venv', 'venv'];

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
   * Parse a file and extract code chunks using AST (for JS/TS) or regex (for Python)
   */
  private parseFile(
    filePath: string,
    repoPath: string
  ): Array<Omit<CodeChunkDocument, 'embedding' | 'indexedAt' | 'repoUrl' | 'commitId'>> {
    const chunks: Array<Omit<CodeChunkDocument, 'embedding' | 'indexedAt' | 'repoUrl' | 'commitId'>> = [];

    try {
      const code = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(repoPath, filePath);

      // Handle Python files with regex-based parsing
      if (filePath.endsWith('.py')) {
        return this.parsePythonFile(code, relativePath);
      }

      // Parse JS/TS with Babel
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
   * Parse Python file using regex (simpler than full AST parsing)
   */
  private parsePythonFile(
    code: string,
    relativePath: string
  ): Array<Omit<CodeChunkDocument, 'embedding' | 'indexedAt' | 'repoUrl' | 'commitId'>> {
    const chunks: Array<Omit<CodeChunkDocument, 'embedding' | 'indexedAt' | 'repoUrl' | 'commitId'>> = [];
    const lines = code.split('\n');

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Match class definitions: class ClassName:
      const classMatch = line.match(/^class\s+(\w+)/);
      if (classMatch) {
        const className = classMatch[1];
        const startLine = i;
        const indent = line.search(/\S/);

        // Find the end of the class (next line with same or less indentation)
        i++;
        while (i < lines.length) {
          const currentLine = lines[i];
          if (currentLine.trim() && currentLine.search(/\S/) <= indent) {
            break;
          }
          i++;
        }

        const classCode = lines.slice(startLine, i).join('\n');
        chunks.push({
          filePath: relativePath,
          chunkType: 'class',
          chunkName: className,
          code: classCode,
        });
        continue;
      }

      // Match function definitions: def function_name(
      const funcMatch = line.match(/^def\s+(\w+)\s*\(/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        const startLine = i;
        const indent = line.search(/\S/);

        // Find the end of the function (next line with same or less indentation)
        i++;
        while (i < lines.length) {
          const currentLine = lines[i];
          if (currentLine.trim() && currentLine.search(/\S/) <= indent) {
            break;
          }
          i++;
        }

        const funcCode = lines.slice(startLine, i).join('\n');
        chunks.push({
          filePath: relativePath,
          chunkType: 'function',
          chunkName: funcName,
          code: funcCode,
        });
        continue;
      }

      i++;
    }

    return chunks;
  }

  /**
   * Close MongoDB connection (no-op since we use SharedMongoClient)
   */
  async close(): Promise<void> {
    // SharedMongoClient manages the connection lifecycle
    this.connected = false;
  }
}
