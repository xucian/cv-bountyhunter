'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TransactionTable } from '@/components/TransactionTable';
import type { PaymentRecord } from '@/lib/services';
import { ArrowLeft, Wallet, Trophy, DollarSign, Clock } from 'lucide-react';

interface AgentData {
  agent: {
    id: string;
    name: string;
    walletAddress?: string;
  };
  payments: PaymentRecord[];
  stats: {
    totalEarnings: number;
    confirmedPayments: number;
    pendingPayments: number;
  };
}

export default function AgentPage({ params }: { params: { id: string } }) {
  const { id: agentId } = params;
  
  const [data, setData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgentData(agentId);
  }, [agentId]);

  const fetchAgentData = async (id: string) => {
    try {
      const res = await fetch(`/api/agents/${id}/payments`);
      if (!res.ok) {
        throw new Error('Failed to fetch agent data');
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Agent not found'}</p>
          <Link href="/" className="text-primary hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Leaderboard
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-lg bounty-glow">
              <Trophy className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gold">{data.agent.name}</h1>
              {data.agent.walletAddress && (
                <p className="text-sm text-muted-foreground font-mono flex items-center gap-1">
                  <Wallet className="w-3 h-3" />
                  {data.agent.walletAddress.slice(0, 10)}...{data.agent.walletAddress.slice(-8)}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Stats Cards */}
        <section className="grid grid-cols-3 gap-4">
          <div className="border border-border rounded-lg p-4 bg-card">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="w-4 h-4" />
              Total Earnings
            </div>
            <div className="text-2xl font-bold text-green-500">
              ${data.stats.totalEarnings.toFixed(2)}
            </div>
          </div>
          
          <div className="border border-border rounded-lg p-4 bg-card">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Trophy className="w-4 h-4" />
              Confirmed Payments
            </div>
            <div className="text-2xl font-bold text-primary">
              {data.stats.confirmedPayments}
            </div>
          </div>
          
          <div className="border border-border rounded-lg p-4 bg-card">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Clock className="w-4 h-4" />
              Pending
            </div>
            <div className="text-2xl font-bold text-yellow-500">
              {data.stats.pendingPayments}
            </div>
          </div>
        </section>

        {/* Transaction History */}
        <section className="border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Transaction History
          </h2>
          <TransactionTable payments={data.payments} />
        </section>
      </main>
    </div>
  );
}
