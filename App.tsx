import React from 'react';
import ChinaMapDashboard from './components/ChinaMapDashboard';

const App: React.FC = () => {
  return (
    <div className="w-screen h-screen bg-[#02102b] text-white font-sans overflow-hidden">
      <ChinaMapDashboard />
    </div>
  );
};

export default App;