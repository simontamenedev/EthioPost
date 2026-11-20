"""Seed Ethio Post districts (parents) and Ethio Telecom regions (children).

Source: "Ethio Telecom / Ethiopost Regional District Alignment" sheet.

Usage:  python -m scripts.seed_districts

Safe to re-run: existing districts are matched by name and only get their
parent_id filled in if it is missing.
"""

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import District

# (Ethio Post district name, HQ town, [Ethio Telecom regions aligned to it])
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


def get_or_create(db, name: str, description: str, parent: District | None) -> tuple[District, bool]:
    district = db.scalars(
        select(District).where(District.name == name, District.deleted_at.is_(None))
    ).first()
    if district:
        if parent is not None and district.parent_id is None:
            district.parent_id = parent.id
        return district, False

    district = District(
        name=name,
        description=description,
        parent_id=parent.id if parent else None,
    )
    db.add(district)
    db.flush()  # assigns district.id so children can reference it
    return district, True


def main() -> None:
    created = 0
    with SessionLocal() as db:
        for post_name, hq, regions in ALIGNMENT:
            post, is_new = get_or_create(db, post_name, f"Ethio Post district (HQ: {hq})", None)
            created += is_new
            for region in regions:
                _, is_new = get_or_create(db, region, "Ethio Telecom region", post)
                created += is_new
        db.commit()
    print(f"Done. Created {created} districts.")


if __name__ == "__main__":
    main()