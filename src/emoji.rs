extern crate image;

use std::collections::HashMap;
use std::error::Error;
use std::path::Path;

pub struct EmojiManager<'a> {
    emoji_dir_path: &'a Path, 
    emoji_cache: HashMap<u32, image::DynamicImage>,
}

impl<'a> EmojiManager<'a> {
    pub fn new(emoji_dir_string: &'a str) -> Result<EmojiManager<'a>, Box<dyn Error>> {
       let emoji_dir_path = Path::new(emoji_dir_string);
       if !emoji_dir_path.exists() {
           let err_msg = format!("invalid path: {}", emoji_dir_string);
           return Err(err_msg.into())
       }

        Ok(EmojiManager {
            emoji_dir_path,
            emoji_cache: HashMap::new(),
        })
    }

    pub fn get_emoji(&mut self, emoji_id: u32) -> Option<&image::DynamicImage> {
        // consider using `entry` and `or_insert_with` here
        if !self.emoji_cache.contains_key(&emoji_id) {
            let emoji_path = format!("{}/{}.png", self.emoji_dir_path.display(), emoji_id);
            let loaded_emoji = image::open(emoji_path).expect(&format!("Couldn't read emoji with id: {}", emoji_id).to_string());
            self.emoji_cache.insert(emoji_id, loaded_emoji);
        }
        self.emoji_cache.get(&emoji_id)
    }
}