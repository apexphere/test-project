import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { RunDetail } from './pages/RunDetail';
import { TestDetail } from './pages/TestDetail';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2 text-gray-900 hover:text-indigo-600">
              <span className="text-xl">📊</span>
              <span className="font-semibold">Test Reporter</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/runs/:runId" element={<RunDetail />} />
          <Route path="/tests/:testId" element={<TestDetail />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
