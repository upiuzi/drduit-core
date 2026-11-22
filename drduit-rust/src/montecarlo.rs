//! Monte Carlo Retirement Simulation Engine for Dr Duit
//! Faithful, high-performance Rust port of `backend/services/montecarlo.py`

use rand::prelude::*;
use rand_distr::StandardNormal;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::time::Instant;

pub const MONTHS_PER_YEAR: usize = 12;
pub const MAX_HORIZON_YEARS: usize = 100;
pub const FAN_PATHS: usize = 5000;
pub const QUICK_PATHS: usize = 1400;
pub const SCAN_PATHS: usize = 1000;
pub const FAN_SEED: u64 = 777;

pub const WEAK_REAL_RETURN_PCT: f64 = -1.5;
pub const INFLATION_SHOCK_PCT: f64 = 3.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stream {
    pub amount: f64,
    pub age: f64,
    pub end_age: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub age: f64,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Window {
    pub start: f64,
    pub end: Option<f64>,
}

impl Window {
    pub fn contains(&self, age: f64) -> bool {
        if age < self.start {
            return false;
        }
        match self.end {
            Some(end) => age < end,
            None => true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LifeInputs {
    pub start_balance: f64,
    pub current_age: f64,
    pub retire_age: f64,
    pub life_expectancy: f64,
    pub real_return_pct: f64,
    pub volatility_pct: f64,
    pub monthly_saving: f64,
    pub monthly_spend: f64,
    pub streams: Vec<Stream>,
    pub events: Vec<Event>,
    pub crash_fraction: f64,
    pub crash_age: Option<f64>,
    pub weak: Option<Window>,
    pub lost: Option<Window>,
    pub inflation_shock: Option<Window>,
}

#[derive(Debug, Clone)]
pub struct Schedule {
    pub months: usize,
    pub drift: Vec<f64>,
    pub guaranteed: Vec<f64>,
    pub lump: Vec<f64>,
    pub crash_month: Option<usize>,
}

fn round_half_up(x: f64) -> i64 {
    (x + 0.5).floor() as i64
}

pub fn horizon_years(inp: &LifeInputs) -> usize {
    let raw = round_half_up(inp.life_expectancy - inp.current_age);
    (raw.max(1) as usize).min(MAX_HORIZON_YEARS)
}

pub fn build_schedule(inp: &LifeInputs, years: usize) -> Schedule {
    let months = years * MONTHS_PER_YEAR;
    let mut drift = Vec::with_capacity(months);
    let mut guaranteed = vec![0.0; months];
    let mut lump = vec![0.0; months];

    let normal_drift = inp.real_return_pct / 100.0 / (MONTHS_PER_YEAR as f64);
    let weak_drift = WEAK_REAL_RETURN_PCT / 100.0 / (MONTHS_PER_YEAR as f64);
    let inflation_sub = INFLATION_SHOCK_PCT / 100.0 / (MONTHS_PER_YEAR as f64);

    for m in 1..=months {
        let age = inp.current_age + (m as f64) / (MONTHS_PER_YEAR as f64);
        let mut d = if inp.weak.as_ref().map_or(false, |w| w.contains(age))
            || inp.lost.as_ref().map_or(false, |w| w.contains(age))
        {
            weak_drift
        } else {
            normal_drift
        };

        if inp.inflation_shock.as_ref().map_or(false, |w| w.contains(age)) {
            d -= inflation_sub;
        }
        drift.push(d);

        // Guaranteed streams
        for s in &inp.streams {
            if age >= s.age && s.end_age.map_or(true, |end| age < end) {
                guaranteed[m - 1] += s.amount;
            }
        }
    }

    // One-off events
    for e in &inp.events {
        let em = round_half_up((e.age - inp.current_age) * (MONTHS_PER_YEAR as f64));
        if em >= 1 && (em as usize) <= months {
            lump[(em as usize) - 1] += e.amount;
        }
    }

    let crash_month = if inp.crash_fraction > 0.0 {
        let at = inp.crash_age.unwrap_or(inp.retire_age);
        let cm = round_half_up((at - inp.current_age) * (MONTHS_PER_YEAR as f64));
        if cm >= 1 && (cm as usize) <= months {
            Some(cm as usize)
        } else {
            None
        }
    } else {
        None
    };

    Schedule {
        months,
        drift,
        guaranteed,
        lump,
        crash_month,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BandYear {
    pub year: usize,
    pub age: f64,
    pub p10: f64,
    pub p25: f64,
    pub p50: f64,
    pub p75: f64,
    pub p90: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationResult {
    pub success_rate: f64,
    pub median_ending_wealth: f64,
    pub bands: Vec<BandYear>,
    pub paths_simulated: usize,
    pub duration_ms: f64,
}

fn percentile(sorted: &[f64], pct: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let rank = (pct / 100.0) * ((sorted.len() - 1) as f64);
    let lower = rank.floor() as usize;
    let upper = rank.ceil() as usize;
    if lower == upper {
        sorted[lower]
    } else {
        let weight = rank - (lower as f64);
        sorted[lower] * (1.0 - weight) + sorted[upper] * weight
    }
}

/// Run Monte Carlo simulation over `n_paths` using multi-threaded Rayon execution
pub fn simulate_retirement(inp: &LifeInputs, n_paths: usize) -> SimulationResult {
    let t0 = Instant::now();
    let years = horizon_years(inp);
    let sched = build_schedule(inp, years);
    let months = sched.months;
    let sigma = inp.volatility_pct / 100.0 / (MONTHS_PER_YEAR as f64).sqrt();
    let retire_month = ((inp.retire_age - inp.current_age) * (MONTHS_PER_YEAR as f64)).max(0.0) as usize;

    // Simulate all paths in parallel
    let path_results: Vec<(bool, Vec<f64>)> = (0..n_paths)
        .into_par_iter()
        .map(|path_idx| {
            // Seed per path deterministically
            let mut rng = StdRng::seed_from_u64(FAN_SEED.wrapping_add(path_idx as u64));
            let mut pot = inp.start_balance;
            let mut ruined = false;
            let mut yearly_pots = Vec::with_capacity(years + 1);
            yearly_pots.push(pot);

            for m in 1..=months {
                let z: f64 = rng.sample(StandardNormal);
                // Return growth
                pot *= 1.0 + sched.drift[m - 1] + sigma * z;

                // Market crash
                if Some(m) == sched.crash_month {
                    pot *= 1.0 - inp.crash_fraction;
                }

                // Saving or Drawing
                if m <= retire_month {
                    pot += inp.monthly_saving;
                } else {
                    let draw = (inp.monthly_spend - sched.guaranteed[m - 1]).max(0.0);
                    pot -= draw;
                }

                // Lump sum event
                if sched.lump[m - 1] != 0.0 {
                    pot += sched.lump[m - 1];
                }

                if pot < 0.0 {
                    ruined = true;
                    pot = 0.0;
                }

                if m % MONTHS_PER_YEAR == 0 {
                    yearly_pots.push(pot);
                }
            }

            let survived = !ruined && pot > 0.0;
            (survived, yearly_pots)
        })
        .collect();

    let survived_count = path_results.iter().filter(|(s, _)| *s).count();
    let success_rate = (survived_count as f64) / (n_paths as f64);

    // Compute percentile bands for each year
    let mut bands = Vec::with_capacity(years + 1);
    for y in 0..=years {
        let age = inp.current_age + (y as f64);
        let mut values_at_year: Vec<f64> = path_results.iter().map(|(_, pots)| pots[y]).collect();
        values_at_year.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        bands.push(BandYear {
            year: y,
            age,
            p10: (percentile(&values_at_year, 10.0) * 100.0).round() / 100.0,
            p25: (percentile(&values_at_year, 25.0) * 100.0).round() / 100.0,
            p50: (percentile(&values_at_year, 50.0) * 100.0).round() / 100.0,
            p75: (percentile(&values_at_year, 75.0) * 100.0).round() / 100.0,
            p90: (percentile(&values_at_year, 90.0) * 100.0).round() / 100.0,
        });
    }

    let median_ending_wealth = bands.last().map(|b| b.p50).unwrap_or(0.0);
    let duration_ms = t0.elapsed().as_secs_f64() * 1000.0;

    SimulationResult {
        success_rate,
        median_ending_wealth,
        bands,
        paths_simulated: n_paths,
        duration_ms,
    }
}
