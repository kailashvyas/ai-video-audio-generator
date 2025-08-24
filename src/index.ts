/**
 * Main entry point for the AI Content Generator
 */

import { getValidatedConfig } from './config';

async function main() {
  try {
    // Validate environment configuration
    const config = getValidatedConfig();
    console.log('AI Content Generator initialized successfully');
    console.log(`Output directory: ${config.outputDirectory}`);
    console.log(`Max concurrent requests: ${config.maxConcurrentRequests}`);
    console.log(`Default budget limit: $${config.defaultBudgetLimit}`);
    
    // CLI interface is now available
    console.log('Ready for content generation...');
    console.log('Use "npm run cli" or run the CLI directly for interactive mode.');
    
  } catch (error) {
    console.error('Failed to initialize AI Content Generator:', error);
    process.exit(1);
  }
}

// Run the application
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}