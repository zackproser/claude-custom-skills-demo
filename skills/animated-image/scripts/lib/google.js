import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';

const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export function getEnvOrThrow(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

export function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getAiClient(apiKey) {
  if (apiKey && !process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = apiKey;
  }
  return new GoogleGenAI({});
}

export async function generateImageWithGemini({ apiKey, prompt, model = 'gemini-2.5-flash-image', outputFilePath }) {
  const ai = getAiClient(apiKey);
  const imageResponse = await ai.models.generateContent({ model, prompt });

  const images = imageResponse.generatedImages || [];
  if (!images.length || !images[0].image || !images[0].image.imageBytes) {
    throw new Error('No image bytes returned from image generation');
  }

  const imageBytes = images[0].image.imageBytes;
  const buffer = Buffer.isBuffer(imageBytes) ? imageBytes : Buffer.from(imageBytes);
  ensureDir(path.dirname(outputFilePath));
  fs.writeFileSync(outputFilePath, buffer);

  const mimeType = images[0].image.mimeType || inferImageMimeType(outputFilePath) || 'image/png';
  return { filePath: outputFilePath, mimeType };
}

export async function generateVideoWithVeo({ apiKey, prompt, imagePath, model = 'veo-3.1-generate-preview', resolution = '720p' }) {
  const ai = getAiClient(apiKey);
  const imgBuffer = fs.readFileSync(imagePath);
  const imgMime = inferImageMimeType(imagePath) || 'image/png';

  const operation = await ai.models.generateVideos({
    model,
    prompt,
    image: { imageBytes: imgBuffer, mimeType: imgMime },
    videoConfig: { durationSeconds: 8, resolution, aspectRatio: '16:9' },
  });

  if (!operation || !operation.name) {
    throw new Error('Unexpected video operation response; missing name');
  }
  return operation;
}

export async function pollOperationUntilDone({ apiKey, operation, operationName, pollMs = 5000, timeoutMs = 10 * 60 * 1000 }) {
  const ai = getAiClient(apiKey);
  const start = Date.now();
  let current = operation || { name: operationName };
  while (true) {
    current = await ai.operations.getVideosOperation({ operation: current });
    if (current.done) {
      return current;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for operation to complete');
    }
    await sleep(pollMs);
  }
}

export async function downloadGeneratedVideo({ apiKey, operationResult, outputFilePath }) {
  const ai = getAiClient(apiKey);
  const response = operationResult.response || {};
  const videos = response.generatedVideos || [];
  if (!videos.length || !videos[0].video) {
    throw new Error('Operation completed but no video file reference found');
  }
  ensureDir(path.dirname(outputFilePath));
  await ai.files.download({ file: videos[0].video, downloadPath: outputFilePath });
  return { filePath: outputFilePath, fileUrl: `file://${outputFilePath}` };
}

export function inferImageMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


