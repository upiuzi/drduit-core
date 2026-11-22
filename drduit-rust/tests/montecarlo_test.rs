use drduit_rust::montecarlo::{simulate_retirement, LifeInputs, Stream, FAN_PATHS};

#[test]
fn test_retirement_simulation_realistic_outputs() {
    let inputs = LifeInputs {
        start_balance: 50_000.0,
        current_age: 30.0,
        retire_age: 60.0,
        life_expectancy: 85.0,
        real_return_pct: 6.0,
        volatility_pct: 12.0,
        monthly_saving: 1_500.0,
        monthly_spend: 3_500.0,
        streams: vec![Stream {
            amount: 1_200.0,
            age: 65.0,
            end_age: None,
        }],
        events: vec![],
        crash_fraction: 0.15,
        crash_age: Some(60.0),
        weak: None,
        lost: None,
        inflation_shock: None,
    };

    let result = simulate_retirement(&inputs, FAN_PATHS);

    // 1. Assert realistic success rate (> 70% with this savings rate and pension)
    assert!(
        result.success_rate > 0.70 && result.success_rate <= 1.0,
        "Success rate out of expected bounds: {}",
        result.success_rate
    );

    // 2. Assert path count
    assert_eq!(result.paths_simulated, FAN_PATHS);

    // 3. Assert percentiles are monotonically increasing (p10 <= p25 <= p50 <= p75 <= p90)
    for band in &result.bands {
        assert!(band.p10 <= band.p25, "p10 > p25 at year {}", band.year);
        assert!(band.p25 <= band.p50, "p25 > p50 at year {}", band.year);
        assert!(band.p50 <= band.p75, "p50 > p75 at year {}", band.year);
        assert!(band.p75 <= band.p90, "p75 > p90 at year {}", band.year);
    }

    // 4. Performance: 5,000 paths across 55 years should take under 50ms in Rust!
    println!(
        "5,000 paths simulated in {:.3} ms (success: {:.1}%)",
        result.duration_ms,
        result.success_rate * 100.0
    );
    assert!(result.duration_ms < 500.0, "Simulation too slow: {} ms", result.duration_ms);
}
