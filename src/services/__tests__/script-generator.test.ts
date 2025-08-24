/**
 * Unit tests for ScriptGenerator service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScriptGenerator, ScriptGeneratorConfig, ScriptValidationResult, ParsedCharacter } from '../script-generator';
import { GeneratedIdea } from '../idea-generator';
import { GeminiAPIManager } from '../../api/gemini-api-manager';
import { Script, ScriptScene } from '../../types/content';

// Mock the GeminiAPIManager
vi.mock('../../api/gemini-api-manager');

describe('ScriptGenerator', () => {
  let mockGeminiManager: vi.Mocked<GeminiAPIManager>;
  let scriptGenerator: ScriptGenerator;
  let mockIdea: GeneratedIdea;

  beforeEach(() => {
    mockGeminiManager = {
      generateText: vi.fn(),
      generateImage: vi.fn(),
      generateVideo: vi.fn(),
      generateAudio: vi.fn(),
      estimateCost: vi.fn(),
      getUsageStats: vi.fn(),
      resetUsageStats: vi.fn()
    } as any;

    scriptGenerator = new ScriptGenerator(mockGeminiManager);

    mockIdea = {
      title: 'Test Content Idea',
      description: 'A test idea for content generation',
      theme: 'Technology',
      targetAudience: 'general',
      estimatedDuration: 180,
      keyPoints: ['Innovation', 'Future', 'Impact'],
      visualStyle: 'Modern and sleek',
      mood: 'Inspiring'
    };
  });

  describe('generateScript', () => {
    it('should generate a valid script from an idea', async () => {
      const mockResponse = `{
        "title": "The Future of Technology",
        "description": "Exploring technological innovations",
        "scenes": [
          {
            "id": "scene_1",
            "description": "Opening scene showing futuristic cityscape with narrator introduction",
            "dialogue": ["Welcome to the future of technology", "Today we explore amazing innovations"],
            "characters": ["Narrator"],
            "visualCues": ["Futuristic cityscape", "Drone shots", "Neon lighting"],
            "duration": 30
          },
          {
            "id": "scene_2", 
            "description": "Close-up of AI robots working alongside humans in a modern office",
            "dialogue": ["AI is transforming how we work", "Collaboration is key"],
            "characters": ["Narrator", "Office Worker"],
            "visualCues": ["AI robots", "Modern office", "Human-robot interaction"],
            "duration": 45
          }
        ],
        "estimatedDuration": 75
      }`;

      mockGeminiManager.generateText.mockResolvedValue(mockResponse);

      const result = await scriptGenerator.generateScript(mockIdea);

      expect(result.title).toBe('The Future of Technology');
      expect(result.scenes).toHaveLength(2);
      expect(result.scenes[0].id).toBe('scene_1');
      expect(result.scenes[0].characters).toContain('Narrator');
      expect(result.estimatedDuration).toBe(75);
      
      expect(mockGeminiManager.generateText).toHaveBeenCalledWith(
        expect.stringContaining('Test Content Idea'),
        'gemini-pro'
      );
    });

    it('should use custom configuration', async () => {
      const mockResponse = `{
        "title": "Educational Script",
        "description": "Learning content",
        "scenes": [
          {
            "id": "scene_1",
            "description": "Educational content scene",
            "dialogue": ["Let's learn together"],
            "characters": ["Teacher"],
            "visualCues": ["Classroom setting"],
            "duration": 60
          }
        ],
        "estimatedDuration": 60
      }`;

      mockGeminiManager.generateText.mockResolvedValue(mockResponse);

      const config: ScriptGeneratorConfig = {
        maxScenes: 3,
        sceneLength: 'long',
        narrativeStyle: 'educational',
        pacing: 'slow'
      };

      const result = await scriptGenerator.generateScript(mockIdea, config);

      expect(result.scenes).toHaveLength(1);
      
      const calledPrompt = mockGeminiManager.generateText.mock.calls[0][0];
      expect(calledPrompt).toContain('Maximum Scenes: 3');
      expect(calledPrompt).toContain('60-90 seconds');
      expect(calledPrompt).toContain('Focus on teaching and explaining concepts clearly');
    });

    it('should handle malformed JSON with fallback parsing', async () => {
      const mockResponse = `
        Scene 1: Opening introduction
        The narrator welcomes viewers to an exciting journey.
        
        Scene 2: Main content
        We explore the key concepts in detail.
      `;

      mockGeminiManager.generateText.mockResolvedValue(mockResponse);

      const result = await scriptGenerator.generateScript(mockIdea);

      expect(result.title).toBe(mockIdea.title);
      expect(result.scenes.length).toBeGreaterThan(0);
      expect(result.scenes[0].characters.length).toBeGreaterThan(0);
      
      // Ensure the script passes validation
      const validation = scriptGenerator.validateScript(result);
      expect(validation.isValid).toBe(true);
    });

    it('should validate generated script and throw on validation errors', async () => {
      const invalidResponse = `{
        "title": "",
        "description": "",
        "scenes": [],
        "estimatedDuration": 0
      }`;

      mockGeminiManager.generateText.mockResolvedValue(invalidResponse);

      try {
        await scriptGenerator.generateScript(mockIdea);
        expect.fail('Expected script generation to throw an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Generated script validation failed');
      }
    });

    it('should handle API errors', async () => {
      mockGeminiManager.generateText.mockRejectedValue(new Error('API Error'));

      await expect(scriptGenerator.generateScript(mockIdea)).rejects.toThrow(
        'Failed to generate script: API Error'
      );
    });
  });

  describe('extractCharacters', () => {
    it('should extract characters from script scenes', () => {
      const script: Script = {
        title: 'Test Script',
        description: 'Test description',
        estimatedDuration: 120,
        scenes: [
          {
            id: 'scene_1',
            description: 'John is a brave explorer who discovers ancient ruins',
            dialogue: ['Hello world'],
            characters: ['John', 'Narrator'],
            visualCues: ['Ancient ruins'],
            duration: 60
          },
          {
            id: 'scene_2',
            description: 'Sarah joins John on his adventure',
            dialogue: ['Let\'s go together'],
            characters: ['John', 'Sarah'],
            visualCues: ['Adventure scene'],
            duration: 60
          }
        ]
      };

      const characters = scriptGenerator.extractCharacters(script);

      expect(characters).toHaveLength(3);
      
      const john = characters.find(c => c.name === 'John');
      expect(john).toBeDefined();
      expect(john!.appearances).toEqual(['scene_1', 'scene_2']);
      expect(john!.role).toBe('main'); // Appears in 100% of scenes
      
      const narrator = characters.find(c => c.name === 'Narrator');
      expect(narrator).toBeDefined();
      expect(narrator!.role).toBe('narrator');
      
      const sarah = characters.find(c => c.name === 'Sarah');
      expect(sarah).toBeDefined();
      expect(sarah!.appearances).toEqual(['scene_2']);
      expect(sarah!.role).toBe('secondary'); // Appears in 50% of scenes
    });

    it('should infer character roles correctly', () => {
      const script: Script = {
        title: 'Test Script',
        description: 'Test description',
        estimatedDuration: 180,
        scenes: [
          {
            id: 'scene_1',
            description: 'Scene with background character',
            dialogue: [],
            characters: ['Main Character', 'Background Extra'],
            visualCues: [],
            duration: 60
          },
          {
            id: 'scene_2',
            description: 'Scene with main character only',
            dialogue: [],
            characters: ['Main Character'],
            visualCues: [],
            duration: 60
          },
          {
            id: 'scene_3',
            description: 'Scene with main character only',
            dialogue: [],
            characters: ['Main Character'],
            visualCues: [],
            duration: 60
          }
        ]
      };

      const characters = scriptGenerator.extractCharacters(script);

      const mainChar = characters.find(c => c.name === 'Main Character');
      expect(mainChar!.role).toBe('main'); // 100% appearance

      const backgroundChar = characters.find(c => c.name === 'Background Extra');
      expect(backgroundChar!.role).toBe('secondary'); // 33% appearance (0.3 threshold)
    });
  });

  describe('parseSceneContent', () => {
    it('should extract visual cues and dialogue from scene description', () => {
      const description = `The camera shows a beautiful sunset over the mountains. 
        John says "What a magnificent view!" The lighting creates a warm atmosphere. 
        Sarah responds "It's breathtaking!" We see birds flying in the distance.`;

      const result = scriptGenerator.parseSceneContent(description);

      expect(result.visualCues).toContain('The camera shows a beautiful sunset over the mountains');
      expect(result.visualCues).toContain('The lighting creates a warm atmosphere');
      expect(result.visualCues).toContain('We see birds flying in the distance');
      
      expect(result.dialogue).toContain('What a magnificent view');
      expect(result.dialogue).toContain('It');
    });

    it('should handle descriptions with colons for dialogue', () => {
      const description = `Narrator: Welcome to our journey. The scene opens with a wide shot of the landscape.`;

      const result = scriptGenerator.parseSceneContent(description);

      expect(result.dialogue).toContain('Narrator: Welcome to our journey');
      expect(result.visualCues).toContain('The scene opens with a wide shot of the landscape');
    });

    it('should handle descriptions without clear dialogue or visual cues', () => {
      const description = `This is a simple description without specific markers.`;

      const result = scriptGenerator.parseSceneContent(description);

      // Should still return arrays, even if empty
      expect(Array.isArray(result.visualCues)).toBe(true);
      expect(Array.isArray(result.dialogue)).toBe(true);
    });
  });

  describe('validateScript', () => {
    it('should validate a correct script', () => {
      const validScript: Script = {
        title: 'Valid Script',
        description: 'A properly structured script',
        estimatedDuration: 120,
        scenes: [
          {
            id: 'scene_1',
            description: 'Opening scene with clear description',
            dialogue: ['Hello world'],
            characters: ['Narrator'],
            visualCues: ['Wide shot'],
            duration: 60
          },
          {
            id: 'scene_2',
            description: 'Second scene continues the story',
            dialogue: ['Continuing the narrative'],
            characters: ['Narrator'],
            visualCues: ['Close-up shot'],
            duration: 60
          }
        ]
      };

      const result = scriptGenerator.validateScript(validScript);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidScript: Script = {
        title: '',
        description: '',
        estimatedDuration: 0,
        scenes: []
      };

      const result = scriptGenerator.validateScript(invalidScript);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Script must have a title');
      expect(result.errors).toContain('Script must have a description');
      expect(result.errors).toContain('Script must have at least one scene');
    });

    it('should detect scene validation issues', () => {
      const scriptWithBadScenes: Script = {
        title: 'Test Script',
        description: 'Test description',
        estimatedDuration: 200,
        scenes: [
          {
            id: '',
            description: '',
            dialogue: [],
            characters: [],
            visualCues: [],
            duration: 0
          },
          {
            id: 'scene_2',
            description: 'Very long scene that exceeds recommended duration',
            dialogue: ['Some dialogue'],
            characters: ['Character'],
            visualCues: ['Visual'],
            duration: 150 // Over 2 minutes
          }
        ]
      };

      const result = scriptGenerator.validateScript(scriptWithBadScenes);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Scene 1 must have an ID');
      expect(result.errors).toContain('Scene 1 must have a description');
      expect(result.errors).toContain('Scene 1 must have a positive duration');
      expect(result.warnings).toContain('Scene 2 is longer than 2 minutes, consider splitting');
    });

    it('should provide warnings for potential improvements', () => {
      const scriptWithWarnings: Script = {
        title: 'Short Script',
        description: 'Very short content',
        estimatedDuration: 20, // Very short
        scenes: [
          {
            id: 'scene_1',
            description: 'Scene without characters or visual cues',
            dialogue: [],
            characters: [],
            visualCues: [],
            duration: 20
          }
        ]
      };

      const result = scriptGenerator.validateScript(scriptWithWarnings);

      expect(result.isValid).toBe(true); // No errors, just warnings
      expect(result.warnings).toContain('Script is very short, consider adding more content');
      expect(result.warnings).toContain('Scene 1 has no characters');
      expect(result.warnings).toContain('Scene 1 has no visual cues');
    });

    it('should provide suggestions for improvement', () => {
      const scriptNeedingSuggestions: Script = {
        title: 'Silent Script',
        description: 'Script without narrator or dialogue',
        estimatedDuration: 120,
        scenes: [
          {
            id: 'scene_1',
            description: 'Silent scene',
            dialogue: [],
            characters: ['Character'],
            visualCues: ['Visual'],
            duration: 60
          },
          {
            id: 'scene_2',
            description: 'Another silent scene',
            dialogue: [],
            characters: ['Character'],
            visualCues: ['Visual'],
            duration: 60
          }
        ]
      };

      const result = scriptGenerator.validateScript(scriptNeedingSuggestions);

      expect(result.suggestions).toContain('Consider adding a narrator or dialogue for better storytelling');
    });
  });

  describe('configuration handling', () => {
    it('should use default configuration when none provided', async () => {
      const generator = new ScriptGenerator(mockGeminiManager);
      
      const mockResponse = `{
        "title": "Test Script",
        "description": "A test script",
        "scenes": [
          {
            "id": "scene_1",
            "description": "Test scene",
            "dialogue": ["Test dialogue"],
            "characters": ["Narrator"],
            "visualCues": ["Test visual"],
            "duration": 60
          }
        ],
        "estimatedDuration": 60
      }`;
      
      mockGeminiManager.generateText.mockResolvedValue(mockResponse);
      
      await generator.generateScript(mockIdea);
      
      expect(mockGeminiManager.generateText).toHaveBeenCalledWith(
        expect.stringContaining('Maximum Scenes: 8'),
        'gemini-pro'
      );
    });

    it('should merge custom config with defaults', async () => {
      const customConfig: ScriptGeneratorConfig = {
        maxScenes: 5,
        narrativeStyle: 'documentary'
      };

      const generator = new ScriptGenerator(mockGeminiManager, customConfig);
      
      const mockResponse = `{
        "title": "Documentary Script",
        "description": "A documentary style script",
        "scenes": [
          {
            "id": "scene_1",
            "description": "Documentary opening",
            "dialogue": ["Welcome to this documentary"],
            "characters": ["Narrator"],
            "visualCues": ["Documentary style"],
            "duration": 60
          }
        ],
        "estimatedDuration": 60
      }`;
      
      mockGeminiManager.generateText.mockResolvedValue(mockResponse);
      
      await generator.generateScript(mockIdea);
      
      const calledPrompt = mockGeminiManager.generateText.mock.calls[0][0];
      expect(calledPrompt).toContain('Maximum Scenes: 5');
      expect(calledPrompt).toContain('documentary');
    });
  });

  describe('prompt building', () => {
    it('should include all idea details in prompt', async () => {
      const mockResponse = `{
        "title": "Test Script",
        "description": "A test script",
        "scenes": [
          {
            "id": "scene_1",
            "description": "Test scene",
            "dialogue": ["Test dialogue"],
            "characters": ["Narrator"],
            "visualCues": ["Test visual"],
            "duration": 60
          }
        ],
        "estimatedDuration": 60
      }`;
      
      mockGeminiManager.generateText.mockResolvedValue(mockResponse);

      await scriptGenerator.generateScript(mockIdea);

      const calledPrompt = mockGeminiManager.generateText.mock.calls[0][0];
      
      expect(calledPrompt).toContain(mockIdea.title);
      expect(calledPrompt).toContain(mockIdea.description);
      expect(calledPrompt).toContain(mockIdea.theme);
      expect(calledPrompt).toContain(mockIdea.targetAudience);
      expect(calledPrompt).toContain(mockIdea.keyPoints.join(', '));
    });

    it('should handle different narrative styles', async () => {
      const mockResponse = `{
        "title": "Test Script",
        "description": "A test script",
        "scenes": [
          {
            "id": "scene_1",
            "description": "Test scene",
            "dialogue": ["Test dialogue"],
            "characters": ["Narrator"],
            "visualCues": ["Test visual"],
            "duration": 60
          }
        ],
        "estimatedDuration": 60
      }`;
      
      mockGeminiManager.generateText.mockResolvedValue(mockResponse);

      // Test documentary style
      await scriptGenerator.generateScript(mockIdea, { narrativeStyle: 'documentary' });
      let prompt = mockGeminiManager.generateText.mock.calls[0][0];
      expect(prompt).toContain('documentary style');

      // Test conversational style
      await scriptGenerator.generateScript(mockIdea, { narrativeStyle: 'conversational' });
      prompt = mockGeminiManager.generateText.mock.calls[1][0];
      expect(prompt).toContain('conversational tone');
    });

    it('should handle different pacing options', async () => {
      const mockResponse = `{
        "title": "Test Script",
        "description": "A test script",
        "scenes": [
          {
            "id": "scene_1",
            "description": "Test scene",
            "dialogue": ["Test dialogue"],
            "characters": ["Narrator"],
            "visualCues": ["Test visual"],
            "duration": 60
          }
        ],
        "estimatedDuration": 60
      }`;
      
      mockGeminiManager.generateText.mockResolvedValue(mockResponse);

      // Test fast pacing
      await scriptGenerator.generateScript(mockIdea, { pacing: 'fast' });
      let prompt = mockGeminiManager.generateText.mock.calls[0][0];
      expect(prompt).toContain('Quick cuts');

      // Test slow pacing
      await scriptGenerator.generateScript(mockIdea, { pacing: 'slow' });
      prompt = mockGeminiManager.generateText.mock.calls[1][0];
      expect(prompt).toContain('Deliberate pacing');
    });
  });

  describe('error handling', () => {
    it('should provide meaningful error messages', async () => {
      mockGeminiManager.generateText.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(scriptGenerator.generateScript(mockIdea)).rejects.toThrow(
        'Failed to generate script: Rate limit exceeded'
      );
    });

    it('should handle unknown errors', async () => {
      mockGeminiManager.generateText.mockRejectedValue('Unknown error type');

      await expect(scriptGenerator.generateScript(mockIdea)).rejects.toThrow(
        'Failed to generate script: Unknown error'
      );
    });
  });
});