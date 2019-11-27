extern crate image;

use std::error::Error;

use image::ImageBuffer;


const NUM_EMOJIS: usize = 2363;
const EMOJI_WIDTH: u32 = 160;
const EMOJI_HEIGHT: u32 = 160;

fn main() -> Result<(), Box<dyn Error>> {
    let img = image::open("emojis/0.png")?;
    println!("{:?}", img.color());

    let em = EmojiManager::new("emojis");

    Ok(())
}

struct EmojiManager<'a> {
    emojiPath: &'a str, 
    emojiArr: [&'a image::RgbaImage; NUM_EMOJIS]
}

impl<'a> EmojiManager<'a> {
    fn new(emojiPath: &'a str) -> EmojiManager<'a> {

        let uEmojiArr: [&'a image::RgbaImage; NUM_EMOJIS];
        for i in 0..NUM_EMOJIS {
            uEmojiArr[i] = &ImageBuffer::new(EMOJI_WIDTH, EMOJI_HEIGHT);
        }

        EmojiManager {
            emojiPath,
            emojiArr: uEmojiArr,
        }
    }
}