import { format } from 'date-fns';

type WorkingHours = Record<string, { open: string; close: string } | null> | null;

const WEEKDAY_MAP: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

/**
 * Returns the next `count` working days starting from today (inclusive if today is a working day).
 * Uses `workingHours` from the instance to determine which days are open.
 * Falls back to Mon-Fri if workingHours is null/undefined.
 */
export function getNextWorkingDays(count: number, workingHours: WorkingHours): string[] {
  const dates: string[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);

  // Treat null/undefined/empty object as "no config" → fallback to Mon-Fri
  const hasConfig = workingHours != null && Object.keys(workingHours).length > 0;

  // Safety: max 30 iterations to avoid infinite loops
  let iterations = 0;
  while (dates.length < count && iterations < 30) {
    const dayKey = WEEKDAY_MAP[d.getDay()];
    
    if (!hasConfig) {
      // Fallback: skip Saturday (6) and Sunday (0)
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        dates.push(format(d, 'yyyy-MM-dd'));
      }
    } else {
      // Check if this day is open in working_hours
      if (workingHours![dayKey] != null) {
        dates.push(format(d, 'yyyy-MM-dd'));
      }
    }

    d.setDate(d.getDate() + 1);
    iterations++;
  }

  return dates;
}
