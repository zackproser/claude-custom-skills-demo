## Animated Image (Gemini → Veo) Skill

Generates a minimalist image with Google's image model, then animates it using the latest video model.

### Setup

1. Create `.env` from example:
   ```bash
   cp .env.example .env
   # set GOOGLE_API_KEY
   ```

2. Install deps:
   ```bash
   npm install
   ```

### Usage

- Generate an image (PNG):
  ```bash
  npm run generate:image -- "A wooden ball on a ramp, clean primary colors, minimalist, clean lines."
  ```

- Generate a video (MP4) from an existing image:
  ```bash
  npm run generate:video -- outputs/image-<timestamp>.png "Animate the scene to show the wooden ball rolling down the ramp."
  ```

- End-to-end demo (image → video):
  ```bash
  npm run demo -- "A wooden ball on a ramp, clean primary colors, minimalist, clean lines." "Animate the scene to show the wooden ball rolling down the ramp."
  ```

Outputs are saved in `outputs/`.

### Claude Skill

Use the folder `skills/animated-image` which contains `SKILL.md` per the Help Center guidance. The packaging script zips the folder contents so `SKILL.md` is at the ZIP root, matching the official examples.

Packaging (per Help Center and examples):
- `SKILL.md` must be at the root of the ZIP.
- Run the packaging script to produce a compliant archive.
- Reference: https://support.claude.com/en/articles/12512198-how-to-create-custom-skills

### Packaging Script

Create a compliant archive with:
```bash
npm run package:skill
```
Output:
- `dist/animated-image.zip` (contains SKILL.md at the root)

### Demo-only: embed API key in archive

For the offsite demo, you can embed a `.env` inside the ZIP so it works out-of-the-box:

```bash
# Prefer a separate env var for demos
DEMO_GOOGLE_API_KEY=sk-xxxxx npm run package:skill
# or fallback to GOOGLE_API_KEY if set in your shell
GOOGLE_API_KEY=sk-xxxxx npm run package:skill
```

The packaging script will place a `.env` with `GOOGLE_API_KEY` and `OUTPUT_DIR=outputs` at the ZIP root, then remove it locally after zipping.

Security note: this is for demo purposes only. Do not distribute real secrets in archives.

### Notes

- Requires Google API access to the image and video models.
- If no animation prompt is supplied, the demo uses a default animation.



