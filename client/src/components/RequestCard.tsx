import React from 'react';

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

interface RequestCardProps {
  request: Request;
  onAction?: (action: string, requestId: number) => void;
  userRole: string;
}

const RequestCard: React.FC<RequestCardProps> = ({ request, onAction, userRole }) => {
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'new': 'Новая',
      'assigned': 'Назначена',
      'in_progress': 'В работе',
      'done': 'Выполнена',
      'canceled': 'Отменена'
    };
    return statusMap[status] || status;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Заявка #{request.id}</h3>
        <span className={`status-badge status-${request.status}`}>
          {getStatusText(request.status)}
        </span>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Клиент:</strong> {request.clientName}<br />
        <strong>Телефон:</strong> {request.phone}<br />
        <strong>Адрес:</strong> {request.address}<br />
        <strong>Проблема:</strong> {request.problemText}<br />
        <strong>Создана:</strong> {formatDate(request.createdAt)}<br />
        {request.assignedTo && (
          <><strong>Мастер:</strong> {request.assignedTo.fullName}<br /></>
        )}
      </div>

      {onAction && (
        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          {userRole === 'dispatcher' && request.status === 'new' && (
            <>
              <button
                className="btn btn-primary"
                onClick={() => onAction('assign', request.id)}
              >
                Назначить мастера
              </button>
              <button
                className="btn btn-danger"
                onClick={() => onAction('cancel', request.id)}
              >
                Отменить
              </button>
            </>
          )}

          {userRole === 'master' && request.status === 'assigned' && (
            <button
              className="btn btn-primary"
              onClick={() => onAction('take', request.id)}
            >
              Взять в работу
            </button>
          )}

          {userRole === 'master' && request.status === 'in_progress' && (
            <button
              className="btn btn-primary"
              onClick={() => onAction('complete', request.id)}
            >
              Завершить
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default RequestCard;
