import threading
import time
import os
import logging
from datetime import datetime
from typing import List, Optional
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, StaleElementReferenceException, ElementClickInterceptedException
from ..services.stock_service import stock_service
from ..database import Stock, engine
from sqlmodel import Session, select

import logging
import subprocess
from datetime import datetime

class GeminiAutomationService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(GeminiAutomationService, cls).__new__(cls)
            cls._instance._init()
        return cls._instance

    def _init(self):
        self.is_running = False
        self.current_symbol = None
        self.total_count = 0
        self.processed_count = 0
        self.status_message = "Idle"
        self.logs = []
        self._stop_flag = False
        self._thread = None

    def get_status(self):
        return {
            "is_running": self.is_running,
            "current_symbol": self.current_symbol,
            "total": self.total_count,
            "processed": self.processed_count,
            "status": self.status_message,
            "logs": self.logs[-50:] # Return last 50 logs
        }



    def start_research(self, symbols: List[str], prompt_template: str):
        if self.is_running:
            return {"error": "Already running"}
        
        self.is_running = True
        self._stop_flag = False
        self.total_count = len(symbols)
        self.processed_count = 0
        self.logs = []
        
        self._thread = threading.Thread(target=self._run_research_loop, args=(symbols, prompt_template))
        self._thread.start()
        
        return {"status": "Started"}

    def stop_research(self):
        if self.is_running:
            self._stop_flag = True
            self.log("Stopping requested...")
            return {"status": "Stopping..."}
        return {"status": "Not running"}

    def log(self, message: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        entry = f"[{timestamp}] {message}"
        print(entry)
        self.logs.append(entry)

    def _run_research_loop(self, symbols: List[str], prompt_template: str):
        self.log(f"Starting research for {len(symbols)} symbols")
        driver = None
        
        try:
            # Connect to existing Chrome
            options = Options()
            options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
            
            # Assuming chromedriver is in path or handled by manager. 
            # In gemini_automation.py, ChromeDriverManager was used. 
            # Here we try connecting directly. If fails, we might need Service.
            from selenium.webdriver.chrome.service import Service
            from webdriver_manager.chrome import ChromeDriverManager
            
            try:
                # Try simple connect first
                driver = webdriver.Chrome(options=options)
            except:
                # Try with manager
                driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

            self.log("Connected to Chrome")

            for symbol in symbols:
                if self._stop_flag:
                    self.log("Process stopped by user.")
                    break

                self.current_symbol = symbol
                self.status_message = f"Processing {symbol}..."
                self.log(f"Processing {symbol}")

                try:
                    # 1. Prepare Prompt
                    prompt = self._prepare_prompt(symbol, prompt_template)
                    
                    # 2. Run Gemini Automation
                    success = self._automate_gemini_single(driver, symbol, prompt)
                    
                    if success:
                        self.log(f"Success: {symbol}")
                    else:
                        self.log(f"Failed: {symbol}")
                        
                except Exception as e:
                    self.log(f"Error processing {symbol}: {e}")
                
                self.processed_count += 1
                time.sleep(2) # Cooldown

        except Exception as e:
            self.log(f"Global Error: {e}")
        finally:
            self.is_running = False
            self.current_symbol = None
            self.status_message = "Completed" if not self._stop_flag else "Stopped"
            self.log("Research loop finished")
            # Do NOT quit driver as it is the user's main browser

    def _prepare_prompt(self, symbol: str, template: str) -> str:
        # Fetch stock details for substitution
        # This mirrors page.tsx logic but in backend python
        content = template
        
        # Simple replacements
        content = content.replace("%SYMBOL%", symbol)
        content = content.replace("%DATE%", datetime.now().strftime("%Y-%m-%d"))
        
        # DEBUG
        with open("automation_debug.txt", "a", encoding="utf-8") as f:
            f.write(f"\n--- Processing {symbol} ---\n")
            f.write(f"Template has COMPANYNAME? {'%COMPANYNAME%' in content}\n")
            f.write(f"Content Start: {content[:50]}...\n")
        
        try:
             # 1. Try Live Info (yfinance)
             self.log(f"Fetching company name for {symbol}...") # DEBUG
             stock = stock_service.get_stock_info(symbol)
             name_found = None
             
             if stock:
                 name_found = stock.get('longName') or stock.get('shortName')

             # 2. If Failed, Try Database
             if not name_found or name_found == symbol:
                 try:
                     with Session(engine) as session:
                         db_stock = session.exec(select(Stock).where(Stock.symbol == symbol)).first()
                         if db_stock and db_stock.company_name:
                             name_found = db_stock.company_name
                             self.log(f"Found name in DB: {name_found}")
                 except Exception as db_e:
                     self.log(f"DB lookup failed: {db_e}")

             if name_found:
                 self.log(f"Found name: {name_found}") # DEBUG
                 content = content.replace("%COMPANYNAME%", name_found)
                 with open("automation_debug.txt", "a", encoding="utf-8") as f:
                     f.write(f"Replaced with: {name_found}\n")

             else:
                 self.log(f"Stock info not found for {symbol}") # DEBUG
                 content = content.replace("%COMPANYNAME%", symbol)
                 with open("automation_debug.txt", "a", encoding="utf-8") as f:
                     f.write(f"Fallback to symbol: {symbol}\n")
        except Exception as e:
            self.log(f"Company Name fetch warning: {e}")
            content = content.replace("%COMPANYNAME%", symbol)
            with open("automation_debug.txt", "a", encoding="utf-8") as f:
                 f.write(f"Exception, fallback to symbol: {e}\n")

        # CSV Data replacement
        if "%STOCKDATA%" in content:
            self.log(f"Fetching data for {symbol}...")
            # Reuse get_stock_data logic
            df = stock_service.get_stock_data(symbol, period="2y", interval="1d")
            if not df.empty:
                # Last 100 days
                df_slice = df.tail(100).copy().reset_index()
                
                # Format
                # Convert Date to string
                # df_slice['Date'] (or index name) needs to be string
                # Assuming 'Date' column exists after reset_index
                csv_str = df_slice.to_csv(index=False)
                content = content.replace("%STOCKDATA%", csv_str)
            else:
                content = content.replace("%STOCKDATA%", "No Data Available")
        
        return content

    def _automate_gemini_single(self, driver, symbol, prompt):
        """
        Logic adapted from gemini_automation.py automate_deep_research
        """
        try:
            # Go to Gemini
            driver.get("https://gemini.google.com/?hl=ja")
            # Wait for load
            time.sleep(3)

            # Check if login required? Assuming logged in since utilizing existing chrome.

            # "Tools" button check
            # Logic from original script
            
            # --- Original Script Logic Adaptation ---
            # 1. Tools Button
            # 2. Deep Research Button
            # 3. Input Prompt
            # 4. Send
            # 5. Start Research
            # 6. Wait for Export
            
            wait = WebDriverWait(driver, 10) # 10s wait for interactive elements

            # Open Tools
            self.log("Clicking Tools...")
            try:
                tools_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'ツール')]")))
                tools_btn.click()
            except Exception as e:
                # Retry logic or maybe tools already open? 
                # Or dialog blocking.
                self.log(f"Tools button error: {e}")
                # Try handling "Don't use" dialog if present (from original script)
                try:
                    dont_use = driver.find_element(By.XPATH, "//button[contains(., '利用しない')]")
                    if dont_use.is_displayed():
                        dont_use.click()
                        time.sleep(1)
                        # Retry tools
                        driver.find_element(By.XPATH, "//button[contains(., 'ツール')]").click()
                except:
                    pass

            time.sleep(1)

            # Check Deep Research Toggle
            self.log("Clicking Deep Research...")
            try:
                deep_res_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Deep Research')]")))
                deep_res_btn.click()
            except Exception as e:
                self.log(f"Deep Research button error: {e}")
                return False

            time.sleep(1)

            # Input Prompt
            self.log("Inputting prompt...")
            # Use execute script to set text for contenteditable/custom inputs usually safer
            input_area = wait.until(EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'new-input-ui')]")))
            driver.execute_script("arguments[0].innerText = arguments[1]", input_area, prompt)
            time.sleep(1)

            # Send
            self.log("Sending prompt...")
            send_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(@aria-label, 'プロンプトを送信')]")))
            send_btn.click()
            
            time.sleep(5)

            # Start Research Confirmation Button
            self.log("Waiting for Start Research button...")
            start_res_btn = WebDriverWait(driver, 600).until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'リサーチを開始')]")))
            # Click via JS often better for overlay issues
            driver.execute_script("arguments[0].click();", start_res_btn)
            
            self.log("Research started. Waiting for completion (approx 5-20m)...")
            
            # Wait for Export Button (Completion signal)
            # Long timeout
            export_wait = WebDriverWait(driver, 1200) # 20 mins
            
            export_btn = export_wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'エクスポート')]")))
            driver.execute_script("arguments[0].click();", export_btn)
            self.log("Export button clicked.")
            
            time.sleep(1)
            
            # Export to Docs
            # Export to Docs
            docs_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Google ドキュメントにエクスポート')]")))
            
            # Capture handles BEFORE clicking
            current_handles = driver.window_handles
            
            driver.execute_script("arguments[0].click();", docs_btn)
            self.log("Exported to Google Docs. Waiting for new tab...")
            
            doc_title = ""
            try:
                # Wait until new handle appears
                WebDriverWait(driver, 20).until(lambda d: len(d.window_handles) > len(current_handles)) # Reduced timeout
                
                new_handles = driver.window_handles
                new_tab = [h for h in new_handles if h not in current_handles][0]
                
                # Switch to new tab to get title
                driver.switch_to.window(new_tab)
                # Wait for title to load
                WebDriverWait(driver, 30).until(lambda d: "Google Docs" in d.title or "Google ドキュメント" in d.title)
                
                doc_title_full = driver.title
                self.log(f"Opened Google Doc: {doc_title_full}")
                
                # Clean title: "Analysis of XXX - Google Docs" -> "Analysis of XXX"
                doc_title = doc_title_full.replace(" - Google Docs", "").replace(" - Google ドキュメント", "").strip()
                
                # Close tab and return
                driver.close()
                driver.switch_to.window(current_handles[0])
            except Exception as e:
                self.log("Tab did not open or timed out. Attempting to find latest file in Drive directly.")
                # Fallback: We will search for ANY new gdoc in root later.
                doc_title = None # Signal to use fallback search
            
            # Attempt to DETERMINE RATING from Chat Content
            # Get the last message or full text.
            # Assuming the response is in a standard Gemini response container.
            # This is heuristic.
            rating_prefix = ""
            try:
                # Get all text from the chat? Or just try to find specific phrases in the page source.
                # `driver.page_source` is easiest.
                page_source = driver.page_source
                
                # Check keywords
                # Priority: 
                # ◎: Strong Buy, 強い買い
                # 〇: Buy, 買い (Need to be careful not to match simple context)
                # △: Promising but overbought, 有望だが, overbought, wait for dip
                # ×: Sell, Avoid, 売り
                
                # Regex might be safer
                import re
                
                # Ideally, we look at the LAST response block.
                # But source scanning is okay for now if unique enough.
                
                if "強い買い" in page_source or "Strong Buy" in page_source:
                    rating_prefix = "◎ "
                elif "買い" in page_source or "Buy" in page_source: # "買い推奨" etc.
                    # Exclude "強い買い" which is already handled
                    rating_prefix = "〇 "
                elif "有望" in page_source or "過熱感" in page_source or "様子見" in page_source or "Wait" in page_source:
                    rating_prefix = "△ "
                elif "売り" in page_source or "Sell" in page_source or "避ける" in page_source:
                    rating_prefix = "× "
                else:
                    # Default if undetermined
                    rating_prefix = ""
                
                self.log(f"Determined Rating Prefix: '{rating_prefix}'")
                
            except Exception as e:
                self.log(f"Failed to determine rating: {e}")

            # Move File and Link
            try:
                new_path = self._move_created_doc(doc_title, symbol, rating_prefix)
                if new_path:
                    self.log(f"File moved to: {new_path}")
                    # Update DB
                    with Session(engine) as session:
                        stock = session.exec(select(Stock).where(Stock.symbol == symbol)).first()
                        if stock:
                            stock.analysis_file_path = new_path
                            stock.analysis_linked_at = datetime.utcnow()
                            session.add(stock)
                            session.commit()
                            self.log("Database updated with new file path.")
            except Exception as e:
                self.log(f"Failed to move/link file: {e}")

            time.sleep(5)
            return True

        except Exception as e:
            self.log(f"Automation Error: {e}")
            try:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                # Save to backend/debug_screenshots relative to where app runs (usually root/investment_app)
                # We used run_command to create investment_app/backend/debug_screenshots, but need to be careful with path
                screenshot_path = os.path.abspath(f"backend/debug_screenshots/error_{symbol}_{timestamp}.png")
                driver.save_screenshot(screenshot_path)
                self.log(f"Saved error screenshot to: {screenshot_path}")
            except Exception as se:
                self.log(f"Failed to save screenshot: {se}")
            return False

    def _move_created_doc(self, doc_title: Optional[str], symbol: str, prefix: str) -> Optional[str]:
        """
        Locate the file in My Drive (Root) and move to target folder with new name.
        If doc_title is None, search for the most recently modified .gdoc file in root.
        """
        import shutil
        import glob
        
        # Root Dir (Where new GDocs appear)
        root_dir = r"G:\マイドライブ"
        target_dir = r"G:\マイドライブ\分析レポート"
        
        if not os.path.exists(root_dir) or not os.path.exists(target_dir):
            self.log(f"Drive paths not found. Root: {os.path.exists(root_dir)}, Target: {os.path.exists(target_dir)}")
            return None
            
        found_file = None

        if doc_title:
            # Exact/Prefix match strategy
            safe_title = doc_title.replace("/", "_").replace(":", "_")
            self.log(f"Searching for file with title: {safe_title}")
            
            for i in range(20): # Verify for 60s
                candidates = glob.glob(os.path.join(root_dir, f"{safe_title}*.gdoc"))
                if not candidates:
                    candidates = glob.glob(os.path.join(root_dir, f"{safe_title}*"))
                    
                if candidates:
                    found_file = candidates[0]
                    break
                
                time.sleep(3)
        else:
            # FALLBACK: Find latest .gdoc file modified in key duration
            self.log("Searching for latest .gdoc file in Root...")
            for i in range(20): # Try for 60s
                # Get all gdoc files
                all_gdocs = glob.glob(os.path.join(root_dir, "*.gdoc"))
                if not all_gdocs:
                    time.sleep(3)
                    continue
                
                # Sort by modification time (descending)
                all_gdocs.sort(key=os.path.getmtime, reverse=True)
                
                latest = all_gdocs[0]
                mtime = os.path.getmtime(latest)
                # If modified within last 3 minutes
                if (time.time() - mtime) < 180:
                    found_file = latest
                    self.log(f"Found latest file: {found_file}")
                    break
                
                time.sleep(3)

        if not found_file:
            self.log("File not found after wait.")
            return None
            
        # Prepare Destination
        date_str = datetime.now().strftime("%Y-%m-%d")
        new_filename = f"{prefix}Deep Research - {symbol} ({date_str}).gdoc"
        new_filename = new_filename.replace("/", "_").replace(":", "_")
        
        dest_path = os.path.join(target_dir, new_filename)
        
        # Move
        self.log(f"Moving {found_file} to {dest_path}")
        try:
            shutil.move(found_file, dest_path)
            return dest_path
        except Exception as e:
            self.log(f"Error moving file: {e}")
            return None

automation_service = GeminiAutomationService()
