/**
 * Main CLI interface for content generation
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ContentConfig, ContentResult, GenerationProgress } from '../types';
import { ContentPipelineOrchestrator } from '../services/content-pipeline-orchestrator';
import { ConfigManager } from './config-manager';
import { ProgressDisplay } from './progress-display';
import { getValidatedConfig } from '../config';

export interface CLIOptions {
  topic?: string;
  scenes?: string;
  budget?: string;
  imageToVideo?: boolean;
  formats?: string;
  quality?: string;
  config?: string;
}

export interface ConfigOptions {
  init?: boolean;
  show?: boolean;
  set?: string;
}

export class ContentGeneratorCLI {
  private orchestrator: ContentPipelineOrchestrator;
  private progressDisplay: ProgressDisplay;

  constructor(private configManager: ConfigManager) {
    const envConfig = getValidatedConfig();
    this.orchestrator = new ContentPipelineOrchestrator(envConfig);
    this.progressDisplay = new ProgressDisplay();
  }

  /**
   * Generate content with provided options
   */
  async generateContent(options: CLIOptions): Promise<void> {
    try {
      console.log(chalk.blue.bold('🎬 AI Content Generator\n'));

      // Load configuration
      const config = await this.loadConfiguration(options.config);
      
      // Parse and validate options
      const contentConfig = await this.parseContentOptions(options, config);
      
      // Show generation summary
      await this.showGenerationSummary(contentConfig);
      
      // Confirm before proceeding
      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'Proceed with content generation?',
        default: true
      }]);

      if (!proceed) {
        console.log(chalk.yellow('Generation cancelled.'));
        return;
      }

      // Start generation with progress tracking
      await this.runGenerationWithProgress(contentConfig);

    } catch (error) {
      console.error(chalk.red('Generation failed:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * Start interactive content generation wizard
   */
  async startInteractiveMode(): Promise<void> {
    try {
      console.log(chalk.blue.bold('🎬 Interactive Content Generation Wizard\n'));

      // Welcome and topic selection
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'topic',
          message: 'What topic would you like to create content about?',
          validate: (input: string) => input.trim().length > 0 || 'Please enter a topic'
        },
        {
          type: 'number',
          name: 'maxScenes',
          message: 'Maximum number of video scenes to generate:',
          default: 5,
          validate: (input: number) => input > 0 && input <= 20 || 'Please enter a number between 1 and 20'
        },
        {
          type: 'number',
          name: 'budgetLimit',
          message: 'Budget limit (USD):',
          default: 50.00,
          validate: (input: number) => input > 0 || 'Please enter a positive number'
        },
        {
          type: 'confirm',
          name: 'useImageToVideo',
          message: 'Use image-to-video generation for better character consistency?',
          default: false
        },
        {
          type: 'list',
          name: 'quality',
          message: 'Generation quality:',
          choices: [
            { name: 'Draft (faster, lower cost)', value: 'draft' },
            { name: 'Standard (balanced)', value: 'standard' },
            { name: 'High (slower, higher cost)', value: 'high' }
          ],
          default: 'standard'
        },
        {
          type: 'checkbox',
          name: 'outputFormats',
          message: 'Output formats:',
          choices: [
            { name: 'MP4 (recommended)', value: 'mp4', checked: true },
            { name: 'WebM', value: 'webm' },
            { name: 'MOV', value: 'mov' }
          ],
          validate: (input: string[]) => input.length > 0 || 'Please select at least one format'
        }
      ]);

      const contentConfig: ContentConfig = {
        topic: answers.topic,
        maxScenes: answers.maxScenes,
        budgetLimit: answers.budgetLimit,
        useImageToVideo: answers.useImageToVideo,
        outputFormats: answers.outputFormats,
        quality: answers.quality
      };

      // Show summary and confirm
      await this.showGenerationSummary(contentConfig);
      
      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'Start generation with these settings?',
        default: true
      }]);

      if (!proceed) {
        console.log(chalk.yellow('Generation cancelled.'));
        return;
      }

      // Start generation
      await this.runGenerationWithProgress(contentConfig);

    } catch (error) {
      console.error(chalk.red('Interactive mode failed:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * Manage configuration settings
   */
  async manageConfig(options: ConfigOptions): Promise<void> {
    try {
      if (options.init) {
        await this.configManager.initializeConfig();
        console.log(chalk.green('✅ Configuration file initialized successfully!'));
        return;
      }

      if (options.show) {
        const config = await this.configManager.loadConfig();
        console.log(chalk.blue.bold('Current Configuration:\n'));
        console.log(JSON.stringify(config, null, 2));
        return;
      }

      if (options.set) {
        const [key, value] = options.set.split('=');
        if (!key || !value) {
          throw new Error('Invalid format. Use: --set key=value');
        }
        await this.configManager.setConfigValue(key, value);
        console.log(chalk.green(`✅ Set ${key} = ${value}`));
        return;
      }

      // Interactive config management
      const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'View current configuration', value: 'view' },
          { name: 'Update API keys', value: 'keys' },
          { name: 'Update default settings', value: 'defaults' },
          { name: 'Reset to defaults', value: 'reset' }
        ]
      }]);

      switch (action) {
        case 'view':
          const config = await this.configManager.loadConfig();
          console.log(chalk.blue.bold('Current Configuration:\n'));
          console.log(JSON.stringify(config, null, 2));
          break;
        case 'keys':
          await this.updateApiKeys();
          break;
        case 'defaults':
          await this.updateDefaultSettings();
          break;
        case 'reset':
          await this.configManager.resetConfig();
          console.log(chalk.green('✅ Configuration reset to defaults'));
          break;
      }

    } catch (error) {
      console.error(chalk.red('Configuration management failed:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * Show system status and API usage
   */
  async showStatus(): Promise<void> {
    const spinner = ora('Checking system status...').start();
    
    try {
      // Check API connectivity and get usage stats
      const status = await this.orchestrator.getSystemStatus();
      
      spinner.stop();
      
      console.log(chalk.blue.bold('🔍 System Status\n'));
      
      console.log(chalk.green('✅ API Connectivity:'));
      console.log(`  Gemini API: ${status.geminiConnected ? '✅ Connected' : '❌ Disconnected'}`);
      console.log(`  MusicLM API: ${status.musicLmConnected ? '✅ Connected' : '❌ Disconnected'}\n`);
      
      console.log(chalk.blue('📊 Current Usage:'));
      console.log(`  Text Generation: ${status.usage.textGeneration} requests`);
      console.log(`  Image Generation: ${status.usage.imageGeneration} requests`);
      console.log(`  Video Generation: ${status.usage.videoGeneration} requests`);
      console.log(`  Audio Generation: ${status.usage.audioGeneration} requests`);
      console.log(`  Total Cost: $${status.usage.totalCost.toFixed(2)}\n`);
      
      console.log(chalk.yellow('⚙️  Configuration:'));
      console.log(`  Output Directory: ${status.config.outputDirectory}`);
      console.log(`  Max Concurrent: ${status.config.maxConcurrentRequests}`);
      console.log(`  Default Budget: $${status.config.defaultBudgetLimit}`);

    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Failed to get system status:'), error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Parse content options from CLI arguments
   */
  private async parseContentOptions(options: CLIOptions, config: any): Promise<ContentConfig> {
    return {
      topic: options.topic,
      maxScenes: parseInt(options.scenes || config.defaultMaxScenes || '5'),
      budgetLimit: parseFloat(options.budget || config.defaultBudgetLimit || '50.00'),
      useImageToVideo: options.imageToVideo || config.defaultUseImageToVideo || false,
      outputFormats: options.formats ? options.formats.split(',') : (config.defaultOutputFormats || ['mp4']),
      quality: (options.quality as any) || config.defaultQuality || 'standard'
    };
  }

  /**
   * Load configuration from file or use defaults
   */
  private async loadConfiguration(configPath?: string): Promise<any> {
    try {
      return await this.configManager.loadConfig(configPath);
    } catch (error) {
      console.log(chalk.yellow('⚠️  No configuration file found, using defaults'));
      return {};
    }
  }

  /**
   * Show generation summary before starting
   */
  private async showGenerationSummary(config: ContentConfig): Promise<void> {
    console.log(chalk.blue.bold('📋 Generation Summary:\n'));
    console.log(`${chalk.cyan('Topic:')} ${config.topic || 'Random topic will be generated'}`);
    console.log(`${chalk.cyan('Max Scenes:')} ${config.maxScenes}`);
    console.log(`${chalk.cyan('Budget Limit:')} $${config.budgetLimit.toFixed(2)}`);
    console.log(`${chalk.cyan('Generation Mode:')} ${config.useImageToVideo ? 'Image-to-Video' : 'Text-to-Video'}`);
    console.log(`${chalk.cyan('Quality:')} ${config.quality}`);
    console.log(`${chalk.cyan('Output Formats:')} ${config.outputFormats.join(', ')}\n`);
    
    // Estimate costs
    const estimatedCost = await this.orchestrator.estimateGenerationCost(config);
    console.log(`${chalk.yellow('Estimated Cost:')} $${estimatedCost.toFixed(2)}\n`);
  }

  /**
   * Run generation with real-time progress display
   */
  private async runGenerationWithProgress(config: ContentConfig): Promise<void> {
    console.log(chalk.green.bold('🚀 Starting content generation...\n'));

    // Set up progress tracking
    this.progressDisplay.start();
    
    const progressCallback = (progress: GenerationProgress) => {
      this.progressDisplay.update(progress);
    };

    try {
      const result = await this.orchestrator.generateContent(config, progressCallback);
      
      this.progressDisplay.complete();
      
      if (result.success) {
        console.log(chalk.green.bold('\n🎉 Content generation completed successfully!\n'));
        this.displayResults(result);
      } else {
        console.log(chalk.red.bold('\n❌ Content generation completed with errors:\n'));
        result.errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
        if (result.warnings.length > 0) {
          console.log(chalk.yellow('\nWarnings:'));
          result.warnings.forEach(warning => console.log(chalk.yellow(`  • ${warning}`)));
        }
      }

    } catch (error) {
      this.progressDisplay.error(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Display generation results
   */
  private displayResults(result: ContentResult): void {
    console.log(chalk.blue('📊 Generation Summary:'));
    console.log(`  Duration: ${Math.round(result.summary.totalDuration / 1000)}s`);
    console.log(`  Scenes Generated: ${result.summary.scenesGenerated}`);
    console.log(`  Characters Created: ${result.summary.charactersCreated}`);
    console.log(`  Total Cost: $${result.summary.totalCost.toFixed(2)}`);
    console.log(`  API Calls: ${result.summary.apiCallsUsed}\n`);
    
    if (result.finalOutputPath) {
      console.log(chalk.green(`📁 Final Output: ${result.finalOutputPath}\n`));
    }
    
    if (result.summary.outputFiles.length > 0) {
      console.log(chalk.blue('📄 Generated Files:'));
      result.summary.outputFiles.forEach(file => {
        console.log(`  • ${file}`);
      });
    }
  }

  /**
   * Update API keys interactively
   */
  private async updateApiKeys(): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'geminiApiKey',
        message: 'Gemini API Key:',
        mask: '*'
      },
      {
        type: 'password',
        name: 'musicLmApiKey',
        message: 'MusicLM API Key (optional):',
        mask: '*'
      }
    ]);

    await this.configManager.updateApiKeys(answers.geminiApiKey, answers.musicLmApiKey);
    console.log(chalk.green('✅ API keys updated successfully!'));
  }

  /**
   * Update default settings interactively
   */
  private async updateDefaultSettings(): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: 'number',
        name: 'defaultMaxScenes',
        message: 'Default maximum scenes:',
        default: 5
      },
      {
        type: 'number',
        name: 'defaultBudgetLimit',
        message: 'Default budget limit (USD):',
        default: 50.00
      },
      {
        type: 'list',
        name: 'defaultQuality',
        message: 'Default quality:',
        choices: ['draft', 'standard', 'high'],
        default: 'standard'
      }
    ]);

    await this.configManager.updateDefaultSettings(answers);
    console.log(chalk.green('✅ Default settings updated successfully!'));
  }
}