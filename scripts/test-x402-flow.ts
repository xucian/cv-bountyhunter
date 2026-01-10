#!/usr/bin/env npx tsx
/**
 * Test X402 Full Flow
 * Simulates a complete payment flow with the x402 middleware
 *
 * Usage:
 *   npx tsx scripts/test-x402-flow.ts
 *
 * This script:
 *   1. Checks payment service status
 *   2. Simulates a 402 Payment Required response
 *   3. Shows how the payment flow would work
 */

import 'dotenv/config';
import { config } from '../src/config.js';
import { RealPaymentService } from '../src/services/payment/real.js';

async function main() {
  console.log('='.repeat(60));
  console.log('X402 Payment Flow Test');
  console.log('='.repeat(60));
  console.log();

  console.log('Network:', config.x402.network);
  console.log('Facilitator:', config.x402.facilitatorUrl);
  console.log('USDC Contract:', config.x402.usdcAddress);
  console.log();

  // Step 1: Initialize payment service
  console.log('Step 1: Initialize Payment Service');
  console.log('-'.repeat(40));

  const paymentService = new RealPaymentService();
  const health = await paymentService.healthCheck();

  if (!health.healthy) {
    console.log('Payment service not healthy:', health.error);
    console.log();
    console.log('Make sure you have configured either:');
    console.log('  - ORCHESTRATOR_PRIVATE_KEY (for viem wallet)');
    console.log('  - CDP_API_KEY_ID + CDP_API_KEY_SECRET (for CDP wallet)');
    process.exit(1);
  }

  console.log('  Status: OK');
  console.log(`  Wallet: ${health.address}`);
  console.log(`  Balance: ${health.balance} USDC`);
  console.log();

  // Step 2: Simulate 402 Payment Required
  console.log('Step 2: Simulate 402 Payment Required');
  console.log('-'.repeat(40));

  const mockPaymentRequired = {
    status: 402,
    message: 'Payment Required',
    paymentDetails: {
      amount: 0.01,
      currency: 'USDC',
      recipient: health.address, // Self for testing
      network: config.x402.network,
    },
    paymentRequirement: {
      scheme: 'exact',
      network: config.x402.network,
      asset: {
        address: config.x402.usdcAddress,
        decimals: 6,
        symbol: 'USDC',
      },
      payee: health.address,
      maxAmountRequired: '10000', // 0.01 USDC in 6 decimals
      description: 'AI Agent API Call',
    },
  };

  console.log('  Simulated 402 Response:');
  console.log(JSON.stringify(mockPaymentRequired, null, 2));
  console.log();

  // Step 3: Show payment creation
  console.log('Step 3: Create Payment Request');
  console.log('-'.repeat(40));

  const paymentRequest = await paymentService.requestPayment('test-agent', 0.01);
  console.log('  Payment Request Created:');
  console.log(`    ID: ${paymentRequest.paymentId}`);
  console.log(`    Amount: ${paymentRequest.amount} USDC`);
  console.log(`    Status: ${paymentRequest.status}`);
  console.log();

  // Step 4: Show what would happen next
  console.log('Step 4: Payment Flow (Simulation)');
  console.log('-'.repeat(40));
  console.log('  In a real x402 flow:');
  console.log('  1. Client receives 402 with X-Payment-Required header');
  console.log('  2. Client wallet signs payment payload');
  console.log('  3. Client retries request with X-Payment header');
  console.log('  4. Server verifies payment via facilitator');
  console.log('  5. Server processes request and returns 200');
  console.log();

  // Step 5: Test payment verification (mock)
  console.log('Step 5: Test Payment Verification');
  console.log('-'.repeat(40));

  const mockSignature = 'mock_signature_' + Date.now();
  const isValid = await paymentService.verifyPayment(mockSignature);
  console.log(`  Mock signature verification: ${isValid ? 'PASSED (fallback)' : 'FAILED'}`);
  console.log('  Note: Real verification requires x402 facilitator');
  console.log();

  // Summary
  console.log('='.repeat(60));
  console.log('X402 Flow Test Complete');
  console.log('='.repeat(60));
  console.log();
  console.log('Next steps to test real payments:');
  console.log('  1. Fund wallet with testnet USDC from faucet');
  console.log('  2. Run: npx tsx scripts/test-payment.ts <address> <amount>');
  console.log();
  console.log('Resources:');
  console.log(`  Faucet: https://www.coinbase.com/faucets/base-sepolia`);
  console.log(`  Explorer: https://sepolia.basescan.org/address/${health.address}`);
  console.log();
}

main().catch(console.error);
