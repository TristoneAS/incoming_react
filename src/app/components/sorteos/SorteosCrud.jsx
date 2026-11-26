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
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { Add, Save } from "@mui/icons-material";
import { BRAND } from "@/libs/theme_palette";
import {
  Actions,
  EmptyRow,
  Field,
  FormGrid,
  ExcelDownloadButton,
  PageHeading,
  TODAY,
  api,
  currentUser,
  fieldSx,
  headSx,
  panelSx,
  useSearch,
} from "@/app/components/quejas/shared";

const EMPTY = {
  proveedor: "",
  sap: "",
  material: "",
  fecha: TODAY,
  serial_lote: "",
  estandar_pack: "",
  piezas_totales: "",
  piezas_ok: "",
  piezas_nok: "",
  comentario: "",
};

const COLUMNS = [
  "Acciones",
  "ID",
  "Fecha",
  "Proveedor",
  "SAP",
  "Material",
  "Serial / Lote",
  "Pack",
  "Total",
  "OK",
  "NOK",
  "Cajas",
  "Cajas OK",
  "Comentario",
  "Resultado",
];

function formatCajas(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function ResultChip({ row }) {
  if (row.eliminado_en) {
    return <Chip size="small" label="ELIMINADO" />;
  }
  const aprobado = row.estatus === "APROBADO";
  return (
    <Chip
      size="small"
      label={aprobado ? "APROBADO" : "RECHAZADO"}
      color={aprobado ? "success" : "error"}
    />
  );
}

export default function SorteosCrud() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("success");
  const visible = useSearch(rows, search);

  const notify = useCallback((text, tone = "success") => {
    setMessage(text);
    setSeverity(tone);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api(
        `/api/sorteos${showDeleted ? "?eliminados=1" : ""}`,
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
    setDialogOpen(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const edit = (row) => {
    setEditingId(row.id);
    setForm({
      proveedor: row.proveedor ?? "",
      sap: row.sap ?? "",
      material: row.material ?? "",
      fecha: row.fecha ?? TODAY,
      serial_lote: row.serial_lote ?? "",
      estandar_pack: row.estandar_pack ?? "",
      piezas_totales: row.piezas_totales ?? "",
      piezas_ok: row.piezas_ok ?? "",
      piezas_nok: row.piezas_nok ?? "",
      comentario: row.comentario ?? "",
    });
    setDialogOpen(true);
  };

  const totales = Number(form.piezas_totales) || 0;
  const pack = Number(form.estandar_pack) || 0;
  const ok = Number(form.piezas_ok) || 0;
  const suma = ok + (Number(form.piezas_nok) || 0);
  const sumaValida = totales > 0 && suma === totales;
  const cajasTotales = pack > 0 && totales > 0 ? totales / pack : null;
  const cajasConforme = pack > 0 && totales > 0 ? ok / pack : null;
  const capturaLista =
    Boolean(form.proveedor.trim()) &&
    Boolean(form.sap.trim()) &&
    Boolean(form.material.trim()) &&
    Boolean(form.fecha) &&
    pack > 0;

  const fillPackFromSap = async (sap) => {
    const code = String(sap ?? "").trim();
    if (!code) return;
    try {
      const result = await api(`/api/componentes?sap=${encodeURIComponent(code)}`);
      const packCatalogo = result.data?.[0]?.estandar_pack;
      const parsed = Number.parseInt(String(packCatalogo ?? "").replace(/[^\d]/g, ""), 10);
      if (parsed > 0) {
        setForm((previous) => ({ ...previous, estandar_pack: String(parsed) }));
      }
    } catch {
      /* el pack se captura a mano si el SAP no está en catálogo */
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/sorteos", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          id: editingId,
          usuario: currentUser(),
        }),
      });
      notify(editingId ? "Sorteo actualizado" : "Sorteo guardado");
      reset();
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
      !window.confirm(`¿Eliminar el sorteo #${row.id}?`)
    ) {
      return;
    }
    try {
      await api("/api/sorteos", {
        method,
        body: JSON.stringify({ id: row.id, usuario: currentUser() }),
      });
      notify(method === "PATCH" ? "Sorteo restaurado" : "Sorteo eliminado");
      await load();
    } catch (error) {
      notify(error.message, "error");
    }
  };

  return (
    <>
      <Paper elevation={0} sx={panelSx}>
        <PageHeading
          title="Sorteos especiales"
          description="Registra el resultado de cada sorteo: piezas OK, NOK y el estatus derivado."
          search={search}
          setSearch={setSearch}
          showDeleted={showDeleted}
          setShowDeleted={setShowDeleted}
        >
          <ExcelDownloadButton
            filename="sorteos_especiales"
            sheet="Sorteos"
            rows={visible}
            onError={(text) => notify(text, "error")}
            columns={[
              { header: "ID", value: (row) => row.id },
              { header: "Fecha", value: (row) => row.fecha },
              { header: "Proveedor", value: (row) => row.proveedor },
              { header: "SAP", value: (row) => row.sap },
              { header: "Material", value: (row) => row.material },
              { header: "Serial / Lote", value: (row) => row.serial_lote },
              { header: "Pack", value: (row) => row.estandar_pack },
              { header: "Total", value: (row) => row.piezas_totales },
              { header: "OK", value: (row) => row.piezas_ok },
              { header: "NOK", value: (row) => row.piezas_nok },
              { header: "Cajas", value: (row) => formatCajas(row.cajas_totales) },
              { header: "Cajas OK", value: (row) => formatCajas(row.cajas_conforme) },
              { header: "Comentario", value: (row) => row.comentario },
              {
                header: "Resultado",
                value: (row) =>
                  row.eliminado_en ? "ELIMINADO" : row.estatus,
              },
            ]}
          />
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
            Nuevo sorteo
          </Button>
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
                    key={row.id}
                    hover
                    sx={{ opacity: row.eliminado_en ? 0.55 : 1 }}
                  >
                    <TableCell align="center">
                      <Actions
                        row={row}
                        onEdit={edit}
                        onDelete={(item) => changeDeleted(item, "DELETE")}
                        onRestore={(item) => changeDeleted(item, "PATCH")}
                      />
                    </TableCell>
                    <TableCell align="center">{row.id}</TableCell>
                    <TableCell align="center">{row.fecha}</TableCell>
                    <TableCell>{row.proveedor}</TableCell>
                    <TableCell>{row.sap}</TableCell>
                    <TableCell>{row.material}</TableCell>
                    <TableCell align="center">
                      {row.serial_lote || "—"}
                    </TableCell>
                    <TableCell align="center">{row.estandar_pack || "—"}</TableCell>
                    <TableCell align="center">{row.piezas_totales}</TableCell>
                    <TableCell align="center">{row.piezas_ok}</TableCell>
                    <TableCell align="center">{row.piezas_nok}</TableCell>
                    <TableCell align="center">{formatCajas(row.cajas_totales)}</TableCell>
                    <TableCell align="center">{formatCajas(row.cajas_conforme)}</TableCell>
                    <TableCell>{row.comentario || "—"}</TableCell>
                    <TableCell align="center">
                      <ResultChip row={row} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog
        open={dialogOpen}
        onClose={() => !saving && reset()}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {editingId ? `Editar sorteo #${editingId}` : "Nuevo sorteo especial"}
        </DialogTitle>
        <DialogContent dividers>
          <FormGrid>
            <Field
              name="proveedor"
              label="Proveedor"
              form={form}
              setForm={setForm}
              required
              upper
              autoFocus
            />
            <Field
              name="sap"
              label="Número SAP"
              form={form}
              setForm={setForm}
              required
              upper
              onValueChange={fillPackFromSap}
            />
            <Field
              name="material"
              label="Material"
              form={form}
              setForm={setForm}
              required
              upper
            />
            <Field
              name="fecha"
              label="Fecha"
              type="date"
              form={form}
              setForm={setForm}
              required
            />
            <Field
              name="serial_lote"
              label="Serial / Lote"
              form={form}
              setForm={setForm}
              upper
            />
            <Field
              name="estandar_pack"
              label="Estándar pack"
              type="number"
              form={form}
              setForm={setForm}
              required
              helperText="Piezas por caja. Si el SAP está en catálogo, se llena solo."
              slotProps={{ htmlInput: { min: 1, step: 1 } }}
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
                label="Comentario"
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
          {cajasTotales != null && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Con pack de {pack}: <strong>{formatCajas(cajasTotales)} caja
              {cajasTotales === 1 ? "" : "s"}</strong> en total y{" "}
              <strong>
                {formatCajas(cajasConforme)} caja
                {cajasConforme === 1 ? "" : "s"} conforme
                {cajasConforme === 1 ? "" : "s"}
              </strong>{" "}
              (piezas OK ÷ pack).
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={reset} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={save}
            disabled={saving || !sumaValida || !capturaLista}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(message)}
        autoHideDuration={4500}
        onClose={() => setMessage("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={severity}
          variant="filled"
          onClose={() => setMessage("")}
          sx={{ width: "100%" }}
        >
          {message}
        </Alert>
      </Snackbar>
    </>
  );
}
