use clap::{App, Arg};
use image::gif::{GifDecoder, GifEncoder};
use image::{AnimationDecoder, ImageDecoder};
use rand::Rng;
use std::error::Error;
use std::fs::File;

mod canvas;
mod emoji;

/*
 * arg: path to image
 * -n --num-iterations (20000): number of times to place an emoji
 * -o --output (canvas.png): output file path
 * -s --scale (1): resolution ratio of output:target images
*/

fn main() -> Result<(), Box<dyn Error>> {
    let options = parse_args()?;

    if options.target_path.ends_with(".gif") {
        return handle_gif(&options.target_path, &options);
    } else if options.target_path.ends_with("png") || options.target_path.ends_with("jpg") {
        let target = image::open(&options.target_path).unwrap();
        let mut target_rgba = target.to_rgba8();
        let output_image = handle_image(&mut target_rgba, None, &options)?;

        println!("Saving output to file: {}", options.output);
        output_image.save(options.output)?;
        Ok(())
    } else {
        return Err("unknown image type, must be one of jpg, png, gif".into());
    }
}

fn handle_image(
    target_rgba: &mut image::RgbaImage,
    emoji_manager: Option<emoji::EmojiManager>,
    options: &Opts,
) -> Result<image::RgbaImage, Box<dyn Error>> {
    let (width, height) = target_rgba.dimensions();
    println!("Opened image {} {}x{}", options.target_path, width, height);

    println!("Generating new EmojiManager");
    let mut em = match emoji_manager {
        Some(em) => em,
        None => emoji::EmojiManager::new("emojis")?,
    };

    let canvas_width = width * options.scale;
    let canvas_height = height * options.scale;
    println!(
        "Generating new CanvasManager with dimensions {}x{}",
        canvas_width, canvas_height
    );
    let mut cm = canvas::CanvasManager::new(&options.output, canvas_width, canvas_height)?;

    println!("Placing emojis: {} iterations", options.num_iterations);

    let mut rng = rand::thread_rng();
    for _ in 0..options.num_iterations {
        let rand_x = rng.gen_range(0, width);
        let rand_y = rng.gen_range(0, height);
        let target_p = target_rgba.get_pixel(rand_x, rand_y);

        let nearest_emoji_id = em.get_nearest_emoji_id(*target_p);
        let emoji = em.get_emoji(nearest_emoji_id).unwrap();
        cm.place_emoji(emoji, rand_x * options.scale, rand_y * options.scale);
    }

    Ok(cm.canvas)
}

fn handle_gif(target_path: &str, options: &Opts) -> Result<(), Box<dyn Error>> {
    let file_in = File::open(target_path)?;
    let decoder = GifDecoder::new(file_in)?;
    let mut output_frames: Vec<image::Frame> = Vec::new();
    for frame in decoder.into_frames() {
        output_frames.push(image::Frame::new(handle_image(
            frame?.buffer_mut(),
            Some(emoji::EmojiManager::new("emojis")?),
            options,
        )?));
    }

    let file_out = File::open(&options.output)?;
    let mut encoder = GifEncoder::new(file_out);
    encoder.encode_frames(output_frames.into_iter())?;

    Ok(())
}

struct Opts {
    target_path: String,
    num_iterations: u32,
    output: String,
    scale: u32,
}

fn parse_args() -> Result<Opts, Box<dyn Error>> {
    let app = App::new("emvision")
        .author("trstruth")
        .version("0.1.0")
        .about("Generates an emoji vision image")
        .arg(Arg::with_name("target_path").required(true).index(1))
        .arg(
            Arg::with_name("num_iterations")
                .short("n")
                .long("num-iterations")
                .takes_value(true),
        )
        .arg(
            Arg::with_name("output")
                .short("o")
                .long("output")
                .takes_value(true),
        )
        .arg(
            Arg::with_name("scale")
                .short("s")
                .long("scale")
                .takes_value(true),
        );

    let m = app.get_matches();

    let num_iterations = match m.value_of("num_iterations") {
        Some(num_str) => num_str.parse::<u32>()?,
        None => 500000,
    };
    let output = match m.value_of("output") {
        Some(output) => output.to_string(),
        None => "canvas.png".to_string(),
    };
    let scale = match m.value_of("scale") {
        Some(scale_str) => scale_str.parse::<u32>()?,
        None => 1,
    };

    let target_path = match m.value_of("target_path") {
        Some(target_path) => target_path.to_string(),
        None => return Err("Please provide a path to the target image".into()),
    };

    Ok(Opts {
        target_path,
        num_iterations,
        output,
        scale,
    })
}
