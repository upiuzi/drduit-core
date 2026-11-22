use clap::{Parser, Subcommand};
use drduit_rust::budget::{BudgetContext, Envelope};
use drduit_rust::monetary::{Account, AccountType};
use drduit_rust::montecarlo::{simulate_retirement, LifeInputs, Stream, FAN_PATHS};
use rust_decimal_macros::dec;
use std::time::Instant;

#[derive(Parser)]
#[command(name = "drduit-rust")]
#[command(about = "Dr Duit Core high-performance engine in Rust", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Run a Monte Carlo retirement simulation (5,000 paths)
    Montecarlo {
        #[arg(short, long, default_value_t = 100_000.0)]
        start_balance: f64,
        #[arg(short, long, default_value_t = 30.0)]
        current_age: f64,
        #[arg(short, long, default_value_t = 55.0)]
        retire_age: f64,
        #[arg(short, long, default_value_t = 85.0)]
        life_expectancy: f64,
        #[arg(long, default_value_t = 5.0)]
        return_pct: f64,
        #[arg(long, default_value_t = 12.0)]
        volatility_pct: f64,
        #[arg(long, default_value_t = 2_000.0)]
        saving: f64,
        #[arg(long, default_value_t = 4_000.0)]
        spend: f64,
        #[arg(short, long, default_value_t = FAN_PATHS)]
        paths: usize,
    },
    /// Benchmark Monte Carlo engine throughput
    Benchmark {
        #[arg(short, long, default_value_t = 50_000)]
        total_paths: usize,
    },
    /// Verify Ready To Assign envelope budget identity
    BudgetCheck,
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Montecarlo {
            start_balance,
            current_age,
            retire_age,
            life_expectancy,
            return_pct,
            volatility_pct,
            saving,
            spend,
            paths,
        } => {
            let inputs = LifeInputs {
                start_balance,
                current_age,
                retire_age,
                life_expectancy,
                real_return_pct: return_pct,
                volatility_pct,
                monthly_saving: saving,
                monthly_spend: spend,
                streams: vec![Stream {
                    amount: 1500.0,
                    age: 65.0,
                    end_age: None,
                }],
                events: vec![],
                crash_fraction: 0.20,
                crash_age: Some(55.0),
                weak: None,
                lost: None,
                inflation_shock: None,
            };

            println!("Running Dr Duit Monte Carlo simulation ({} paths)...", paths);
            let res = simulate_retirement(&inputs, paths);

            println!("==================================================");
            println!("Success Rate          : {:.2}%", res.success_rate * 100.0);
            println!("Median Ending Wealth  : ${:.2}", res.median_ending_wealth);
            println!("Time Taken            : {:.3} ms ({:.0} paths/sec)", res.duration_ms, (paths as f64) / (res.duration_ms / 1000.0));
            println!("==================================================");

            if let Some(final_band) = res.bands.last() {
                println!("Final Year Distribution (Age {:.0}):", final_band.age);
                println!("  p10 (Worst 10%)     : ${:.2}", final_band.p10);
                println!("  p25 (Conservative)  : ${:.2}", final_band.p25);
                println!("  p50 (Median)        : ${:.2}", final_band.p50);
                println!("  p75 (Optimistic)    : ${:.2}", final_band.p75);
                println!("  p90 (Best 10%)      : ${:.2}", final_band.p90);
            }
        }
        Commands::Benchmark { total_paths } => {
            println!("Benchmarking Dr Duit Rust engine with {} paths...", total_paths);
            let inputs = LifeInputs {
                start_balance: 100_000.0,
                current_age: 30.0,
                retire_age: 55.0,
                life_expectancy: 85.0,
                real_return_pct: 5.0,
                volatility_pct: 12.0,
                monthly_saving: 2_000.0,
                monthly_spend: 4_000.0,
                streams: vec![],
                events: vec![],
                crash_fraction: 0.15,
                crash_age: Some(55.0),
                weak: None,
                lost: None,
                inflation_shock: None,
            };

            let t0 = Instant::now();
            let res = simulate_retirement(&inputs, total_paths);
            let elapsed = t0.elapsed();

            println!("Simulated {} paths across 55 years (660 monthly steps each)", total_paths);
            println!("Total monthly iterations: {}", (total_paths as u64) * 660);
            println!("Total time: {:?}", elapsed);
            println!("Throughput: {:.0} paths/sec", (total_paths as f64) / elapsed.as_secs_f64());
            println!("Success rate: {:.2}%", res.success_rate * 100.0);
        }
        Commands::BudgetCheck => {
            println!("Verifying YNAB Ready To Assign (RTA) mathematical identity...");
            let accounts = vec![
                Account::new("acc_1", "Checking", AccountType::Cash, "USD", dec!(5000)),
                Account::new("acc_2", "Savings", AccountType::Cash, "USD", dec!(10000)),
                Account::new("acc_3", "Credit Card", AccountType::Credit, "USD", dec!(500)), // Card in credit
            ];

            let cash_as_of = drduit_rust::monetary::cash_on_hand(&accounts);
            let card_credit = drduit_rust::monetary::total_card_credit(&accounts);

            let envelopes = vec![
                Envelope::new("cat_rent", "Rent", dec!(0), dec!(2000), dec!(-2000)),
                Envelope::new("cat_food", "Groceries", dec!(200), dec!(800), dec!(-500)),
                Envelope::new("cat_fun", "Entertainment", dec!(100), dec!(400), dec!(-200)),
            ];

            let ctx = BudgetContext {
                cash_as_of,
                card_credit,
                baseline: dec!(1000), // Minimum cash reserve
                envelopes,
                held_outside_envelopes: dec!(50),
                card_spend_not_covered: dec!(0),
            };

            let rta = ctx.ready_to_assign();
            let valid = ctx.verify_rta_identity();

            println!("Cash As Of              : ${}", ctx.cash_as_of);
            println!("Card Credit             : ${}", ctx.card_credit);
            println!("Baseline                : ${}", ctx.baseline);
            println!("Held in Envelopes       : ${}", ctx.held_in_envelopes());
            println!("Held Outside Envelopes  : ${}", ctx.held_outside_envelopes);
            println!("Ready To Assign (RTA)   : ${}", rta);
            println!("Identity Verified       : {}", if valid { "PASSED [OK]" } else { "FAILED" });
            assert!(valid, "RTA identity verification failed!");
        }
    }
}
