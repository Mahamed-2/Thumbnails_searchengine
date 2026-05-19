// src/App.tsx — Root application with routes
import { Routes, Route } from 'react-router-dom';
import Dashboard from '@pages/Dashboard';
import CollectionCenter from '@pages/CollectionCenter';
import DatasetBrowser from '@pages/DatasetBrowser';
import Analytics from '@pages/Analytics';
import Settings from '@pages/Settings';
import Layout from '@components/Layout';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="/collection" element={<CollectionCenter />} />
        <Route path="/dataset" element={<DatasetBrowser />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
