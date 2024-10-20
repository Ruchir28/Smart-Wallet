import React from 'react';
import { AnimatePresence } from 'framer-motion';
import Notification from './Notification';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { removeNotification } from '../store/notificationSlice';

const NotificationManager: React.FC = () => {
  const notifications = useSelector((state: RootState) => state.notification.notifications);
  const dispatch = useDispatch();

  const handleClose = (id: string) => {
    dispatch(removeNotification(id));
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-h-screen overflow-y-auto pr-2" style={{ maxWidth: '24rem' }}>
      <AnimatePresence>
        {notifications.map((notification) => (
          <Notification
            key={notification.id}
            {...notification}
            onClose={handleClose}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default NotificationManager;
