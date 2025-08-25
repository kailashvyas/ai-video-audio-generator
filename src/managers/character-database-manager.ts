/**
 * Character Database Manager for maintaining character consistency across scenes
 * Handles character storage, retrieval, and prompt generation for video consistency
 */

import { Character, SceneReference } from '../types/content';

export interface CharacterPromptTemplate {
  prefix: string;
  characterSection: string;
  suffix: string;
}

export interface CharacterConflict {
  characterName: string;
  existingDescription: string;
  newDescription: string;
  conflictType: 'description' | 'appearance' | 'reference_image';
}

export interface CharacterPromptOptions {
  includeAppearances?: boolean;
  maxDescriptionLength?: number;
  prioritizeMainCharacters?: boolean;
}

/**
 * Manages character database for consistent video generation
 */
export class CharacterDatabaseManager {
  private characters: Map<string, Character> = new Map();
  private promptTemplate: CharacterPromptTemplate;
  // Note: Project isolation will be implemented in future versions
  // private currentProjectId?: string;

  constructor(customTemplate?: CharacterPromptTemplate) {
    this.promptTemplate = customTemplate || this.getDefaultTemplate();
  }

  /**
   * Initialize character manager for a specific project
   */
  initializeProject(_projectId: string): void {
    // Note: Project isolation will be implemented in future versions
    // this.currentProjectId = projectId;
    this.characters.clear(); // Start fresh for new project
  }

  /**
   * Add a new character to the database
   */
  addCharacter(name: string, description: string, referenceImage?: string): void {
    const normalizedName = this.normalizeCharacterName(name);
    
    if (!normalizedName) {
      throw new Error('Character name cannot be empty');
    }
    
    if (this.characters.has(normalizedName)) {
      throw new Error(`Character "${name}" already exists. Use updateCharacterDescription to modify.`);
    }

    const character: Character = {
      name: normalizedName,
      description: description.trim(),
      ...(referenceImage && { referenceImage }),
      appearances: []
    };

    this.characters.set(normalizedName, character);
  }

  /**
   * Get character description by name
   */
  getCharacterDescription(name: string): string {
    const normalizedName = this.normalizeCharacterName(name);
    const character = this.characters.get(normalizedName);
    
    if (!character) {
      throw new Error(`Character "${name}" not found in database.`);
    }

    return character.description;
  }

  /**
   * Update character description with conflict detection
   */
  updateCharacterDescription(name: string, newDescription: string): CharacterConflict | null {
    const normalizedName = this.normalizeCharacterName(name);
    const character = this.characters.get(normalizedName);
    
    if (!character) {
      throw new Error(`Character "${name}" not found in database.`);
    }

    // Detect conflicts
    const conflict = this.detectDescriptionConflict(character, newDescription);
    
    // Update the description
    character.description = newDescription.trim();
    this.characters.set(normalizedName, character);

    return conflict;
  }

  /**
   * Get all characters in the database
   */
  getAllCharacters(): Character[] {
    return Array.from(this.characters.values());
  }

  /**
   * Generate character-consistent prompt for video generation
   */
  generateCharacterPrompt(characterNames: string[], basePrompt: string, options?: CharacterPromptOptions): string {
    const opts = {
      includeAppearances: false,
      maxDescriptionLength: 200,
      prioritizeMainCharacters: true,
      ...options
    };

    const relevantCharacters = this.getRelevantCharacters(characterNames, opts);
    
    if (relevantCharacters.length === 0) {
      return basePrompt;
    }

    const characterSection = this.buildCharacterSection(relevantCharacters, opts);
    
    return this.promptTemplate.prefix + 
           characterSection + 
           this.promptTemplate.suffix + 
           basePrompt;
  }

  /**
   * Extract characters from script scenes
   */
  async extractCharactersFromScript(scriptScenes: any[]): Promise<Character[]> {
    const characters: Character[] = [];
    
    for (const scene of scriptScenes) {
      if (scene.characters && Array.isArray(scene.characters)) {
        for (const characterName of scene.characters) {
          const normalizedName = this.normalizeCharacterName(characterName);
          
          // Check if character already exists
          if (!this.characters.has(normalizedName)) {
            const character: Character = {
              name: normalizedName,
              description: `Character appearing in ${scene.description}`,
              appearances: [{
                sceneId: scene.id,
                role: 'main',
                prominence: 'main' as const
              }]
            };
            
            this.characters.set(normalizedName, character);
            characters.push(character);
          } else {
            // Add appearance to existing character
            const existingCharacter = this.characters.get(normalizedName)!;
            existingCharacter.appearances.push({
              sceneId: scene.id,
              role: 'main',
              prominence: 'main' as const
            });
          }
        }
      }
    }
    
    return characters;
  }

  /**
   * Add scene appearance for a character
   */
  addCharacterAppearance(characterName: string, sceneReference: SceneReference): void {
    const normalizedName = this.normalizeCharacterName(characterName);
    const character = this.characters.get(normalizedName);
    
    if (!character) {
      throw new Error(`Character "${characterName}" not found in database.`);
    }

    // Check if appearance already exists for this scene
    const existingAppearance = character.appearances.find(
      app => app.sceneId === sceneReference.sceneId
    );

    if (existingAppearance) {
      // Update existing appearance
      existingAppearance.role = sceneReference.role;
      existingAppearance.prominence = sceneReference.prominence;
    } else {
      // Add new appearance
      character.appearances.push(sceneReference);
    }
  }

  /**
   * Set reference image for a character
   */
  setCharacterReferenceImage(characterName: string, referenceImage: string): void {
    const normalizedName = this.normalizeCharacterName(characterName);
    const character = this.characters.get(normalizedName);
    
    if (!character) {
      throw new Error(`Character "${characterName}" not found in database.`);
    }

    character.referenceImage = referenceImage;
  }

  /**
   * Check if character exists in database
   */
  hasCharacter(name: string): boolean {
    const normalizedName = this.normalizeCharacterName(name);
    return this.characters.has(normalizedName);
  }

  /**
   * Remove character from database
   */
  removeCharacter(name: string): boolean {
    const normalizedName = this.normalizeCharacterName(name);
    return this.characters.delete(normalizedName);
  }

  /**
   * Clear all characters from database
   */
  clearDatabase(): void {
    this.characters.clear();
  }

  /**
   * Get character count
   */
  getCharacterCount(): number {
    return this.characters.size;
  }

  /**
   * Export character database as JSON
   */
  exportDatabase(): string {
    const charactersArray = Array.from(this.characters.values());
    return JSON.stringify(charactersArray, null, 2);
  }

  /**
   * Import character database from JSON
   */
  importDatabase(jsonData: string): void {
    try {
      const charactersArray: Character[] = JSON.parse(jsonData);
      this.characters.clear();
      
      charactersArray.forEach(character => {
        this.characters.set(character.name, character);
      });
    } catch (error) {
      throw new Error(`Failed to import character database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private helper methods

  private normalizeCharacterName(name: string): string {
    return name.trim().toLowerCase();
  }

  private getDefaultTemplate(): CharacterPromptTemplate {
    return {
      prefix: "Character descriptions for consistency: ",
      characterSection: "[CHARACTERS]",
      suffix: ". Maintain these character appearances throughout the scene. "
    };
  }

  private getRelevantCharacters(characterNames: string[], options: CharacterPromptOptions): Character[] {
    const characters: Character[] = [];
    
    characterNames.forEach(name => {
      const normalizedName = this.normalizeCharacterName(name);
      const character = this.characters.get(normalizedName);
      if (character) {
        characters.push(character);
      }
    });

    // Sort by prominence if prioritizing main characters
    if (options.prioritizeMainCharacters) {
      characters.sort((a, b) => {
        const aMainAppearances = a.appearances.filter(app => app.prominence === 'main').length;
        const bMainAppearances = b.appearances.filter(app => app.prominence === 'main').length;
        return bMainAppearances - aMainAppearances;
      });
    }

    return characters;
  }

  private buildCharacterSection(characters: Character[], options: CharacterPromptOptions): string {
    const characterDescriptions = characters.map(character => {
      let description = character.description;
      
      // Truncate if needed
      if (options.maxDescriptionLength && description.length > options.maxDescriptionLength) {
        description = description.substring(0, options.maxDescriptionLength) + '...';
      }

      let characterText = `${character.name}: ${description}`;
      
      // Add appearance info if requested
      if (options.includeAppearances && character.appearances.length > 0) {
        const mainAppearances = character.appearances.filter(app => app.prominence === 'main').length;
        if (mainAppearances > 0) {
          characterText += ` (main character in ${mainAppearances} scenes)`;
        }
      }

      return characterText;
    });

    return characterDescriptions.join('; ');
  }

  private detectDescriptionConflict(character: Character, newDescription: string): CharacterConflict | null {
    const existingDesc = character.description.toLowerCase();
    const newDesc = newDescription.toLowerCase();
    
    // Simple conflict detection - check for contradictory appearance terms
    const appearanceTerms = [
      ['tall', 'short'],
      ['blonde', 'brunette', 'redhead', 'black hair'],
      ['young', 'old', 'elderly'],
      ['thin', 'heavy', 'muscular'],
      ['blue eyes', 'brown eyes', 'green eyes', 'hazel eyes']
    ];

    for (const termGroup of appearanceTerms) {
      const existingTerms = termGroup.filter(term => existingDesc.includes(term));
      const newTerms = termGroup.filter(term => newDesc.includes(term));
      
      if (existingTerms.length > 0 && newTerms.length > 0) {
        const hasConflict = !existingTerms.some(term => newTerms.includes(term));
        if (hasConflict) {
          return {
            characterName: character.name,
            existingDescription: character.description,
            newDescription: newDescription,
            conflictType: 'appearance'
          };
        }
      }
    }

    return null;
  }
}