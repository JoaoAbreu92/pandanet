import React from 'react';
import BannerManager from './BannerManager';
import AnnouncementManager from './AnnouncementManager';

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-brand-text">Gerenciamento de Conteúdo</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <BannerManager />
        <AnnouncementManager />
      </div>
    </div>
  );
};

export default Dashboard;