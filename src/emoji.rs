use kdtree::KdTree;
use std::collections::HashMap;
use std::error::Error;
use std::fs;
use std::path::Path;

const NUM_RGB_CHANNELS: usize = 3;

pub struct EmojiManager {
    emoji_cache: HashMap<String, image::DynamicImage>,
    emoji_kd_tree: KdTree<f64, String, [f64; NUM_RGB_CHANNELS]>,
}

impl EmojiManager {
    pub fn new(emoji_dir_string: &str) -> Result<EmojiManager, Box<dyn Error>> {
        let emoji_dir_path = Path::new(emoji_dir_string);
        if !emoji_dir_path.exists() {
            let err_msg = format!("invalid path: {}", emoji_dir_string);
            return Err(err_msg.into());
        }

        let mut emoji_kd_tree = KdTree::new(NUM_RGB_CHANNELS);

        let mut emoji_id = 0;
        for entry in fs::read_dir(emoji_dir_path)? {
            let emoji_path = entry?.path();
            let emoji_path_str = emoji_path.to_str().unwrap().to_string();

            let loaded_emoji = match image::open(emoji_path) {
                Ok(image) => image,
                Err(_) => {
                    println!("Couldn't read emoji with id: {}", emoji_id);
                    continue;
                }
            };

            match get_average_rgb(&loaded_emoji) {
                Some(average_rgb) => emoji_kd_tree.add(average_rgb, emoji_path_str).unwrap(),
                None => println!(
                    "warning: image {emoji_path_str} had no visible pixels and will be ignored"
                ),
            }

            emoji_id += 1;
        }

        Ok(EmojiManager {
            emoji_cache: HashMap::new(),
            emoji_kd_tree,
        })
    }

    pub fn get_nearest_emoji(
        &mut self,
        pixel: image::Rgba<u8>,
        image_size: u32,
    ) -> Option<&image::DynamicImage> {
        // if the source pixel is fully transparent, return None
        if pixel[3] == 0 {
            return None;
        }

        // get nearest emoji path
        let pixel_rgb = [pixel[0] as f64, pixel[1] as f64, pixel[2] as f64];
        let (_, nearest_emoji_path) = self
            .emoji_kd_tree
            .nearest(&pixel_rgb, 1, &kdtree::distance::squared_euclidean)
            .unwrap()[0];

        // get emoji
        if !self.emoji_cache.contains_key(nearest_emoji_path) {
            let loaded_emoji = image::open(nearest_emoji_path).unwrap_or_else(|_| {
                panic!(
                    "{}",
                    format!("Couldn't read emoji with path: {}", nearest_emoji_path).to_string()
                )
            });

            let (width, height) = loaded_emoji.to_rgba().dimensions();
            let width_scale: f32 = width as f32 / image_size as f32;
            let height_scale: f32 = height as f32 / image_size as f32;

            let new_width: u32;
            let new_height: u32;

            if width_scale > height_scale {
                new_width = image_size;
                new_height = height * image_size / width;
            } else {
                new_width = width * image_size / height;
                new_height = image_size;
            }

            self.emoji_cache.insert(
                nearest_emoji_path.to_string(),
                loaded_emoji.resize(new_width, new_height, image::FilterType::Lanczos3),
            );
        }
        self.emoji_cache.get(nearest_emoji_path)
    }
}

fn get_average_rgb(img: &image::DynamicImage) -> Option<[f64; NUM_RGB_CHANNELS]> {
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

    if opaque_pixel_count == 0.0 {
        return None;
    }

    average_r /= opaque_pixel_count;
    average_g /= opaque_pixel_count;
    average_b /= opaque_pixel_count;

    Some([average_r, average_g, average_b])
}
