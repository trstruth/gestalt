/// <reference types="webpack-env" />

/**
 * Emoji mosaic generator – v5
 * • Resolution presets (original crop, iPhone portrait, 1080 p, 2 K, 4 K)
 * • Centres and scales mosaic into the chosen preset canvas
 */

import emojiData from "./emojiData";
import type { EmojiData } from "./types";

// ────────────────────────── Utility helpers ─────────────────────────────
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
    const c = document.createElement("canvas");
    c.width = image.width;
    c.height = image.height;
    const ctx = c.getContext("2d");
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

// ───────────────────────── Image / emoji asset helpers ──────────────────
const emojiContext = require.context("../../emojis", false, /\.(png|jpe?g|svg)$/);
const emojiUrls: Record<string, string> = {};
emojiContext.keys().forEach(k => { emojiUrls[k.replace("./", "").split(".")[0]] = emojiContext(k); });
const emojiCache = new Map<string, Promise<HTMLImageElement>>();
const getEmojiImage = (id: string) => {
    if (!emojiCache.has(id)) emojiCache.set(id, loadImage(emojiUrls[id]));
    return emojiCache.get(id)!;
};

// ───────────────────────── Resolution presets ───────────────────────────
export const RES_PRESETS = {
    original: null,                       // tight crop (no padding)
    iphone: { w: 1170, h: 2532 },       // iPhone 12‑15 portrait (≈19.5∶9)
    desktopHD: { w: 1920, h: 1080 },       // 1080 p
    desktop2K: { w: 2560, h: 1440 },       // 1440 p
    desktop4K: { w: 3840, h: 2160 },       // UHD
} as const;
export type PresetKey = keyof typeof RES_PRESETS;

// ───────────────────────────── Core class ───────────────────────────────
interface MosaicOptions {
    sampleStep: number;
    renderScale: number;   // per‑pixel emoji spacing when building the mosaic
    tileSize: number;      // drawn emoji size
    backgroundColor: string;
    preset: PresetKey;     // output resolution preset
    marginRatio: number;   // margin around the generated mosaic
}

const DEFAULT_OPTS: MosaicOptions = {
    sampleStep: 1,
    renderScale: 25,
    tileSize: 20,
    backgroundColor: "#ffffff",
    preset: "original",
    marginRatio: 0.19,
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

    updateOptions(delta: Partial<MosaicOptions>) { this.opts = { ...this.opts, ...delta }; }

    // ───────────── public API ─────────────
    async generate(file: File, canvas: HTMLCanvasElement): Promise<void> {
        const img = await loadImage(await this.readFileAsDataURL(file));
        const { sampleStep, renderScale: scale, tileSize, backgroundColor, preset } = this.opts;

        // 1️⃣ Build mosaic on an offscreen canvas (tight crop)
        const pixels = getPixelData(img, sampleStep);
        const placements = this.emojiManager.generate_layout(pixels) as EmojiPlacement[];

        // bounding box around placements
        const xs = placements.map(p => p.x), ys = placements.map(p => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const mosaicW = (maxX - minX + 1) * scale;
        const mosaicH = (maxY - minY + 1) * scale;

        const off = document.createElement("canvas");
        off.width = mosaicW; off.height = mosaicH;
        const offCtx = off.getContext("2d")!;
        offCtx.imageSmoothingEnabled = false;
        offCtx.fillStyle = backgroundColor;
        offCtx.fillRect(0, 0, mosaicW, mosaicH);

        // Pre‑fetch distinct emoji images
        await Promise.all([...new Set(placements.map(p => p.image_id))].map(getEmojiImage));

        for (const { image_id, x, y } of placements) {
            const emojiImg = await getEmojiImage(image_id);
            offCtx.drawImage(emojiImg, (x - minX) * scale, (y - minY) * scale, tileSize, tileSize);
        }

        // 2️⃣ Prepare final canvas dimensions per preset
        const presetDims = RES_PRESETS[preset];
        if (presetDims) {
            canvas.width = presetDims.w;
            canvas.height = presetDims.h;
        } else {
            canvas.width = mosaicW;
            canvas.height = mosaicH;
        }

        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 3️⃣ Scale + centre mosaic into target canvas
        const pad = this.opts.marginRatio;
        const safeW = canvas.width * (1 - pad * 2);
        const safeH = canvas.height * (1 - pad * 2);

        const scaleFactor = presetDims
            ? Math.min(safeW / mosaicW, safeH / mosaicH)
            : 1;

        const drawW = mosaicW * scaleFactor;
        const drawH = mosaicH * scaleFactor;

        const dx = (canvas.width - drawW) / 2;
        const dy = (canvas.height - drawH) / 2;

        ctx.drawImage(off, 0, 0, mosaicW, mosaicH, dx, dy, drawW, drawH);
    }

    // internal helper
    private readFileAsDataURL(f: File): Promise<string> {
        return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f); });
    }
}

// ────────────────────────── DOM bootstrap ───────────────────────────────
(async () => {
    const qs = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
    const mosaic = await EmojiMosaic.create();

    const fileInput = qs<HTMLInputElement>("targetImageInput")!;
    const generateBtn = qs<HTMLButtonElement>("generateButton")!;
    const previewImg = qs<HTMLImageElement>("uploadedImage")!;
    const outputCanvas = qs<HTMLCanvasElement>("outputCanvas")!;

    const scaleInput = qs<HTMLInputElement>("scaleInput");
    const tileSizeInput = qs<HTMLInputElement>("tileSizeInput");
    const stepInput = qs<HTMLInputElement>("sampleStepInput");
    const bgInput = qs<HTMLInputElement>("backgroundColorInput");
    const presetSelect = qs<HTMLSelectElement>("presetSelect");
    const marginInput = qs<HTMLInputElement>("marginInput");

    fileInput.addEventListener("change", () => {
        const [f] = fileInput.files || [];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => (previewImg.src = r.result as string);
        r.readAsDataURL(f);
    });

    generateBtn.addEventListener("click", async () => {
        const [f] = fileInput.files || [];
        if (!f) return alert("Choose an image first.");

        const delta: Partial<MosaicOptions> = {};
        if (scaleInput?.value) delta.renderScale = +scaleInput.value;
        if (tileSizeInput?.value) delta.tileSize = +tileSizeInput.value;
        if (stepInput?.value) delta.sampleStep = +stepInput.value;
        if (bgInput?.value) delta.backgroundColor = bgInput.value;
        if (presetSelect?.value) delta.preset = presetSelect.value as PresetKey;
        if (marginInput?.value) delta.marginRatio = +marginInput.value / 100;
        mosaic.updateOptions(delta);

        await mosaic.generate(f, outputCanvas);
    });
})();

// ───────────────────────── Local interfaces ─────────────────────────────
interface EmojiPlacement {
    image_id: string;
    x: number;
    y: number;
}

