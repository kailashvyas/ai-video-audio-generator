/**
 * Example usage of the CostMonitor service
 */

import { CostMonitor, CostMonitorConfig } from '../services/cost-monitor';
import { APIOperation } from '../types/api';

export function demonstrateCostMonitor(): void {
  console.log('=== Cost Monitor Demonstration ===\n');

  // Initialize cost monitor with a $50 budget
  const config: CostMonitorConfig = {
    budgetLimit: 50.0,
    warningThreshold: 0.8, // Warn at 80% of budget
    trackingPeriod: 'session'
  };

  const costMonitor = new CostMonitor(config);

  // Example 1: Plan a content generation run
  console.log('1. Planning a content generation run...');
  
  const plannedOperations: APIOperation[] = [
    // Idea generation
    {
      type: 'text',
      model: 'gemini-pro',
      inputSize: 500,
      outputSize: 1000,
      complexity: 'low'
    },
    // Script generation
    {
      type: 'text',
      model: 'gemini-pro',
      inputSize: 1000,
      outputSize: 3000,
      complexity: 'medium'
    },
    // Character reference images (2 characters)
    {
      type: 'image',
      model: 'gemini-vision',
      inputSize: 2,
      complexity: 'medium'
    },
    // Video generation (5 scenes, 10 seconds each)
    {
      type: 'video',
      model: 'veo',
      inputSize: 50, // 50 seconds total
      complexity: 'high'
    },
    // Audio narration
    {
      type: 'audio',
      model: 'text-to-speech',
      inputSize: 2000, // 2000 characters
      complexity: 'low'
    }
  ];

  const budgetCheck = costMonitor.checkBudgetLimit(plannedOperations);
  
  console.log(`Estimated cost: $${budgetCheck.estimatedCost.toFixed(2)}`);
  console.log(`Can proceed: ${budgetCheck.canProceed}`);
  console.log(`Remaining budget: $${budgetCheck.remainingBudget.toFixed(2)}`);
  
  if (budgetCheck.warningMessage) {
    console.log(`⚠️  ${budgetCheck.warningMessage}`);
  }

  if (!budgetCheck.canProceed) {
    console.log('❌ Operation exceeds budget limit!');
    return;
  }

  console.log('\n2. Executing operations and tracking costs...');

  // Simulate executing the operations
  const actualCosts = [0.002, 0.006, 0.006, 10.0, 0.032]; // Realistic API costs
  const services = ['gemini', 'gemini', 'gemini', 'veo', 'gemini'];

  plannedOperations.forEach((operation, index) => {
    costMonitor.trackAPICall(operation, actualCosts[index], services[index]);
    console.log(`✅ Completed ${operation.type} operation - Cost: $${actualCosts[index].toFixed(3)}`);
  });

  // Show final usage statistics
  console.log('\n3. Final usage report:');
  const usage = costMonitor.getCurrentUsage();
  
  console.log(`Total cost: $${usage.totalCost.toFixed(2)}`);
  console.log(`Total requests: ${usage.requestCount}`);
  console.log(`Tokens used: ${usage.tokensUsed}`);
  console.log(`Remaining quota: $${usage.quotaRemaining.toFixed(2)}`);

  // Generate detailed cost report
  console.log('\n4. Detailed cost breakdown:');
  const report = costMonitor.generateCostReport();
  
  report.breakdown.forEach(item => {
    console.log(`${item.service} ${item.operation}: ${item.count} calls, $${item.totalCost.toFixed(3)} total ($${item.unitCost.toFixed(4)} avg)`);
  });

  // Example 2: Check if we can do another video generation
  console.log('\n5. Checking budget for additional video generation...');
  
  const additionalVideo: APIOperation[] = [
    {
      type: 'video',
      model: 'veo',
      inputSize: 30, // 30 seconds
      complexity: 'high'
    }
  ];

  const secondCheck = costMonitor.checkBudgetLimit(additionalVideo);
  console.log(`Additional video cost estimate: $${secondCheck.estimatedCost.toFixed(2)}`);
  console.log(`Can proceed: ${secondCheck.canProceed}`);
  
  if (secondCheck.warningMessage) {
    console.log(`⚠️  ${secondCheck.warningMessage}`);
  }

  console.log('\n=== Cost Monitor Demo Complete ===');
}

// Run the demonstration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateCostMonitor();
}