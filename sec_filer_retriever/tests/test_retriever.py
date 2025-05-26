import unittest
from unittest.mock import patch, Mock
import json

# Adjust the import path to correctly locate the retriever module
from sec_filer_retriever.retriever import (
    get_cik,
    get_sec_data,
    get_latest_filing_date,
    SecFilerRetriever
)
import requests # For requests.exceptions.RequestException & requests.exceptions.JSONDecodeError

# Sample SEC data for testing get_latest_filing_date and TestSecFilerRetriever
SAMPLE_SEC_DATA = {
    "cik": "0000320193",
    "entityType": "operating",
    "name": "Apple Inc.",
    "filings": {
        "recent": {
            "accessionNumber": ["0001193125-23-277577", "0000320193-23-000106", "0000320193-23-000077", "0000320193-23-000055"],
            "filingDate": ["2023-11-03", "2023-10-27", "2023-07-26", "2023-04-25"],
            "reportDate": ["2023-09-30", "2023-09-29", "2023-06-24", "2023-03-25"],
            "form": ["8-K", "10-K", "10-Q", "10-Q"],
            "primaryDocument": ["d516566d8k.htm", "aapl-20230930.htm", "aapl-20230624.htm", "aapl-20230325.htm"],
        }
    }
}

class TestGetCik(unittest.TestCase):
    @patch('sec_filer_retriever.retriever.StockMapper') # Changed Mapper to StockMapper
    def test_get_cik_valid_ticker(self, MockStockMapper):
        mock_mapper_instance = MockStockMapper.return_value
        mock_mapper_instance.ticker_to_cik.return_value = {'AAPL': '320193'}
        self.assertEqual(get_cik('AAPL'), '0000320193')
        mock_mapper_instance.ticker_to_cik.assert_called_once_with({'AAPL': 'AAPL'})

    @patch('sec_filer_retriever.retriever.StockMapper') # Changed Mapper to StockMapper
    def test_get_cik_invalid_ticker(self, MockStockMapper):
        mock_mapper_instance = MockStockMapper.return_value
        mock_mapper_instance.ticker_to_cik.return_value = {} # Ticker not found
        self.assertIsNone(get_cik('INVALID'))
        mock_mapper_instance.ticker_to_cik.assert_called_once_with({'INVALID': 'INVALID'})

    @patch('sec_filer_retriever.retriever.StockMapper') # Changed Mapper to StockMapper
    def test_get_cik_mapper_error(self, MockStockMapper):
        mock_mapper_instance = MockStockMapper.return_value
        mock_mapper_instance.ticker_to_cik.side_effect = Exception("Mapper failed")
        self.assertIsNone(get_cik('AAPL'))

    @patch('sec_filer_retriever.retriever.StockMapper') # Changed Mapper to StockMapper
    def test_get_cik_padding(self, MockStockMapper):
        mock_mapper_instance = MockStockMapper.return_value
        mock_mapper_instance.ticker_to_cik.return_value = {'XYZ': '12345'}
        self.assertEqual(get_cik('XYZ'), '0000012345')

    def test_get_cik_non_string_input(self):
        self.assertIsNone(get_cik(12345)) # type: ignore

    def test_get_cik_empty_string_input(self):
        self.assertIsNone(get_cik(""))


class TestGetSecData(unittest.TestCase):
    @patch('sec_filer_retriever.retriever.requests.get')
    def test_get_sec_data_success(self, mock_get):
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": "success"}
        mock_get.return_value = mock_response

        cik = "0000123456"
        email = "test@example.com"
        result = get_sec_data(cik, email)

        self.assertEqual(result, {"data": "success"})
        expected_url = f"https://data.sec.gov/submissions/CIK{cik}.json"
        mock_get.assert_called_once_with(expected_url, headers={"User-Agent": email}, timeout=10)

    @patch('sec_filer_retriever.retriever.requests.get')
    def test_get_sec_data_http_error(self, mock_get):
        mock_response = Mock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response
        self.assertIsNone(get_sec_data("0000123456", "test@example.com"))

    @patch('sec_filer_retriever.retriever.requests.get')
    def test_get_sec_data_request_exception(self, mock_get):
        mock_get.side_effect = requests.exceptions.RequestException("Connection error")
        self.assertIsNone(get_sec_data("0000123456", "test@example.com"))

    @patch('sec_filer_retriever.retriever.requests.get')
    def test_get_sec_data_json_decode_error(self, mock_get):
        mock_response = Mock()
        mock_response.status_code = 200
        if hasattr(requests.exceptions, 'JSONDecodeError'):
            mock_response.json.side_effect = requests.exceptions.JSONDecodeError("err", "doc", 0)
        else: 
             mock_response.json.side_effect = json.JSONDecodeError("err", "doc", 0)
        mock_get.return_value = mock_response
        self.assertIsNone(get_sec_data("0000123456", "test@example.com"))
        
    @patch('sec_filer_retriever.retriever.requests.get')
    def test_get_sec_data_json_decode_error_stdlib(self, mock_get):
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.side_effect = json.JSONDecodeError("err", "doc", 0) # stdlib json.JSONDecodeError
        mock_get.return_value = mock_response
        self.assertIsNone(get_sec_data("0000123456", "test@example.com"))


    def test_get_sec_data_invalid_cik_format(self):
        self.assertIsNone(get_sec_data("123", "test@example.com")) 
        self.assertIsNone(get_sec_data("ABCDEFGHIJ", "test@example.com")) 
        self.assertIsNone(get_sec_data("00000001234", "test@example.com")) 

    def test_get_sec_data_missing_user_agent(self):
        self.assertIsNone(get_sec_data("0000123456", ""))
        self.assertIsNone(get_sec_data("0000123456", None)) # type: ignore


class TestGetLatestFilingDate(unittest.TestCase):
    def test_found_10q_before_target(self):
        result = get_latest_filing_date(SAMPLE_SEC_DATA, "2023-08-01")
        self.assertEqual(result, "2023-07-26")

    def test_found_10k_before_target(self):
        result = get_latest_filing_date(SAMPLE_SEC_DATA, "2023-11-01")
        self.assertEqual(result, "2023-10-27") 

    def test_multiple_filings_correct_one_chosen(self):
        result = get_latest_filing_date(SAMPLE_SEC_DATA, "2023-09-01")
        self.assertEqual(result, "2023-07-26") 
        result2 = get_latest_filing_date(SAMPLE_SEC_DATA, "2024-01-01")
        self.assertEqual(result2, "2023-10-27")


    def test_no_matching_form_type(self):
        result = get_latest_filing_date(SAMPLE_SEC_DATA, "2023-12-01", form_types=['DEF 14A'])
        self.assertIsNone(result)

    def test_no_filings_before_target_date(self):
        result = get_latest_filing_date(SAMPLE_SEC_DATA, "2023-01-01")
        self.assertIsNone(result)

    def test_target_date_equals_filing_date(self):
        result = get_latest_filing_date(SAMPLE_SEC_DATA, "2023-07-26")
        self.assertEqual(result, "2023-07-26")

    def test_empty_filings_recent(self):
        empty_data = {"filings": {"recent": {}}}
        self.assertIsNone(get_latest_filing_date(empty_data, "2023-10-01"))
        missing_recent = {"filings": {}}
        self.assertIsNone(get_latest_filing_date(missing_recent, "2023-10-01"))
        missing_filings = {}
        self.assertIsNone(get_latest_filing_date(missing_filings, "2023-10-01"))
        no_filing_date_key = {"filings": {"recent": {"form": []}}}
        self.assertIsNone(get_latest_filing_date(no_filing_date_key, "2023-10-01"))
        empty_lists = {"filings": {"recent": {"filingDate": [], "form": []}}}
        self.assertIsNone(get_latest_filing_date(empty_lists, "2023-10-01"))


    def test_malformed_filing_date_in_data(self):
        malformed_data = {
            "filings": {
                "recent": {
                    "filingDate": ["2023-10-01", "NOT-A-DATE", "2023-09-01"],
                    "form": ["10-K", "10-Q", "10-Q"]
                }
            }
        }
        result = get_latest_filing_date(malformed_data, "2023-10-02")
        self.assertEqual(result, "2023-10-01") 

    def test_invalid_target_date_format(self):
        self.assertIsNone(get_latest_filing_date(SAMPLE_SEC_DATA, "2023/01/01"))
        self.assertIsNone(get_latest_filing_date(SAMPLE_SEC_DATA, "01-01-2023"))
        self.assertIsNone(get_latest_filing_date(SAMPLE_SEC_DATA, "Jan 1, 2023"))

    def test_inconsistent_data_lengths(self):
        inconsistent_data = {
            "filings": {
                "recent": {
                    "filingDate": ["2023-10-01"],
                    "form": ["10-K", "10-Q"] 
                }
            }
        }
        self.assertIsNone(get_latest_filing_date(inconsistent_data, "2023-10-02"))

    def test_input_validations(self):
        self.assertIsNone(get_latest_filing_date(None, "2023-10-01")) # type: ignore
        self.assertIsNone(get_latest_filing_date(SAMPLE_SEC_DATA, None)) # type: ignore
        self.assertIsNone(get_latest_filing_date(SAMPLE_SEC_DATA, "2023-10-01", None)) # type: ignore
        self.assertIsNone(get_latest_filing_date(SAMPLE_SEC_DATA, "2023-10-01", ["10-K", 123])) # type: ignore


class TestSecFilerRetriever(unittest.TestCase):
    def setUp(self):
        self.valid_email = "test@example.com"
        self.retriever = SecFilerRetriever(self.valid_email)

    def test_init_valid_user_agent(self):
        self.assertEqual(self.retriever.user_agent_email, self.valid_email)

    def test_init_invalid_user_agent(self):
        with self.assertRaises(ValueError):
            SecFilerRetriever("")
        with self.assertRaises(ValueError):
            SecFilerRetriever(None) # type: ignore

    @patch('sec_filer_retriever.retriever.get_latest_filing_date')
    @patch('sec_filer_retriever.retriever.get_sec_data')
    @patch('sec_filer_retriever.retriever.get_cik')
    def test_get_most_recent_filing_success(self, mock_get_cik, mock_get_sec_data, mock_get_latest_date):
        mock_get_cik.return_value = "0000123456"
        mock_get_sec_data.return_value = SAMPLE_SEC_DATA 
        mock_get_latest_date.return_value = "2023-10-27"

        result = self.retriever.get_most_recent_filing("ANYTICKER", "2023-12-31")
        self.assertEqual(result, "2023-10-27")
        mock_get_cik.assert_called_once_with("ANYTICKER")
        mock_get_sec_data.assert_called_once_with("0000123456", self.valid_email)
        mock_get_latest_date.assert_called_once_with(SAMPLE_SEC_DATA, "2023-12-31")

    @patch('sec_filer_retriever.retriever.get_cik')
    def test_get_most_recent_filing_ticker_not_found(self, mock_get_cik):
        mock_get_cik.return_value = None
        result = self.retriever.get_most_recent_filing("INVALIDTICKER", "2023-10-01")
        self.assertIsNone(result)
        mock_get_cik.assert_called_once_with("INVALIDTICKER")

    @patch('sec_filer_retriever.retriever.get_sec_data')
    @patch('sec_filer_retriever.retriever.get_cik')
    def test_get_most_recent_filing_sec_data_fails(self, mock_get_cik, mock_get_sec_data):
        mock_get_cik.return_value = "0000123456"
        mock_get_sec_data.return_value = None 
        result = self.retriever.get_most_recent_filing("ANYTICKER", "2023-10-01")
        self.assertIsNone(result)
        mock_get_sec_data.assert_called_once_with("0000123456", self.valid_email)

    @patch('sec_filer_retriever.retriever.get_latest_filing_date')
    @patch('sec_filer_retriever.retriever.get_sec_data')
    @patch('sec_filer_retriever.retriever.get_cik')
    def test_get_most_recent_filing_no_filing_found(self, mock_get_cik, mock_get_sec_data, mock_get_latest_date):
        mock_get_cik.return_value = "0000123456"
        mock_get_sec_data.return_value = SAMPLE_SEC_DATA
        mock_get_latest_date.return_value = None 
        result = self.retriever.get_most_recent_filing("ANYTICKER", "2023-01-01") 
        self.assertIsNone(result)
        mock_get_latest_date.assert_called_once_with(SAMPLE_SEC_DATA, "2023-01-01")

if __name__ == '__main__':
    unittest.main()
