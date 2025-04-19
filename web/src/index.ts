/// <reference types="webpack-env" />

/**
 * Emoji mosaic generator – v4
 * Adds user‑controlled canvas background color (hex).
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
            if (data[idx + 3]) pixels.push({ x, y, rgb: [data[idx], data[idx + 1], data[idx + 2]] });
        }
    }
    return pixels;
}

// Map emoji IDs to bundled URLs (via webpack)
const emojiContext = require.context("../../emojis", false, /\.(png|jpe?g|svg)$/);
const emojiUrls: Record<string, string> = {};
emojiContext.keys().forEach((key: string) => {
    const fname = key.replace("./", "");
    emojiUrls[fname.split(".")[0]] = emojiContext(key);
});
const getEmojiUrl = (id: string): string => emojiUrls[id];

// Emoji image cache
const emojiCache = new Map<string, Promise<HTMLImageElement>>();
const getEmojiImage = (id: string) => {
    if (!emojiCache.has(id)) emojiCache.set(id, loadImage(getEmojiUrl(id)));
    return emojiCache.get(id)!;
};

// ───────────────────────────── Core class ───────────────────────────────
interface MosaicOptions {
    sampleStep: number;
    renderScale: number;
    tileSize: number;
    backgroundColor: string; // new!
}

const DEFAULT_OPTS: MosaicOptions = {
    sampleStep: 1,
    renderScale: 23,
    tileSize: 20,
    backgroundColor: "#ffffff",
};

export class EmojiMosaic {
    private emojiManager: any;
    private opts: MosaicOptions;

    private constructor(wasm: any, opts: Partial<MosaicOptions>) {
        this.emojiManager = new wasm.EmojiManagerWasm(emojiData as EmojiData[]);
        this.opts = { ...DEFAULT_OPTS, ...opts };
    }

    static async create(opts: Partial<MosaicOptions> = {}): Promise<EmojiMosaic> {
        const wasm = await import("../pkg/gestalt");
        return new EmojiMosaic(wasm, opts);
    }

    updateOptions(delta: Partial<MosaicOptions>) {
        this.opts = { ...this.opts, ...delta };
    }

    async generate(file: File, canvas: HTMLCanvasElement): Promise<void> {
        const img = await loadImage(await this.readFileAsDataURL(file));
        const { renderScale: scale, tileSize, backgroundColor } = this.opts;

        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");
        ctx.imageSmoothingEnabled = false;

        // Fill background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const pixels = getPixelData(img, this.opts.sampleStep);
        const placements = this.emojiManager.generate_layout(pixels) as EmojiPlacement[];

        const uniqueIds = [...new Set(placements.map(p => p.image_id))];
        await Promise.all(uniqueIds.map(getEmojiImage));

        for (const { image_id, x, y } of placements) {
            const emojiImg = await getEmojiImage(image_id);
            ctx.drawImage(emojiImg, x * scale, y * scale, tileSize, tileSize);
        }
    }

    private readFileAsDataURL(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result as string);
            fr.onerror = reject;
            fr.readAsDataURL(file);
        });
    }
}

// ────────────────────────── DOM bootstrap ───────────────────────────────
(async () => {
    const mosaic = await EmojiMosaic.create();

    const qs = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

    const fileInput = qs<HTMLInputElement>("targetImageInput")!;
    const generateBtn = qs<HTMLButtonElement>("generateButton")!;
    const previewImg = qs<HTMLImageElement>("uploadedImage")!;
    const outputCanvas = qs<HTMLCanvasElement>("outputCanvas")!;

    // parameter inputs
    const scaleInput = qs<HTMLInputElement>("scaleInput");
    const tileSizeInput = qs<HTMLInputElement>("tileSizeInput");
    const stepInput = qs<HTMLInputElement>("sampleStepInput");
    const bgInput = qs<HTMLInputElement>("backgroundColorInput");

    fileInput.addEventListener("change", () => {
        const [file] = fileInput.files || [];
        if (!file) return;
        const fr = new FileReader();
        fr.onload = () => (previewImg.src = fr.result as string);
        fr.readAsDataURL(file);
    });

    generateBtn.addEventListener("click", async () => {
        const [file] = fileInput.files || [];
        if (!file) return alert("Choose an image first.");

        const delta: Partial<MosaicOptions> = {};
        if (scaleInput?.value) delta.renderScale = +scaleInput.value;
        if (tileSizeInput?.value) delta.tileSize = +tileSizeInput.value;
        if (stepInput?.value) delta.sampleStep = +stepInput.value;
        if (bgInput?.value) delta.backgroundColor = bgInput.value;
        mosaic.updateOptions(delta);

        await mosaic.generate(file, outputCanvas);
    });
})();

// ───────────────────────── Local interfaces ─────────────────────────────
interface EmojiPlacement {
    image_id: string;
    x: number;
    y: number;
}

