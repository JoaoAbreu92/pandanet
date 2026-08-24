import React from 'react';
import BannerManager from './BannerManager';
import AnnouncementManager from './AnnouncementManager';
// FIX: Correcting the import path for types.
import type { Banner, Announcement } from '../types';

interface DashboardProps {
  banners: Banner[];
  setBanners: (banners: Banner[]) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ banners, setBanners }) => {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-brand-text">Gerenciamento de Conteúdo</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <BannerManager banners={banners} setBanners={setBanners} />
        <AnnouncementManager />
      </div>
    </div>
  );
};

export default Dashboard;