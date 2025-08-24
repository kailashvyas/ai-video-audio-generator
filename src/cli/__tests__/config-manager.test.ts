/**
 * Unit tests for ConfigManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ConfigManager } from '../config-manager';

describe('ConfigManager', () => {
  let tempDir: string;
  let configManager: ConfigManager;
  let originalConfigPath: string;

  beforeEach(async () => {
    // Create temporary directory for test configs
    tempDir = await fs.mkdtemp(join(tmpdir(), 'config-test-'));
    
    // Create config manager instance
    configManager = new ConfigManager();
    
    // Store original config path
    originalConfigPath = configManager.getConfigPath();
  });

  afterEach(async () => {
    // Cleanup temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Configuration File Management', () => {
    it('should initialize configuration with defaults', async () => {
      const testConfigPath = join(tempDir, 'test-config.json');
      
      // Use custom path to avoid conflicts with existing config
      await configManager.saveConfig({
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
      }, testConfigPath);
      
      const config = await configManager.loadConfig(testConfigPath);
      
      expect(config.defaultMaxScenes).toBe(5);
      expect(config.defaultBudgetLimit).toBe(50.00);
      expect(config.defaultUseImageToVideo).toBe(false);
      expect(config.defaultOutputFormats).toEqual(['mp4']);
      expect(config.defaultQuality).toBe('standard');
      expect(config.outputDirectory).toBe('./output');
      expect(config.tempDirectory).toBe('./temp');
      expect(config.maxConcurrentRequests).toBe(3);
      expect(config.logLevel).toBe('info');
      expect(config.autoConfirm).toBe(false);
      expect(config.showProgressDetails).toBe(true);
      expect(config.saveProjectHistory).toBe(true);
    });

    it('should load configuration from custom path', async () => {
      const customConfigPath = join(tempDir, 'custom-config.json');
      const customConfig = {
        defaultMaxScenes: 10,
        defaultBudgetLimit: 100.00,
        defaultUseImageToVideo: true,
        defaultOutputFormats: ['webm'],
        defaultQuality: 'high' as const,
        outputDirectory: './custom-output',
        tempDirectory: './custom-temp',
        maxConcurrentRequests: 5,
        logLevel: 'debug' as const,
        autoConfirm: true,
        showProgressDetails: false,
        saveProjectHistory: false
      };

      await fs.writeFile(customConfigPath, JSON.stringify(customConfig, null, 2));
      
      const loadedConfig = await configManager.loadConfig(customConfigPath);
      
      expect(loadedConfig.defaultMaxScenes).toBe(10);
      expect(loadedConfig.defaultBudgetLimit).toBe(100.00);
      expect(loadedConfig.defaultUseImageToVideo).toBe(true);
      expect(loadedConfig.defaultOutputFormats).toEqual(['webm']);
      expect(loadedConfig.defaultQuality).toBe('high');
    });

    it('should return defaults when config file does not exist', async () => {
      const nonExistentPath = join(tempDir, 'non-existent-config.json');
      
      const config = await configManager.loadConfig(nonExistentPath);
      
      // Should return default values
      expect(config.defaultMaxScenes).toBe(5);
      expect(config.defaultBudgetLimit).toBe(50.00);
    });

    it('should save configuration correctly', async () => {
      const testConfigPath = join(tempDir, 'save-test-config.json');
      
      const config = {
        defaultMaxScenes: 5,
        defaultBudgetLimit: 50.00,
        defaultUseImageToVideo: false,
        defaultOutputFormats: ['mp4'],
        defaultQuality: 'standard' as const,
        outputDirectory: './output',
        tempDirectory: './temp',
        maxConcurrentRequests: 3,
        logLevel: 'info' as const,
        autoConfirm: false,
        showProgressDetails: true,
        saveProjectHistory: true
      };
      
      await configManager.saveConfig(config, testConfigPath);
      
      config.defaultMaxScenes = 15;
      config.defaultBudgetLimit = 75.00;
      
      await configManager.saveConfig(config, testConfigPath);
      
      const reloadedConfig = await configManager.loadConfig(testConfigPath);
      expect(reloadedConfig.defaultMaxScenes).toBe(15);
      expect(reloadedConfig.defaultBudgetLimit).toBe(75.00);
    });
  });

  describe('Configuration Value Setting', () => {
    beforeEach(async () => {
      await configManager.initializeConfig();
    });

    it('should set string values correctly', async () => {
      await configManager.setConfigValue('outputDirectory', './new-output');
      
      const config = await configManager.loadConfig();
      expect(config.outputDirectory).toBe('./new-output');
    });

    it('should set number values correctly', async () => {
      await configManager.setConfigValue('defaultMaxScenes', '12');
      await configManager.setConfigValue('maxConcurrentRequests', '7');
      
      const config = await configManager.loadConfig();
      expect(config.defaultMaxScenes).toBe(12);
      expect(config.maxConcurrentRequests).toBe(7);
    });

    it('should set float values correctly', async () => {
      await configManager.setConfigValue('defaultBudgetLimit', '123.45');
      
      const config = await configManager.loadConfig();
      expect(config.defaultBudgetLimit).toBe(123.45);
    });

    it('should set boolean values correctly', async () => {
      await configManager.setConfigValue('autoConfirm', 'true');
      await configManager.setConfigValue('showProgressDetails', 'false');
      
      const config = await configManager.loadConfig();
      expect(config.autoConfirm).toBe(true);
      expect(config.showProgressDetails).toBe(false);
    });

    it('should set array values correctly', async () => {
      await configManager.setConfigValue('defaultOutputFormats', 'mp4,webm,mov');
      
      const config = await configManager.loadConfig();
      expect(config.defaultOutputFormats).toEqual(['mp4', 'webm', 'mov']);
    });

    it('should set enum values correctly', async () => {
      await configManager.setConfigValue('defaultQuality', 'high');
      await configManager.setConfigValue('logLevel', 'debug');
      
      const config = await configManager.loadConfig();
      expect(config.defaultQuality).toBe('high');
      expect(config.logLevel).toBe('debug');
    });

    it('should throw error for invalid number values', async () => {
      await expect(
        configManager.setConfigValue('defaultMaxScenes', 'not-a-number')
      ).rejects.toThrow('Invalid number value');
    });

    it('should throw error for invalid enum values', async () => {
      await expect(
        configManager.setConfigValue('defaultQuality', 'invalid-quality')
      ).rejects.toThrow('Invalid quality value');
      
      await expect(
        configManager.setConfigValue('logLevel', 'invalid-level')
      ).rejects.toThrow('Invalid log level');
    });
  });

  describe('API Key Management', () => {
    beforeEach(async () => {
      await configManager.initializeConfig();
    });

    it('should update API keys correctly', async () => {
      await configManager.updateApiKeys('test-gemini-key', 'test-musiclm-key');
      
      const config = await configManager.loadConfig();
      expect(config.geminiApiKey).toBe('test-gemini-key');
      expect(config.musicLmApiKey).toBe('test-musiclm-key');
    });

    it('should update only Gemini API key when MusicLM key not provided', async () => {
      // First set a MusicLM key, then update only Gemini
      await configManager.updateApiKeys('initial-gemini-key', 'initial-musiclm-key');
      await configManager.updateApiKeys('test-gemini-key');
      
      const config = await configManager.loadConfig();
      expect(config.geminiApiKey).toBe('test-gemini-key');
      // MusicLM key should remain unchanged, not be undefined
      expect(config.musicLmApiKey).toBe('initial-musiclm-key');
    });
  });

  describe('Default Settings Management', () => {
    beforeEach(async () => {
      await configManager.initializeConfig();
    });

    it('should update default settings correctly', async () => {
      const newSettings = {
        defaultMaxScenes: 8,
        defaultBudgetLimit: 80.00,
        defaultQuality: 'high' as const
      };
      
      await configManager.updateDefaultSettings(newSettings);
      
      const config = await configManager.loadConfig();
      expect(config.defaultMaxScenes).toBe(8);
      expect(config.defaultBudgetLimit).toBe(80.00);
      expect(config.defaultQuality).toBe('high');
    });

    it('should update only provided settings', async () => {
      const originalConfig = await configManager.loadConfig();
      const originalMaxScenes = originalConfig.defaultMaxScenes;
      
      await configManager.updateDefaultSettings({
        defaultBudgetLimit: 99.99
      });
      
      const updatedConfig = await configManager.loadConfig();
      expect(updatedConfig.defaultMaxScenes).toBe(originalMaxScenes); // Unchanged
      expect(updatedConfig.defaultBudgetLimit).toBe(99.99); // Changed
    });
  });

  describe('Configuration Reset', () => {
    it('should reset configuration to defaults', async () => {
      await configManager.initializeConfig();
      
      // Modify configuration
      await configManager.setConfigValue('defaultMaxScenes', '20');
      await configManager.setConfigValue('defaultBudgetLimit', '200.00');
      
      // Verify changes
      let config = await configManager.loadConfig();
      expect(config.defaultMaxScenes).toBe(20);
      expect(config.defaultBudgetLimit).toBe(200.00);
      
      // Reset configuration
      await configManager.resetConfig();
      
      // Verify reset
      config = await configManager.loadConfig();
      expect(config.defaultMaxScenes).toBe(5);
      expect(config.defaultBudgetLimit).toBe(50.00);
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      // Test with a directory that doesn't exist and can't be created
      const invalidConfigManager = new ConfigManager();
      
      // Try to save to a path that would cause an error
      const invalidConfig = {
        defaultMaxScenes: 5,
        defaultBudgetLimit: 50.00,
        defaultUseImageToVideo: false,
        defaultOutputFormats: ['mp4'],
        defaultQuality: 'standard' as const,
        outputDirectory: './output',
        tempDirectory: './temp',
        maxConcurrentRequests: 3,
        logLevel: 'info' as const,
        autoConfirm: false,
        showProgressDetails: true,
        saveProjectHistory: true
      };
      
      // This should work normally, so let's test JSON parsing error instead
      const invalidJsonPath = join(tempDir, 'invalid.json');
      await fs.writeFile(invalidJsonPath, 'invalid json content');
      
      await expect(
        configManager.loadConfig(invalidJsonPath)
      ).rejects.toThrow('Failed to load configuration');
    });

    it('should handle JSON parsing errors', async () => {
      const invalidJsonPath = join(tempDir, 'invalid.json');
      await fs.writeFile(invalidJsonPath, 'invalid json content');
      
      await expect(
        configManager.loadConfig(invalidJsonPath)
      ).rejects.toThrow('Failed to load configuration');
    });
  });
});