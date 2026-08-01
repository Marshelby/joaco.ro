import type { CustomerAddressMock, CustomerAddressType } from "@/types/account";

const addressTypeLabels: Record<CustomerAddressType, string> = {
  home: "Casa",
  work: "Trabajo",
  other: "Otra",
};

export function getCustomerAddressTypeLabel(type: CustomerAddressType) {
  return addressTypeLabels[type];
}

export function sortCustomerAddresses(addresses: readonly CustomerAddressMock[]) {
  return [...addresses].sort((first, second) => Number(second.isPrimary) - Number(first.isPrimary));
}

export function getPrimaryCustomerAddress(addresses: readonly CustomerAddressMock[]) {
  return addresses.find((address) => address.isActive && address.isPrimary);
}

export function formatCustomerAddressStreet(address: CustomerAddressMock) {
  return `${address.street} ${address.number}${address.apartmentOrUnit ? `, ${address.apartmentOrUnit}` : ""}`;
}
