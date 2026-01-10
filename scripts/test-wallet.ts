#!/usr/bin/env npx tsx
/**
 * Test Wallet Service
 * Tests wallet creation, balance checking, and basic operations
 *
 * Usage:
 *   npx tsx scripts/test-wallet.ts
 *
 * Environment:
 *   Requires ORCHESTRATOR_PRIVATE_KEY or CDP credentials in .env
 */

import 'dotenv/config';
import { config } from '../src/config.js';
import { createWalletService, validateWalletService } from '../src/services/wallet/index.js';

async function main() {
  console.log('='.repeat(60));
  console.log('Wallet Service Test');
  console.log('='.repeat(60));
  console.log();

  console.log('Configuration:');
  console.log(`  Network: ${config.x402.network}`);
  console.log(`  USDC Address: ${config.x402.usdcAddress}`);
  console.log(`  Has Private Key: ${!!config.orchestrator.privateKey}`);
  console.log(`  Has CDP Credentials: ${!!config.cdp.apiKeyId}`);
  console.log();

  try {
    console.log('Creating wallet service...');
    const wallet = await createWalletService({
      network: config.x402.network,
    });

    console.log('Validating wallet...');
    const validation = await validateWalletService(wallet);

    if (validation.valid) {
      console.log();
      console.log('Wallet Status: VALID');
      console.log('-'.repeat(40));
      console.log(`  Address: ${validation.address}`);
      console.log(`  USDC Balance: ${validation.balance} USDC`);
      console.log();

      if (validation.balance === 0) {
        console.log('NOTE: Wallet has zero balance.');
        console.log('To test payments, fund this wallet with testnet USDC:');
        console.log();
        console.log(`  Faucet: https://www.coinbase.com/faucets/base-sepolia`);
        console.log(`  Address: ${validation.address}`);
      }
    } else {
      console.log();
      console.log('Wallet Status: INVALID');
      console.log(`  Error: ${validation.error}`);
    }

  } catch (error) {
    console.error();
    console.error('Error:', error);
    console.error();
    console.error('Troubleshooting:');
    console.error('  1. Make sure ORCHESTRATOR_PRIVATE_KEY is set in .env');
    console.error('  2. Or configure CDP credentials (CDP_API_KEY_ID, CDP_API_KEY_SECRET)');
    process.exit(1);
  }

  console.log();
  console.log('='.repeat(60));
}

main().catch(console.error);
