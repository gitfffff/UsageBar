/**
 * Codex Provider - Full implementation
 * Communicates with OpenAI Codex CLI via RPC
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { Provider, ProviderUsage, RateWindow } from './index';

const execAsync = promisify(exec);

interface CodexRPCResponse {
    account?: {
        type: string;
        email?: string;
        planType?: string;
    };
    primary?: {
        usedPercent: number;
        windowDurationMins?: number;
        resetsAt?: number;
    };
    secondary?: {
        usedPercent: number;
        windowDurationMins?: number;
        resetsAt?: number;
    };
    credits?: {
        hasCredits: boolean;
        unlimited: boolean;
        balance?: string;
    };
}

export class CodexProvider implements Provider {
    id = 'codex';
    displayName = 'Codex';
    private timeout = 15000;

    async fetch(): Promise<ProviderUsage> {
        try {
            const version = await this.detectVersion();

            // Newer Codex CLI versions expose a JSON status endpoint.
            try {
                return await this.fetchWithStatusJson(version);
            } catch {
                // Ignore and continue through legacy fallbacks.
            }

            try {
                return await this.fetchWithRPC(version);
            } catch {
                return await this.fetchWithPTY(version);
            }
        } catch {
            return {
                providerId: this.id,
                displayName: this.displayName,
                error: 'Install Codex CLI and run "codex login"',
                needsLogin: true,
                updatedAt: new Date().toISOString(),
            };
        }
    }

    async isAvailable(): Promise<boolean> {
        try {
            await this.detectVersion();
            return true;
        } catch {
            return false;
        }
    }

    private async detectVersion(): Promise<string> {
        try {
            const { stdout } = await execAsync('codex --version', {
                timeout: this.timeout,
                maxBuffer: 1024 * 1024,
            });
            const match = stdout.match(/(\d+\.\d+\.\d+)/);
            return match ? match[1] : 'unknown';
        } catch {
            throw new Error('Codex CLI not found. Install it from OpenAI.');
        }
    }

    private async fetchWithStatusJson(version: string): Promise<ProviderUsage> {
        const { stdout } = await execAsync('codex status --json', {
            timeout: this.timeout,
            maxBuffer: 4 * 1024 * 1024,
        });

        const parsed = JSON.parse(stdout) as CodexRPCResponse;
        return this.parseRPCResponse(parsed, version);
    }

    private async fetchWithRPC(version: string): Promise<ProviderUsage> {
        return new Promise((resolve, reject) => {
            const childProcess = spawn('codex', ['-s', 'read-only', '-a', 'untrusted', 'app-server'], {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: process.platform === 'win32',
            });

            let stdout = '';
            let resolved = false;

            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    childProcess.kill();
                    reject(new Error('Codex RPC timed out'));
                }
            }, this.timeout);

            childProcess.stdout.on('data', (data) => {
                stdout += data.toString();

                try {
                    const lines = stdout.split('\n');
                    for (const line of lines) {
                        if (line.trim().startsWith('{')) {
                            const response: CodexRPCResponse = JSON.parse(line);
                            if (!resolved) {
                                resolved = true;
                                clearTimeout(timeout);
                                childProcess.kill();
                                resolve(this.parseRPCResponse(response, version));
                            }
                        }
                    }
                } catch {
                    // Keep waiting for more data
                }
            });

            childProcess.on('close', () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    reject(new Error('Codex RPC closed without response'));
                }
            });

            childProcess.on('error', (err) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    reject(err);
                }
            });

            const request = JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getUsage',
                params: {},
            });
            childProcess.stdin.write(request + '\n');
        });
    }

    private parseRPCResponse(response: CodexRPCResponse, version: string): ProviderUsage {
        const primary: RateWindow | undefined = response.primary ? {
            usedPercent: response.primary.usedPercent,
            windowMinutes: response.primary.windowDurationMins,
            resetsAt: response.primary.resetsAt
                ? new Date(response.primary.resetsAt * 1000).toISOString()
                : undefined,
            resetDescription: 'Session',
        } : undefined;

        const secondary: RateWindow | undefined = response.secondary ? {
            usedPercent: response.secondary.usedPercent,
            windowMinutes: response.secondary.windowDurationMins,
            resetsAt: response.secondary.resetsAt
                ? new Date(response.secondary.resetsAt * 1000).toISOString()
                : undefined,
            resetDescription: 'Weekly',
        } : undefined;

        return {
            providerId: this.id,
            displayName: this.displayName,
            primary,
            secondary,
            accountEmail: response.account?.email,
            accountPlan: response.account?.planType,
            version,
            updatedAt: new Date().toISOString(),
            credits: response.credits ? {
                balance: response.credits.balance || '0',
                unlimited: response.credits.unlimited,
            } : undefined,
            dashboardUrl: 'https://platform.openai.com/usage',
            statusPageUrl: 'https://status.openai.com',
        };
    }

    private async fetchWithPTY(version: string): Promise<ProviderUsage> {
        try {
            const { stdout } = await execAsync('codex status', {
                timeout: this.timeout,
                maxBuffer: 1024 * 1024,
            });

            const sessionMatch = stdout.match(/session(?:\s+usage)?\s*:\s*(\d+)%/i);
            const weeklyMatch = stdout.match(/weekly(?:\s+usage)?\s*:\s*(\d+)%/i);
            const emailMatch = stdout.match(/email\s*:\s*(\S+)/i);

            const primary: RateWindow | undefined = sessionMatch ? {
                usedPercent: parseInt(sessionMatch[1], 10),
                resetDescription: 'Session',
            } : undefined;

            const secondary: RateWindow | undefined = weeklyMatch ? {
                usedPercent: parseInt(weeklyMatch[1], 10),
                resetDescription: 'Weekly',
            } : undefined;

            return {
                providerId: this.id,
                displayName: this.displayName,
                primary,
                secondary,
                accountEmail: emailMatch ? emailMatch[1] : undefined,
                version,
                updatedAt: new Date().toISOString(),
            };
        } catch {
            return {
                providerId: this.id,
                displayName: this.displayName,
                version,
                error: 'Run "codex login" to authenticate',
                needsLogin: true,
                updatedAt: new Date().toISOString(),
            };
        }
    }
}
