"use client";

import React from "react";
import { Box, Paper, Typography } from "@mui/material";
import { BRAND } from "@/libs/theme_palette";

export default function ModulePlaceholder({ title, description }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 2,
        border: "1px solid rgba(26, 35, 50, 0.10)",
        bgcolor: "rgba(255, 255, 255, 0.94)",
        boxShadow: "0 12px 32px rgba(26, 35, 50, 0.10)",
        "&::before": {
          content: '""',
          display: "block",
          height: 4,
          mx: -3,
          mt: -3,
          mb: 2.5,
          background: `linear-gradient(90deg, ${BRAND.primaryDark}, ${BRAND.primary}, ${BRAND.amber})`,
        },
      }}
    >
      <Typography
        variant="h4"
        sx={{ fontWeight: 300, letterSpacing: 0.6, color: BRAND.ink }}
      >
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: BRAND.muted, mt: 1, maxWidth: 720 }}>
        {description}
      </Typography>
      <Box sx={{ mt: 2.5, color: BRAND.primaryDark, fontSize: 13, fontWeight: 700 }}>
        Módulo listo para conectar con MySQL
      </Box>
    </Paper>
  );
}
