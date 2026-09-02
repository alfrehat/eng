import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { DashboardPage } from '../pages/DashboardPage';
import { AdminFoundationPage } from '../pages/AdminFoundationPage';
import { HealthCheckPage } from '../pages/HealthCheckPage';
import { LoginPage } from '../pages/LoginPage';
import { AdminStudioPage } from '../pages/AdminStudio/AdminStudioPage';
import { DynamicScreenRenderer } from '../components/DynamicRenderer/DynamicScreenRenderer';
import { ProjectsListPage } from '../pages/Projects/ProjectsListPage';
import { ProjectWorkspacePage } from '../pages/Projects/ProjectWorkspacePage';
import { TendersListPage } from '../pages/Tenders/TendersListPage';
import { TenderWorkspacePage } from '../pages/Tenders/TenderWorkspacePage';
import { ContractsListPage } from '../pages/Contracts/ContractsListPage';
import { ContractWorkspacePage } from '../pages/Contracts/ContractWorkspacePage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsListPage />} />
          <Route path="projects/:id" element={<ProjectWorkspacePage />} />
          <Route path="tenders" element={<TendersListPage />} />
          <Route path="tenders/:id" element={<TenderWorkspacePage />} />
          <Route path="contracts" element={<ContractsListPage />} />
          <Route path="contracts/:id" element={<ContractWorkspacePage />} />
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
