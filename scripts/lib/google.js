import fs from 'node:fs';
import path from 'node:path';
import fetch from 'node-fetch';

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

export async function generateImageWithGemini({ apiKey, prompt, model = 'gemini-2.5-flash-image', outputFilePath }) {
  const url = `${GOOGLE_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.6,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Image generation failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const candidates = json.candidates || [];
  if (!candidates.length) {
    throw new Error('No candidates returned from image generation');
  }

  // Find first inline image part
  let imagePart = null;
  for (const candidate of candidates) {
    const parts = (candidate.content && candidate.content.parts) || [];
    for (const part of parts) {
      if (part.inlineData && part.inlineData.mimeType && part.inlineData.data) {
        imagePart = part;
        break;
      }
    }
    if (imagePart) break;
  }

  if (!imagePart) {
    throw new Error('No inline image found in response');
  }

  const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
  ensureDir(path.dirname(outputFilePath));
  fs.writeFileSync(outputFilePath, buffer);

  return { filePath: outputFilePath, mimeType: imagePart.inlineData.mimeType };
}

export async function generateVideoWithVeo({ apiKey, prompt, imagePath, model = 'veo-3.1-generate-preview', resolution = '720p' }) {
  // Read image and embed as inlineData input for conditioning
  const imgBuffer = fs.readFileSync(imagePath);
  const imgB64 = toBase64(imgBuffer);
  const imgMime = inferImageMimeType(imagePath);

  // Veo video generation is asynchronous; returns an operation
  const url = `${GOOGLE_API_BASE}/models/${encodeURIComponent(model)}:generateVideo?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: imgMime, data: imgB64 } },
        ],
      },
    ],
    videoConfig: {
      // Common defaults; adjust as desired
      durationSeconds: 8,
      // Example: '720p' | '1080p'
      resolution,
      aspectRatio: '16:9',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Video generation request failed (${res.status}): ${text}`);
  }

  const op = await res.json();
  if (!op || !op.name) {
    throw new Error('Unexpected video operation response; missing name');
  }

  return op;
}

export async function pollOperationUntilDone({ apiKey, operationName, pollMs = 5000, timeoutMs = 10 * 60 * 1000 }) {
  const start = Date.now();
  while (true) {
    const url = `${GOOGLE_API_BASE}/operations/${encodeURIComponent(operationName)}?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Polling failed (${res.status}): ${text}`);
    }
    const json = await res.json();
    if (json.done) {
      return json;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for operation to complete');
    }
    await sleep(pollMs);
  }
}

export async function downloadGeneratedVideo({ apiKey, operationResult, outputFilePath }) {
  // Expect response to include a file reference for the video
  // Common patterns: response.generatedVideos[0].video.uri or .video (file id)
  const response = operationResult.response || {};
  const videos = response.generatedVideos || response.videos || [];
  if (!videos.length) {
    throw new Error('Operation completed but no videos found in response');
  }
  const videoRef = videos[0].video || videos[0];

  // Try multiple shapes: { uri }, { file }, string id
  let downloadUrl = null;
  let fileId = null;
  if (typeof videoRef === 'string') {
    fileId = videoRef;
  } else if (videoRef.uri) {
    downloadUrl = videoRef.uri;
  } else if (videoRef.file) {
    fileId = typeof videoRef.file === 'string' ? videoRef.file : videoRef.file.name;
  } else if (videoRef.name) {
    fileId = videoRef.name;
  }

  if (!downloadUrl && fileId) {
    // Use files download endpoint if available
    downloadUrl = `${GOOGLE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(apiKey)}`;
  }

  if (!downloadUrl) {
    throw new Error('Could not resolve video download URL');
  }

  const res = await fetch(downloadUrl);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Video download failed (${res.status}): ${text}`);
  }
  const arrayBuf = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  ensureDir(path.dirname(outputFilePath));
  fs.writeFileSync(outputFilePath, buffer);
  return { filePath: outputFilePath };
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



