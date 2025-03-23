/// <reference types="webpack-env" />

// Dynamically load the WASM module.
async function loadWasmModule() {
    const wasmModule = await import("../pkg/gestalt");
    return wasmModule;
}

// Utility function: load an image from a URL.
function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image at ${url}`));
        img.src = url;
    });
}

// Compute the average RGB value of an image.
async function computeAverageRGB(image: HTMLImageElement): Promise<[number, number, number]> {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, image.width, image.height).data;
    let totalR = 0, totalG = 0, totalB = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a > 0) {
            totalR += data[i];
            totalG += data[i + 1];
            totalB += data[i + 2];
            count++;
        }
    }
    return count ? [totalR / count, totalG / count, totalB / count] : [0, 0, 0];
}

// Extract pixel data from an image using a hidden canvas.
function getPixelData(image: HTMLImageElement, step: number = 10): PixelData[] {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = image.width;
    tempCanvas.height = image.height;
    const ctx = tempCanvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, image.width, image.height).data;
    const pixels: PixelData[] = [];
    for (let y = 0; y < image.height; y += step) {
        for (let x = 0; x < image.width; x += step) {
            const index = (y * image.width + x) * 4;
            const r = imageData[index];
            const g = imageData[index + 1];
            const b = imageData[index + 2];
            const a = imageData[index + 3];
            if (a > 0) {
                pixels.push({
                    x,
                    y,
                    rgb: [r, g, b],
                });
            }
        }
    }
    return pixels;
}

// Interfaces mirroring the Rust structs.
interface EmojiData {
    image_id: string;
    average_rgb: [number, number, number];
}

interface PixelData {
    x: number;
    y: number;
    rgb: [number, number, number];
}

interface EmojiPlacement {
    image_id: string;
    x: number;
    y: number;
}

// Use require.context to load all emoji images from the repo's "emojis" directory.
// From web/src, two levels up is the repo root.
const emojiContext = require.context('../../emojis', false, /\.(png|jpe?g|svg)$/);
const emojiUrls: { [id: string]: string } = {};
emojiContext.keys().forEach((key: string) => {
    // key is in the form "./emoji_smile.png"
    const filename = key.replace('./', '');
    const id = filename.split('.')[0]; // e.g. "emoji_smile"
    // The result of require.context(key) is the URL (as a string) after webpack processes it.
    emojiUrls[id] = emojiContext(key);
});

// Given an emoji id, return its bundled URL.
function getEmojiUrl(emojiId: string): string {
    return emojiUrls[emojiId];
}

// Build an array of EmojiData objects by loading each emoji image and computing its average RGB.
async function buildEmojiData(): Promise<EmojiData[]> {
    const emojiDataArray: EmojiData[] = [];
    for (const id in emojiUrls) {
        const url = emojiUrls[id];
        try {
            const img = await loadImage(url);
            const avg = await computeAverageRGB(img);
            emojiDataArray.push({
                image_id: id,
                average_rgb: avg,
            });
        } catch (err) {
            console.error(`Failed to process emoji ${id}:`, err);
        }
    }
    return emojiDataArray;
}

// Main function to wire up the UI and generate the mosaic.
async function run() {
    // Load the WASM module.
    const wasmModule = await loadWasmModule();
    const { EmojiManagerWasm } = wasmModule;

    // Build emoji metadata from images in the emojis folder.
    const emojiData = await buildEmojiData();
    console.log("Built emoji data:", emojiData);

    // Initialize the kd tree via the WASM interface.
    const emojiManager = new EmojiManagerWasm(emojiData);

    // Get DOM elements.
    const fileInput = document.getElementById("targetImageInput") as HTMLInputElement;
    const generateButton = document.getElementById("generateButton") as HTMLButtonElement;
    const uploadedImage = document.getElementById("uploadedImage") as HTMLImageElement;
    const outputCanvas = document.getElementById("outputCanvas") as HTMLCanvasElement;
    const outputCtx = outputCanvas.getContext("2d")!;

    // When a file is selected, display it in the preview area.
    fileInput.addEventListener("change", () => {
        if (fileInput.files && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target!.result as string;
                uploadedImage.src = dataUrl;
            };
            reader.readAsDataURL(file);
        }
    });

    // When "Generate" is clicked, process the target image and generate the mosaic.
    generateButton.addEventListener("click", () => {
        if (!fileInput.files || fileInput.files.length === 0) {
            alert("Please select a target image first.");
            return;
        }
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUrl = e.target!.result as string;
            const targetImg = await loadImage(dataUrl);

            // Resize the output canvas to match the target image.
            outputCanvas.width = targetImg.width * 5;
            outputCanvas.height = targetImg.height * 5;
            outputCtx.fillStyle = "#fff";
            outputCtx.fillRect(0, 0, targetImg.width, targetImg.height);

            // Sample pixel data from the target image.
            const pixels = getPixelData(targetImg, 10);

            // Generate placements via the WASM module.
            const layoutJsValue = emojiManager.generate_layout(pixels);
            const placements: EmojiPlacement[] = layoutJsValue as unknown as EmojiPlacement[];

            console.log("Generated placements:", placements);

            // For each placement, load and draw the corresponding emoji image.
            const emojiSize = 20;
            for (const placement of placements) {
                try {
                    const emojiUrl = getEmojiUrl(placement.image_id);
                    const emojiImg = await loadImage(emojiUrl);
                    outputCtx.drawImage(emojiImg, placement.x * 5, placement.y * 5, emojiSize, emojiSize);
                } catch (err) {
                    console.error(`Failed to load emoji ${placement.image_id}:`, err);
                }
            }
        };
        reader.readAsDataURL(file);
    });
}

run().catch(console.error);
