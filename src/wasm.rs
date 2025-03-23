use kdtree::distance::squared_euclidean;
use kdtree::KdTree;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*; // bring in the new functions

const NUM_RGB_CHANNELS: usize = 3;

/// Structure representing an emoji’s metadata.
#[derive(Serialize, Deserialize)]
pub struct EmojiData {
    pub image_id: String,
    pub average_rgb: [f64; NUM_RGB_CHANNELS],
}

/// Structure representing a target pixel.
#[derive(Serialize, Deserialize)]
pub struct PixelData {
    pub x: u32,
    pub y: u32,
    pub rgb: [f64; NUM_RGB_CHANNELS],
}

/// The result returned for each pixel: which emoji should be placed at which coordinate.
#[derive(Serialize, Deserialize)]
pub struct EmojiPlacement {
    pub image_id: String,
    pub x: u32,
    pub y: u32,
}

#[wasm_bindgen]
pub struct EmojiManagerWasm {
    kd_tree: KdTree<f64, String, [f64; NUM_RGB_CHANNELS]>,
}

#[wasm_bindgen]
impl EmojiManagerWasm {
    /// Constructs the EmojiManagerWasm using a JSON-serializable list of EmojiData.
    #[wasm_bindgen(constructor)]
    pub fn new(emoji_data_js: &JsValue) -> Result<EmojiManagerWasm, JsValue> {
        // Use serde_wasm_bindgen to convert the JsValue into a Vec<EmojiData>
        let emoji_data: Vec<EmojiData> = serde_wasm_bindgen::from_value(emoji_data_js.clone())
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let mut kd_tree = KdTree::new(NUM_RGB_CHANNELS);
        for emoji in emoji_data {
            kd_tree
                .add(emoji.average_rgb, emoji.image_id)
                .map_err(|e| JsValue::from_str(&format!("Error adding to kd-tree: {:?}", e)))?;
        }
        Ok(EmojiManagerWasm { kd_tree })
    }

    /// Given a list of target pixels (with coordinates and RGB values), returns a JSON array of emoji placements.
    #[wasm_bindgen]
    pub fn generate_layout(&self, pixels_js: &JsValue) -> Result<JsValue, JsValue> {
        // Convert JsValue to Vec<PixelData>
        let pixels: Vec<PixelData> = serde_wasm_bindgen::from_value(pixels_js.clone())
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let mut placements = Vec::new();
        for pixel in pixels {
            let query_rgb = pixel.rgb;
            let result = self
                .kd_tree
                .nearest(&query_rgb, 1, &squared_euclidean)
                .map_err(|e| JsValue::from_str(&format!("KD-tree query error: {:?}", e)))?;

            if let Some((_, emoji_id)) = result.first() {
                placements.push(EmojiPlacement {
                    image_id: emoji_id.to_string(),
                    x: pixel.x,
                    y: pixel.y,
                });
            }
        }
        // Use serde_wasm_bindgen to convert placements back to a JsValue.
        serde_wasm_bindgen::to_value(&placements).map_err(|e| JsValue::from_str(&e.to_string()))
    }
}
