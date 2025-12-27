
import mplfinance as mpf
import pandas as pd
import os
import logging
import uuid

# Configuration
CHART_DIR = r"C:\Users\uchida\.gemini\temp_charts"
os.makedirs(CHART_DIR, exist_ok=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ChartGeneratorService:
    def __init__(self):
        pass

    def generate_chart_image(self, symbol: str, df: pd.DataFrame, period_label: str = "Daily") -> str:
        """
        Generates a candlestick chart image for the given stock dataframe.
        Returns the absolute path to the saved image.
        """
        try:
            if df.empty:
                logger.error(f"Cannot generate chart for {symbol}: DataFrame is empty")
                return None

            # Prepare data
            # mplfinance expects Index to be DatetimeIndex
            if not isinstance(df.index, pd.DatetimeIndex):
                df.index = pd.to_datetime(df.index)

            # Limit data to last 100 candles for readability? 
            # Or 6 months? 100-150 candles is usually good for pattern recognition.
            plot_df = df.tail(150).copy()

            # MAs
            # We assume MAs are already calculated in df as 'Close_MA5', etc. but mplfinance needs 'mav' argument or addplot.
            # Using make_addplot is more flexible.
            addplots = []
            
            colors = ['blue', 'orange', 'green', 'red']
            mas = ['Close_MA5', 'Close_MA20', 'Close_MA50', 'Close_MA200']
            
            for i, ma in enumerate(mas):
                if ma in plot_df.columns:
                    # Filter out NaN at start to avoid plotting issues
                    addplots.append(mpf.make_addplot(plot_df[ma], color=colors[i], width=0.8))

            # File Path
            filename = f"{symbol}_{uuid.uuid4().hex[:8]}.png"
            filepath = os.path.join(CHART_DIR, filename)

            # Style
            # 'yahoo' style is standard. 'charles' is also good (green/red).
            s = mpf.make_mpf_style(base_mpf_style='charles', rc={'font.size': 10})

            # Plot
            mpf.plot(
                plot_df,
                type='candle',
                style=s,
                title=f"{symbol} - {period_label}",
                ylabel='Price',
                volume=True,
                addplot=addplots if addplots else None,
                savefig=dict(fname=filepath, dpi=100, bbox_inches='tight'),
                datetime_format='%Y-%m-%d',
                xrotation=20,
                figsize=(12, 8) 
            )
            
            logger.info(f"Generated chart for {symbol} at {filepath}")
            return filepath

        except Exception as e:
            logger.error(f"Failed to generate chart for {symbol}: {e}", exc_info=True)
            return None

    def cleanup_old_charts(self):
        """
        Optional: Cleanup old charts to save space.
        """
        # Implementation skipped for now.
        pass

chart_generator = ChartGeneratorService()
