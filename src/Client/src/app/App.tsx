import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { DashboardPage } from '../pages/DashboardPage';
import { AdminFoundationPage } from '../pages/AdminFoundationPage';
import { HealthCheckPage } from '../pages/HealthCheckPage';
import { LoginPage } from '../pages/LoginPage';
import { AdminStudioPage } from '../pages/AdminStudio/AdminStudioPage';
import { DynamicScreenRenderer } from '../components/DynamicRenderer/DynamicScreenRenderer';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="admin" element={<AdminFoundationPage />} />
          <Route path="admin/studio" element={<AdminStudioPage />} />
          <Route path="health-check" element={<HealthCheckPage />} />
          <Route path="dynamic/:screenCode" element={<DynamicScreenRenderer />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
