use drduit_rust::budget::{BudgetContext, Envelope};
use drduit_rust::monetary::{Account, AccountType};
use rust_decimal_macros::dec;

#[test]
fn test_ready_to_assign_identity_holds_with_card_credit_and_outside_holds() {
    let accounts = vec![
        Account::new("a1", "Bank", AccountType::Cash, "USD", dec!(8000)),
        Account::new("a2", "Credit in Surplus", AccountType::Credit, "USD", dec!(350)),
    ];

    let envelopes = vec![
        Envelope::new("e1", "Rent", dec!(500), dec!(1500), dec!(-1500)),
        Envelope::new("e2", "Food", dec!(0), dec!(600), dec!(-750)), // Overspent envelope: -150
    ];

    let ctx = BudgetContext {
        cash_as_of: drduit_rust::monetary::cash_on_hand(&accounts),
        card_credit: drduit_rust::monetary::total_card_credit(&accounts),
        baseline: dec!(500),
        envelopes,
        held_outside_envelopes: dec!(120),
        card_spend_not_covered: dec!(80),
    };

    // Calculate RTA
    let rta = ctx.ready_to_assign();

    // Verify mathematical identity
    assert!(ctx.verify_rta_identity(), "Fundamental RTA identity failed!");

    // Manually verify: Total cash (8000) + card credit (350) = 8350
    // baseline (500) + held_in_envelopes (500 + -150 = 350) + held_outside (120) + card_uncovered (80) = 1050
    // RTA should be 8350 - 1050 = 7300
    assert_eq!(rta, dec!(7300));
}
