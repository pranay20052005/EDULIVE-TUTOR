export function inr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function dateTimeOf(iso: string | Date) {
  const value = new Date(iso);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export function timeOf(iso: string | Date) {
  const value = new Date(iso);
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export function relative(iso: string | Date) {
  const target = new Date(iso).getTime();
  const delta = Date.now() - target;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (delta < minute) return "just now";
  if (delta < hour) return `${Math.round(delta / minute)}m ago`;
  if (delta < day) return `${Math.round(delta / hour)}h ago`;
  if (delta < 7 * day) return `${Math.round(delta / day)}d ago`;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(iso));
}

export function toDDMMYYYY(date: string | Date) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const year = value.getFullYear();
  return `${day}/${month}/${year}`;
}

export function fromDDMMYYYY(value: string) {
  if (!value || !/^\d{2}\/\d{2}\/\d{4}$/.test(value.trim())) return null;
  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year) return null;
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed.toISOString();
}

export function maskDOB(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "E"
  );
}

export function countdown(iso: string | Date) {
  const target = new Date(iso).getTime();
  const diff = Math.max(0, target - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [] as string[];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!parts.length && seconds) parts.push(`${seconds}s`);

  return {
    days,
    hours,
    minutes,
    seconds,
    label: parts.length ? parts.join(" ") : "less than a minute",
  };
}
