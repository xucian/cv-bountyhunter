import type { IPaymentService } from '../../types/services.js';
import type { PaymentRequest } from '../../types/index.js';

export class MockPaymentService implements IPaymentService {
  private paymentCounter = 0;

  async requestPayment(
    agentId: string,
    amount: number
  ): Promise<PaymentRequest> {
    this.paymentCounter++;
    const paymentId = `pay_${this.paymentCounter}_${Date.now()}`;

    console.log(`[MockPayment] Payment requested from agent '${agentId}'`);
    console.log(`[MockPayment] Amount: ${amount} USDC`);
    console.log(`[MockPayment] Payment ID: ${paymentId}`);

    // Simulate processing delay
    await this.delay(100);

    return {
      paymentId,
      amount,
      status: 'completed',
    };
  }

  async verifyPayment(signature: string): Promise<boolean> {
    console.log(`[MockPayment] Verifying payment signature: ${signature.slice(0, 20)}...`);
    await this.delay(50);

    // Always return true for mock
    return true;
  }

  async sendBonus(walletAddress: string, amount: number): Promise<string> {
    console.log(`[MockPayment] Sending bonus payment`);
    console.log(`[MockPayment] Recipient: ${walletAddress}`);
    console.log(`[MockPayment] Amount: ${amount} USDC`);

    await this.delay(200);

    // Generate a fake transaction hash
    const txHash = `0x${this.randomHex(64)}`;
    console.log(`[MockPayment] Transaction hash: ${txHash}`);

    return txHash;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private randomHex(length: number): string {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }
}
