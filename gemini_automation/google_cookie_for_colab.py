# ローカル環境で実行するスクリプト
import pickle
import time
from selenium import webdriver
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

options = uc.ChromeOptions()
# options.add_argument('--headless') # ヘッドレスモードで実行したい場合はコメントを外す
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

print("ブラウザを起動します...")
driver = uc.Chrome(options=options)

# ローカルのWebDriverを起動
driver.get("https://gemini.google.com/?hl=ja")

# ユーザーが手動でログインを完了するのを待つ
# ログイン後、このコンソールでEnterキーを押してください
input("Googleにログインし、2段階認証を完了させた後、Enterキーを押してください...")

# ログイン後のCookieを取得
cookies = driver.get_cookies()

pkl_path = "G:\\マイドライブ\\Investment\\google_cookies.pkl"

# Cookieをファイルに保存（pickle形式）
with open(pkl_path, "wb") as file:
    pickle.dump(cookies, file)

print(f"Cookieが '{pkl_path}' に保存されました。")