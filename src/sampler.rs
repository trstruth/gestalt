use std::{convert::TryFrom, error::Error};

use rand::{rngs::ThreadRng, Rng};

pub enum SamplerMode {
    Source,
    Destination,
}

impl TryFrom<&str> for SamplerMode {
    type Error = Box<dyn Error>;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "source" => Ok(SamplerMode::Source),
            "destination" => Ok(SamplerMode::Destination),
            _ => Err(format!("{} is not a recognized sampler mode", value).into()),
        }
    }
}

pub struct Sampler {
    mode: SamplerMode,
    src_dim: (u32, u32),
    canvas_dim: (u32, u32),
    scale: u32,
    rng: ThreadRng,
}

impl Sampler {
    pub fn new(
        mode: SamplerMode,
        src_dim: (u32, u32),
        canvas_dim: (u32, u32),
        scale: u32,
    ) -> Result<Self, Box<dyn Error>> {
        Ok(Sampler {
            mode,
            src_dim,
            canvas_dim,
            scale,
            rng: rand::thread_rng(),
        })
    }

    pub fn sample(&mut self) -> ((u32, u32), (u32, u32)) {
        match self.mode {
            SamplerMode::Source => {
                let rand_x = self.rng.gen_range(0, self.src_dim.0);
                let rand_y = self.rng.gen_range(0, self.src_dim.1);
                ((rand_x, rand_y), (rand_x * self.scale, rand_y * self.scale))
            }
            SamplerMode::Destination => {
                let rand_x = self.rng.gen_range(0, self.canvas_dim.0);
                let rand_y = self.rng.gen_range(0, self.canvas_dim.1);
                ((rand_x / self.scale, rand_y / self.scale), (rand_x, rand_y))
            }
        }
    }
}
