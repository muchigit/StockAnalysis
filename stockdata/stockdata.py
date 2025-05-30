from datetime import date, timedelta, datetime
import yfinance as yf
import pandas as pd

class StockData:
    def __init__(self, start_date=None):
        self.data_dict = {}
        self.info_dict = {}
        if start_date is None:
            today = date.today()
            self.start_date = today - timedelta(days=365 * 2)
        else:
            self.start_date = start_date

    def get_stock_info(self, symbol):
        if symbol in self.info_dict:
            info = self.info_dict[symbol]
        else:
            today = date.today()
            ticker = yf.Ticker(symbol)
            if ticker == None:
              print(f"No data found for {symbol}")
              return None
            try:
              info = ticker.info
            except Exception as e:
              print(f"Error getting info for {symbol}: {e}")
              info = None
            self.info_dict[symbol] = info
        return info

    def get_stock_data(self, symbol, asc=True):
        if symbol in self.data_dict:
            data = self.data_dict[symbol]
        else:
            today = date.today()
            data = yf.download(symbol, start=self.start_date, end=today, progress=False)
            if data.empty:
              print(f"No data found for {symbol}")
              return pd.DataFrame()

            data = data.xs(symbol, level=1, axis=1)
            data['Close_MA20'] = data['Close'].rolling(window=20).mean()
            data['Close_MA50'] = data['Close'].rolling(window=50).mean()
            data['Close_MA200'] = data['Close'].rolling(window=200).mean()
            data['Volume_MA50'] = data['Volume'].rolling(window=50).mean()
            data['Volume_MA200'] = data['Volume'].rolling(window=200).mean()

            # 上記のdataの列について、四捨五入した値を再設定
            data = data.round(2)

            if not asc:
                data = data.iloc[::-1]

            self.data_dict[symbol] = data
        return data

    def get_symbol_list(self):
        return list(self.data_dict.keys())

if __name__ == "__main__":
    stock_data_handler = StockData()
    symbols = ["PDEX"] # Example symbols, replace with your desired list

    for symbol in symbols:
        print(f"Processing: {symbol}")
        data = stock_data_handler.get_stock_data(symbol, asc=True)
        print()
        print(data.index[0].strftime('%Y-%m-%d'), type(data.index[0]))
        print(data.tail(200).to_csv())
