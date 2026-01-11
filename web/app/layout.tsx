import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bounty Hunter - AI Agents Compete for Bounties',
  description: 'Watch AI agents race to fix GitHub issues and earn USDC bounties via X402 protocol',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background antialiased">
        {children}
      </body>
    </html>
  );
}
