//! Monetary and Ledger definitions for Dr Duit
//! Follows the key invariants from AGENTS.md and docs/INVARIANTS.md

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AccountType {
    Cash,
    FixedDeposit,
    Investment,
    Retirement,
    Receivable,
    Credit,
    Loan,
}

impl AccountType {
    /// Invariant: Cash on hand is strictly sum of `Cash` accounts
    pub fn is_cash_on_hand(&self) -> bool {
        matches!(self, AccountType::Cash)
    }

    /// Whether this account spends money directly (checking, wallet, credit card)
    pub fn is_spendable(&self) -> bool {
        matches!(self, AccountType::Cash | AccountType::Credit)
    }

    /// Whether this account type is a liability
    pub fn is_liability(&self) -> bool {
        matches!(self, AccountType::Credit | AccountType::Loan)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransactionKind {
    Income,
    Expense,
    Transfer,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub name: String,
    pub account_type: AccountType,
    pub currency: String,
    pub balance: Decimal,
}

impl Account {
    pub fn new(id: impl Into<String>, name: impl Into<String>, account_type: AccountType, currency: impl Into<String>, balance: Decimal) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            account_type,
            currency: currency.into(),
            balance,
        }
    }

    /// If this is a credit card in credit (positive balance), it counts as budget money
    pub fn card_credit(&self) -> Decimal {
        if self.account_type == AccountType::Credit && self.balance > Decimal::ZERO {
            self.balance
        } else {
            Decimal::ZERO
        }
    }
}

/// Calculate cash on hand across all accounts
pub fn cash_on_hand(accounts: &[Account]) -> Decimal {
    accounts
        .iter()
        .filter(|a| a.account_type.is_cash_on_hand())
        .map(|a| a.balance)
        .sum()
}

/// Calculate total card credit across all credit accounts
pub fn total_card_credit(accounts: &[Account]) -> Decimal {
    accounts.iter().map(|a| a.card_credit()).sum()
}
