export const SEGMENT_LABEL: Record<string, string> = {
  nuevos: "Nuevos",
  frecuentes: "Frecuentes",
  alto_valor: "Alto valor",
  potencial_crecimiento: "Potencial de crecimiento",
  multimarcas: "Multimarcas",
  ocasionales: "Ocasionales",
  en_riesgo: "En riesgo",
  inactivos: "Inactivos",
  reactivados: "Reactivados",
};

export const BRAND_LABEL: Record<string, string> = {
  "farmacias-economicas": "Farmacias Económicas",
  medicity: "Medicity",
  wellderma: "Wellderma",
  ambiente: "Ambiente",
  mascotas: "Mascotas",
  byd: "BYD",
};

export const CHURN_LABEL: Record<string, string> = {
  sin_historial_suficiente: "Sin historial suficiente",
  bajo: "Riesgo bajo (reglas)",
  medio: "Riesgo medio (reglas)",
  alto: "Riesgo alto (reglas)",
};

export function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}
