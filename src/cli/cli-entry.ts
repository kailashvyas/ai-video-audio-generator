#!/usr/bin/env node

/**
 * CLI entry point for the AI Content Generator
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { ContentGeneratorCLI } from './content-generator-cli';
import { ConfigManager } from './config-manager';
import { getValidatedConfig } from '../config';

const program = new Command();

async function main() {
  try {
    // Initialize configuration
    const envConfig = getValidatedConfig();
    const configManager = new ConfigManager();
    const cli = new ContentGeneratorCLI(configManager);

    program
      .name('ai-content-generator')
      .description('AI-powered multimedia content generation system')
      .version('1.0.0');

    // Generate command
    program
      .command('generate')
      .alias('gen')
      .description('Generate multimedia content from a topic or idea')
      .option('-t, --topic <topic>', 'Content topic or theme')
      .option('-s, --scenes <number>', 'Maximum number of video scenes', '5')
      .option('-b, --budget <amount>', 'Budget limit in USD', '50.00')
      .option('--image-to-video', 'Use image-to-video generation for consistency')
      .option('--formats <formats>', 'Output formats (comma-separated)', 'mp4')
      .option('--quality <quality>', 'Generation quality (draft|standard|high)', 'standard')
      .option('-c, --config <path>', 'Custom configuration file path')
      .action(async (options) => {
        await cli.generateContent(options);
      });

    // Interactive mode
    program
      .command('interactive')
      .alias('i')
      .description('Start interactive content generation wizard')
      .action(async () => {
        await cli.startInteractiveMode();
      });

    // Configuration commands
    program
      .command('config')
      .description('Manage configuration settings')
      .option('--init', 'Initialize configuration file')
      .option('--show', 'Show current configuration')
      .option('--set <key=value>', 'Set configuration value')
      .action(async (options) => {
        await cli.manageConfig(options);
      });

    // Status command
    program
      .command('status')
      .description('Show system status and API usage')
      .action(async () => {
        await cli.showStatus();
      });

    // Parse command line arguments
    await program.parseAsync(process.argv);

  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}