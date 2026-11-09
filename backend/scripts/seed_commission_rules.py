"""Seed financial service providers, service types and commission rules
from "Ethiopost DFS: Summary of Commission Structure with all FSP and MNOs" (March 19, 2026).

Usage:
    python -m scripts.seed_commission_rules             # insert
    python -m scripts.seed_commission_rules --dry-run   # show what would happen, write nothing

Safe to run more than once: providers / service types are matched by code (or CSV label),
rules are matched by provider + service + qualifier + band + effective date and skipped if present.

Interpretation of the source sheet (check these, they are the judgement calls):
  * A bare number (e.g. "5", "4.00 ETB") is a FLAT commission in ETB.
  * A value with "%" is a PERCENT commission. "of sold amount / deposited amount / txn value"
    -> basis TXN_AMOUNT, "of charges collected" -> FEE_COLLECTED, "of revenue" -> REVENUE.
  * "> X" is stored as X + 0.01, ">= X" as X, "< X" as X - 0.01, "<= X" as X.
  * "NA" and empty cells are skipped.
  * Rows with text that cannot be a number (milestones, 20%-of-sub-agent shares ...) keep that text in
    `conditions` next to the best numeric reading.
Deviations from the sheet to avoid overlapping bands (marked "ASSUMED" below):
  * Telebirr cash-out "101-300" and "101-500" overlap  -> 101-300 and 301-500.
  * Telebirr Ethio-telecom bill "51-1000" and "1000-2000" -> 51-1000 and 1001-2000.
  * Ahadu cash-out "4,001-8,000: 0.3%" overlaps "5,001-8,000: 12 ETB" -> 0.3% applied to 4,001-5,000.
"""

from __future__ import annotations

import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import select

from app.core.enums import CommissionBasis, CommissionType, Status
from app.db.session import SessionLocal
from app.models import CommissionRule, FinancialServiceProvider, ServiceType

EFFECTIVE_FROM = date(2026, 3, 19)  # date of the commission sheet

# ───────────────────────── providers & service types ─────────────────────────
FSPS = {
    "TELEBIRR": "Telebirr",
    "CBE_BIRR": "CBE Birr",
    "AHADU": "Ahadu E-Birr",
    "MPESA": "M-PESA",
    "COOP": "COOP E-Birr",
    "AWASH": "Awash Birr",
}
T, C, A, M, K, W = "TELEBIRR", "CBE_BIRR", "AHADU", "MPESA", "COOP", "AWASH"

# code -> (name, csv_label). csv_label must match the transactions report's "Service Type" column.
SERVICE_TYPES = {
    "CASH_IN": ("Cash In", "Cash In"),
    "CASH_OUT": ("Cash Out", "Cash Out"),
    "AIRTIME_TOPUP": ("Airtime Top Up", "Airtime Top Up"),
    "BILL_PAYMENT": ("Bill Payment", "Bill Payment"),
    "CUSTOMER_REGISTRATION": ("Customer Registration", None),
    "CUSTOMER_UPGRADE": ("Customer Upgrade", None),
    "PACKAGE_SALES": ("Package Sales", None),
    "ANNUITY": ("Annuity", None),
    "AGENT_REGISTRATION": ("Agent Registration", None),
    "AGENT_ONBOARDING": ("Agent Onboarding Fee", None),
    "AGENT_MAINTENANCE": ("Agent Maintenance Fee", None),
    "MERCHANT_REGISTRATION": ("Merchant Registration", None),
    "LEHULUM_RECRUITMENT": ("M-PESA Lehulum Customer Recruitment", None),
    "REVENUE_SHARE": ("Revenue Share (Ethiopost / sub-agent)", None),
    "CICO_TRANSACTIONS": ("CICO Transactions", None),
    "SUB_AGENT_BUSINESS_TXN": ("Sub-agent to Agent Business Deposit / Withdrawal", None),
    "OTHER_UTILITY_PAYMENT": ("Other Utility Payment", None),
    "BILLER_FEE": ("Biller Facilitation Fee", None),
    "OTC_BILL_PAYMENT": ("OTC Bill Payment", None),
    "AGENCY_BANKING": ("Agency Banking", None),
    "FUND_TRANSFER": ("Fund Transfer", None),
    "OTHER_SERVICES": ("Balance Enquiry / Mini Statement", None),
}

# ───────────────────────── rule rows ─────────────────────────
TXN, FEE, REV = CommissionBasis.TXN_AMOUNT, CommissionBasis.FEE_COLLECTED, CommissionBasis.REVENUE
CI, CO, BP = "CASH_IN", "CASH_OUT", "BILL_PAYMENT"


@dataclass(frozen=True)
class Rule:
    fsp: str
    service: str
    lo: Decimal | None
    hi: Decimal | None
    kind: CommissionType
    rate: Decimal
    basis: CommissionBasis | None = None
    qualifier: str | None = None
    note: str | None = None


def _d(v) -> Decimal | None:
    return None if v is None else Decimal(str(v)).quantize(Decimal("0.01"))


def flat(fsp, service, lo, hi, rate, q=None, note=None) -> Rule:
    return Rule(fsp, service, _d(lo), _d(hi), CommissionType.FLAT, Decimal(str(rate)), None, q, note)


def pct(fsp, service, lo, hi, rate, basis=TXN, q=None, note=None) -> Rule:
    return Rule(fsp, service, _d(lo), _d(hi), CommissionType.PERCENT, Decimal(str(rate)), basis, q, note)


def gt(x) -> Decimal:  # "> x"
    return Decimal(str(x)) + Decimal("0.01")


def lt(x) -> Decimal:  # "< x"
    return Decimal(str(x)) - Decimal("0.01")


RULES: list[Rule] = [
    # ── Customer registration / upgrade ──
    flat(T, "CUSTOMER_REGISTRATION", None, None, 18, note="For each new successful registration"),
    flat(C, "CUSTOMER_REGISTRATION", None, None, "13.80", note="Upon registration with customer deposit"),
    flat(A, "CUSTOMER_REGISTRATION", None, None, 15, note="Completed registration with an initial deposit of ETB 100"),
    flat(M, "CUSTOMER_REGISTRATION", None, None, 50,
         note="Per txn for new customer registration on GSM & M-PESA with a top-up package of ETB 50"),
    flat(W, "CUSTOMER_REGISTRATION", None, None, 15),
    flat(T, "CUSTOMER_UPGRADE", None, None, 12),

    # ── Airtime / packages / annuity ──
    pct(T, "AIRTIME_TOPUP", None, None, 15, TXN, note="Of sold amount"),
    pct(C, "AIRTIME_TOPUP", None, None, 100, REV, q="sub-agent",
        note="100% of the Ethio-Telecom commission for sub-agents when customers buy airtime at sub-agents"),
    pct(W, "AIRTIME_TOPUP", None, None, 2, TXN, note="Sale airtime"),
    pct(T, "PACKAGE_SALES", None, None, 25, TXN, note="Of sold amount"),
    pct(T, "ANNUITY", None, None, 5, REV, note="Of revenue from non-agent activities made by the customer"),

    # ── Agent / merchant fees ──
    flat(T, "AGENT_REGISTRATION", None, None, 2300,
         note="30% paid when the registered agent purchases 500 e-money and starts transacting. "
              "70% paid when the agent has made 40 txn, min aggregate txn 2,000 birr and purchased "
              "1,000 e-money per month for 3 consecutive months."),
    flat(M, "AGENT_ONBOARDING", None, None, 1000, note="Per agent upon reaching 50 transactions in 45 days"),
    flat(M, "AGENT_MAINTENANCE", None, None, 1500,
         note="Agent must be active for 30 days with a minimum of 50 transactions or more. Minimum transaction "
              "value applies to each transaction type. Pay starts from the 2nd month."),
    flat(T, "MERCHANT_REGISTRATION", None, None, 1150,
         note="30% paid when the registered merchant makes a min 50 birr txn. 70% paid when the merchant has made "
              "10 txn, min aggregate txn 2,000 birr per month for 3 consecutive months."),
    flat(M, "LEHULUM_RECRUITMENT", None, None, 50,
         note="App download followed by cash-in; the minimum transaction value rule for cash-in applies"),
    pct(M, "REVENUE_SHARE", None, None, 100, REV, q="own Ethiopost store (branch agent)",
        note="Ethiopost makes 100% of the commission for its own store agents"),
    pct(M, "REVENUE_SHARE", None, None, 80, REV, q="sub-agent (child)",
        note="80:20 share between the aggregated child (independent retail agent) and Ethiopost, based on commission"),
    flat(M, "CICO_TRANSACTIONS", None, None, 150, q="registered customer"),
    pct(W, "CICO_TRANSACTIONS", None, None, "0.5", TXN, note="Per transaction"),

    # ── Cash in: COOP flat fee above 10,000 ──
    flat(K, CI, gt(10000), None, 50, note="Flat fee, transactions above ETB 10,000"),
    flat(K, CO, gt(10000), None, 20, note="Flat fee, transactions above ETB 10,000"),

    # ── Cash in: Telebirr ──
    pct(T, CI, 1, 250, 1, TXN),
    flat(T, CI, 251, 500, 3), flat(T, CI, 501, 1500, 4), flat(T, CI, 1501, 3000, 6),
    flat(T, CI, 3001, 5000, 8), flat(T, CI, 5001, 8000, 10), flat(T, CI, 8001, 15000, 12),
    flat(T, CI, 15001, 20000, 13), flat(T, CI, 20001, 30000, 15),
    # ── Cash in: CBE Birr ──
    flat(C, CI, 51, 500, "5.34"), flat(C, CI, 501, 2000, "6.72"), flat(C, CI, 2001, 3000, "7.42"),
    flat(C, CI, 3001, 4000, "7.33"), flat(C, CI, 4001, 5000, "8.80"), flat(C, CI, 5001, 6000, "11.93"),
    pct(C, CI, 6001, 30000, "0.15", TXN, note="20% of sub-agents' 0.15% commission of the value"),
    # ── Cash in: Ahadu ──
    flat(A, CI, None, lt(50), "1.00"), flat(A, CI, 51, 100, "2.00"), flat(A, CI, 101, 500, "4.00"),
    flat(A, CI, 501, 2000, "6.00"), flat(A, CI, 2001, 3000, "7.50"), flat(A, CI, 3001, 4000, "9.00"),
    flat(A, CI, 4001, 5000, "10.00"),
    pct(A, CI, 5001, None, "0.20", TXN, note="Of the deposited amount"),
    # ── Cash in: M-PESA ──
    flat(M, CI, 51, 500, 6), flat(M, CI, 501, 2000, 7), flat(M, CI, 3001, 4000, 8),
    flat(M, CI, 4001, 5000, 14), flat(M, CI, 5001, None, 15),
    # ── Cash in: Awash ──
    pct(W, CI, None, lt(100), 2, TXN),
    flat(W, CI, 101, 1000, 6), flat(W, CI, 1001, 2000, 7), flat(W, CI, 2001, 4000, 8),
    flat(W, CI, 4001, 6000, 12), flat(W, CI, 6001, 8000, 15), flat(W, CI, 8001, 10000, 17),
    flat(W, CI, 10001, 15000, 18), flat(W, CI, 15001, 20000, 20), flat(W, CI, 20001, 50000, 25),

    # ── Cash out: Telebirr ──
    flat(T, CO, 25, 50, 1), flat(T, CO, 51, 100, 2), flat(T, CO, 101, 300, 3),
    flat(T, CO, 301, 500, 5, note="ASSUMED: sheet says 101-500, which overlaps 101-300"),
    flat(T, CO, 501, 1000, 6), flat(T, CO, 1001, 3000, 8), flat(T, CO, 3001, 5000, 10),
    flat(T, CO, 5001, 8000, 12), flat(T, CO, 8001, 15000, 14), flat(T, CO, 15001, 20000, 15),
    flat(T, CO, 20001, 30000, 17), flat(T, CO, 30001, 75000, 20),
    # ── Cash out: Ahadu ──
    flat(A, CO, 25, 50, 1), flat(A, CO, 51, 100, 2), flat(A, CO, 101, 500, 3), flat(A, CO, 501, 1000, 4),
    flat(A, CO, 1001, 2000, 6), flat(A, CO, 2001, 3000, 9), flat(A, CO, 3001, 4000, 12),
    pct(A, CO, 4001, 5000, "0.3", TXN,
        note="ASSUMED: sheet says 4,001-8,000 (0.3% of txn amount), which overlaps 5,001-8,000 flat 12"),
    flat(A, CO, 5001, 8000, 12), flat(A, CO, 8001, None, 24),
    # ── Cash out: M-PESA ──
    flat(M, CO, 25, 100, 2), flat(M, CO, 101, 500, 5), flat(M, CO, 501, 1000, 7),
    flat(M, CO, 1001, 3000, 21), flat(M, CO, 3001, None, 21),
    # ── Cash out: Awash ──
    flat(W, CO, 25, 100, "3.2"), flat(W, CO, 101, 500, 4), flat(W, CO, 501, 1000, "4.8"),
    flat(W, CO, 1001, 3000, "6.4"), flat(W, CO, 3001, 6000, 8), flat(W, CO, 6001, 8000, "10.4"),
    flat(W, CO, 8001, 10000, 12), flat(W, CO, 10001, 15000, "13.6"), flat(W, CO, 15001, 20000, 16),
    flat(W, CO, 20001, 50000, 20),
    # ── Cash out: CBE Birr (registered / unregistered customers) ──
    pct(C, CO, None, None, 75, FEE, q="registered customer",
        note="20% of sub-agents' 75% commission from charges collected from customers on this service"),
    flat(C, CO, None, 100, "0.90", q="unregistered customer"),
    pct(C, CO, 101, 3000, "0.75", TXN, q="unregistered customer",
        note="20% of sub-agents' 0.75% commission on the txn value"),
    flat(C, CO, gt(3000), None, 27, q="unregistered customer"),

    # ── Bill payment ──
    flat(T, BP, 0, 50, 4, q="Ethio telecom bill"),
    flat(T, BP, 51, 1000, 15, q="Ethio telecom bill"),
    flat(T, BP, 1001, 2000, 20, q="Ethio telecom bill", note="ASSUMED: sheet says 1000-2000"),
    flat(T, BP, 2001, 5000, 30, q="Ethio telecom bill"),
    pct(T, BP, gt(5000), None, 1, TXN, q="Ethio telecom bill", note="Of the collected bill amount"),
    # Ahadu (any bill)
    flat(A, BP, None, lt(100), 3), flat(A, BP, 101, 1000, 5),
    pct(A, BP, 1001, 5000, "0.5", TXN, note="Fee of 0.5% of the transaction"),
    flat(A, BP, gt(5000), None, 25),
    # Awash (any bill)
    pct(W, BP, 5, 100, 2, TXN),
    flat(W, BP, 101, 500, 5), flat(W, BP, 501, 1000, 8), flat(W, BP, 1001, 3000, 10),
    flat(W, BP, 3001, 6000, 11), flat(W, BP, 6001, 8000, 13), flat(W, BP, 8001, 10000, 14),
    flat(W, BP, 10001, 15000, 16), flat(W, BP, 15001, 20000, 20), flat(W, BP, gt(20000), None, 22),
    # CBE Birr through sub-agents
    flat(C, BP, None, lt(25), "2.54", q="through sub-agents"),
    flat(C, BP, 25, 500, "5.34", q="through sub-agents"),
    flat(C, BP, 501, 2000, "6.72", q="through sub-agents"),
    flat(C, BP, 2001, 3000, "7.42", q="through sub-agents"),
    flat(C, BP, 3001, 4000, "8.80", q="through sub-agents"),
    flat(C, BP, 4001, 5000, "10.18", q="through sub-agents"),
    flat(C, BP, 5001, 6000, "11.56", q="through sub-agents"),
    pct(C, BP, 6001, None, "0.15", TXN, q="through sub-agents", note="20% of sub-agents' 0.15% commission of the value"),

    # ── Other CBE / Telebirr services ──
    pct(C, "SUB_AGENT_BUSINESS_TXN", None, None, 60, FEE, note="Of the charges collected"),
    pct(T, "OTHER_UTILITY_PAYMENT", None, None, 100, FEE, note="Of the facilitation fee generated from billers"),
    flat(T, "BILLER_FEE", None, None, 1, q="EEU (Ethiopian Electric Utility)", note="Per txn count"),
    flat(T, "BILLER_FEE", None, None, 3, q="Hello Solar", note="Per txn count"),
    pct(T, "BILLER_FEE", None, None, "0.2", TXN, q="DSTV", note="Sheet: '0.2% Birr per txn count'"),
    pct(T, "BILLER_FEE", None, None, "0.23", TXN, q="Canal", note="Sheet: '0.23% Birr per txn count'"),
    flat(T, "BILLER_FEE", None, None, 1, q="Water bill", note="Per txn count"),

    # ── COOP: OTC bill payment & agency banking ──
    flat(K, "OTC_BILL_PAYMENT", None, None, 200, q="no range listed", note="Listed without a transaction range"),
    flat(K, "OTC_BILL_PAYMENT", 0, 500, 5), flat(K, "OTC_BILL_PAYMENT", 501, 1000, 10),
    flat(K, "OTC_BILL_PAYMENT", 1001, None, 20),
    flat(K, "AGENCY_BANKING", None, None, 500, q="bank to agent till / agent till to bank",
         note="Customer bank to agent till & agent till to customer bank"),
    flat(K, "AGENCY_BANKING", 0, 500, 5), flat(K, "AGENCY_BANKING", 501, 1000, 10),
    flat(K, "AGENCY_BANKING", 1001, None, 20),

    # ── Awash: fund transfer & other ──
    flat(W, "FUND_TRANSFER", None, None, 5, q="to Awash Bank account"),
    pct(W, "FUND_TRANSFER", 25, 5000, "0.40", TXN, q="to other bank account"),
    pct(W, "FUND_TRANSFER", gt(5000), 25000, "0.24", TXN, q="to other bank account"),
    pct(W, "FUND_TRANSFER", gt(25000), 100000, "0.16", TXN, q="to other bank account"),
    flat(W, "OTHER_SERVICES", None, None, 1, note="Per transaction: balance enquiry, mini statement"),
]


# ───────────────────────── checks ─────────────────────────
NEG, POS = Decimal("-1e18"), Decimal("1e18")


def find_overlaps(rules: list[Rule]) -> list[str]:
    groups: dict[tuple, list[Rule]] = defaultdict(list)
    for r in rules:
        groups[(r.fsp, r.service, r.qualifier)].append(r)
    problems = []
    for key, items in groups.items():
        for i, a in enumerate(items):
            for b in items[i + 1:]:
                if (a.lo if a.lo is not None else NEG) <= (b.hi if b.hi is not None else POS) and (
                    b.lo if b.lo is not None else NEG
                ) <= (a.hi if a.hi is not None else POS):
                    problems.append(f"{key}: {a.lo}-{a.hi} overlaps {b.lo}-{b.hi}")
    return problems


# ───────────────────────── database ─────────────────────────
def _get_fsp(db, code: str, name: str, created: list[str]) -> FinancialServiceProvider:
    fsp = db.scalars(
        select(FinancialServiceProvider).where(
            FinancialServiceProvider.code == code, FinancialServiceProvider.deleted_at.is_(None)
        )
    ).first()
    if fsp is None:
        fsp = FinancialServiceProvider(code=code, name=name, status=Status.ACTIVE)
        db.add(fsp)
        db.flush()
        created.append(f"provider {code}")
    return fsp


def _get_service_type(db, code: str, name: str, csv_label: str | None, created: list[str]) -> ServiceType:
    obj = db.scalars(select(ServiceType).where(ServiceType.code == code, ServiceType.deleted_at.is_(None))).first()
    if obj is None and csv_label:  # a type created by hand with another code but the same CSV label is reused
        obj = db.scalars(
            select(ServiceType).where(ServiceType.csv_label == csv_label, ServiceType.deleted_at.is_(None))
        ).first()
    if obj is None:
        obj = ServiceType(code=code, name=name, csv_label=csv_label, status=Status.ACTIVE)
        db.add(obj)
        db.flush()
        created.append(f"service type {code}")
    return obj


def _key(fsp_id, service_id, qualifier, lo, hi, effective_from):
    return (fsp_id, service_id, qualifier, lo, hi, effective_from)


def main() -> None:
    dry_run = "--dry-run" in sys.argv

    problems = find_overlaps(RULES)
    if problems:
        raise SystemExit("Overlapping bands in the seed data:\n  " + "\n  ".join(problems))

    with SessionLocal() as db:
        created: list[str] = []
        fsps = {code: _get_fsp(db, code, name, created) for code, name in FSPS.items()}
        services = {
            code: _get_service_type(db, code, name, label, created) for code, (name, label) in SERVICE_TYPES.items()
        }

        existing = {
            _key(r.fsp_id, r.service_type_id, r.qualifier, r.min_amount, r.max_amount, r.effective_from)
            for r in db.scalars(select(CommissionRule).where(CommissionRule.deleted_at.is_(None)))
        }

        added = skipped = 0
        for r in RULES:
            fsp, service = fsps[r.fsp], services[r.service]
            if _key(fsp.id, service.id, r.qualifier, r.lo, r.hi, EFFECTIVE_FROM) in existing:
                skipped += 1
                continue
            db.add(
                CommissionRule(
                    fsp_id=fsp.id,
                    service_type_id=service.id,
                    qualifier=r.qualifier,
                    min_amount=r.lo,
                    max_amount=r.hi,
                    commission_type=r.kind,
                    basis=r.basis if r.kind is CommissionType.PERCENT else None,
                    rate=r.rate,
                    conditions=r.note,
                    effective_from=EFFECTIVE_FROM,
                    status=Status.ACTIVE,
                )
            )
            added += 1

        if dry_run:
            db.rollback()
        else:
            db.commit()

        prefix = "[dry run] would create" if dry_run else "Created"
        print(f"{prefix}: {', '.join(created) if created else 'no new providers or service types'}")
        print(f"{'[dry run] would add' if dry_run else 'Added'} {added} commission rules, skipped {skipped} existing.")


if __name__ == "__main__":
    main()
