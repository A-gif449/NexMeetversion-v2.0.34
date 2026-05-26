importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyB-PE80cpAsdDUcSDRx4hk7ZxXppUKz1c4",
  authDomain: "nexmeet-8c0fc.firebaseapp.com",
  projectId: "nexmeet-8c0fc",
  storageBucket: "nexmeet-8c0fc.firebasestorage.app",
  messagingSenderId: "553491407340",
  appId: "1:553491407340:web:cacc569eaa3f658f5d60c9"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};

  self.registration.showNotification(title || 'NexMeet', {
    body: body || 'You have a new notification',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [100, 50, 100],
    tag: 'nexmeet-notification',
    renotify: true,
    actions: [
      { action: 'open', title: '🚀 Open NexMeet' },
      { action: 'close', title: 'Dismiss' }
    ],
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('https://nexmeet-8c0fc.web.app')
    );
  }
});