"use client";

import React, { useEffect, useState } from "react";
import { Box, Paper, Typography, Chip } from "@mui/material";
import { Inventory2, FactCheck, VerifiedUser } from "@mui/icons-material";
import { BRAND } from "@/libs/theme_palette";

function Dashboard() {
  const [usuario, setUsuario] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setUsuario(localStorage.getItem("usuario") || "");
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const cards = [
    {
      icon: Inventory2,
      title: "Recepción",
      text: "Registro de material incoming.",
    },
    {
      icon: FactCheck,
      title: "Inspección",
      text: "Verificación de calidad en planta.",
    },
    {
      icon: VerifiedUser,
      title: "Liberación",
      text: "Aceptación o rechazo del lote.",
    },
  ];

  return (
    <Box>
      <Box
        sx={{
          mb: 3,
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { sm: "center" },
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 300, letterSpacing: 1, color: BRAND.ink }}
          >
            Panel Incoming
          </Typography>
          <Typography variant="body2" sx={{ color: BRAND.muted, mt: 0.5 }}>
            Bienvenido{usuario ? `, ${usuario}` : ""}. Este es el inicio del
            sistema.
          </Typography>
        </Box>
        <Chip
          label="Sesión activa"
          sx={{
            bgcolor: BRAND.soft,
            color: BRAND.primaryDark,
            fontWeight: 700,
            border: `1px solid ${BRAND.border}`,
          }}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
          },
          gap: 2,
        }}
      >
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Paper
              key={card.title}
              elevation={0}
              sx={{
                p: 2.5,
                overflow: "hidden",
                position: "relative",
                border: "1px solid rgba(26, 35, 50, 0.10)",
                borderRadius: 2,
                bgcolor: "rgba(255, 255, 255, 0.94)",
                backdropFilter: "blur(6px)",
                boxShadow: "0 12px 32px rgba(26, 35, 50, 0.10)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: 4,
                  background: `linear-gradient(90deg, ${BRAND.primaryDark}, ${BRAND.primary}, ${BRAND.amber})`,
                },
                "&:hover": {
                  transform: "translateY(-3px)",
                  boxShadow: `0 16px 36px ${BRAND.glow}`,
                },
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "12px",
                  display: "grid",
                  placeItems: "center",
                  bgcolor: BRAND.soft,
                  color: BRAND.primaryDark,
                  mt: 0.5,
                  mb: 1.5,
                }}
              >
                <Icon />
              </Box>
              <Typography sx={{ fontWeight: 800, color: BRAND.ink }}>
                {card.title}
              </Typography>
              <Typography variant="body2" sx={{ color: BRAND.muted, mt: 0.5 }}>
                {card.text}
              </Typography>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}

export default Dashboard;
