# This file will contain the main logic for retrieving SEC filer information.
import requests
from sec_cik_mapper import StockMapper # Use StockMapper
import json # Import for json.JSONDecodeError
from datetime import datetime, date # Added for date operations

_SEC_TICKER_CACHE = {}

def get_cik(ticker_symbol: str) -> str | None:
    """
    Converts a ticker symbol to a 10-digit CIK string.
    First tries sec-cik-mapper, then falls back to fetching ticker.txt from SEC.

    Args:
        ticker_symbol: The stock ticker symbol.

    Returns:
        A 10-digit CIK string (e.g., "0000123456") or None if not found.
    """
    if not isinstance(ticker_symbol, str) or not ticker_symbol:
        return None
    
    # 1. Try sec-cik-mapper
    try:
        mapper = StockMapper()
        cik_map = mapper.ticker_to_cik({ticker_symbol: ticker_symbol})
        
        if cik_map and ticker_symbol in cik_map:
            return str(cik_map[ticker_symbol]).zfill(10)
    except Exception:
        pass

    # 2. Fallback: Fetch from SEC ticker.txt directly
    # This handles recent IPOs or tickers missing from the mapper's cache
    global _SEC_TICKER_CACHE
    if not _SEC_TICKER_CACHE:
        try:
            url = "https://www.sec.gov/include/ticker.txt"
            headers = {"User-Agent": "admin@example.com"} # Generic UA for public list
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                for line in resp.text.splitlines():
                    parts = line.split()
                    if len(parts) >= 2:
                        sym = parts[0].upper() # ticker.txt is lowercase
                        cik = parts[1]
                        _SEC_TICKER_CACHE[sym] = cik
        except Exception:
            return None

    # Check cache
    normalized_ticker = ticker_symbol.upper()
    if normalized_ticker in _SEC_TICKER_CACHE:
        return str(_SEC_TICKER_CACHE[normalized_ticker]).zfill(10)

    return None

def get_sec_data(cik_code: str, user_agent_email: str) -> dict | None:
    """
    Fetches JSON data from the SEC for a given CIK code.

    Args:
        cik_code: A 10-digit CIK string (e.g., "0000123456").
        user_agent_email: Your email address for the User-Agent header.

    Returns:
        A Python dictionary parsed from the JSON response or None if an error occurs.
    """
    if not isinstance(cik_code, str) or not len(cik_code) == 10 or not cik_code.isdigit():
        return None
    if not isinstance(user_agent_email, str) or not user_agent_email: # Check for empty string
        return None

    sec_url = f"https://data.sec.gov/submissions/CIK{cik_code}.json"
    headers = {
        "User-Agent": f"{user_agent_email}" # User agent should be just the email as per SEC requirements
    }

    try:
        response = requests.get(sec_url, headers=headers, timeout=10) 
        if response.status_code == 200:
            try:
                return response.json()
            except json.JSONDecodeError: 
                return None
            except requests.exceptions.JSONDecodeError: 
                return None
        else:
            return None
    except requests.exceptions.RequestException:
        return None

def get_latest_filing_date(sec_data: dict, target_date_str: str, form_types: list[str] = ['10-K', '10-Q']) -> str | None:
    """
    Finds the latest filing date for specified form types on or before a target date.

    Args:
        sec_data: Parsed JSON dictionary from get_sec_data.
        target_date_str: Target date string in "YYYY-MM-DD" format.
        form_types: List of form types to consider (e.g., ['10-K', '10-Q']).

    Returns:
        The latest filing date as "YYYY-MM-DD" string, or None if not found or error.
    """
    if not isinstance(sec_data, dict):
        return None
    if not isinstance(target_date_str, str):
        return None
    if not isinstance(form_types, list) or not all(isinstance(ft, str) for ft in form_types):
        return None

    try:
        target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
    except ValueError:
        return None # Invalid target_date_str format

    filings_data = sec_data.get('filings', {}).get('recent', {})
    if not filings_data:
        return None

    filing_dates_list = filings_data.get('filingDate')
    forms_list = filings_data.get('form')

    if not isinstance(filing_dates_list, list) or not isinstance(forms_list, list):
        return None
    if not filing_dates_list or not forms_list: # Check for empty lists
        return None
    if len(filing_dates_list) != len(forms_list):
        return None # Data inconsistency

    latest_found_date_obj = None

    for i in range(len(filing_dates_list)):
        current_filing_date_str = filing_dates_list[i]
        current_filing_form = forms_list[i]

        if not isinstance(current_filing_date_str, str) or not isinstance(current_filing_form, str):
            continue # Skip if data types are not strings

        try:
            current_filing_date_obj = datetime.strptime(current_filing_date_str, "%Y-%m-%d").date()
        except ValueError:
            continue # Skip this filing if its date is malformed
        
        if current_filing_form in form_types and current_filing_date_obj <= target_date:
            if latest_found_date_obj is None or current_filing_date_obj > latest_found_date_obj:
                latest_found_date_obj = current_filing_date_obj
    
    if latest_found_date_obj:
        return latest_found_date_obj.strftime("%Y-%m-%d")
    
    return None

class SecFilerRetriever:
    def __init__(self, user_agent_email: str):
        """
        Initializes the SecFilerRetriever.

        Args:
            user_agent_email: Your email address or company name for the User-Agent header.
                              SEC requests require a User-Agent.
        
        Raises:
            ValueError: If user_agent_email is not a non-empty string.
        """
        if not isinstance(user_agent_email, str) or not user_agent_email:
            raise ValueError("user_agent_email must be a non-empty string.")
        self.user_agent_email = user_agent_email

    def get_most_recent_filing(self, ticker_symbol: str, date_str: str) -> str | None:
        """
        Retrieves the most recent filing date for a given ticker and target date.

        Args:
            ticker_symbol: The stock ticker symbol.
            date_str: The target date string in "YYYY-MM-DD" format.

        Returns:
            The most recent filing date as "YYYY-MM-DD" string, or None if any step fails.
        """
        cik = get_cik(ticker_symbol)
        if cik is None:
            return None

        sec_data = get_sec_data(cik, self.user_agent_email)
        if sec_data is None:
            return None

        latest_filing_date = get_latest_filing_date(sec_data, date_str)
        return latest_filing_date

if __name__ == '__main__':
    # Example Usage for standalone functions (can be kept for direct testing)
    print("--- Testing standalone functions ---")
    # ... (previous tests for get_cik, get_sec_data, get_latest_filing_date can be here)
    # For brevity, I'll focus on the new class tests below, but it's good to keep old tests.
    
    aapl_cik_for_direct_test = get_cik("AAPL")
    email_for_direct_test = "test_direct@example.com"
    aapl_data_for_direct_test = None
    if aapl_cik_for_direct_test:
        aapl_data_for_direct_test = get_sec_data(aapl_cik_for_direct_test, email_for_direct_test)
    # if aapl_data_for_direct_test:
    #     print(f"Direct test - latest filing for AAPL by 2023-10-01: {get_latest_filing_date(aapl_data_for_direct_test, '2023-10-01')}")


    print("\n--- Testing SecFilerRetriever Class ---")
    my_email = "test@example.com"
    try:
        retriever = SecFilerRetriever(my_email)
        print(f"Successfully instantiated SecFilerRetriever with email: {my_email}")

        # Test Case 1: Successful retrieval (e.g., AAPL)
        # Assuming AAPL data is available and has 10-K/10-Q filings
        # Use a recent date that is likely to have filings before it.
        # For AAPL, their fiscal year ends in Sept. A 10-K is usually filed in Oct.
        target_date_aapl = "2023-12-31" 
        print(f"\nTesting get_most_recent_filing for AAPL, target date: {target_date_aapl}")
        aapl_filing_date = retriever.get_most_recent_filing("AAPL", target_date_aapl)
        if aapl_filing_date:
            print(f"AAPL - Most recent filing date on or before {target_date_aapl}: {aapl_filing_date}")
        else:
            print(f"AAPL - Could not retrieve filing date (CIK: {get_cik('AAPL')}, Data: {'OK' if get_sec_data(get_cik('AAPL'), my_email) else 'Fail'})")

        # Test Case 2: Ticker not found
        invalid_ticker = "INVALIDTICKERXYZ"
        print(f"\nTesting get_most_recent_filing for non-existent ticker: {invalid_ticker}")
        invalid_ticker_filing_date = retriever.get_most_recent_filing(invalid_ticker, "2023-10-01")
        if invalid_ticker_filing_date is None:
            print(f"Correctly returned None for invalid ticker: {invalid_ticker}")
        else:
            print(f"Incorrectly got a result for invalid ticker: {invalid_ticker_filing_date}")

        # Test Case 3: Error fetching SEC data (e.g., if get_sec_data was forced to fail for a valid CIK)
        # This is harder to test directly without mocking, as a valid CIK from get_cik should ideally work.
        # We can simulate it if get_cik returns a CIK that data.sec.gov doesn't have (rare for known tickers)
        # Or, if the user_agent_email was somehow problematic for the SEC API (also rare if format is okay)
        # For now, this scenario relies on the robustness of get_sec_data's error handling.
        # A CIK that exists but has no submission data might be "0000000000", which get_sec_data handles.
        print(f"\nTesting get_most_recent_filing for CIK with no data: 0000000000 (simulated by using a ticker that maps to it, if any, or direct call)")
        # We can't directly make get_cik return "0000000000" for a normal ticker.
        # This test case demonstrates the flow if get_sec_data returns None.
        # To truly test this part of get_most_recent_filing, we'd mock get_sec_data or find a ticker that maps to a CIK known to cause issues.
        # Manually testing the path:
        if get_cik("AAPL"): # Ensure AAPL CIK exists
            original_get_sec_data = get_sec_data # Save original
            def mock_get_sec_data_returns_none(cik, email): return None
            globals()['get_sec_data'] = mock_get_sec_data_returns_none # Monkey patch
            
            print("Mocking get_sec_data to return None for AAPL...")
            aapl_filing_date_mocked = retriever.get_most_recent_filing("AAPL", target_date_aapl)
            if aapl_filing_date_mocked is None:
                print("Correctly returned None when get_sec_data is mocked to fail.")
            else:
                print(f"Incorrectly got a result when get_sec_data was mocked: {aapl_filing_date_mocked}")
            globals()['get_sec_data'] = original_get_sec_data # Restore original
        else:
            print("Skipping get_sec_data mock test as AAPL CIK couldn't be retrieved.")


        # Test Case 4: No suitable filings found (e.g., date too old, or specific form types not present)
        print(f"\nTesting get_most_recent_filing for AAPL with a very old date: 1990-01-01")
        old_date_filing = retriever.get_most_recent_filing("AAPL", "1990-01-01")
        if old_date_filing is None:
            print(f"Correctly returned None for AAPL with target date 1990-01-01 (no filings found).")
        else:
            print(f"AAPL - Most recent filing date on or before 1990-01-01: {old_date_filing} (unexpected, check data).")

    except ValueError as e:
        print(f"Error during SecFilerRetriever instantiation: {e}")

    # Test Case 5: Invalid user_agent_email during instantiation
    print("\nTesting SecFilerRetriever instantiation with invalid emails:")
    invalid_emails = ["", None, 123]
    for inv_email in invalid_emails:
        try:
            retriever_fail = SecFilerRetriever(inv_email) # type: ignore
            print(f"Incorrectly instantiated with invalid email: {inv_email}")
        except ValueError as e:
            print(f"Correctly raised ValueError for invalid email '{inv_email}': {e}")
        except TypeError as e: # Handles None not being a string
             print(f"Correctly raised TypeError for invalid email '{inv_email}': {e}")

    print("\n--- End of SecFilerRetriever Class Tests ---")
