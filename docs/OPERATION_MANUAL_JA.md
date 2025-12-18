# 投資管理システム 運用・開発マニュアル

このドキュメントでは、システムの技術的な構成、セットアップ方法、開発者向けの情報を記載します。

## システム構成 (Architecture)

本システムは、モダンなWebアプリケーション構成を採用しています。

- **Frontend**: Next.js (React/TypeScript)
  - UIフレームワーク: Tailwind CSS
  - 状態管理: React Hooks (useState, useEffect, useContext)
  - データ取得: Fetch API -> Backend
- **Backend**: FastAPI (Python)
  - データベース: SQLite (`investment_app.db`)
  - ORM: SQLModel (SQLAlchemy wrapper)
  - タスクスケジューリング: Python `threading` + `schedule` logic
- **外部API**:
  - Yahoo Finance (`yfinance`): 株価・履歴データ取得
  - Gemini API (`google-generativeai`): 分析レポート生成

## ディレクトリ構造

ルートディレクトリ (`StockAnalysis/`) の主要な構成です。

```
StockAnalysis/
├── investment_app/          # アプリケーションコード
│   ├── backend/             # バックエンド (FastAPI)
│   │   ├── main.py          # エントリーポイント
│   │   ├── database.py      # DB設定・モデル定義
│   │   ├── routers/         # APIエンドポイント定義
│   │   ├── services/        # ビジネスロジック
│   │   └── scripts/         # ユーティリティ・マイグレーションスクリプト
│   └── frontend/            # フロントエンド (Next.js)
│       ├── app/             # ページコンポーネント (App Router)
│       ├── components/      # 共通コンポーネント
│       └── lib/             # APIクライアント、ユーティリティ
├── gemini_automation/       # AI分析自動化モジュール (独立スクリプトとして動作可能)
├── data/                    # データベースファイル保存場所
├── stockdata/               # 株価データキャッシュ (Parquet/CSVなど)
└── sec_filer_retriever/     # SECファイリング取得ツール (独立)
```

## セットアップと起動方法

### 前提条件
- Python 3.10+
- Node.js 18+

### 起動 (Windows)
ルートディレクトリにある以下のバッチファイルを使用します。

1. **バックエンド起動**: `start_backend.bat`
   - ポート: `8000`
   - Swagger Documentation: `http://localhost:8000/docs`

2. **フロントエンド起動**: `start_frontend.bat`
   - ポート: `3000`
   - アクセスURL: `http://localhost:3000`

### 開発時の注意点

#### データベースマイグレーション
SQLModelを使用していますが、Alembic等のマイグレーションツールは導入していません。
スキーマ変更時は `investment_app/backend/scripts/` 内のマイグレーションスクリプトを参照・作成して手動で適用するか、開発環境であればDBファイルを再作成してください。

#### 依存ライブラリの追加
- **Backend**: `investment_app/backend/requirements.txt` に追記し、`pip install -r requirements.txt` を実行。
- **Frontend**: `investment_app/frontend/package.json` に追記し、`npm install` を実行。

#### 環境変数
機密情報（APIキーなど）は `.env` ファイル、またはシステム環境変数で管理することを推奨します。
特に `GEMINI_API_KEY` はDeep Research機能に必須です。

## トラブルシューティング

- **Hydration failedエラー**:
  - ブラウザ拡張機能などがHTMLを変更した場合に発生することがあります。`layout.tsx` で `suppressHydrationWarning` を有効にしているため、通常は無視されます。

- **バックエンドに接続できない**:
  - `start_backend.bat` のコンソールを確認し、エラーが出ていないか確認してください。
  - フロントエンドの `lib/api.ts` で `API_URL` が `http://localhost:8000` になっているか確認してください。

- **株価データが更新されない**:
  - バックエンドログで `[Scheduler]` の出力を確認してください。市場休日やAPI制限の可能性があります。
