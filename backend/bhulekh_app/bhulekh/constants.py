"""Central constants for the Bhulekh request workflow."""

from __future__ import annotations

BASE_URL = "https://bhulekh.mahabhumi.gov.in/"

DEFAULT_LANGUAGE = "mr_in"
DEFAULT_RECORD_TYPE = "SelectSatbara"
DEFAULT_SEARCH_TYPE_RADIO = "17"
DEFAULT_SEARCH_TYPE_DROPDOWN = "2"
DEFAULT_RBTN_ULPIN = "Know-no"

DEFAULT_TIMEOUT_SECONDS = 15
DEFAULT_CONNECT_TIMEOUT_SECONDS = 10
DEFAULT_MAX_HTTP_RETRIES = 1
DEFAULT_MAX_MOBILE_RETRIES = 3
DEFAULT_MAX_CAPTCHA_ATTEMPTS = 10
DEFAULT_MAX_DROPDOWN_REFRESH_ATTEMPTS = 1
DEFAULT_MAX_WORKFLOW_REPLAYS = 2
DEFAULT_CAPTCHA_MIN_LENGTH = 4
DEFAULT_CAPTCHA_MAX_LENGTH = 8
DEFAULT_CAPTCHA_IMAGE_CLICK_X = "12"
DEFAULT_CAPTCHA_IMAGE_CLICK_Y = "12"

DEFAULT_ARTIFACT_ROOT = "runs"

REQUEST_USER_AGENT = (
    "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36"
)

REQUEST_ACCEPT = "*/*"
REQUEST_ACCEPT_LANGUAGE = "en-US,en;q=0.9"
REQUEST_ACCEPT_ENCODING = "gzip, deflate, br"
REQUEST_CACHE_CONTROL = "no-cache"
REQUEST_PRAGMA = "no-cache"
REQUEST_ORIGIN = "https://bhulekh.mahabhumi.gov.in"

FIELD_SCRIPT_MANAGER = "ctl00$ContentPlaceHolder1$ScriptManager1"
UPDATE_PANEL_UNIQUE_ID = "ctl00$ContentPlaceHolder1$UpdatePanel1"
UPDATE_PANEL_CLIENT_ID = "ContentPlaceHolder1_UpdatePanel1"

FIELD_EVENTTARGET = "__EVENTTARGET"
FIELD_EVENTARGUMENT = "__EVENTARGUMENT"
FIELD_LASTFOCUS = "__LASTFOCUS"
FIELD_VIEWSTATE = "__VIEWSTATE"

FIELD_RBTN_ULPIN = "ctl00$ContentPlaceHolder1$rbtnULPIN"
FIELD_RECORD_TYPE = "ctl00$ContentPlaceHolder1$rbtnSelectType"
FIELD_DISTRICT = "ctl00$ContentPlaceHolder1$ddlMainDist"
FIELD_TALUKA = "ctl00$ContentPlaceHolder1$ddlTalForAll"
FIELD_VILLAGE = "ctl00$ContentPlaceHolder1$ddlVillForAll"
FIELD_SEARCH_TYPE_RADIO = "ctl00$ContentPlaceHolder1$rbtnSearchType"
FIELD_SEARCH_TYPE_DROPDOWN = "ctl00$ContentPlaceHolder1$ddlSelectSearchType"
FIELD_SURVEY_TEXT = "ctl00$ContentPlaceHolder1$txtcsno"
FIELD_SURVEY_DROPDOWN = "ctl00$ContentPlaceHolder1$ddlsurveyno"
FIELD_MOBILE = "ctl00$ContentPlaceHolder1$txtmobile1"
FIELD_LANGUAGE = "ctl00$ContentPlaceHolder1$ddllangforAll"
FIELD_CAPTCHA = "ctl00$ContentPlaceHolder1$txtcaptcha"

BUTTON_SEARCH = "ctl00$ContentPlaceHolder1$btnsearchfind"
BUTTON_SEARCH_VALUE = "à¤¶à¥‹à¤§à¤¾(Search)"
BUTTON_SUBMIT = "ctl00$ContentPlaceHolder1$btnmainsubmit"
BUTTON_SUBMIT_VALUE = "Submit"
BUTTON_CAPTCHA_REFRESH = "ctl00$ContentPlaceHolder1$btnreferesh"
BUTTON_RESET = "ctl00$ContentPlaceHolder1$btnresetforall"

HTML_ID_DISTRICT = "ContentPlaceHolder1_ddlMainDist"
HTML_ID_TALUKA = "ContentPlaceHolder1_ddlTalForAll"
HTML_ID_VILLAGE = "ContentPlaceHolder1_ddlVillForAll"
HTML_ID_SURVEY_TEXT = "ContentPlaceHolder1_txtcsno"
HTML_ID_SURVEY_DROPDOWN = "ContentPlaceHolder1_ddlsurveyno"
HTML_ID_MOBILE = "ContentPlaceHolder1_txtmobile1"
HTML_ID_LANGUAGE = "ContentPlaceHolder1_ddllangforAll"
HTML_ID_CAPTCHA = "ContentPlaceHolder1_txtcaptcha"
HTML_ID_CAPTCHA_IMAGE = "ContentPlaceHolder1_captchaImage"
HTML_ID_RESULT_IMAGE = "ContentPlaceHolder1_ImgPC"

DEFAULT_STATE_HIDDEN_FIELDS = (
    FIELD_EVENTTARGET,
    FIELD_EVENTARGUMENT,
    FIELD_LASTFOCUS,
    FIELD_VIEWSTATE,
    "ctl00$ContentPlaceHolder1$hfoption",
    "ctl00$ContentPlaceHolder1$hfsaltstr",
    "ctl00$ContentPlaceHolder1$HiddenField1",
    "ctl00$ContentPlaceHolder1$HiddenField2",
    "ctl00$ContentPlaceHolder1$HiddenField3",
    "ctl00$ContentPlaceHolder1$HiddenField4",
    "ctl00$ContentPlaceHolder1$HiddenField5",
    "ctl00$ContentPlaceHolder1$HiddenField6",
    "ctl00$ContentPlaceHolder1$HiddenField7",
    "ctl00$ContentPlaceHolder1$HiddenField8",
    "ctl00$ContentPlaceHolder1$HiddenField9",
    "ctl00$ContentPlaceHolder1$hfdesig",
    "ctl00$ContentPlaceHolder1$hfcode",
    "ctl00$ContentPlaceHolder1$hfcaptchacheck",
    "ctl00$ContentPlaceHolder1$hfcaptchacheckPOSTING",
)

KNOWN_RESULT_MARKERS = (
    "à¤—à¤¾à¤µ à¤¨à¤®à¥à¤¨à¤¾",
    "Village Form XII",
    "ContentPlaceHolder1_ImgPC",
    "à¤ªà¥à¤°à¤²à¤‚à¤¬à¤¿à¤¤ à¤«à¥‡à¤°à¤«à¤¾à¤°",
    "à¤¶à¥‡à¤µà¤Ÿà¤šà¤¾ à¤«à¥‡à¤°à¤«à¤¾à¤°",
    "à¤­à¥‚à¤®à¤¾à¤ªà¤¨ à¤•à¥à¤°à¤®à¤¾à¤‚à¤• à¤µ à¤‰à¤ªà¤µà¤¿à¤­à¤¾à¤—",
)

KNOWN_SESSION_EXPIRED_MARKERS = (
    "session expired",
    "invalid viewstate",
    "state information is invalid",
    "invalid eventvalidation",
    "object moved",
    "request verification",
)

KNOWN_CAPTCHA_ERROR_MARKERS = (
    "invalid captcha",
    "wrong captcha",
    "please enter valid captcha",
    "कृपया योग्य सांकेतिक क्रमांक भरा",
    "योग्य सांकेतिक क्रमांक भरा",
    "सांकेतिक क्रमांक चुकीचा",
)

KNOWN_CAPTCHA_EXPIRED_MARKERS = (
    "captcha expired",
    "captcha image is missing",
    "enter valid captcha",
)

KNOWN_MOBILE_ERROR_MARKERS = (
    "invalid mobile",
    "please enter valid mobile",
    "कृपया योग्य मोबाईल क्रमांक भरा",
    "योग्य मोबाईल क्रमांक भरा",
    "मोबाईल क्रमांक चुकीचा",
)

KNOWN_SURVEY_ERROR_MARKERS = (
    "record not found",
    "not found",
    "survey not found",
    "गट नंबर सापडला नाही",
    "सर्वे नंबर सापडला नाही",
)

KNOWN_SUCCESS_ALERT_MARKERS = (
    "confirmation",
    "à¤«à¥‡à¤°à¤«à¤¾à¤°",
)

RETRYABLE_HTTP_STATUS_CODES = (408, 429, 500, 502, 503, 504)
