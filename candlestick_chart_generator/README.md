# Candlestick Chart Generator

A Python library to generate candlestick charts with volume and moving averages from Pandas DataFrames. The output is an image object compatible with `openpyxl`, allowing easy embedding of charts into Excel spreadsheets.

## Features

- Generates candlestick charts from OHLC (Open, High, Low, Close) data.
- Displays trading volume.
- Overlays multiple moving averages (Close_MA20, Close_MA50, Close_MA200).
- Returns an image object (`io.BytesIO`) that can be directly used with `openpyxl.drawing.image.Image`.
- Handles DataFrames where the index is sorted with the newest dates first.

## Requirements

- Python 3.7+
- pandas
- matplotlib
- mplfinance
- openpyxl

## Installation

1.  **Clone the repository (if applicable):**
    ```bash
    git clone <your_repository_url_here>
    cd candlestick_chart_generator
    ```

2.  **Install using pip:**
    You can install the package directly from the local directory:
    ```bash
    pip install .
    ```
    Alternatively, if you are managing dependencies for a larger project, you can add it to your `requirements.txt` or `pyproject.toml`.

## Usage

Here's a basic example of how to use the library:

```python
import pandas as pd
from openpyxl import Workbook
from openpyxl.drawing.image import Image as OpenpyxlImage
from candlestick_chart_generator import generate_candlestick_image
import io

# Sample DataFrame (replace with your actual data)
# Ensure your DataFrame has a DatetimeIndex and the required columns
data = {
    'Open': [100, 102, 101, 105, 103, 104, 105, 106, 107, 108],
    'High': [105, 106, 103, 107, 105, 106, 107, 108, 109, 110],
    'Low': [98, 100, 100, 102, 101, 102, 103, 104, 105, 106],
    'Close': [102, 101, 102, 106, 104, 105, 106, 107, 108, 109],
    'Volume': [10000, 12000, 11000, 15000, 13000, 14000, 15000, 16000, 17000, 18000],
    'Close_MA20': [101, 101.5, 101.8, 102.5, 103, 103.5, 104, 104.5, 105, 105.5],
    'Close_MA50': [100, 100.5, 101, 101.5, 102, 102.5, 103, 103.5, 104, 104.5],
    'Close_MA200': [95, 96, 97, 98, 99, 100, 101, 102, 103, 104]
}
# Create a DatetimeIndex, newest first
dates = pd.date_range(end='2023-01-10', periods=10, freq='B')[::-1]
df = pd.DataFrame(data, index=dates)

# Generate the chart image
image_stream = generate_candlestick_image(df)

if image_stream:
    # Create a new Excel workbook and add the image
    wb = Workbook()
    ws = wb.active
    ws.title = "Candlestick Chart"

    # The image needs to be saved to a BytesIO stream for openpyxl
    # generate_candlestick_image already returns this.
    img = OpenpyxlImage(image_stream)
    ws.add_image(img, 'A1') # Add image to cell A1

    wb.save("stock_chart_example.xlsx")
    print("Excel file 'stock_chart_example.xlsx' created with the chart.")
else:
    print("Failed to generate chart image.")

```

### Input DataFrame Requirements

The input Pandas DataFrame must meet the following criteria:

-   **Index**: Must be a `pd.DatetimeIndex`. The function expects dates to be sorted with the newest date first (at the top of the DataFrame). It will internally reverse the order for `mplfinance` compatibility.
-   **Columns**: Must include the following columns:
    -   `Open`: Opening price
    -   `Close`: Closing price
    -   `Low`: Lowest price
    -   `High`: Highest price
    -   `Volume`: Trading volume
    -   `Close_MA20`: 20-period moving average of the closing price
    -   `Close_MA50`: 50-period moving average of the closing price
    -   `Close_MA200`: 200-period moving average of the closing price

## Running Tests

To run the unit tests:

1.  Ensure you have the development dependencies installed (e.g., `unittest` is part of Python's standard library).
2.  Navigate to the root directory of the `candlestick_chart_generator` package.
3.  Run the tests using the following command:

    ```bash
    python -m unittest discover tests
    ```

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.

## License

This project is licensed under the MIT License. See the `LICENSE` file (you'll need to create one if it doesn't exist yet in this sub-project) for details.
