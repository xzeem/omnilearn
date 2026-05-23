import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 bg-gray-50 font-sans">
      <h1 className="text-6xl font-black mb-4 text-indigo-600">404</h1>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h2>
      <p className="text-gray-500 font-medium mb-8">
        Oops! The page you are looking for doesn't exist or has been moved.
      </p>

      <Link
        to="/"
        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
      >
        Go Home
      </Link>
    </div>
  );
}