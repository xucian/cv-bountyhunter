import express, { type Request, type Response } from 'express';
import type { AgentConfig, Issue, Solution } from '../types/index.js';
import type { ILLMService } from '../types/services.js';
import { CodingAgent } from './coding-agent.js';

interface SolveRequestBody {
  issue: Issue;
}

/**
 * Agent Server - Express server that exposes agent capabilities via HTTP
 * Each agent runs on its own port and can solve GitHub issues
 */
export class AgentServer {
  private app: express.Application;
  private agent: CodingAgent;
  private server: ReturnType<typeof express.application.listen> | null = null;

  constructor(
    private agentConfig: AgentConfig,
    llmService: ILLMService
  ) {
    this.app = express();
    this.agent = new CodingAgent(
      agentConfig.id,
      agentConfig.model,
      llmService
    );

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());

    // Request logging
    this.app.use((req, _res, next) => {
      console.log(`[${this.agentConfig.id}] ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        agentId: this.agentConfig.id,
        agentName: this.agentConfig.name,
        model: this.agentConfig.model,
        timestamp: Date.now(),
      });
    });

    // Solve endpoint - receives an issue and returns a solution
    this.app.post('/solve', async (req: Request, res: Response) => {
      const startTime = Date.now();

      try {
        const body = req.body as SolveRequestBody;

        if (!body.issue) {
          res.status(400).json({
            error: 'Missing required field: issue',
          });
          return;
        }

        const { issue } = body;

        // Validate issue structure
        if (!issue.title || issue.number === undefined) {
          res.status(400).json({
            error: 'Invalid issue format. Required: title, number',
          });
          return;
        }

        console.log(`[${this.agentConfig.id}] Solving issue #${issue.number}: ${issue.title}`);

        const solution: Solution = await this.agent.solve(issue);

        console.log(
          `[${this.agentConfig.id}] Solution ${solution.success ? 'completed' : 'failed'} in ${solution.timeMs}ms`
        );

        res.json(solution);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[${this.agentConfig.id}] Error in /solve:`, errorMessage);

        res.status(500).json({
          agentId: this.agentConfig.id,
          code: '',
          timeMs: Date.now() - startTime,
          success: false,
          error: errorMessage,
        } as Solution & { error: string });
      }
    });

    // Info endpoint - returns agent configuration
    this.app.get('/info', (_req: Request, res: Response) => {
      res.json({
        id: this.agentConfig.id,
        name: this.agentConfig.name,
        model: this.agentConfig.model,
        port: this.agentConfig.port,
      });
    });
  }

  /**
   * Start the agent server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.agentConfig.port, () => {
          console.log(
            `[${this.agentConfig.id}] Agent server running on http://localhost:${this.agentConfig.port}`
          );
          resolve();
        });

        this.server.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            reject(new Error(`Port ${this.agentConfig.port} is already in use`));
          } else {
            reject(err);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the agent server
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`[${this.agentConfig.id}] Agent server stopped`);
          resolve();
        }
      });
    });
  }

  getAgentConfig(): AgentConfig {
    return this.agentConfig;
  }
}
