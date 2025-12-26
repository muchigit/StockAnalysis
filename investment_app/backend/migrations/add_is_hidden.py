from sqlmodel import Session, text
from ..database import engine

def migrate():
    with Session(engine) as session:
        print("Migrating: Adding is_hidden column to stock table...")
        try:
            # Check if column exists
            session.exec(text("SELECT is_hidden FROM stock LIMIT 1"))
            print("Column 'is_hidden' already exists.")
        except Exception:
            # Add column
            session.exec(text("ALTER TABLE stock ADD COLUMN is_hidden BOOLEAN DEFAULT 0"))
            session.commit()
            print("Added 'is_hidden' column.")

if __name__ == "__main__":
    migrate()
