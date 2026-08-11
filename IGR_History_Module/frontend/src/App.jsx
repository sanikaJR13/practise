import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShieldAlert, History } from 'lucide-react';
import { PropertySearchPage } from '@/features/property-search/pages/PropertySearchPage';
import { WorkflowRunPage } from '@/features/workflow/pages/WorkflowRunPage';
import { IgrHistoryPage } from '@/features/records/pages/IgrHistoryPage';
import { Button } from '@/components/ui/Button';


// Create a client for react-query
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
    <div className="min-h-screen bg-background">
      {/* Top Header Navigation */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-outline-variant/15 px-6 z-50 flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.015)]">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-md">
            <History className="h-5 w-5" />
          </div>
          <span className="font-headline font-bold text-primary tracking-tight text-lg">
            PropJunction <span className="text-secondary font-medium">IGR</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-on-surface-variant font-semibold bg-surface-container-low px-3 py-1.5 rounded-full border">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Standalone Module V1.1
        </div>
      </header>

      {/* Main Content Page Container */}
      <main className="pt-20 pb-16">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <HeaderLayout>
          <Routes>
            <Route path="/" element={<PropertySearchPage />} />
            <Route path="/workflows/:runId" element={<WorkflowRunPage />} />
            <Route path="/records/igr/:propertyId" element={<IgrHistoryPage />} />
            <Route path="*" element={
              <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <ShieldAlert className="h-16 w-16 text-error animate-bounce" />
                <h2 className="text-2xl font-bold text-primary">Page Not Found</h2>
                <p className="text-on-surface-variant text-sm">The requested URL was not found on this standalone server.</p>
                <Link to="/"><Button tone="primary">Back to Search</Button></Link>
              </div>
            } />
          </Routes>
        </HeaderLayout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
