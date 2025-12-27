
import re

def analyze_html(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    keywords = [
        'aria-label="[^"]*アップロード[^"]*"',
        'aria-label="[^"]*Add[^"]*"', 
        'aria-label="[^"]*追加[^"]*"',
        'aria-label="[^"]*Attach[^"]*"',
        '<input[^>]*type="file"[^>]*>',
        '<button[^>]*>[^<]*\+[^<]*</button>',
    ]

    print(f"Scanning {file_path} ({len(content)} bytes)...")
    
    for kw in keywords:
        print(f"\n--- Searching for: {kw} ---")
        matches = re.finditer(kw, content, re.IGNORECASE)
        count = 0
        for m in matches:
            count += 1
            print(f"Match {count}: {m.group(0)}")
            start = max(0, m.start() - 50)
            end = min(len(content), m.end() + 50)
            print(f"  Context: ...{content[start:end]}...")
            if count >= 5: break
        
        if count == 0:
            print("No matches found.")

    # Also look for any button with a plus icon or likely class
    print("\n--- Searching for mat-icon or similar ---")
    matches = re.finditer(r'<mat-icon[^>]*>[^<]*add[^<]*</mat-icon>', content, re.IGNORECASE)
    for i, m in enumerate(matches):
        if i >= 3: break
        start = max(0, m.start() - 100)
        end = min(len(content), m.end() + 100)
        print(f"Match {i+1}: ...{content[start:end]}...")

if __name__ == "__main__":
    analyze_html("upload_error_source.html")
