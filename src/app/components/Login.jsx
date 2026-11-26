"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  Collapse,
  Alert,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  BadgeOutlined,
  LockOutlined,
  LoginOutlined,
} from "@mui/icons-material";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getPostLoginRedirect,
  getSessionExpiresAt,
  setSessionCookieClient,
} from "@/libs/auth_session";
import { BRAND } from "@/libs/theme_palette";

const HOSES = [
  "/hose1.png",
  "/hose2.png",
  "/hose3.png",
  "/hose4.png",
  "/hose5.png",
];

function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [comoAdmin, setComoAdmin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [user, setUser] = useState({ user: "", password: "", emp_id: "" });
  const [loading, setLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertSeverity, setAlertSeverity] = useState("error");
  const [hoseIndex, setHoseIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setHoseIndex((prev) => (prev + 1) % HOSES.length),
      4000,
    );
    return () => clearInterval(id);
  }, []);

  const showAlert = (message, severity) => {
    setAlertSeverity(severity);
    setAlertMessage(message);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUser((prev) => ({ ...prev, [name]: value }));
    setAlertMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (comoAdmin && (user.user === "" || user.password === "")) {
      showAlert("Favor de llenar todos los campos", "warning");
      return;
    }
    if (!comoAdmin && !String(user.emp_id ?? "").trim()) {
      showAlert("Ingrese su ID de empleado", "warning");
      return;
    }

    const username = user.user.trim();
    const password = user.password;

    try {
      setLoading(true);

      const response = await fetch(
        comoAdmin ? "/api/auth/admin" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            comoAdmin
              ? { username, password }
              : { emp_id: String(user.emp_id).trim() },
          ),
        },
      );

      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (response.ok && data.success === true && data.auth && data.empleado) {
        showAlert("Acceso correcto, entrando al sistema", "success");
        localStorage.setItem("infoUser", JSON.stringify(data.empleado));
        localStorage.setItem("user", JSON.stringify(data.auth));
        localStorage.setItem("isAuthenticated", "true");
        const adminFlag =
          data.incomingRole === "admin" ||
          data.auth.isAdmin === true ||
          data.auth.isAdmin === "true" ||
          data.auth.isAdmin === 1;
        localStorage.setItem("isAdmin", adminFlag ? "true" : "false");
        localStorage.setItem("incomingRole", adminFlag ? "admin" : "operador");
        localStorage.setItem(
          "usuario",
          adminFlag
            ? username
            : String(data.empleado.emp_id || data.empleado.emp_alias || ""),
        );
        try {
          const expiresAt = getSessionExpiresAt();
          localStorage.setItem("sessionExpiresAt", expiresAt.toString());
          setSessionCookieClient(expiresAt);
        } catch (err) {
          console.error("No se pudo crear la cookie de sesión:", err);
        }
        const dest = getPostLoginRedirect(searchParams.get("redirect"));
        setTimeout(() => router.replace(dest), 300);
        return;
      }

      showAlert(
        data.error ||
          (comoAdmin
            ? "Usuario o contraseña incorrectos"
            : "El ID de empleado no está registrado"),
        "error",
      );
      setLoading(false);
    } catch {
      showAlert("Error al conectar con el servidor, contacte a soporte", "error");
      setLoading(false);
    }
  };

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: 1.5,
      bgcolor: "#FFFFFF",
      transition: "box-shadow 0.2s ease, border-color 0.2s ease",
      "& fieldset": { borderColor: "rgba(23, 162, 184, 0.28)" },
      "&:hover fieldset": { borderColor: BRAND.accent },
      "&.Mui-focused fieldset": {
        borderColor: BRAND.accentDark,
        borderWidth: 2,
      },
      "&.Mui-focused": {
        boxShadow: "0 0 0 4px rgba(23, 162, 184, 0.16)",
      },
    },
    "& .MuiInputLabel-root.Mui-focused": { color: BRAND.accentDark },
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: { xs: 4, md: 6 },
        backgroundImage: 'url("/white-background.jpg")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        backgroundRepeat: "no-repeat",
        "@keyframes bounceInDown": {
          "0%": { opacity: 0, transform: "translateY(-60px)" },
          "60%": { opacity: 1, transform: "translateY(12px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        "@keyframes fadeSlide": {
          "0%": { opacity: 0, transform: "translateX(24px)" },
          "100%": { opacity: 1, transform: "translateX(0)" },
        },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 420,
          overflow: "hidden",
          borderRadius: 2,
          border: "1px solid rgba(26, 35, 50, 0.10)",
          bgcolor: "rgba(255, 255, 255, 0.94)",
          backdropFilter: "blur(6px)",
          boxShadow: "0 18px 48px rgba(26, 35, 50, 0.16)",
          animation: "bounceInDown 0.6s ease-out",
        }}
      >
        <Box
          sx={{
            height: 6,
            background: `linear-gradient(90deg, ${BRAND.accentDark}, ${BRAND.accent}, ${BRAND.amber})`,
          }}
        />

        <Box sx={{ px: { xs: 3, sm: 4 }, pt: 3.5, pb: 4 }}>
          <Box sx={{ textAlign: "center" }}>
            <Box
              sx={{
                position: "relative",
                width: { xs: 200, sm: 230 },
                height: 78,
                mx: "auto",
              }}
            >
              <Image
                src="/TristoneLogo.png"
                alt="Tristone Flowtech"
                fill
                sizes="230px"
                style={{ objectFit: "contain" }}
                priority
              />
            </Box>

            <Typography
              variant="h4"
              sx={{
                mt: 1.5,
                fontWeight: 300,
                letterSpacing: 1,
                color: BRAND.ink,
              }}
            >
              Incoming
            </Typography>
            <Typography variant="body2" sx={{ color: BRAND.muted, mt: 0.5 }}>
              {comoAdmin
                ? "Ingrese su usuario y contraseña de administrador"
                : "Ingrese su ID de empleado para continuar"}
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }}>
            <Typography
              variant="overline"
              sx={{ color: BRAND.accentDark, fontWeight: 700, px: 1 }}
            >
              Login
            </Typography>
          </Divider>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <FormControlLabel
              sx={{
                display: "flex",
                justifyContent: "space-between",
                ml: 0,
                mb: 2,
                width: "100%",
              }}
              labelPlacement="start"
              label={
                <Typography variant="body2" sx={{ color: BRAND.ink }}>
                  Entrar como administrador
                </Typography>
              }
              control={
                <Switch
                  checked={comoAdmin}
                  disabled={loading}
                  onChange={(event) => {
                    setComoAdmin(event.target.checked);
                    setAlertMessage("");
                  }}
                  color="primary"
                />
              }
            />

            {comoAdmin ? (
              <>
                <TextField
                  fullWidth
                  label="Usuario"
                  name="user"
                  value={user.user}
                  onChange={handleInputChange}
                  disabled={loading}
                  sx={{ ...fieldSx, mb: 2.5 }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <BadgeOutlined sx={{ color: BRAND.accent }} />
                        </InputAdornment>
                      ),
                    },
                    htmlInput: { autoComplete: "username" },
                  }}
                />

                <TextField
                  fullWidth
                  label="Contraseña"
                  name="password"
                  value={user.password}
                  onChange={handleInputChange}
                  type={showPassword ? "text" : "password"}
                  disabled={loading}
                  sx={{ ...fieldSx, mb: 2 }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockOutlined sx={{ color: BRAND.accent }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            disabled={loading}
                            sx={{ color: BRAND.accent }}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                    htmlInput: { autoComplete: "current-password" },
                  }}
                />
              </>
            ) : (
              <TextField
                fullWidth
                label="ID de empleado"
                name="emp_id"
                value={user.emp_id}
                onChange={handleInputChange}
                disabled={loading}
                sx={{ ...fieldSx, mb: 2 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <BadgeOutlined sx={{ color: BRAND.accent }} />
                      </InputAdornment>
                    ),
                  },
                  htmlInput: { autoComplete: "off", inputMode: "numeric" },
                }}
              />
            )}

            <Collapse in={Boolean(alertMessage)} unmountOnExit>
              <Alert
                severity={alertSeverity}
                variant="filled"
                sx={{ mb: 2, borderRadius: 1.5, py: 0.25 }}
              >
                {alertMessage}
              </Alert>
            </Collapse>

            <Button
              type="submit"
              fullWidth
              disabled={loading}
              endIcon={!loading && <LoginOutlined />}
              sx={{
                py: 1.4,
                borderRadius: 1.5,
                fontWeight: 700,
                fontSize: "1rem",
                textTransform: "none",
                color: "#FFFFFF",
                background: `linear-gradient(135deg, ${BRAND.accentDark} 0%, ${BRAND.accent} 100%)`,
                boxShadow: "0 8px 20px rgba(23, 162, 184, 0.28)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                "&:hover": {
                  transform: "scale(1.02)",
                  background: `linear-gradient(135deg, #0F6674 0%, ${BRAND.accentDark} 100%)`,
                  boxShadow: "0 12px 26px rgba(23, 162, 184, 0.34)",
                },
                "&:disabled": {
                  background: "#E0E0E0",
                  color: "#9E9E9E",
                  boxShadow: "none",
                },
              }}
            >
              {loading ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CircularProgress size={20} sx={{ color: "#FFFFFF" }} />
                  Validando acceso...
                </Box>
              ) : (
                "Ingresar"
              )}
            </Button>
          </Box>

          <Box
            sx={{
              mt: 3,
              pt: 2.5,
              borderTop: "1px dashed rgba(26, 35, 50, 0.12)",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Box
              key={hoseIndex}
              sx={{
                position: "relative",
                width: 92,
                height: 64,
                flexShrink: 0,
                animation: "fadeSlide 0.6s ease-out",
              }}
            >
              <Image
                src={HOSES[hoseIndex]}
                alt="Manguera Tristone"
                fill
                sizes="92px"
                loading="eager"
                priority
                style={{ objectFit: "contain" }}
              />
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography
                variant="caption"
                sx={{ color: BRAND.muted, display: "block", lineHeight: 1.5 }}
              >
                Inspección y liberación de material en recepción.
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ mt: 1 }}>
                {HOSES.map((hose, index) => (
                  <Box
                    key={hose}
                    sx={{
                      width: index === hoseIndex ? 18 : 8,
                      height: 6,
                      borderRadius: 3,
                      transition: "width 0.3s ease, background-color 0.3s ease",
                      bgcolor:
                        index === hoseIndex
                          ? BRAND.accent
                          : "rgba(26, 35, 50, 0.18)",
                    }}
                  />
                ))}
              </Stack>
            </Box>
          </Box>

          <Typography
            variant="caption"
            sx={{
              display: "block",
              textAlign: "center",
              mt: 2.5,
              color: BRAND.muted,
            }}
          >
            Tristone Flowtech · Incoming
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

export default Login;
