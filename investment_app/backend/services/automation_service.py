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
            docs_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Google ドキュメントにエクスポート')]")))
            driver.execute_script("arguments[0].click();", docs_btn)
            self.log("Exported to Google Docs.")
            
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

automation_service = GeminiAutomationService()
