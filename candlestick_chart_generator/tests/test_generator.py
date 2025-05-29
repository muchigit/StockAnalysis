import unittest
import pandas as pd
import io
from candlestick_chart_generator import generate_candlestick_image # Updated import

class TestGenerator(unittest.TestCase):

    def setUp(self):
        """Set up a sample DataFrame for testing."""
        data = {
            'Open': [100, 102, 101, 105, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118],
            'High': [105, 106, 103, 107, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120],
            'Low': [98, 100, 100, 102, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116],
            'Close': [102, 101, 102, 106, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119],
            'Volume': [10000, 12000, 11000, 15000, 13000, 14000, 15000, 16000, 17000, 18000, 19000, 20000, 21000, 22000, 23000, 24000, 25000, 26000, 27000, 28000],
            'Close_MA20': [101, 101.5, 101.8, 102.5, 103, 103.5, 104, 104.5, 105, 105.5, 106, 106.5, 107, 107.5, 108, 108.5, 109, 109.5, 110, 110.5],
            'Close_MA50': [100, 100.5, 101, 101.5, 102, 102.5, 103, 103.5, 104, 104.5, 105, 105.5, 106, 106.5, 107, 107.5, 108, 108.5, 109, 109.5],
            'Close_MA200': [95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114]
        }
        # Generate enough dates for 20 data points
        dates = pd.date_range(end='2023-01-20', periods=20, freq='B') 
        # Reverse the dates to have newest first as per typical financial data representation
        self.sample_df = pd.DataFrame(data, index=dates[::-1])
        self.required_columns = ['Open', 'High', 'Low', 'Close', 'Volume', 'Close_MA20', 'Close_MA50', 'Close_MA200']

    def test_generate_candlestick_image_success(self):
        """Test successful image generation with valid data."""
        image_stream = generate_candlestick_image(self.sample_df.copy()) # Pass a copy
        self.assertIsNotNone(image_stream, "Image stream should not be None for valid input.")
        self.assertIsInstance(image_stream, io.BytesIO, "Should return an io.BytesIO object.")
        self.assertTrue(len(image_stream.getvalue()) > 0, "Image stream should not be empty.")

    def test_generate_candlestick_image_empty_df(self):
        """Test with an empty DataFrame."""
        empty_df = pd.DataFrame(columns=self.required_columns)
        empty_df.index = pd.to_datetime(empty_df.index) # Ensure datetime index
        image_stream = generate_candlestick_image(empty_df)
        self.assertIsNone(image_stream, "Should return None for an empty DataFrame.")

    def test_generate_candlestick_image_missing_columns(self):
        """Test with DataFrame missing required columns."""
        missing_cols_df = self.sample_df.drop(columns=['Volume'])
        image_stream = generate_candlestick_image(missing_cols_df)
        self.assertIsNone(image_stream, "Should return None if required columns are missing.")

    def test_generate_candlestick_image_non_datetime_index(self):
        """Test with DataFrame having a non-DatetimeIndex initially."""
        df_non_datetime_index = self.sample_df.reset_index() # Index becomes RangeIndex
        # The function attempts conversion, so this might still pass if conversion is successful.
        # Let's ensure it's a DatetimeIndex for the test's sample_df first.
        self.assertIsInstance(self.sample_df.index, pd.DatetimeIndex)

        # Scenario 1: Index can be converted to DatetimeIndex
        df_convertible_index = self.sample_df.copy()
        df_convertible_index.index = df_convertible_index.index.astype(str) # Convert to string index
        image_stream_convertible = generate_candlestick_image(df_convertible_index)
        self.assertIsNotNone(image_stream_convertible, "Image stream should not be None if index is convertible.")
        self.assertIsInstance(image_stream_convertible, io.BytesIO)

        # Scenario 2: Index cannot be converted (e.g., completely non-standard)
        df_non_convertible_index = pd.DataFrame({
            'Open': [100], 'High': [105], 'Low': [98], 'Close': [102], 'Volume': [10000],
            'Close_MA20': [101], 'Close_MA50': [100], 'Close_MA200': [95]
        }, index=['NotADate'])
        image_stream_non_convertible = generate_candlestick_image(df_non_convertible_index)
        self.assertIsNone(image_stream_non_convertible, "Should return None if index cannot be converted to DatetimeIndex.")


    def test_dataframe_reversal_logic(self):
        """Test if DataFrame is correctly reversed (oldest first for mplfinance)."""
        # Data where index is newest first (as per problem spec)
        df_newest_first = self.sample_df.copy()
        self.assertTrue(df_newest_first.index[0] > df_newest_first.index[-1])
        
        # Data where index is oldest first
        df_oldest_first = self.sample_df.iloc[::-1].copy()
        self.assertTrue(df_oldest_first.index[0] < df_oldest_first.index[-1])

        # Test with newest first input
        image_stream_newest = generate_candlestick_image(df_newest_first)
        self.assertIsNotNone(image_stream_newest)
        
        # Test with oldest first input
        image_stream_oldest = generate_candlestick_image(df_oldest_first)
        self.assertIsNotNone(image_stream_oldest)


if __name__ == '__main__':
    unittest.main()
