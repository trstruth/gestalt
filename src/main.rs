extern crate image;
extern crate rand;

use std::error::Error;
use rand::Rng;

mod canvas;
mod emoji;

const CANVAS_WIDTH: u32 = 1920;
const CANVAS_HEIGHT: u32 = 1080;
const NUM_ITERATIONS: u32 = 200000;
// const NUM_EMOJIS: u32 = 2363;

fn main() -> Result<(), Box<dyn Error>> {
    println!("Generating new EmojiManager");
    let mut em = emoji::EmojiManager::new("emojis")?;
    println!("Generating new CanvasManager");
    let mut cm = canvas::CanvasManager::new("canvas.png", CANVAS_WIDTH, CANVAS_HEIGHT)?;

    // let target = image::open("cyberpunk.png").unwrap();
    // let target = image::open("basquiat.jpg").unwrap();
    let target = image::open("bladerunner.png").unwrap();
    let target_rgba = target.to_rgba();

    println!("Placing emojis");

    /*
    for (x, y, p) in target.to_rgba().enumerate_pixels() {
        let nearest_emoji_id = em.get_nearest_emoji_id(*p);
        let emoji = em.get_emoji(nearest_emoji_id).unwrap();
        cm.place_emoji(emoji, x, y);
    }
    */

    let mut rng = rand::thread_rng();
    for  _ in 0..NUM_ITERATIONS {
        let rand_x = rng.gen_range(0, CANVAS_WIDTH);
        let rand_y = rng.gen_range(0, CANVAS_HEIGHT);
        let target_p = target_rgba.get_pixel(rand_x, rand_y);

        let nearest_emoji_id = em.get_nearest_emoji_id(*target_p);
        let emoji = em.get_emoji(nearest_emoji_id).unwrap();
        cm.place_emoji(emoji, rand_x, rand_y);
    }

    println!("Saving canvas");
    cm.save_canvas();

    Ok(())
}
