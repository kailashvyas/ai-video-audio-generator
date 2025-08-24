/**
 * Cost Monitor service for tracking API usage and enforcing budget limits
 */

import { APIOperation, UsageStats, CostReport, CostBreakdown } from '../types/api';

export interface CostMonitorConfig {
  budgetLimit: number;
  warningThreshold: number; // Percentage of budget (0-1)
  trackingPeriod: 'daily' | 'weekly' | 'monthly' | 'session';
}

export interface BudgetCheckResult {
  canProceed: boolean;
  estimatedCost: number;
  remainingBudget: number;
  warningMessage?: string;
}

export interface CostEntry {
  timestamp: Date;
  operation: APIOperation;
  actualCost: number;
  estimatedCost: number;
  service: string;
}

/**
 * Cost pricing configuration for different Gemini API operations
 */
const API_PRICING = {
  text: {
    'gemini-pro': { input: 0.000125, output: 0.000375 }, // per 1K tokens
    'gemini-ultra': { input: 0.0005, output: 0.0015 }
  },
  image: {
    'gemini-vision': { generation: 0.002 } // per image
  },
  video: {
    'veo': { 
      'text-to-video': 0.10, // per second
      'image-to-video': 0.15 // per second
    }
  },
  audio: {
    'text-to-speech': 0.000016, // per character
    'musiclm': 0.02 // per second
  }
};

export class CostMonitor {
  private config: CostMonitorConfig;
  private costEntries: CostEntry[] = [];
  private currentSessionCost: number = 0;

  constructor(config: CostMonitorConfig) {
    this.config = config;
  }

  /**
   * Track an API call and its associated cost
   */
  trackAPICall(operation: APIOperation, actualCost: number, service: string): void {
    const entry: CostEntry = {
      timestamp: new Date(),
      operation,
      actualCost,
      estimatedCost: this.estimateOperationCost(operation),
      service
    };

    this.costEntries.push(entry);
    this.currentSessionCost += actualCost;
  }

  /**
   * Get current usage statistics
   */
  getCurrentUsage(): UsageStats {
    const relevantEntries = this.getEntriesForPeriod();
    
    return {
      totalCost: relevantEntries.reduce((sum, entry) => sum + entry.actualCost, 0),
      requestCount: relevantEntries.length,
      tokensUsed: this.calculateTotalTokens(relevantEntries),
      quotaRemaining: Math.max(0, this.config.budgetLimit - this.currentSessionCost)
    };
  }

  /**
   * Check if planned operations fit within budget limits
   */
  checkBudgetLimit(plannedOperations: APIOperation[]): BudgetCheckResult {
    const estimatedCost = plannedOperations.reduce(
      (sum, op) => sum + this.estimateOperationCost(op), 
      0
    );
    
    const currentUsage = this.getCurrentUsage();
    const totalProjectedCost = currentUsage.totalCost + estimatedCost;
    const remainingBudget = this.config.budgetLimit - currentUsage.totalCost;
    
    const canProceed = totalProjectedCost <= this.config.budgetLimit;
    const warningThreshold = this.config.budgetLimit * this.config.warningThreshold;
    
    let warningMessage: string | undefined;
    if (totalProjectedCost >= warningThreshold && totalProjectedCost < this.config.budgetLimit) {
      const percentUsed = (totalProjectedCost / this.config.budgetLimit * 100).toFixed(1);
      warningMessage = `Warning: This operation will use ${percentUsed}% of your budget limit`;
    } else if (!canProceed) {
      const overage = (totalProjectedCost - this.config.budgetLimit).toFixed(2);
      warningMessage = `Budget exceeded: Operation would cost $${overage} more than your limit`;
    }

    const result: BudgetCheckResult = {
      canProceed,
      estimatedCost,
      remainingBudget
    };
    
    if (warningMessage) {
      result.warningMessage = warningMessage;
    }
    
    return result;
  }

  /**
   * Estimate cost for a single API operation
   */
  estimateOperationCost(operation: APIOperation): number {
    const { type, model, inputSize, outputSize = 0, complexity } = operation;
    
    // Apply complexity multiplier
    const complexityMultiplier = {
      low: 1.0,
      medium: 1.5,
      high: 2.0
    }[complexity];

    switch (type) {
      case 'text':
        const textPricing = API_PRICING.text[model as keyof typeof API_PRICING.text];
        if (!textPricing) return 0;
        return (
          (inputSize / 1000) * textPricing.input + 
          (outputSize / 1000) * textPricing.output
        ) * complexityMultiplier;

      case 'image':
        const imagePricing = API_PRICING.image[model as keyof typeof API_PRICING.image];
        if (!imagePricing) return 0;
        return imagePricing.generation * complexityMultiplier;

      case 'video':
        const videoPricing = API_PRICING.video[model as keyof typeof API_PRICING.video];
        if (!videoPricing) return 0;
        // Assume inputSize represents duration in seconds for video
        const videoRate = typeof videoPricing === 'object' 
          ? videoPricing['text-to-video'] 
          : videoPricing;
        return inputSize * videoRate * complexityMultiplier;

      case 'audio':
        const audioPricing = API_PRICING.audio[model as keyof typeof API_PRICING.audio];
        if (!audioPricing) return 0;
        return inputSize * audioPricing * complexityMultiplier;

      default:
        return 0;
    }
  }

  /**
   * Generate comprehensive cost report
   */
  generateCostReport(): CostReport {
    const relevantEntries = this.getEntriesForPeriod();
    const breakdown = this.generateCostBreakdown(relevantEntries);
    
    const period = this.getReportingPeriod();
    
    return {
      totalCost: relevantEntries.reduce((sum, entry) => sum + entry.actualCost, 0),
      breakdown,
      period
    };
  }

  /**
   * Update budget configuration
   */
  updateBudgetLimit(newLimit: number): void {
    this.config.budgetLimit = newLimit;
  }

  /**
   * Reset cost tracking (useful for new sessions or periods)
   */
  resetTracking(): void {
    this.costEntries = [];
    this.currentSessionCost = 0;
  }

  /**
   * Get cost entries for the current tracking period
   */
  private getEntriesForPeriod(): CostEntry[] {
    if (this.config.trackingPeriod === 'session') {
      return this.costEntries;
    }

    const now = new Date();
    const periodStart = this.getPeriodStart(now);
    
    return this.costEntries.filter(entry => entry.timestamp >= periodStart);
  }

  /**
   * Calculate period start date based on tracking configuration
   */
  private getPeriodStart(now: Date): Date {
    const start = new Date(now);
    
    switch (this.config.trackingPeriod) {
      case 'daily':
        start.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        const dayOfWeek = start.getDay();
        start.setDate(start.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
    }
    
    return start;
  }

  /**
   * Generate cost breakdown by service and operation type
   */
  private generateCostBreakdown(entries: CostEntry[]): CostBreakdown[] {
    const breakdownMap = new Map<string, CostBreakdown>();
    
    entries.forEach(entry => {
      const key = `${entry.service}-${entry.operation.type}`;
      const existing = breakdownMap.get(key);
      
      if (existing) {
        existing.count += 1;
        existing.totalCost += entry.actualCost;
      } else {
        breakdownMap.set(key, {
          service: entry.service,
          operation: entry.operation.type,
          count: 1,
          unitCost: entry.actualCost,
          totalCost: entry.actualCost
        });
      }
    });
    
    // Update unit costs to be averages
    breakdownMap.forEach(breakdown => {
      breakdown.unitCost = breakdown.totalCost / breakdown.count;
    });
    
    return Array.from(breakdownMap.values())
      .sort((a, b) => b.totalCost - a.totalCost);
  }

  /**
   * Calculate total tokens used from cost entries
   */
  private calculateTotalTokens(entries: CostEntry[]): number {
    return entries
      .filter(entry => entry.operation.type === 'text')
      .reduce((sum, entry) => sum + entry.operation.inputSize + (entry.operation.outputSize || 0), 0);
  }

  /**
   * Get reporting period dates
   */
  private getReportingPeriod(): { start: Date; end: Date } {
    const end = new Date();
    const start = this.getPeriodStart(end);
    
    return { start, end };
  }
}