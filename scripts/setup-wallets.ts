#!/usr/bin/env tsx
/**
 * One-time wallet setup script using CDP
 * Run: npm run setup:wallets
 * 
 * This creates:
 * - 1 Orchestrator wallet (sends bounties)
 * - 3 Agent wallets (receive bounties)
 * 
 * Prerequisites:
 * - CDP_API_KEY_ID set in .env
 * - CDP_API_KEY_SECRET set in .env
 * - CDP_WALLET_SECRET set in .env (generate with: openssl rand -hex 32)
 */

import 'dotenv/config';
import { CdpClient } from '@coinbase/cdp-sdk';

const SEPARATOR = '='.repeat(60);

async function main() {
  console.log(SEPARATOR);
  console.log('CDP Wallet Setup Script');
  console.log(SEPARATOR);
  console.log();

  // Check prerequisites
  const apiKeyId = process.env.CDP_API_KEY_ID;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET;
  const walletSecret = process.env.CDP_WALLET_SECRET;

  if (!apiKeyId || !apiKeySecret) {
    console.error('❌ Missing CDP API credentials!');
    console.error('   Set CDP_API_KEY_ID and CDP_API_KEY_SECRET in .env');
    console.error('   Get them from: https://portal.cdp.coinbase.com');
    process.exit(1);
  }

  if (!walletSecret) {
    console.error('❌ Missing CDP_WALLET_SECRET!');
    console.error('   Generate one with: openssl rand -hex 32');
    console.error('   Add it to .env as CDP_WALLET_SECRET=your-secret');
    process.exit(1);
  }

  console.log('✅ CDP credentials found');
  console.log();

  try {
    // Initialize CDP client
    console.log('Initializing CDP client...');
    const client = new CdpClient();

    console.log('Creating wallets (EVM accounts work on any network)...');
    console.log();

    // Create orchestrator wallet
    console.log('Creating Orchestrator wallet...');
    const orchestrator = await client.evm.createAccount();
    console.log(`   ✅ Created: ${orchestrator.address}`);

    // Create agent wallets
    console.log('Creating Agent Llama wallet...');
    const llama = await client.evm.createAccount();
    console.log(`   ✅ Created: ${llama.address}`);

    console.log('Creating Agent Qwen wallet...');
    const qwen = await client.evm.createAccount();
    console.log(`   ✅ Created: ${qwen.address}`);

    console.log('Creating Agent DeepSeek wallet...');
    const deepseek = await client.evm.createAccount();
    console.log(`   ✅ Created: ${deepseek.address}`);

    console.log();
    console.log(SEPARATOR);
    console.log('ADD THESE TO YOUR .env FILE:');
    console.log(SEPARATOR);
    console.log();
    console.log('# Orchestrator Wallet (CDP managed)');
    console.log(`ORCHESTRATOR_WALLET_ID=${orchestrator.address}`);
    console.log();
    console.log('# Agent Wallets');
    console.log(`AGENT_LLAMA_WALLET=${llama.address}`);
    console.log(`AGENT_QWEN_WALLET=${qwen.address}`);
    console.log(`AGENT_DEEPSEEK_WALLET=${deepseek.address}`);
    console.log();
    console.log(SEPARATOR);
    console.log('NEXT STEPS:');
    console.log(SEPARATOR);
    console.log();
    console.log('1. Copy the values above to your .env file');
    console.log();
    console.log('2. Fund the orchestrator wallet with testnet ETH (for gas):');
    console.log('   https://www.coinbase.com/faucets/base-sepolia');
    console.log(`   Address: ${orchestrator.address}`);
    console.log();
    console.log('3. Get testnet USDC and send to orchestrator wallet');
    console.log();
    console.log('4. Test with: npm run test:wallet');
    console.log();
    console.log('View wallets in CDP Portal: https://portal.cdp.coinbase.com');
    console.log();

  } catch (error) {
    console.error();
    console.error('❌ Error creating wallets:', error);
    console.error();
    console.error('Troubleshooting:');
    console.error('  1. Verify CDP credentials are correct');
    console.error('  2. Check CDP Portal: https://portal.cdp.coinbase.com');
    console.error('  3. Ensure your CDP_WALLET_SECRET is set');
    process.exit(1);
  }
}

main();
