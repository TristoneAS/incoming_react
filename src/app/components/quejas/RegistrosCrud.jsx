"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { EditOutlined, FolderOpen, Save } from "@mui/icons-material";
import { BRAND } from "@/libs/theme_palette";
import {
  Actions,
  EmptyRow,
  Field,
  FormGrid,
  ExcelDownloadButton,
  PageHeading,
  StatusChip,
  TODAY,
  api,
  currentUser,
  fieldSx,
  headSx,
  panelSx,
  PdfButton,
  useSearch,
} from "./shared";

const EMPTY = {
  serial_lote: "",
  piezas_totales: "",
  piezas_ok: "",
  piezas_nok: "",
  fecha: TODAY,
  comentario: "",
};

const COLUMNS = [
  "Registrar",
  "Historial",
  "ID",
  "SAP",
  "Proveedor",
  "Cliente",
  "Plataforma",
  "Descripción",
  "Alerta",
  "Periodo",
  "Estatus",
];

const DETALLE = [
  ["SAP", "sap"],
  ["Proveedor", "proveedor"],
  ["Cliente", "cliente"],
  ["Plataforma", "plataforma"],
  ["Descripción", "descripcion"],
  ["Alerta interna", "alerta_interna"],
  ["Periodo", "periodo_inspeccion"],
  ["Razón de queja", "razon_queja"],
  ["Número de queja", "numero_queja"],
];

function DatosPrograma({ programa }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
        gap: 1.5,
        p: 2,
        mb: 2.5,
        borderRadius: 1.5,
        bgcolor: BRAND.soft,
        border: `1px solid ${BRAND.border}`,
      }}
    >
      {DETALLE.map(([label, key]) => (
        <Box key={key}>
          <Typography variant="caption" sx={{ color: BRAND.muted }}>
            {label}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {programa?.[key] || "—"}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function RegistrosCrud({ notify }) {
  const [programas, setProgramas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const visible = useSearch(programas, search);

  const [programa, setPrograma] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [captura, setCaptura] = useState(false);
  const [saving, setSaving] = useState(false);

  const [historial, setHistorial] = useState([]);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api("/api/quejas/programas?solo_activos=1");
      setProgramas(result.data);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const cargarHistorial = useCallback(
    async (programaId, incluirEliminados) => {
      setHistorialLoading(true);
      try {
        const result = await api(
          `/api/quejas/registros?programa_id=${programaId}${
            incluirEliminados ? "&eliminados=1" : ""
          }`,
        );
        setHistorial(result.data);
      } catch (error) {
        notify(error.message, "error");
      } finally {
        setHistorialLoading(false);
      }
    },
    [notify],
  );

  useEffect(() => {
    if (!historialOpen || !programa) return undefined;
    const timer = setTimeout(() => cargarHistorial(programa.id, showDeleted), 0);
    return () => clearTimeout(timer);
  }, [historialOpen, programa, showDeleted, cargarHistorial]);

  const abrirCaptura = (row) => {
    setPrograma(row);
    setEditingId(null);
    setForm(EMPTY);
    setCaptura(true);
  };

  const abrirHistorial = (row) => {
    setPrograma(row);
    setHistorial([]);
    setHistorialOpen(true);
  };

  const editarRegistro = (registro) => {
    setEditingId(registro.id);
    setForm({
      serial_lote: registro.serial_lote ?? "",
      piezas_totales: registro.piezas_totales ?? "",
      piezas_ok: registro.piezas_ok ?? "",
      piezas_nok: registro.piezas_nok ?? "",
      fecha: registro.fecha ?? TODAY,
      comentario: registro.comentario ?? "",
    });
    setCaptura(true);
  };

  const totales = Number(form.piezas_totales) || 0;
  const suma = (Number(form.piezas_ok) || 0) + (Number(form.piezas_nok) || 0);
  const sumaValida = totales > 0 && suma === totales;

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/quejas/registros", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          id: editingId,
          programa_id: programa.id,
          empleado: currentUser(),
          usuario: currentUser(),
        }),
      });
      notify(editingId ? "Registro actualizado" : "Registro guardado");
      setCaptura(false);
      if (historialOpen) await cargarHistorial(programa.id, showDeleted);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const changeDeleted = async (registro, method) => {
    if (
      method === "DELETE" &&
      !window.confirm(`¿Eliminar el registro #${registro.id}?`)
    ) {
      return;
    }
    try {
      await api("/api/quejas/registros", {
        method,
        body: JSON.stringify({ id: registro.id, usuario: currentUser() }),
      });
      notify(method === "PATCH" ? "Registro restaurado" : "Registro eliminado");
      await cargarHistorial(programa.id, showDeleted);
    } catch (error) {
      notify(error.message, "error");
    }
  };

  return (
    <Paper elevation={0} sx={panelSx}>
      <PageHeading
        title="Registro de Incoming"
        description="Captura el resultado de cada inspección activa y consulta su historial."
        search={search}
        setSearch={setSearch}
      >
        <ExcelDownloadButton
          filename="registro_incoming"
          sheet="Incoming"
          rows={visible}
          onError={(text) => notify(text, "error")}
          columns={[
            { header: "ID", value: (row) => row.id },
            { header: "SAP", value: (row) => row.sap },
            { header: "Proveedor", value: (row) => row.proveedor },
            { header: "Cliente", value: (row) => row.cliente },
            { header: "Plataforma", value: (row) => row.plataforma },
            { header: "Descripción", value: (row) => row.descripcion },
            { header: "Alerta", value: (row) => row.alerta_interna },
            { header: "Periodo", value: (row) => row.periodo_inspeccion },
            {
              header: "Estatus",
              value: (row) =>
                row.eliminado_en
                  ? "ELIMINADO"
                  : row.status === "LIBERADO"
                    ? "LIBERADO"
                    : "ACTIVO",
            },
          ]}
        />
      </PageHeading>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: BRAND.navy }}>
              {COLUMNS.map((heading) => (
                <TableCell key={heading} sx={headSx} align="center">
                  {heading}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {!visible.length ? (
              <EmptyRow columns={COLUMNS.length} loading={loading} />
            ) : (
              visible.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell align="center">
                    <Tooltip title="Capturar inspección">
                      <IconButton color="primary" onClick={() => abrirCaptura(row)}>
                        <EditOutlined />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Ver historial">
                      <IconButton color="info" onClick={() => abrirHistorial(row)}>
                        <FolderOpen />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="center">{row.id}</TableCell>
                  <TableCell>{row.sap}</TableCell>
                  <TableCell>{row.proveedor}</TableCell>
                  <TableCell>{row.cliente}</TableCell>
                  <TableCell>{row.plataforma}</TableCell>
                  <TableCell>{row.descripcion}</TableCell>
                  <TableCell>{row.alerta_interna || "—"}</TableCell>
                  <TableCell>{row.periodo_inspeccion || "—"}</TableCell>
                  <TableCell align="center">
                    <StatusChip row={row} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={captura}
        onClose={() => !saving && setCaptura(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          {editingId
            ? `Editar registro #${editingId}`
            : `Registrar Incoming · SAP ${programa?.sap ?? ""}`}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 2 }}>
            <PdfButton
              programaId={programa?.id}
              tienePdf={programa?.tiene_pdf}
              titulo={`SAP ${programa?.sap ?? ""}`}
              variant="button"
            />
          </Box>
          <DatosPrograma programa={programa} />
          <FormGrid>
            <Field name="serial_lote" label="Serial / Lote" form={form} setForm={setForm} upper />
            <Field
              name="fecha"
              label="Fecha"
              type="date"
              form={form}
              setForm={setForm}
              required
            />
            <Field
              name="piezas_totales"
              label="Piezas totales"
              type="number"
              form={form}
              setForm={setForm}
              required
            />
            <Field
              name="piezas_ok"
              label="Piezas OK"
              type="number"
              form={form}
              setForm={setForm}
              required
            />
            <Field
              name="piezas_nok"
              label="Piezas NOK"
              type="number"
              form={form}
              setForm={setForm}
              required
            />
            <Box sx={{ gridColumn: { sm: "span 2", lg: "span 3" } }}>
              <Field
                name="comentario"
                label="Comentario del registro"
                form={form}
                setForm={setForm}
                multiline
                minRows={2}
                upper
                sx={fieldSx}
              />
            </Box>
          </FormGrid>
          {!sumaValida && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Las piezas OK y NOK deben sumar exactamente el total inspeccionado
              (llevas {suma} de {totales}).
            </Alert>
          )}
          {sumaValida && (
            <Alert
              severity={Number(form.piezas_nok) > 0 ? "error" : "success"}
              sx={{ mt: 2 }}
            >
              Este registro se guardará como{" "}
              <strong>
                {Number(form.piezas_nok) > 0 ? "RECHAZADO" : "APROBADO"}
              </strong>
              .
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCaptura(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={save}
            disabled={saving || !sumaValida}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={historialOpen}
        onClose={() => setHistorialOpen(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          Historial de Incoming · SAP {programa?.sap ?? ""}
        </DialogTitle>
        <DialogContent dividers>
          <PageHeading
            title=""
            description={programa?.descripcion ?? ""}
            showDeleted={showDeleted}
            setShowDeleted={setShowDeleted}
          >
            <ExcelDownloadButton
              filename={`historial_incoming_${programa?.sap || "sap"}`}
              sheet="Historial"
              rows={historial}
              onError={(text) => notify(text, "error")}
              columns={[
                { header: "ID", value: (row) => row.id },
                { header: "Fecha", value: (row) => row.fecha },
                { header: "Serial / Lote", value: (row) => row.serial_lote },
                { header: "Total", value: (row) => row.piezas_totales },
                { header: "OK", value: (row) => row.piezas_ok },
                { header: "NOK", value: (row) => row.piezas_nok },
                { header: "Empleado", value: (row) => row.empleado },
                { header: "Comentario", value: (row) => row.comentario },
                {
                  header: "Resultado",
                  value: (row) =>
                    row.eliminado_en ? "ELIMINADO" : row.status,
                },
              ]}
            />
          </PageHeading>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: BRAND.navy }}>
                  {[
                    "Acciones",
                    "ID",
                    "Fecha",
                    "Serial/Lote",
                    "Total",
                    "OK",
                    "NOK",
                    "Empleado",
                    "Comentario",
                    "Resultado",
                  ].map((heading) => (
                    <TableCell key={heading} sx={headSx} align="center">
                      {heading}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {!historial.length ? (
                  <EmptyRow columns={10} loading={historialLoading} />
                ) : (
                  historial.map((registro) => (
                    <TableRow
                      key={registro.id}
                      hover
                      sx={{ opacity: registro.eliminado_en ? 0.55 : 1 }}
                    >
                      <TableCell align="center">
                        <Actions
                          row={registro}
                          onEdit={editarRegistro}
                          onDelete={(item) => changeDeleted(item, "DELETE")}
                          onRestore={(item) => changeDeleted(item, "PATCH")}
                        />
                      </TableCell>
                      <TableCell align="center">{registro.id}</TableCell>
                      <TableCell align="center">{registro.fecha}</TableCell>
                      <TableCell align="center">{registro.serial_lote || "—"}</TableCell>
                      <TableCell align="center">{registro.piezas_totales}</TableCell>
                      <TableCell align="center">{registro.piezas_ok}</TableCell>
                      <TableCell align="center">{registro.piezas_nok}</TableCell>
                      <TableCell align="center">{registro.empleado || "—"}</TableCell>
                      <TableCell>{registro.comentario || "—"}</TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={
                            registro.eliminado_en ? "ELIMINADO" : registro.status
                          }
                          color={
                            registro.eliminado_en
                              ? "default"
                              : registro.status === "APROBADO"
                                ? "success"
                                : "error"
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistorialOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
