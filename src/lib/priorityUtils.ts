export const PRIORITY_CONFIG: Record<number, { label: string; badgeCls: string }> = {
  1: { label: 'Krytyczny', badgeCls: 'bg-red-100 text-red-700 border-red-300' },
  2: { label: 'Wysoki', badgeCls: 'bg-orange-100 text-orange-700 border-orange-300' },
  3: { label: 'Normalny', badgeCls: 'bg-blue-100 text-blue-700 border-blue-300' },
  4: { label: 'Niski', badgeCls: 'bg-gray-100 text-gray-500 border-gray-300' },
};

export const PRIORITY_OPTIONS = [
  { value: 1, label: 'Krytyczny' },
  { value: 2, label: 'Wysoki' },
  { value: 3, label: 'Normalny' },
  { value: 4, label: 'Niski' },
];

export const DEFAULT_PRIORITY = 3;

export const getPriorityConfig = (priority: number | null | undefined) => {
  return PRIORITY_CONFIG[priority ?? DEFAULT_PRIORITY] || PRIORITY_CONFIG[DEFAULT_PRIORITY];
};
