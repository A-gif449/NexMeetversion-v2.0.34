import { useState, useEffect, useCallback } from 'react';
// import NotificationService from '../utils/NotificationService';
import NotificationService from './NotificationService'


const useNotification = (firebaseApp) => {
  const [permission, setPermission] = useState(Notification?.permission || 'default');
  const [token, setToken] = useState(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (firebaseApp) {
      NotificationService.init(firebaseApp).then((success) => {
        setInitialized(success);
      });
    }
  }, [firebaseApp]);

  const requestPermission = useCallback(async () => {
    if (!initialized) return null;

    const fcmToken = await NotificationService.requestPermission();
    if (fcmToken) {
      setToken(fcmToken);
      setPermission('granted');
    }
    return fcmToken;
  }, [initialized]);

  // Expose notification triggers
  const notify = {
    userJoined: (userName) => NotificationService.notifyUserJoined(userName),
    userLeft: (userName) => NotificationService.notifyUserLeft(userName),
    newMessage: (userName, message) => NotificationService.notifyNewMessage(userName, message),
    meetingStarting: (meetingName) => NotificationService.notifyMeetingStarting(meetingName),
    playSound: (type) => NotificationService.playSound(type),
  };

  return {
    permission,
    token,
    initialized,
    requestPermission,
    notify,
  };
};

export default useNotification;