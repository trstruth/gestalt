use image::imageops;
use std::error::Error;
use std::fs::File;
use std::path::Path;

pub struct CanvasManager<'a> {
    canvas_path: &'a Path,
    canvas: image::RgbaImage,
}

impl<'a> CanvasManager<'a> {
    pub fn new(
        canvas_path_string: &'a str,
        width: u32,
        height: u32,
        background_color: u32,
    ) -> Result<CanvasManager<'a>, Box<dyn Error>> {
        let canvas_path = Path::new(canvas_path_string);
        if !canvas_path.exists() {
            File::create(canvas_path).unwrap();
        }

        let mut canvas = image::RgbaImage::new(width, height);
        for (_, _, p) in canvas.enumerate_pixels_mut() {
            *p = image::Rgba([
                (background_color >> 24) as u8,
                (background_color >> 16) as u8,
                (background_color >> 8) as u8,
                background_color as u8,
            ]);
        }

        canvas.save(canvas_path).unwrap();

        Ok(CanvasManager {
            canvas_path,
            canvas,
        })
    }

    pub fn place_emoji(&mut self, emoji: &image::DynamicImage, x: u32, y: u32) {
        imageops::overlay(&mut self.canvas, emoji, x, y);
    }

    pub fn save_canvas(&self) {
        self.canvas
            .save(self.canvas_path)
            .expect("couldn't save canvas")
    }
}
