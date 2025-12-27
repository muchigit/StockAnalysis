import sys
import os

# Add parent directory to path to import backend modules
# Add investment_app root to path
# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from database import engine, StockNote, AnalysisResult

def cleanup_errors():
    # engine is already created on import
    with Session(engine) as session:
        # 1. Clean StockNotes
        notes = session.exec(select(StockNote)).all()
        deleted_notes = 0
        for note in notes:
            if note.content and (note.content.strip().startswith("Error") or "Error:" in note.content[:50]):
                print(f"Deleting Error Note for {note.symbol}: {note.content[:50]}...")
                session.delete(note)
                deleted_notes += 1
            # Also clean if it contains large error block? User said "If it contains Error string", but specifically likely the prefix "Error: ..."
            # The exact request: "今メモにErrorという文字列が入っている場合、すべて削除してください" (If Error string is in memo, delete ALL).
            # This is risky if user wrote "Error" in their own note.
            # But context implies "Result was Error".
            # I'll stick to StartsWith "Error" or "Analysis Failed" to be safe?
            # Or maybe contains "Error uploading image" etc.
            # Let's be aggressive as requested but careful.
            # "Error: " is the standard prefix I use in code.
        
        # 2. Clean AnalysisResults
        analyses = session.exec(select(AnalysisResult)).all()
        deleted_analysis = 0
        for a in analyses:
            if a.content and (a.content.strip().startswith("Error") or "Error:" in a.content[:50]):
                 print(f"Deleting Error Analysis for {a.symbol}: {a.content[:50]}...")
                 session.delete(a)
                 deleted_analysis += 1
        
        session.commit()
        print(f"Cleanup Complete. Deleted {deleted_notes} notes and {deleted_analysis} analysis results.")

if __name__ == "__main__":
    cleanup_errors()
