import { createServices } from '../src/services/index.js';

async function test() {
  console.log('Creating services...');
  const services = createServices();

  console.log('\n=== Testing State Service MongoDB ===');
  try {
    const comp = {
      id: 'test-' + Date.now(),
      issue: {
        number: 1,
        title: 'test',
        body: 'test',
        repoUrl: 'test',
        labels: []
      },
      bountyAmount: 50,
      status: 'pending' as const,
      agents: [],
      createdAt: Date.now()
    };
    await services.state.saveCompetition(comp);
    console.log('✓ State service MongoDB works');
  } catch (err) {
    console.error('✗ State service failed:', err);
  }

  console.log('\n=== Testing RAG Service MongoDB ===');
  try {
    const result = await services.rag.indexRepo(process.cwd(), 'https://github.com/test/test');
    console.log('✓ RAG service MongoDB works:', result);
  } catch (err) {
    console.error('✗ RAG service failed:', err);
  }

  process.exit(0);
}

test();
