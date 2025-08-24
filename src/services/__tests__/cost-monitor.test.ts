/**
 * Unit tests for CostMonitor service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CostMonitor, CostMonitorConfig, BudgetCheckResult } from '../cost-monitor';
import { APIOperation } from '../../types/api';

describe('CostMonitor', () => {
  let costMonitor: CostMonitor;
  let config: CostMonitorConfig;

  beforeEach(() => {
    config = {
      budgetLimit: 100.0,
      warningThreshold: 0.8,
      trackingPeriod: 'session'
    };
    costMonitor = new CostMonitor(config);
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(costMonitor).toBeInstanceOf(CostMonitor);
    });
  });

  describe('estimateOperationCost', () => {
    it('should calculate text operation costs correctly', () => {
      const textOperation: APIOperation = {
        type: 'text',
        model: 'gemini-pro',
        inputSize: 1000, // 1K tokens
        outputSize: 2000, // 2K tokens
        complexity: 'low'
      };

      const cost = costMonitor.estimateOperationCost(textOperation);
      // Expected: (1 * 0.000125) + (2 * 0.000375) = 0.000125 + 0.00075 = 0.000875
      expect(cost).toBeCloseTo(0.000875, 6);
    });

    it('should calculate image operation costs correctly', () => {
      const imageOperation: APIOperation = {
        type: 'image',
        model: 'gemini-vision',
        inputSize: 1,
        complexity: 'medium'
      };

      const cost = costMonitor.estimateOperationCost(imageOperation);
      // Expected: 0.002 * 1.5 (medium complexity) = 0.003
      expect(cost).toBeCloseTo(0.003, 6);
    });

    it('should calculate video operation costs correctly', () => {
      const videoOperation: APIOperation = {
        type: 'video',
        model: 'veo',
        inputSize: 30, // 30 seconds
        complexity: 'high'
      };

      const cost = costMonitor.estimateOperationCost(videoOperation);
      // Expected: 30 * 0.10 * 2.0 (high complexity) = 6.0
      expect(cost).toBeCloseTo(6.0, 2);
    });

    it('should calculate audio operation costs correctly', () => {
      const audioOperation: APIOperation = {
        type: 'audio',
        model: 'text-to-speech',
        inputSize: 1000, // 1000 characters
        complexity: 'low'
      };

      const cost = costMonitor.estimateOperationCost(audioOperation);
      // Expected: 1000 * 0.000016 * 1.0 = 0.016
      expect(cost).toBeCloseTo(0.016, 6);
    });

    it('should return 0 for unknown models', () => {
      const unknownOperation: APIOperation = {
        type: 'text',
        model: 'unknown-model',
        inputSize: 1000,
        complexity: 'low'
      };

      const cost = costMonitor.estimateOperationCost(unknownOperation);
      expect(cost).toBe(0);
    });

    it('should apply complexity multipliers correctly', () => {
      const baseOperation: APIOperation = {
        type: 'image',
        model: 'gemini-vision',
        inputSize: 1,
        complexity: 'low'
      };

      const lowCost = costMonitor.estimateOperationCost(baseOperation);
      
      const mediumOperation = { ...baseOperation, complexity: 'medium' as const };
      const mediumCost = costMonitor.estimateOperationCost(mediumOperation);
      
      const highOperation = { ...baseOperation, complexity: 'high' as const };
      const highCost = costMonitor.estimateOperationCost(highOperation);

      expect(mediumCost).toBeCloseTo(lowCost * 1.5, 6);
      expect(highCost).toBeCloseTo(lowCost * 2.0, 6);
    });
  });

  describe('trackAPICall', () => {
    it('should track API calls and update current session cost', () => {
      const operation: APIOperation = {
        type: 'text',
        model: 'gemini-pro',
        inputSize: 1000,
        complexity: 'low'
      };

      costMonitor.trackAPICall(operation, 0.05, 'gemini');
      
      const usage = costMonitor.getCurrentUsage();
      expect(usage.totalCost).toBe(0.05);
      expect(usage.requestCount).toBe(1);
    });

    it('should accumulate costs from multiple API calls', () => {
      const operation1: APIOperation = {
        type: 'text',
        model: 'gemini-pro',
        inputSize: 1000,
        complexity: 'low'
      };

      const operation2: APIOperation = {
        type: 'image',
        model: 'gemini-vision',
        inputSize: 1,
        complexity: 'medium'
      };

      costMonitor.trackAPICall(operation1, 0.05, 'gemini');
      costMonitor.trackAPICall(operation2, 0.10, 'gemini');
      
      const usage = costMonitor.getCurrentUsage();
      expect(usage.totalCost).toBeCloseTo(0.15, 2);
      expect(usage.requestCount).toBe(2);
    });
  });

  describe('checkBudgetLimit', () => {
    it('should allow operations within budget', () => {
      const operations: APIOperation[] = [
        {
          type: 'text',
          model: 'gemini-pro',
          inputSize: 1000,
          complexity: 'low'
        }
      ];

      const result = costMonitor.checkBudgetLimit(operations);
      
      expect(result.canProceed).toBe(true);
      expect(result.estimatedCost).toBeGreaterThan(0);
      expect(result.remainingBudget).toBe(100.0);
      expect(result.warningMessage).toBeUndefined();
    });

    it('should warn when approaching budget limit', () => {
      // Track some existing costs to get close to warning threshold (80% = $80)
      const existingOperation: APIOperation = {
        type: 'video',
        model: 'veo',
        inputSize: 30,
        complexity: 'low'
      };
      
      // Track $70 in existing costs
      costMonitor.trackAPICall(existingOperation, 70.0, 'veo');

      const plannedOperations: APIOperation[] = [
        {
          type: 'video',
          model: 'veo',
          inputSize: 120, // This should cost ~12.0, bringing total to $82 (82% of budget, above 80% threshold)
          complexity: 'low'
        }
      ];

      const result = costMonitor.checkBudgetLimit(plannedOperations);
      
      expect(result.canProceed).toBe(true);
      expect(result.warningMessage).toBeDefined();
      expect(result.warningMessage).toContain('Warning');
    });

    it('should prevent operations that exceed budget', () => {
      // Track existing costs that use most of the budget
      const existingOperation: APIOperation = {
        type: 'video',
        model: 'veo',
        inputSize: 30,
        complexity: 'low'
      };
      
      costMonitor.trackAPICall(existingOperation, 95.0, 'veo');

      const plannedOperations: APIOperation[] = [
        {
          type: 'video',
          model: 'veo',
          inputSize: 60, // This would cost ~6.0, exceeding budget
          complexity: 'low'
        }
      ];

      const result = costMonitor.checkBudgetLimit(plannedOperations);
      
      expect(result.canProceed).toBe(false);
      expect(result.warningMessage).toContain('Budget exceeded');
    });

    it('should calculate remaining budget correctly', () => {
      costMonitor.trackAPICall({
        type: 'text',
        model: 'gemini-pro',
        inputSize: 1000,
        complexity: 'low'
      }, 25.0, 'gemini');

      const result = costMonitor.checkBudgetLimit([]);
      
      expect(result.remainingBudget).toBe(75.0);
    });
  });

  describe('getCurrentUsage', () => {
    it('should return correct usage statistics', () => {
      const operation1: APIOperation = {
        type: 'text',
        model: 'gemini-pro',
        inputSize: 1000,
        outputSize: 500,
        complexity: 'low'
      };

      const operation2: APIOperation = {
        type: 'image',
        model: 'gemini-vision',
        inputSize: 1,
        complexity: 'low'
      };

      costMonitor.trackAPICall(operation1, 0.05, 'gemini');
      costMonitor.trackAPICall(operation2, 0.10, 'gemini');
      
      const usage = costMonitor.getCurrentUsage();
      
      expect(usage.totalCost).toBeCloseTo(0.15, 2);
      expect(usage.requestCount).toBe(2);
      expect(usage.tokensUsed).toBe(1500); // 1000 input + 500 output from text operation
      expect(usage.quotaRemaining).toBe(99.85);
    });

    it('should handle empty usage correctly', () => {
      const usage = costMonitor.getCurrentUsage();
      
      expect(usage.totalCost).toBe(0);
      expect(usage.requestCount).toBe(0);
      expect(usage.tokensUsed).toBe(0);
      expect(usage.quotaRemaining).toBe(100.0);
    });
  });

  describe('generateCostReport', () => {
    it('should generate comprehensive cost report', () => {
      const operation1: APIOperation = {
        type: 'text',
        model: 'gemini-pro',
        inputSize: 1000,
        complexity: 'low'
      };

      const operation2: APIOperation = {
        type: 'video',
        model: 'veo',
        inputSize: 30,
        complexity: 'medium'
      };

      costMonitor.trackAPICall(operation1, 0.05, 'gemini');
      costMonitor.trackAPICall(operation2, 4.50, 'veo');
      costMonitor.trackAPICall(operation1, 0.03, 'gemini'); // Another text operation
      
      const report = costMonitor.generateCostReport();
      
      expect(report.totalCost).toBe(4.58);
      expect(report.breakdown).toHaveLength(2); // text and video operations
      expect(report.period.start).toBeInstanceOf(Date);
      expect(report.period.end).toBeInstanceOf(Date);
      
      // Check breakdown details
      const videoBreakdown = report.breakdown.find(b => b.operation === 'video');
      const textBreakdown = report.breakdown.find(b => b.operation === 'text');
      
      expect(videoBreakdown).toBeDefined();
      expect(videoBreakdown!.count).toBe(1);
      expect(videoBreakdown!.totalCost).toBe(4.50);
      
      expect(textBreakdown).toBeDefined();
      expect(textBreakdown!.count).toBe(2);
      expect(textBreakdown!.totalCost).toBe(0.08);
      expect(textBreakdown!.unitCost).toBe(0.04); // Average of 0.05 and 0.03
    });

    it('should sort breakdown by total cost descending', () => {
      costMonitor.trackAPICall({
        type: 'text',
        model: 'gemini-pro',
        inputSize: 1000,
        complexity: 'low'
      }, 0.05, 'gemini');

      costMonitor.trackAPICall({
        type: 'video',
        model: 'veo',
        inputSize: 30,
        complexity: 'low'
      }, 3.00, 'veo');

      costMonitor.trackAPICall({
        type: 'image',
        model: 'gemini-vision',
        inputSize: 1,
        complexity: 'low'
      }, 0.50, 'gemini');
      
      const report = costMonitor.generateCostReport();
      
      expect(report.breakdown[0].operation).toBe('video'); // Highest cost
      expect(report.breakdown[1].operation).toBe('image'); // Medium cost
      expect(report.breakdown[2].operation).toBe('text');  // Lowest cost
    });
  });

  describe('updateBudgetLimit', () => {
    it('should update budget limit correctly', () => {
      costMonitor.updateBudgetLimit(200.0);
      
      const usage = costMonitor.getCurrentUsage();
      expect(usage.quotaRemaining).toBe(200.0);
    });
  });

  describe('resetTracking', () => {
    it('should reset all tracking data', () => {
      // Add some tracking data
      costMonitor.trackAPICall({
        type: 'text',
        model: 'gemini-pro',
        inputSize: 1000,
        complexity: 'low'
      }, 0.05, 'gemini');

      // Verify data exists
      let usage = costMonitor.getCurrentUsage();
      expect(usage.totalCost).toBe(0.05);
      expect(usage.requestCount).toBe(1);

      // Reset and verify data is cleared
      costMonitor.resetTracking();
      usage = costMonitor.getCurrentUsage();
      
      expect(usage.totalCost).toBe(0);
      expect(usage.requestCount).toBe(0);
      expect(usage.tokensUsed).toBe(0);
      expect(usage.quotaRemaining).toBe(100.0);
    });
  });

  describe('period-based tracking', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should filter entries by daily period', () => {
      const dailyConfig: CostMonitorConfig = {
        budgetLimit: 100.0,
        warningThreshold: 0.8,
        trackingPeriod: 'daily'
      };
      const dailyMonitor = new CostMonitor(dailyConfig);

      // Set a specific date
      const testDate = new Date('2024-01-15T10:00:00Z');
      vi.setSystemTime(testDate);

      // Add entry for today
      dailyMonitor.trackAPICall({
        type: 'text',
        model: 'gemini-pro',
        inputSize: 1000,
        complexity: 'low'
      }, 0.05, 'gemini');

      // Move to yesterday and add entry
      const yesterday = new Date('2024-01-14T10:00:00Z');
      vi.setSystemTime(yesterday);
      
      dailyMonitor.trackAPICall({
        type: 'text',
        model: 'gemini-pro',
        inputSize: 1000,
        complexity: 'low'
      }, 0.10, 'gemini');

      // Move back to today
      vi.setSystemTime(testDate);

      const usage = dailyMonitor.getCurrentUsage();
      // Should only include today's entry
      expect(usage.totalCost).toBe(0.05);
      expect(usage.requestCount).toBe(1);
    });
  });
});