import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { 
  Building2, 
  FileText, 
  Layers, 
  History, 
  Home, 
  Search, 
  ShieldCheck 
} from 'lucide-react';

import { DashboardPage } from './pages/DashboardPage';
import Scraper712Page from './pages/Scraper712Page';
import Scraper8APage from './pages/Scraper8APage';
import { PropertySearchPage } from '@/features/property-search/pages/PropertySearchPage';
import { WorkflowRunPage } from '@/features/workflow/pages/WorkflowRunPage';
import { IgrHistoryPage } from '@/features/records/pages/IgrHistoryPage';

// Create TanStack Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false
    }
  }
});

function HeaderLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Global Navigation Header */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 dark:text-white tracking-tight text-lg leading-none">
                PropJunction
              </span>
              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase mt-0.5">
                Unified Extraction Portal
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <Home className="h-4 w-4" />
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/712"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50'
                }`
              }
            >
              <FileText className="h-4 w-4" />
              <span>7/12 Utara</span>
            </NavLink>

            <NavLink
              to="/8a"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/50'
                }`
              }
            >
              <Layers className="h-4 w-4" />
              <span>8A Khata</span>
            </NavLink>

            <NavLink
              to="/igr"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50'
                }`
              }
            >
              <History className="h-4 w-4" />
              <span>IGR History</span>
            </NavLink>
          </nav>

          {/* Backend Connection Indicator */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Backend: Port 8000
          </div>
        </div>
      </header>

      {/* Main Page Container */}
      <main className="flex-1">
        {children}
      </main>

      {/* Unified Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            PropJunction 1.2 Unified Platform &mdash; 7/12 | 8A | IGR Scrapers
          </div>
          <div>
            Connected to Unified Django Backend (<code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-600 font-mono">http://localhost:8000</code>)
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <HeaderLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/712" element={<Scraper712Page />} />
            <Route path="/8a" element={<Scraper8APage />} />
            
            {/* IGR Routes */}
            <Route path="/igr" element={<PropertySearchPage />} />
            <Route path="/igr/workflows/:runId" element={<WorkflowRunPage />} />
            <Route path="/igr/records/igr/:propertyId" element={<IgrHistoryPage />} />
            
            {/* Fallback routes for direct IGR links */}
            <Route path="/workflows/:runId" element={<WorkflowRunPage />} />
            <Route path="/records/igr/:propertyId" element={<IgrHistoryPage />} />

            {/* 404 Catch All */}
            <Route path="*" element={
              <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center px-4">
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center text-2xl font-bold">
                  404
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Page Not Found</h2>
                <p className="text-slate-500 text-sm max-w-md">The requested page could not be found. Please choose one of the extraction modules above.</p>
                <Link to="/" className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl text-sm hover:bg-indigo-700 transition-colors">
                  Return to Dashboard
                </Link>
              </div>
            } />
          </Routes>
        </HeaderLayout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
