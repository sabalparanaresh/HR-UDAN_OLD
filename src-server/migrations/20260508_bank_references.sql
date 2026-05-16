-- Migration for bank transfer references
CREATE TABLE IF NOT EXISTS bank_transfer_references (
  bank_name TEXT PRIMARY KEY,
  last_reference_number INTEGER NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
