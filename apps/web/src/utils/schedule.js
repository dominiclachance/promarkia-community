import parser from 'cron-parser';
import { addHours, addDays, addWeeks, isBefore } from 'date-fns';
import { secureRandomInt } from './secureRandom';

export const RECURRENCE = {
  ONCE: 'once',
  HOURLY: 'hourly',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  CUSTOM_CRON: 'custom_cron',
  RANDOM_N_WEEKS: 'random_n_weeks',
};

const ensureDate = (value) => (value instanceof Date ? value : new Date(value));

export const computeNextRun = (task, nowInput = new Date()) => {
  const now = ensureDate(nowInput);
  const base = ensureDate(task.nextRunAt || task.firstRunAt || now);
  if (!task.recurrence || task.recurrence.type === RECURRENCE.ONCE) {
    return isBefore(base, now) ? null : base;
  }

  switch (task.recurrence.type) {
    case RECURRENCE.HOURLY:
      return ensureFuture(addHours(base, task.recurrence.every || 1), now);
    case RECURRENCE.DAILY:
      return ensureFuture(addDays(base, task.recurrence.every || 1), now);
    case RECURRENCE.WEEKLY:
      return ensureFuture(addWeeks(base, task.recurrence.every || 1), now);
    case RECURRENCE.CUSTOM_CRON:
      return computeCronNext(task.recurrence.expression, now);
    case RECURRENCE.RANDOM_N_WEEKS:
      return computeRandomRun(task, now);
    default:
      throw new Error(`Unsupported recurrence ${task.recurrence.type}`);
  }
};

const ensureFuture = (candidate, now) => (isBefore(candidate, now) ? now : candidate);

const computeCronNext = (expression, now) => {
  const interval = parser.parseExpression(expression, { currentDate: now });
  return interval.next().toDate();
};

export const computeRandomRun = (task, nowInput = new Date()) => {
  const now = ensureDate(nowInput);
  const weeks = task.recurrence?.every || 2;
  const window = task.recurrence?.window || { dayStart: 1, dayEnd: 5, hourStart: 8, hourEnd: 18 };
  const baseWeek = addWeeks(now, weeks);
  const dayOffset = randomInt(window.dayStart, window.dayEnd);
  const hour = randomInt(window.hourStart, window.hourEnd);
  const minute = randomInt(0, 59);
  const next = new Date(baseWeek);
  next.setDate(baseWeek.getDate() - baseWeek.getDay() + dayOffset);
  next.setHours(hour, minute, 0, 0);
  return next;
};

const randomInt = (min, max) => secureRandomInt(min, max + 1);

export const serializeRecurrence = (form) => {
  switch (form.type) {
    case RECURRENCE.ONCE:
      return { type: RECURRENCE.ONCE };
    case RECURRENCE.HOURLY:
    case RECURRENCE.DAILY:
    case RECURRENCE.WEEKLY:
      return { type: form.type, every: form.every || 1 };
    case RECURRENCE.CUSTOM_CRON:
      return { type: RECURRENCE.CUSTOM_CRON, expression: form.expression };
    case RECURRENCE.RANDOM_N_WEEKS:
      return {
        type: RECURRENCE.RANDOM_N_WEEKS,
        every: form.every || 2,
        window: form.window,
      };
    default:
      throw new Error('Invalid recurrence form');
  }
};
