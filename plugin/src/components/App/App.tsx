import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppRootProps } from '@grafana/data';

import { ROUTES } from '../../constants';
import OverviewPage from '../../pages/OverviewPage';
import AgentsPage from '../../pages/AgentsPage';
import AgentDetailPage from '../../pages/AgentDetailPage';
import HistoryPage from '../../pages/HistoryPage';
import RunDetailPage from '../../pages/RunDetailPage';

function App(_props: AppRootProps) {
  // Eager imports avoid Grafana SystemJS async-chunk load failures.
  return (
    <Routes>
      <Route path={ROUTES.Overview} element={<OverviewPage />} />
      <Route path={ROUTES.Agents} element={<AgentsPage />} />
      <Route path={`${ROUTES.Agents}/:agentId`} element={<AgentDetailPage />} />
      <Route path={ROUTES.History} element={<HistoryPage />} />
      <Route path={ROUTES.RunDetail} element={<RunDetailPage />} />
      <Route path="*" element={<Navigate to={ROUTES.Overview} replace />} />
    </Routes>
  );
}

export default App;
