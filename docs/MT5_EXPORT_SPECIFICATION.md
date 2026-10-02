# MetaTrader 5 (MT5) Export Format & Pipeline Specification

## 1. Overview
This document specifies the supported MetaTrader 5 (MT5) Deals export formats, column definitions, semantic interpretation, and the end-to-end data pipeline from raw export to normalized trade records.

---

## 2. Supported Export Formats & Limitations

### Format A: Structured Deals CSV / Institutional Report (Fully Supported)
This format includes structured deal identification and an authoritative opposite-position identifier for Close By operations.

**Columns:**
- `Time` / `Date`: Deal execution timestamp (`YYYY.MM.DD HH:MM:SS` or ISO-8601)
- `Deal`: Deal ticket number
- `Order`: Corresponding order ticket number
- `Position`: Position identifier
- `Position By` / `position_by_id`: **Authoritative opposite position ID for `out_by` deals**
- `Symbol`: Traded instrument (e.g. `EURUSD`, `XAUUSD`)
- `Type`: Order/Deal side (`buy` / `sell`)
- `Entry` / `Direction`: MT5 deal entry semantic (`in`, `out`, `inout`, `out_by`)
- `Volume` / `Lots`: Deal lot size
- `Price`: Deal execution price
- `Commission`: Broker commission
- `Swap`: Overnight swap
- `Profit`: Realized gross profit
- `Comment`: User or EA comment (optional)
- `Magic`: Expert Advisor magic number (optional)

### Format B: Standard Desktop Quick Report (Partial / Explicit Limitation)
Standard MetaTrader 5 desktop client HTML/CSV reports omit the dedicated `Position By` column and only include:
`Time, Deal, Order, Symbol, Type, Direction, Volume, Price, Order, Commission, Swap, Profit, Comment`

**Strict Limitation:**
In standard desktop exports, when an `out_by` deal is encountered without the dedicated `Position By` column, the parser **strictly rejects** the deal with a clear validation error:
> `معامله خروج Close By (out_by) فاقد ستون ساختاریافته شناسه پوزیشن مقابل (Position By) است. فرمت بدون ستون شناسه پوزیشن مقابل جهت جلوگیری از حدس اشتباه پشتیبانی نمی‌شود.`
>
> *Comment regex (`close by #...`) is intentionally disallowed as the source of truth.*

---

## 3. Data Pipeline & Identifier Preservation

```text
Raw MT5 CSV / Report
        ↓
csv-parser.ts (parseCSV)
        ↓
trade-normalizer.ts (parseMT5DealRow)
  - Extracts structured column 'Position By' -> MT5Deal.position_by_id
  - Validates entry === 'out_by' has non-empty position_by_id
        ↓
mt5-aggregation.ts (aggregateMT5DealsDetailed)
  - Matches position_id with counterpart position_by_id
  - Validates symbol match between opposite positions
  - Validates opposite sides (Buy vs Sell)
  - Reduces volume / closes positions with exact duration, pricing, and profit
  - Records AggregatedPosition.close_by_position_id
        ↓
mt5-aggregation.ts (positionToNormalizedTrade)
  - Maps to NormalizedTrade.position_by_id
        ↓
PostgreSQL / Supabase
  - Inserted atomically via import_trades_transactional
```

---

## 4. MT5 Semantics

### `DEAL_ENTRY_IN` (Entry / Add)
Increases position open volume, calculates volume-weighted entry price.

### `DEAL_ENTRY_OUT` (Exit / Partial Close)
Reduces open volume, calculates volume-weighted exit price, attributes profit, commission, and duration.

### `DEAL_ENTRY_INOUT` (Reversal)
Never treated as an ordinary partial close. Reversals split into:
1. Complete or partial close of the current position (duration, exit price, realized profit attributed).
2. Opening of a brand-new opposite position with its own independent entry timestamp, entry price, and identity.

### `DEAL_ENTRY_OUT_BY` (Close By)
Closes two opposite hedging positions against each other:
1. Authoritative relationship verified through `position_by_id`.
2. Both positions validated for identical symbol and opposite sides.
3. Matching volume deducted from each position.
4. Independent durations, commissions, and profits preserved.
