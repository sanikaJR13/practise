"""Constants for the Maharashtra IGR scraper."""

from __future__ import annotations

import os

BASE_URL = "https://freesearchigrservice.maharashtra.gov.in/"

DEFAULT_ARTIFACT_ROOT = "runs_igr"
DEFAULT_CONNECT_TIMEOUT_SECONDS = 20
DEFAULT_TIMEOUT_SECONDS = 90
DEFAULT_MAX_HTTP_RETRIES = 4
DEFAULT_MAX_CAPTCHA_ATTEMPTS = 3
DEFAULT_MAX_OCR_ATTEMPTS = 5
DEFAULT_SEARCH_TYPE = "2"

DEFAULT_TESSERACT_CMD = os.environ.get("TESSERACT_CMD") or r"C:\Program Files\Tesseract-OCR\tesseract.exe"

REQUEST_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
REQUEST_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
REQUEST_ACCEPT_LANGUAGE = "en-US,en;q=0.9"
REQUEST_ACCEPT_ENCODING = "gzip, deflate, br"

BROKEN_PROXY_TARGETS = ("http://127.0.0.1:9", "http://localhost:9")
PROXY_ENV_VARS = ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy")

FIELD_EVENTTARGET = "__EVENTTARGET"
FIELD_EVENTARGUMENT = "__EVENTARGUMENT"
FIELD_LASTFOCUS = "__LASTFOCUS"
FIELD_ASYNCPOST = "__ASYNCPOST"
FIELD_SCRIPT_MANAGER = "ScriptManager1"
FIELD_VIEWSTATE = "__VIEWSTATE"
FIELD_VIEWSTATEGENERATOR = "__VIEWSTATEGENERATOR"
FIELD_EVENTVALIDATION = "__EVENTVALIDATION"

FIELD_DISTRICT = "ddlDistrict1"
FIELD_TALUKA = "ddltahsil"
FIELD_VILLAGE = "ddlvillage"
FIELD_YEAR = "ddlFromYear1"
FIELD_PROPERTY_NUMBER = "txtAttributeValue1"
FIELD_CAPTCHA = "txtImg1"
FIELD_PROPERTY_NUMBER_ALT = "FS_PropertyNumber"
FIELD_IGR_FLAG = "FS_IGR_FLAG"
FIELD_SEARCH_TYPE = "ctl00$ContentPlaceHolder1$rblSearchType"

BUTTON_OPEN_SEARCH = "btnOtherdistrictSearch"
BUTTON_OPEN_SEARCH_VALUE = "Rest of Maharashtra / उर्वरित महाराष्ट्र"
BUTTON_SEARCH = "btnSearch_RestMaha"
BUTTON_SEARCH_VALUE = "शोध / Search"

CAPTCHA_IMAGE_ID = "imgCaptcha_new"
RESULT_TABLE_ID = "RegistrationGrid"
NO_RECORDS_LABEL_ID = "lblMsgCTS1"
MAIN_UPDATE_PANEL = "UpMain"

FULL_POSTBACK_CONTROLS = {
    BUTTON_OPEN_SEARCH,
    FIELD_DISTRICT,
    FIELD_TALUKA,
    FIELD_VILLAGE,
}
