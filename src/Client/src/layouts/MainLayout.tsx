import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export const MainLayout: React.FC = () => {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-viewport">
        <Header />
        <main className="content-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
