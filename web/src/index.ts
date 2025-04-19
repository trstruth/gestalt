/// <reference types="webpack-env" />

/**
 * Emoji mosaic generator.
 * 
 * Architectural overview
 * ----------------------
 * 1. Pure utilities (loadImage, getPixelData, getEmojiUrl)
 * 2. `EmojiMosaic` orchestrates WASM + drawing logic and is configurable via `MosaicOptions`
 * 3. UI layer (initializes the class and wires DOM events)
 *
 * Extending the UI only requires:
 *   mosaic.setOptions({ renderScale: Number(scaleInput.value) })
 * before calling `generate`.
 */

import emojiData from "./emojiData";
import type { EmojiData } from "./types";

// ────────────────────────── Pure utilities ──────────────────────────────
export function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
        img.src = src;
    });
}

export interface PixelData {
    x: number;
    y: number;
    rgb: [number, number, number];
}

export function getPixelData(image: HTMLImageElement, step = 1): PixelData[] {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");

    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, image.width, image.height);

    const pixels: PixelData[] = [];
    for (let y = 0; y < image.height; y += step) {
        for (let x = 0; x < image.width; x += step) {
            const idx = (y * image.width + x) * 4;
            if (data[idx + 3] !== 0) {
                pixels.push({ x, y, rgb: [data[idx], data[idx + 1], data[idx + 2]] });
            }
        }
    }
    return pixels;
}

// Map emoji IDs to file URLs (bundled by webpack)
const emojiContext = require.context("../../emojis", false, /\.(png|jpe?g|svg)$/);
const emojiUrls: Record<string, string> = {};
emojiContext.keys().forEach((key: string) => {
    const fname = key.replace("./", "");
    emojiUrls[fname.split(".")[0]] = emojiContext(key);
});
export const getEmojiUrl = (id: string): string => emojiUrls[id];

// ───────────────────────────── Core class ───────────────────────────────
interface MosaicOptions {
    sampleStep: number; // pixel sampling granularity
    renderScale: number; // canvas scale multiplier
    tileSize: number; // drawn emoji size in CSS pixels
}

const DEFAULT_OPTIONS: MosaicOptions = { sampleStep: 1, renderScale: 23, tileSize: 20 };

export class EmojiMosaic {
    private wasm!: any;
    private emojiManager: any;
    private opts: MosaicOptions;

    private constructor(wasm: any, opts: Partial<MosaicOptions>) {
        this.wasm = wasm;
        this.emojiManager = new this.wasm.EmojiManagerWasm(emojiData as EmojiData[]);
        this.opts = { ...DEFAULT_OPTIONS, ...opts };
    }

    /** Factory that hides WASM loading details from consumers */
    static async create(opts: Partial<MosaicOptions> = {}): Promise<EmojiMosaic> {
        const wasmModule = await import("../pkg/gestalt");
        return new EmojiMosaic(wasmModule, opts);
    }

    updateOptions(opts: Partial<MosaicOptions>) {
        this.opts = { ...this.opts, ...opts };
    }

    async generate(file: File, canvas: HTMLCanvasElement): Promise<void> {
        const dataUrl = await this.readFileAsDataURL(file);
        const img = await loadImage(dataUrl);

        const { renderScale: scale, tileSize } = this.opts;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");

        ctx.imageSmoothingEnabled = false; // keep crisp pixels
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const pixels = getPixelData(img, this.opts.sampleStep);
        const placements = this.emojiManager.generate_layout(pixels) as EmojiPlacement[];

        for (const p of placements) {
            try {
                const emojiImg = await loadImage(getEmojiUrl(p.image_id));
                ctx.drawImage(emojiImg, p.x * scale, p.y * scale, tileSize, tileSize);
            } catch (e) {
                console.error(`Failed to draw emoji "${p.image_id}"`, e);
            }
        }
    }

    // ───────────── private helpers ─────────────
    private readFileAsDataURL(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}

// ────────────────────────── DOM bootstrap ───────────────────────────────
(async function bootstrap() {
    const mosaic = await EmojiMosaic.create();

    const fileInput = document.getElementById("targetImageInput") as HTMLInputElement;
    const generateBtn = document.getElementById("generateButton") as HTMLButtonElement;
    const scaleInput = document.getElementById("scaleInput") as HTMLInputElement | null; // optional
    const previewImg = document.getElementById("uploadedImage") as HTMLImageElement;
    const outputCanvas = document.getElementById("outputCanvas") as HTMLCanvasElement;

    fileInput.addEventListener("change", () => {
        const [file] = fileInput.files || [];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => (previewImg.src = reader.result as string);
        reader.readAsDataURL(file);
    });

    generateBtn.addEventListener("click", async () => {
        const [file] = fileInput.files || [];
        if (!file) return alert("Select a target image first.");

        if (scaleInput?.value) {
            mosaic.updateOptions({ renderScale: Number(scaleInput.value) });
        }
        await mosaic.generate(file, outputCanvas);
    });
})();

// ───────────────────────── Local interfaces ─────────────────────────────
interface EmojiPlacement {
    image_id: string;
    x: number;
    y: number;
}

