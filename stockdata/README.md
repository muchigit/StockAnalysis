# StockData ライブラリ

`yfinance` パッケージを使用して株式市場データを取得および処理するためのPythonライブラリです。このライブラリを使用すると、過去の株価、企業情報を取得し、移動平均などの一般的なテクニカル指標を計算できます。

## インストール

このライブラリを使用するには、直接インストールするか、依存関係をインストールします。

1.  **リポジトリをクローンします（まだクローンしていない場合）：**
    ```bash
    git clone <your_repository_url_here> # 実際のURLに置き換えてください
    cd stockdata
    ```

2.  **依存関係をインストールします：**
    `requirements.txt` ファイルを使用して必要なパッケージをインストールできます。
    ```bash
    pip install -r requirements.txt
    ```
    または、パッケージ自体をインストールする場合（例えば、他の場所からインポート可能にするため）、次を実行できます。
    ```bash
    pip install .
    ```

これにより、`yfinance`、`pandas`、およびその他の必要なライブラリがインストールされます。

## 基本的な使用方法

このライブラリの中核は `stockdata.stockdata` にある `StockData` クラスです。

### 初期化

まず、`StockData` クラスをインポートして初期化します。オプションで過去のデータの `start_date` を指定できます。`start_date` が指定されていない場合は、現在の日付の2年前にデフォルト設定されます。

```python
from stockdata.stockdata import StockData
from datetime import datetime

# デフォルトの開始日（2年前）で初期化
sd = StockData()

# または、特定の開始日で初期化
start_date_str = "2020-01-01"
start_date_obj = datetime.strptime(start_date_str, "%Y-%m-%d").date()
sd_custom_start = StockData(start_date=start_date_obj)
```

### 過去の株価データの取得

株式の過去の市場データを取得するには、`get_stock_data(symbol, asc=True)` メソッドを使用します。

-   `symbol` (str): 株式のティッカーシンボル（例："AAPL"、"MSFT"）。
-   `asc` (bool, オプション): データのソート順を決定します。デフォルトは `True`（日付の昇順）です。`False` の場合、データは降順で返されます。

このメソッドは、次の情報を含むPandas DataFrameを返します。
-   日付（インデックスとして）
-   始値
-   高値
-   安値
-   終値
-   調整後終値
-   出来高
-   計算された移動平均：
    -   `Close_MA20`（終値の20日間移動平均）
    -   `Close_MA50`（終値の50日間移動平均）
    -   `Close_MA200`（終値の200日間移動平均）
    -   `Volume_MA50`（出来高の50日間移動平均）
    -   `Volume_MA200`（出来高の200日間移動平均）

DataFrame内のすべての数値データは小数点以下2桁に丸められます。シンボルのデータが見つからない場合は、空のDataFrameが返されます。

```python
# Apple (AAPL) のデータを取得
aapl_data = sd.get_stock_data("AAPL")
print(aapl_data.head())

# Microsoft (MSFT) のデータを降順で取得
msft_data_desc = sd.get_stock_data("MSFT", asc=False)
print(msft_data_desc.head())
```

### 企業情報の取得

企業の一般情報を取得するには、`get_stock_info(symbol)` メソッドを使用します。

-   `symbol` (str): 株式のティッカーシンボル。

このメソッドは、企業に関するさまざまな詳細情報（セクター、業種、概要、ウェブサイトなど）を含む辞書を返します。内容はyfinanceから入手可能なデータによって異なる場合があります。

```python
aapl_info = sd.get_stock_info("AAPL")
if aapl_info:
    print(f"企業名: {aapl_info.get('longName')}")
    print(f"セクター: {aapl_info.get('sector')}")
    print(f"ウェブサイト: {aapl_info.get('website')}")
else:
    print("AAPLの情報を取得できませんでした。")
```

### 取得したシンボルのリスト表示

`StockData` インスタンス内で正常にフェッチされキャッシュされたすべてのティッカーシンボルのリストを取得するには、`get_symbol_list()` メソッドを使用します。

```python
# AAPL と MSFT のデータを取得した後
symbols_fetched = sd.get_symbol_list()
print(f"データが取得されたシンボル: {symbols_fetched}") # 期待値: ['AAPL', 'MSFT'] (または同様のもの)
```

## 例

`StockData` ライブラリの使用方法を示す簡単な例です。

```python
from stockdata.stockdata import StockData
from datetime import datetime

# StockData を初期化
# この例では特定の開始日を使用
start_date = datetime.strptime("2022-01-01", "%Y-%m-%d").date()
stock_handler = StockData(start_date=start_date)

# 処理する株式シンボルのリストを定義
symbols = ["GOOGL", "TSLA"]

# 各シンボルのデータを取得して表示
for symbol in symbols:
    print(f"--- {symbol} ---")

    # 企業情報を取得
    info = stock_handler.get_stock_info(symbol)
    if info:
        print(f"名前: {info.get('shortName', 'N/A')}")
        print(f"セクター: {info.get('sector', 'N/A')}")
    else:
        print(f"{symbol} の情報を取得できませんでした。")

    # 過去の株価データを取得
    data = stock_handler.get_stock_data(symbol, asc=False) # データを降順で取得
    if not data.empty:
        print("最近の株価データ（過去5日間）：")
        print(data.head())
        print(f"データ列: {data.columns.tolist()}")
    else:
        print(f"{symbol} の過去のデータは見つかりませんでした。")
    print("\n")

# データが取得されたすべてのシンボルをリスト表示
print(f"正常に取得されたシンボル: {stock_handler.get_symbol_list()}")

```

この例では、`StockData` を初期化し、Google (GOOGL) と Tesla (TSLA) の情報と最近の過去のデータを取得し、処理されたシンボルのリストを出力します。

## 依存関係

このライブラリは主に次のPythonパッケージに依存しています。

-   **yfinance**: Yahoo! Financeから株式市場データを取得するために使用されます。
-   **pandas**: データ操作と分析、特に過去の株価データをDataFrameで処理するために使用されます。

これらの依存関係は `requirements.txt` にリストされており、`pip install -r requirements.txt` または `pip install .` を使用すると自動的にインストールされます。
