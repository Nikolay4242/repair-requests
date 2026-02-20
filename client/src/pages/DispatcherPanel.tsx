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

interface Master {
  id: number;
  fullName: string;
  username: string;
}

const DispatcherPanel: React.FC = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [masters, setMasters] = useState<Master[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [selectedMaster, setSelectedMaster] = useState<number>(0);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { status: filter } : {};
      const [requestsRes, mastersRes, statsRes] = await Promise.all([
        api.get('/requests', { params }),
        api.get('/users/masters'),
        api.get('/requests/stats')
      ]);
      
      setRequests(requestsRes.data);
      setMasters(mastersRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string, requestId: number) => {
    if (action === 'assign') {
      setSelectedRequest(requestId);
      setShowAssignModal(true);
    } else if (action === 'cancel') {
      if (window.confirm('Вы уверены, что хотите отменить заявку?')) {
        try {
          await api.patch(`/requests/${requestId}/cancel`);
          fetchData();
        } catch (error) {
          console.error('Error canceling request:', error);
        }
      }
    }
  };

  const handleAssign = async () => {
    if (!selectedMaster) {
      alert('Выберите мастера');
      return;
    }

    try {
      await api.patch(`/requests/${selectedRequest}/assign`, {
        masterId: selectedMaster
      });
      setShowAssignModal(false);
      setSelectedMaster(0);
      fetchData();
    } catch (error) {
      console.error('Error assigning master:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1>Панель диспетчера</h1>
        <div>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/create-request')}
            style={{ marginRight: '10px' }}
          >
            Создать заявку
          </button>
          <button className="btn btn-danger" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </div>

      {stats && (
        <div className="card" style={{ display: 'flex', gap: '20px', justifyContent: 'space-around' }}>
          <div><strong>Всего:</strong> {stats.total}</div>
          <div><strong>Новые:</strong> {stats.byStatus?.new || 0}</div>
          <div><strong>Назначены:</strong> {stats.byStatus?.assigned || 0}</div>
          <div><strong>В работе:</strong> {stats.byStatus?.in_progress || 0}</div>
          <div><strong>Выполнены:</strong> {stats.byStatus?.done || 0}</div>
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <label>Фильтр по статусу: </label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="form-control" style={{ width: '200px', display: 'inline-block', marginLeft: '10px' }}>
          <option value="all">Все</option>
          <option value="new">Новые</option>
          <option value="assigned">Назначенные</option>
          <option value="in_progress">В работе</option>
          <option value="done">Выполненные</option>
          <option value="canceled">Отмененные</option>
        </select>
      </div>

      {loading ? (
        <div>Загрузка...</div>
      ) : (
        <div>
          {requests.length === 0 ? (
            <p>Нет заявок</p>
          ) : (
            requests.map(request => (
              <RequestCard
                key={request.id}
                request={request}
                onAction={handleAction}
                userRole="dispatcher"
              />
            ))
          )}
        </div>
      )}

      {/* Модальное окно назначения мастера */}
      {showAssignModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div className="card" style={{ width: '400px' }}>
            <h3>Назначить мастера</h3>
            
            <div className="form-group">
              <label>Выберите мастера:</label>
              <select
                className="form-control"
                value={selectedMaster}
                onChange={(e) => setSelectedMaster(Number(e.target.value))}
              >
                <option value="0">Выберите...</option>
                {masters.map(master => (
                  <option key={master.id} value={master.id}>
                    {master.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-danger"
                onClick={() => setShowAssignModal(false)}
              >
                Отмена
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAssign}
              >
                Назначить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DispatcherPanel;
