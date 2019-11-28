extern crate image;

use std::collections::HashMap;
use std::error::Error;
use std::path::Path;
use kdtree::KdTree;

const NUM_RGB_CHANNELS: usize = 3;
const NUM_EMOJIS: u32 = 2263;

pub struct EmojiManager<'a> {
    emoji_dir_path: &'a Path, 
    emoji_cache: HashMap<u32, image::DynamicImage>,
    emoji_kd_tree: KdTree<f64, u32, [f64; NUM_RGB_CHANNELS]>,
}

impl<'a> EmojiManager<'a> {
    pub fn new(emoji_dir_string: &'a str) -> Result<EmojiManager<'a>, Box<dyn Error>> {
        let emoji_dir_path = Path::new(emoji_dir_string);
        if !emoji_dir_path.exists() {
            let err_msg = format!("invalid path: {}", emoji_dir_string);
            return Err(err_msg.into())
        }

        let mut emoji_kd_tree = KdTree::new(NUM_RGB_CHANNELS);
        for emoji_id in 0..NUM_EMOJIS {
            let emoji_path = format!("{}/{}.png", emoji_dir_path.display(), emoji_id);
            let loaded_emoji = image::open(emoji_path).expect(&format!("Couldn't read emoji with id: {}", emoji_id).to_string());
            let average_rgb = get_average_rgb(&loaded_emoji);
            emoji_kd_tree.add(average_rgb, emoji_id as u32).unwrap();
        }

        Ok(EmojiManager {
            emoji_dir_path,
            emoji_cache: HashMap::new(),
            emoji_kd_tree,
        })
    }

    pub fn get_emoji(&mut self, emoji_id: u32) -> Option<&image::DynamicImage> {
        // consider using `entry` and `or_insert_with` here
        if !self.emoji_cache.contains_key(&emoji_id) {
            let emoji_path = format!("{}/{}.png", self.emoji_dir_path.display(), emoji_id);
            let loaded_emoji = image::open(emoji_path).expect(&format!("Couldn't read emoji with id: {}", emoji_id).to_string());
            self.emoji_cache.insert(emoji_id, loaded_emoji.resize(15, 15, image::FilterType::Lanczos3));
        }
        self.emoji_cache.get(&emoji_id)
    }

    pub fn get_nearest_emoji_id(&mut self, pixel: image::Rgba<u8>) -> u32 {
        let pixel_rgb = [pixel[0] as f64, pixel[1] as f64, pixel[2] as f64];
        let (_, nearest_emoji_id) = self.emoji_kd_tree.nearest(&pixel_rgb, 1, &kdtree::distance::squared_euclidean).unwrap()[0];
        *nearest_emoji_id
    }
}

fn get_average_rgb(img: &image::DynamicImage) -> [f64; NUM_RGB_CHANNELS] {
    let mut average_r: f64 = 0.0;
    let mut average_g: f64 = 0.0;
    let mut average_b: f64 = 0.0;

    let mut opaque_pixel_count: f64 = 0.0;

    for (_, _, p) in img.to_rgba().enumerate_pixels() {
        if p[3] == 0 {
            continue;
        }

        average_r += p[0] as f64;
        average_g += p[1] as f64;
        average_b += p[2] as f64;

        opaque_pixel_count += 1.0;
    }

    average_r /= opaque_pixel_count;
    average_g /= opaque_pixel_count;
    average_b /= opaque_pixel_count;

    [average_r as f64, average_g as f64, average_b as f64]
}