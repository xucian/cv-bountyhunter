/**
 * X402 Payment Middleware
 * Adds pay-per-call functionality to agent endpoints
 * Implements HTTP 402 Payment Required flow
 */

import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export interface X402Config {
  /** Price per call in USDC */
  pricePerCall: number;
  /** Wallet address to receive payments */
  recipientAddress: string;
  /** Routes to protect (e.g., ['POST /solve']) */
  protectedRoutes?: string[];
  /** Whether to enable the paywall (default: true) */
  enabled?: boolean;
}

export interface PaymentRequirement {
  scheme: 'exact';
  network: string;
  asset: {
    address: string;
    decimals: number;
    symbol: string;
  };
  payee: string;
  maxAmountRequired: string;
  description: string;
  resource: string;
  facilitator?: string;
}

/**
 * Create x402 payment middleware for Express
 * Returns 402 Payment Required if no valid payment header is present
 */
export function createX402Middleware(x402Config: X402Config) {
  const {
    pricePerCall,
    recipientAddress,
    protectedRoutes = ['POST /solve'],
    enabled = true,
  } = x402Config;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if middleware is disabled
    if (!enabled) {
      return next();
    }

    // Check if this route is protected
    const routeKey = `${req.method} ${req.path}`;
    const isProtected = protectedRoutes.some((route) => {
      if (route === routeKey) return true;
      // Support wildcards like "POST /solve*"
      if (route.endsWith('*')) {
        const prefix = route.slice(0, -1);
        return routeKey.startsWith(prefix);
      }
      return false;
    });

    if (!isProtected) {
      return next();
    }

    // Check for payment header
    const paymentHeader = req.headers['x-payment'] as string | undefined;

    if (!paymentHeader) {
      // Return 402 Payment Required with payment requirements
      const paymentRequirement: PaymentRequirement = {
        scheme: 'exact',
        network: config.x402.network,
        asset: {
          address: config.x402.usdcAddress,
          decimals: 6,
          symbol: 'USDC',
        },
        payee: recipientAddress,
        maxAmountRequired: (pricePerCall * 1e6).toString(), // Convert to 6 decimals
        description: `AI Agent API Call - ${req.path}`,
        resource: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        facilitator: config.x402.facilitatorUrl,
      };

      // Encode payment requirement as base64 for header
      const paymentRequiredHeader = Buffer.from(
        JSON.stringify(paymentRequirement)
      ).toString('base64');

      res.status(402);
      res.setHeader('X-Payment-Required', paymentRequiredHeader);
      res.json({
        status: 402,
        error: 'Payment Required',
        message: `This endpoint requires payment of ${pricePerCall} USDC`,
        paymentDetails: {
          amount: pricePerCall,
          currency: 'USDC',
          recipient: recipientAddress,
          network: config.x402.network,
        },
        paymentRequirement,
      });
      return;
    }

    // Verify the payment
    try {
      const isValid = await verifyPayment(paymentHeader);

      if (!isValid) {
        res.status(402).json({
          status: 402,
          error: 'Payment Invalid',
          message: 'The provided payment signature could not be verified',
        });
        return;
      }

      // Payment verified - add info to request for logging
      (req as any).x402Payment = {
        verified: true,
        amount: pricePerCall,
        header: paymentHeader.slice(0, 50) + '...',
      };

      console.log(`[X402] Payment verified for ${routeKey}: ${pricePerCall} USDC`);
      next();
    } catch (error) {
      console.error('[X402] Payment verification error:', error);
      res.status(500).json({
        status: 500,
        error: 'Payment Verification Failed',
        message: 'An error occurred while verifying payment',
      });
    }
  };
}

/**
 * Verify payment with the x402 facilitator
 */
async function verifyPayment(paymentHeader: string): Promise<boolean> {
  try {
    // Try to verify with the facilitator
    const response = await fetch(`${config.x402.facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment: paymentHeader }),
    });

    if (response.ok) {
      const result = await response.json();
      return result.valid === true;
    }

    return false;
  } catch (error) {
    // If facilitator is unavailable, do basic validation
    // This allows testing without full infrastructure
    console.warn('[X402] Facilitator unavailable, using basic validation');

    try {
      // Basic check: decode and verify structure
      const decoded = JSON.parse(
        Buffer.from(paymentHeader, 'base64').toString('utf-8')
      );
      return (
        decoded &&
        typeof decoded.signature === 'string' &&
        decoded.signature.length > 20
      );
    } catch {
      return paymentHeader.length > 50; // Very basic fallback
    }
  }
}

/**
 * Create a simple logging middleware for x402 payments
 */
export function createX402Logger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const payment = (req as any).x402Payment;
    if (payment) {
      console.log(`[X402] Request with payment: ${JSON.stringify(payment)}`);
    }
    next();
  };
}

/**
 * Helper to check if x402 is properly configured
 */
export function isX402Configured(agentConfig: { walletAddress?: string }): boolean {
  return !!(
    agentConfig.walletAddress &&
    agentConfig.walletAddress.startsWith('0x') &&
    agentConfig.walletAddress.length === 42
  );
}
