import { formatDateCL } from "@/lib/formatters";
import type { CustomerBenefitMock, CustomerBenefitParticipationMock, CustomerBenefitStatus, CustomerBenefitType } from "@/types/account";

const typeLabels: Record<CustomerBenefitType, string> = { giveaway: "Sorteo", promotion: "Promoción", frequent_customer: "Cliente frecuente", campaign: "Campaña" };
const statusLabels: Record<CustomerBenefitStatus, string> = { active: "Activo", upcoming: "Próximo", completed: "Finalizado", used: "Utilizado", expired: "Vencido" };

export function getCustomerBenefitTypeLabel(type: CustomerBenefitType) { return typeLabels[type]; }
export function getCustomerBenefitStatusLabel(status: CustomerBenefitStatus) { return statusLabels[status]; }

export function sortCustomerBenefits(benefits: readonly CustomerBenefitMock[]) {
  return [...benefits].sort((first, second) => second.startAt.localeCompare(first.startAt));
}

export function getFeaturedCustomerBenefit(benefits: readonly CustomerBenefitMock[]) { return benefits.find((benefit) => benefit.isFeatured); }
export function getActiveCustomerBenefits(benefits: readonly CustomerBenefitMock[]) { return sortCustomerBenefits(benefits.filter((benefit) => benefit.status === "active" && !benefit.isFeatured)); }
export function getCompletedCustomerBenefits(benefits: readonly CustomerBenefitMock[]) { return sortCustomerBenefits(benefits.filter((benefit) => benefit.status === "completed" || benefit.status === "used" || benefit.status === "expired")); }
export function getCustomerBenefitParticipation(participations: readonly CustomerBenefitParticipationMock[], benefitId: string) { return participations.find((participation) => participation.benefitId === benefitId); }
export function getActiveCustomerBenefitParticipations(participations: readonly CustomerBenefitParticipationMock[]) { return participations.filter((participation) => participation.status === "active"); }
export function getLatestCustomerBenefitParticipation(participations: readonly CustomerBenefitParticipationMock[]) { return [...participations].sort((first, second) => second.participatedAt.localeCompare(first.participatedAt))[0]; }

export function formatCustomerBenefitValidity(benefit: CustomerBenefitMock) {
  if (benefit.status === "completed" && benefit.endAt) return `Finalizó el ${formatDateCL(benefit.endAt)}`;
  if (benefit.status === "expired" && benefit.endAt) return `Venció el ${formatDateCL(benefit.endAt)}`;
  if (benefit.status === "upcoming") return `Disponible desde el ${formatDateCL(benefit.startAt)}`;
  if (!benefit.endAt) return "Sin fecha de término";
  return `Vigente hasta el ${formatDateCL(benefit.endAt)}`;
}
