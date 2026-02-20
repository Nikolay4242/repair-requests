import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const CreateRequest: React.FC = () => {
  const [formData, setFormData] = useState({
    clientName: '',
    phone: '',
    address: '',
    problemText: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const navigate = useNavigate();
  const { user } = useAuth();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.clientName.trim()) {
      newErrors.clientName = 'Имя клиента обязательно';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Телефон обязателен';
    } else if (!/^\+?[0-9]{10,15}$/.test(formData.phone.replace(/[\s()-]/g, ''))) {
      newErrors.phone = 'Введите корректный телефон';
    }
    
    if (!formData.address.trim()) {
      newErrors.address = 'Адрес обязателен';
    }
    
    if (!formData.problemText.trim()) {
      newErrors.problemText = 'Описание проблемы обязательно';
    } else if (formData.problemText.length < 10) {
      newErrors.problemText = 'Описание должно быть не менее 10 символов';
    }
    
    return newErrors;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Очищаем ошибку для поля при изменении
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    setSuccess(false);

    try {
      await api.post('/requests', formData);
      setSuccess(true);
      setFormData({
        clientName: '',
        phone: '',
        address: '',
        problemText: ''
      });
      
      // Через 2 секунды перенаправляем в зависимости от роли
      setTimeout(() => {
        if (user?.role === 'dispatcher') {
          navigate('/dispatcher');
        } else {
          navigate('/master');
        }
      }, 2000);
    } catch (error) {
      console.error('Error creating request:', error);
      setErrors({ submit: 'Ошибка при создании заявки' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container">
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>
          Создание новой заявки
        </h1>

        {success && (
          <div className="success-message" style={{ 
            padding: '10px', 
            backgroundColor: '#e8f5e8', 
            borderRadius: '4px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            Заявка успешно создана! Перенаправление...
          </div>
        )}

        <form onSubmit={handleSubmit} className="card">
          <div className="form-group">
            <label>Имя клиента *</label>
            <input
              type="text"
              name="clientName"
              className="form-control"
              value={formData.clientName}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="Введите имя клиента"
            />
            {errors.clientName && <div className="error-message">{errors.clientName}</div>}
          </div>

          <div className="form-group">
            <label>Телефон *</label>
            <input
              type="tel"
              name="phone"
              className="form-control"
              value={formData.phone}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="+7 (999) 123-45-67"
            />
            {errors.phone && <div className="error-message">{errors.phone}</div>}
          </div>

          <div className="form-group">
            <label>Адрес *</label>
            <input
              type="text"
              name="address"
              className="form-control"
              value={formData.address}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="Введите адрес"
            />
            {errors.address && <div className="error-message">{errors.address}</div>}
          </div>

          <div className="form-group">
            <label>Описание проблемы *</label>
            <textarea
              name="problemText"
              className="form-control"
              rows={5}
              value={formData.problemText}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="Опишите проблему подробно"
            />
            {errors.problemText && <div className="error-message">{errors.problemText}</div>}
          </div>

          {errors.submit && <div className="error-message">{errors.submit}</div>}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => navigate(-1)}
              disabled={isSubmitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Создание...' : 'Создать заявку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRequest;
