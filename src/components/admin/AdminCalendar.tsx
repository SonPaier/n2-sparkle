import { useState, DragEvent, useRef, useCallback, useEffect } from 'react';
import { format, addDays, subDays, isSameDay, startOfWeek, addWeeks, subWeeks, isBefore, startOfDay, addMonths, subMonths } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, Plus, Calendar as CalendarIcon, CalendarDays, Phone, Columns2, Coffee, X, Settings2, Maximize2, Minimize2, ChevronsLeftRight, RefreshCw, FileText, User, MapPin, DollarSign, Users, FolderKanban } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { InvoiceStatusBadge } from '@/components/invoicing/InvoiceStatusBadge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { getPriorityConfig } from '@/lib/priorityUtils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MonthCalendarView from './MonthCalendarView';

type ViewMode = 'day' | 'two-days' | 'week' | 'month';

export interface CalendarColumn {
  id: string;
  name: string;
  color?: string | null;
}

export interface AssignedEmployee {
  id: string;
  name: string;
  photo_url?: string | null;
}

export interface CalendarItem {
  id: string;
  column_id: string | null;
  title: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_id?: string | null;
  customer_address_id?: string | null;
  address_name?: string | null;
  address_lat?: number | null;
  address_lng?: number | null;
  address_city?: string | null;
  address_street?: string | null;
  assigned_employee_ids?: string[] | null;
  assigned_employees?: AssignedEmployee[];
  item_date: string;
  end_date?: string | null;
  start_time: string;
  end_time: string;
  status: string;
  admin_notes?: string | null;
  price?: number | null;
  photo_urls?: string[] | null;
  payment_status?: string | null;
  order_number?: string | null;
  priority?: number | null;
  project_id?: string | null;
  project_name?: string | null;
}

export interface Break {
  id: string;
  column_id: string;
  break_date: string;
  start_time: string;
  end_time: string;
  note: string | null;
}

type WorkingHoursMap = Record<string, { open: string; close: string } | null> | null;

interface AdminCalendarProps {
  columns: CalendarColumn[];
  items: CalendarItem[];
  breaks?: Break[];
  onItemClick?: (item: CalendarItem) => void;
  onAddItem?: (columnId: string, date: string, time: string) => void;
  onAddBreak?: (columnId: string, date: string, time: string) => void;
  onDeleteBreak?: (breakId: string) => void;
  onItemMove?: (itemId: string, newColumnId: string, newDate: string, newTime?: string) => void;
  onDateChange?: (date: Date) => void;
  onViewModeChange?: (mode: string) => void;
  selectedItemId?: string | null;
  onToggleMap?: () => void;
  mapOpen?: boolean;
  hideHours?: boolean;
  hideEmployeeChips?: boolean;
  workingHours?: WorkingHoursMap;
  prioritiesEnabled?: boolean;
  employeeViewActive?: boolean;
  onToggleEmployeeView?: () => void;
  conflictItemIds?: Set<string>;
}

const FALLBACK_START_HOUR = 6;
const FALLBACK_END_HOUR = 19;
const SLOT_MINUTES = 30;
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;
const SLOT_HEIGHT = 29;
const HOUR_HEIGHT = SLOT_HEIGHT * SLOTS_PER_HOUR;

const computeHourRange = (workingHours?: WorkingHoursMap): { startHour: number; endHour: number } => {
  if (!workingHours) return { startHour: FALLBACK_START_HOUR, endHour: FALLBACK_END_HOUR };
  const activeDays = Object.values(workingHours).filter(Boolean) as { open: string; close: string }[];
  if (activeDays.length === 0) return { startHour: FALLBACK_START_HOUR, endHour: FALLBACK_END_HOUR };
  const starts = activeDays.map(d => parseInt(d.open.split(':')[0], 10));
  const ends = activeDays.map(d => {
    const [h, m] = d.close.split(':').map(Number);
    return m > 0 ? h + 1 : h;
  });
  return { startHour: Math.min(...starts), endHour: Math.max(...ends) };
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'bg-emerald-200 border-emerald-400 text-emerald-900';
    case 'in_progress':
      return 'bg-orange-200 border-orange-400 text-orange-900';
    case 'completed':
      return 'bg-slate-200 border-slate-400 text-slate-700';
    case 'cancelled':
      return 'bg-red-100/60 border-red-300 text-red-700 line-through opacity-60';
    case 'change_requested':
      return 'bg-red-200 border-red-400 text-red-900';
    default:
      return 'bg-amber-100 border-amber-300 text-amber-900';
  }
};

const parseTime = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours + minutes / 60;
};

const formatTimeSlot = (hour: number, slotIndex: number): string => {
  const minutes = slotIndex * SLOT_MINUTES;
  return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const getTimeBasedZIndex = (startTime: string): number => {
  const [hours, minutes] = startTime.split(':').map(Number);
  return 5 + Math.floor(hours - 5 + minutes / 60);
};

// HOURS is now computed inside the component

const AdminCalendar = ({
  columns,
  items,
  breaks = [],
  onItemClick,
  onAddItem,
  onAddBreak,
  onDeleteBreak,
  onItemMove,
  onDateChange,
  onViewModeChange,
  selectedItemId,
  onToggleMap,
  mapOpen,
  hideHours,
  hideEmployeeChips,
  workingHours,
  prioritiesEnabled,
  employeeViewActive,
  onToggleEmployeeView,
  conflictItemIds,
}: AdminCalendarProps) => {
  const { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR } = computeHourRange(workingHours);
  const HOURS = Array.from({ length: DEFAULT_END_HOUR - DEFAULT_START_HOUR }, (_, i) => i + DEFAULT_START_HOUR);
  const [currentDate, setCurrentDate] = useState(() => {
    const saved = localStorage.getItem('admin-calendar-date');
    if (saved) {
      try {
        const parsed = new Date(saved);
        if (!isNaN(parsed.getTime())) return parsed;
      } catch {}
    }
    return new Date();
  });
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('calendar-hidden-columns');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [draggedItem, setDraggedItem] = useState<CalendarItem | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ hour: number; slotIndex: number } | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [configPopoverOpen, setConfigPopoverOpen] = useState(false);
  const [weekViewColumnId, setWeekViewColumnId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCompact, setIsCompact] = useState(() => {
    return localStorage.getItem('calendar-compact-mode') === 'true';
  });
  const isMobile = useIsMobile();

  const getColumnCellBg = (color: string): string => {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const mixR = Math.round(r * 0.05 + 255 * 0.95);
    const mixG = Math.round(g * 0.05 + 255 * 0.95);
    const mixB = Math.round(b * 0.05 + 255 * 0.95);
    return `rgb(${mixR}, ${mixG}, ${mixB})`;
  };

  const toggleCompact = useCallback(() => {
    setIsCompact(prev => {
      const next = !prev;
      localStorage.setItem('calendar-compact-mode', String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  const onDateChangeRef = useRef(onDateChange);
  onDateChangeRef.current = onDateChange;

  useEffect(() => {
    onDateChangeRef.current?.(currentDate);
  }, [currentDate]);

  const onViewModeChangeRef = useRef(onViewModeChange);
  onViewModeChangeRef.current = onViewModeChange;

  useEffect(() => {
    onViewModeChangeRef.current?.(viewMode);
  }, [viewMode]);

  const headerScrollRef = useRef<HTMLDivElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);

  // Touch handling for mobile - lock scroll to one axis
  const scrollTouchStartRef = useRef<{x: number; y: number; scrollLeft: number; scrollTop: number} | null>(null);
  const scrollDirectionRef = useRef<'horizontal' | 'vertical' | null>(null);
  const AXIS_LOCK_THRESHOLD = 8;

  // Use native event listeners with {passive: false} to allow preventDefault
  // Re-attach when view/date changes since the DOM element may remount
  useEffect(() => {
    if (!isMobile) return;
    
    const timerId = setTimeout(() => {
      const el = gridScrollRef.current;
      if (!el) return;

      const onTouchStart = (e: TouchEvent) => {
        scrollTouchStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          scrollLeft: el.scrollLeft,
          scrollTop: el.scrollTop,
        };
        scrollDirectionRef.current = null;
      };

      const onTouchMove = (e: TouchEvent) => {
        if (!scrollTouchStartRef.current) return;
        const touch = e.touches[0];
        const deltaX = touch.clientX - scrollTouchStartRef.current.x;
        const deltaY = touch.clientY - scrollTouchStartRef.current.y;
        const absDx = Math.abs(deltaX);
        const absDy = Math.abs(deltaY);

        if (!scrollDirectionRef.current && (absDx > AXIS_LOCK_THRESHOLD || absDy > AXIS_LOCK_THRESHOLD)) {
          scrollDirectionRef.current = absDx > absDy ? 'horizontal' : 'vertical';
        }

        if (scrollDirectionRef.current) {
          e.preventDefault();
          if (scrollDirectionRef.current === 'horizontal') {
            el.scrollLeft = scrollTouchStartRef.current.scrollLeft - deltaX;
          } else {
            el.scrollTop = scrollTouchStartRef.current.scrollTop - deltaY;
          }
        }
      };

      const onTouchEnd = () => {
        scrollTouchStartRef.current = null;
        scrollDirectionRef.current = null;
      };

      el.addEventListener('touchstart', onTouchStart, { passive: true });
      el.addEventListener('touchmove', onTouchMove, { passive: false });
      el.addEventListener('touchend', onTouchEnd, { passive: true });

      (el as any).__axisLockCleanup = () => {
        el.removeEventListener('touchstart', onTouchStart);
        el.removeEventListener('touchmove', onTouchMove);
        el.removeEventListener('touchend', onTouchEnd);
      };
    }, 50);

    return () => {
      clearTimeout(timerId);
      const el = gridScrollRef.current;
      if (el && (el as any).__axisLockCleanup) {
        (el as any).__axisLockCleanup();
        delete (el as any).__axisLockCleanup;
      }
    };
  }, [isMobile, currentDate, viewMode]);

  const handleHeaderScroll = useCallback(() => {
    if (headerScrollRef.current && gridScrollRef.current) {
      gridScrollRef.current.scrollLeft = headerScrollRef.current.scrollLeft;
    }
  }, []);

  const handleGridScroll = useCallback(() => {
    if (headerScrollRef.current && gridScrollRef.current) {
      headerScrollRef.current.scrollLeft = gridScrollRef.current.scrollLeft;
    }
  }, []);

  const getMobileColumnStyle = (columnCount: number): React.CSSProperties => {
    if (!isMobile) return {};
    if (columnCount === 1) return { width: 'calc(100vw - 48px)', minWidth: 'calc(100vw - 48px)' };
    if (columnCount === 2) return { width: 'calc((100vw - 48px) / 2)', minWidth: 'calc((100vw - 48px) / 2)' };
    return { width: 'calc((100vw - 48px) * 0.4)', minWidth: 'calc((100vw - 48px) * 0.4)' };
  };

  const getMobileColumnsContainerStyle = (columnCount: number): React.CSSProperties => {
    if (!isMobile) return {};
    if (columnCount <= 2) return {};
    return { width: `calc((100vw - 48px) * 0.4 * ${columnCount})` };
  };

  useEffect(() => {
    localStorage.setItem('calendar-hidden-columns', JSON.stringify([...hiddenColumnIds]));
  }, [hiddenColumnIds]);

  useEffect(() => {
    localStorage.setItem('admin-calendar-date', format(currentDate, 'yyyy-MM-dd'));
  }, [currentDate]);

  const toggleColumnVisibility = (columnId: string) => {
    setHiddenColumnIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(columnId)) newSet.delete(columnId);
      else newSet.add(columnId);
      return newSet;
    });
  };

  const showAllColumns = () => setHiddenColumnIds(new Set());

  const longPressTimeout = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);
  const LONG_PRESS_DURATION = 500;

  const handleTouchStart = useCallback((columnId: string, hour: number, slotIndex: number, dateStr?: string) => {
    longPressTriggered.current = false;
    longPressTimeout.current = setTimeout(() => {
      longPressTriggered.current = true;
      const time = formatTimeSlot(hour, slotIndex);
      const targetDate = dateStr || format(currentDate, 'yyyy-MM-dd');
      onAddBreak?.(columnId, targetDate, time);
    }, LONG_PRESS_DURATION);
  }, [currentDate, onAddBreak]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
  }, []);

  // Navigation
  const handlePrev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const handleNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const getTwoDays = (): Date[] => [currentDate, addDays(currentDate, 1)];
  const twoDays = viewMode === 'two-days' ? getTwoDays() : [currentDate, addDays(currentDate, 1)];

  const handleToday = () => {
    setCurrentDate(new Date());
    if (viewMode !== 'month') setViewMode('day');
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const currentDateStr = format(currentDate, 'yyyy-MM-dd');
  const isToday = isSameDay(currentDate, new Date());

  const visibleColumns = columns.filter(col => !hiddenColumnIds.has(col.id));
  const hasHiddenColumns = hiddenColumnIds.size > 0;

  const getItemsForColumnAndDate = (columnId: string, dateStr: string) => {
    return items.filter(item => {
      if (item.column_id !== columnId) return false;
      if (item.status === 'cancelled') return false;
      const startDate = item.item_date;
      const endDate = item.end_date || item.item_date;
      return dateStr >= startDate && dateStr <= endDate;
    });
  };

  const getBreaksForColumnAndDate = (columnId: string, dateStr: string) => {
    return breaks.filter(b => b.break_date === dateStr && b.column_id === columnId);
  };

  const getItemsForColumn = (columnId: string) => getItemsForColumnAndDate(columnId, currentDateStr);
  const getBreaksForColumn = (columnId: string) => getBreaksForColumnAndDate(columnId, currentDateStr);

  // Display times for multi-day items
  const getDisplayTimesForDate = (item: CalendarItem, dateStr: string) => {
    const isFirstDay = item.item_date === dateStr;
    const isLastDay = (item.end_date || item.item_date) === dateStr;
    let displayStart = item.start_time;
    let displayEnd = item.end_time;
    if (!isFirstDay) displayStart = `${DEFAULT_START_HOUR.toString().padStart(2, '0')}:00`;
    if (!isLastDay) displayEnd = `${DEFAULT_END_HOUR.toString().padStart(2, '0')}:00`;
    return { displayStart, displayEnd };
  };

  // Overlap detection
  const getOverlapInfo = (item: CalendarItem, allItems: CalendarItem[], dateStr: string) => {
    const activeItems = allItems.filter(i => i.status !== 'cancelled');
    if (activeItems.length <= 1) return { hasOverlap: false, index: 0, total: 1 };

    const doOverlap = (a: CalendarItem, b: CalendarItem): boolean => {
      const { displayStart: aStart, displayEnd: aEnd } = getDisplayTimesForDate(a, dateStr);
      const { displayStart: bStart, displayEnd: bEnd } = getDisplayTimesForDate(b, dateStr);
      return parseTime(aStart) < parseTime(bEnd) && parseTime(aEnd) > parseTime(bStart);
    };

    const groups: CalendarItem[][] = [];
    const assignedGroup = new Map<string, number>();

    for (const res of activeItems) {
      const connectedGroupIndices = new Set<number>();
      for (const other of activeItems) {
        if (res.id === other.id) continue;
        if (doOverlap(res, other) && assignedGroup.has(other.id)) {
          connectedGroupIndices.add(assignedGroup.get(other.id)!);
        }
      }
      if (connectedGroupIndices.size === 0) {
        const newGroupIndex = groups.length;
        groups.push([res]);
        assignedGroup.set(res.id, newGroupIndex);
      } else {
        const groupIndicesArray = Array.from(connectedGroupIndices).sort((a, b) => a - b);
        const targetGroup = groupIndicesArray[0];
        groups[targetGroup].push(res);
        assignedGroup.set(res.id, targetGroup);
        for (let i = groupIndicesArray.length - 1; i >= 1; i--) {
          const groupToMerge = groupIndicesArray[i];
          for (const r of groups[groupToMerge]) {
            groups[targetGroup].push(r);
            assignedGroup.set(r.id, targetGroup);
          }
          groups[groupToMerge] = [];
        }
      }
    }

    const groupIndex = assignedGroup.get(item.id);
    if (groupIndex === undefined) return { hasOverlap: false, index: 0, total: 1 };
    const group = groups[groupIndex];
    if (group.length <= 1) return { hasOverlap: false, index: 0, total: 1 };
    group.sort((a, b) => {
      const { displayStart: aStart } = getDisplayTimesForDate(a, dateStr);
      const { displayStart: bStart } = getDisplayTimesForDate(b, dateStr);
      const timeDiff = parseTime(aStart) - parseTime(bStart);
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    });
    const index = group.findIndex(r => r.id === item.id);
    return { hasOverlap: true, index, total: group.length };
  };

  const getItemStyle = (startTime: string, endTime: string) => {
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    const top = (start - DEFAULT_START_HOUR) * HOUR_HEIGHT + 1;
    const height = (end - start) * HOUR_HEIGHT - 2;
    return { top: `${top}px`, height: `${Math.max(height, 28)}px` };
  };

  // Slot click
  const handleSlotClick = (columnId: string, hour: number, slotIndex: number, dateStr?: string) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    const time = formatTimeSlot(hour, slotIndex);
    const targetDate = dateStr || currentDateStr;
    onAddItem?.(columnId, targetDate, time);
  };

  // Context menu for break
  const handleSlotContextMenu = (e: React.MouseEvent, columnId: string, hour: number, slotIndex: number, dateStr?: string) => {
    e.preventDefault();
    const time = formatTimeSlot(hour, slotIndex);
    const targetDate = dateStr || currentDateStr;
    onAddBreak?.(columnId, targetDate, time);
  };

  // Drag handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, item: CalendarItem) => {
    if (isMobile) { e.preventDefault(); return; }
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverColumn(null);
    setDragOverDate(null);
    setDragOverSlot(null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, columnId: string, dateStr?: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
    if (dateStr) setDragOverDate(dateStr);
  };

  const handleSlotDragOver = (e: DragEvent<HTMLDivElement>, columnId: string, hour: number, slotIndex: number, dateStr?: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
    setDragOverSlot({ hour, slotIndex });
    if (dateStr) setDragOverDate(dateStr);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null);
      setDragOverSlot(null);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, columnId: string, dateStr: string, hour?: number, slotIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);
    setDragOverDate(null);
    setDragOverSlot(null);

    if (draggedItem) {
      const newTime = hour !== undefined && slotIndex !== undefined ? formatTimeSlot(hour, slotIndex) : undefined;

      if (newTime) {
        const newStartNum = parseTime(newTime);
        if (newStartNum < DEFAULT_START_HOUR) { setDraggedItem(null); return; }
        const originalStart = parseTime(draggedItem.start_time);
        const originalEnd = parseTime(draggedItem.end_time);
        const duration = originalEnd - originalStart;
        const newEndNum = newStartNum + duration;
        if (newEndNum > DEFAULT_END_HOUR) { setDraggedItem(null); return; }
      }

      const columnChanged = draggedItem.column_id !== columnId;
      const dateChanged = draggedItem.item_date !== dateStr;
      const timeChanged = newTime && newTime !== draggedItem.start_time;

      if (columnChanged || dateChanged || timeChanged) {
        onItemMove?.(draggedItem.id, columnId, dateStr, newTime);
      }
    }
    setDraggedItem(null);
  };

  const getDragPreviewStyle = () => {
    if (!draggedItem || !dragOverSlot) return null;
    const start = parseTime(draggedItem.start_time);
    const end = parseTime(draggedItem.end_time);
    const duration = end - start;
    const newStartTime = dragOverSlot.hour + dragOverSlot.slotIndex * SLOT_MINUTES / 60;
    const top = (newStartTime - DEFAULT_START_HOUR) * HOUR_HEIGHT;
    const height = duration * HOUR_HEIGHT;
    return { top: `${top}px`, height: `${Math.max(height, 30)}px`, time: formatTimeSlot(dragOverSlot.hour, dragOverSlot.slotIndex) };
  };

  const dragPreviewStyle = getDragPreviewStyle();

  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const showCurrentTime = isToday && currentHour >= DEFAULT_START_HOUR && currentHour <= DEFAULT_END_HOUR;
  const currentTimeTop = (currentHour - DEFAULT_START_HOUR) * HOUR_HEIGHT;

  // Render item tile
  const renderItemTile = (item: CalendarItem, dateStr: string, allItems: CalendarItem[], displayStartTime?: number) => {
    const { displayStart, displayEnd } = getDisplayTimesForDate(item, dateStr);
    const style = displayStartTime !== undefined
      ? (() => {
          const start = parseTime(displayStart);
          const end = parseTime(displayEnd);
          const top = (start - displayStartTime) * HOUR_HEIGHT + 1;
          const height = (end - start) * HOUR_HEIGHT - 2;
          return { top: `${top}px`, height: `${Math.max(height, 28)}px` };
        })()
      : getItemStyle(displayStart, displayEnd);
    const isDragging = draggedItem?.id === item.id;
    const isMultiDay = item.end_date && item.end_date !== item.item_date;
    const isSelected = selectedItemId === item.id;
    const overlapInfo = getOverlapInfo(item, allItems, dateStr);
    const OVERLAP_OFFSET_PERCENT = 15;
    const leftOffset = overlapInfo.hasOverlap ? overlapInfo.index * OVERLAP_OFFSET_PERCENT : 0;
    const rightOffset = overlapInfo.hasOverlap ? (overlapInfo.total - 1 - overlapInfo.index) * OVERLAP_OFFSET_PERCENT : 0;

    const hasConflict = conflictItemIds?.has(item.id);

    return (
      <div
        key={item.id}
        draggable={!isMobile && !employeeViewActive}
        onDragStart={(e) => !employeeViewActive && handleDragStart(e, item)}
        onDragEnd={handleDragEnd}
        className={cn(
          "absolute rounded-lg border px-1 md:px-2 py-0 md:py-1 md:pb-1.5",
          !isMobile && !employeeViewActive && "cursor-grab active:cursor-grabbing",
          (isMobile || employeeViewActive) && "cursor-pointer",
          "transition-all duration-150 hover:shadow-lg hover:z-20",
          "overflow-hidden select-none",
          getStatusColor(item.status),
          isDragging && "opacity-30 scale-95",
          !isDragging && draggedItem && "pointer-events-none",
          isSelected && "border-4 shadow-lg z-30",
          hasConflict && "ring-2 ring-red-500 ring-offset-1"
        )}
        style={{
          ...style,
          left: `calc(${leftOffset}% + 2px)`,
          right: `calc(${rightOffset}% + 2px)`,
          zIndex: isSelected ? 30 : getTimeBasedZIndex(displayStart),
        }}
        onClick={(e) => { e.stopPropagation(); onItemClick?.(item); }}
      >
        <div className="px-0.5 text-black space-y-[3px]">
          {/* Project tag */}
          {item.project_name && (
            <div className="flex items-center gap-0.5 text-[9px] md:text-[10px] truncate">
              <FolderKanban className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate font-medium">{item.project_name}</span>
            </div>
          )}
          {/* Line 1: Title */}
           <div className="flex items-center gap-1 text-[13px] md:text-[15px] min-w-0">
            <span className="font-semibold truncate">{item.title}</span>
          </div>
          {/* Line 2: Time + notes indicator */}
          <div className="flex items-center justify-between gap-0.5">
            <span className="text-[13px] md:text-[15px] font-bold tabular-nums shrink-0 flex items-center gap-1 pb-0.5">
              {isMultiDay && item.end_date ? (() => {
                const dayNames = ['ND', 'PN', 'WT', 'ŚR', 'CZ', 'PT', 'SO'];
                const startDay = dayNames[new Date(item.item_date + 'T00:00:00').getDay()];
                const endDay = dayNames[new Date(item.end_date + 'T00:00:00').getDay()];
                return hideHours
                  ? `${startDay} - ${endDay}`
                  : `${startDay} ${item.start_time.slice(0, 5)} - ${endDay} ${item.end_time.slice(0, 5)}`;
              })() : (!hideHours && `${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}`)}
              {item.status === 'change_requested' && <RefreshCw className="w-3 h-3 text-red-600" />}
            </span>
            <div className="flex items-center gap-0.5 shrink-0">
              {item.admin_notes && (
                <div className="p-0.5 rounded" title={item.admin_notes}>
                  <FileText className="w-3 h-3 opacity-70" />
                </div>
              )}
              {item.customer_phone && isMobile && (
                <a href={`tel:${item.customer_phone}`} onClick={(e) => e.stopPropagation()} className="p-0.5 rounded hover:bg-white/20 transition-colors" title={item.customer_phone}>
                  <Phone className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
          {/* Line 3: Customer name */}
          {item.customer_name && (
            <div className="flex items-center gap-0.5 text-[11px] md:text-[12px] truncate opacity-80">
              <User className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{item.customer_name}</span>
            </div>
          )}
          {/* Line 4: Address */}
          {(item.address_city || item.address_street) && (
            <div className="flex items-center gap-0.5 text-[11px] md:text-[12px] truncate opacity-80">
              <MapPin className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{[item.address_city, item.address_street].filter(Boolean).join(', ')}</span>
            </div>
          )}
          {!item.address_city && !item.address_street && item.address_name && (
            <div className="flex items-center gap-0.5 text-[11px] md:text-[12px] truncate opacity-80">
              <MapPin className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{item.address_name}</span>
            </div>
          )}
          {/* Line 5: Payment status + Assigned employees chips */}
          <div className="flex items-center gap-0.5 mt-[4px] flex-wrap">
            {prioritiesEnabled && item.priority != null && item.priority !== 3 && (
              <span className={cn("inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold shrink-0", getPriorityConfig(item.priority).badgeCls)}>
                {getPriorityConfig(item.priority).label}
              </span>
            )}
            {item.payment_status && item.payment_status !== 'not_invoiced' && (
              <InvoiceStatusBadge status={item.payment_status} size="sm" />
            )}
            {!hideEmployeeChips && item.assigned_employees && item.assigned_employees.length > 0 && (
              <>
                {item.assigned_employees.slice(0, 3).map(emp => (
                  <span key={emp.id} className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-primary text-primary-foreground">
                    {emp.name.split(' ')[0]}
                  </span>
                ))}
                {item.assigned_employees.length > 3 && (
                  <span className="text-[10px] opacity-70">+{item.assigned_employees.length - 3}</span>
                )}
              </>
            )}
          </div>
          {/* Line 6: Admin notes */}
          {item.admin_notes && (
            <div className="text-[10px] md:text-[11px] opacity-75 italic mt-[6px] whitespace-pre-wrap break-words">
              {item.admin_notes}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render break tile
  const renderBreakTile = (breakItem: Break, displayStartTime?: number) => {
    const start = parseTime(breakItem.start_time);
    const end = parseTime(breakItem.end_time);
    const refStart = displayStartTime ?? DEFAULT_START_HOUR;
    const top = (start - refStart) * HOUR_HEIGHT + 1;
    const height = (end - start) * HOUR_HEIGHT - 2;
    const style = { top: `${top}px`, height: `${Math.max(height, 28)}px` };

    return (
      <div key={breakItem.id} className="absolute left-0.5 right-0.5 rounded-lg border-l-4 px-1 md:px-2 py-0.5 bg-slate-500/80 border-slate-600 text-white overflow-hidden group" style={style}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[9px] md:text-[10px] font-semibold truncate">
            <Coffee className="w-2.5 h-2.5 shrink-0" />
            Przerwa
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteBreak?.(breakItem.id); }}
            className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors opacity-0 group-hover:opacity-100"
            title="Usuń przerwę"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
        <div className="text-[8px] md:text-[9px] truncate opacity-80">
          {breakItem.start_time.slice(0, 5)} - {breakItem.end_time.slice(0, 5)}
        </div>
        {breakItem.note && <div className="text-[8px] truncate opacity-70">{breakItem.note}</div>}
      </div>
    );
  };

  // Render time column slots
  const renderTimeColumnSlots = () => (
    HOURS.map((hour) => (
      <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
        {!hideHours && (
          <span className="absolute -top-2.5 right-1 md:right-2 text-xs md:text-sm font-medium text-foreground bg-background px-1 z-10">
            {`${hour.toString().padStart(2, '0')}:00`}
          </span>
        )}
        <div className="absolute left-0 right-0 top-0 h-full">
          {Array.from({ length: SLOTS_PER_HOUR }, (_, i) => (
            <div key={i} className={cn("border-b relative", i === SLOTS_PER_HOUR - 1 ? "border-border" : "border-border/30")} style={{ height: SLOT_HEIGHT }}>
              {!hideHours && i > 0 && (
                <span className="absolute -top-1.5 right-1 md:right-2 text-[9px] md:text-[10px] text-muted-foreground/70 bg-background px-0.5">
                  {(i * SLOT_MINUTES).toString()}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    ))
  );

  // Render grid slots for a column on a date
  const renderGridSlots = (columnId: string, dateStr: string) => {
    const nowDate = new Date();
    const currentDateObj = new Date(dateStr);
    const isPastDay = currentDateObj < new Date(format(nowDate, 'yyyy-MM-dd'));

    return HOURS.map((hour) => (
      <div key={hour} style={{ height: HOUR_HEIGHT }}>
        {Array.from({ length: SLOTS_PER_HOUR }, (_, i) => {
          const isDropTarget = dragOverColumn === columnId && dragOverDate === dateStr && dragOverSlot?.hour === hour && dragOverSlot?.slotIndex === i;
          const isDisabled = isPastDay || !!employeeViewActive;

          return (
            <div
              key={i}
              className={cn(
                "border-b group transition-colors relative",
                i === SLOTS_PER_HOUR - 1 ? "border-border" : "border-border/40",
                isDropTarget && !isDisabled && "bg-primary/30 border-primary",
                !isDropTarget && !isDisabled && "hover:bg-primary/10 hover:z-50 cursor-pointer",
                isDisabled && !employeeViewActive && "cursor-not-allowed"
              )}
              style={{ height: SLOT_HEIGHT }}
              onClick={() => !isDisabled && handleSlotClick(columnId, hour, i, dateStr)}
              onContextMenu={(e) => !isDisabled && handleSlotContextMenu(e, columnId, hour, i, dateStr)}
              onTouchStart={() => !isDisabled && handleTouchStart(columnId, hour, i, dateStr)}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!isDisabled) handleSlotDragOver(e, columnId, hour, i, dateStr); }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (!isDisabled) handleDrop(e, columnId, dateStr, hour, i); }}
            >
              {!isDisabled && (
                <div className="h-full w-full flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">{`${hour.toString().padStart(2, '0')}:${(i * SLOT_MINUTES).toString().padStart(2, '0')}`}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    ));
  };

  const totalHeight = (DEFAULT_END_HOUR - DEFAULT_START_HOUR) * HOUR_HEIGHT;

  return (
    <div data-testid="admin-calendar" className="flex flex-col h-full bg-card rounded-xl relative">
      {/* Header */}
      <div className="flex flex-col py-1.5 lg:py-2 bg-background sticky top-0 z-50 gap-1.5 mx-0 px-[16px]">
        <div className="flex items-center justify-between gap-2">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrev} className="h-9 w-9">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleNext} className="h-9 w-9">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday} className="ml-2">
              Dziś
            </Button>
            {!isMobile && (
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="ml-1 gap-1">
                    <CalendarIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Data</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[1000]" align="start">
                  <Calendar mode="single" selected={currentDate} onSelect={(date) => {
                    if (date) { setCurrentDate(date); setViewMode('day'); setDatePickerOpen(false); }
                  }} initialFocus className="pointer-events-auto" locale={pl} />
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Day name */}
          {!isMobile && (
            <h2 className={cn("text-lg font-semibold", isToday && "text-primary")}>
              {viewMode === 'month'
                ? format(currentDate, 'LLLL yyyy', { locale: pl })
                : viewMode === 'week'
                ? `${format(weekStart, 'd MMM', { locale: pl })} - ${format(addDays(weekStart, 6), 'd MMM', { locale: pl })}`
                : viewMode === 'two-days'
                  ? `${format(currentDate, 'd MMM', { locale: pl })} - ${format(addDays(currentDate, 1), 'd MMM', { locale: pl })}`
                  : format(currentDate, 'EEEE, d MMMM', { locale: pl })}
            </h2>
          )}

          <div className="flex items-center gap-2">
            {/* Week view column selector */}
            {!isMobile && viewMode === 'week' && columns.length > 0 && (
              <Select value={weekViewColumnId || columns[0]?.id || ''} onValueChange={(value) => setWeekViewColumnId(value)}>
                <SelectTrigger className="h-9 w-[140px] text-sm">
                  <SelectValue placeholder="Kolumna" />
                </SelectTrigger>
                <SelectContent className="z-[1000]">
                  {columns.map((col) => <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {/* Unified view settings popover */}
            <Popover open={configPopoverOpen} onOpenChange={setConfigPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9" title="Ustawienia widoku">
                  <Settings2 className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3 z-[1000]">
                <div className="space-y-4">
                  {/* View mode */}
                  {!isMobile && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Pokaż</h4>
                      <div className="flex border border-border rounded-lg overflow-hidden">
                        <Button variant={viewMode === 'day' ? 'secondary' : 'ghost'} size="sm" onClick={() => { setViewMode('day'); setConfigPopoverOpen(false); }} className="rounded-none border-0 flex-1 text-xs">Dzień</Button>
                        <Button variant={viewMode === 'two-days' ? 'secondary' : 'ghost'} size="sm" onClick={() => { setViewMode('two-days'); setConfigPopoverOpen(false); }} className="rounded-none border-0 flex-1 text-xs">2 dni</Button>
                        <Button variant={viewMode === 'week' ? 'secondary' : 'ghost'} size="sm" onClick={() => { setViewMode('week'); setConfigPopoverOpen(false); }} className="rounded-none border-0 flex-1 text-xs">Tydzień</Button>
                        <Button variant={viewMode === 'month' ? 'secondary' : 'ghost'} size="sm" onClick={() => { setViewMode('month'); setConfigPopoverOpen(false); }} className="rounded-none border-0 flex-1 text-xs">Miesiąc</Button>
                      </div>
                    </div>
                  )}

                  {/* Column visibility - hide in employee view */}
                  {!employeeViewActive && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">Kolumny</h4>
                        {hasHiddenColumns && (
                          <Button variant="ghost" size="sm" onClick={showAllColumns} className="h-7 text-xs">Pokaż wszystkie</Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {columns.map((col) => (
                          <div key={col.id} className="flex items-center gap-2">
                            <Checkbox id={`col-${col.id}`} checked={!hiddenColumnIds.has(col.id)} onCheckedChange={() => toggleColumnVisibility(col.id)} />
                            <Label htmlFor={`col-${col.id}`} className="text-sm cursor-pointer flex-1">{col.name}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Compact mode */}
                  {!isMobile && (
                    <div className="flex items-center justify-between">
                      <Label htmlFor="compact-toggle" className="text-sm font-medium cursor-pointer">Widok kompaktowy</Label>
                      <Switch id="compact-toggle" checked={isCompact} onCheckedChange={toggleCompact} />
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Map toggle */}
            {onToggleMap && !employeeViewActive && (
              <Button
                variant={mapOpen ? 'secondary' : 'outline'}
                size="sm"
                onClick={onToggleMap}
                className="gap-1"
                title={mapOpen ? 'Zamknij mapę' : 'Otwórz mapę'}
              >
                <MapPin className="w-4 h-4" />
                {!isMobile && <span>Mapa</span>}
              </Button>
            )}

            {/* Employee calendar view toggle */}
            {onToggleEmployeeView && (
              <Button
                variant={employeeViewActive ? 'secondary' : 'outline'}
                size="sm"
                onClick={onToggleEmployeeView}
                className="gap-1"
                title={employeeViewActive ? 'Widok kolumn' : 'Widok pracowników'}
              >
                <Users className="w-4 h-4" />
                {!isMobile && <span>Pracownicy</span>}
              </Button>
            )}

            {/* Fullscreen */}
            <Button variant="outline" size="sm" onClick={toggleFullscreen} className="gap-1" title={isFullscreen ? 'Wyjdź z pełnego ekranu' : 'Pełny ekran'}>
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile day name */}
        {isMobile && (
          <h2 className={cn("text-center text-lg font-semibold", isToday && "text-primary")}>
            {viewMode === 'week'
              ? `${format(weekStart, 'd MMM', { locale: pl })} - ${format(addDays(weekStart, 6), 'd MMM', { locale: pl })}`
              : format(currentDate, 'EEEE, d MMMM', { locale: pl })}
          </h2>
        )}
      </div>

      {/* DAY VIEW */}
      {viewMode === 'day' && <>
        {/* Column headers */}
        <div className="flex border-b border-border bg-muted/20">
          <div className="w-12 md:w-16 shrink-0 border-r border-border/50" />
          <div
            ref={headerScrollRef}
            onScroll={handleHeaderScroll}
            className={cn("flex overflow-x-auto", !isMobile && "flex-1")}
            style={{ ...getMobileColumnsContainerStyle(visibleColumns.length), scrollbarWidth: 'none' }}
          >
            {visibleColumns.map((col, idx) => (
              <div
                key={col.id}
                className={cn(
                  "p-2 md:p-3 text-center font-medium text-sm shrink-0",
                  !isMobile && "flex-1",
                  !isMobile && !isCompact && "min-w-[220px]",
                  idx < visibleColumns.length - 1 && "border-r border-border"
                )}
                style={{ ...(isMobile ? getMobileColumnStyle(visibleColumns.length) : {}), ...(col.color ? { backgroundColor: col.color } : {}) }}
              >
                <div className="text-foreground truncate">{col.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable grid */}
        <div ref={gridScrollRef} onScroll={handleGridScroll} className="flex-1 overflow-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex relative" style={{ minHeight: totalHeight }}>
            {/* Time column */}
            <div className="w-12 md:w-16 shrink-0 border-r border-border/50 sticky left-0 z-30 bg-card">
              {renderTimeColumnSlots()}
            </div>

            {/* Column cells */}
            <div className={cn("flex", !isMobile && "flex-1")} style={getMobileColumnsContainerStyle(visibleColumns.length)}>
              {visibleColumns.map((col, idx) => {
                const colItems = getItemsForColumn(col.id);
                const colBreaks = getBreaksForColumn(col.id);
                const nowDate = new Date();
                const isPastDay = new Date(currentDateStr) < new Date(format(nowDate, 'yyyy-MM-dd'));
                let pastHatchHeight = 0;
                if (isPastDay) pastHatchHeight = totalHeight;

                return (
                  <div
                    key={col.id}
                    className={cn(
                      "relative transition-colors duration-150 shrink-0",
                      !isMobile && "flex-1",
                      !isMobile && !isCompact && "min-w-[220px]",
                      !isMobile && isCompact && "min-w-0",
                      idx < visibleColumns.length - 1 && "border-r border-border",
                      dragOverColumn === col.id && !dragOverSlot && "bg-primary/10"
                    )}
                    style={{
                      ...(isMobile ? getMobileColumnStyle(visibleColumns.length) : {}),
                      ...(col.color && !dragOverColumn ? { backgroundColor: getColumnCellBg(col.color) } : {}),
                    }}
                    onDragOver={(e) => handleDragOver(e, col.id, currentDateStr)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col.id, currentDateStr)}
                  >
                    {pastHatchHeight > 0 && <div className="absolute left-0 right-0 top-0 hatched-pattern pointer-events-none z-10" style={{ height: pastHatchHeight }} />}
                    {renderGridSlots(col.id, currentDateStr)}
                    {draggedItem && dragOverColumn === col.id && dragPreviewStyle && (
                      <div className="absolute left-1 right-1 rounded-lg border-2 border-dashed border-primary bg-primary/20 pointer-events-none flex items-center justify-center" style={{ top: dragPreviewStyle.top, height: dragPreviewStyle.height, zIndex: 10000 }}>
                        <span className="text-sm font-bold text-foreground bg-background px-3 py-1.5 rounded-md shadow-lg border border-border">Przenieś na {dragPreviewStyle.time}</span>
                      </div>
                    )}
                    {colItems.map((item) => renderItemTile(item, currentDateStr, colItems))}
                    {colBreaks.map((b) => renderBreakTile(b))}
                  </div>
                );
              })}
            </div>

            {/* Current time */}
            {showCurrentTime && (
              <div className="absolute left-0 right-0 z-40 pointer-events-none" style={{ top: currentTimeTop }}>
                <div className="flex items-center">
                  <div className="w-12 md:w-16 flex justify-end pr-1"><div className="w-2 h-2 rounded-full bg-red-500" /></div>
                  <div className="flex-1 h-0.5 bg-red-500" />
                </div>
              </div>
            )}
          </div>
        </div>
      </>}

      {/* TWO-DAYS VIEW */}
      {viewMode === 'two-days' && <>
        {/* Day + Column headers */}
        <div className="border-b border-border bg-muted/20">
          <div className="flex">
            <div className="w-10 md:w-16 shrink-0 border-r border-border" />
            {twoDays.map((day, dayIdx) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const isDayToday = isSameDay(day, new Date());
              return (
                <div key={dayStr} className={cn("flex-1", dayIdx < 1 && "border-r-2 border-border")}>
                  <div className={cn("p-1 md:p-2 text-center font-medium text-xs border-b border-border cursor-pointer hover:bg-primary/5 transition-colors", isDayToday && "bg-primary/10")} onClick={() => { setCurrentDate(day); setViewMode('day'); }}>
                    <span className={cn("font-bold", isDayToday && "text-primary")}>{format(day, 'EEEE d MMM', { locale: pl })}</span>
                  </div>
                  <div className="flex">
                    {visibleColumns.map((col, stationIdx) => (
                      <div key={`${dayStr}-${col.id}`} className={cn("flex-1 p-1 md:p-2 text-center font-medium text-[10px] md:text-xs", !isMobile && !isCompact && "min-w-[220px]", stationIdx < visibleColumns.length - 1 && "border-r border-border")} style={col.color ? { backgroundColor: col.color } : undefined}>
                        <div className={cn("text-foreground", isMobile ? "truncate" : "whitespace-normal break-words")}>{col.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Two-day grid */}
        <div className="flex-1 overflow-auto">
          <div className="flex relative" style={{ minHeight: totalHeight }}>
            <div className="w-10 md:w-16 shrink-0 border-r border-border bg-muted/10">
              {HOURS.map((hour) => (
                <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
                  <span className="absolute -top-2 right-1 md:right-2 text-[10px] md:text-xs text-foreground bg-background px-1 z-10">{`${hour.toString().padStart(2, '0')}:00`}</span>
                  <div className="absolute left-0 right-0 top-0 h-full">
                    {Array.from({ length: SLOTS_PER_HOUR }, (_, i) => (
                      <div key={i} className={cn("border-b", i === SLOTS_PER_HOUR - 1 ? "border-border" : "border-border/40")} style={{ height: SLOT_HEIGHT }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {twoDays.map((day, dayIdx) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const isDayToday = isSameDay(day, new Date());
              const today = startOfDay(new Date());
              const dayDate = startOfDay(day);
              const isPastDay = isBefore(dayDate, today);

              return (
                <div key={dayStr} className={cn("flex-1 flex", dayIdx < 1 && "border-r-2 border-border")}>
                  {visibleColumns.map((col, stationIdx) => {
                    let pastHatchHeight = 0;
                    if (isPastDay) pastHatchHeight = totalHeight;
                    const dayItems = getItemsForColumnAndDate(col.id, dayStr);
                    const dayBreaks = getBreaksForColumnAndDate(col.id, dayStr);

                    return (
                      <div
                        key={`${dayStr}-${col.id}`}
                        className={cn(
                          "flex-1 relative transition-colors duration-150",
                          !isMobile && !isCompact && "min-w-[220px]",
                          stationIdx < visibleColumns.length - 1 && "border-r border-border",
                          isDayToday && "bg-primary/5",
                          dragOverColumn === col.id && dragOverDate === dayStr && !dragOverSlot && "bg-primary/10"
                        )}
                        style={col.color && !(dragOverColumn === col.id && dragOverDate === dayStr) ? { backgroundColor: getColumnCellBg(col.color) } : undefined}
                        onDragOver={(e) => handleDragOver(e, col.id, dayStr)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, col.id, dayStr)}
                      >
                        {pastHatchHeight > 0 && <div className="absolute left-0 right-0 top-0 hatched-pattern pointer-events-none z-10" style={{ height: pastHatchHeight }} />}
                        {renderGridSlots(col.id, dayStr)}
                        {draggedItem && dragOverColumn === col.id && dragOverDate === dayStr && dragPreviewStyle && (
                          <div className="absolute left-0.5 right-0.5 rounded-lg border-2 border-dashed border-primary bg-primary/20 pointer-events-none flex items-center justify-center" style={{ top: dragPreviewStyle.top, height: dragPreviewStyle.height, zIndex: 10000 }}>
                            <span className="text-[10px] font-bold text-foreground bg-background px-2 py-1 rounded-md shadow-lg border border-border">Przenieś na {dragPreviewStyle.time}</span>
                          </div>
                        )}
                        {dayItems.map((item) => renderItemTile(item, dayStr, dayItems))}
                        {dayBreaks.map((b) => renderBreakTile(b))}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {twoDays.some(d => isSameDay(d, new Date())) && currentHour >= DEFAULT_START_HOUR && currentHour <= DEFAULT_END_HOUR && (
              <div className="absolute left-0 right-0 z-40 pointer-events-none" style={{ top: currentTimeTop }}>
                <div className="flex items-center">
                  <div className="w-14 md:w-16 flex justify-end pr-1"><div className="w-2 h-2 rounded-full bg-red-500" /></div>
                  <div className="flex-1 h-0.5 bg-red-500" />
                </div>
              </div>
            )}
          </div>
        </div>
      </>}

      {/* WEEK VIEW */}
      {viewMode === 'week' && <>
        <div className="flex border-b border-border bg-muted/20">
          <div className="w-16 md:w-20 shrink-0 p-2 flex items-center justify-center border-r border-border">
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
          {weekDays.map((day, idx) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const isDayToday = isSameDay(day, new Date());
            const selectedColId = weekViewColumnId || columns[0]?.id;
            const dayReservations = selectedColId ? getItemsForColumnAndDate(selectedColId, dayStr) : [];

            return (
              <div key={dayStr} className={cn("flex-1 p-2 md:p-3 text-center font-medium text-xs md:text-sm min-w-[80px] cursor-pointer hover:bg-primary/5 transition-colors", idx < 6 && "border-r border-border", isDayToday && "bg-primary/10")} onClick={() => { setCurrentDate(day); setViewMode('day'); }}>
                <div className={cn("text-foreground", isDayToday && "text-primary font-bold")}>{format(day, 'EEEE', { locale: pl })}</div>
                <div className={cn("text-lg font-bold", isDayToday && "text-primary")}>{format(day, 'd')}</div>
                <div className="text-xs text-muted-foreground">{`${dayReservations.length} zleceń`}</div>
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-auto">
          <div className="flex relative" style={{ minHeight: totalHeight }}>
            <div className="w-16 md:w-20 shrink-0 border-r border-border bg-muted/10">
              {HOURS.map((hour) => (
                <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
                  <span className="absolute -top-2 right-1 md:right-2 text-[10px] md:text-xs text-foreground bg-background px-1 z-10">{`${hour.toString().padStart(2, '0')}:00`}</span>
                  <div className="absolute left-0 right-0 top-0 h-full">
                    {Array.from({ length: SLOTS_PER_HOUR }, (_, i) => (
                      <div key={i} className={cn("border-b", i === SLOTS_PER_HOUR - 1 ? "border-border" : "border-border/40")} style={{ height: SLOT_HEIGHT }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {weekDays.map((day, idx) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const isDayToday = isSameDay(day, new Date());
              const selectedColId = weekViewColumnId || columns[0]?.id;
              const dayItems = selectedColId ? getItemsForColumnAndDate(selectedColId, dayStr) : [];
              const dayBreaks = selectedColId ? getBreaksForColumnAndDate(selectedColId, dayStr) : [];
              const today = startOfDay(new Date());
              const dayDate = startOfDay(day);
              const isPastDay = isBefore(dayDate, today);
              let pastHatchHeight = 0;
              if (isPastDay) pastHatchHeight = totalHeight;

              return (
                <div key={dayStr} className={cn("flex-1 relative min-w-[80px]", idx < 6 && "border-r border-border", isDayToday && "bg-primary/5")}
                  onDragOver={(e) => selectedColId && handleDragOver(e, selectedColId, dayStr)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => selectedColId && handleDrop(e, selectedColId, dayStr)}
                >
                  {pastHatchHeight > 0 && <div className="absolute left-0 right-0 top-0 hatched-pattern pointer-events-none z-10" style={{ height: pastHatchHeight }} />}
                  {HOURS.map((hour) => (
                    <div key={hour} style={{ height: HOUR_HEIGHT }}>
                      {Array.from({ length: SLOTS_PER_HOUR }, (_, i) => {
                        const isDropTarget = selectedColId && dragOverColumn === selectedColId && dragOverDate === dayStr && dragOverSlot?.hour === hour && dragOverSlot?.slotIndex === i;
                        const isDisabled = isPastDay;

                        return (
                          <div key={i} className={cn(
                            "border-b group transition-colors relative",
                            i % 2 === 0 && "border-border/50",
                            i % 2 !== 0 && "border-border/20",
                            isDropTarget && !isDisabled && "bg-primary/30 border-primary",
                            !isDropTarget && !isDisabled && "hover:bg-primary/5 hover:z-50 cursor-pointer",
                            isDisabled && "cursor-not-allowed"
                          )} style={{ height: SLOT_HEIGHT }}
                            onClick={() => !isDisabled && selectedColId && handleSlotClick(selectedColId, hour, i, dayStr)}
                            onContextMenu={(e) => !isDisabled && selectedColId && handleSlotContextMenu(e, selectedColId, hour, i, dayStr)}
                            onTouchStart={() => !isDisabled && selectedColId && handleTouchStart(selectedColId, hour, i, dayStr)}
                            onTouchEnd={handleTouchEnd}
                            onTouchMove={handleTouchMove}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!isDisabled && selectedColId) handleSlotDragOver(e, selectedColId, hour, i, dayStr); }}
                            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (!isDisabled && selectedColId) handleDrop(e, selectedColId, dayStr, hour, i); }}
                          >
                            {!isDisabled && (
                              <div className="h-full w-full flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Plus className="w-3 h-3 text-primary" />
                                <span className="text-xs font-medium text-primary">{`${hour.toString().padStart(2, '0')}:${(i * SLOT_MINUTES).toString().padStart(2, '0')}`}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {selectedColId && draggedItem && dragOverColumn === selectedColId && dragOverDate === dayStr && dragPreviewStyle && (
                    <div className="absolute left-0.5 right-0.5 rounded-lg border-2 border-dashed border-primary bg-primary/20 pointer-events-none z-10 flex items-center justify-center" style={{ top: dragPreviewStyle.top, height: dragPreviewStyle.height }}>
                      <span className="text-[9px] font-semibold text-primary bg-background/80 px-1 py-0.5 rounded">{dragPreviewStyle.time}</span>
                    </div>
                  )}

                  {dayItems.map((item) => renderItemTile(item, dayStr, dayItems))}
                  {dayBreaks.map((b) => renderBreakTile(b))}
                </div>
              );
            })}

            {weekDays.some(d => isSameDay(d, new Date())) && showCurrentTime && (
              <div className="absolute left-0 right-0 z-40 pointer-events-none" style={{ top: currentTimeTop }}>
                <div className="flex items-center">
                  <div className="w-16 md:w-20 flex justify-end pr-1"><div className="w-2 h-2 rounded-full bg-red-500" /></div>
                  <div className="flex-1 h-0.5 bg-red-500" />
                </div>
              </div>
            )}
          </div>
        </div>
      </>}

      {/* MONTH VIEW */}
      {viewMode === 'month' && (
        <MonthCalendarView
          items={items}
          columns={employeeViewActive ? [] : columns}
          currentDate={currentDate}
          onMonthChange={(date) => setCurrentDate(date)}
          onDayClick={(date) => { setCurrentDate(date); setViewMode('day'); }}
          onItemClick={(item) => onItemClick?.(item)}
          onItemMove={onItemMove ? (itemId, colId, newDate) => onItemMove(itemId, colId, newDate) : undefined}
        />
      )}

      {/* Color Legend - only for non-month views */}
      {viewMode !== 'month' && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4 pb-2 border-t border-border/50 mt-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-300/80 border border-red-400/70" />
            <span className="text-xs text-muted-foreground">Prośba o zmianę</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-orange-400/80 border border-orange-500/70" />
            <span className="text-xs text-muted-foreground">W trakcie</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-400/80 border border-green-500/70" />
            <span className="text-xs text-muted-foreground">Do wykonania</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-slate-400/80 border border-slate-500/70" />
            <span className="text-xs text-muted-foreground">Zakończone</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCalendar;
