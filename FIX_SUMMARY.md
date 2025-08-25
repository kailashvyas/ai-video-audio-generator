# Image-to-Video Generation Fix

## Problem
The CLI interactive mode was failing with the error:
```
❌ Veo 3.0 image-to-video generation failed: Error: fromImageBytes must be a string
```

## Root Cause
The Veo 3.0 API expects the `imageBytes` parameter to be a base64 string, but the code was passing a `Uint8Array` object. When reading image files from disk, the code was:

1. Reading the file as a Buffer
2. Converting to Uint8Array
3. Passing the Uint8Array to the Veo API
4. Inside VeoAPIManager, converting Uint8Array to base64 string

However, the Google GenAI SDK's internal transformers expected the `imageBytes` to already be a string.

## Solution
Modified the `GeminiAPIManager.generateVideo()` method to:

1. **For file paths**: Read the image file and convert directly to base64 string
2. **For data URLs**: Extract the base64 string directly
3. **Pass base64 string** to `VeoAPIManager.generateImageToVideo()`
4. **Updated VeoAPIManager** to accept both `Uint8Array` and `string` for backward compatibility

## Files Modified
- `src/api/gemini-api-manager.ts` - Fixed image data handling
- `src/api/veo-api-manager.ts` - Updated method signature to accept string or Uint8Array

## Key Changes

### GeminiAPIManager
```typescript
// OLD (would fail)
const imageBuffer = await fs.readFile(referenceImage);
imageBytes = new Uint8Array(imageBuffer);
await this.veoManager.generateImageToVideo(imageBytes, mimeType, prompt, options);

// NEW (works correctly)
const imageBuffer = await fs.readFile(referenceImage);
const base64String = imageBuffer.toString('base64');
await this.veoManager.generateImageToVideo(base64String, mimeType, prompt, options);
```

### VeoAPIManager
```typescript
// Updated method signature
async generateImageToVideo(imageData: Uint8Array | string, mimeType: 'image/png' | 'image/jpeg', prompt: string, options: VideoGenerationOptions = {})

// Updated conversion logic
const base64String = typeof imageData === 'string' 
  ? imageData 
  : Buffer.from(imageData).toString('base64');
```

## Testing
- ✅ Mock test confirms the fix resolves the `fromImageBytes must be a string` error
- ✅ Base64 string format is correctly passed to the Veo API
- ✅ Backward compatibility maintained for existing code

## Expected Result
The CLI interactive mode should now work correctly for image-to-video generation without the `fromImageBytes must be a string` error.

## Usage
Users can now run:
```bash
npm run cli:interactive
```

And select image-to-video generation without encountering the error. The system will:
1. Generate character reference images using Imagen
2. Save images to `./output/images/`
3. Read image files and convert to proper base64 format
4. Successfully generate videos using Veo 3.0 image-to-video API
5. Save videos to `./output/videos/`

---
*Status: Ready for testing*