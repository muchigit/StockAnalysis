from sqlmodel import Session, text
from investment_app.backend.database import engine

def migrate_db():
    print("Migrating database to add change_percentage_1d column...")
    with Session(engine) as session:
        try:
            # Check if column exists
            session.exec(text("SELECT change_percentage_1d FROM stock LIMIT 1"))
            print("Column 'change_percentage_1d' already exists.")
        except Exception:
            print("Adding 'change_percentage_1d' column...")
            session.exec(text("ALTER TABLE stock ADD COLUMN change_percentage_1d FLOAT"))
            session.commit()
            print("Column added successfully.")

if __name__ == "__main__":
    migrate_db()
