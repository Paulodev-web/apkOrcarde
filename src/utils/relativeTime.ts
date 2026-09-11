const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function relativeTimePtBr(isoTimestamp: string, now: number = Date.now()): string {
  const target = new Date(isoTimestamp).getTime();
  if (Number.isNaN(target)) return '';

  const diff = now - target;
  if (diff < 0) return 'agora';
  if (diff < MINUTE) return 'agora';

  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return minutes === 1 ? 'há 1 minuto' : `há ${minutes} minutos`;
  }

  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return hours === 1 ? 'há 1 hora' : `há ${hours} horas`;
  }

  if (diff < 2 * DAY) {
    return 'ontem';
  }

  if (diff < WEEK) {
    const days = Math.floor(diff / DAY);
    return `há ${days} dias`;
  }

  if (diff < MONTH) {
    const weeks = Math.floor(diff / WEEK);
    return weeks === 1 ? 'há 1 semana' : `há ${weeks} semanas`;
  }

  if (diff < YEAR) {
    const months = Math.floor(diff / MONTH);
    return months === 1 ? 'há 1 mês' : `há ${months} meses`;
  }

  const years = Math.floor(diff / YEAR);
  return years === 1 ? 'há 1 ano' : `há ${years} anos`;
}
