"use client";

import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from "@mui/material";
import { Close, OpenInNew } from "@mui/icons-material";
import { PdfFrame } from "@/app/components/quejas/shared";

export default function RevisionPdfDialog({
  open,
  onClose,
  revisionId,
  campo,
  title,
}) {
  const src =
    revisionId && campo
      ? `/api/componentes/revisiones/pdf?id=${revisionId}&campo=${campo}`
      : "";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between" }}>
        {title || "Evidencia PDF"}
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {open && src ? <PdfFrame src={src} title={title || "Evidencia PDF"} /> : null}
      </DialogContent>
      <DialogActions>
        <Button
          component="a"
          href={src}
          target="_blank"
          startIcon={<OpenInNew />}
          disabled={!src}
        >
          Abrir en pestaña
        </Button>
        <Button variant="contained" onClick={onClose}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
