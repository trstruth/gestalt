extern crate image;
extern crate rand;

use rand::Rng;
use std::env;
use std::error::Error;

mod canvas;
mod emoji;

/*
 * arg: path to image
 * -n --num-iterations (20000): number of times to place an emoji
 * -o --output (canvas.png): output file path
 * -s --scale (1): resolution ratio of output:target images
*/

fn main() -> Result<(), Box<dyn Error>> {
    let num_iterations = 500000;
    let output = "canvas.png";
    let scale = 3;

    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        panic!("Please provide a path to the target image");
    }
    let target_path = &args[1];
    let target = image::open(target_path).unwrap();
    let target_rgba = target.to_rgba();
    let (width, height) = target_rgba.dimensions();

    println!("Generating new EmojiManager");
    let mut em = emoji::EmojiManager::new("emojis")?;
    println!("Generating new CanvasManager");
    let mut cm = canvas::CanvasManager::new(output, width * scale, height * scale)?;

    // let target = image::open("cyberpunk.png").unwrap();
    // let target = image::open("basquiat.jpg").unwrap();
    // let target = image::open("bladerunner.png").unwrap();

    println!("Placing emojis");

    let mut rng = rand::thread_rng();
    for _ in 0..num_iterations {
        let rand_x = rng.gen_range(0, width);
        let rand_y = rng.gen_range(0, height);
        let target_p = target_rgba.get_pixel(rand_x, rand_y);

        let nearest_emoji_id = em.get_nearest_emoji_id(*target_p);
        let emoji = em.get_emoji(nearest_emoji_id).unwrap();
        cm.place_emoji(emoji, rand_x * scale, rand_y * scale);
    }

    println!("Saving canvas");
    cm.save_canvas();

    Ok(())
}
