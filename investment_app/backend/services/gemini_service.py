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

class GeminiService:
    def __init__(self):
        self.driver = None

    def _setup_driver(self):
        options = uc.ChromeOptions()
        options.add_argument("--lang=ja-JP")
        options.add_experimental_option('prefs', {'intl.accept_languages': 'ja,en-US,en'})
        # Headless might be detected, stick to headful for now as per original script
        options.add_argument('--window-size=1920,1080')
        
        driver = uc.Chrome(options=options)
        
        # Load cookies
        driver.get("https://gemini.google.com/?hl=ja")
        try:
            with open(COOKIE_FILE_PATH, 'rb') as f:
                cookies = pickle.load(f)
            for cookie in cookies:
                if 'expiry' in cookie and isinstance(cookie['expiry'], float):
                    cookie['expiry'] = int(cookie['expiry'])
                try:
                    driver.add_cookie(cookie)
                except Exception as e:
                    # Ignore invalid domain cookies
                    pass
            logger.info("Cookies loaded.")
            driver.get("https://gemini.google.com/?hl=ja")
            time.sleep(5)
        except Exception as e:
            logger.error(f"Cookie load failed: {e}")
            driver.quit()
            return None
            
        return driver

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
            driver.save_screenshot(os.path.join(SCREENSHOT_DIR, f"error_{symbol}.png"))
        finally:
            driver.quit()
            
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

    def _scrape_response(self, driver):
        # Try to get the last message text
        # Generic selector for message content.
        # This is fragile.
        try:
            # Attempt to find the last markdown container
            msgs = driver.find_elements(By.CSS_SECTO, ".message-content") # Hypothetical class
            # Better: use body text or look for specific container
            # Fallback: "Research Completed. Please check Gemini history."
            return "Research Completed (Text scraping not fully implemented due to dynamic UI). Please check Gemini History."
        except:
            return "Research Completed."

gemini_service = GeminiService()
