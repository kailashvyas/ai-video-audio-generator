/**
 * Comprehensive error handling and recovery system for AI Content Generator
 */

import { RetryHandler, RetryConfig } from './retry-handler';
import { APIError, ErrorResolution } from '../types/api';
import { ContentProject } from '../types/content';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ErrorHandlerConfig {
  retryConfig?: Partial<RetryConfig>;
  progressStateDir?: string;
  enableDetailedLogging?: boolean;
  fallbackStrategies?: FallbackStrategy[];
}

export interface FallbackStrategy {
  errorCode: string;
  strategy: 'simplify' | 'alternative' | 'skip' | 'manual';
  description: string;
}

export interface ProgressState {
  projectId: string;
  currentStage: string;
  completedStages: string[];
  failedOperations: FailedOperation[];
  timestamp: Date;
  recoveryOptions: RecoveryOption[];
}

export interface FailedOperation {
  operation: string;
  error: APIError;
  timestamp: Date;
  retryCount: number;
  context: Record<string, any>;
}

export interface RecoveryOption {
  type: 'retry' | 'skip' | 'fallback' | 'manual';
  description: string;
  estimatedCost?: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ErrorReport {
  projectId: string;
  errors: FailedOperation[];
  recoveryActions: RecoveryAction[];
  systemStatus: SystemStatus;
  recommendations: string[];
  timestamp: Date;
}

export interface RecoveryAction {
  action: string;
  success: boolean;
  timestamp: Date;
  details: string;
}

export interface SystemStatus {
  apiServices: ServiceStatus[];
  resourceUsage: ResourceUsage;
  degradationLevel: 'none' | 'partial' | 'severe';
}

export interface ServiceStatus {
  service: string;
  status: 'available' | 'degraded' | 'unavailable';
  lastCheck: Date;
  responseTime?: number;
  errorRate: number;
}

export interface ResourceUsage {
  memoryUsage: number;
  diskUsage: number;
  networkLatency: number;
}

export class ErrorHandler {
  private retryHandler: RetryHandler;
  private config: ErrorHandlerConfig;
  private progressStateDir: string;
  private errorLog: FailedOperation[] = [];
  private recoveryActions: RecoveryAction[] = [];
  private serviceStatuses: Map<string, ServiceStatus> = new Map();

  constructor(config: ErrorHandlerConfig = {}) {
    this.config = {
      progressStateDir: config.progressStateDir || './progress-states',
      enableDetailedLogging: config.enableDetailedLogging !== false,
      fallbackStrategies: config.fallbackStrategies || this.getDefaultFallbackStrategies(),
      ...config
    };

    this.retryHandler = new RetryHandler(config.retryConfig);
    this.progressStateDir = this.config.progressStateDir!;
    this.initializeProgressStateDir();
  }

  /**
   * Handle API errors with comprehensive recovery strategies
   */
  async handleAPIError(error: APIError, context: Record<string, any> = {}): Promise<ErrorResolution> {
    const failedOperation: FailedOperation = {
      operation: context.operation || 'unknown',
      error,
      timestamp: new Date(),
      retryCount: context.retryCount || 0,
      context
    };

    this.errorLog.push(failedOperation);

    if (this.config.enableDetailedLogging) {
      this.logError(failedOperation);
    }

    // Update service status
    if (context.service) {
      this.updateServiceStatus(context.service, error);
    }

    // Get resolution strategy
    const resolution = this.getErrorResolution(error, context);

    // Log recovery action
    this.logRecoveryAction({
      action: `Attempting ${resolution.action} for ${error.code}`,
      success: false, // Will be updated when action completes
      timestamp: new Date(),
      details: error.message
    });

    return resolution;
  }

  /**
   * Execute operation with comprehensive error handling
   */
  async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    context: {
      operationName: string;
      service?: string;
      projectId?: string;
      stage?: string;
    }
  ): Promise<T> {
    try {
      // Save progress state before operation
      if (context.projectId && context.stage) {
        await this.saveProgressCheckpoint(context.projectId, context.stage);
      }

      const result = await this.retryHandler.executeWithRetry(
        operation,
        context.operationName
      );

      // Log successful operation
      this.logRecoveryAction({
        action: `Successfully completed ${context.operationName}`,
        success: true,
        timestamp: new Date(),
        details: 'Operation completed without errors'
      });

      return result;

    } catch (error) {
      const apiError = this.normalizeError(error);
      const resolution = await this.handleAPIError(apiError, {
        operation: context.operationName,
        service: context.service,
        projectId: context.projectId,
        stage: context.stage
      });

      if (resolution.action === 'abort') {
        throw error;
      }

      // Attempt recovery based on resolution
      return this.attemptRecovery(operation, resolution, context);
    }
  }

  /**
   * Save progress state for recovery
   */
  async saveProgressState(project: ContentProject, currentStage: string): Promise<void> {
    const progressState: ProgressState = {
      projectId: project.id,
      currentStage,
      completedStages: this.getCompletedStages(project),
      failedOperations: this.errorLog.filter(op => 
        op.context.projectId === project.id
      ),
      timestamp: new Date(),
      recoveryOptions: this.generateRecoveryOptions(project, currentStage)
    };

    const filePath = path.join(this.progressStateDir, `${project.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(progressState, null, 2));

    if (this.config.enableDetailedLogging) {
      console.log(`Progress state saved for project ${project.id} at stage ${currentStage}`);
    }
  }

  /**
   * Load progress state for recovery
   */
  async loadProgressState(projectId: string): Promise<ProgressState | null> {
    try {
      const filePath = path.join(this.progressStateDir, `${projectId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const progressState = JSON.parse(data) as ProgressState;
      
      if (this.config.enableDetailedLogging) {
        console.log(`Progress state loaded for project ${projectId}`);
      }

      return progressState;
    } catch (error) {
      if (this.config.enableDetailedLogging) {
        console.warn(`Could not load progress state for project ${projectId}:`, error);
      }
      return null;
    }
  }

  /**
   * Implement graceful degradation when services are unavailable
   */
  async handleServiceDegradation(service: string): Promise<boolean> {
    const status = this.serviceStatuses.get(service);
    
    if (!status || status.status === 'available') {
      return true; // Service is available
    }

    if (status.status === 'degraded') {
      // Implement degraded mode strategies
      switch (service) {
        case 'gemini-video':
          console.warn('Video generation degraded - using simplified prompts');
          return true;
        case 'gemini-audio':
          console.warn('Audio generation degraded - skipping background music');
          return true;
        case 'gemini-image':
          console.warn('Image generation degraded - using text-to-video only');
          return true;
        default:
          return true;
      }
    }

    if (status.status === 'unavailable') {
      // Implement fallback strategies
      switch (service) {
        case 'gemini-video':
          throw new Error('Video generation service unavailable - cannot proceed');
        case 'gemini-audio':
          console.warn('Audio service unavailable - generating silent video');
          return false;
        case 'gemini-image':
          console.warn('Image service unavailable - using text-to-video workflow');
          return false;
        default:
          return false;
      }
    }

    return false;
  }

  /**
   * Generate detailed error report
   */
  generateErrorReport(projectId?: string): ErrorReport {
    const filteredErrors = projectId 
      ? this.errorLog.filter(op => op.context.projectId === projectId)
      : this.errorLog;

    const systemStatus = this.getSystemStatus();
    const recommendations = this.generateRecommendations(filteredErrors, systemStatus);

    return {
      projectId: projectId || 'system',
      errors: filteredErrors,
      recoveryActions: this.recoveryActions,
      systemStatus,
      recommendations,
      timestamp: new Date()
    };
  }

  /**
   * Clear error history for a project
   */
  clearProjectErrors(projectId: string): void {
    this.errorLog = this.errorLog.filter(op => op.context.projectId !== projectId);
    this.recoveryActions = this.recoveryActions.filter(action => 
      !action.details.includes(projectId)
    );
  }

  // Private helper methods

  private async initializeProgressStateDir(): Promise<void> {
    try {
      await fs.mkdir(this.progressStateDir, { recursive: true });
    } catch (error) {
      console.warn('Could not create progress state directory:', error);
    }
  }

  private getDefaultFallbackStrategies(): FallbackStrategy[] {
    return [
      {
        errorCode: 'CONTENT_FILTERED',
        strategy: 'simplify',
        description: 'Simplify content to avoid filtering'
      },
      {
        errorCode: 'QUOTA_EXCEEDED',
        strategy: 'skip',
        description: 'Skip non-essential operations'
      },
      {
        errorCode: 'MODEL_UNAVAILABLE',
        strategy: 'alternative',
        description: 'Use alternative model or approach'
      },
      {
        errorCode: 'RATE_LIMIT_EXCEEDED',
        strategy: 'manual',
        description: 'Wait for rate limit reset'
      }
    ];
  }

  private normalizeError(error: any): APIError {
    if (error.code && error.message) {
      return error as APIError;
    }

    return {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      retryable: error.retryable || false,
      retryAfter: error.retryAfter
    };
  }

  private getErrorResolution(error: APIError, context: Record<string, any>): ErrorResolution {
    // First try the retry handler's resolution
    const retryResolution = this.retryHandler.getErrorResolution(error);
    
    if (retryResolution.action !== 'abort') {
      return retryResolution;
    }

    // Look for fallback strategies
    const fallbackStrategy = this.config.fallbackStrategies?.find(
      strategy => strategy.errorCode === error.code
    );

    if (fallbackStrategy) {
      return {
        action: 'fallback',
        fallbackPrompt: fallbackStrategy.description
      };
    }

    return { action: 'abort' };
  }

  private async attemptRecovery<T>(
    operation: () => Promise<T>,
    resolution: ErrorResolution,
    context: any
  ): Promise<T> {
    if (resolution.action === 'retry' && resolution.delay) {
      await new Promise(resolve => setTimeout(resolve, resolution.delay));
      return operation();
    }

    if (resolution.action === 'fallback') {
      // Implement fallback logic based on operation type
      throw new Error(`Fallback not implemented for operation: ${context.operationName}`);
    }

    throw new Error(`Cannot recover from error in operation: ${context.operationName}`);
  }

  private async saveProgressCheckpoint(projectId: string, stage: string): Promise<void> {
    const checkpoint = {
      projectId,
      stage,
      timestamp: new Date(),
      errorCount: this.errorLog.filter(op => op.context.projectId === projectId).length
    };

    const filePath = path.join(this.progressStateDir, `${projectId}-checkpoint.json`);
    await fs.writeFile(filePath, JSON.stringify(checkpoint, null, 2));
  }

  private getCompletedStages(project: ContentProject): string[] {
    const stages = [];
    
    if (project.idea) stages.push('idea-generation');
    if (project.script.scenes.length > 0) stages.push('script-generation');
    if (project.characters.length > 0) stages.push('character-setup');
    if (project.scenes.some(s => s.status === 'completed')) stages.push('video-generation');
    if (project.audioTracks.length > 0) stages.push('audio-generation');
    if (project.finalVideo) stages.push('content-integration');

    return stages;
  }

  private generateRecoveryOptions(project: ContentProject, currentStage: string): RecoveryOption[] {
    const options: RecoveryOption[] = [];

    // Always offer retry option
    options.push({
      type: 'retry',
      description: `Retry ${currentStage} with same parameters`,
      riskLevel: 'low'
    });

    // Stage-specific options
    switch (currentStage) {
      case 'video-generation':
        options.push({
          type: 'fallback',
          description: 'Use simplified video prompts',
          riskLevel: 'medium'
        });
        break;
      case 'audio-generation':
        options.push({
          type: 'skip',
          description: 'Generate silent video',
          riskLevel: 'low'
        });
        break;
    }

    return options;
  }

  private updateServiceStatus(service: string, error: APIError): void {
    const currentStatus = this.serviceStatuses.get(service) || {
      service,
      status: 'available',
      lastCheck: new Date(),
      errorRate: 0
    };

    // Update error rate
    currentStatus.errorRate = Math.min(currentStatus.errorRate + 0.1, 1.0);
    currentStatus.lastCheck = new Date();

    // Determine new status based on error rate and error type
    if (error.code === 'SERVICE_UNAVAILABLE' || currentStatus.errorRate > 0.8) {
      currentStatus.status = 'unavailable';
    } else if (currentStatus.errorRate > 0.3) {
      currentStatus.status = 'degraded';
    }

    this.serviceStatuses.set(service, currentStatus);
  }

  private getSystemStatus(): SystemStatus {
    const apiServices = Array.from(this.serviceStatuses.values());
    
    let degradationLevel: 'none' | 'partial' | 'severe' = 'none';
    const unavailableServices = apiServices.filter(s => s.status === 'unavailable').length;
    const degradedServices = apiServices.filter(s => s.status === 'degraded').length;

    if (unavailableServices > 0 || degradedServices > 2) {
      degradationLevel = 'severe';
    } else if (degradedServices > 0) {
      degradationLevel = 'partial';
    }

    return {
      apiServices,
      resourceUsage: {
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        diskUsage: 0, // Would need actual disk usage calculation
        networkLatency: 0 // Would need actual network measurement
      },
      degradationLevel
    };
  }

  private generateRecommendations(errors: FailedOperation[], systemStatus: SystemStatus): string[] {
    const recommendations: string[] = [];

    // Analyze error patterns
    const errorCounts = errors.reduce((acc, error) => {
      acc[error.error.code] = (acc[error.error.code] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Generate recommendations based on error patterns
    if (errorCounts['RATE_LIMIT_EXCEEDED'] > 3) {
      recommendations.push('Consider reducing concurrent operations or increasing delays between requests');
    }

    if (errorCounts['QUOTA_EXCEEDED'] > 0) {
      recommendations.push('Monitor API quota usage and consider upgrading plan or optimizing requests');
    }

    if (errorCounts['CONTENT_FILTERED'] > 2) {
      recommendations.push('Review content generation prompts for potentially inappropriate content');
    }

    // System status recommendations
    if (systemStatus.degradationLevel === 'severe') {
      recommendations.push('System experiencing severe degradation - consider postponing non-critical operations');
    }

    if (systemStatus.resourceUsage.memoryUsage > 500) {
      recommendations.push('High memory usage detected - consider restarting the application');
    }

    return recommendations;
  }

  private logError(failedOperation: FailedOperation): void {
    console.error(`[ERROR] ${failedOperation.operation} failed:`, {
      code: failedOperation.error.code,
      message: failedOperation.error.message,
      timestamp: failedOperation.timestamp,
      context: failedOperation.context
    });
  }

  private logRecoveryAction(action: RecoveryAction): void {
    this.recoveryActions.push(action);
    
    if (this.config.enableDetailedLogging) {
      console.log(`[RECOVERY] ${action.action} - ${action.success ? 'SUCCESS' : 'PENDING'}:`, action.details);
    }
  }
}