// Calendar Reminder Generator
// Creates a recurring daily reminder in Google Calendar or downloadable .ics format
// Allows users to receive notifications even when their browser and app are closed.

export function getGoogleCalendarRecurringUrl(timeStr: string, customMessage?: string): string {
  // Parse "HH:MM" e.g. "20:30"
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10) || 20;
  const minutes = parseInt(minutesStr, 10) || 30;

  // Use today's date
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes + 15, 0);

  const formatCalTime = (d: Date) => {
    return d.toISOString().replace(/-|:|\.\d+/g, '');
  };

  const title = encodeURIComponent('🌱 Daily Journal & Reflection — Reflections');
  const details = encodeURIComponent(
    customMessage ||
      'Pause for a mindful 5-minute pause. Open your Reflections Journal to unpack thoughts and discover clarity.'
  );
  const dates = `${formatCalTime(start)}/${formatCalTime(end)}`;

  // Recur daily: RRULE:FREQ=DAILY
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dates}&recur=RRULE:FREQ=DAILY`;
}

export function downloadIcsCalendarReminder(timeStr: string, customMessage?: string) {
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10) || 20;
  const minutes = parseInt(minutesStr, 10) || 30;

  const now = new Date();
  const startYear = now.getFullYear();
  const startMonth = String(now.getMonth() + 1).padStart(2, '0');
  const startDay = String(now.getDate()).padStart(2, '0');
  const startHours = String(hours).padStart(2, '0');
  const startMinutes = String(minutes).padStart(2, '0');

  const dtstart = `${startYear}${startMonth}${startDay}T${startHours}${startMinutes}00`;
  const dtend = `${startYear}${startMonth}${startDay}T${startHours}${String(
    (minutes + 15) % 60
  ).padStart(2, '0')}00`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Reflections Journal//Daily Reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:reflections-daily-reminder-${Date.now()}@reflections.app`,
    `DTSTAMP:${dtstart}Z`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    'RRULE:FREQ=DAILY',
    'SUMMARY:🌱 Daily Journal & Reflection',
    `DESCRIPTION:${customMessage || 'Take a moment for your daily mindful reflection.'}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT5M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Daily reflection time',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'daily-reflection-reminder.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
