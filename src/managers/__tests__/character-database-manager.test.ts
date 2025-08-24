/**
 * Unit tests for CharacterDatabaseManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CharacterDatabaseManager, CharacterPromptTemplate } from '../character-database-manager';
import { Character, SceneReference } from '../../types/content';

describe('CharacterDatabaseManager', () => {
  let manager: CharacterDatabaseManager;

  beforeEach(() => {
    manager = new CharacterDatabaseManager();
  });

  describe('Character Management', () => {
    it('should add a new character successfully', () => {
      manager.addCharacter('John', 'A tall man with brown hair');
      
      expect(manager.hasCharacter('John')).toBe(true);
      expect(manager.getCharacterCount()).toBe(1);
      expect(manager.getCharacterDescription('John')).toBe('A tall man with brown hair');
    });

    it('should handle case-insensitive character names', () => {
      manager.addCharacter('John', 'A tall man with brown hair');
      
      expect(manager.hasCharacter('john')).toBe(true);
      expect(manager.hasCharacter('JOHN')).toBe(true);
      expect(manager.getCharacterDescription('john')).toBe('A tall man with brown hair');
    });

    it('should throw error when adding duplicate character', () => {
      manager.addCharacter('John', 'A tall man with brown hair');
      
      expect(() => {
        manager.addCharacter('John', 'Another description');
      }).toThrow('Character "John" already exists');
    });

    it('should throw error when getting non-existent character', () => {
      expect(() => {
        manager.getCharacterDescription('NonExistent');
      }).toThrow('Character "NonExistent" not found in database');
    });

    it('should update character description successfully', () => {
      manager.addCharacter('John', 'A tall man with brown hair');
      const conflict = manager.updateCharacterDescription('John', 'A tall man with black hair');
      
      expect(manager.getCharacterDescription('John')).toBe('A tall man with black hair');
      expect(conflict).toBeNull();
    });

    it('should detect appearance conflicts when updating description', () => {
      manager.addCharacter('John', 'A tall blonde man');
      const conflict = manager.updateCharacterDescription('John', 'A tall brunette man');
      
      expect(conflict).not.toBeNull();
      expect(conflict?.conflictType).toBe('appearance');
      expect(conflict?.characterName).toBe('john');
    });

    it('should remove character successfully', () => {
      manager.addCharacter('John', 'A tall man with brown hair');
      expect(manager.hasCharacter('John')).toBe(true);
      
      const removed = manager.removeCharacter('John');
      expect(removed).toBe(true);
      expect(manager.hasCharacter('John')).toBe(false);
      expect(manager.getCharacterCount()).toBe(0);
    });

    it('should return false when removing non-existent character', () => {
      const removed = manager.removeCharacter('NonExistent');
      expect(removed).toBe(false);
    });

    it('should clear all characters', () => {
      manager.addCharacter('John', 'A tall man');
      manager.addCharacter('Jane', 'A short woman');
      expect(manager.getCharacterCount()).toBe(2);
      
      manager.clearDatabase();
      expect(manager.getCharacterCount()).toBe(0);
    });
  });

  describe('Character Appearances', () => {
    beforeEach(() => {
      manager.addCharacter('John', 'A tall man with brown hair');
    });

    it('should add character appearance successfully', () => {
      const sceneRef: SceneReference = {
        sceneId: 'scene1',
        role: 'protagonist',
        prominence: 'main'
      };

      manager.addCharacterAppearance('John', sceneRef);
      const characters = manager.getAllCharacters();
      const john = characters.find(c => c.name === 'john');
      
      expect(john?.appearances).toHaveLength(1);
      expect(john?.appearances[0]).toEqual(sceneRef);
    });

    it('should update existing appearance for same scene', () => {
      const sceneRef1: SceneReference = {
        sceneId: 'scene1',
        role: 'protagonist',
        prominence: 'main'
      };

      const sceneRef2: SceneReference = {
        sceneId: 'scene1',
        role: 'hero',
        prominence: 'secondary'
      };

      manager.addCharacterAppearance('John', sceneRef1);
      manager.addCharacterAppearance('John', sceneRef2);
      
      const characters = manager.getAllCharacters();
      const john = characters.find(c => c.name === 'john');
      
      expect(john?.appearances).toHaveLength(1);
      expect(john?.appearances[0].role).toBe('hero');
      expect(john?.appearances[0].prominence).toBe('secondary');
    });

    it('should set reference image for character', () => {
      manager.setCharacterReferenceImage('John', 'path/to/image.jpg');
      
      const characters = manager.getAllCharacters();
      const john = characters.find(c => c.name === 'john');
      
      expect(john?.referenceImage).toBe('path/to/image.jpg');
    });
  });

  describe('Prompt Generation', () => {
    beforeEach(() => {
      manager.addCharacter('John', 'A tall man with brown hair and blue eyes');
      manager.addCharacter('Jane', 'A short woman with blonde hair and green eyes');
      manager.addCharacter('Bob', 'An elderly man with gray beard');

      // Add appearances to test prioritization
      manager.addCharacterAppearance('John', {
        sceneId: 'scene1',
        role: 'protagonist',
        prominence: 'main'
      });
      manager.addCharacterAppearance('Jane', {
        sceneId: 'scene1',
        role: 'love interest',
        prominence: 'secondary'
      });
    });

    it('should generate basic character prompt', () => {
      const prompt = manager.generateCharacterPrompt(['John', 'Jane'], 'They walk into the room');
      
      expect(prompt).toContain('john: A tall man with brown hair and blue eyes');
      expect(prompt).toContain('jane: A short woman with blonde hair and green eyes');
      expect(prompt).toContain('They walk into the room');
    });

    it('should handle non-existent characters gracefully', () => {
      const prompt = manager.generateCharacterPrompt(['John', 'NonExistent'], 'Scene description');
      
      expect(prompt).toContain('john: A tall man with brown hair and blue eyes');
      expect(prompt).not.toContain('NonExistent');
    });

    it('should return base prompt when no characters found', () => {
      const basePrompt = 'Scene with no characters';
      const prompt = manager.generateCharacterPrompt(['NonExistent'], basePrompt);
      
      expect(prompt).toBe(basePrompt);
    });

    it('should prioritize main characters when option is enabled', () => {
      const prompt = manager.generateCharacterPrompt(
        ['Jane', 'John', 'Bob'], 
        'Scene description',
        { prioritizeMainCharacters: true }
      );
      
      // John should appear first as he has main prominence
      const johnIndex = prompt.indexOf('john:');
      const janeIndex = prompt.indexOf('jane:');
      expect(johnIndex).toBeLessThan(janeIndex);
    });

    it('should truncate long descriptions when maxDescriptionLength is set', () => {
      const prompt = manager.generateCharacterPrompt(
        ['John'], 
        'Scene description',
        { maxDescriptionLength: 20 }
      );
      
      expect(prompt).toContain('john: A tall man with brow...');
    });

    it('should include appearance information when requested', () => {
      const prompt = manager.generateCharacterPrompt(
        ['John'], 
        'Scene description',
        { includeAppearances: true }
      );
      
      expect(prompt).toContain('(main character in 1 scenes)');
    });
  });

  describe('Custom Template', () => {
    it('should use custom prompt template', () => {
      const customTemplate: CharacterPromptTemplate = {
        prefix: 'CUSTOM PREFIX: ',
        characterSection: '[CUSTOM_CHARACTERS]',
        suffix: ' CUSTOM SUFFIX. '
      };

      const customManager = new CharacterDatabaseManager(customTemplate);
      customManager.addCharacter('John', 'A tall man');
      
      const prompt = customManager.generateCharacterPrompt(['John'], 'Scene description');
      
      expect(prompt).toContain('CUSTOM PREFIX:');
      expect(prompt).toContain('CUSTOM SUFFIX.');
    });
  });

  describe('Database Import/Export', () => {
    beforeEach(() => {
      manager.addCharacter('John', 'A tall man with brown hair');
      manager.addCharacter('Jane', 'A short woman with blonde hair');
      manager.setCharacterReferenceImage('John', 'path/to/john.jpg');
    });

    it('should export database as JSON', () => {
      const exported = manager.exportDatabase();
      const parsed = JSON.parse(exported);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed.find((c: Character) => c.name === 'john')).toBeDefined();
      expect(parsed.find((c: Character) => c.name === 'jane')).toBeDefined();
    });

    it('should import database from JSON', () => {
      const exported = manager.exportDatabase();
      
      const newManager = new CharacterDatabaseManager();
      newManager.importDatabase(exported);
      
      expect(newManager.getCharacterCount()).toBe(2);
      expect(newManager.hasCharacter('John')).toBe(true);
      expect(newManager.hasCharacter('Jane')).toBe(true);
      expect(newManager.getCharacterDescription('John')).toBe('A tall man with brown hair');
    });

    it('should throw error on invalid JSON import', () => {
      expect(() => {
        manager.importDatabase('invalid json');
      }).toThrow('Failed to import character database');
    });
  });

  describe('Conflict Detection', () => {
    it('should detect height conflicts', () => {
      manager.addCharacter('John', 'A tall man with brown hair');
      const conflict = manager.updateCharacterDescription('John', 'A short man with brown hair');
      
      expect(conflict).not.toBeNull();
      expect(conflict?.conflictType).toBe('appearance');
    });

    it('should detect hair color conflicts', () => {
      manager.addCharacter('John', 'A man with blonde hair');
      const conflict = manager.updateCharacterDescription('John', 'A man with brunette hair');
      
      expect(conflict).not.toBeNull();
      expect(conflict?.conflictType).toBe('appearance');
    });

    it('should detect eye color conflicts', () => {
      manager.addCharacter('John', 'A man with blue eyes');
      const conflict = manager.updateCharacterDescription('John', 'A man with brown eyes');
      
      expect(conflict).not.toBeNull();
      expect(conflict?.conflictType).toBe('appearance');
    });

    it('should not detect conflict for compatible descriptions', () => {
      manager.addCharacter('John', 'A tall man with brown hair');
      const conflict = manager.updateCharacterDescription('John', 'A tall gentleman with brown hair and a beard');
      
      expect(conflict).toBeNull();
    });

    it('should not detect conflict for same appearance terms', () => {
      manager.addCharacter('John', 'A tall blonde man');
      const conflict = manager.updateCharacterDescription('John', 'A tall blonde gentleman with a smile');
      
      expect(conflict).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty character names', () => {
      expect(() => {
        manager.addCharacter('', 'Description');
      }).toThrow();
    });

    it('should handle whitespace in character names', () => {
      manager.addCharacter('  John  ', 'A tall man');
      expect(manager.hasCharacter('John')).toBe(true);
    });

    it('should handle empty descriptions', () => {
      manager.addCharacter('John', '');
      expect(manager.getCharacterDescription('John')).toBe('');
    });

    it('should handle whitespace in descriptions', () => {
      manager.addCharacter('John', '  A tall man  ');
      expect(manager.getCharacterDescription('John')).toBe('A tall man');
    });
  });
});