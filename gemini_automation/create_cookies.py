import os
import pickle
import time
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import WebDriverException, TimeoutException

# 保存するCookieファイルのパス
# このパスは、メインのスクリ-プトと合わせてください。
runtime_folder = 'C:\\Users\\uchida\\GeminiAutomation'
COOKIE_FILE_PATH = f'{runtime_folder}\\google_cookies.pkl'

def save_google_cookies():
    """
    ユーザープロファイルを読み込んでGeminiにアクセスし、
    ログイン後のCookie情報をファイルに保存します。
    """
    print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! 重要 !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    print("このスクリプトは、普段お使いのChromeのログイン情報を利用してCookieファイルを作成します。")
    print("エラーを防ぐため、現在開いている全てのChromeウィンドウを手動で閉じてください。")
    input("全てのChromeウィンドウを閉じたら、Enterキーを押して続行してください...")
    print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")

    options = uc.ChromeOptions()
    driver = None

    try:
        user_name = os.getlogin()
        user_data_dir = os.path.join('C:', os.sep, 'Users', user_name, 'AppData', 'Local', 'Google', 'Chrome', 'User Data')
        
        options.add_argument(f'--user-data-dir={user_data_dir}')
        options.add_argument(r'--profile-directory=Default')
        options.add_argument('--disable-background-networking')
        options.add_argument('--disable-sync')

        print("ブラウザを起動しています...（この処理には少し時間がかかる場合があります）")
        # 安定性を向上させるため use_subprocess=True を追加
        driver = uc.Chrome(options=options, use_subprocess=True)

        print("Geminiにアクセスしています...")
        driver.get("https://gemini.google.com/?hl=ja")

        print("ログイン状態を確認しています...（最大30秒）")
        # ログイン後のアカウントアイコンが表示されるのを待つ
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "button[aria-label*='Google アカウント']"))
        )
        
        print("ログイン成功！Cookie情報を取得しています...")
        cookies = driver.get_cookies()

        print(f"Cookieを '{COOKIE_FILE_PATH}' に保存しています...")
        with open(COOKIE_FILE_PATH, 'wb') as f:
            pickle.dump(cookies, f)
        
        print("\n🎉 Cookieファイルの作成に成功しました！ 🎉")
        print("次回からはメインの自動化スクリプトを実行してください。")

    except TimeoutException:
        print("\nエラー: ログイン状態の確認がタイムアウトしました。")
        print("手動でChromeを起動し、Googleアカウントにログインできているか確認してください。")
    except WebDriverException as e:
        print(f"\nエラー: ブラウザの起動に失敗しました。")
        print(f"詳細: {e}")
        print("ヒント: タスクマネージャー(Ctrl+Shift+Esc)で 'chrome.exe' が残っていないか確認後、再試行してください。")
    except Exception as e:
        print(f"\n予期せぬエラーが発生しました: {e}")
    finally:
        if driver:
            driver.quit()
        print("ブラウザを閉じました。")

if __name__ == "__main__":
    save_google_cookies()
