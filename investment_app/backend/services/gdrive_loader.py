import os
import re
from datetime import datetime
from typing import List, Dict, Optional
import logging

# Hardcoded paths
TARGET_DIRS = [
    r"G:\マイドライブ\分析レポート 買い リネーム済み",
    r"G:\マイドライブ\分析レポート"
]

logger = logging.getLogger(__name__)

class GDriveLoader:
    def __init__(self):
        self.pattern = re.compile(r"^(.*?)\[([A-Za-z0-9\.-]+)\]\(([\d-]+)\)")

    def search_reports(self, symbol: str) -> List[Dict]:
        """
        Search for reports matching the symbol in the local GDrive folder.
        Returns a list of dicts simulating AnalysisResult structure.
        """
        results = []
        try:
            for target_dir in TARGET_DIRS:
                if not os.path.exists(target_dir):
                    continue
                    
                files = os.listdir(target_dir)
                for file in files:
                    match = self.pattern.search(file)
                    if match:
                        if match.group(2).strip().upper() == symbol.upper():
                            results.append(self._parse_file_info(file, match, target_dir))
            
            results.sort(key=lambda x: x['created_at'], reverse=True)
            return results
        except Exception as e:
            logger.error(f"Error scanning GDrive: {e}")
            return []

    def get_latest_summaries(self) -> Dict[str, str]:
        """
        Scan all files and return a map of {symbol: latest_summary_text}.
        This is optimized for the dashboard list view.
        """
        latest_map = {}
        try:
            for target_dir in TARGET_DIRS:
                if not os.path.exists(target_dir):
                    continue

                files = os.listdir(target_dir)
                for file in files:
                    match = self.pattern.search(file)
                    if match:
                        desc = match.group(1).strip()
                        ticker = match.group(2).strip().upper()
                        date_str = match.group(3).strip()
                        
                        # Basic date comparison logic (string comparison for YYYY-MM-DD works)
                        # We want the latest date for each ticker
                    
                    # Store tuple (date, summary) temporarily
                    if ticker not in latest_map:
                        latest_map[ticker] = (date_str, desc)
                    else:
                        if date_str > latest_map[ticker][0]:
                            latest_map[ticker] = (date_str, desc)
                            
            # Convert to simple map {ticker: summary}
            return {k: f"[{v[0]}] {v[1]}" for k, v in latest_map.items()}
            
        except Exception as e:
            logger.error(f"Error scanning GDrive for summaries: {e}")
            return {}

    def _parse_file_info(self, filename, match, directory):
        desc = match.group(1).strip()
        ticker = match.group(2).strip()
        date_str = match.group(3).strip()
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            dt = datetime.now()

        content = f"**Google Drive Report**\n\n" \
                  f"**Date**: {date_str}\n" \
                  f"**Summary**: {desc}\n\n" \
                  f"*(File: {filename})*"
        

        # Generate a unique stable ID based on filename
        # Use negative IDs to avoid collision with database IDs (which are typically positive autoincrement)
        # hash() can vary by session in Python 3, so use zlib.adler32 or similar for stability, or just hash if per-session is fine.
        # For a long running app, consistent ID for the same file is better for React checks.
        import zlib
        # Adler32 is fast and sufficient for file names
        file_hash = zlib.adler32(filename.encode('utf-8'))
        # Ensure it's negative
        unique_id = -1 * abs(file_hash)

        return {
            "id": unique_id, 
            "symbol": ticker.upper(),
            "content": content,
            "created_at": dt,
            "source": "gdrive",
            "file_path": os.path.join(directory, filename)
        }


gdrive_loader = GDriveLoader()
