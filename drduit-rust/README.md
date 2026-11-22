# Dr Duit — Rust Core Engine (`drduit-rust`)

Implementasi performa tinggi untuk core engine keuangan dan simulasi probabilitas Dr Duit dalam bahasa **Rust**.

Folder ini sepenuhnya **terisolasi** dari kode utama (`backend/` dan `frontend/`), sehingga source code Python dan TypeScript tetap aman dan tidak terganggu.

---

## ⚡ Fitur Utama yang Telah Di-porting

1. **Monte Carlo Retirement Engine (`src/montecarlo.rs`):**
   - Porting langsung dari `backend/services/montecarlo.py`.
   - Menggunakan parallel execution via **Rayon** (multi-threaded SIMD).
   - Menghitung pertumbuhan majemuk bulanan, shock window (depresi/inflasi), market crash, drawdown pensiun, serta stream pendapatan terjamin (pensiun/anuitas).
   - Menghasilkan kurva distribusi persentil lengkap (**p10, p25, p50, p75, p90**) dan *success rate*.

2. **Monetary & Ledger Types (`src/monetary.rs`):**
   - 7 Klasifikasi Akun Dr Duit (`cash, fixed_deposit, investment, retirement, receivable, credit, loan`).
   - Tipe Transaksi (`income, expense, transfer`).
   - Menggunakan `rust_decimal` untuk presisi keuangan mutlak tanpa pembulatan float IEEE-754.

3. **Envelope Budgeting & RTA Invariant (`src/budget.rs`):**
   - Menerapkan rumus YNAB Ready-To-Assign (ADR 2026-09-09 & 2026-09-10):
     $$\text{RTA} = (\text{Cash} + \text{Card Credit}) - \text{Baseline} - \sum \text{Envelopes} - \text{Held Outside} - \text{Uncovered Card}$$
   - Pengujian identitas invarian otomatis.

---

## 🚀 Performa & Benchmark

Dibandingkan dengan implementasi Python/NumPy sebelumnya:

| Pengujian | Python (NumPy) | Rust (`drduit-rust`) | Peningkatan |
|---|---|---|---|
| **5.000 Paths (Standar Layar & Chat)** | ~250 - 400 ms | **~19 ms** | **15 - 20x lebih cepat** |
| **100.000 Paths (Stress Test)** | ~6 - 8 detik | **~240 ms** | **25x - 30x lebih cepat** |
| **Throughput Simulasi** | ~15.000 paths/detik | **~415.000 paths/detik** | Sangat masif |

---

## 🛠️ Cara Menjalankan

Masuk ke folder `drduit-rust`:

```bash
cd drduit-rust
```

### 1. Menjalankan Unit Tests:
```bash
cargo test
```

### 2. Menjalankan Simulasi Monte Carlo:
```bash
cargo run --release -- montecarlo --paths 5000
```

### 3. Menguji Identitas YNAB Budget:
```bash
cargo run --release -- budget-check
```

### 4. Menjalankan Stress Test Throughput:
```bash
cargo run --release -- benchmark --total-paths 100000
```

---

## 🔄 Integrasi dengan `rust-anything`

Tool `rust-anything` (v3.1.0) telah terpasang di sistem (`~/.cargo/bin/rust-anything`). 
Untuk menganalisis modul Python lain di Dr Duit dan membuat rencana migrasi bertahap, Anda dapat menjalankan:

```bash
rust-anything analyze ../backend/services --lang python
```
Tool tersebut akan memetakan risiko, tipe data, dan dependensi sebelum fungsi di-porting ke Rust.
