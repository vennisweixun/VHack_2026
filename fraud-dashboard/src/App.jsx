import React, { useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Transactions from './pages/Transactions';
import FraudAlerts from './pages/FraudAlerts';
import AnomalyAlerts from './pages/AnomalyAlerts';
import TransactionDetail from './pages/TransactionDetail';
import Settings from './pages/Settings';
import Auth from './pages/Auth';
import { useTransactions } from './hooks/useTransactions';

function App() {
  const {
    transactions, lastUpdated, isRefreshing, newCount, refresh,
    activityLog, processingCount, apiConnected, updateLocalStatus,
  } = useTransactions();

  const fraudCount   = useMemo(() => transactions.filter(t => t.is_fraud_alert).length,   [transactions]);
  const anomalyCount = useMemo(() => transactions.filter(t => t.is_anomaly_alert).length, [transactions]);

  const sharedProps = { transactions, lastUpdated, isRefreshing, newCount, onRefresh: refresh };

  return (
    <BrowserRouter>
      <Routes>
        {/* 1. Standalone auth route — no sidebar/Layout */}
        <Route path="/login" element={<Auth />} />

        {/* 2. Dashboard routes — wrapped in sidebar Layout */}
        <Route
          path="/*"
          element={
            <Layout fraudCount={fraudCount} anomalyCount={anomalyCount}>
              <Routes>
                <Route path="/"               element={<Overview     {...sharedProps} />} />
                <Route path="/transactions"   element={<Transactions {...sharedProps} />} />
                {/* merged: added onStatusUpdate from main */}
                <Route path="/fraud-alerts"   element={<FraudAlerts  {...sharedProps} onStatusUpdate={updateLocalStatus} />} />
                <Route path="/anomaly-alerts" element={<AnomalyAlerts {...sharedProps} />} />
                <Route path="/transaction/:id" element={<TransactionDetail transactions={transactions} />} />
                <Route
                  path="/settings"
                  element={
                    <Settings
                      activityLog={activityLog}
                      processingCount={processingCount}
                      apiConnected={apiConnected}
                      {...sharedProps}
                    />
                  }
                />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;