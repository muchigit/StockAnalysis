import pickle
import time
import os
import logging
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, StaleElementReferenceException, ElementClickInterceptedException
import undetected_chromedriver as uc

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
COOKIE_FILE_PATH = r"C:\Users\uchida\GeminiAutomation\google_cookies.pkl"
SCREENSHOT_DIR = r"C:\Users\uchida\GeminiAutomation\screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

import subprocess
from selenium import webdriver

class GeminiService:
    def __init__(self):
        self.driver = None

    def _setup_driver(self):
        try:
            # Assume Chrome is already launched manually on port 9222
            logger.info("Connecting to existing Chrome on port 9222...")
            
            options = webdriver.ChromeOptions()
            options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
            
            logger.info("Attempting to connect Selenium to debuggerAddress 127.0.0.1:9222")
            # Use standard Selenium, not uc, for attaching to existing debugger
            driver = webdriver.Chrome(options=options)
            logger.info("Selenium connected successfully.")
            return driver
            
        except Exception as e:
            logger.error(f"Failed to setup driver: {e}", exc_info=True)
            return None

    def analyze_stock(self, symbol: str, prompt: str):
        """
        Run Gemini Deep Research for the symbol.
        Returns the result text or status.
        """
        driver = self._setup_driver()
        if not driver:
            return "Failed to initialize driver (Cookie error?)"
        
        result_text = "Analysis Failed"
        
        try:
            # 1. Reset State
            driver.get("https://gemini.google.com/?hl=ja")
            time.sleep(3)
            
            # Check Login
            try:
                WebDriverWait(driver, 5).until(EC.element_to_be_clickable((By.XPATH, "//a[contains(@aria-label, 'ログイン')]")))
                logger.error("Not logged in.")
                return "Error: Not logged in. Check cookies."
            except TimeoutException:
                pass

            # 2. Click Tools (retry logic from original)
            self._click_tools(driver)
            
            # 3. Click Deep Research
            self._click_deep_research(driver)

            # 4. Input Prompt
            self._input_prompt(driver, prompt)

            # 5. Send
            self._click_send(driver)
            
            # 6. Start Research (wait for button if it appears, Deep Research specific)
            self._click_start_research(driver)

            # 7. Wait for Completion
            logger.info(f"Waiting for research result for {symbol}...")
            # Wait for "Show Report" or similar, or just wait for text generation?
            # Original script waited for "Export" button.
            if self._wait_for_completion(driver):
                 result_text = self._scrape_response(driver)
            else:
                 result_text = "Research Timed Out"

        except Exception as e:
            logger.error(f"Error during analysis: {e}")
            result_text = f"Error: {str(e)}"
            try:
                driver.save_screenshot(os.path.join(SCREENSHOT_DIR, f"error_{symbol}.png"))
            except:
                pass
        finally:
            # Do NOT quit driver as it closes the persistent browser instance
            # driver.quit()
            pass
            
        return result_text

    def _click_tools(self, driver):
        deep_research_button_xpath = "//button[contains(., 'ツール')]"
        WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, deep_research_button_xpath))).click()
        logger.info("Clicked Tools")

    def _click_deep_research(self, driver):
        xpath = "//button[contains(., 'Deep Research')]"
        WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, xpath))).click()
        logger.info("Clicked Deep Research")

    def _input_prompt(self, driver, text):
        xpath = "//div[contains(@class, 'new-input-ui')]" # As per original script, class check might change
        # Original: "//div[contains(@class, 'new-input-ui')]"
        # Note: Gemini UI changes often.
        el = WebDriverWait(driver, 10).until(EC.visibility_of_element_located((By.XPATH, xpath)))
        driver.execute_script("arguments[0].innerText = arguments[1]", el, text)
        logger.info("Input prompt")

    def _click_send(self, driver):
        xpath = "//button[contains(@aria-label, 'プロンプトを送信')]"
        WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, xpath))).click()
        time.sleep(2)
        logger.info("Sent prompt")

    def _click_start_research(self, driver):
        # Checks for "リサーチを開始" button
        xpath = "//button[contains(., 'リサーチを開始')]"
        try:
            btn = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, xpath)))
            driver.execute_script("arguments[0].click();", btn)
            logger.info("Started Research")
        except TimeoutException:
            logger.info("Start Research button not found (maybe auto-started?)")

    def _wait_for_completion(self, driver):
        # Wait for "Export" button or similar indicating completion
        # Original used: "//button[contains(., 'エクスポート')]"
        xpath = "//button[contains(., 'エクスポート')]"
        try:
            WebDriverWait(driver, 1200).until(EC.element_to_be_clickable((By.XPATH, xpath))) # 20 mins
            logger.info("Research completed")
            return True
        except TimeoutException:
            return False

    def generate_content(self, prompt: str) -> str:
        """
        Generate content using Gemini (standard chat).
        Returns the generated text.
        """
        driver = self._setup_driver()
        if not driver:
            return "Error: Driver setup failed"
        
        result_text = ""
        try:
             # 1. Reset
             driver.get("https://gemini.google.com/?hl=ja")
             time.sleep(3)

             # 2. Input
             self._input_prompt(driver, prompt)

             # 3. Send
             self._click_send(driver)
             
             # 4. Wait for completion
             logger.info("Waiting for generation to complete...")
             # Wait for the Send button to become clickable again (indicates generation finished)
             send_button_xpath = "//button[contains(@aria-label, 'プロンプトを送信')]"
             WebDriverWait(driver, 120).until(
                 EC.element_to_be_clickable((By.XPATH, send_button_xpath))
             )
             
             # Small buffer to ensure text is fully rendered/stable
             time.sleep(2) 
             
             # Scan for the last response
             result_text = self._scrape_latest_response(driver)
             
        except Exception as e:
            logger.error(f"Generation error: {e}")
            result_text = f"Error: {e}"
        finally:
             # Do NOT quit driver as it closes the persistent browser instance
             # driver.quit()
             pass
            
        return result_text

    def _scrape_latest_response(self, driver):
        try:
            # Common selector for Gemini responses (may change)
            # Strategy: Get all elements that look like message text
            # Usually they are inside <message-content> or have specific attributes
            # We'll try to get all text from the main scrollable area, filtering out user prompts
            
            # Selector for the model response text container. This is tricky without live inspection.
            # Assuming 'model-response-text' or similar class is not consistent.
            # However, usually there are valid block elements.
            
            # Let's try grabbing all 'p', 'li', 'pre' in the chat history container
            # But we only want the LAST message.
            
            # Alternative: text of the last element with 'data-test-id="model-response"'?
            # Or just return everything after the last user prompt?
            
            # Simple fallback: Get full page text and try to extract? No.
            
            # Attempt 1: Selenium finding generic message blocks
            # This selector represents the response text container in some versions
            responses = driver.find_elements(By.CSS_SELECTOR, ".model-response-text") 
            if not responses:
                 # Fallback
                 return "Error: Could not locate response text in DOM."
                 
            return responses[-1].text
        except Exception as e:
            return f"Scraping error: {e}"

    def _scrape_response(self, driver):
        return self._scrape_latest_response(driver)

gemini_service = GeminiService()
