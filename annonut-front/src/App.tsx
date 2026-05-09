import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ManualUpload from './pages/ManualUpload';
import DriveBatch from './pages/DriveBatch';
import WhitelistConfig from './pages/WhitelistConfig';

function App() {
  return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<ManualUpload />} />
            <Route path="drive" element={<DriveBatch />} />
            <Route path="whitelist" element={<WhitelistConfig />} />
          </Route>
        </Routes>
      </BrowserRouter>
  );
}

export default App;