/**
 * Configuration file management for CLI
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

export interface CLIConfig {
  // API Configuration
  geminiApiKey?: string;
  musicLmApiKey?: string;
  
  // Default Generation Settings
  defaultMaxScenes: number;
  defaultBudgetLimit: number;
  defaultUseImageToVideo: boolean;
  defaultOutputFormats: string[];
  defaultQuality: 'draft' | 'standard' | 'high';
  
  // System Settings
  outputDirectory: string;
  tempDirectory: string;
  maxConcurrentRequests: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  
  // User Preferences
  autoConfirm: boolean;
  showProgressDetails: boolean;
  saveProjectHistory: boolean;
}

export class ConfigManager {
  private readonly configDir: string;
  private readonly configPath: string;
  private readonly defaultConfig: CLIConfig;

  constructor() {
    this.configDir = join(homedir(), '.ai-content-generator');
    this.configPath = join(this.configDir, 'config.json');
    
    this.defaultConfig = {
      // Default generation settings
      defaultMaxScenes: 5,
      defaultBudgetLimit: 50.00,
      defaultUseImageToVideo: false,
      defaultOutputFormats: ['mp4'],
      defaultQuality: 'standard',
      
      // System settings
      outputDirectory: './output',
      tempDirectory: './temp',
      maxConcurrentRequests: 3,
      logLevel: 'info',
      
      // User preferences
      autoConfirm: false,
      showProgressDetails: true,
      saveProjectHistory: true
    };
  }

  /**
   * Initialize configuration file with defaults
   */
  async initializeConfig(): Promise<void> {
    try {
      // Create config directory if it doesn't exist
      await this.ensureConfigDirectory();
      
      // Check if config already exists
      const exists = await this.configExists();
      if (exists) {
        console.log(chalk.yellow('Configuration file already exists. Use --show to view current settings.'));
        return;
      }

      // Write default configuration
      await fs.writeFile(this.configPath, JSON.stringify(this.defaultConfig, null, 2));
      
      console.log(chalk.green(`Configuration file created at: ${this.configPath}`));
      console.log(chalk.blue('Please update the API keys in the configuration file or use the config command.'));
      
    } catch (error) {
      throw new Error(`Failed to initialize configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load configuration from file or return defaults
   */
  async loadConfig(customPath?: string): Promise<CLIConfig> {
    try {
      const configPath = customPath || this.configPath;
      
      // Check if config file exists
      try {
        await fs.access(configPath);
      } catch {
        // Config file doesn't exist, return defaults
        return { ...this.defaultConfig };
      }

      // Read and parse config file
      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);
      
      // Merge with defaults to ensure all properties exist
      return { ...this.defaultConfig, ...config };
      
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(config: CLIConfig, customPath?: string): Promise<void> {
    try {
      await this.ensureConfigDirectory();
      
      const configPath = customPath || this.configPath;
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Set a specific configuration value
   */
  async setConfigValue(key: string, value: string): Promise<void> {
    try {
      const config = await this.loadConfig();
      
      // Parse value based on key type
      const parsedValue = this.parseConfigValue(key, value);
      
      // Update configuration
      (config as any)[key] = parsedValue;
      
      // Save updated configuration
      await this.saveConfig(config);
      
    } catch (error) {
      throw new Error(`Failed to set configuration value: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update API keys
   */
  async updateApiKeys(geminiApiKey: string, musicLmApiKey?: string): Promise<void> {
    try {
      const config = await this.loadConfig();
      
      config.geminiApiKey = geminiApiKey;
      if (musicLmApiKey) {
        config.musicLmApiKey = musicLmApiKey;
      }
      
      await this.saveConfig(config);
      
    } catch (error) {
      throw new Error(`Failed to update API keys: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update default settings
   */
  async updateDefaultSettings(settings: Partial<CLIConfig>): Promise<void> {
    try {
      const config = await this.loadConfig();
      
      // Update only the provided settings
      Object.assign(config, settings);
      
      await this.saveConfig(config);
      
    } catch (error) {
      throw new Error(`Failed to update default settings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfig(): Promise<void> {
    try {
      await this.saveConfig(this.defaultConfig);
    } catch (error) {
      throw new Error(`Failed to reset configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Check if configuration file exists
   */
  private async configExists(): Promise<boolean> {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure configuration directory exists
   */
  private async ensureConfigDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create config directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse configuration value based on key type
   */
  private parseConfigValue(key: string, value: string): any {
    // Boolean values
    if (['autoConfirm', 'showProgressDetails', 'saveProjectHistory', 'defaultUseImageToVideo'].includes(key)) {
      return value.toLowerCase() === 'true';
    }
    
    // Number values
    if (['defaultMaxScenes', 'maxConcurrentRequests'].includes(key)) {
      const num = parseInt(value);
      if (isNaN(num)) {
        throw new Error(`Invalid number value for ${key}: ${value}`);
      }
      return num;
    }
    
    // Float values
    if (['defaultBudgetLimit'].includes(key)) {
      const num = parseFloat(value);
      if (isNaN(num)) {
        throw new Error(`Invalid number value for ${key}: ${value}`);
      }
      return num;
    }
    
    // Array values
    if (['defaultOutputFormats'].includes(key)) {
      return value.split(',').map(v => v.trim());
    }
    
    // Enum values
    if (key === 'defaultQuality') {
      if (!['draft', 'standard', 'high'].includes(value)) {
        throw new Error(`Invalid quality value: ${value}. Must be draft, standard, or high`);
      }
      return value;
    }
    
    if (key === 'logLevel') {
      if (!['debug', 'info', 'warn', 'error'].includes(value)) {
        throw new Error(`Invalid log level: ${value}. Must be debug, info, warn, or error`);
      }
      return value;
    }
    
    // String values (default)
    return value;
  }
}