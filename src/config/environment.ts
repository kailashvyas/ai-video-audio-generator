/**
 * Environment configuration management
 */

import { config } from 'dotenv';
import { EnvironmentConfig } from '../types';

// Load environment variables
config();

/**
 * Validates and returns the environment configuration
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const requiredEnvVars = ['GEMINI_API_KEY'];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    geminiApiKey: process.env.GEMINI_API_KEY!,
    musicLmApiKey: process.env.MUSICLM_API_KEY || '', // Optional - MusicLM access limited
    outputDirectory: process.env.OUTPUT_DIRECTORY || './output',
    tempDirectory: process.env.TEMP_DIRECTORY || './temp',
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '3'),
    defaultBudgetLimit: parseFloat(process.env.DEFAULT_BUDGET_LIMIT || '100.00'),
    logLevel: (process.env.LOG_LEVEL as any) || 'info'
  };
}

/**
 * Validates the environment configuration
 */
export function validateEnvironmentConfig(config: EnvironmentConfig): void {
  if (!config.geminiApiKey) {
    throw new Error('Gemini API key is required');
  }

  if (config.maxConcurrentRequests < 1 || config.maxConcurrentRequests > 10) {
    throw new Error('Max concurrent requests must be between 1 and 10');
  }

  if (config.defaultBudgetLimit < 0) {
    throw new Error('Default budget limit must be non-negative');
  }

  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(config.logLevel)) {
    throw new Error(`Log level must be one of: ${validLogLevels.join(', ')}`);
  }
}

/**
 * Get validated environment configuration
 */
export function getValidatedConfig(): EnvironmentConfig {
  const config = getEnvironmentConfig();
  validateEnvironmentConfig(config);
  return config;
}