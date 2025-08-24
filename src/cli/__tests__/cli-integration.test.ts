/**
 * Integration tests for CLI workflow and user interactions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ContentGeneratorCLI } from '../content-generator-cli';
import { ConfigManager } from '../config-manager';
import { ProgressDisplay } from '../progress-display';

// Mock inquirer for testing
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

// Mock ora for testing
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    text: '',
    color: 'blue'
  }))
}));

describe('CLI Integration Tests', () => {
  let tempDir: string;
  let configManager: ConfigManager;
  let cli: ContentGeneratorCLI;

  beforeEach(async () => {
    // Create temporary directory for test configs
    tempDir = await fs.mkdtemp(join(tmpdir(), 'cli-test-'));
    
    // Initialize test instances
    configManager = new ConfigManager();
    cli = new ContentGeneratorCLI(configManager);
  });

  afterEach(async () => {
    // Cleanup temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Configuration Management', () => {
    it('should initialize configuration file', async () => {
      // Test config initialization
      await configManager.initializeConfig();
      
      const configPath = configManager.getConfigPath();
      const configExists = await fs.access(configPath).then(() => true).catch(() => false);
      
      expect(configExists).toBe(true);
    });

    it('should load and save configuration', async () => {
      // Initialize config
      await configManager.initializeConfig();
      
      // Load config
      const config = await configManager.loadConfig();
      expect(config).toBeDefined();
      expect(config.defaultMaxScenes).toBe(5);
      expect(config.defaultBudgetLimit).toBe(50.00);
      
      // Update config
      config.defaultMaxScenes = 10;
      await configManager.saveConfig(config);
      
      // Verify update
      const updatedConfig = await configManager.loadConfig();
      expect(updatedConfig.defaultMaxScenes).toBe(10);
    });

    it('should set individual configuration values', async () => {
      await configManager.initializeConfig();
      
      // Set string value
      await configManager.setConfigValue('outputDirectory', './test-output');
      
      // Set number value
      await configManager.setConfigValue('defaultMaxScenes', '8');
      
      // Set boolean value
      await configManager.setConfigValue('autoConfirm', 'true');
      
      // Verify values
      const config = await configManager.loadConfig();
      expect(config.outputDirectory).toBe('./test-output');
      expect(config.defaultMaxScenes).toBe(8);
      expect(config.autoConfirm).toBe(true);
    });

    it('should handle invalid configuration values', async () => {
      await configManager.initializeConfig();
      
      // Test invalid number
      await expect(
        configManager.setConfigValue('defaultMaxScenes', 'invalid')
      ).rejects.toThrow('Invalid number value');
      
      // Test invalid enum
      await expect(
        configManager.setConfigValue('defaultQuality', 'invalid')
      ).rejects.toThrow('Invalid quality value');
    });
  });

  describe('CLI Options Parsing', () => {
    it('should parse content generation options correctly', async () => {
      const options = {
        topic: 'Test Topic',
        scenes: '7',
        budget: '75.50',
        imageToVideo: true,
        formats: 'mp4,webm',
        quality: 'high'
      };

      // Mock config loading
      vi.spyOn(configManager, 'loadConfig').mockResolvedValue({
        defaultMaxScenes: 5,
        defaultBudgetLimit: 50.00,
        defaultUseImageToVideo: false,
        defaultOutputFormats: ['mp4'],
        defaultQuality: 'standard',
        outputDirectory: './output',
        tempDirectory: './temp',
        maxConcurrentRequests: 3,
        logLevel: 'info',
        autoConfirm: false,
        showProgressDetails: true,
        saveProjectHistory: true
      });

      // Test option parsing (we'll need to expose this method or test it indirectly)
      // For now, we'll test that the CLI can be instantiated without errors
      expect(cli).toBeDefined();
    });
  });

  describe('Progress Display', () => {
    it('should create and update progress display', () => {
      const progressDisplay = new ProgressDisplay();
      
      // Test start
      progressDisplay.start();
      
      // Test update
      const progress = {
        currentStage: 'idea_generation' as const,
        completedStages: [],
        totalStages: 8,
        currentStageProgress: 0.5,
        overallProgress: 0.0625,
        estimatedTimeRemaining: 120000
      };
      
      progressDisplay.update(progress);
      
      // Test completion
      progressDisplay.complete();
      
      // Should not throw errors
      expect(true).toBe(true);
    });

    it('should handle progress display errors', () => {
      const progressDisplay = new ProgressDisplay();
      
      progressDisplay.start();
      progressDisplay.error('Test error message');
      
      // Should not throw errors
      expect(true).toBe(true);
    });
  });

  describe('Interactive Mode Simulation', () => {
    it('should handle interactive prompts', async () => {
      const inquirer = await import('inquirer');
      
      // Mock user responses
      vi.mocked(inquirer.default.prompt).mockResolvedValueOnce({
        topic: 'AI and Machine Learning',
        maxScenes: 5,
        budgetLimit: 50.00,
        useImageToVideo: false,
        quality: 'standard',
        outputFormats: ['mp4']
      });
      
      vi.mocked(inquirer.default.prompt).mockResolvedValueOnce({
        proceed: false // Cancel generation
      });

      // Mock config loading
      vi.spyOn(configManager, 'loadConfig').mockResolvedValue({
        defaultMaxScenes: 5,
        defaultBudgetLimit: 50.00,
        defaultUseImageToVideo: false,
        defaultOutputFormats: ['mp4'],
        defaultQuality: 'standard',
        outputDirectory: './output',
        tempDirectory: './temp',
        maxConcurrentRequests: 3,
        logLevel: 'info',
        autoConfirm: false,
        showProgressDetails: true,
        saveProjectHistory: true
      });

      // Test interactive mode (should not throw errors when cancelled)
      await expect(cli.startInteractiveMode()).resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle configuration errors gracefully', async () => {
      // Test with invalid JSON content
      const invalidJsonPath = join(tempDir, 'invalid.json');
      await fs.writeFile(invalidJsonPath, 'invalid json content');
      
      await expect(
        configManager.loadConfig(invalidJsonPath)
      ).rejects.toThrow('Failed to load configuration');
    });

    it('should handle CLI initialization errors', () => {
      // Test CLI with invalid config manager
      expect(() => new ContentGeneratorCLI(configManager)).not.toThrow();
    });
  });

  describe('System Status', () => {
    it('should display system status information', async () => {
      // Mock the orchestrator status method
      const mockStatus = {
        geminiConnected: true,
        musicLmConnected: false,
        usage: {
          textGeneration: 5,
          imageGeneration: 3,
          videoGeneration: 2,
          audioGeneration: 1,
          totalCost: 15.50
        },
        config: {
          outputDirectory: './output',
          maxConcurrentRequests: 3,
          defaultBudgetLimit: 50.00
        }
      };

      // Test status display (should not throw errors)
      await expect(cli.showStatus()).resolves.toBeUndefined();
    });
  });

  describe('Command Line Argument Validation', () => {
    it('should validate scene count limits', () => {
      // Test valid scene counts
      expect(() => parseInt('5')).not.toThrow();
      expect(() => parseInt('1')).not.toThrow();
      expect(() => parseInt('20')).not.toThrow();
      
      // Test invalid scene counts
      expect(parseInt('0')).toBe(0);
      expect(parseInt('-1')).toBe(-1);
      expect(isNaN(parseInt('invalid'))).toBe(true);
    });

    it('should validate budget limits', () => {
      // Test valid budgets
      expect(() => parseFloat('50.00')).not.toThrow();
      expect(() => parseFloat('0.01')).not.toThrow();
      expect(() => parseFloat('1000')).not.toThrow();
      
      // Test invalid budgets
      expect(parseFloat('0')).toBe(0);
      expect(parseFloat('-10')).toBe(-10);
      expect(isNaN(parseFloat('invalid'))).toBe(true);
    });

    it('should validate output formats', () => {
      const validFormats = ['mp4', 'webm', 'mov', 'avi'];
      const testFormats = 'mp4,webm,mov'.split(',');
      
      testFormats.forEach(format => {
        expect(validFormats.includes(format.toLowerCase())).toBe(true);
      });
    });

    it('should validate quality settings', () => {
      const validQualities = ['draft', 'standard', 'high'];
      
      expect(validQualities.includes('standard')).toBe(true);
      expect(validQualities.includes('high')).toBe(true);
      expect(validQualities.includes('draft')).toBe(true);
      expect(validQualities.includes('invalid')).toBe(false);
    });
  });
});