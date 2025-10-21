import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEnvOrThrow, generateVideoWithVeo, pollOperationUntilDone, downloadGeneratedVideo, ensureDir } from './lib/google.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const apiKey = getEnvOrThrow('GOOGLE_API_KEY');
  const outputDir = process.env.OUTPUT_DIR || path.join(__dirname, '..', 'outputs');
  ensureDir(outputDir);

  const imagePath = process.argv[2];
  if (!imagePath) {
    throw new Error('Usage: npm run generate:video -- <path-to-image> [animation prompt...]');
  }

  const promptFromArgs = process.argv.slice(3).join(' ').trim();
  const prompt = promptFromArgs || 'Animate the scene to show the wooden ball rolling down the ramp.';

  const op = await generateVideoWithVeo({ apiKey, prompt, imagePath });

  const done = await pollOperationUntilDone({ apiKey, operationName: op.name, pollMs: 7000, timeoutMs: 15 * 60 * 1000 });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFilePath = path.join(outputDir, `video-${timestamp}.mp4`);

  const result = await downloadGeneratedVideo({ apiKey, operationResult: done, outputFilePath });
  console.log(JSON.stringify({ status: 'ok', filePath: result.filePath }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ status: 'error', message: err.message }));
  process.exit(1);
});



