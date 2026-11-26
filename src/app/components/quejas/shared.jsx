"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Close,
  DeleteForever,
  Download,
  EditOutlined,
  OpenInNew,
  PictureAsPdf,
  Restore,
  Search,
} from "@mui/icons-material";
import { BRAND } from "@/libs/theme_palette";

export const panelSx = {
  p: { xs: 2, md: 3 },
  borderRadius: 2,
  border: "1px solid rgba(26, 35, 50, 0.10)",
  bgcolor: "rgba(255,255,255,0.95)",
  boxShadow: "0 12px 32px rgba(26,35,50,0.10)",
  overflow: "hidden",
  "&::before": {
    content: '""',
    display: "block",
    height: 4,
    mx: { xs: -2, md: -3 },
    mt: { xs: -2, md: -3 },
    mb: 2.5,
    background: `linear-gradient(90deg, ${BRAND.primaryDark}, ${BRAND.primary}, ${BRAND.amber})`,
  },
};

export const fieldSx = {
  "& .MuiOutlinedInput-root": {
    bgcolor: "#fff",
    borderRadius: 1.5,
    "&.Mui-focused fieldset": { borderColor: BRAND.primary },
  },
};

export const headSx = { color: "#fff", fontWeight: 700, whiteSpace: "nowrap" };

export const TODAY = new Date().toISOString().slice(0, 10);

export function currentUser() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("usuario") || "";
}

export async function api(url, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(url, {
    ...options,
    headers: isFormData
      ? options.headers
      : { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || "Ocurrió un error inesperado");
  }
  return data;
}

/**
 * Campo de captura. `upper` replica el comportamiento del sistema actual,
 * donde todo el texto se guarda en mayúsculas.
 */
export function Field({
  name,
  label,
  form,
  setForm,
  type = "text",
  upper = false,
  onValueChange,
  ...rest
}) {
  const change = (event) => {
    const raw = event.target.value;
    const value = upper && typeof raw === "string" ? raw.toUpperCase() : raw;
    setForm((previous) => ({ ...previous, [name]: value }));
    onValueChange?.(value);
  };

  return (
    <TextField
      fullWidth
      size="small"
      name={name}
      label={label}
      type={type}
      value={form[name] ?? ""}
      onChange={change}
      slotProps={type === "date" ? { inputLabel: { shrink: true } } : undefined}
      sx={fieldSx}
      {...rest}
    />
  );
}

export function FormGrid({ columns = 3, children }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          lg: `repeat(${columns}, minmax(0, 1fr))`,
        },
        gap: 2,
      }}
    >
      {children}
    </Box>
  );
}

export function PageHeading({
  title,
  description,
  search,
  setSearch,
  showDeleted,
  setShowDeleted,
  children,
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        mb: 2.5,
      }}
    >
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 300, letterSpacing: 0.6 }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: BRAND.muted, mt: 0.5 }}>
          {description}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        {setSearch && (
          <TextField
            size="small"
            placeholder="Buscar..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ ...fieldSx, minWidth: 220 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" sx={{ color: BRAND.muted }} />
                  </InputAdornment>
                ),
              },
            }}
          />
        )}
        {setShowDeleted && (
          <FormControlLabel
            control={
              <Switch
                checked={showDeleted}
                onChange={(event) => setShowDeleted(event.target.checked)}
                color="primary"
              />
            }
            label="Ver eliminados"
          />
        )}
        {children}
      </Box>
    </Box>
  );
}

function excelCell(value) {
  if (value == null || value === "") return "";
  return value;
}

export function ExcelDownloadButton({
  filename,
  sheet = "Datos",
  columns,
  rows,
  disabled = false,
  onError,
}) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (!rows?.length) return;
    setBusy(true);
    try {
      const payload = {
        filename: `${filename}_${TODAY}.xlsx`,
        sheet,
        columns: columns.map((column) => column.header),
        rows: rows.map((row) =>
          columns.map((column) => excelCell(column.value(row))),
        ),
      };
      const response = await fetch("/api/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo generar el Excel");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = payload.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      onError?.(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outlined"
      startIcon={<Download />}
      onClick={download}
      disabled={disabled || busy || !rows?.length}
    >
      {busy ? "Generando..." : "Descargar Excel"}
    </Button>
  );
}

export function Actions({ row, onEdit, onDelete, onRestore, editLabel = "Editar" }) {
  const deleted = Boolean(row.eliminado_en);
  return (
    <Box sx={{ display: "flex", justifyContent: "center" }}>
      {deleted ? (
        <Tooltip title="Restaurar">
          <IconButton color="success" onClick={() => onRestore(row)}>
            <Restore />
          </IconButton>
        </Tooltip>
      ) : (
        <>
          <Tooltip title={editLabel}>
            <IconButton color="primary" onClick={() => onEdit(row)}>
              <EditOutlined />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton color="error" onClick={() => onDelete(row)}>
              <DeleteForever />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Box>
  );
}

export function usePdfObjectUrl(src) {
  const [objectUrl, setObjectUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!src) return undefined;
    let revoked = false;
    let created = "";
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(src);
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo abrir el PDF");
        }
        const blob = await response.blob();
        created = URL.createObjectURL(blob);
        if (!revoked) setObjectUrl(created);
      } catch (cause) {
        if (!revoked) setError(cause.message || "No se pudo abrir el PDF");
      }
    }, 0);
    return () => {
      revoked = true;
      clearTimeout(timer);
      if (created) URL.revokeObjectURL(created);
    };
  }, [src]);

  return { objectUrl, error };
}

export function PdfFrame({ src, title }) {
  const { objectUrl, error } = usePdfObjectUrl(src);
  if (error) {
    return (
      <Typography sx={{ p: 4, color: "error.main", textAlign: "center" }}>
        {error}
      </Typography>
    );
  }
  if (!objectUrl) {
    return (
      <Box sx={{ py: 8, textAlign: "center", color: BRAND.muted }}>
        Cargando PDF...
      </Box>
    );
  }
  return (
    <Box
      component="iframe"
      title={title}
      src={objectUrl}
      sx={{ display: "block", width: "100%", height: "75vh", border: 0 }}
    />
  );
}

export function PdfDialog({ open, onClose, programaId, titulo }) {
  const src = programaId ? `/api/quejas/programas/pdf?id=${programaId}` : "";
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <span>PDF de la inspección{titulo ? ` · ${titulo}` : ""}</span>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {open && src ? <PdfFrame src={src} title="PDF de la inspección" /> : null}
      </DialogContent>
      <DialogActions>
        <Button
          component="a"
          href={src}
          target="_blank"
          rel="noreferrer"
          startIcon={<OpenInNew />}
          disabled={!src}
        >
          Abrir en pestaña
        </Button>
        <Button onClick={onClose} variant="contained">
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Botón que abre el PDF de la inspección en un modal. */
export function PdfButton({ programaId, tienePdf, titulo, variant = "icon" }) {
  const [open, setOpen] = useState(false);
  const disponible = Boolean(programaId) && Boolean(Number(tienePdf));

  if (!disponible) {
    return variant === "icon" ? (
      <Typography variant="body2" sx={{ color: BRAND.muted }}>
        —
      </Typography>
    ) : (
      <Typography variant="body2" sx={{ color: BRAND.muted }}>
        Sin PDF adjunto
      </Typography>
    );
  }

  return (
    <>
      {variant === "icon" ? (
        <Tooltip title="Ver PDF">
          <IconButton color="error" onClick={() => setOpen(true)}>
            <PictureAsPdf />
          </IconButton>
        </Tooltip>
      ) : (
        <Button
          variant="outlined"
          color="error"
          startIcon={<PictureAsPdf />}
          onClick={() => setOpen(true)}
        >
          Ver PDF
        </Button>
      )}
      <PdfDialog
        open={open}
        onClose={() => setOpen(false)}
        programaId={programaId}
        titulo={titulo}
      />
    </>
  );
}

const HISTORIAL_COLUMNS = [
  "Fecha",
  "Lote / Serial",
  "Piezas totales",
  "Piezas OK",
  "Piezas NOK",
  "Empleado",
  "Comentario",
  "Estatus",
];

/** Historial de registros Incoming de una inspección, como en el sistema original. */
export function HistorialIncomingDialog({
  open,
  onClose,
  programaId,
  sap,
  descripcion,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !programaId) return undefined;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await api(`/api/quejas/registros?programa_id=${programaId}`);
        setRows(result.data);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [open, programaId]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        Registro de Incoming{sap ? ` · SAP ${sap}` : ""}
      </DialogTitle>
      <DialogContent dividers>
        {descripcion && (
          <Typography variant="body2" sx={{ color: BRAND.muted, mb: 2 }}>
            {descripcion}
          </Typography>
        )}
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
          <ExcelDownloadButton
            filename={`historial_incoming_${sap || "sap"}`}
            sheet="Historial"
            rows={rows}
            columns={[
              { header: "Fecha", value: (row) => row.fecha },
              { header: "Lote / Serial", value: (row) => row.serial_lote },
              { header: "Piezas totales", value: (row) => row.piezas_totales },
              { header: "Piezas OK", value: (row) => row.piezas_ok },
              { header: "Piezas NOK", value: (row) => row.piezas_nok },
              { header: "Empleado", value: (row) => row.empleado },
              { header: "Comentario", value: (row) => row.comentario },
              { header: "Estatus", value: (row) => row.status },
            ]}
          />
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: BRAND.navy }}>
                {HISTORIAL_COLUMNS.map((heading) => (
                  <TableCell key={heading} sx={headSx} align="center">
                    {heading}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {!rows.length ? (
                <EmptyRow columns={HISTORIAL_COLUMNS.length} loading={loading} />
              ) : (
                rows.map((registro) => (
                  <TableRow key={registro.id} hover>
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
                        label={registro.status}
                        color={registro.status === "APROBADO" ? "success" : "error"}
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
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

export function EmptyRow({ columns, loading }) {
  return (
    <TableRow>
      <TableCell colSpan={columns} align="center" sx={{ py: 5 }}>
        {loading ? <CircularProgress size={28} /> : "No hay registros para mostrar"}
      </TableCell>
    </TableRow>
  );
}

export function StatusChip({ row }) {
  if (row.eliminado_en) {
    return <Chip size="small" label="ELIMINADO" />;
  }
  const liberado = row.status === "LIBERADO";
  return (
    <Chip
      size="small"
      label={liberado ? "LIBERADO" : "ACTIVO"}
      color={liberado ? "success" : "primary"}
      variant={liberado ? "filled" : "outlined"}
    />
  );
}

/** Filtro de texto sobre todas las columnas visibles, como el buscador actual. */
export function useSearch(rows, term) {
  return useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value ?? "").toLowerCase().includes(needle),
      ),
    );
  }, [rows, term]);
}