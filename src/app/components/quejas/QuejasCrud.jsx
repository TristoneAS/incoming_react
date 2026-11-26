"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Alert, Snackbar } from "@mui/material";
import ProgramasCrud from "./ProgramasCrud";
import RegistrosCrud from "./RegistrosCrud";
import ChecklistCrud from "./ChecklistCrud";

export default function QuejasCrud({ mode }) {
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("success");

  const notify = useCallback((text, tone = "success") => {
    setMessage(text);
    setSeverity(tone);
  }, []);

  const content = useMemo(() => {
    if (mode === "programar") return <ProgramasCrud notify={notify} />;
    if (mode === "registro") return <RegistrosCrud notify={notify} />;
    return <ChecklistCrud notify={notify} />;
  }, [mode, notify]);

  return (
    <>
      {content}
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
