import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEnvOrThrow, generateVideoWithVeo, pollOperationUntilDone, downloadGeneratedVideo, ensureDir } from './lib/google.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from cwd, then from skill root
dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const apiKey = getEnvOrThrow('GOOGLE_API_KEY');
  const outputDir = process.env.OUTPUT_DIR || path.join(__dirname, '..', '..', '..', 'outputs');
  ensureDir(outputDir);

  const imagePath = process.argv[2];
  if (!imagePath) {
    throw new Error('Usage: node scripts/generateVideo.mjs <path-to-image> [animation prompt...]');
  }

  const promptFromArgs = process.argv.slice(3).join(' ').trim();
  // If no animation prompt given, guess an obvious motion from filename keywords
  let prompt = promptFromArgs;
  if (!prompt) {
    const lower = path.basename(imagePath).toLowerCase();
    if (lower.includes('ball')) {
      prompt = 'Animate the scene to show the ball rolling naturally across the surface.';
    } else if (lower.includes('child') || lower.includes('person')) {
      prompt = 'Animate the scene to show the subject running smoothly forward with natural motion.';
    } else if (lower.includes('car')) {
      prompt = 'Animate the scene to show the car moving forward along the road.';
    } else if (lower.includes('flag')) {
      prompt = 'Animate the scene to show the flag waving gently in the wind.';
    } else {
      prompt = 'Animate the scene to introduce a subtle, natural movement consistent with the image context.';
    }
  }

  const op = await generateVideoWithVeo({ apiKey, prompt, imagePath });

  const done = await pollOperationUntilDone({ apiKey, operationName: op.name, pollMs: 7000, timeoutMs: 15 * 60 * 1000 });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFilePath = path.join(outputDir, `video-${timestamp}.mp4`);

  const result = await downloadGeneratedVideo({ apiKey, operationResult: done, outputFilePath });
  console.log(JSON.stringify({ status: 'ok', filePath: result.filePath, fileUrl: result.fileUrl }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ status: 'error', message: err.message }));
  process.exit(1);
});


