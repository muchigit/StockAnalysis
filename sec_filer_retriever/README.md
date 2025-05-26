# sec-filer-retriever

## Description
A Python package to retrieve the latest SEC 10-K or 10-Q filing date for a given ticker symbol and reference date.

## Features
*   Converts US ticker symbols to SEC CIK codes.
*   Fetches company submission data directly from the SEC's EDGAR database.
*   Identifies the most recent 10-K or 10-Q filing date prior to or on a specified date.
*   Requires a user-provided email for SEC API `User-Agent` compliance (e.g., "Your Name your.email@example.com" or "Sample Company Name admin@example.com").

## Installation
You can install the package locally from the root directory of the project:
```bash
pip install .
```
This package depends on the following libraries:
*   `sec-cik-mapper`
*   `requests`

These will be automatically installed when you install `sec-filer-retriever`.

## Usage
Here's how to import and use the `SecFilerRetriever` class:

```python
from sec_filer_retriever import SecFilerRetriever

# Initialize with your email for SEC User-Agent
# The SEC requires a User-Agent for requests, e.g., "Sample Company Name contact@example.com"
try:
    retriever = SecFilerRetriever(user_agent_email="sampleuser@example.com")

    ticker = "AAPL"
    date_str = "2023-10-01" # Target date: YYYY-MM-DD

    latest_filing_date = retriever.get_most_recent_filing(ticker, date_str)

    if latest_filing_date:
        print(f"The latest 10-K or 10-Q filing for {ticker} before or on {date_str} was on: {latest_filing_date}")
    else:
        print(f"No 10-K or 10-Q filing found for {ticker} before or on {date_str}.")

    # Example with a ticker that might not exist or have recent filings
    ticker_2 = "NONEXISTENTTICKERXYZ" # Made it more unique
    date_str_2 = "2023-01-01"
    latest_filing_date_2 = retriever.get_most_recent_filing(ticker_2, date_str_2)
    if latest_filing_date_2:
        print(f"The latest 10-K or 10-Q filing for {ticker_2} before or on {date_str_2} was on: {latest_filing_date_2}")
    else:
        print(f"No 10-K or 10-Q filing found for {ticker_2} before or on {date_str_2}.")

except ValueError as e:
    print(f"Initialization Error: {e}") # Error from SecFilerRetriever constructor
except Exception as e:
    print(f"An unexpected error occurred: {e}")

```

## Input
The `SecFilerRetriever` class and its main method `get_most_recent_filing` require the following inputs:

*   **`user_agent_email`** (for `SecFilerRetriever` constructor):
    *   Type: `str`
    *   Description: Your email address or company contact information (e.g., "Sample Company Name admin@example.com"). This is required by the SEC for the `User-Agent` header in API requests. Must be a non-empty string.
*   **`ticker_symbol`** (for `get_most_recent_filing` method):
    *   Type: `str`
    *   Description: The US market ticker symbol for the company (e.g., "AAPL" for Apple Inc.).
*   **`date_str`** (for `get_most_recent_filing` method):
    *   Type: `str`
    *   Description: The reference date, in "YYYY-MM-DD" format. The function will search for the latest filing on or before this date.

## Output
*   The `get_most_recent_filing` method returns:
    *   A string representing the most recent filing date (e.g., "2023-10-27") for a 10-K or 10-Q report found on or before the specified input date.
    *   `None` if no such report is found, if the ticker symbol is invalid, if there's an issue fetching data from the SEC, or if any other error occurs during the process.

## Error Handling
*   The main method `get_most_recent_filing(ticker_symbol, date_str)` is designed to return `None` if it encounters issues such as:
    *   An invalid or unrecognized ticker symbol.
    *   Network problems when trying to reach the SEC EDGAR API.
    *   No 10-K or 10-Q filings found for the given ticker on or before the specified date.
    *   Issues parsing the data received from the SEC.
*   The constructor `SecFilerRetriever(user_agent_email)` will raise a `ValueError` if the `user_agent_email` provided is `None` or an empty string.

## License
This project is licensed under the MIT License.
