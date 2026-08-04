import React, { useState, useEffect } from 'react';
import { 
  Search, 
  FileText, 
  RefreshCw, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  MapPin, 
  Hash, 
  User, 
  Scale, 
  Layers,
  ChevronRight,
  TrendingUp,
  Briefcase,
  Globe,
  Phone,
  Shield,
  Clock,
  Sun
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:8001/api';

export default function App() {
  // Search form state
  const [district, setDistrict] = useState('');
  const [taluka, setTaluka] = useState('');
  const [village, setVillage] = useState('');
  const [surveyNumberPart1, setSurveyNumberPart1] = useState('');
  const [surveyNumber, setSurveyNumber] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [language, setLanguage] = useState('mr_in'); // default to mr_in for Marathi

  // Location dropdown options
  const [districts, setDistricts] = useState([]);
  const [talukas, setTalukas] = useState([]);
  const [villages, setVillages] = useState([]);
  const [surveyOptions, setSurveyOptions] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingSurveys, setLoadingSurveys] = useState(false);

  // Workflow execution state
  const [runId, setRunId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, initiating, captcha_pending, executing, success, failed
  const [captchaImage, setCaptchaImage] = useState(null);
  const [captchaMime, setCaptchaMime] = useState('image/png');
  const [captchaText, setCaptchaText] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [result, setResult] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState('data'); // 'data' or 'pdf'

  // Load districts on mount
  useEffect(() => {
    loadLocations();
  }, []);

  // Reload talukas when district changes
  useEffect(() => {
    if (district) {
      loadLocations(district);
      setTaluka('');
      setVillage('');
      setSurveyNumberPart1('');
      setSurveyNumber('');
      setSurveyOptions([]);
    } else {
      setTalukas([]);
      setVillages([]);
      setSurveyNumberPart1('');
      setSurveyNumber('');
      setSurveyOptions([]);
    }
  }, [district]);

  // Reload villages when taluka changes
  useEffect(() => {
    if (district && taluka) {
      loadLocations(district, taluka);
      setVillage('');
      setSurveyNumberPart1('');
      setSurveyNumber('');
      setSurveyOptions([]);
    } else {
      setVillages([]);
      setSurveyNumberPart1('');
      setSurveyNumber('');
      setSurveyOptions([]);
    }
  }, [taluka]);

  // Reset survey options when village changes
  useEffect(() => {
    setSurveyNumberPart1('');
    setSurveyNumber('');
    setSurveyOptions([]);
  }, [village]);

  const loadLocations = async (distVal = '', talVal = '') => {
    setLoadingLocations(true);
    try {
      let url = `${API_BASE_URL}/locations/options`;
      const params = [];
      if (distVal) params.push(`district_value=${distVal}`);
      if (talVal) params.push(`taluka_value=${talVal}`);
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      
      if (!distVal && !talVal) {
        setDistricts(data.districts || []);
      } else if (distVal && !talVal) {
        setTalukas(data.talukas || []);
      } else if (distVal && talVal) {
        setVillages(data.villages || []);
      }
    } catch (err) {
      console.error('Failed to load locations:', err);
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleSearchSurveys = async () => {
    if (!district || !taluka || !village || !surveyNumberPart1.trim()) {
      setErrorMessage('Please select district, taluka, village, and enter a base survey number.');
      return;
    }
    
    setLoadingSurveys(true);
    setErrorMessage(null);
    setSurveyOptions([]);
    setSurveyNumber('');

    try {
      const url = `${API_BASE_URL}/locations/surveys?district_value=${district}&taluka_value=${taluka}&village_value=${village}&survey_number_part1=${surveyNumberPart1.trim()}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to fetch survey options');
      }
      setSurveyOptions(data.surveys || []);
      if (data.surveys && data.surveys.length > 0) {
        setSurveyNumber(data.surveys[0].value);
      } else {
        setErrorMessage('No matching survey numbers found.');
      }
    } catch (err) {
      console.error('Failed to fetch survey options:', err);
      setErrorMessage(err.message || 'Failed to fetch survey options.');
    } finally {
      setLoadingSurveys(false);
    }
  };

  const handleStartSearch = async (e) => {
    e.preventDefault();
    if (!district || !taluka || !village || !surveyNumberPart1) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }
    if (!surveyNumber) {
      setErrorMessage('Please search and select a specific survey option from the dropdown.');
      return;
    }

    setStatus('initiating');
    setErrorMessage(null);
    setResult(null);
    setCaptchaText('');

    try {
      const res = await fetch(`${API_BASE_URL}/workflows/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          district,
          taluka,
          village,
          survey_number: surveyNumber,
          survey_number_part1: surveyNumberPart1,
          mobile: mobileNumber || null,
          language,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to start search');
      }

      setRunId(data.run_id);
      if (data.status === 'captcha_required') {
        setStatus('captcha_pending');
        setCaptchaImage(data.captcha_image_base64);
        setCaptchaMime(data.mime_type || 'image/png');
      } else {
        // Direct success (if cached or auto-resolved)
        setStatus('success');
        setResult(data.result);
        setActiveTab('pdf');
      }
    } catch (err) {
      setStatus('failed');
      setErrorMessage(err.message || 'An error occurred while initiating search.');
    }
  };

  const handleSubmitCaptcha = async (e) => {
    e.preventDefault();
    if (!captchaText.trim()) {
      setErrorMessage('Please enter the CAPTCHA text.');
      return;
    }

    setStatus('executing');
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/workflows/submit-captcha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run_id: runId,
          captcha_text: captchaText,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Captcha submission failed');
      }

      if (data.status === 'captcha_required') {
        // Incorrect captcha, reload
        setStatus('captcha_pending');
        setCaptchaImage(data.captcha_image_base64);
        setCaptchaMime(data.mime_type || 'image/png');
        setCaptchaText('');
        setErrorMessage(data.error || 'Incorrect captcha. Please try again.');
      } else if (data.status === 'success') {
        setStatus('success');
        setResult(data.result);
        setAlerts(data.result.alerts || []);
        setActiveTab('pdf');
      }
    } catch (err) {
      setStatus('failed');
      setErrorMessage(err.message || 'An error occurred during captcha submission.');
    }
  };

  const handleRefreshCaptcha = async () => {
    // In our backend, captcha refresh is done by submitting a blank or trigger value,
    // or we can start a new request. To keep it simple, starting a new search is cleanest,
    // but we can also trigger a refresh. Let's start the search again.
    setErrorMessage(null);
    setStatus('initiating');
    try {
      const res = await fetch(`${API_BASE_URL}/workflows/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          district,
          taluka,
          village,
          survey_number: surveyNumber,
          survey_number_part1: surveyNumberPart1,
          mobile: mobileNumber || null,
          language,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to refresh CAPTCHA');
      }

      setRunId(data.run_id);
      setStatus('captcha_pending');
      setCaptchaImage(data.captcha_image_base64);
      setCaptchaMime(data.mime_type || 'image/png');
      setCaptchaText('');
    } catch (err) {
      setStatus('failed');
      setErrorMessage(err.message || 'Failed to refresh CAPTCHA.');
    }
  };

  const handleReset = () => {
    setRunId(null);
    setStatus('idle');
    setCaptchaImage(null);
    setCaptchaText('');
    setErrorMessage(null);
    setResult(null);
    setAlerts([]);
    setSurveyNumberPart1('');
    setSurveyNumber('');
    setSurveyOptions([]);
    setActiveTab('data');
  };

  const handleDownloadPdf = () => {
    if (!runId) return;
    window.open(`${API_BASE_URL}/workflows/download-pdf/${runId}`, '_blank');
  };

  // Extract values safely for display
  const recordReport = result?.record_summary || result?.error || {};
  const headerData = result?.selected_labels || {};
  const parsedData = result?.record_summary ? JSON.parse(result.record_summary.record_json || '{}') : null;

  // Let's fallback to normalized fields
  const showResultReport = result && (result.record_summary || result.record_json);
  const finalReport = result?.record_summary || {};
  
  // Format area values
  const totalArea = result?.record_summary?.total_area_hectares || result?.record_summary?.total_area_acres || '-';
  const areaUnit = result?.record_summary?.total_area_hectares ? 'Hectares' : (result?.record_summary?.total_area_acres ? 'Acres' : '');

  return (
    <div className="app-container">
      {/* Top Navbar / Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="header-logo-container">
            {/* Government-style Seal Graphic */}
            <svg viewBox="0 0 100 100" className="w-9 h-9" fill="currentColor">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="3" />
              <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
              <path d="M50 20 L60 40 L80 45 L65 60 L70 80 L50 70 L30 80 L35 60 L20 45 L40 40 Z" fill="currentColor" opacity="0.8" />
              <circle cx="50" cy="50" r="12" fill="#f5f3ff" />
              <text x="50" y="54" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#6366f1">7/12</text>
            </svg>
          </div>
          <div className="header-title-section">
            <h1>MahaBhulekh <span>7/12 Utara</span> Extractor</h1>
            <p>Stateful land record scraper & high-fidelity PDF builder</p>
          </div>
        </div>
        <div className="header-controls">
          <div className="control-pill">
            <button 
              type="button"
              className={`pill-btn ${language === 'mr_in' ? 'active' : ''}`}
              onClick={() => setLanguage('mr_in')}
            >
              मराठी
            </button>
            <button 
              type="button"
              className={`pill-btn ${language === 'en_in' ? 'active' : ''}`}
              onClick={() => setLanguage('en_in')}
            >
              English
            </button>
          </div>
          <button type="button" className="theme-toggle-btn">
            <Sun size={16} />
          </button>
        </div>
      </header>

      {/* Two-Column Grid layout */}
      <div className="dashboard-grid">
        {/* Left Card: Search parameters or Captcha */}
        <div className="flex flex-col gap-6">
          <div className="premium-card">
            <div className="card-title-section">
              <div className="icon-wrapper"><MapPin size={18} /></div>
              <h2>Land Search Parameters</h2>
            </div>

            {errorMessage && (
              <div className="security-alert-box" style={{ borderColor: '#f87171', background: '#fef2f2', margin: '0 0 1.25rem 0' }}>
                <div className="icon-wrapper" style={{ color: '#ef4444' }}><AlertTriangle size={16} /></div>
                <div>
                  <h4 style={{ color: '#991b1b' }}>Error Occurred</h4>
                  <p style={{ color: '#b91c1c', fontSize: '0.75rem' }}>{errorMessage}</p>
                </div>
              </div>
            )}

            {status === 'idle' || status === 'initiating' || status === 'failed' ? (
              <form onSubmit={handleStartSearch} className="flex flex-col">
                {/* District and Taluka rows */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">District (जिल्हा) *</label>
                    <div className="input-container">
                      <span className="input-icon-left"><MapPin size={16} /></span>
                      <select 
                        value={district} 
                        onChange={(e) => setDistrict(e.target.value)}
                        className="form-control"
                        disabled={status === 'initiating'}
                      >
                        <option value="">Select District</option>
                        {districts.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Taluka (तालुका) *</label>
                    <div className="input-container">
                      <span className="input-icon-left"><MapPin size={16} /></span>
                      <select 
                        value={taluka} 
                        onChange={(e) => setTaluka(e.target.value)}
                        className="form-control"
                        disabled={!district || status === 'initiating'}
                      >
                        <option value="">Select Taluka</option>
                        {talukas.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Village row */}
                <div className="form-group">
                  <label className="form-label">Village (गाव) *</label>
                  <div className="input-container">
                    <span className="input-icon-left"><MapPin size={16} /></span>
                    <select 
                      value={village} 
                      onChange={(e) => setVillage(e.target.value)}
                      className="form-control"
                      disabled={!taluka || status === 'initiating'}
                    >
                      <option value="">Select Village</option>
                      {villages.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Survey rows */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Survey / Gat No. (Base) *</label>
                    <div className="search-input-group">
                      <input 
                        type="text" 
                        placeholder="e.g. 1 or 10"
                        value={surveyNumberPart1} 
                        onChange={(e) => setSurveyNumberPart1(e.target.value)}
                        className="form-control"
                        disabled={!village || status === 'initiating'}
                      />
                      <button
                        type="button"
                        onClick={handleSearchSurveys}
                        className="search-icon-btn"
                        disabled={!village || !surveyNumberPart1.trim() || loadingSurveys || status === 'initiating'}
                      >
                        {loadingSurveys ? (
                          <RefreshCw size={16} className="spinner" />
                        ) : (
                          <Search size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Select Survey Number Option *</label>
                    <select
                      value={surveyNumber}
                      onChange={(e) => setSurveyNumber(e.target.value)}
                      className="form-control"
                      disabled={status === 'initiating' || surveyOptions.length === 0}
                    >
                      <option value="">Select Survey Number</option>
                      {surveyOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Language Preference */}
                <div className="form-group">
                  <label className="form-label">Language Preference</label>
                  <div className="lang-selector-container">
                    <button
                      type="button"
                      className={`lang-block-btn ${language === 'mr_in' ? 'active' : ''}`}
                      onClick={() => setLanguage('mr_in')}
                    >
                      <Globe size={16} />
                      मराठी (Marathi)
                    </button>
                    <button
                      type="button"
                      className={`lang-block-btn ${language === 'en_in' ? 'active' : ''}`}
                      onClick={() => setLanguage('en_in')}
                    >
                      <Globe size={16} />
                      English (English)
                    </button>
                  </div>
                </div>

                {/* Mobile Number Row */}
                <div className="form-group">
                  <label className="form-label">Mobile Number (Optional)</label>
                  <div className="input-container">
                    <span className="input-icon-left"><Phone size={16} /></span>
                    <input 
                      type="tel" 
                      placeholder="Enter 10 digit mobile number"
                      value={mobileNumber} 
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="form-control"
                      disabled={status === 'initiating'}
                    />
                  </div>
                  <span className="text-[10px] text-text-muted mt-1 block">Used for registration and notifications</span>
                </div>

                {/* Submit Action */}
                <button 
                  type="submit" 
                  className="btn-scrape-main mt-2"
                  disabled={status === 'initiating'}
                >
                  {status === 'initiating' ? (
                    <>
                      <RefreshCw size={18} className="spinner" />
                      Connecting to Bhulekh...
                    </>
                  ) : (
                    <>
                      <Search size={18} />
                      Scrape Land Record
                    </>
                  )}
                </button>
              </form>
            ) : status === 'captcha_pending' || status === 'executing' ? (
              <div className="flex flex-col gap-4">
                <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Active Session ID</p>
                  <p className="font-mono text-xs font-semibold truncate text-primary mt-1">{runId}</p>
                </div>

                <div className="captcha-container-box">
                  <p className="text-sm font-semibold text-text-primary mb-2">Security Verification Required</p>
                  <div className="captcha-image-wrapper">
                    {captchaImage ? (
                      <img 
                        src={`data:${captchaMime};base64,${captchaImage}`} 
                        alt="Bhulekh Captcha"
                        className="captcha-img"
                      />
                    ) : (
                      <div className="w-[180px] h-[55px] bg-slate-100 animate-pulse flex items-center justify-center text-slate-400 text-xs">
                        Loading captcha...
                      </div>
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={handleRefreshCaptcha} 
                    className="lang-block-btn py-1.5 px-3 text-xs w-auto flex"
                    disabled={status === 'executing'}
                    style={{ padding: '0.4rem 1rem', height: 'auto' }}
                  >
                    <RefreshCw size={12} className="mr-1" />
                    Refresh Image
                  </button>
                </div>

                <form onSubmit={handleSubmitCaptcha} className="flex flex-col gap-3">
                  <div className="form-group">
                    <label className="form-label text-center">Enter CAPTCHA Code *</label>
                    <input 
                      type="text" 
                      placeholder="Enter verification letters"
                      value={captchaText}
                      onChange={(e) => setCaptchaText(e.target.value)}
                      className="form-control text-center font-bold tracking-widest text-lg"
                      style={{ paddingLeft: '1rem' }}
                      disabled={status === 'executing'}
                      autoFocus
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="btn-scrape-main"
                    disabled={status === 'executing'}
                  >
                    {status === 'executing' ? (
                      <>
                        <RefreshCw size={18} className="spinner" />
                        Fetching 7/12 record...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        Submit Verification
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <div className="text-center py-4">
                <CheckCircle2 size={48} className="text-status-success mx-auto mb-3" />
                <h3 className="text-lg font-bold">Extraction Completed</h3>
                <p className="text-xs text-text-secondary mt-1">
                  MahaBhulekh record successfully retrieved and structured.
                </p>
                <div className="flex gap-3 justify-center mt-6">
                  <button onClick={handleDownloadPdf} className="btn-scrape-main" style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>
                    <Download size={16} />
                    Download PDF
                  </button>
                  <button onClick={handleReset} className="lang-block-btn" style={{ padding: '0.75rem 1.5rem' }}>
                    Start Over
                  </button>
                </div>
              </div>
            )}

            {/* Shield Footer Box */}
            <div className="security-alert-box">
              <div className="icon-wrapper"><Shield size={16} /></div>
              <div>
                <h4>Your search session is secure and encrypted</h4>
                <p>We do not store your personal information without consent</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Features List OR Record details */}
        <div className="flex flex-col gap-6">
          {status === 'idle' ? (
            <div className="premium-card">
              <div className="card-title-section">
                <div className="icon-wrapper"><FileText size={18} /></div>
                <h2>About 7/12 Extractor</h2>
              </div>
              <p className="text-sm text-text-secondary mb-4">
                This tool helps you extract official 7/12 land records from MahaBhulekh portal in a few simple steps. Please provide accurate details to get precise results.
              </p>

              <div className="features-container">
                <div className="feature-item-row">
                  <div className="feature-icon-badge badge-green">
                    <FileText size={18} />
                  </div>
                  <div className="feature-details">
                    <h4>Accurate Data</h4>
                    <p>Fetch authentic land records directly from official MahaBhulekh portal.</p>
                  </div>
                </div>

                <div className="feature-item-row">
                  <div className="feature-icon-badge badge-blue">
                    <Shield size={18} />
                  </div>
                  <div className="feature-details">
                    <h4>Secure & Private</h4>
                    <p>Your data is encrypted and we respect your privacy.</p>
                  </div>
                </div>

                <div className="feature-item-row">
                  <div className="feature-icon-badge badge-orange">
                    <Clock size={18} />
                  </div>
                  <div className="feature-details">
                    <h4>Real-time Updates</h4>
                    <p>Get the most recent land record information available.</p>
                  </div>
                </div>

                <div className="feature-item-row">
                  <div className="feature-icon-badge badge-purple">
                    <Download size={18} />
                  </div>
                  <div className="feature-details">
                    <h4>High Quality PDF</h4>
                    <p>Download high-fidelity PDF with structured information.</p>
                  </div>
                </div>
              </div>

              <div className="how-it-works-panel">
                <h3>How it works?</h3>
                <div className="steps-timeline-row">
                  <div className="step-node">
                    <div className="step-circle">1</div>
                    <span className="step-label">Fill Location Details</span>
                  </div>
                  <span className="step-connector-arrow">→</span>
                  <div className="step-node">
                    <div className="step-circle">2</div>
                    <span className="step-label">Select Survey Number</span>
                  </div>
                  <span className="step-connector-arrow">→</span>
                  <div className="step-node">
                    <div className="step-circle">3</div>
                    <span className="step-label">Solve Captcha</span>
                  </div>
                  <span className="step-connector-arrow">→</span>
                  <div className="step-node">
                    <div className="step-circle">4</div>
                    <span className="step-label">Download PDF</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="premium-card flex flex-col min-h-[500px]">
              <div className="card-title-section" style={{ marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                <div className="icon-wrapper"><FileText size={20} /></div>
                <h2 style={{ flexGrow: 1 }}>
                  {status === 'success' ? '7/12 Land Record Details' : 'Structured 7/12 Information'}
                </h2>
                {status === 'success' && (
                  <div className="success-badge-container">
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669', display: 'inline-block' }}></span>
                    SUCCESS
                  </div>
                )}
              </div>

              {status === 'success' && (
                <div className="tab-container">
                  <button
                    type="button"
                    onClick={() => setActiveTab('data')}
                    className={`tab-btn ${activeTab === 'data' ? 'active' : ''}`}
                  >
                    Structured Data
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('pdf')}
                    className={`tab-btn ${activeTab === 'pdf' ? 'active' : ''}`}
                  >
                    PDF Document
                  </button>
                </div>
              )}

              {(status === 'initiating' || status === 'executing') && (
                <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
                  <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-indigo-500 spinner mb-4"></div>
                  <h3 className="font-bold text-text-primary mb-1">Scraper Running</h3>
                  <p className="text-xs text-text-muted max-w-[280px]">
                    {status === 'initiating' 
                      ? 'Navigating to Maharashtra Bhulekh portal...' 
                      : 'Submitting verification details and rendering output...'}
                  </p>
                </div>
              )}

              {status === 'captcha_pending' && (
                <div className="flex-grow flex flex-col items-center justify-center text-center p-8 text-text-muted">
                  <AlertTriangle size={48} className="mb-4 stroke-[1] text-status-warning" />
                  <h3 className="font-bold text-text-primary mb-1">CAPTCHA Required</h3>
                  <p className="text-xs max-w-[280px]">
                    Verify the CAPTCHA in the search panel to fetch the land registry record.
                  </p>
                </div>
              )}

              {status === 'failed' && (
                <div className="flex-grow flex flex-col items-center justify-center text-center p-8 text-text-muted">
                  <AlertTriangle size={48} className="mb-4 stroke-[1] text-status-error" />
                  <h3 className="font-bold text-text-primary mb-1">Execution Failed</h3>
                  <p className="text-xs max-w-[300px] text-status-error" style={{ wordBreak: 'break-word' }}>
                    {errorMessage}
                  </p>
                  <button onClick={handleReset} className="lang-block-btn mt-6" style={{ padding: '0.5rem 1.5rem', width: 'auto' }}>
                    Try Again
                  </button>
                </div>
              )}

              {status === 'success' && result && (
                <div className="flex flex-col gap-6 flex-grow">
                  {activeTab === 'data' ? (
                    <>
                      {/* Summary Metadata Grid */}
                      <div className="form-row" style={{ gap: '1rem', marginBottom: '0rem' }}>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-text-muted block font-bold uppercase">Survey Number</span>
                          <span className="text-sm font-bold text-text-primary mt-0.5 block">
                            {result.survey_number}
                          </span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-text-muted block font-bold uppercase">Total Area</span>
                          <span className="text-sm font-bold text-text-primary mt-0.5 block">
                            {totalArea} {areaUnit}
                          </span>
                        </div>
                      </div>

                      {/* Location Hierarchy Box */}
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col">
                        <span className="text-[10px] text-text-muted block font-bold uppercase mb-1">Location Hierarchy</span>
                        <div className="flex items-center gap-1 text-xs text-text-primary font-semibold">
                          <span>{headerData.district || result.input?.district}</span>
                          <ChevronRight size={12} className="text-text-muted" />
                          <span>{headerData.taluka || result.input?.taluka}</span>
                          <ChevronRight size={12} className="text-text-muted" />
                          <span>{headerData.village || result.input?.village}</span>
                        </div>
                      </div>

                      {/* Ownership Ledger section */}
                      <div className="flex flex-col gap-3">
                        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#4338ca' }}>
                          <User size={14} />
                          Ownership Ledger
                        </h3>

                        {/* Current Owners block */}
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <h4 className="text-[10px] font-bold text-status-success mb-2 uppercase tracking-wide">
                            Current Occupants / Owners (current_entries)
                          </h4>
                          {parsedData?.ownership?.current_entries?.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {parsedData.ownership.current_entries.map((owner, idx) => (
                                <div key={idx} className="flex justify-between items-center py-1.5 border-b border-slate-200 last:border-0 text-xs">
                                  <span className="font-semibold text-text-primary">{owner.owner_name}</span>
                                  <div className="flex gap-2">
                                    {owner.account_number && (
                                      <span className="text-[9px] bg-slate-200 px-1.5 py-0.5 rounded text-text-secondary font-bold">
                                        A/C: {owner.account_number}
                                      </span>
                                    )}
                                    {owner.area && (
                                      <span className="text-[9px] bg-indigo-50 px-1.5 py-0.5 rounded text-indigo-600 font-bold">
                                        Area: {owner.area}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-text-secondary">
                              {result.record_summary?.record_summary?.current_owner || 'No current owners extracted.'}
                            </p>
                          )}
                        </div>

                        {/* Historical Owners block */}
                        {parsedData?.ownership?.historical_struck_entries?.length > 0 && (
                          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <h4 className="text-[10px] font-bold text-text-muted mb-2 uppercase tracking-wide">
                              Struck-out / Historical Owners (historical_struck_entries)
                            </h4>
                            <div className="flex flex-col gap-2">
                              {parsedData.ownership.historical_struck_entries.map((owner, idx) => (
                                <div key={idx} className="flex justify-between items-center py-1.5 border-b border-slate-200 last:border-0 text-xs">
                                  <span className="text-text-muted italic line-through">{owner.owner_name}</span>
                                  <span className="text-[9px] bg-slate-200 px-1.5 py-0.5 rounded text-text-muted font-bold">
                                    Struck
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Crop Table section */}
                      {parsedData?.crop_table?.present && parsedData?.crop_table?.rows?.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#4338ca' }}>
                            <TrendingUp size={14} />
                            Crop Record Book (गाव नमुना बारा)
                          </h3>
                          <div className="overflow-x-auto" style={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                  <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#475569' }}>Year</th>
                                  <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#475569' }}>Season</th>
                                  <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#475569' }}>Crop Name</th>
                                  <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#475569' }}>Area</th>
                                </tr>
                              </thead>
                              <tbody>
                                {parsedData.crop_table.rows.map((row, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '0.5rem 0.75rem', color: '#0f172a' }}>{row[0] || '-'}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', color: '#475569' }}>{row[1] || '-'}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', color: '#0f172a' }}>{row[2] || '-'}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', color: '#0f172a' }}>{row[3] || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Actions footer */}
                      <div className="mt-auto pt-4 border-t border-slate-100">
                        <button onClick={handleDownloadPdf} className="btn-scrape-main">
                          <Download size={18} />
                          Download High-Fidelity 7/12 PDF
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="pdf-preview-container">
                      <div className="pdf-preview-header">
                        <span className="text-xs text-text-secondary">Official Satbara Document PDF Preview</span>
                        <button 
                          onClick={handleDownloadPdf} 
                          className="lang-block-btn py-1 px-3 text-xs flex items-center gap-1 w-auto"
                          style={{ height: 'auto', padding: '0.35rem 0.75rem' }}
                        >
                          <Download size={12} />
                          Download Copy
                        </button>
                      </div>
                      <iframe
                        src={`${API_BASE_URL}/workflows/view-pdf/${runId}`}
                        className="pdf-iframe"
                        title="7/12 Utara PDF Preview"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Section */}
      <footer className="app-footer">
        <div>
          © 2025 MahaBhulekh 7/12 Extractor <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold">v1.1.0</span> All rights reserved
        </div>
        <div style={{ marginRight: '1rem' }}>
          Made with <span style={{ color: '#ec4899' }}>❤️</span> for Maharashtra
        </div>

        {/* Skyline Silhouette Vector Graphic */}
        <div className="skyline-svg-container">
          <svg className="skyline-svg" viewBox="0 0 800 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,100 L0,90 L20,90 L20,80 L35,80 L35,95 L50,95 L50,70 L70,70 L70,100 M70,100 L70,60 L90,60 L90,100 M90,100 L95,100 L95,50 L120,50 L120,100 M120,100 L130,100 L130,75 L150,75 L150,100 M150,100 L170,100 L170,40 L195,40 L195,100 M195,100 L210,100 L210,85 L230,85 L230,100 M230,100 L250,100 L250,30 L280,30 L280,100 M280,100 L300,100 L300,65 L320,65 L320,100 M320,100 L350,100 L350,20 L390,20 L390,100 M390,100 L410,100 L410,70 L430,70 L430,100 M430,100 L450,100 L450,45 L480,45 L480,100 M480,100 L500,100 L500,80 L520,80 L520,100 M520,100 L540,100 L540,35 L570,35 L570,100 M570,100 L590,100 L590,60 L620,60 L620,100 M620,100 L650,100 L650,50 L680,50 L680,100 M680,100 L700,100 L700,75 L720,75 L720,100 M720,100 L740,100 L740,15 L780,15 L780,100 M780,100 L800,100 L800,90 L800,100" fill="#c7d2fe" />
          </svg>
        </div>
      </footer>
    </div>
  );
}
