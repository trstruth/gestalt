/// <reference types="webpack-env" />

// ───────────────────────────── WASM loader ──────────────────────────────
async function loadWasmModule() {
    const wasmModule = await import("../pkg/gestalt");
    return wasmModule;
}

// ─────────────────────── Pre‑computed emoji metadata ─────────────────────
import emojiData from "./emojiData";
import type { EmojiData } from "./types";

// ────────────────────────── Helper functions ────────────────────────────
function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image at ${url}`));
        img.src = url;
    });
}

interface PixelData {
    x: number;
    y: number;
    rgb: [number, number, number];
}

function getPixelData(image: HTMLImageElement, step = 100): PixelData[] {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);

    const data = ctx.getImageData(0, 0, image.width, image.height).data;
    const pixels: PixelData[] = [];

    for (let y = 0; y < image.height; y += step) {
        for (let x = 0; x < image.width; x += step) {
            const idx = (y * image.width + x) * 4;
            if (data[idx + 3]) {
                pixels.push({
                    x,
                    y,
                    rgb: [data[idx], data[idx + 1], data[idx + 2]],
                });
            }
        }
    }
    return pixels;
}

// ─────────────────────────── Local interfaces ───────────────────────────
interface EmojiPlacement {
    image_id: string;
    x: number;
    y: number;
}

// ───────────── Map emoji IDs to bundled URLs via require.context ────────
const emojiContext = require.context("../../emojis", false, /\.(png|jpe?g|svg)$/);
const emojiUrls: Record<string, string> = {};

emojiContext.keys().forEach((key: string) => {
    const filename = key.replace("./", "");
    const id = filename.split(".")[0];   // e.g. "emoji_smile"
    emojiUrls[id] = emojiContext(key);
});

function getEmojiUrl(id: string): string {
    return emojiUrls[id];
}

// ─────────────────────────────── Main ───────────────────────────────────
async function run() {
    const { EmojiManagerWasm } = await loadWasmModule();
    const emojiManager = new EmojiManagerWasm(emojiData as EmojiData[]);

    // DOM references
    const fileInput = document.getElementById("targetImageInput") as HTMLInputElement;
    const generateBtn = document.getElementById("generateButton") as HTMLButtonElement;
    const uploadedImage = document.getElementById("uploadedImage") as HTMLImageElement;
    const outputCanvas = document.getElementById("outputCanvas") as HTMLCanvasElement;
    const ctx = outputCanvas.getContext("2d")!;

    // Preview selected image
    fileInput.addEventListener("change", () => {
        const [file] = fileInput.files || [];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => { uploadedImage.src = e.target!.result as string; };
        reader.readAsDataURL(file);
    });

    // Generate mosaic
    generateBtn.addEventListener("click", () => {
        const [file] = fileInput.files || [];
        if (!file) {
            alert("Please select a target image first.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async e => {
            const img = await loadImage(e.target!.result as string);
            const scale = 23;

            outputCanvas.width = img.width * scale;
            outputCanvas.height = img.height * scale;
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, img.width, img.height);

            const pixels = getPixelData(img, 1);
            const placements = emojiManager.generate_layout(pixels) as unknown as EmojiPlacement[];

            const size = 20;
            for (const { image_id, x, y } of placements) {
                try {
                    const emojiImg = await loadImage(getEmojiUrl(image_id));
                    ctx.drawImage(emojiImg, x * scale, y * scale, size, size);
                } catch (err) {
                    console.error(`Failed to load emoji ${image_id}`, err);
                }
            }
        };

        reader.readAsDataURL(file);
    });
}

run().catch(console.error);

