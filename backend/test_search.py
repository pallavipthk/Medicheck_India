import sqlite3
import re

conn = sqlite3.connect('backend/medicheck.db')
c = conn.cursor()

def smart_search(query, limit=20):
    query = query.strip()
    if not query:
        return []

    tokens = [re.sub(r'[^a-zA-Z0-9]', '', t) for t in query.split()]
    tokens = [t for t in tokens if t]
    if not tokens:
        return []

    results = {}

    # 1. Exact or prefix match on medicine_name (highest priority)
    c.execute("""
        SELECT medicine_id, medicine_name, generic_name, manufacturer, strength, dosage_form, price_inr
        FROM medicines
        WHERE medicine_name LIKE ?
        LIMIT 10
    """, (f"{query}%",))
    for r in c.fetchall():
        row = dict(zip(['medicine_id', 'medicine_name', 'generic_name', 'manufacturer', 'strength', 'dosage_form', 'price_inr'], r))
        row['_priority'] = 1
        results[row['medicine_id']] = row

    # 2. Token AND search on medicine_name (e.g. Zerodol and SP)
    if len(tokens) > 1:
        like_parts = " AND ".join(["medicine_name LIKE ?" for _ in tokens])
        params = [f"%{t}%" for t in tokens]
        c.execute(f"""
            SELECT medicine_id, medicine_name, generic_name, manufacturer, strength, dosage_form, price_inr
            FROM medicines
            WHERE {like_parts}
            LIMIT 15
        """, params)
        for r in c.fetchall():
            row = dict(zip(['medicine_id', 'medicine_name', 'generic_name', 'manufacturer', 'strength', 'dosage_form', 'price_inr'], r))
            if row['medicine_id'] not in results:
                row['_priority'] = 2
                results[row['medicine_id']] = row

    # 3. Substring match on medicine_name
    c.execute("""
        SELECT medicine_id, medicine_name, generic_name, manufacturer, strength, dosage_form, price_inr
        FROM medicines
        WHERE medicine_name LIKE ?
        LIMIT 15
    """, (f"%{tokens[0]}%",))
    for r in c.fetchall():
        row = dict(zip(['medicine_id', 'medicine_name', 'generic_name', 'manufacturer', 'strength', 'dosage_form', 'price_inr'], r))
        if row['medicine_id'] not in results:
            row['_priority'] = 3
            results[row['medicine_id']] = row

    # 4. FTS search on name or generic
    try:
        fts_expr = " ".join([f"medicine_name:{t}*" for t in tokens])
        c.execute(f"""
            SELECT m.medicine_id, m.medicine_name, m.generic_name, m.manufacturer, m.strength, m.dosage_form, m.price_inr
            FROM medicines_fts f
            JOIN medicines m ON f.medicine_id = m.medicine_id
            WHERE medicines_fts MATCH ?
            LIMIT 15
        """, (fts_expr,))
        for r in c.fetchall():
            row = dict(zip(['medicine_id', 'medicine_name', 'generic_name', 'manufacturer', 'strength', 'dosage_form', 'price_inr'], r))
            if row['medicine_id'] not in results:
                row['_priority'] = 4
                results[row['medicine_id']] = row
    except Exception as e:
        pass

    # 5. Generic name search
    c.execute("""
        SELECT medicine_id, medicine_name, generic_name, manufacturer, strength, dosage_form, price_inr
        FROM medicines
        WHERE generic_name LIKE ?
        LIMIT 15
    """, (f"%{tokens[0]}%",))
    for r in c.fetchall():
        row = dict(zip(['medicine_id', 'medicine_name', 'generic_name', 'manufacturer', 'strength', 'dosage_form', 'price_inr'], r))
        if row['medicine_id'] not in results:
            row['_priority'] = 5
            results[row['medicine_id']] = row

    # Sort results by priority, then by medicine_name length (shorter names first)
    sorted_res = sorted(results.values(), key=lambda x: (x['_priority'], len(x['medicine_name'])))
    return sorted_res[:limit]

# Test queries:
for test_q in ['Pan 40', 'Zerodol SP', 'Sibelium', 'Augmentin 625', 'Dolo 650', 'Combiflam', 'Crocin']:
    res = smart_search(test_q, limit=4)
    print(f"Smart search '{test_q}': {[r['medicine_name'] for r in res]}")
