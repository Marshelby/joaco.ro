import type { CustomerBenefitMock, CustomerBenefitParticipationMock } from "@/types/account";

export const CUSTOMER_BENEFITS_MOCK: readonly CustomerBenefitMock[] = [
  { id: "benefit-giveaway-july-2026", title: "Sorteo de invierno JOACO RO", description: "Participa por un set de productos para el hogar durante julio.", type: "giveaway", status: "active", startAt: "2026-07-01T00:00:00-04:00", endAt: "2026-07-31T23:59:59-04:00", isFeatured: true, eligibilityText: "Vigente durante julio." },
  { id: "benefit-delivery-quilpue", title: "Delivery especial en Quilpué", description: "Tarifa preferente de despacho en pedidos seleccionados dentro de Quilpué.", type: "promotion", status: "active", startAt: "2026-07-15T00:00:00-04:00", endAt: "2026-08-15T23:59:59-04:00", isFeatured: false, eligibilityText: "Disponible en pedidos seleccionados dentro de Quilpué." },
  { id: "benefit-frequent-customer", title: "Beneficios para clientes frecuentes", description: "Revisa promociones y campañas disponibles para ti.", type: "frequent_customer", status: "active", startAt: "2026-01-01T00:00:00-04:00", endAt: null, isFeatured: false, eligibilityText: "La disponibilidad puede variar según cada campaña." },
  { id: "benefit-home-campaign-june", title: "Campaña hogar de junio", description: "Promoción especial aplicada a productos seleccionados para el hogar.", type: "campaign", status: "completed", startAt: "2026-06-01T00:00:00-04:00", endAt: "2026-06-30T23:59:59-04:00", isFeatured: false, eligibilityText: "Campaña finalizada." },
];

export const CUSTOMER_BENEFIT_PARTICIPATIONS_MOCK: readonly CustomerBenefitParticipationMock[] = [
  { id: "participation-july-giveaway", benefitId: "benefit-giveaway-july-2026", participatedAt: "2026-07-20T15:10:00-04:00", status: "active", resultText: "Participación vigente." },
  { id: "participation-june-campaign", benefitId: "benefit-home-campaign-june", participatedAt: "2026-06-18T12:30:00-04:00", status: "completed", resultText: "Campaña finalizada." },
];
