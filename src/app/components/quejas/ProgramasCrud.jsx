"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { PictureAsPdf, Save } from "@mui/icons-material";
import { BRAND } from "@/libs/theme_palette";
import {
  Actions,
  EmptyRow,
  Field,
  FormGrid,
  ExcelDownloadButton,
  PageHeading,
  PdfButton,
  StatusChip,
  api,
  currentUser,
  headSx,
  panelSx,
  useSearch,
} from "./shared";

const EMPTY = {
  sap: "",
  proveedor: "",
  cliente: "",
  plataforma: "",
  descripcion: "",
  alerta_interna: "",
  periodo_inspeccion: "",
  comentario: "",
  razon_queja: "",
  numero_queja: "",
};

const COLUMNS = [
  "Acciones",
  "ID",
  "SAP",
  "Proveedor",
  "Cliente",
  "Plataforma",
  "Descripción",
  "Alerta",
  "Periodo",
  "PDF",
  "Estatus",
];

export default function ProgramasCrud({ notify }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [search, setSearch] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const visible = useSearch(rows, search);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api(
        `/api/quejas/programas${showDeleted ? "?eliminados=1" : ""}`,
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

  /** Al capturar un SAP ya conocido se rellenan los datos del componente. */
  const autocompletarPorSap = async () => {
    const sap = form.sap.trim();
    if (!sap || editingId) return;
    try {
      const result = await api(
        `/api/quejas/programas?sap=${encodeURIComponent(sap)}`,
      );
      const [previous] = result.data;
      if (!previous) return;
      setForm((current) => ({
        ...current,
        proveedor: previous.proveedor ?? "",
        cliente: previous.cliente ?? "",
        plataforma: previous.plataforma ?? "",
        descripcion: previous.descripcion ?? "",
      }));
      notify(`Datos tomados de la inspección #${previous.id}`, "info");
    } catch {
      /* El autocompletado es opcional: si falla se captura a mano. */
    }
  };

  const reset = () => {
    setForm(EMPTY);
    setEditingId(null);
    setPdfFile(null);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!editingId && !pdfFile) {
      notify("Adjunta el PDF de la inspección", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      payload.append("usuario", currentUser());
      if (editingId) payload.append("id", String(editingId));
      if (pdfFile) payload.append("pdf", pdfFile);
      await api("/api/quejas/programas", {
        method: editingId ? "PUT" : "POST",
        body: payload,
      });
      notify(editingId ? "Inspección actualizada" : "Inspección programada");
      reset();
      await load();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const edit = (row) => {
    setEditingId(row.id);
    setPdfFile(null);
    setForm(
      Object.fromEntries(Object.keys(EMPTY).map((key) => [key, row[key] ?? ""])),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeDeleted = async (row, method) => {
    if (
      method === "DELETE" &&
      !window.confirm(`¿Eliminar la inspección SAP ${row.sap}?`)
    ) {
      return;
    }
    try {
      await api("/api/quejas/programas", {
        method,
        body: JSON.stringify({ id: row.id, usuario: currentUser() }),
      });
      notify(method === "PATCH" ? "Inspección restaurada" : "Inspección eliminada");
      await load();
    } catch (error) {
      notify(error.message, "error");
    }
  };

  return (
    <>
      <Paper component="form" onSubmit={save} elevation={0} sx={panelSx}>
        <Typography variant="h5" align="center" sx={{ mb: 2.5, fontWeight: 700 }}>
          {editingId ? `Editar inspección #${editingId}` : "Programar inspección"}
        </Typography>
        <FormGrid>
          <Field
            name="sap"
            label="Número SAP"
            form={form}
            setForm={setForm}
            onBlur={autocompletarPorSap}
            required
            upper
            autoFocus
          />
          <Field name="proveedor" label="Proveedor" form={form} setForm={setForm} required upper />
          <Field name="cliente" label="Cliente" form={form} setForm={setForm} required upper />
          <Field name="plataforma" label="Plataforma" form={form} setForm={setForm} required upper />
          <Box sx={{ gridColumn: { sm: "span 2" } }}>
            <Field
              name="descripcion"
              label="Descripción del componente"
              form={form}
              setForm={setForm}
              required
              upper
            />
          </Box>
          <Field name="alerta_interna" label="Alerta interna" form={form} setForm={setForm} upper />
          <Field
            name="periodo_inspeccion"
            label="Periodo de inspección"
            form={form}
            setForm={setForm}
            upper
          />
          <Field name="razon_queja" label="Razón de queja" form={form} setForm={setForm} upper />
          <Field name="numero_queja" label="Número de queja" form={form} setForm={setForm} upper />
          <Box sx={{ gridColumn: { sm: "span 2" } }}>
            <Field
              name="comentario"
              label="Comentario"
              form={form}
              setForm={setForm}
              multiline
              minRows={2}
              upper
            />
          </Box>
          <Box
            sx={{
              gridColumn: { xs: "1 / -1" },
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Button
              component="label"
              variant="outlined"
              startIcon={<PictureAsPdf />}
            >
              {pdfFile
                ? pdfFile.name
                : editingId
                  ? "Reemplazar PDF"
                  : "Subir PDF"}
              <input
                type="file"
                hidden
                accept="application/pdf"
                required={!editingId}
                onChange={(event) =>
                  setPdfFile(event.target.files?.[0] ?? null)
                }
              />
            </Button>
            {editingId && (
              <PdfButton
                programaId={editingId}
                tienePdf={rows.find((row) => row.id === editingId)?.tiene_pdf}
                titulo={`SAP ${form.sap}`}
                variant="button"
              />
            )}
            {!editingId && (
              <Typography variant="caption" sx={{ color: BRAND.muted }}>
                El PDF es obligatorio, igual que en Incoming.
              </Typography>
            )}
          </Box>
        </FormGrid>
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2.5 }}>
          {editingId && (
            <Button variant="outlined" onClick={reset}>
              Cancelar
            </Button>
          )}
          <Button type="submit" variant="contained" startIcon={<Save />} disabled={saving}>
            {saving ? "Guardando..." : editingId ? "Actualizar" : "Guardar"}
          </Button>
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ ...panelSx, mt: 2 }}>
        <PageHeading
          title="Inspecciones programadas"
          description="Consulta, modifica, elimina o restaura registros."
          search={search}
          setSearch={setSearch}
          showDeleted={showDeleted}
          setShowDeleted={setShowDeleted}
        >
          <ExcelDownloadButton
            filename="inspecciones_programadas"
            sheet="Programadas"
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
                  <TableCell key={heading} sx={headSx}>
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
                  <TableRow key={row.id} hover sx={{ opacity: row.eliminado_en ? 0.55 : 1 }}>
                    <TableCell>
                      <Actions
                        row={row}
                        onEdit={edit}
                        onDelete={(item) => changeDeleted(item, "DELETE")}
                        onRestore={(item) => changeDeleted(item, "PATCH")}
                      />
                    </TableCell>
                    <TableCell>{row.id}</TableCell>
                    <TableCell>{row.sap}</TableCell>
                    <TableCell>{row.proveedor}</TableCell>
                    <TableCell>{row.cliente}</TableCell>
                    <TableCell>{row.plataforma}</TableCell>
                    <TableCell>{row.descripcion}</TableCell>
                    <TableCell>{row.alerta_interna || "—"}</TableCell>
                    <TableCell>{row.periodo_inspeccion || "—"}</TableCell>
                    <TableCell align="center">
                      <PdfButton
                        programaId={row.id}
                        tienePdf={row.tiene_pdf}
                        titulo={`SAP ${row.sap}`}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusChip row={row} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </>
  );
}
