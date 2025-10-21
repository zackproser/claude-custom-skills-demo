import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateImageWithGemini, getEnvOrThrow, ensureDir } from './lib/google.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from cwd, then from skill root (parent of scripts)
dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const apiKey = getEnvOrThrow('GOOGLE_API_KEY');
  const outputDir = process.env.OUTPUT_DIR || path.join(__dirname, '..', '..', '..', 'outputs');
  ensureDir(outputDir);

  const promptArg = process.argv.slice(2).join(' ').trim();
  const prompt = promptArg || 'A wooden ball on a ramp, clean primary colors, minimalist, clean lines.';

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFilePath = path.join(outputDir, `image-${timestamp}.png`);

  const { filePath, mimeType } = await generateImageWithGemini({
    apiKey,
    prompt,
    outputFilePath,
  });

  const sidecar = {
    status: 'ok',
    filePath,
    mimeType,
    fileUrl: `file://${filePath}`,
  };
  console.log(JSON.stringify(sidecar, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ status: 'error', message: err.message }));
  process.exit(1);
});


