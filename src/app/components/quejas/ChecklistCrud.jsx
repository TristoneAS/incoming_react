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
  MenuItem,
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
import { FolderOpen, PlaylistAddCheck, Save, TaskAlt } from "@mui/icons-material";
import { BRAND } from "@/libs/theme_palette";
import {
  Actions,
  EmptyRow,
  Field,
  FormGrid,
  HistorialIncomingDialog,
  ExcelDownloadButton,
  PageHeading,
  TODAY,
  api,
  currentUser,
  headSx,
  panelSx,
  PdfButton,
  useSearch,
} from "./shared";

/** Puntos que deben quedar aprobados para poder liberar la inspección. */
const PUNTOS = [
  ["embarque", "Embarque"],
  ["ocho_disciplinas", "8D"],
  ["acciones", "Acciones"],
  ["queja", "Queja"],
  ["seguimiento_corporativo", "Seguimiento corporativo"],
  ["sqe", "SQE"],
];

const EMPTY = {
  embarque: "",
  ocho_disciplinas: "",
  acciones: "",
  queja: "",
  seguimiento_corporativo: "",
  sqe: "",
  comentario: "",
  fecha: TODAY,
  fecha_cierre: "",
};

const COLUMNS = [
  "Registro Incoming",
  "Checklist",
  "ID",
  "SAP",
  "Proveedor",
  "Cliente",
  "Plataforma",
  "Descripción",
  "Alerta",
  "Periodo",
  "Comentario",
  "Fecha cierre",
  "Estatus",
];

function EstatusChecklist({ row }) {
  if (row.eliminado_en) return <Chip size="small" label="ELIMINADO" />;
  if (row.programa_status === "LIBERADO") {
    return <Chip size="small" label="LIBERADO" color="success" />;
  }
  if (!row.id) return <Chip size="small" label="PENDIENTE" color="warning" />;
  return <Chip size="small" label="EN PROCESO" color="primary" variant="outlined" />;
}

export default function ChecklistCrud({ notify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const visible = useSearch(rows, search);

  const [actual, setActual] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historial, setHistorial] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api(
        `/api/quejas/checklist${showDeleted ? "?eliminados=1" : ""}`,
      );
      setRows(result.data);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setLoading(false);
    }
  }, [notify, showDeleted]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const abrir = (row) => {
    setActual(row);
    setForm({
      ...EMPTY,
      ...Object.fromEntries(
        Object.keys(EMPTY).map((key) => [key, row[key] ?? EMPTY[key]]),
      ),
    });
    setOpen(true);
  };

  const bloqueado = actual?.programa_status === "LIBERADO";
  const todoAprobado = PUNTOS.every(([key]) => form[key] === "APROBADO");

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/quejas/checklist", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          programa_id: actual.programa_id,
          usuario: currentUser(),
        }),
      });
      notify("Checklist guardado");
      setOpen(false);
      await load();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const liberar = async () => {
    if (!window.confirm("¿Liberar la inspección? Ya no se podrá editar.")) return;
    setSaving(true);
    try {
      await api("/api/quejas/checklist", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          programa_id: actual.programa_id,
          usuario: currentUser(),
        }),
      });
      await api("/api/quejas/liberar", {
        method: "POST",
        body: JSON.stringify({
          programa_id: actual.programa_id,
          usuario: currentUser(),
        }),
      });
      notify("Inspección liberada");
      setOpen(false);
      await load();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const changeDeleted = async (row, method) => {
    if (
      method === "DELETE" &&
      !window.confirm(`¿Eliminar el checklist de SAP ${row.sap}?`)
    ) {
      return;
    }
    try {
      await api("/api/quejas/checklist", {
        method,
        body: JSON.stringify({ id: row.id, usuario: currentUser() }),
      });
      notify(method === "PATCH" ? "Checklist restaurado" : "Checklist eliminado");
      await load();
    } catch (error) {
      notify(error.message, "error");
    }
  };

  return (
    <Paper elevation={0} sx={panelSx}>
      <PageHeading
        title="Checklist"
        description="Seguimiento, cierre y liberación de las inspecciones por queja."
        search={search}
        setSearch={setSearch}
        showDeleted={showDeleted}
        setShowDeleted={setShowDeleted}
      >
        <ExcelDownloadButton
          filename="checklist_quejas"
          sheet="Checklist"
          rows={visible}
          onError={(text) => notify(text, "error")}
          columns={[
            { header: "ID", value: (row) => row.programa_id },
            { header: "SAP", value: (row) => row.sap },
            { header: "Proveedor", value: (row) => row.proveedor },
            { header: "Cliente", value: (row) => row.cliente },
            { header: "Plataforma", value: (row) => row.plataforma },
            { header: "Descripción", value: (row) => row.descripcion },
            { header: "Alerta", value: (row) => row.alerta_interna },
            { header: "Periodo", value: (row) => row.periodo_inspeccion },
            { header: "Comentario", value: (row) => row.programa_comentario },
            { header: "Fecha cierre", value: (row) => row.fecha_cierre },
            {
              header: "Estatus",
              value: (row) =>
                row.eliminado_en
                  ? "ELIMINADO"
                  : row.programa_status === "LIBERADO"
                    ? "LIBERADO"
                    : row.id
                      ? "EN PROCESO"
                      : "PENDIENTE",
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
                <TableRow
                  key={row.programa_id}
                  hover
                  sx={{ opacity: row.eliminado_en ? 0.55 : 1 }}
                >
                  <TableCell align="center">
                    <Tooltip title="Ver registro de Incoming">
                      <IconButton color="info" onClick={() => setHistorial(row)}>
                        <FolderOpen />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="center">
                    {row.id ? (
                      <Actions
                        row={row}
                        onEdit={abrir}
                        onDelete={(item) => changeDeleted(item, "DELETE")}
                        onRestore={(item) => changeDeleted(item, "PATCH")}
                        editLabel="Abrir checklist"
                      />
                    ) : (
                      <Tooltip title="Capturar checklist">
                        <IconButton color="primary" onClick={() => abrir(row)}>
                          <PlaylistAddCheck />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="center">{row.programa_id}</TableCell>
                  <TableCell>{row.sap}</TableCell>
                  <TableCell>{row.proveedor}</TableCell>
                  <TableCell>{row.cliente}</TableCell>
                  <TableCell>{row.plataforma}</TableCell>
                  <TableCell>{row.descripcion}</TableCell>
                  <TableCell>{row.alerta_interna || "—"}</TableCell>
                  <TableCell>{row.periodo_inspeccion || "—"}</TableCell>
                  <TableCell>{row.programa_comentario || "—"}</TableCell>
                  <TableCell align="center">{row.fecha_cierre || "—"}</TableCell>
                  <TableCell align="center">
                    <EstatusChecklist row={row} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>
          Checklist · SAP {actual?.sap ?? ""} — {actual?.descripcion ?? ""}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 2 }}>
            <PdfButton
              programaId={actual?.programa_id}
              tienePdf={actual?.tiene_pdf}
              titulo={`SAP ${actual?.sap ?? ""}`}
              variant="button"
            />
          </Box>
          {bloqueado && (
            <Alert severity="success" sx={{ mb: 2.5 }}>
              Esta inspección ya fue liberada, por lo que el checklist es de solo
              lectura.
            </Alert>
          )}
          <FormGrid>
            {PUNTOS.map(([key, label]) => (
              <Field
                key={key}
                select
                name={key}
                label={label}
                form={form}
                setForm={setForm}
                disabled={bloqueado}
              >
                <MenuItem value="">Sin evaluar</MenuItem>
                <MenuItem value="APROBADO">APROBADO</MenuItem>
                <MenuItem value="RECHAZADO">RECHAZADO</MenuItem>
              </Field>
            ))}
            <Field
              name="fecha_cierre"
              label="Fecha de cierre"
              type="date"
              form={form}
              setForm={setForm}
              disabled={bloqueado}
            />
            <Box sx={{ gridColumn: { sm: "span 2", lg: "span 2" } }}>
              <Field
                name="comentario"
                label="Comentario"
                form={form}
                setForm={setForm}
                multiline
                minRows={2}
                disabled={bloqueado}
                upper
              />
            </Box>
          </FormGrid>

          {actual?.usuario && (
            <Typography variant="caption" sx={{ color: BRAND.muted, mt: 2, display: "block" }}>
              Última captura por {actual.usuario}
              {actual.fecha ? ` el ${actual.fecha}` : ""}.
            </Typography>
          )}

          {!bloqueado && !todoAprobado && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Para liberar la inspección, los {PUNTOS.length} puntos deben quedar
              en APROBADO.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>
            Cerrar
          </Button>
          {!bloqueado && (
            <>
              <Button
                variant="outlined"
                startIcon={<Save />}
                onClick={save}
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar"}
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<TaskAlt />}
                onClick={liberar}
                disabled={saving || !todoAprobado}
              >
                Liberar
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <HistorialIncomingDialog
        open={Boolean(historial)}
        onClose={() => setHistorial(null)}
        programaId={historial?.programa_id}
        sap={historial?.sap}
        descripcion={historial?.descripcion}
      />
    </Paper>
  );
}
