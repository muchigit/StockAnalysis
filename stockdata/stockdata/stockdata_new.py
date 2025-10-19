from datetime import date, timedelta, datetime
import yfinance as yf
import pandas as pd

class StockData:
    def __init__(self, start_date=None):
        """コンストラクタ"""
        self.data_dict = {}
        self.info_dict = {}
        if start_date is None:
            today = date.today()
            # デフォルトで過去2年分のデータを取得
            self.start_date = today - timedelta(days=365 * 2)
        else:
            self.start_date = start_date

    def _find_last_friday(self, year, month):
        """指定された年月の最終金曜日を見つける"""
        # 月の最終日から開始
        last_day = date(year, month, 1) + pd.offsets.MonthEnd(1)
        # 曜日が金曜日(4)になるまで1日ずつ戻る
        while last_day.weekday() != 4:
            last_day -= timedelta(days=1)
        return last_day

    def _find_nth_friday(self, year, month, n):
        """指定された年月の第n金曜日を見つける"""
        first_day_of_month = date(year, month, 1)
        # 月の初日の曜日を基準に最初の金曜日を計算
        days_to_first_friday = (4 - first_day_of_month.weekday() + 7) % 7
        first_friday = first_day_of_month + timedelta(days=days_to_first_friday)
        # 第n金曜日を計算
        nth_friday = first_friday + timedelta(weeks=n - 1)
        return nth_friday

    def _adjust_rebalance_volume(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        ラッセル・インデックスの構成銘柄入れ替え日に伴う出来高を前日の値に修正する
        - 毎年6月の最終金曜日
        - 2026年以降、毎年11月の第2金曜日
        """
        if data.empty:
            return data

        start_year = data.index.min().year
        end_year = data.index.max().year
        
        dates_to_adjust = []
        for year in range(start_year, end_year + 1):
            # 毎年6月の最終金曜日
            dates_to_adjust.append(self._find_last_friday(year, 6))
            
            # 2026年以降、毎年11月の第2金曜日
            if year >= 2026:
                dates_to_adjust.append(self._find_nth_friday(year, 11, 2))
        
        # DataFrameのインデックス（Timestamp型）と一致させる
        dates_to_adjust_ts = [pd.Timestamp(d) for d in dates_to_adjust]
        
        for trade_date in dates_to_adjust_ts:
            # 調整対象日がデータに含まれているか確認
            if trade_date in data.index:
                try:
                    loc = data.index.get_loc(trade_date)
                    if loc > 0:
                        # 前営業日の出来高を取得
                        prev_day_volume = data.iloc[loc - 1]['Volume']
                        # 当該日の出来高を前日の値で上書き
                        data.loc[trade_date, 'Volume'] = prev_day_volume
                except KeyError:
                    continue
        return data

    def get_stock_info(self, symbol):
        """銘柄情報を取得する"""
        if symbol in self.info_dict:
            return self.info_dict[symbol]
        
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            self.info_dict[symbol] = info
            return info
        except Exception as e:
            print(f"Error getting info for {symbol}: {e}")
            return None

    def get_stock_data(self, symbol, asc=True):
        """株価データを取得し、テクニカル指標を計算する"""
        if symbol in self.data_dict:
            data = self.data_dict[symbol]
        else:
            today = date.today()
            data = yf.download(symbol, start=self.start_date, end=today, progress=False, auto_adjust=True)
            if data.empty:
                print(f"No data found for {symbol}")
                return pd.DataFrame()

            # ★★★ 出来高の調整処理を呼び出す ★★★
            data = self._adjust_rebalance_volume(data)

            # 各種移動平均を計算
            data['Close_MA5'] = data['Close'].rolling(window=5).mean()
            data['Close_MA20'] = data['Close'].rolling(window=20).mean()
            data['Close_MA50'] = data['Close'].rolling(window=50).mean()
            data['Close_MA200'] = data['Close'].rolling(window=200).mean()
            data['Volume_MA50'] = data['Volume'].rolling(window=50).mean()
            data['Volume_MA200'] = data['Volume'].rolling(window=200).mean()

            # データを四捨五入し、欠損値を0で埋める
            data = data.round(2)
            data.fillna(0, inplace=True)

            self.data_dict[symbol] = data

        if not asc:
            data = data.sort_index(ascending=False)
        return data

    def get_symbol_list(self):
        """処理済みの銘柄リストを取得する"""
        return list(self.data_dict.keys())

# --- 実行部分 ---
if __name__ == "__main__":
    stock_data_handler = StockData()
    # 例としてRussell 2000 ETF (IWM) のデータを取得
    symbols = ["IWM"] 

    for symbol in symbols:
        print(f"Processing: {symbol}")
        # asc=Falseで最新のデータが上にくるようにソート
        data = stock_data_handler.get_stock_data(symbol, asc=False)
        
        if not data.empty:
            # 6月の最終金曜日周辺のデータを確認
            june_data = data[(data.index.month == 6) & (data.index.year == 2024)]
            print("\n--- 2024年6月のデータ（出来高調整の確認） ---")
            print(june_data[['Close', 'Volume']].tail(10)) # 最後の10日間を表示

            print("\n--- 最新20日間のデータ ---")
            print(data.head(20).to_string())