import * as Notifications from 'expo-notifications';

const DAILY_ID = 'strivo-daily-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function notifySessionComplete(): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Session complete 🎉',
        body: 'Your item has been added to your globe.',
      },
      trigger: null,
    });
  } catch {
    // silently fail
  }
}

export async function scheduleDailyReminder(
  hour: number,
  minute: number,
  name: string,
): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_ID,
      content: {
        title: 'Time to focus.',
        body: `Time to focus, ${name || 'friend'}. Your globe is waiting.`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  } catch {
    // silently fail
  }
}

export async function cancelDailyReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_ID);
  } catch {
    // silently fail
  }
}
