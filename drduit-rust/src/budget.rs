//! Budgeting and Envelope Mathematics for Dr Duit
//! Follows YNAB-style Envelope Budgeting & RTA Identity (ADR 2026-09-09 & 2026-09-10)

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Envelope {
    pub id: String,
    pub name: String,
    pub assigned: Decimal,
    pub activity: Decimal,
    pub carry_in: Decimal,
}

impl Envelope {
    pub fn new(id: impl Into<String>, name: impl Into<String>, carry_in: Decimal, assigned: Decimal, activity: Decimal) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            carry_in,
            assigned,
            activity,
        }
    }

    /// Available in envelope: carry_in + assigned + activity
    pub fn available(&self) -> Decimal {
        self.carry_in + self.assigned + self.activity
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BudgetContext {
    pub cash_as_of: Decimal,
    pub card_credit: Decimal,
    pub baseline: Decimal,
    pub envelopes: Vec<Envelope>,
    /// Hole from uncategorized or unlinked cash spend (held outside envelopes until month end)
    pub held_outside_envelopes: Decimal,
    /// Card spend not yet covered by payment envelopes
    pub card_spend_not_covered: Decimal,
}

impl BudgetContext {
    /// Sum of all available funds in envelopes (signed)
    pub fn held_in_envelopes(&self) -> Decimal {
        self.envelopes.iter().map(|e| e.available()).sum()
    }

    /// Ready to Assign calculation according to ADR 2026-09-09:
    /// RTA = (cash_as_of + card_credit) - baseline - held_in_envelopes - held_outside_envelopes - card_spend_not_covered
    pub fn ready_to_assign(&self) -> Decimal {
        (self.cash_as_of + self.card_credit)
            - self.baseline
            - self.held_in_envelopes()
            - self.held_outside_envelopes
            - self.card_spend_not_covered
    }

    /// Verifies the fundamental mathematical identity:
    /// RTA + held_in_envelopes + held_outside_envelopes + card_spend_not_covered + baseline == cash_as_of + card_credit
    pub fn verify_rta_identity(&self) -> bool {
        let rta = self.ready_to_assign();
        let total_assigned_and_held = rta
            + self.held_in_envelopes()
            + self.held_outside_envelopes
            + self.card_spend_not_covered
            + self.baseline;
        let total_cash_and_credit = self.cash_as_of + self.card_credit;
        total_assigned_and_held == total_cash_and_credit
    }
}
