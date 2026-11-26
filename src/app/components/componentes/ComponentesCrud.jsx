"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Download, Save, UploadFile } from "@mui/icons-material";
import {
  Actions,
  EmptyRow,
  Field,
  FormGrid,
  ExcelDownloadButton,
  PageHeading,
  api,
  currentUser,
  headSx,
  panelSx,
  useSearch,
} from "@/app/components/quejas/shared";
import { BRAND } from "@/libs/theme_palette";

const TIPOS_INSPECCION = [
  ["ESTRICTA", "Estricta"],
  ["NORMAL", "Normal"],
  ["REDUCIDA", "Reducida"],
  ["SKIP_LOT", "Skip lot"],
];

const EMPTY = {
  sap: "",
  categoria: "SERIE",
  estandar_pack: "",
  clasificacion: "A",
  componente: "",
  plataforma: "",
  caracteristica_critica: "0",
  aql: "",
  tipo_inspeccion: "ESTRICTA",
  proveedor: "",
  cliente: "",
};
const COLUMNS = [
  "Acciones",
  "SAP",
  "Componente",
  "Categoría",
  "Clasificación",
  "AQL",
  "Inspección",
  "Proveedor",
  "Cliente",
  "Plataforma",
  "Pack",
  "Crítica",
  "Estado",
];

function etiquetaInspeccion(value) {
  return TIPOS_INSPECCION.find(([code]) => code === value)?.[1] || value || "—";
}

export default function ComponentesCrud() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState({ text: "", severity: "success" });
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);
  const visible = useSearch(rows, search);
  const notify = useCallback(
    (text, severity = "success") => setNotice({ text, severity }),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api(
        `/api/componentes${showDeleted ? "?eliminados=1" : ""}`,
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

  const reset = () => {
    setForm(EMPTY);
    setEditingId(null);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api("/api/componentes", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          id: editingId,
          usuario: currentUser(),
        }),
      });
      notify(editingId ? "Componente actualizado" : "Componente creado");
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
    setForm(
      Object.fromEntries(
        Object.keys(EMPTY).map((key) => [key, String(row[key] ?? "")]),
      ),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const downloadPlantilla = async () => {
    try {
      const response = await fetch("/api/componentes/plantilla");
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo descargar la plantilla");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "plantilla_componentes.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const uploadPlantilla = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const payload = new FormData();
      payload.append("archivo", file);
      payload.append("usuario", currentUser());
      const response = await fetch("/api/componentes/carga", {
        method: "POST",
        body: payload,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && !data.errors?.length) {
        throw new Error(data.error || "No se pudo cargar el archivo");
      }
      setImportResult({
        created: data.created || 0,
        updated: data.updated || 0,
        errors: data.errors || [],
        error: data.error || "",
      });
      await load();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setImporting(false);
    }
  };

  const toggle = async (row, method) => {
    if (
      method === "DELETE" &&
      !window.confirm(`¿Dar de baja el componente SAP ${row.sap}?`)
    ) {
      return;
    }
    try {
      await api("/api/componentes", {
        method,
        body: JSON.stringify({ id: row.id, usuario: currentUser() }),
      });
      notify(method === "PATCH" ? "Componente restaurado" : "Componente eliminado");
      await load();
    } catch (error) {
      notify(error.message, "error");
    }
  };

  return (
    <>
      <Paper component="form" onSubmit={save} elevation={0} sx={panelSx}>
        <Typography variant="h5" align="center" sx={{ mb: 2.5, fontWeight: 700 }}>
          {editingId ? `Editar componente #${editingId}` : "Nuevo componente"}
        </Typography>
        <FormGrid>
          <Field name="sap" label="SAP" form={form} setForm={setForm} required upper />
          <Field
            select
            name="categoria"
            label="Categoría"
            form={form}
            setForm={setForm}
            required
          >
            {["NUEVO", "SERIE", "SLOW_MOVER"].map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </Field>
          <Field
            select
            name="clasificacion"
            label="Clasificación"
            form={form}
            setForm={setForm}
            required
          >
            {["AA", "A", "B", "C"].map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </Field>
          <Box sx={{ gridColumn: "1 / -1" }}>
            <Field
              name="componente"
              label="Componente"
              form={form}
              setForm={setForm}
              required
              upper
            />
          </Box>
          <Field
            name="proveedor"
            label="Proveedor"
            form={form}
            setForm={setForm}
            required
            upper
          />
          <Field
            name="cliente"
            label="Cliente"
            form={form}
            setForm={setForm}
            required
            upper
            helperText="Se copia automático al registrar una revisión"
          />
          <Field
            name="plataforma"
            label="Plataforma"
            form={form}
            setForm={setForm}
            upper
          />
          <Field
            name="estandar_pack"
            label="Estándar pack"
            form={form}
            setForm={setForm}
            upper
          />
          <Field
            select
            name="caracteristica_critica"
            label="Característica crítica"
            form={form}
            setForm={setForm}
          >
            <MenuItem value="0">No</MenuItem>
            <MenuItem value="1">Sí</MenuItem>
          </Field>
          <Field name="aql" label="AQL" form={form} setForm={setForm} />
          <Field
            select
            name="tipo_inspeccion"
            label="Tipo de inspección"
            form={form}
            setForm={setForm}
            disabled
            helperText="Inicia en Estricta. Sube de nivel cada 10 revisiones conformes del mismo SAP. Una no conformidad lo regresa a Estricta."
          >
            {TIPOS_INSPECCION.map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Field>
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
          title="Catálogo de componentes"
          description="Administra SAP, clasificación y datos maestros. Descarga la plantilla, llénala y súbela para cargar varios a la vez."
          search={search}
          setSearch={setSearch}
          showDeleted={showDeleted}
          setShowDeleted={setShowDeleted}
        >
          <ExcelDownloadButton
            filename="catalogo_componentes"
            sheet="Catalogo"
            rows={visible}
            onError={(text) => notify(text, "error")}
            columns={[
              { header: "SAP", value: (row) => row.sap },
              { header: "Componente", value: (row) => row.componente },
              { header: "Categoría", value: (row) => row.categoria },
              { header: "Clasificación", value: (row) => row.clasificacion },
              { header: "AQL", value: (row) => row.aql },
              {
                header: "Inspección",
                value: (row) => etiquetaInspeccion(row.tipo_inspeccion),
              },
              { header: "Proveedor", value: (row) => row.proveedor },
              { header: "Cliente", value: (row) => row.cliente },
              { header: "Plataforma", value: (row) => row.plataforma },
              { header: "Pack", value: (row) => row.estandar_pack },
              {
                header: "Crítica",
                value: (row) => (Number(row.caracteristica_critica) ? "Sí" : "No"),
              },
              {
                header: "Estado",
                value: (row) => (row.eliminado_en ? "ELIMINADO" : "ACTIVO"),
              },
            ]}
          />
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={downloadPlantilla}
          >
            Descargar plantilla
          </Button>
          <Button
            variant="contained"
            startIcon={<UploadFile />}
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            {importing ? "Cargando..." : "Carga masiva"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={uploadPlantilla}
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
                        onDelete={(item) => toggle(item, "DELETE")}
                        onRestore={(item) => toggle(item, "PATCH")}
                      />
                    </TableCell>
                    <TableCell>{row.sap}</TableCell>
                    <TableCell>{row.componente}</TableCell>
                    <TableCell>{row.categoria}</TableCell>
                    <TableCell>
                      <Chip size="small" color="primary" label={row.clasificacion} />
                    </TableCell>
                    <TableCell>{row.aql || "—"}</TableCell>
                    <TableCell>{etiquetaInspeccion(row.tipo_inspeccion)}</TableCell>
                    <TableCell>{row.proveedor}</TableCell>
                    <TableCell>{row.cliente || "—"}</TableCell>
                    <TableCell>{row.plataforma || "—"}</TableCell>
                    <TableCell>{row.estandar_pack || "—"}</TableCell>
                    <TableCell>{Number(row.caracteristica_critica) ? "Sí" : "No"}</TableCell>
                    <TableCell>{row.eliminado_en ? "ELIMINADO" : "ACTIVO"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <Dialog
        open={Boolean(importResult)}
        onClose={() => setImportResult(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Resultado de la carga masiva</DialogTitle>
        <DialogContent dividers>
          {importResult?.error && !importResult.created && !importResult.updated ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {importResult.error}
            </Alert>
          ) : null}
          {importResult ? (
            <Typography sx={{ mb: 1.5 }}>
              Se crearon <strong>{importResult.created}</strong> componente
              {importResult.created === 1 ? "" : "s"} y se actualizaron{" "}
              <strong>{importResult.updated}</strong>.
            </Typography>
          ) : null}
          {importResult?.errors?.length ? (
            <Alert severity="warning">
              {importResult.errors.map((item) => (
                <div key={`${item.fila}-${item.sap}`}>
                  Fila {item.fila}
                  {item.sap ? ` · SAP ${item.sap}` : ""}: {item.error}
                </div>
              ))}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportResult(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={Boolean(notice.text)}
        autoHideDuration={4500}
        onClose={() => setNotice((value) => ({ ...value, text: "" }))}
      >
        <Alert severity={notice.severity} variant="filled">
          {notice.text}
        </Alert>
      </Snackbar>
    </>
  );
}
