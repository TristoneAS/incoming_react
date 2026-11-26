/** Acceso de captura en Incoming original: del_accesos.acc_calidad >= 3 */
export const ACC_CALIDAD_MIN = 3;

export const INCOMING_ROLES = {
  ADMIN: "admin",
  OPERADOR: "operador",
};

/** Módulos visibles por rol. Replica Incoming: captura vs programar/checklist (grupo AD). */
export const MENU_POR_ROL = {
  [INCOMING_ROLES.ADMIN]: [
    "inicio",
    "programar",
    "registro",
    "checklist",
    "sorteos",
    "catalogo",
    "revisiones",
  ],
  [INCOMING_ROLES.OPERADOR]: ["inicio", "registro", "sorteos", "revisiones"],
};

export function parseEmployeeBadge(raw) {
  const input = String(raw ?? "").trim();
  if (!input) return "";
  if (input.length > 6) {
    return input.charAt(2) === "0"
      ? input.substring(3, 8)
      : input.substring(2, 8);
  }
  return input.replace(/\D/g, "") || input;
}

export function hasCalidadAccess(accCalidad) {
  const level = Number(accCalidad);
  return Number.isFinite(level) && level >= ACC_CALIDAD_MIN;
}

export const INCOMING_ADMIN_ROLE = "INCOMING_Admin";

export function incomingAuthRoles(authData) {
  const roles = Array.isArray(authData?.roles) ? authData.roles : [];
  return roles.map((role) => String(role ?? "").trim()).filter(Boolean);
}

export function isIncomingAuthorized(authData) {
  return (
    String(authData?.authorization ?? "")
      .trim()
      .toLowerCase() === "authorized"
  );
}

export function hasIncomingAdminRole(authData) {
  return incomingAuthRoles(authData).includes(INCOMING_ADMIN_ROLE);
}

/** Alias por si queda un import anterior en caché. */
export const hasIncomingAdminGroup = hasIncomingAdminRole;

export function canAccessModule(role, itemId) {
  return (MENU_POR_ROL[role] || []).includes(itemId);
}

export function roleFromStorage() {
  if (typeof window === "undefined") return INCOMING_ROLES.OPERADOR;
  const stored = String(
    localStorage.getItem("incomingRole") || "",
  ).toLowerCase();
  if (stored === INCOMING_ROLES.ADMIN) return INCOMING_ROLES.ADMIN;
  if (localStorage.getItem("isAdmin") === "true") return INCOMING_ROLES.ADMIN;
  return INCOMING_ROLES.OPERADOR;
}

export const INCOMING_AUTH_PATH = "/INCOMING/AUTHENTICATE";
export const INCOMING_AUTH_DEFAULT_BASE = "http://TFTDELSRV011:5000";

export function authBaseUrl() {
  return String(
    process.env.NEXT_PUBLIC_AUTH_SERVER_URL || INCOMING_AUTH_DEFAULT_BASE,
  )
    .trim()
    .replace(/\/+$/, "");
}

export function incomingAuthenticateUrl() {
  return `${authBaseUrl()}${INCOMING_AUTH_PATH}`;
}
