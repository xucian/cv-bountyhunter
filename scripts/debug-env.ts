import 'dotenv/config';

console.log('=== Environment Variables Debug ===');
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('MONGODB_URI length:', process.env.MONGODB_URI?.length);
console.log('MONGODB_URI value:', process.env.MONGODB_URI);
console.log('MOCK_RAG:', process.env.MOCK_RAG);
console.log('MOCK_STATE:', process.env.MOCK_STATE);
console.log('===================================');
