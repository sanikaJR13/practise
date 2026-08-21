import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Layers, 
  Search, 
  History, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  Server, 
  Database,
  Building2,
  MapPin,
  ExternalLink
} from 'lucide-react';

export function DashboardPage() {
  const [backendStatus, setBackendStatus] = useState('checking');

  useEffect(() => {
    fetch('/api/712/locations/options')
      .then(res => res.ok ? setBackendStatus('online') : setBackendStatus('offline'))
      .catch(() => setBackendStatus('offline'));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 sm:p-12 text-white shadow-2xl border border-slate-800">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold tracking-wide uppercase">
            <ShieldCheck className="w-4 h-4" />
            PropJunction Unified Portal v1.2
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Maharashtra Land & Property Intelligence
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
            Unified extraction portal for MahaBhulekh 7/12 land records, 8A Khata holding registers, and IGR registration history forensics in one seamless system.
          </p>

          <div className="pt-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              Unified API Port 8000
            </div>
            <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              SQLite DB Connected
            </div>
            <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300">
              <span className={`w-2 h-2 rounded-full ${backendStatus === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              Backend Status: <span className="capitalize font-semibold text-white">{backendStatus}</span>
            </div>
          </div>
        </div>

        {/* Decorative Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none"></div>
      </div>

      {/* Module Selection Cards Grid */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-600" />
          Select Extraction Module
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: 7/12 Utara */}
          <Link to="/712" className="group relative bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-indigo-500/50 transition-all duration-300 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl font-bold group-hover:scale-110 transition-transform">
                7/12
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors flex items-center justify-between">
                7/12 Utara (सातबारा)
                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Village Form XII land ownership record from MahaBhulekh. Extract crop data, tenure status, area breakdown, and generate high-fidelity PDF reports.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">MahaBhulekh Portal</span>
              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">Form XII</span>
            </div>
          </Link>

          {/* Card 2: 8A Khata */}
          <Link to="/8a" className="group relative bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-cyan-500/50 transition-all duration-300 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center text-xl font-bold group-hover:scale-110 transition-transform">
                8A
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 transition-colors flex items-center justify-between">
                8A Khata (आठ-अ)
                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Village Form VIII-A holding register. Scrape complete landholder accounts, multiple survey parcels, tax assessment rates, and aggregate holdings.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-cyan-600 dark:text-cyan-400">MahaBhulekh Portal</span>
              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">Form VIII-A</span>
            </div>
          </Link>

          {/* Card 3: IGR History */}
          <Link to="/igr" className="group relative bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-amber-500/50 transition-all duration-300 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl font-bold group-hover:scale-110 transition-transform">
                IGR
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors flex items-center justify-between">
                IGR History Forensics
                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Multi-year registration history from Inspector General of Registration. Auto-solve CAPTCHA OCR, multi-year deed timelines, and ownership chain analysis.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-amber-600 dark:text-amber-400">IGR Free Search</span>
              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">Multi-Year</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Unified Capabilities</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold block text-slate-800 dark:text-slate-200">Unified Django Server</span>
              <span className="text-slate-500">All 3 backends mounted on single port 8000</span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold block text-slate-800 dark:text-slate-200">Single Frontend Server</span>
              <span className="text-slate-500">One Vite app serving all 3 modules on port 5173</span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold block text-slate-800 dark:text-slate-200">Automatic OCR Solving</span>
              <span className="text-slate-500">Tesseract OCR integration for automated IGR lookup</span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold block text-slate-800 dark:text-slate-200">PDF Generator Engine</span>
              <span className="text-slate-500">HTML & ReportLab fallback print-to-PDF drivers</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
