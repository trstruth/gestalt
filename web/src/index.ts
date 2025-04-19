/// <reference types="webpack-env" />

/**
 * Emoji mosaic generator – v7 (PokéEdition + live preview)
 * • Replaces file‑upload with Pokémon sprite fetch via PokeAPI
 * • User picks: Pokémon name, generation, shiny toggle
 * • **NEW:** sprite preview updates instantly while controls change
 */

import emojiData from "./emojiData";
import type { EmojiData } from "./types";

// ────────────────────────── Utility helpers ─────────────────────────────
export function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous"; // allow CORS for PokeAPI images
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
        img.src = src;
    });
}

function romanGenToNum(roman: string): number {
    return { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 }[roman] ?? 0;
}

export interface PixelData { x: number; y: number; rgb: [number, number, number]; }

export function getPixelData(img: HTMLImageElement, step = 1): PixelData[] {
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);

    const pixels: PixelData[] = [];
    for (let y = 0; y < img.height; y += step) {
        for (let x = 0; x < img.width; x += step) {
            const i = (y * img.width + x) * 4;
            if (data[i + 3]) pixels.push({ x, y, rgb: [data[i], data[i + 1], data[i + 2]] });
        }
    }
    return pixels;
}

/* ───────────────────────── Debounce helper (NEW) ─────────────────────── */
function debounce<F extends (...a: any[]) => void>(fn: F, ms = 300) {
    let t = 0;
    return (...a: Parameters<F>) => {
        clearTimeout(t);
        t = window.setTimeout(() => fn(...a), ms);
    };
}

// ───────────────────────── Emoji asset helpers ──────────────────────────
const emojiCtx = require.context("../../emojis", false, /\.(png|jpe?g|svg)$/);
const emojiUrls: Record<string, string> = {};
emojiCtx.keys().forEach(k => { emojiUrls[k.replace("./", "").split(".")[0]] = emojiCtx(k); });
const emojiCache = new Map<string, Promise<HTMLImageElement>>();
const getEmojiImage = (id: string) => {
    if (!emojiCache.has(id)) emojiCache.set(id, loadImage(emojiUrls[id]));
    return emojiCache.get(id)!;
};

// ───────────────────────── Resolution presets (unchanged) ───────────────
export const RES_PRESETS = {
    original: null,
    iphone: { w: 1170, h: 2532 },
    desktopHD: { w: 1920, h: 1080 },
    desktop2K: { w: 2560, h: 1440 },
    desktop4K: { w: 3840, h: 2160 },
} as const;
export type PresetKey = keyof typeof RES_PRESETS;

// ───────────────────────── Pokémon sprite fetcher ───────────────────────
const GEN_MAP: Record<string, string> = {
    "1": "generation-i", "2": "generation-ii", "3": "generation-iii",
    "4": "generation-iv", "5": "generation-v", "6": "generation-vi",
    "7": "generation-vii", "8": "generation-viii", "9": "generation-ix",
};

async function fetchPokemonSprite(name: string, gen: string, shiny: boolean): Promise<HTMLImageElement> {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name.toLowerCase()}`);
    if (!res.ok) throw new Error("Pokémon not found");
    const data = await res.json();

    // traverse sprite tree heuristically
    let url: string | null = null;
    const genKey = GEN_MAP[gen];
    const versions = data.sprites.versions as any;
    if (genKey && versions[genKey]) {
        const verObj = versions[genKey];
        for (const game of Object.values(verObj)) {
            const candidate = shiny ? (game as any).front_shiny : (game as any).front_default;
            if (candidate) { url = candidate; break; }
        }
    }
    if (!url) url = shiny ? data.sprites.front_shiny : data.sprites.front_default;
    if (!url) throw new Error("No sprite available for selection");
    return loadImage(url);
}

const listEl = document.getElementById("pokemonList") as HTMLDataListElement;
fetch("https://pokeapi.co/api/v2/pokemon?limit=2000")
    .then(r => r.json())
    .then(({ results }) => {
        listEl.innerHTML = results
            .map((p: { name: string }) => `<option value="${p.name}">`)
            .join("");
    });

// ───────────────────────────── Core class ───────────────────────────────
interface MosaicOptions {
    sampleStep: number; renderScale: number; tileSize: number; backgroundColor: string;
    preset: PresetKey; marginRatio: number;
}

const DEF: MosaicOptions = { sampleStep: 1, renderScale: 23, tileSize: 20, backgroundColor: "#ffffff", preset: "original", marginRatio: 0.10 };

export class EmojiMosaic {
    private em: any; private opts: MosaicOptions;
    private constructor(wasm: any, opts: Partial<MosaicOptions>) { this.em = new wasm.EmojiManagerWasm(emojiData); this.opts = { ...DEF, ...opts }; }
    static async create(o: Partial<MosaicOptions> = {}) { return new EmojiMosaic(await import("../pkg/gestalt"), o); }
    updateOptions(d: Partial<MosaicOptions>) { this.opts = { ...this.opts, ...d }; }

    async generateFromImage(img: HTMLImageElement, canvas: HTMLCanvasElement) {
        const { sampleStep, renderScale: s, tileSize, backgroundColor, preset, marginRatio: m } = this.opts;
        const px = getPixelData(img, sampleStep);
        const pls = this.em.generate_layout(px) as EmojiPlacement[];
        const xs = pls.map(p => p.x), ys = pls.map(p => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
        const mw = (maxX - minX + 1) * s, mh = (maxY - minY + 1) * s;
        const off = document.createElement("canvas"); off.width = mw; off.height = mh; const oc = off.getContext("2d")!; oc.imageSmoothingEnabled = false; oc.fillStyle = backgroundColor; oc.fillRect(0, 0, mw, mh);
        await Promise.all([...new Set(pls.map(p => p.image_id))].map(getEmojiImage));
        for (const { image_id, x, y } of pls) { oc.drawImage(await getEmojiImage(image_id), (x - minX) * s, (y - minY) * s, tileSize, tileSize); }
        const presetDims = RES_PRESETS[preset];
        if (presetDims) { canvas.width = presetDims.w; canvas.height = presetDims.h; } else { canvas.width = mw; canvas.height = mh; }
        const ctx = canvas.getContext("2d")!; ctx.imageSmoothingEnabled = false; ctx.fillStyle = backgroundColor; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const safeW = canvas.width * (1 - m * 2), safeH = canvas.height * (1 - m * 2);
        const scaleFactor = presetDims ? Math.min(safeW / mw, safeH / mh) : 1;
        const dw = mw * scaleFactor, dh = mh * scaleFactor; const dx = (canvas.width - dw) / 2, dy = (canvas.height - dh) / 2;
        ctx.drawImage(off, 0, 0, mw, mh, dx, dy, dw, dh);
    }
}

// ────────────────────────── DOM bootstrap ───────────────────────────────
(async () => {
    const qs = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
    const mosaic = await EmojiMosaic.create();

    const previewImg = qs<HTMLImageElement>("uploadedImage")!;
    previewImg.src = "missingno.png";

    const nameInput = qs<HTMLInputElement>("pokemonInput")!;
    const genSelect = qs<HTMLSelectElement>("generationSelect")!;
    const shinyChk = qs<HTMLInputElement>("shinyCheck")!;
    const generateBtn = qs<HTMLButtonElement>("generateButton")!;
    const canvas = qs<HTMLCanvasElement>("outputCanvas")!;

    const scaleInput = qs<HTMLInputElement>("scaleInput");
    const bgInput = qs<HTMLInputElement>("backgroundColorInput");
    const presetSel = qs<HTMLSelectElement>("presetSelect");
    const marginInput = qs<HTMLInputElement>("marginInput");

    /* ───── live preview wiring (NEW) ───── */
    let token = 0;
    const updatePreview = async () => {
        const name = nameInput.value.trim().toLowerCase();
        if (!name) { previewImg.src = "missingno.png"; return; }

        const thisRun = ++token;
        try {
            const sprite = await fetchPokemonSprite(name, genSelect.value, shinyChk.checked);
            if (thisRun === token) previewImg.src = sprite.src;
        } catch {
            if (thisRun === token) previewImg.src = "missingno.png";
        }
    };
    const debouncedPreview = debounce(updatePreview, 250);

    nameInput.addEventListener("input", debouncedPreview);
    genSelect.addEventListener("change", debouncedPreview);
    shinyChk.addEventListener("change", debouncedPreview);

    /* ───── Generate button ───── */
    generateBtn.addEventListener("click", async () => {
        const poke = nameInput.value.trim();
        if (!poke) return alert("Enter Pokémon name");

        try {
            const sprite = await fetchPokemonSprite(poke, genSelect.value, shinyChk.checked);
            previewImg.src = sprite.src;

            const delta: Partial<MosaicOptions> = {};
            if (scaleInput?.value) delta.renderScale = +scaleInput.value;
            if (bgInput?.value) delta.backgroundColor = bgInput.value;
            if (presetSel?.value) delta.preset = presetSel.value as PresetKey;
            if (marginInput?.value) delta.marginRatio = +marginInput.value / 100;
            mosaic.updateOptions(delta);

            await mosaic.generateFromImage(sprite, canvas);
        } catch (e) {
            alert((e as Error).message);
        }
    });

    /* ───── nameInput change: enable/disable generation options ───── */
    nameInput.addEventListener("change", async () => {
        const name = nameInput.value.trim().toLowerCase();
        if (!name) {
            for (const opt of Array.from(genSelect.options)) opt.disabled = true;
            updatePreview(); // reset sprite
            return;
        }

        try {
            const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
            if (!res.ok) throw new Error();
            const data = await res.json();

            const gensAvailable = new Set<number>();
            for (const [genKey, games] of Object.entries(data.sprites.versions)) {
                const roman = genKey.split("-")[1]; // "generation-vi" → "vi"
                const n = romanGenToNum(roman as string);
                for (const v of Object.values(games as Record<string, any>)) {
                    if (v.front_default || v.front_shiny) { gensAvailable.add(n); break; }
                }
            }

            for (const opt of Array.from(genSelect.options)) {
                const num = Number(opt.value);
                opt.disabled = !gensAvailable.has(num);
            }
        } catch {
            for (const opt of Array.from(genSelect.options)) opt.disabled = true;
        }

        updatePreview(); // immediate feedback after generation list refresh
    });
})();

// ───────────────────────── Local interfaces ─────────────────────────────
interface EmojiPlacement { image_id: string; x: number; y: number; }

