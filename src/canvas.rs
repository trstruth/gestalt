extern crate image;

use std::error::Error;
use std::path::Path;
use std::fs::File;
use crate::image::GenericImageView;
use crate::image::Pixel;

pub struct CanvasManager<'a> {
    canvas_path: &'a Path, 
    canvas: image::RgbaImage,
}

impl<'a> CanvasManager<'a> {
    pub fn new(canvas_path_string: &'a str, width: u32, height: u32) -> Result<CanvasManager<'a>, Box<dyn Error>> {
        let canvas_path = Path::new(canvas_path_string);
        if !canvas_path.exists() {
            File::create(canvas_path).unwrap();
        }

        let mut canvas = image::RgbaImage::new(width, height);
        for (_, _, p) in canvas.enumerate_pixels_mut() {
            *p = image::Rgba([255, 255, 255, 255])
        }

        canvas.save(canvas_path).unwrap();

        Ok(CanvasManager {
            canvas_path,
            canvas,
        })
    }   

    pub fn place_emoji(&mut self, emoji: &image::DynamicImage, x: u32, y: u32) -> bool {
        if self.canvas.width() < emoji.width() + x || self.canvas.height() < emoji.height() + y {
            return false;
        }

        for i in 0..emoji.width() {
            for k in 0..emoji.height() {
                let p = self.canvas.get_pixel_mut(i+x, k+y);
                let emoji_p = emoji.get_pixel(i, k);
                p.blend(&emoji_p);
            }
        }
        true
    }

    pub fn save_canvas(&self) {
        
        self.canvas.save(self.canvas_path).expect("couldn't save canvas")
    }
}