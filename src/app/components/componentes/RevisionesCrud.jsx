"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
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
import { PictureAsPdf, Save } from "@mui/icons-material";
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
  headSx,
  panelSx,
  useSearch,
} from "@/app/components/quejas/shared";
import { BRAND } from "@/libs/theme_palette";
import RevisionPdfDialog from "./RevisionPdfDialog";

const CHECKS = [
  ["sin_golpes", "Sin golpes"],
  ["libre_quebraduras", "Libre de quebraduras"],
  ["sin_rebabas", "Sin rebabas"],
  ["sin_rayaduras", "Sin rayaduras"],
  ["legible", "Legible"],
  ["sin_falta_subcomponentes", "Sin falta de subcomponentes"],
];
const TIPOS_INSPECCION = {
  ESTRICTA: "Estricta",
  NORMAL: "Normal",
  REDUCIDA: "Reducida",
  SKIP_LOT: "Skip lot",
};
const EMPTY = {
  componente_id: "",
  fecha: TODAY,
  serial_lote: "",
  tamano_lote: "",
  sin_golpes: "OK",
  libre_quebraduras: "OK",
  sin_rebabas: "OK",
  sin_rayaduras: "OK",
  legible: "OK",
  sin_falta_subcomponentes: "OK",
  forma_adecuada: "NA",
  dimensional: "NO",
  comentario: "",
  notificado_sqe: false,
};
const COLUMNS = [
  "Acciones",
  "Fecha",
  "Semana",
  "SAP",
  "Componente",
  "Cliente",
  "Proveedor",
  "Lote",
  "Tamaño",
  "Muestra",
  "Resultado",
  "Rebabas",
  "Dimensional",
  "Evidencias",
];

function EvidenceButton({ row, field, label, onOpen }) {
  const available = Boolean(Number(row[`pdf_${field}`]));
  return available ? (
    <Tooltip title={`Ver evidencia: ${label}`}>
      <IconButton color="error" size="small" onClick={() => onOpen(row, field, label)}>
        <PictureAsPdf fontSize="small" />
      </IconButton>
    </Tooltip>
  ) : null;
}

export default function RevisionesCrud() {
  const [components, setComponents] = useState([]);
  const [rows, setRows] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [search, setSearch] = useState("");
  const [calendarComponent, setCalendarComponent] = useState("");
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [pdf, setPdf] = useState(null);
  const [muestraInfo, setMuestraInfo] = useState(null);
  const [muestraError, setMuestraError] = useState("");
  const [lotePrompt, setLotePrompt] = useState(false);
  const [loteDraft, setLoteDraft] = useState("");
  const [loteDraftInfo, setLoteDraftInfo] = useState(null);
  const [loteDraftError, setLoteDraftError] = useState("");
  const [notice, setNotice] = useState({ text: "", severity: "success" });
  const visible = useSearch(rows, search);
  const notify = useCallback(
    (text, severity = "success") => setNotice({ text, severity }),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [componentResult, revisionResult] = await Promise.all([
        api("/api/componentes"),
        api(`/api/componentes/revisiones${showDeleted ? "?eliminados=1" : ""}`),
      ]);
      setComponents(componentResult.data);
      setRows(revisionResult.data);
      setWeeks(revisionResult.semanas);
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

  useEffect(() => {
    if (!form.componente_id || !form.tamano_lote) {
      const timer = setTimeout(() => {
        setMuestraInfo(null);
        setMuestraError("");
      }, 0);
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await api(
          `/api/componentes/muestra?componente_id=${encodeURIComponent(
            form.componente_id,
          )}&tamano_lote=${encodeURIComponent(form.tamano_lote)}`,
        );
        if (cancelled) return;
        setMuestraInfo(data);
        setMuestraError("");
      } catch (error) {
        if (cancelled) return;
        setMuestraInfo(null);
        setMuestraError(error.message);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.componente_id, form.tamano_lote]);

  useEffect(() => {
    if (!lotePrompt || !form.componente_id || !loteDraft) {
      const timer = setTimeout(() => {
        setLoteDraftInfo(null);
        setLoteDraftError("");
      }, 0);
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await api(
          `/api/componentes/muestra?componente_id=${encodeURIComponent(
            form.componente_id,
          )}&tamano_lote=${encodeURIComponent(loteDraft)}`,
        );
        if (cancelled) return;
        setLoteDraftInfo(data);
        setLoteDraftError("");
      } catch (error) {
        if (cancelled) return;
        setLoteDraftInfo(null);
        setLoteDraftError(error.message);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [lotePrompt, form.componente_id, loteDraft]);

  const selectedComponent = components.find(
    (item) => String(item.id) === String(form.componente_id),
  );
  const resultPreview = useMemo(
    () =>
      CHECKS.some(([field]) => form[field] === "NOK") ||
      form.forma_adecuada === "NOK"
        ? "NO_CONFORME"
        : "CONFORME",
    [form],
  );
  const calendarWeeks = useMemo(() => {
    const map = new Map(
      weeks
        .filter(
          (item) =>
            Number(item.anio) === Number(calendarYear) &&
            (!calendarComponent ||
              String(item.componente_id) === String(calendarComponent)),
        )
        .map((item) => [Number(item.semana), item.estado]),
    );
    return Array.from({ length: 53 }, (_, index) => ({
      number: index + 1,
      state: map.get(index + 1),
    }));
  }, [weeks, calendarComponent, calendarYear]);

  const reset = () => {
    setForm(EMPTY);
    setFiles({});
    setEditingId(null);
    setLotePrompt(false);
    setLoteDraft("");
    setLoteDraftInfo(null);
    setLoteDraftError("");
    setMuestraInfo(null);
    setMuestraError("");
  };

  const askLote = () => {
    setForm((previous) => ({ ...previous, tamano_lote: "" }));
    setMuestraInfo(null);
    setMuestraError("");
    setLoteDraft("");
    setLoteDraftInfo(null);
    setLoteDraftError("");
    setLotePrompt(true);
  };

  const cancelLotePrompt = () => {
    setLotePrompt(false);
    setLoteDraft("");
    setLoteDraftInfo(null);
    setLoteDraftError("");
    setForm((previous) => ({
      ...previous,
      componente_id: "",
      tamano_lote: "",
    }));
    setMuestraInfo(null);
  };

  const confirmLotePrompt = () => {
    if (!loteDraftInfo || loteDraftError) return;
    setForm((previous) => ({ ...previous, tamano_lote: String(loteDraftInfo.tamano_lote) }));
    setMuestraInfo(loteDraftInfo);
    setMuestraError("");
    setLotePrompt(false);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) =>
        payload.append(key, typeof value === "boolean" ? (value ? "1" : "0") : value),
      );
      payload.append("usuario", currentUser());
      if (editingId) payload.append("id", String(editingId));
      Object.entries(files).forEach(([field, file]) => {
        if (file) payload.append(`pdf_${field}`, file);
      });
      const result = await api("/api/componentes/revisiones", {
        method: editingId ? "PUT" : "POST",
        body: payload,
      });
      const tipoLabel = TIPOS_INSPECCION[result.tipo_inspeccion];
      notify(
        `${editingId ? "Revisión actualizada" : "Revisión guardada"}: ${result.resultado}${
          tipoLabel ? ` · inspección ${tipoLabel}` : ""
        }${
          result.muestra != null
            ? ` · ${result.muestra} muestra${result.muestra === 1 ? "" : "s"} (letra ${result.letra})`
            : ""
        }`,
        result.resultado === "NO_CONFORME" ? "warning" : "success",
      );
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
    setFiles({});
    setForm({
      ...Object.fromEntries(
        Object.keys(EMPTY).map((key) => [key, row[key] ?? EMPTY[key]]),
      ),
      componente_id: String(row.componente_id ?? ""),
      notificado_sqe: Boolean(Number(row.notificado_sqe)),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggle = async (row, method) => {
    if (
      method === "DELETE" &&
      !window.confirm(`¿Eliminar la revisión #${row.id}?`)
    ) {
      return;
    }
    try {
      await api("/api/componentes/revisiones", {
        method,
        body: JSON.stringify({ id: row.id, usuario: currentUser() }),
      });
      notify(method === "PATCH" ? "Revisión restaurada" : "Revisión eliminada");
      await load();
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const openPdf = (row, campo, label) =>
    setPdf({ revisionId: row.id, campo, title: `${label} · SAP ${row.sap}` });

  return (
    <>
      <Paper component="form" onSubmit={save} elevation={0} sx={panelSx}>
        <Typography variant="h5" align="center" sx={{ mb: 2.5, fontWeight: 700 }}>
          {editingId ? `Editar revisión #${editingId}` : "Capturar revisión"}
        </Typography>
        <FormGrid>
          <Field
            select
            name="componente_id"
            label="Componente / SAP"
            form={form}
            setForm={setForm}
            required
            onValueChange={(value) => {
              if (value) askLote();
            }}
          >
            {components.map((item) => (
              <MenuItem key={item.id} value={String(item.id)}>
                {item.sap} · {item.componente}
              </MenuItem>
            ))}
          </Field>
          <Field
            name="tamano_lote"
            label="Tamaño de lote"
            type="number"
            form={form}
            setForm={setForm}
            required
            disabled={!form.componente_id}
            helperText={
              form.componente_id
                ? "Piezas del lote. Define la letra de muestra (nivel II)."
                : "Selecciona primero el componente"
            }
            slotProps={{ htmlInput: { min: 1, step: 1 }, inputLabel: { shrink: true } }}
          />
          <Field name="fecha" label="Fecha" type="date" form={form} setForm={setForm} required />
          <Field name="serial_lote" label="Serial / lote" form={form} setForm={setForm} upper />
          <Field
            label="Cliente"
            value={selectedComponent?.cliente || ""}
            disabled
            form={{}}
            setForm={() => {}}
          />
          <Field
            label="Proveedor"
            value={selectedComponent?.proveedor || ""}
            disabled
            form={{}}
            setForm={() => {}}
          />
          <Field
            label="Plataforma"
            value={selectedComponent?.plataforma || ""}
            disabled
            form={{}}
            setForm={() => {}}
          />
          <Field
            label="AQL"
            value={selectedComponent?.aql || ""}
            disabled
            form={{}}
            setForm={() => {}}
          />
          <Field
            label="Tipo de inspección"
            value={TIPOS_INSPECCION[selectedComponent?.tipo_inspeccion] || ""}
            disabled
            form={{}}
            setForm={() => {}}
          />
          <Field
            label="Letra de muestra"
            value={muestraInfo?.letra || ""}
            disabled
            form={{}}
            setForm={() => {}}
          />
          <Field
            label="Piezas a revisar"
            value={
              muestraInfo
                ? muestraInfo.skip_lot
                  ? "0 (Skip lot)"
                  : String(muestraInfo.muestra)
                : ""
            }
            disabled
            form={{}}
            setForm={() => {}}
            helperText={muestraError || " "}
            error={Boolean(muestraError)}
          />
          {muestraInfo && (
            <Box sx={{ gridColumn: "1 / -1" }}>
              <Alert
                severity={muestraInfo.skip_lot ? "info" : "success"}
                variant="outlined"
              >
                {muestraInfo.skip_lot
                  ? `Lote ${muestraInfo.tamano_lote} · letra ${muestraInfo.letra} · Skip lot: no se toman muestras.`
                  : `Lote ${muestraInfo.tamano_lote} · inspección ${
                      TIPOS_INSPECCION[muestraInfo.tipo_inspeccion]
                    } · letra ${muestraInfo.letra} → revisar ${muestraInfo.muestra} pieza${
                      muestraInfo.muestra === 1 ? "" : "s"
                    }.`}
              </Alert>
            </Box>
          )}
          {CHECKS.map(([field, label]) => (
            <Field
              key={field}
              select
              name={field}
              label={label}
              form={form}
              setForm={setForm}
              required
            >
              <MenuItem value="OK">OK</MenuItem>
              <MenuItem value="NOK">NOK</MenuItem>
            </Field>
          ))}
          <Field
            select
            name="forma_adecuada"
            label="Forma adecuada"
            form={form}
            setForm={setForm}
          >
            {["OK", "NOK", "NA"].map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </Field>
          <Field
            select
            name="dimensional"
            label="¿Revisión dimensional?"
            form={form}
            setForm={setForm}
          >
            <MenuItem value="SI">Sí</MenuItem>
            <MenuItem value="NO">No</MenuItem>
          </Field>
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
          <FormControlLabel
            control={
              <Switch
                checked={form.notificado_sqe}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    notificado_sqe: event.target.checked,
                  }))
                }
              />
            }
            label="SQE notificado"
          />
          <Box sx={{ gridColumn: "1 / -1", display: "flex", gap: 2, flexWrap: "wrap" }}>
            {[
              ["sin_rebabas", "PDF evidencia de rebabas"],
              ["dimensional", "PDF evidencia dimensional"],
            ].map(([field, label]) => (
              <Button key={field} component="label" variant="outlined" startIcon={<PictureAsPdf />}>
                {files[field]?.name || label}
                <input
                  hidden
                  type="file"
                  accept="application/pdf"
                  onChange={(event) =>
                    setFiles((value) => ({
                      ...value,
                      [field]: event.target.files?.[0] || null,
                    }))
                  }
                />
              </Button>
            ))}
            <Chip
              label={`Resultado: ${resultPreview}`}
              color={resultPreview === "CONFORME" ? "success" : "error"}
            />
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
          title="Calendario semanal"
          description="Verde: programada o conforme. Rojo: no conforme."
        />
        <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
          <Field
            select
            name="component"
            label="Filtrar componente"
            form={{ component: calendarComponent }}
            setForm={(updater) => {
              const next = updater({ component: calendarComponent });
              setCalendarComponent(next.component);
            }}
            sx={{ minWidth: 280 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {components.map((item) => (
              <MenuItem key={item.id} value={String(item.id)}>
                {item.sap} · {item.componente}
              </MenuItem>
            ))}
          </Field>
          <Field
            name="year"
            label="Año"
            type="number"
            form={{ year: calendarYear }}
            setForm={(updater) => {
              const next = updater({ year: calendarYear });
              setCalendarYear(next.year);
            }}
            sx={{ width: 130 }}
          />
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))", gap: 0.75 }}>
          {calendarWeeks.map((week) => (
            <Tooltip key={week.number} title={`Semana ${week.number}: ${week.state || "Sin programar"}`}>
              <Box
                sx={{
                  py: 0.75,
                  textAlign: "center",
                  borderRadius: 1,
                  fontSize: 12,
                  fontWeight: 700,
                  color: week.state ? "#fff" : BRAND.muted,
                  bgcolor:
                    week.state === "NO_CONFORME"
                      ? "error.main"
                      : week.state
                        ? "success.main"
                        : "grey.100",
                  border: "1px solid",
                  borderColor: week.state ? "transparent" : "grey.300",
                }}
              >
                {week.number}
              </Box>
            </Tooltip>
          ))}
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ ...panelSx, mt: 2 }}>
        <PageHeading
          title="Revisiones registradas"
          description="Consulta, edita, elimina o restaura capturas."
          search={search}
          setSearch={setSearch}
          showDeleted={showDeleted}
          setShowDeleted={setShowDeleted}
        >
          <ExcelDownloadButton
            filename="revisiones_componentes"
            sheet="Revisiones"
            rows={visible}
            onError={(text) => notify(text, "error")}
            columns={[
              { header: "Fecha", value: (row) => row.fecha },
              { header: "Semana", value: (row) => row.semana },
              { header: "SAP", value: (row) => row.sap },
              { header: "Componente", value: (row) => row.componente },
              { header: "Cliente", value: (row) => row.cliente },
              { header: "Proveedor", value: (row) => row.proveedor },
              { header: "Lote", value: (row) => row.serial_lote },
              { header: "Tamaño", value: (row) => row.tamano_lote },
              {
                header: "Muestra",
                value: (row) =>
                  row.muestra != null
                    ? `${row.muestra}${row.letra_muestra ? ` (${row.letra_muestra})` : ""}`
                    : "",
              },
              { header: "Resultado", value: (row) => row.resultado },
              { header: "Rebabas", value: (row) => row.sin_rebabas },
              { header: "Dimensional", value: (row) => row.dimensional },
              {
                header: "Estado",
                value: (row) => (row.eliminado_en ? "ELIMINADO" : "ACTIVO"),
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
                        onDelete={(item) => toggle(item, "DELETE")}
                        onRestore={(item) => toggle(item, "PATCH")}
                      />
                    </TableCell>
                    <TableCell>{row.fecha}</TableCell>
                    <TableCell>{row.semana}</TableCell>
                    <TableCell>{row.sap}</TableCell>
                    <TableCell>{row.componente || "—"}</TableCell>
                    <TableCell>{row.cliente || "—"}</TableCell>
                    <TableCell>{row.proveedor}</TableCell>
                    <TableCell>{row.serial_lote || "—"}</TableCell>
                    <TableCell>{row.tamano_lote ?? "—"}</TableCell>
                    <TableCell>
                      {row.muestra != null
                        ? `${row.muestra}${row.letra_muestra ? ` (${row.letra_muestra})` : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.resultado}
                        color={row.resultado === "CONFORME" ? "success" : "error"}
                      />
                    </TableCell>
                    <TableCell>{row.sin_rebabas}</TableCell>
                    <TableCell>{row.dimensional}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <EvidenceButton row={row} field="sin_rebabas" label="Rebabas" onOpen={openPdf} />
                      <EvidenceButton row={row} field="dimensional" label="Dimensional" onOpen={openPdf} />
                      {!Number(row.pdf_sin_rebabas) && !Number(row.pdf_dimensional) ? "—" : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog
        open={lotePrompt}
        onClose={cancelLotePrompt}
        fullWidth
        maxWidth="xs"
        disableRestoreFocus
      >
        <DialogTitle>Tamaño de lote</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
            {selectedComponent
              ? `${selectedComponent.sap} · ${selectedComponent.componente} · inspección ${
                  TIPOS_INSPECCION[selectedComponent.tipo_inspeccion] || "—"
                }`
              : "Indica las piezas del lote para calcular la muestra."}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            required
            type="number"
            label="Tamaño de lote"
            value={loteDraft}
            onChange={(event) => setLoteDraft(event.target.value)}
            helperText={loteDraftError || "Número de piezas recibidas"}
            error={Boolean(loteDraftError)}
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
          />
          {loteDraftInfo && (
            <Alert
              sx={{ mt: 2 }}
              severity={loteDraftInfo.skip_lot ? "info" : "success"}
            >
              {loteDraftInfo.skip_lot
                ? `Letra ${loteDraftInfo.letra} · Skip lot: no se toman muestras.`
                : `Letra ${loteDraftInfo.letra} → revisar ${loteDraftInfo.muestra} pieza${
                    loteDraftInfo.muestra === 1 ? "" : "s"
                  } (${TIPOS_INSPECCION[loteDraftInfo.tipo_inspeccion]}).`}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={cancelLotePrompt}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={confirmLotePrompt}
            disabled={!loteDraftInfo || Boolean(loteDraftError)}
          >
            Usar este lote
          </Button>
        </DialogActions>
      </Dialog>
      <RevisionPdfDialog
        open={Boolean(pdf)}
        onClose={() => setPdf(null)}
        revisionId={pdf?.revisionId}
        campo={pdf?.campo}
        title={pdf?.title}
      />
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
