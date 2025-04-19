import { getAverageColor } from 'fast-average-color-node';
import { readdir, writeFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');  // repo root
const dir = join(ROOT, 'emojis');
const files = (await readdir(dir)).filter(f => /\.(png|jpe?g|svg)$/i.test(f));

const meta = await Promise.all(
    files.map(async f => {
        const { value: [r, g, b] } =
            await getAverageColor(join(dir, f), { mode: 'speed', silent: true });

        return { image_id: f.replace(extname(f), ''), average_rgb: [r, g, b] };
    })
);

await writeFile(join(ROOT, 'web', 'emoji_metadata.json'), JSON.stringify(meta));
console.log(`wrote ${meta.length} entries`);


