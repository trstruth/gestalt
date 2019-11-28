extern crate image;

use std::error::Error;
use rand::Rng;

mod canvas;
mod emoji;

const CANVAS_WIDTH: u32 = 1920;
const CANVAS_HEIGHT: u32 = 1080;
const NUM_EMOJIS: u32 = 2363;

fn main() -> Result<(), Box<dyn Error>> {
    println!("Generating new EmojiManager");
    let mut em = emoji::EmojiManager::new("emojis")?;
    println!("Generating new CanvasManager");
    let mut cm = canvas::CanvasManager::new("canvas.png", CANVAS_WIDTH, CANVAS_HEIGHT)?;

    println!("Placing emojis");

    let mut rng = rand::thread_rng();
    for i in 0..100 {
        println!("Emoji #{}", i);

        let emoji_num = rng.gen_range(0, NUM_EMOJIS);
        let emoji = em.get_emoji(emoji_num).unwrap();

        let rand_x = rng.gen_range(0, CANVAS_WIDTH);
        let rand_y = rng.gen_range(0, CANVAS_HEIGHT);
        cm.place_emoji(emoji, rand_x, rand_y);
    }

    cm.save_canvas();

    Ok(())
}
