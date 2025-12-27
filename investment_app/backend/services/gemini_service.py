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
        max_retries = 3
        
        for attempt in range(max_retries):
            try:
                 # 1. Reset
                 driver.get("https://gemini.google.com/?hl=ja")
                 time.sleep(3)
    
                 # 2. Input
                 self._input_prompt(driver, prompt)
    
                 # 3. Send
                 self._click_send(driver)
                 
                 # 5. Wait for completion
                 logger.info(f"Waiting for generation to complete (Attempt {attempt+1}/{max_retries})...")
                 send_button_xpath = "//button[contains(@aria-label, 'プロンプトを送信')]"
                 WebDriverWait(driver, 300).until(
                     EC.element_to_be_clickable((By.XPATH, send_button_xpath))
                 )
                 
                 time.sleep(2) 
                 result_text = self._scrape_latest_response(driver)
                 
                 if "お手伝いできません" in result_text:
                     logger.warning(f"Gemini refused response (Attempt {attempt+1}): {result_text[:50]}...")
                     if attempt < max_retries - 1:
                         time.sleep(2)
                         continue
                     else:
                         result_text = "Error: Gemini refused request (Retry limit reached)."
                 
                 return result_text
                 
            except TimeoutException:
                logger.error("Generation timed out.")
                if attempt < max_retries - 1:
                    continue
                result_text = "Error: Generation timed out (>300s)."
                return result_text
                
            except Exception as e:
                import traceback
                tb = traceback.format_exc()
                logger.error(f"Generation error: {e}\n{tb}")
                
                # Save error log to file for debugging
                try:
                    with open("backend/gemini_error.log", "w", encoding="utf-8") as f:
                        f.write(f"Timestamp: {time.ctime()}\n")
                        f.write(f"Error: {str(e)}\n")
                        f.write(f"Traceback:\n{tb}\n")
                except:
                    pass
                    
                if attempt < max_retries - 1:
                    logger.info("Retrying due to error...")
                    continue

                # Simplify error message for frontend
                result_text = f"Error: {str(e)}"
                return result_text
                
            finally:
                 pass
            
        return result_text

    def _scrape_latest_response(self, driver):
        try:
            # Strategy: Try multiple selectors as Gemini UI updates frequently
            
            # Selector 1: Standard class (often used)
            responses = driver.find_elements(By.CSS_SELECTOR, ".model-response-text")
            if responses:
                return responses[-1].text
            
            # Selector 2: Message Content Tag (Angular/Lit)
            responses = driver.find_elements(By.TAG_NAME, "message-content")
            if responses:
                return responses[-1].text
                
            # Selector 3: Model Response Tag
            responses = driver.find_elements(By.TAG_NAME, "model-response")
            if responses:
                return responses[-1].text

            # Selector 4: Data attribute (more stable)
            responses = driver.find_elements(By.XPATH, "//*[@data-test-id='model-response']")
            if responses:
                return responses[-1].text

            # Selector 5: Markdown Renderer (Common in new UI)
            responses = driver.find_elements(By.CLASS_NAME, "markdown-renderer")
            if responses:
                 return responses[-1].text
            
            # Selector 6: Class containing message-content
            responses = driver.find_elements(By.XPATH, "//*[contains(@class, 'message-content')]")
            if responses:
                return responses[-1].text

            # Generic fallback: Look for any substantial text block after the last user query?
            # Hard to do without identifying user query.
            
            # Debug: Capture body text snippet
            body_text = driver.find_element(By.TAG_NAME, "body").text[:500]
            logger.error(f"Failed to find response. Body start: {body_text}")
            
            return "Error: Could not locate response text in DOM. UI structure may have changed."

        except Exception as e:
            return f"Scraping error: {e}"

    def generate_content_with_image(self, prompt: str, image_path: str) -> str:
        """
        Generate content using Gemini with an image attachment (Multimodal).
        """
        driver = self._setup_driver()
        if not driver:
            return "Error: Driver setup failed"
        
        result_text = ""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                 # 1. Reset
                 driver.get("https://gemini.google.com/?hl=ja")
                 time.sleep(3)
    
                 # 2. Upload Image
                 logger.info(f"Uploading image: {image_path} (Attempt {attempt+1})")
                 try:
                     # 1. Handle Plus Button / Menu
                     # Look for the button that toggles the upload menu
                     # It usually has 'aria-label' containing "ファイルをアップロード" and "メニュー" (Menu)
                     plus_xpath = "//button[contains(@aria-label, 'ファイルをアップロード') and contains(@aria-label, 'メニュー')]"
                     
                     try:
                         plus_btns = driver.find_elements(By.XPATH, plus_xpath)
                         if plus_btns:
                             plus_btn = plus_btns[0]
                             current_label = plus_btn.get_attribute("aria-label") or ""
                             logger.info(f"Found Plus button: {current_label}")
                             
                             if "閉じる" in current_label or "Close" in current_label:
                                 logger.info("Menu appears to be open. Skipping click.")
                             else:
                                 plus_btn.click()
                                 time.sleep(1)
                         else:
                             # Fallback to generic Plus button search if specific label not found
                             logger.warning("Specific Plus button not found, trying generic search.")
                             generic_plus = WebDriverWait(driver, 5).until(EC.element_to_be_clickable((By.XPATH, "//button[.//span[text()='+']]")))
                             generic_plus.click()
                             time.sleep(1)
                     except Exception as e:
                         logger.warning(f"Plus button interaction issue: {e}")
    
                     # 2. Find File Input (Shadow DOM support)
                     # We DO NOT click the "Upload File" menu item button because that opens the native OS dialog.
                     # Instead, we look for the hidden file input that should be present when the menu is active.
                     
                     # Debug: Check where we are
                     logger.info(f"Current Page: {driver.title} ({driver.current_url})")
                     
                     find_input_js = """
                        function findFileInput(root) {
                            if (!root) return null;
                            const input = root.querySelector && root.querySelector("input[type='file']");
                            if (input) return input;
                            if (root.shadowRoot) {
                                const found = findFileInput(root.shadowRoot);
                                if (found) return found;
                            }
                            const children = root.querySelectorAll("*");
                            for (let child of children) {
                                if (child.shadowRoot) {
                                    const found = findFileInput(child.shadowRoot);
                                    if (found) return found;
                                }
                            }
                            return null;
                        }
                        return findFileInput(document.body);
                     """
                     
                     # Poll for the input
                     file_input = None
                     for i in range(5):
                         file_input = driver.execute_script(find_input_js)
                         if file_input:
                             break
                         time.sleep(1)
                     
                     if file_input:
                         file_input.send_keys(image_path)
                         logger.info("Image path sent to file input.")
                     else:
                         # Debug: List ALL inputs to log
                         debug_inputs_js = """
                            function listInputs(root, list = []) {
                                if (!root) return list;
                                const inputs = root.querySelectorAll && root.querySelectorAll("input");
                                if (inputs) {
                                    inputs.forEach(i => list.push(`Type: ${i.type}, ID: ${i.id}, Class: ${i.className}, Visible: ${i.offsetParent !== null}`));
                                }
                                if (root.shadowRoot) {
                                    listInputs(root.shadowRoot, list);
                                }
                                const children = root.querySelectorAll("*");
                                for (let child of children) {
                                    if (child.shadowRoot) {
                                        listInputs(child.shadowRoot, list);
                                    }
                                }
                                return list;
                            }
                            return listInputs(document.body);
                         """
                         found_inputs = driver.execute_script(debug_inputs_js)
                         logger.error(f"Failed to find input[type='file']. Found inputs: {found_inputs}")
                         raise Exception(f"Could not locate input[type='file']. Found {len(found_inputs)} other inputs.")
    
                 except Exception as e:
                     logger.error(f"Upload failed: {e}")
                     # Debug: Save screenshot
                     try:
                        driver.save_screenshot("upload_error_debug.png")
                     except: pass
                     raise e
    
                 # Wait for upload to complete
                 time.sleep(10)
                 
                 # 3. Input Prompt
                 self._input_prompt(driver, prompt)
    
                 # 4. Send
                 self._click_send(driver)
                 
                 # 5. Wait for completion
                 logger.info("Waiting for generation to complete...")
                 send_button_xpath = "//button[contains(@aria-label, 'プロンプトを送信')]"
                 WebDriverWait(driver, 300).until(
                     EC.element_to_be_clickable((By.XPATH, send_button_xpath))
                 )
                 
                 time.sleep(2) 
                 result_text = self._scrape_latest_response(driver)
                 
                 if "お手伝いできません" in result_text:
                     logger.warning(f"Gemini refused response (Attempt {attempt+1}): {result_text[:50]}...")
                     if attempt < max_retries - 1:
                         time.sleep(2)
                         continue
                     else:
                         result_text = "Error: Gemini refused request (Retry limit reached)."
                 
                 return result_text
                 
            except TimeoutException:
                 logger.error("Generation timed out.")
                 if attempt < max_retries - 1:
                     continue
                 result_text = "Error: Generation timed out (>300s)."
                 return result_text
                 
            except Exception as e:
                logger.error(f"Image generation error: {e}")
                if attempt < max_retries - 1:
                    continue
                result_text = f"Error: {str(e)}"
                return result_text
            
        return result_text

    def _scrape_response(self, driver):
        return self._scrape_latest_response(driver)

gemini_service = GeminiService()
