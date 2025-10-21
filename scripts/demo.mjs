import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runNode(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || stdout));
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const imagePrompt = args[0] || 'A wooden ball on a ramp, clean primary colors, minimalist, clean lines.';
  const animationPrompt = args[1] || 'Animate the scene to show the wooden ball rolling down the ramp.';

  const imageScript = path.join(__dirname, 'generateImage.mjs');
  const videoScript = path.join(__dirname, 'generateVideo.mjs');

  const imageRes = await runNode(imageScript, [imagePrompt]);
  const imageJson = JSON.parse(imageRes.stdout);
  if (imageJson.status !== 'ok') throw new Error('Image generation failed');
  console.log('Image generated at:', imageJson.filePath);

  const videoRes = await runNode(videoScript, [imageJson.filePath, animationPrompt]);
  const videoJson = JSON.parse(videoRes.stdout);
  if (videoJson.status !== 'ok') throw new Error('Video generation failed');
  console.log('Video generated at:', videoJson.filePath);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});



