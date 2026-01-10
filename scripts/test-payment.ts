#!/usr/bin/env npx tsx
/**
 * Test Payment Service
 * Tests sending USDC payments on testnet
 *
 * Usage:
 *   npx tsx scripts/test-payment.ts [recipient_address] [amount]
 *
 * Examples:
 *   npx tsx scripts/test-payment.ts                           # Check balance only
 *   npx tsx scripts/test-payment.ts 0x1234...5678 0.01        # Send 0.01 USDC
 *
 * Environment:
 *   Requires ORCHESTRATOR_PRIVATE_KEY or CDP credentials in .env
 *   Uses Base Sepolia testnet by default
 */

import 'dotenv/config';
import { config } from '../src/config.js';
import { RealPaymentService } from '../src/services/payment/real.js';

async function main() {
  const args = process.argv.slice(2);
  const recipientAddress = args[0];
  const amount = args[1] ? parseFloat(args[1]) : undefined;

  console.log('='.repeat(60));
  console.log('Payment Service Test');
  console.log('='.repeat(60));
  console.log();

  // Safety check for mainnet
  if (config.x402.network === 'base') {
    console.log('WARNING: Running on MAINNET (base)!');
    console.log('This will use REAL USDC. Are you sure?');
    console.log();
    console.log('To use testnet, set X402_NETWORK=base-sepolia in .env');
    console.log();

    if (recipientAddress && amount) {
      console.log('Aborting payment on mainnet. Set X402_NETWORK=base-sepolia first.');
      process.exit(1);
    }
  }

  console.log('Configuration:');
  console.log(`  Network: ${config.x402.network}`);
  console.log(`  USDC Address: ${config.x402.usdcAddress}`);
  console.log();

  try {
    console.log('Initializing payment service...');
    const paymentService = new RealPaymentService();

    // Health check
    const health = await paymentService.healthCheck();

    console.log();
    console.log('Payment Service Status:');
    console.log('-'.repeat(40));
    console.log(`  Healthy: ${health.healthy}`);
    console.log(`  Address: ${health.address}`);
    console.log(`  Balance: ${health.balance} USDC`);
    console.log(`  Network: ${health.network}`);

    if (health.error) {
      console.log(`  Error: ${health.error}`);
    }

    // If we have recipient and amount, send payment
    if (recipientAddress && amount) {
      console.log();
      console.log('='.repeat(60));
      console.log('SENDING TEST PAYMENT');
      console.log('='.repeat(60));
      console.log();
      console.log(`  Recipient: ${recipientAddress}`);
      console.log(`  Amount: ${amount} USDC`);
      console.log();

      if (health.balance < amount) {
        console.error(`ERROR: Insufficient balance (${health.balance} < ${amount})`);
        console.log();
        console.log('Fund the wallet first:');
        console.log(`  Faucet: https://www.coinbase.com/faucets/base-sepolia`);
        console.log(`  Address: ${health.address}`);
        process.exit(1);
      }

      console.log('Sending payment...');
      const txHash = await paymentService.sendBonus(recipientAddress, amount);

      console.log();
      console.log('PAYMENT SUCCESSFUL!');
      console.log('-'.repeat(40));
      console.log(`  TX Hash: ${txHash}`);
      console.log(`  Explorer: https://sepolia.basescan.org/tx/${txHash}`);

      // Check new balance
      const newBalance = await paymentService.getBalance();
      console.log(`  New Balance: ${newBalance} USDC`);
    } else if (recipientAddress && !amount) {
      console.log();
      console.log('Usage: npx tsx scripts/test-payment.ts <address> <amount>');
      console.log('Example: npx tsx scripts/test-payment.ts 0x1234...5678 0.01');
    } else {
      console.log();
      console.log('To send a test payment:');
      console.log('  npx tsx scripts/test-payment.ts <recipient_address> <amount>');
      console.log();
      console.log('Example:');
      console.log('  npx tsx scripts/test-payment.ts 0x742d35Cc6634C0532925a3b844Bc9e7595f...');
    }

  } catch (error) {
    console.error();
    console.error('Error:', error);
    process.exit(1);
  }

  console.log();
  console.log('='.repeat(60));
}

main().catch(console.error);
