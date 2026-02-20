import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import RequestCard from '../components/RequestCard';

interface Request {
  id: number;
  clientName: string;
  phone: string;
  address: string;
  problemText: string;
  status: string;
  assignedTo?: {
    id: number;
    fullName: string;
  };
  createdAt: string;
}

const MasterPanel: React.FC = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/requests');
      setRequests(response.data);
    } catch (error: any) {
      console.error('Error fetching requests:', error);
      setError(error.response?.data?.message || 'Ошибка загрузки заявок');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string, requestId: number) => {
    try {
      setError(null);
      
      if (action === 'take') {
        await api.patch(`/requests/${requestId}/take-to-work`);
      } else if (action === 'complete') {
        await api.patch(`/requests/${requestId}/complete`);
      }
      
      await fetchRequests();
    } catch (error: any) {
      console.error(`Error ${action} request:`, error);
      
      if (error.response?.status === 409) {
        setError('Эта заявка уже была взята в работу другим мастером');
      } else {
        setError(error.response?.data?.message || `Ошибка при выполнении операции`);
      }
      
      // Обновляем список чтобы увидеть актуальный статус
      fetchRequests();
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1>Панель мастера</h1>
        <div>
          <span style={{ marginRight: '20px', fontWeight: 'bold' }}>
            {user?.fullName || user?.username}
          </span>
          <button className="btn btn-danger" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message" style={{ 
          padding: '10px', 
          backgroundColor: '#ffebee', 
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div>Загрузка заявок...</div>
      ) : (
        <div>
          <h2>Мои заявки</h2>
          
          {requests.length === 0 ? (
            <p>У вас нет назначенных заявок</p>
          ) : (
            requests.map(request => (
              <RequestCard
                key={request.id}
                request={request}
                onAction={handleAction}
                userRole="master"
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default MasterPanel;
