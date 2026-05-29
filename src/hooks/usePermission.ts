import { useOrganization, OrgRole } from "@/contexts/OrganizationContext";

export type Permission =
  | "delete_customer"
  | "delete_dog"
  | "create_invoice"
  | "cancel_invoice"
  | "mark_invoice_paid"
  | "manage_staff"
  | "manage_settings"
  | "view_reports"
  | "send_campaign"
  | "manage_facility";

type PermissionMatrix = Record<Permission, OrgRole[]>;

const PERMISSIONS: PermissionMatrix = {
  delete_customer:   ["admin", "manager"],
  delete_dog:        ["admin", "manager"],
  create_invoice:    ["admin", "manager", "front_desk"],
  cancel_invoice:    ["admin", "manager"],
  mark_invoice_paid: ["admin", "manager", "front_desk"],
  manage_staff:      ["admin"],
  manage_settings:   ["admin"],
  view_reports:      ["admin", "manager"],
  send_campaign:     ["admin", "manager"],
  manage_facility:   ["admin", "manager"],
};

export function usePermission(action: Permission): boolean {
  const { currentUserRole } = useOrganization();
  if (!currentUserRole) return false;
  return PERMISSIONS[action].includes(currentUserRole);
}
