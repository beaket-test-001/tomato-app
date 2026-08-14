export function createNotifications(browserWindow = window) {
  const NotificationApi = browserWindow.Notification;
  return {
    permission: () => NotificationApi?.permission ?? 'unsupported',
    async requestPermission() {
      if (!NotificationApi || NotificationApi.permission === 'denied') return this.permission();
      try { return await NotificationApi.requestPermission(); }
      catch { return this.permission(); }
    },
    playSound() {
      try {
        const AudioContext = browserWindow.AudioContext || browserWindow.webkitAudioContext;
        if (!AudioContext) return;
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 660;
        gain.gain.setValueAtTime(0.08, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.2);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(); oscillator.stop(context.currentTime + 0.2);
      } catch { /* Optional browser capability. */ }
    },
    show(mode) {
      if (!NotificationApi || NotificationApi.permission !== 'granted') return;
      const body = mode === 'focus' ? 'Focus session complete. Time for a break.' : 'Break complete. Ready for your next focus session.';
      try { new NotificationApi('Tomato garden', { body }); }
      catch { /* Optional browser capability. */ }
    },
  };
}
