import sqlite3

DB_PATH = "c:/Users/uchida/git/StockAnalysis/data/investment_app.db"

SIGNALS = [
    "signal_higher_200ma",
    "signal_near_200ma",
    "signal_over_50ma",
    "signal_higher_50ma_than_200ma",
    "signal_uptrand_200ma",
    "signal_sameslope_50_200",
    "signal_newhigh",
    "signal_newhigh_200days",
    "signal_newhigh_100days",
    "signal_newhigh_50days",
    "signal_high_volume",
    "signal_price_up",
    "signal_break_atr",
    "signal_high_slope5ma"
]

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("Adding signal columns to stock table...")
    for sig in SIGNALS:
        try:
            cursor.execute(f"ALTER TABLE stock ADD COLUMN {sig} INTEGER DEFAULT 0")
            print(f"Added {sig}")
        except sqlite3.OperationalError:
            print(f"Skipped {sig} (exists)")
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
