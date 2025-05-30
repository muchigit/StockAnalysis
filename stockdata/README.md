# StockData Library

A Python library to fetch and process stock market data using the `yfinance` package. This library allows you to retrieve historical stock prices, company information, and calculate common technical indicators like moving averages.

## Installation

To use this library, you can install it directly or install its dependencies.

1.  **Clone the repository (if you haven't already):**
    ```bash
    git clone <your_repository_url_here> # Replace with the actual URL
    cd stockdata 
    ```

2.  **Install dependencies:**
    You can install the required packages using the `requirements.txt` file:
    ```bash
    pip install -r requirements.txt
    ```
    Alternatively, if you want to install the package itself (e.g., to make it importable from elsewhere), you can run:
    ```bash
    pip install .
    ```

This will install `yfinance`, `pandas`, and other necessary libraries.

## Basic Usage

The core of this library is the `StockData` class, found in `stockdata.stockdata`.

### Initialization

First, import and initialize the `StockData` class. You can optionally provide a `start_date` for historical data. If no `start_date` is provided, it defaults to two years prior to the current date.

```python
from stockdata.stockdata import StockData
from datetime import datetime

# Initialize with default start date (2 years ago)
sd = StockData()

# Or, initialize with a specific start date
start_date_str = "2020-01-01"
start_date_obj = datetime.strptime(start_date_str, "%Y-%m-%d").date()
sd_custom_start = StockData(start_date=start_date_obj)
```

### Fetching Historical Stock Data

Use the `get_stock_data(symbol, asc=True)` method to retrieve historical market data for a stock.

-   `symbol` (str): The stock ticker symbol (e.g., "AAPL", "MSFT").
-   `asc` (bool, optional): Determines the sort order of the data. Defaults to `True` (ascending by date). If `False`, data is returned in descending order.

The method returns a Pandas DataFrame containing:
-   Date (as index)
-   Open
-   High
-   Low
-   Close
-   Adj Close
-   Volume
-   Calculated moving averages:
    -   `Close_MA20` (20-day moving average of Close price)
    -   `Close_MA50` (50-day moving average of Close price)
    -   `Close_MA200` (200-day moving average of Close price)
    -   `Volume_MA50` (50-day moving average of Volume)
    -   `Volume_MA200` (200-day moving average of Volume)

All numerical data in the DataFrame is rounded to two decimal places. If no data is found for the symbol, an empty DataFrame is returned.

```python
# Get data for Apple (AAPL)
aapl_data = sd.get_stock_data("AAPL")
print(aapl_data.head())

# Get data for Microsoft (MSFT) in descending order
msft_data_desc = sd.get_stock_data("MSFT", asc=False)
print(msft_data_desc.head())
```

### Fetching Company Information

Use the `get_stock_info(symbol)` method to get general information about a company.

-   `symbol` (str): The stock ticker symbol.

This method returns a dictionary containing various details about the company (e.g., sector, industry, summary, website). The content can vary depending on the data available from yfinance.

```python
aapl_info = sd.get_stock_info("AAPL")
if aapl_info:
    print(f"Company Name: {aapl_info.get('longName')}")
    print(f"Sector: {aapl_info.get('sector')}")
    print(f"Website: {aapl_info.get('website')}")
else:
    print("Could not retrieve info for AAPL.")
```

### Listing Fetched Symbols

Use the `get_symbol_list()` method to get a list of all ticker symbols for which data has been successfully fetched and cached within the `StockData` instance.

```python
# After fetching data for AAPL and MSFT
symbols_fetched = sd.get_symbol_list()
print(f"Data has been fetched for: {symbols_fetched}") # Expected: ['AAPL', 'MSFT'] (or similar)
```

## Example

Here's a simple example demonstrating how to use the `StockData` library:

```python
from stockdata.stockdata import StockData
from datetime import datetime

# Initialize StockData
# Using a specific start date for this example
start_date = datetime.strptime("2022-01-01", "%Y-%m-%d").date()
stock_handler = StockData(start_date=start_date)

# Define a list of stock symbols to process
symbols = ["GOOGL", "TSLA"]

# Fetch and display data for each symbol
for symbol in symbols:
    print(f"--- {symbol} ---")

    # Get company information
    info = stock_handler.get_stock_info(symbol)
    if info:
        print(f"Name: {info.get('shortName', 'N/A')}")
        print(f"Sector: {info.get('sector', 'N/A')}")
    else:
        print(f"Could not retrieve information for {symbol}.")

    # Get historical stock data
    data = stock_handler.get_stock_data(symbol, asc=False) # Get data in descending order
    if not data.empty:
        print("Recent stock data (last 5 days):")
        print(data.head())
        print(f"Data columns: {data.columns.tolist()}")
    else:
        print(f"No historical data found for {symbol}.")
    print("\n")

# List all symbols for which data was fetched
print(f"Successfully fetched data for symbols: {stock_handler.get_symbol_list()}")

```

This example initializes `StockData`, fetches information and recent historical data for Google (GOOGL) and Tesla (TSLA), and then prints the list of symbols processed.

## Dependencies

This library primarily relies on the following Python packages:

-   **yfinance**: Used to fetch stock market data from Yahoo! Finance.
-   **pandas**: Used for data manipulation and analysis, particularly for handling the historical stock data in DataFrames.

These dependencies are listed in `requirements.txt` and will be installed automatically if you use `pip install -r requirements.txt` or `pip install .`.
