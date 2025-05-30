import pandas as pd
import mplfinance as mpf
import io

def generate_candlestick_image(df: pd.DataFrame, figsize= None):
    """
    Generates a candlestick chart with volume and moving averages.

    Args:
        df: Pandas DataFrame with DatetimeIndex (newest first) and columns:
            'Open', 'Close', 'Low', 'High', 'Volume',
            'Close_MA20', 'Close_MA50', 'Close_MA200'.

    Returns:
        io.BytesIO: An in-memory bytes buffer containing the chart image (PNG format),
                    suitable for use with openpyxl.drawing.image.Image.
                    Returns None if the DataFrame is empty or lacks required columns.
    """
    required_columns = ['Open', 'High', 'Low', 'Close', 'Volume', 'Close_MA20', 'Close_MA50', 'Close_MA200']
    if not all(col in df.columns for col in required_columns):
        # Consider logging a warning or raising a more specific error
        print(f"DataFrame missing one or more required columns: {required_columns}")
        return None

    if df.empty:
        print("DataFrame is empty.")
        return None

    # Ensure the index is a DatetimeIndex
    if not isinstance(df.index, pd.DatetimeIndex):
        try:
            df.index = pd.to_datetime(df.index)
        except Exception as e:
            print(f"Failed to convert DataFrame index to DatetimeIndex: {e}")
            return None # Or raise an error

    # mplfinance expects data with the oldest date first, so reverse if necessary.
    # The problem description states "newest date first", so we need to check and potentially reverse.
    if df.index[0] > df.index[-1]: # Newest date is at the start
        df = df.iloc[::-1] # Reverse the DataFrame

    # Define moving average plots
    ma_plots = [
        mpf.make_addplot(df['Close_MA20'], color='blue', width=0.7),
        mpf.make_addplot(df['Close_MA50'], color='orange', width=0.7),
        mpf.make_addplot(df['Close_MA200'], color='purple', width=0.7),
    ]

    if not figsize:
        figsize = (6, 3)

    mc = mpf.make_marketcolors(up='blue', down='red', inherit=True)
    cs  = mpf.make_mpf_style(base_mpf_style="yahoo", marketcolors=mc)
    # Create the plot
    # The 'volume=True' argument automatically adds a volume subplot.
    # 'style='yahoo'' is a common style for financial charts.
    # 'figsize' can be adjusted as needed.
    # 'mav' tuple for mplfinance internal MA calculation is removed as we are providing MAs.
    fig, axes = mpf.plot(
        df,
        type='candle',
        style= cs,
#        style='yahoo',
#        title='Candlestick Chart',
        ylabel='Price ($)',
#        volume=True,
        addplot=ma_plots,
        figsize=(6, 3), # Adjust figure size as needed
        returnfig=True # Returns the figure and axes objects
    )

    # Save the plot to an in-memory buffer
    image_stream = io.BytesIO()
    fig.savefig(image_stream, format='png')
    image_stream.seek(0) # Rewind the stream to the beginning

    return image_stream

if __name__ == '__main__':
    # Create a sample DataFrame for testing
    data = {
        'Open': [100, 102, 101, 105, 103],
        'High': [105, 106, 103, 107, 105],
        'Low': [98, 100, 100, 102, 101],
        'Close': [102, 101, 102, 106, 104],
        'Volume': [10000, 12000, 11000, 15000, 13000],
        'Close_MA20': [101, 101.5, 101.8, 102.5, 103],
        'Close_MA50': [100, 100.5, 101, 101.5, 102],
        'Close_MA200': [95, 96, 97, 98, 99]
    }
    # Create a DatetimeIndex, newest first as per problem description
    dates = pd.to_datetime(['2023-01-05', '2023-01-04', '2023-01-03', '2023-01-02', '2023-01-01'])
    sample_df = pd.DataFrame(data, index=dates)

    # Test the function
    image_bytes_io = generate_candlestick_image(sample_df.copy()) # Pass a copy

    if image_bytes_io:
        with open('candlestick_example.png', 'wb') as f:
            f.write(image_bytes_io.read())
        print("Sample candlestick chart saved to candlestick_example.png")
        image_bytes_io.seek(0) # Reset stream position if you need to read it again

    # Test with empty DataFrame
    empty_df = pd.DataFrame(columns=required_columns)
    empty_df.index = pd.to_datetime(empty_df.index)
    print(f"Test with empty DataFrame: {generate_candlestick_image(empty_df)}")

    # Test with missing columns
    missing_cols_df = sample_df.drop(columns=['Volume'])
    print(f"Test with missing columns: {generate_candlestick_image(missing_cols_df)}")

    # Test with wrong index
    wrong_index_df = sample_df.reset_index(drop=True)
    print(f"Test with wrong index type: {generate_candlestick_image(wrong_index_df)}")
