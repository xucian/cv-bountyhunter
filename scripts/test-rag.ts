/**
 * Test script for RAG (Retrieval-Augmented Generation) service
 * Tests both Mock and Real implementations
 */

import 'dotenv/config';
import { MockRAGService } from '../src/services/rag/mock.js';
import { RealRAGService } from '../src/services/rag/real.js';
import type { Issue } from '../src/types/index.js';

const testIssue: Issue = {
  number: 123,
  title: 'Fix null pointer exception in user authentication',
  body: 'When a user tries to log in without a profile picture, the application crashes with a null pointer exception. This happens in the UserService class.',
  repoUrl: 'https://github.com/test/repo',
  labels: ['bug'],
};

async function testMockRAG() {
  console.log('\n========== TESTING MOCK RAG SERVICE ==========\n');

  const mockRAG = new MockRAGService();

  // Test indexing
  console.log('1. Testing indexRepo()...');
  const indexResult = await mockRAG.indexRepo(process.cwd(), testIssue.repoUrl);
  console.log(`   ✓ Indexed ${indexResult.chunksIndexed} chunks (commit: ${indexResult.commitId})`);

  // Test querying
  console.log('\n2. Testing queryRelevantCode()...');
  const chunks = await mockRAG.queryRelevantCode(testIssue, 5);
  console.log(`   ✓ Retrieved ${chunks.length} chunks`);
  chunks.forEach((chunk, i) => {
    console.log(`   ${i + 1}. ${chunk.chunkName} (${chunk.chunkType}) in ${chunk.filePath}`);
    console.log(`      Score: ${chunk.score?.toFixed(2)}`);
  });

  // Test cache check
  console.log('\n3. Testing isRepoIndexed()...');
  const isIndexed = await mockRAG.isRepoIndexed(testIssue.repoUrl, indexResult.commitId);
  console.log(`   ✓ Repo indexed: ${isIndexed}`);

  console.log('\n✓ Mock RAG tests passed!\n');
}

async function testRealRAG() {
  console.log('\n========== TESTING REAL RAG SERVICE ==========\n');

  try {
    const realRAG = new RealRAGService();

    // Test indexing
    console.log('1. Testing indexRepo() on current codebase...');
    const indexResult = await realRAG.indexRepo(process.cwd(), testIssue.repoUrl);
    console.log(`   ✓ Indexed ${indexResult.chunksIndexed} chunks (commit: ${indexResult.commitId})`);

    // Test querying
    console.log('\n2. Testing queryRelevantCode()...');
    const chunks = await realRAG.queryRelevantCode(testIssue, 5);
    console.log(`   ✓ Retrieved ${chunks.length} chunks`);

    if (chunks.length > 0) {
      chunks.forEach((chunk, i) => {
        console.log(`   ${i + 1}. ${chunk.chunkName} (${chunk.chunkType}) in ${chunk.filePath}`);
        console.log(`      Score: ${chunk.score?.toFixed(2)}`);
        console.log(`      Code preview: ${chunk.code.slice(0, 100)}...`);
      });
    } else {
      console.log('   ⚠ No chunks found (vector index may still be building)');
    }

    // Test cache check
    console.log('\n3. Testing isRepoIndexed()...');
    const isIndexed = await realRAG.isRepoIndexed(testIssue.repoUrl, indexResult.commitId);
    console.log(`   ✓ Repo indexed: ${isIndexed}`);

    // Test re-indexing (should skip)
    console.log('\n4. Testing re-indexing (should use cache)...');
    const reindexResult = await realRAG.indexRepo(process.cwd(), testIssue.repoUrl);
    console.log(`   ✓ Re-index returned ${reindexResult.chunksIndexed} chunks (from cache)`);

    // Close connection
    await realRAG.close();

    console.log('\n✓ Real RAG tests passed!\n');
  } catch (error) {
    console.error('\n✗ Real RAG test failed:');
    console.error(error);
    console.log('\nMake sure you have:');
    console.log('  - VOYAGE_API_KEY set in .env');
    console.log('  - MONGODB_URI set in .env');
    console.log('  - MongoDB Atlas vector index created (see integration plan)');
    process.exit(1);
  }
}

async function main() {
  const mode = process.argv[2] || 'mock';

  console.log('='.repeat(60));
  console.log('RAG Service Test');
  console.log('='.repeat(60));

  if (mode === 'mock' || mode === 'all') {
    await testMockRAG();
  }

  if (mode === 'real' || mode === 'all') {
    await testRealRAG();
  }

  console.log('='.repeat(60));
  console.log('All tests completed!');
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
