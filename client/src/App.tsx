import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import DispatcherPanel from './pages/DispatcherPanel';
import MasterPanel from './pages/MasterPanel';
import CreateRequest from './pages/CreateRequest';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/login" />} />
            
            <Route path="/dispatcher" element={
              <PrivateRoute role="dispatcher">
                <DispatcherPanel />
              </PrivateRoute>
            } />
            
            <Route path="/master" element={
              <PrivateRoute role="master">
                <MasterPanel />
              </PrivateRoute>
            } />
            
            <Route path="/create-request" element={
              <PrivateRoute>
                <CreateRequest />
              </PrivateRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
