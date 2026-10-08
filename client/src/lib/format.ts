export function usd(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}$${whole}.${frac}`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "Pendiente",
    approved: "Aprobado",
    rejected: "Rechazado",
    cancelled: "Cancelado",
  };
  return map[status] ?? status;
}

export function typeLabel(type: string) {
  const map: Record<string, string> = {
    RECHARGE: "Recarga",
    PAYMENT: "Pago",
    REFUND: "Reembolso",
    RECHARGE_REJECTED: "Recarga rechazada",
    PAYMENT_REJECTED: "Pago no realizado",
  };
  return map[type] ?? type;
}

export function channelLabel(channel: string) {
  const map: Record<string, string> = {
    physical: "Presencial",
    online: "Online",
    recharge: "Recarga",
    refund: "Reembolso",
  };
  return map[channel] ?? channel;
}
