import { NextResponse } from "next/server";
import { empleados } from "@/libs/empleados";
import { mensajeErrorAuth } from "@/libs/auth_login";
import {
  INCOMING_ADMIN_ROLE,
  INCOMING_ROLES,
  incomingAuthenticateUrl,
  hasIncomingAdminRole,
  isIncomingAuthorized,
} from "@/libs/incoming_access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Ingrese usuario y contraseña" },
        { status: 400 },
      );
    }

    const authenticateUrl = incomingAuthenticateUrl();
    let authData = {};
    try {
      const response = await fetch(authenticateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        cache: "no-store",
      });
      authData = await response.json().catch(() => ({}));
      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: mensajeErrorAuth(authData) },
          { status: 401 },
        );
      }
    } catch (error) {
      console.error("/api/auth/admin:", error);
      return NextResponse.json(
        {
          success: false,
          error: "No se pudo conectar con el servidor de autenticación",
        },
        { status: 502 },
      );
    }

    if (!isIncomingAuthorized(authData) || !hasIncomingAdminRole(authData)) {
      return NextResponse.json(
        {
          success: false,
          error: isIncomingAuthorized(authData)
            ? `No tiene el rol ${INCOMING_ADMIN_ROLE}`
            : mensajeErrorAuth(authData),
        },
        { status: 403 },
      );
    }

    let empleado = null;
    try {
      const [rows] = await empleados.query(
        `SELECT emp_id, emp_nombre, emp_alias
         FROM del_empleados
         WHERE emp_alias = ?
         LIMIT 1`,
        [username],
      );
      empleado = rows[0] || null;
    } catch (error) {
      console.error("Error consultando empleado admin:", error);
    }

    const displayName =
      empleado?.emp_nombre ||
      authData?.userInfo?.displayName ||
      username;

    return NextResponse.json({
      success: true,
      incomingRole: INCOMING_ROLES.ADMIN,
      auth: {
        ...authData,
        authenticated: true,
        isAdmin: true,
      },
      empleado: {
        emp_id: empleado?.emp_id ?? username,
        emp_nombre: displayName,
        emp_alias: empleado?.emp_alias || username,
        isAdmin: true,
        incomingRole: INCOMING_ROLES.ADMIN,
      },
    });
  } catch (error) {
    console.error("Error en /api/auth/admin:", error);
    return NextResponse.json(
      { success: false, error: "Error interno al iniciar sesión" },
      { status: 500 },
    );
  }
}
