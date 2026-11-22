"""Ethio Telecom region -> Ethio Post district alignment.

Source: "Ethio Telecom / Ethiopost Regional District Alignment" sheet.
Single source of truth: the seed script and the CSV relink both read this file.
To change the alignment, edit ALIGNMENT and re-run relink.

Location: app/core/region_alignment.py
"""
from __future__ import annotations

# (Ethio Post district name, HQ town, [Ethio Telecom region codes served by it])
ALIGNMENT: list[tuple[str, str, list[str]]] = [
    ("GPO District", "GPO-HQ", ["NAAZ"]),
    ("Addis Ababa District", "Addis Ababa", ["SAAZ", "EAAZ", "WAAZ", "SWAAZ"]),
    ("Debre Berhan District", "Debre Berhan", ["CNR"]),
    ("Ambo District", "Ambo", ["CWR"]),
    ("North District", "Mekelle", ["NR"]),
    ("Hawassa District", "Hawassa", ["SR"]),
    ("South District", "Arba Minch", ["SSWR"]),
    ("Central Ethiopia District", "Hossana", []),
    ("Dire Dawa District", "Dire Dawa & Harar", ["ER", "CER"]),
    ("Somali District", "Jijiga", ["EER"]),
    ("Adama District", "Adama", ["SER"]),
    ("Bale District", "Bale Robe", ["SSER"]),
    ("Gojam District", "Bahir Dar", ["NWR"]),
    ("Gonder District", "Gonder", ["NNWR"]),
    ("Dessie District", "Dessie", ["NER"]),
    ("Afar District", "Semera", ["NEER"]),
    ("Nekemte District", "Nekemte", ["WR"]),
    ("Assosa District", "Assosa", ["WWR"]),
    ("Jimma District", "Jimma", ["SWR"]),
    ("Gambela District", "Gambella", ["SWWR"]),
    ("South West District", "Mizan Aman", []),
]

# (name, HQ) pairs, used by the seed script
DISTRICTS: list[tuple[str, str]] = [(name, hq) for name, hq, _ in ALIGNMENT]

HQ_BY_DISTRICT: dict[str, str] = dict(DISTRICTS)


def _key(value: str) -> str:
    """Case- and whitespace-insensitive key: ' naaz ' == 'NAAZ'."""
    return "".join(str(value).split()).upper()


REGION_TO_DISTRICT: dict[str, str] = {
    _key(region): district for district, _, regions in ALIGNMENT for region in regions
}


def district_for_region(region: str | None) -> str | None:
    """Ethio Post district name for an ET region code, or None if the code is unknown."""
    if not region:
        return None
    return REGION_TO_DISTRICT.get(_key(region))