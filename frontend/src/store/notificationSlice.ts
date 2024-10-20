import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface NotificationState {
  notifications: Notification[];
}

const initialState: NotificationState = {
  notifications: [],
};

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<Notification>) => {
      state.notifications.push(action.payload);
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        (notification) => notification.id !== action.payload
      );
    },
  },
});

export const { addNotification, removeNotification } = notificationSlice.actions;

// Thunk action to add a notification and remove it after a delay

export const addNotificationWithTimeout = createAsyncThunk(
  'notification/addNotificationWithTimeout',
  async (
    {notification,timeout = 5000}: {notification: Omit<Notification, 'id'>, timeout: number},thunkApi) => {
    const id = uuidv4();
    const fullNotification: Notification = { ...notification, id };
    thunkApi.dispatch(addNotification(fullNotification));
    setTimeout(() => {
      thunkApi.dispatch(removeNotification(id));
    }, timeout);
  }
);

export default notificationSlice.reducer;
