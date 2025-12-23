# **米国株アルゴリズム取引のためのFutu API包括的技術リファレンス：アーキテクチャ、高度な注文執行、およびリスク管理**

## **1\. エグゼクティブサマリーとアーキテクチャの概要**

米国株式市場（US Equities）におけるアルゴリズム取引戦略の展開は、単なる売買注文の自動化を超えた、堅牢なシステムアーキテクチャの構築を要求する。Futu Open APIを用いた自動取引システムの設計において、開発者はFutuOpenDゲートウェイの役割、非同期通信プロトコル、そして米国市場特有のマイクロストラクチャ（市場微細構造）を深く理解する必要がある。本レポートは、基本的な指値・成行注文から、逆指値（Stop Order）、トレーリングストップ（Trailing Stop）といった高度な条件付き注文への移行を目指すクオンツトレーダーおよびシステムエンジニアを対象とした包括的な技術仕様書である。特に、TrdMarket.US環境におけるAPIの挙動、拡張取引時間（プレ・ポストマーケット）への対応、およびリスク管理のための実装パターンに焦点を当てて論じる。

### **1.1 Futu OpenDゲートウェイアーキテクチャの解剖**

Futu APIのアーキテクチャは、クライアントサイドのSDK（Python, Java, C++, C\#等）が取引所のシステムやFutuのバックエンドサーバーと直接通信しないという点で、一般的なREST APIとは一線を画している。その代わりに、ローカル環境またはサーバー上に配備された**FutuOpenD**と呼ばれるゲートウェイアプリケーションがミドルウェアとして機能する1。

このアーキテクチャが採用されている理由は、金融取引におけるセキュリティと接続の安定性を最大化するためである。

* **常時接続の維持:** OpenDはFutuのブローカーサーバーとの間で、暗号化された永続的なTCP接続（Keep-Alive）を維持する。これにより、ハンドシェイクのオーバーヘッドを削減し、高頻度な市場データの受信と注文送信を低遅延で実現している。  
* **プロトコルの変換:** クライアントSDKとOpenD間は、独自のプロトコル（Protobuf形式）で通信が行われる。OpenDはこのリクエストをシリアライズし、バックエンドが理解可能な形式に変換して送信する役割を担う。  
* **セキュリティ層:** 最も重要な点として、OpenDは初期接続時の認証に1024ビットのRSA暗号化を使用し、その後の通信ではAES共通鍵暗号方式に切り替えるハイブリッド暗号方式を採用している3。これにより、注文内容や口座情報がネットワーク上で盗聴されるリスクを極小化している。

#### **非同期通信と状態管理の重要性**

Python SDKのメソッド（例: place\_order）は表面的には同期的に動作し、関数の戻り値としてRET\_OKやエラーコードを返すが、背後のネットワークトランスポートは本質的に非同期である。これはシステム設計において重大な意味を持つ4。  
具体的には、place\_orderが「注文送信成功（OpenDへの到達確認）」を返したとしても、それは取引所での約定、あるいはブローカー側での注文受領を保証するものではない。注文の状態変化（受付、部分約定、全約定、拒否）は、別途プッシュ通知（Callback）として非同期に受信される。したがって、高度な取引ボットを構築する場合、戻り値の確認だけでなく、Order Update Callbackを常時監視し、ローカルの注文状態を最新に保つイベント駆動型の設計が不可欠となる4。

### **1.2 米国株式市場インフラストラクチャの特殊性**

TrdMarket.US（米国市場）での取引は、香港（HK）や中国本土（CN）市場とは異なる固有のパラメータと規則を持つ。これらを無視した実装は、注文拒否や意図しない価格での約定を招くリスクがある。

* **価格精度（Decimals）:** 香港市場では通常3桁の精度が一般的だが、米国株式市場では1ドル未満の銘柄に対して小数点以下4桁（$0.0001）までの精度、いわゆるサブペニー（Sub-penny）価格が許容される場合がある4。一方、米国株オプションは通常小数点以下2桁に固定される。APIに渡す価格パラメータは、これらの市場ルールに従って適切に丸められる必要があるが、OpenDにはadjust\_limitパラメータが存在し、これを設定することでシステム側で許容範囲内の価格に自動調整させることも可能である4。  
* **セッション管理と流動性:** 米国市場は、通常取引時間（RTH: Regular Trading Hours, 09:30-16:00 ET）に加え、プレマーケット（Pre-Market）とポストマーケット（Post-Market）という拡張取引時間（ETH）を持つ。これらの時間帯は流動性が低く、スプレッドが広がる傾向があるため、APIではデフォルトでRTHのみが有効となっている。ETHでの約定を希望する場合は、明示的にfill\_outside\_rthフラグを制御する必要がある4。  
* **高度な注文のルーティング:** 逆指値（Stop）やトレーリングストップなどの条件付き注文は、必ずしも取引所がネイティブにサポートしているわけではない。多くの場合、Futuのサーバーまたは上流ブローカーのシステム内で「シミュレーション」され、トリガー条件が満たされた瞬間に、指値（Limit）または成行（Market）注文として市場に放出される。このメカニズムを理解することは、スリッページ（指定価格と約定価格の乖離）のリスクを見積もる上で極めて重要である5。

## ---

**2\. 認証プロセスとセキュアなセッション初期化**

高度な注文を実行する前段階として、取引セッションの確立とセキュリティ認証を適切に実装する必要がある。Futu APIのライフサイクルには、「OpenDへの接続」と「取引機能のロック解除（Unlock Trade）」という2つの異なる認証フェーズが存在する。

### **2.1 取引ロック解除メカニズム (unlock\_trade)**

OpenDに接続しただけでは、市場データの受信（Quotes）は可能でも、注文の発注や口座情報の参照といった機密性の高い操作は行えない。これを可能にするのがunlock\_tradeインターフェースである。これは、スクリプトが共有サーバー上で実行される場合などに、第三者による不正な注文操作を防ぐための重要なセキュリティコントロールである。

* **セキュリティ推奨事項:** ソースコード内に平文（プレーンテキスト）のパスワードをハードコーディングすることは、セキュリティ上の重大な脆弱性となる。APIは、パスワードの代わりに32ビットのMD5ハッシュ値（password\_md5）を受け入れる仕様となっている6。  
* **セッションの持続性:** 一度ロックが解除されると、その取引コンテキスト（TrdContext）はOpenDが稼働し続ける限り、または明示的にロックされるまで有効な状態を維持する。しかし、セキュリティポリシーにより一定時間で再ロックされる場合や、OpenDの再起動時には再認証が必要となるため、ボットの実装では「注文前にロック状態を確認し、必要なら再解除する」ロジックを組み込むことが推奨される。

#### **Python実装：MD5ハッシュを用いたセキュアなコンテキスト初期化**

以下のコードは、平文パスワードをネットワーク上に流さず、MD5ハッシュを用いて安全に取引権限を有効化する実装例である。

Python

from futu import \*  
import hashlib

def secure\_unlock(trd\_ctx, raw\_password):  
    """  
    平文パスワードをMD5ハッシュ化し、安全に取引機能をアンロックする関数。  
    アプリケーション層でパスワードを隠蔽するために使用する。  
    """  
    \# パスワードをUTF-8エンコードし、MD5ハッシュを生成（16進数文字列）  
    md5\_pwd \= hashlib.md5(raw\_password.encode('utf-8')).hexdigest()  
      
    \# unlock\_tradeを呼び出し。is\_unlock=Trueで解除を要求  
    ret\_code, data \= trd\_ctx.unlock\_trade(password\_md5=md5\_pwd, is\_unlock=True)  
      
    if ret\_code \== RET\_OK:  
        print("取引コンテキストのロック解除に成功しました。")  
        return True  
    else:  
        print(f"ロック解除に失敗しました。エラー: {data}")  
        return False

\# 米国市場向け取引コンテキストの初期化  
\# hostとportはFutuOpenDの設定と一致させる必要がある  
\# security\_firmは口座の所属により異なる（米国口座の場合はFUTUINC、香港口座はFUTUSECURITIES）  
trd\_ctx \= OpenSecTradeContext(  
    filter\_trdmarket=TrdMarket.US,   
    host='127.0.0.1',   
    port=11111,   
    security\_firm=SecurityFirm.FUTUINC  
)

\# 実行フロー  
\# 実際の運用ではパスワードは環境変数や暗号化されたConfigから読み込むべきである  
if secure\_unlock(trd\_ctx, "YourStrongPassword123"):  
    \# ここに注文処理を記述  
    pass 

### **2.2 OpenDのためのRSA鍵ペア生成と構成**

クラウド環境（AWS, GCP, Azure等）やVPS上でOpenDを運用する場合、通信経路の盗聴リスクに対抗するため、RSA暗号化を有効にすることが強く推奨される。APIドキュメントおよびプロトコル仕様書によれば、OpenDは\*\*1024ビットのRSA鍵（PKCS\#1形式）\*\*を使用する3。

一部のドキュメントではオンラインの鍵生成ツールが言及されているが、秘密鍵を第三者のサーバーで生成することはセキュリティの観点から推奨されない。ここでは、標準的なOpenSSLコマンドラインツールを用いて、ローカル環境で安全に鍵ペアを生成する手順を解説する。

**RSA鍵生成コマンド（OpenSSL使用）:**

1. 秘密鍵（Private Key）の生成:  
   PKCS\#1形式で1024ビットのRSA秘密鍵を生成する。  
   Bash  
   openssl genrsa \-out private\_key.pem 1024

   *注意:* 生成されたprivate\_key.pemは極秘情報であり、厳重に管理する必要がある。  
2. 公開鍵（Public Key）の抽出:  
   秘密鍵から対応する公開鍵を生成する。この公開鍵はクライアントプログラム（Pythonスクリプト側）で使用される場合がある。  
   Bash  
   openssl rsa \-in private\_key.pem \-pubout \-out public\_key.pem

OpenDへの適用:  
生成されたprivate\_key.pemファイルの絶対パスを、OpenDの設定ファイル（FutuOpenD.xml）内の\<rsa\_private\_key\>セクションに記述する7。OpenD再起動後、ゲートウェイは接続時にこの秘密鍵を用いてクライアントからの暗号化されたハンドシェイクを復号し、セッションキーを確立する。

## ---

**3\. 高度な注文タイプ：理論と実装詳細**

Futu APIは、単純な指値（Limit）・成行（Market）注文に加え、多様なアルゴリズム注文をサポートしている。特に米国株取引においては、ボラティリティの管理と利益の最大化のために、\*\*条件付き注文（Stop, Stop Limit）**および**動的追跡注文（Trailing Stop）\*\*の習熟が不可欠である。ここでは、それぞれの注文タイプがどのように機能し、どのようなパラメータを必要とするかを詳述する。

### **3.1 注文タイプ（OrderType）の分類体系**

OrderType列挙体（Enum）は、注文の執行動作を定義する最も基本的なパラメータである。米国株において利用可能な主要な型は以下の通りである4。

| 列挙定数 (OrderType) | 説明 | 必須となる補助パラメータ (PlaceOrder時) | 挙動の概要 |
| :---- | :---- | :---- | :---- |
| NORMAL | 通常指値注文 | price | 指定価格以上（売り）/以下（買い）で約定を待機。 |
| MARKET | 成行注文 | なし (priceにはプレースホルダを渡す) | 現在の最良気配値で即座に約定。価格保証なし。 |
| STOP | 逆指値（ストップ）注文 | aux\_price (トリガー価格) | トリガー価格に達すると**成行注文**として市場に投入される。 |
| STOP\_LIMIT | ストップリミット注文 | aux\_price (トリガー), price (指値) | トリガー価格に達すると**指値注文**として市場に投入される。 |
| TRAILING\_STOP | トレーリングストップ | trail\_type, trail\_value | 市場価格に追随してトリガー価格が変動するストップ注文。 |
| TRAILING\_STOP\_LIMIT | トレーリングストップリミット | trail\_type, trail\_value, trail\_spread | トリガー時に指値注文を出すトレーリング注文。 |
| MARKET\_IF\_TOUCHED | Market if Touched (MIT) | aux\_price | 目標価格に達したら成行注文（利食い等に使用）。 |
| LIMIT\_IF\_TOUCHED | Limit if Touched (LIT) | aux\_price, price | 目標価格に達したら指値注文。 |

### **3.2 逆指値（Stop）とストップリミット（Stop Limit）注文**

これらは一般に「損切り（Stop Loss）」や、レンジブレイクアウト時の「順張りエントリー」に使用される。

* **メカニズム:** これらの注文は、即座に市場の板（Order Book）に載るわけではない。Futuのシステム（または取引所）が市場価格を監視し、指定されたaux\_priceに到達した瞬間にアクティブな注文へと変換される。  
* **Stop (Market)のリスク:** トリガー後に成行注文となるため、約定は保証されるが、急激な価格変動時には想定よりも極めて悪い価格（スリッページ）で約定するリスクがある。  
* **Stop Limitのリスク:** トリガー後に指値注文となるため、価格は保証されるが、相場がその指値を飛び越えて変動した場合、注文が取り残され（Unfilled）、損切りが機能しないリスクがある。

#### **Python実装：損切り注文のセットアップ**

以下の関数は、保有ポジションに対するストップロス注文を発注する汎用的な実装である。

Python

def place\_stop\_loss\_order(ctx, stock\_code, qty, trigger\_price, is\_limit=False, limit\_price=None):  
    """  
    米国株に対するStop（成行）またはStop Limit注文を発注する。  
      
    :param ctx: 取引コンテキスト  
    :param stock\_code: 銘柄コード（例: "US.TSLA"）  
    :param qty: 数量  
    :param trigger\_price: 逆指値のトリガー価格（aux\_price）  
    :param is\_limit: TrueならStop Limit、FalseならStop Market  
    :param limit\_price: Stop Limitの場合の指値価格  
    """  
      
    \# 注文タイプの決定  
    if is\_limit:  
        o\_type \= OrderType.STOP\_LIMIT  
        \# Stop Limitの場合、priceパラメータが実際に発注される指値となる  
        if limit\_price is None:  
            raise ValueError("Stop Limit注文にはlimit\_priceが必要です。")  
        order\_price \= limit\_price   
    else:  
        o\_type \= OrderType.STOP  
        \# Stop Marketの場合、priceパラメータは無視されるが、APIの仕様上数値を渡す必要がある  
        \# 通常は市場価格から離れた値を入れないよう注意するが、ここではプレースホルダとして機能する  
        order\_price \= 100.0   
          
    ret, data \= ctx.place\_order(  
        price=order\_price,  
        qty=qty,  
        code=stock\_code,  
        trd\_side=TrdSide.SELL, \# 通常、損切りは売り注文（ロングポジションの場合）  
        order\_type=o\_type,  
        aux\_price=trigger\_price, \# ここがトリガー価格となる  
        trd\_env=TrdEnv.REAL,  
        \# ストップ注文はボラティリティの高い時間外取引を避けるため、RTHのみとすることが一般的  
        fill\_outside\_rth=False   
    )  
      
    if ret \== RET\_OK:  
        print(f"ストップ注文発注成功。注文ID: {data\['order\_id'\]}")  
    else:  
        print(f"ストップ注文発注失敗。エラー: {data}")

### **3.3 トレーリングストップ（Trailing Stop）注文の詳細**

トレーリングストップは、市場価格が有利な方向に動いた場合に、自動的にストップ価格（トリガー価格）を追随させるアルゴリズム注文である。「利益を伸ばし、損失を限定する」戦略の核心となる5。

* **買い注文のロジック:**  
  * 初期ストップ価格 \= 現在値 \+ トレール幅。  
  * 価格が下落すると、ストップ価格も下がる。  
  * 価格が上昇すると、ストップ価格は固定される。  
  * 市場価格 ≥ ストップ価格 となった時点で買い注文が発動する。  
* **売り注文のロジック:**  
  * 初期ストップ価格 \= 現在値 \- トレール幅。  
  * 価格が上昇すると、ストップ価格も上がる（利益確保ラインが切り上がる）。  
  * 価格が下落すると、ストップ価格は固定される。  
  * 市場価格 ≤ ストップ価格 となった時点で売り注文が発動する。

必須パラメータの詳細解説 4:

1. **trail\_type (トレールタイプ):**  
   * TrailType.RATIO: 変動幅をパーセンテージで指定する。例えば、値動きの5%を追随させたい場合に使用する。列挙値は1。  
   * TrailType.AMOUNT: 変動幅を固定の価格（ドル額）で指定する。例えば、$2.00の幅で追随させる場合に使用する。列挙値は2。  
2. **trail\_value (トレール値):**  
   * RATIOを選択した場合、入力値5は5%を意味する。  
   * AMOUNTを選択した場合、米国株では小数点以下4桁までの精度が許容される。  
3. **trail\_spread (トレールスプレッド):**  
   * TRAILING\_STOP\_LIMITの場合にのみ必要。トリガー価格に到達した際、そこから「どれだけ離れた価格」で指値を置くかを指定する。  
   * 例：売り注文でトリガーが$150、スプレッドが$0.5の場合、トリガー時に$149.5の売り指値が出される（$150 \- $0.5）。これにより、急落時でも即座に約定させる確率を高める（あるいは逆に指値を遠ざける）調整が可能となる。

#### **Python実装：高度なトレーリングストップリミット**

以下のコードは、トレールの種類（％または金額）を動的に選択し、スプレッドを考慮したトレーリングストップリミット注文を発注するものである。

Python

def place\_trailing\_stop\_limit(ctx, stock\_code, qty, trail\_mode, trail\_amt, spread):  
    """  
    トレーリングストップリミット注文を発注する。  
      
    :param trail\_mode: 'RATIO' (比率) または 'AMOUNT' (金額)  
    :param trail\_amt: トレール値 (例: 2.5 なら 2.5% または $2.50)  
    :param spread: トリガー価格と実際に発注する指値の差額（スプレッド）  
    """  
      
    \# 文字列モードをFutuのEnumにマッピング  
    if trail\_mode \== 'RATIO':  
        t\_type \= TrailType.RATIO  
    elif trail\_mode \== 'AMOUNT':  
        t\_type \= TrailType.AMOUNT  
    else:  
        raise ValueError("trail\_modeは 'RATIO' または 'AMOUNT' である必要があります。")  
          
    \# 注文の構築  
    ret, data \= ctx.place\_order(  
        price=0, \# トレーリングストップでは初期priceは計算に使用されないが、必須パラメータ  
        qty=qty,  
        code=stock\_code,  
        trd\_side=TrdSide.SELL, \# 売り注文の例（ロングポジションの決済）  
        order\_type=OrderType.TRAILING\_STOP\_LIMIT,  
        trail\_type=t\_type,  
        trail\_value=trail\_amt,  
        trail\_spread=spread,  
        trd\_env=TrdEnv.REAL,  
        \# 米国株特有: GTC（キャンセルされるまで有効）を指定することで、日をまたいでトレーリングを継続  
        time\_in\_force=TimeInForce.GTC,  
        fill\_outside\_rth=True \# 時間外取引でもトリガーさせる場合  
    )  
      
    if ret \== RET\_OK:  
        order\_id \= data\['order\_id'\]  
        print(f"トレーリングストップリミット注文発注成功。ID: {order\_id}")  
        print(f"設定: トレール幅 {trail\_amt} ({trail\_mode}), スプレッド: {spread}")  
    else:  
        print(f"発注エラー: {data}")

\# 使用例:  
\# AAPL 100株を売却。  
\# 最高値から2%下落した時点でトリガー。  
\# トリガー価格からさらに$0.50低い価格で指値を置く（約定優先の設定）。  
place\_trailing\_stop\_limit(trd\_ctx, "US.AAPL", 100, 'RATIO', 2.0, 0.50)

## ---

**4\. 米国市場における注文執行のニュアンスとパラメータ設定**

米国株のアルゴリズム取引では、place\_orderインターフェースの特定のパラメータ操作が、戦略の成否を分ける重要な要素となる。

### **4.1 時間外取引へのアクセス (fill\_outside\_rth)**

米国市場は、通常の立会時間（RTH）以外に、活発なプレマーケット（04:00-09:30 ET）とポストマーケット（16:00-20:00 ET）が存在する。決算発表や重要な経済指標はこの時間帯に発表されることが多い。

* **デフォルトの挙動:** API経由の指値注文は、デフォルトではRTHのみで有効である。  
* **パラメータ設定:** 時間外の流動性にアクセスするためには、fill\_outside\_rth=Trueを設定する必要がある4。  
* **制約事項:** 多くの取引所やブローカーは、スプレッド拡大による予期せぬ損失を防ぐため、時間外取引における\*\*成行注文（Market Order）\*\*を受け付けない。時間外取引を狙う場合は、必ず指値（Limit）系の注文タイプを使用する必要がある。

### **4.2 トレーディングセッションの指定 (session)**

APIは、sessionパラメータを通じて、注文が有効となる特定の時間枠を指定する機能を提供している。これは米国株専用のパラメータである4。

| セッション定数 | 意味 | 用途 |
| :---- | :---- | :---- |
| Session.RTH | Regular Trading Hours | 通常取引時間（09:30-16:00 ET）のみ。最も流動性が高い。 |
| Session.ETH | Extended Trading Hours | 時間外取引のみ。特定のニュースイベント狙いに使用。 |
| Session.ALL | 全セッション | プレ、ザラ場、ポストの全てをカバーする。 |

### **4.3 注文の有効期限 (time\_in\_force)**

スイングトレードや、長期的なトレンドフォロー戦略において、注文の有効期限管理は重要である4。

* **TimeInForce.DAY:** 当日の市場終了時（RTH終了時、またはfill\_outside\_rth=TrueならETH終了時）に自動的にキャンセルされる。デイトレード戦略向け。  
* **TimeInForce.GTC (Good-Til-Cancelled):** キャンセルされるか約定するまで、最大90日間ブローカーのサーバー上に保持される。トレーリングストップ等、数日間にわたって利益を伸ばす戦略にはGTCが必須である。

## ---

**5\. 包括的データディクショナリと列挙体（Enum）リファレンス**

Futu APIを使用する際、文字列ではなく定義済みの定数（Enum）を使用することで、タイプセーフで堅牢なコードを記述できる。以下に、本レポートで扱った主要なEnumの値をまとめる。

### **5.1 取引市場 (TrdMarket)**

口座のフィルタリングや銘柄指定のスコープ定義に使用される9。

| 定数名 | 値 | 説明 |
| :---- | :---- | :---- |
| TrdMarket.HK | 1 | 香港証券市場 |
| TrdMarket.US | 2 | 米国証券市場（株式、ETF、オプション） |
| TrdMarket.CN | 3 | 中国A株（ストックコネクト） |
| TrdMarket.FUTURES | 4 | 先物市場 |

### **5.2 トレールタイプ (TrailType)**

TRAILING\_STOPおよびTRAILING\_STOP\_LIMIT注文で使用される9。

| 定数名 | 値 | 説明 | 備考 |
| :---- | :---- | :---- | :---- |
| TrailType.RATIO | 1 | 比率（％） | 値5は5%を意味する。通常、小数点以下2桁まで。 |
| TrailType.AMOUNT | 2 | 金額（通貨） | 値1.5は$1.50を意味する。米国株では小数点以下4桁まで。 |

### **5.3 インターフェース戻り値 (RET\_CODE)**

API呼び出しの結果を判定するための定数。堅牢なエラーハンドリングには必須である13。

| 定数名 | 値 | 解釈 | 推奨アクション |
| :---- | :---- | :---- | :---- |
| RET\_OK | 0 | 成功 | 返却されたdataオブジェクトの解析に進む。 |
| RET\_ERROR | \-1 | 論理/サーバーエラー | dataに含まれるエラーメッセージをログに記録し、例外処理を行う。 |
| RET\_TIMEOUT | \-100 | ネットワークタイムアウト | 注文の状態が不明。再送する前に必ずorder\_list\_queryで注文状態を確認する。 |

## ---

**6\. 完全統合型実装例：USAlgoTraderクラス**

これまでに解説した概念（認証、米国市場設定、高度な注文）を統合し、実運用に耐えうるPythonクラスの実装例を以下に示す。このクラスは、接続の確立から、リスク管理を伴う高度な注文発注までを一元管理する設計となっている。

Python

from futu import \*  
import time  
import hashlib

class USAlgoTrader:  
    def \_\_init\_\_(self, host='127.0.0.1', port=11111, pwd=''):  
        """  
        トレーダークラスの初期化。  
        :param host: OpenDのホストアドレス  
        :param port: OpenDのポート番号  
        :param pwd: 取引パスワード（平文）  
        """  
        self.host \= host  
        self.port \= port  
        self.pwd \= pwd  
        self.ctx \= OpenSecTradeContext(  
            filter\_trdmarket=TrdMarket.US,  
            host=self.host,  
            port=self.port,  
            security\_firm=SecurityFirm.FUTUINC  
        )

    def unlock(self):  
        """  
        MD5ハッシュを用いて安全に取引セッションをアンロックする。  
        """  
        if not self.pwd:  
            print("パスワードが提供されていません。")  
            return False  
              
        md5\_pwd \= hashlib.md5(self.pwd.encode('utf-8')).hexdigest()  
        ret, data \= self.ctx.unlock\_trade(password\_md5=md5\_pwd, is\_unlock=True)  
          
        if ret \== RET\_OK:  
            print("セッションのアンロックに成功しました。")  
            return True  
        else:  
            print(f"アンロック失敗: {data}")  
            return False

    def place\_advanced\_exit(self, symbol, qty, trail\_percent, limit\_offset):  
        """  
        ロングポジションを保護するためのGTCトレーリングストップリミット注文を発注する。  
        時間外取引（ETH）もカバーする設定とする。  
          
        :param symbol: 銘柄コード (例: "US.NVDA")  
        :param qty: 売却数量  
        :param trail\_percent: トレール率 (例: 5.0 で 5%)  
        :param limit\_offset: トリガー価格から指値をどれだけ下げるか（スプレッド）  
        """  
          
        \# 1\. 接続確認（簡易的な生存確認）  
        status\_ret, status\_data \= self.ctx.get\_acc\_list()  
        if status\_ret\!= RET\_OK:  
            print("接続ロスト。再接続が必要です...")  
            \# ここに再接続ロジックを実装することを推奨  
            return

        \# 2\. 注文の発注  
        \# adjust\_limit=0: 自動価格調整を無効化（意図しない価格キャップを防ぐため）  
        \# fill\_outside\_rth=True: プレ/ポストマーケットでの急変にも対応  
        \# time\_in\_force=GTC: 数日間のトレンドを追うために有効期限を無期限にする  
          
        print(f"発注中: {symbol} {qty}株, トレール: {trail\_percent}%, オフセット: ${limit\_offset}")  
          
        ret, data \= self.ctx.place\_order(  
            price=0, \# トレーリングストップのロジックでは無視されるが必須  
            qty=qty,  
            code=symbol,  
            trd\_side=TrdSide.SELL,  
            order\_type=OrderType.TRAILING\_STOP\_LIMIT,  
            trail\_type=TrailType.RATIO,  
            trail\_value=trail\_percent,  
            trail\_spread=limit\_offset,  
            adjust\_limit=0,  
            trd\_env=TrdEnv.REAL,  
            time\_in\_force=TimeInForce.GTC,  
            fill\_outside\_rth=True   
        )

        \# 3\. レスポンス処理  
        if ret \== RET\_OK:  
            order\_id \= data\['order\_id'\]  
            print(f"SUCCESS: トレーリングストップリミット注文発注完了。注文ID: {order\_id}")  
        else:  
            print(f"FAILURE: 注文が拒否されました。理由: {data}")

    def close(self):  
        """リソースの解放"""  
        self.ctx.close()

\# \--- メイン実行ブロック \---  
if \_\_name\_\_ \== "\_\_main\_\_":  
    \# トレーダーの初期化（パスワードは安全な方法で管理すること）  
    bot \= USAlgoTrader(pwd="MySecurePassword123")  
      
    if bot.unlock():  
        \# 実例: NVIDIA株の利益確保  
        \# 最高値から3%下落した場合にトリガー。  
        \# トリガー価格から$0.20下の指値で売り抜ける。  
        \# この注文はキャンセルされるまで有効(GTC)で、時間外取引でも機能する。  
        bot.place\_advanced\_exit("US.NVDA", 50, 3.0, 0.20)  
          
    bot.close()

## ---

**7\. 運用上のリスク管理とベストプラクティス**

システム稼働後、安定した運用を続けるためには、APIの特性に起因するリスクとその回避策を理解しておく必要がある。

### **7.1 ネットワークの非同期性と競合状態**

前述の通り、Python APIの呼び出しは同期的ラッパーであるが、システム全体は非同期である。place\_orderがRET\_OKを返したとしても、それは「OpenDが注文を受け取った」ことに過ぎず、「取引所が注文を受理した」ことと同義ではない。

* **リスク:** place\_orderの戻り値だけでポジション管理を行うと、実際には取引所で拒否（Rejected）された注文を「有効」と誤認し、システム上の在庫と実際の在庫に不整合が生じる。  
* **解決策:** TradeOrderHandlerBaseクラスを継承し、リアルタイムの注文ステータスプッシュ（OnOrderUpdate）をリッスンするハンドラを実装すること。これにより、SUBMITTED（送信済み）、FILLED（約定）、FAILED（失敗）といった確定的な状態遷移を検知できる4。

### **7.2 高頻度リクエストとレート制限**

Futuはシステム安定性維持のため、API呼び出し頻度に制限（レートリミット）を設けている。

* **制限:** アカウントのティアによって異なるが、例えば「30秒間に20回」といった制限が存在する。  
* **アンチパターン:** while Trueループ内でget\_order\_listを連打して注文状態を確認するポーリング方式は、即座にレートリミットに達し、エラーコードが返される原因となる。  
* **最適化:** 初期化時にのみリスト取得を行い、その後はプッシュ通知（Callback）のみで内部状態を更新する設計にする15。

### **7.3 データ整合性とマーケットデータの購読**

トレーリングストップや逆指値のトリガー条件（aux\_price）を計算する際、参照している価格データが正しい市場のものであるかを確認する必要がある。

* TrdMarket.USで取引する場合、Quotes（市場データ）の購読権限もUS市場のものでなければならない。誤って香港市場や遅延データを参照してロジックを動かすと、通貨単位やタイムゾーンの不一致により、壊滅的な価格での注文が発注されるリスクがある。

## **8\. 結論**

Futu APIを通じた米国株取引は、機関投資家レベルの高度な機能を提供する強力なツールである。しかし、その力を正しく引き出すためには、TrdMarket.US環境特有の小数点精度、セッション管理、および非同期アーキテクチャへの深い理解が不可欠である。本レポートで詳述したトレーリングストップの実装、RSA暗号化によるセキュリティ強化、そしてGTC/ETHフラグの適切な運用を組み合わせることで、開発者は感情に左右されない、規律ある自動取引システムを構築することが可能となる。今後の展望として、本レポートの実装をベースに、さらに複雑な条件（O-C-O注文など）や、WebSocketを用いたリアルタイム板情報を組み合わせた戦略へと拡張していくことが推奨される。

#### **引用文献**

1. AI-Powered Trading: A Deep Dive into the Futu API MCP Server, 12月 22, 2025にアクセス、 [https://skywork.ai/skypage/en/ai-powered-trading-futu-api/1977575700774195200](https://skywork.ai/skypage/en/ai-powered-trading-futu-api/1977575700774195200)  
2. FUTU HK Help Center-API development documentation, 12月 22, 2025にアクセス、 [https://www.futuhk.com/en/support/topic1\_462](https://www.futuhk.com/en/support/topic1_462)  
3. Protocol Introduction | Futu API Doc v9.4, 12月 22, 2025にアクセス、 [https://openapi.futunn.com/futu-api-doc/en/ftapi/protocol.html](https://openapi.futunn.com/futu-api-doc/en/ftapi/protocol.html)  
4. Place Orders | Futu API Doc v9.5, 12月 22, 2025にアクセス、 [https://openapi.futunn.com/futu-api-doc/en/trade/place-order.html](https://openapi.futunn.com/futu-api-doc/en/trade/place-order.html)  
5. FUTU HK Help Center-Trailing stop limit order, 12月 22, 2025にアクセス、 [https://www.futuhk.com/en/support/topic2\_357](https://www.futuhk.com/en/support/topic2_357)  
6. Unlock Trade | Futu API Doc v9.6, 12月 22, 2025にアクセス、 [https://openapi.futunn.com/futu-api-doc/en/trade/unlock.html](https://openapi.futunn.com/futu-api-doc/en/trade/unlock.html)  
7. Visualization OpenD | Futu API Doc v9.6, 12月 22, 2025にアクセス、 [https://openapi.futunn.com/futu-api-doc/en/quick/opend-base.html](https://openapi.futunn.com/futu-api-doc/en/quick/opend-base.html)  
8. Command Line OpenD | Futu API Doc v9.6, 12月 22, 2025にアクセス、 [https://openapi.futunn.com/futu-api-doc/en/opend/opend-cmd.html](https://openapi.futunn.com/futu-api-doc/en/opend/opend-cmd.html)  
9. Trading Definitions | Futu API Doc v9.4, 12月 22, 2025にアクセス、 [https://openapi.futunn.com/futu-api-doc/en/trade/trade.html](https://openapi.futunn.com/futu-api-doc/en/trade/trade.html)  
10. FUTU HK Help Center-Advanced orders, 12月 22, 2025にアクセス、 [https://www.futuhk.com/en/support/topic2\_1717](https://www.futuhk.com/en/support/topic2_1717)  
11. Modify or Cancel Orders | Futu API Doc v9.5, 12月 22, 2025にアクセス、 [https://openapi.futunn.com/futu-api-doc/en/trade/modify-order.html](https://openapi.futunn.com/futu-api-doc/en/trade/modify-order.html)  
12. FUTU HK Help Center-Time-in-Force, 12月 22, 2025にアクセス、 [https://www.futuhk.com/en/support/topic2\_1537](https://www.futuhk.com/en/support/topic2_1537)  
13. General Definitions | Futu API Doc v9.6, 12月 22, 2025にアクセス、 [https://openapi.futunn.com/futu-api-doc/en/ftapi/common.html](https://openapi.futunn.com/futu-api-doc/en/ftapi/common.html)  
14. Orders Push Callback | Futu API Doc v9.6, 12月 22, 2025にアクセス、 [https://openapi.futunn.com/futu-api-doc/en/trade/update-order.html](https://openapi.futunn.com/futu-api-doc/en/trade/update-order.html)  
15. Transaction related | Futu API Doc v9.6, 12月 22, 2025にアクセス、 [https://openapi.futunn.com/futu-api-doc/en/qa/trade.html](https://openapi.futunn.com/futu-api-doc/en/qa/trade.html)