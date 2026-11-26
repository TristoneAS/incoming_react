import { NextResponse } from "next/server";
import { empleados } from "@/libs/empleados";
import {
  ACC_CALIDAD_MIN,
  INCOMING_ROLES,
  hasCalidadAccess,
  parseEmployeeBadge,
} from "@/libs/incoming_access";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const empId = parseEmployeeBadge(body?.emp_id ?? body?.username ?? "");

    if (!empId) {
      return NextResponse.json(
        { success: false, error: "Ingrese su ID de empleado" },
        { status: 400 },
      );
    }

    const [rows] = await empleados.query(
      `SELECT e.emp_id, e.emp_nombre, e.emp_alias, e.emp_activo, a.acc_calidad
       FROM del_empleados e
       LEFT JOIN del_accesos a ON a.acc_id = e.emp_id
       WHERE e.emp_id = ?
       LIMIT 1`,
      [empId],
    );
    const empleado = rows[0];

    if (!empleado) {
      return NextResponse.json(
        { success: false, error: "El ID de empleado no está registrado" },
        { status: 404 },
      );
    }

    if (empleado.emp_activo === 0 || empleado.emp_activo === "0") {
      return NextResponse.json(
        { success: false, error: "El empleado no está activo" },
        { status: 403 },
      );
    }

    if (!hasCalidadAccess(empleado.acc_calidad)) {
      return NextResponse.json(
        {
          success: false,
          error: `Sin acceso a Incoming. Se requiere calidad ${ACC_CALIDAD_MIN} o mayor.`,
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      incomingRole: INCOMING_ROLES.OPERADOR,
      auth: {
        authenticated: true,
        isAdmin: false,
      },
      empleado: {
        emp_id: empleado.emp_id,
        emp_nombre: empleado.emp_nombre,
        emp_alias: empleado.emp_alias,
        acc_calidad: Number(empleado.acc_calidad),
        isAdmin: false,
        incomingRole: INCOMING_ROLES.OPERADOR,
      },
    });
  } catch (error) {
    console.error("Error en /api/auth/login:", error);
    return NextResponse.json(
      { success: false, error: "No se pudo iniciar sesión" },
      { status: 500 },
    );
  }
}
