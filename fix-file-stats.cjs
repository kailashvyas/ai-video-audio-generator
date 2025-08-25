/**
 * Quick fix for the file stats race condition
 */

const fs = require('fs');

// Read the VeoAPIManager file
const filePath = './src/api/veo-api-manager.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Replace both instances of the problematic code
const oldPattern = /const stats = await fs\.stat\(outputPath\);/g;
const newCode = `const stats = await this.getFileStatsWithRetry(outputPath);`;

content = content.replace(oldPattern, newCode);

// Write back the file
fs.writeFileSync(filePath, content);

console.log('✅ Fixed file stats race condition in VeoAPIManager');
console.log('📝 Replaced fs.stat calls with retry logic');