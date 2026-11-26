"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Box,
  Typography,
  AppBar,
  Toolbar,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
  Collapse,
} from "@mui/material";
import {
  Home,
  Logout,
  ExpandLess,
  ExpandMore,
  ReportProblem,
  EventNote,
  Assignment,
  Checklist,
  Inventory2,
  FactCheck,
  ViewWeek,
} from "@mui/icons-material";
import { useRouter, usePathname } from "next/navigation";
import {
  clearAuthStorageClient,
  isAuthenticatedClient,
  syncSessionCookieFromStorage,
} from "@/libs/auth_session";
import { canAccessModule, roleFromStorage } from "@/libs/incoming_access";
import { BRAND } from "@/libs/theme_palette";

const drawerWidth = 260;

const MENU_ITEMS = [
  {
    id: "inicio",
    title: "Inicio",
    icon: Home,
    description: "Panel principal",
    route: "/dashboard",
  },
  {
    id: "quejas",
    title: "Quejas",
    icon: ReportProblem,
    description: "Inspecciones por queja",
    submenu: [
      {
        id: "programar",
        title: "Programar inspección",
        icon: EventNote,
        route: "/dashboard/quejas/programar",
      },
      {
        id: "registro",
        title: "Registro de Incoming",
        icon: Assignment,
        route: "/dashboard/quejas/registro",
      },
      {
        id: "checklist",
        title: "Checklist",
        icon: Checklist,
        route: "/dashboard/quejas/checklist",
      },
    ],
  },
  {
    id: "sorteos",
    title: "Sorteos especiales",
    icon: Inventory2,
    description: "Incidencias de empaque",
    route: "/dashboard/sorteos",
  },
  {
    id: "componentes",
    title: "Revisión de componentes",
    icon: FactCheck,
    description: "Inspección rutinaria",
    submenu: [
      {
        id: "catalogo",
        title: "Catálogo",
        icon: FactCheck,
        route: "/dashboard/componentes",
      },
      {
        id: "revisiones",
        title: "Registro de revisiones",
        icon: ViewWeek,
        route: "/dashboard/componentes/registro",
      },
    ],
  },
];

function resolveWindowTitle(selectedItemId) {
  for (const item of MENU_ITEMS) {
    if (item.id === selectedItemId) return item.title;
    const sub = item.submenu?.find((entry) => entry.id === selectedItemId);
    if (sub) return sub.title;
  }
  return "Panel";
}

function DashboardShell({ selectedItemId, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState("operador");
  const [expanded, setExpanded] = useState({
    quejas: false,
    componentes: false,
  });
  const visibleMenu = useMemo(
    () =>
      MENU_ITEMS.map((item) => {
        if (item.submenu) {
          const submenu = item.submenu.filter((sub) =>
            canAccessModule(role, sub.id),
          );
          return submenu.length ? { ...item, submenu } : null;
        }
        return canAccessModule(role, item.id) ? item : null;
      }).filter(Boolean),
    [role],
  );

  const windowTitle = useMemo(
    () => resolveWindowTitle(selectedItemId),
    [selectedItemId],
  );

  useEffect(() => {
    syncSessionCookieFromStorage();

    if (!isAuthenticatedClient()) {
      const path =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "";
      router.replace(
        path.startsWith("/dashboard") && !path.startsWith("//")
          ? `/?redirect=${encodeURIComponent(path)}`
          : "/",
      );
      return;
    }

    const timer = setTimeout(() => {
      const nextRole = roleFromStorage();
      setRole(nextRole);
      if (!canAccessModule(nextRole, selectedItemId)) {
        router.replace("/dashboard");
        return;
      }
      setAuthorized(true);
      if (["programar", "registro", "checklist"].includes(selectedItemId)) {
        setExpanded((prev) => ({ ...prev, quejas: true }));
      }
      if (["catalogo", "revisiones"].includes(selectedItemId)) {
        setExpanded((prev) => ({ ...prev, componentes: true }));
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname, router, selectedItemId]);

  const handleItemClick = (item) => {
    if (item.submenu) {
      setExpanded((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
      return;
    }
    if (item.route && item.id !== selectedItemId) {
      router.push(item.route);
    }
  };

  const handleSubmenuClick = (sub) => {
    if (sub.id !== selectedItemId) router.push(sub.route);
  };

  const handleLogout = () => {
    clearAuthStorageClient();
    router.push("/");
  };

  if (!authorized) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          bgcolor: BRAND.bg,
          backgroundImage: BRAND.bgImage,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <CircularProgress sx={{ color: BRAND.primary }} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
          background: `linear-gradient(90deg, ${BRAND.primaryDark}, ${BRAND.primary})`,
          boxShadow: `0 2px 12px ${BRAND.glow}`,
          "&::after": {
            content: '""',
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "100%",
            height: 4,
            background: `linear-gradient(90deg, ${BRAND.primaryDeep}, ${BRAND.primary}, ${BRAND.amber})`,
          },
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 48, sm: 56 } }}>
          <Typography
            sx={{
              flexGrow: 1,
              fontWeight: 800,
              color: "#fff",
              textShadow: "0 1px 3px rgba(0,0,0,0.35), 0 0 8px rgba(0,0,0,0.2)",
            }}
          >
            Incoming - {windowTitle}
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            bgcolor: BRAND.navy,
            color: BRAND.paper,
            borderRight: `1px solid ${BRAND.border}`,
            backgroundImage: 'url("/white-lines2.png")',
            backgroundRepeat: "no-repeat",
            backgroundPosition: "-150px 90px",
          },
        }}
      >
        <Toolbar
          onClick={() => router.push("/dashboard")}
          sx={{
            justifyContent: "center",
            cursor: "pointer",
            minHeight: 88,
            py: 1.5,
            borderBottom: `3px solid ${BRAND.primary}`,
            backgroundImage: 'url("/white-background_2.jpg")',
            backgroundSize: "cover",
            backgroundPosition: "center",
            "&:hover": { filter: "brightness(1.04)" },
          }}
        >
          <Box
            sx={{
              width: "100%",
              maxWidth: 170,
              height: 56,
              position: "relative",
            }}
          >
            <Image
              src="/TristoneLogo.png"
              alt="Tristone"
              fill
              sizes="170px"
              style={{ objectFit: "contain", objectPosition: "center" }}
              priority
            />
          </Box>
        </Toolbar>

        <List sx={{ flex: 1, pt: 2, px: 1, overflowY: "auto" }}>
          {visibleMenu.map((item) => {
            const Icon = item.icon;
            const isExpanded = expanded[item.id];
            const isSelected = item.submenu
              ? item.submenu.some((sub) => sub.id === selectedItemId)
              : selectedItemId === item.id;

            return (
              <Box key={item.id}>
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => handleItemClick(item)}
                    sx={{
                      borderRadius: 1.5,
                      background: isSelected
                        ? `linear-gradient(135deg, ${BRAND.primaryDark} 0%, ${BRAND.primary} 100%)`
                        : "transparent",
                      boxShadow: isSelected
                        ? `0 8px 20px ${BRAND.glow}`
                        : "none",
                      "&:hover": {
                        background: isSelected
                          ? `linear-gradient(135deg, ${BRAND.primaryDeep} 0%, ${BRAND.primaryDark} 100%)`
                          : BRAND.hover,
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 40,
                        color: isSelected ? "#fff" : BRAND.primaryLight,
                      }}
                    >
                      <Icon />
                    </ListItemIcon>
                    <ListItemText
                      primary={item.title}
                      secondary={item.description}
                      slotProps={{
                        primary: {
                          sx: {
                            fontWeight: 600,
                            color: isSelected ? "#fff" : BRAND.paper,
                          },
                        },
                        secondary: {
                          sx: {
                            fontSize: "0.72rem",
                            color: isSelected
                              ? "rgba(255,255,255,0.85)"
                              : "rgba(255,255,255,0.55)",
                          },
                        },
                      }}
                    />
                    {item.submenu &&
                      (isExpanded ? (
                        <ExpandLess sx={{ color: isSelected ? "#fff" : BRAND.primaryLight }} />
                      ) : (
                        <ExpandMore sx={{ color: isSelected ? "#fff" : BRAND.primaryLight }} />
                      ))}
                  </ListItemButton>
                </ListItem>

                {item.submenu && (
                  <Collapse in={isExpanded} unmountOnExit>
                    <List disablePadding>
                      {item.submenu.map((sub) => {
                        const SubIcon = sub.icon;
                        const subSelected = selectedItemId === sub.id;
                        return (
                          <ListItem
                            key={sub.id}
                            disablePadding
                            sx={{ pl: 1.5, mb: 0.5 }}
                          >
                            <ListItemButton
                              onClick={() => handleSubmenuClick(sub)}
                              sx={{
                                borderRadius: 1.5,
                                background: subSelected
                                  ? `linear-gradient(135deg, ${BRAND.primaryDark} 0%, ${BRAND.primary} 100%)`
                                  : "transparent",
                                "&:hover": {
                                  background: subSelected
                                    ? `linear-gradient(135deg, ${BRAND.primaryDeep} 0%, ${BRAND.primaryDark} 100%)`
                                    : BRAND.hover,
                                },
                              }}
                            >
                              <ListItemIcon
                                sx={{
                                  minWidth: 32,
                                  color: subSelected ? "#fff" : BRAND.primaryLight,
                                }}
                              >
                                <SubIcon sx={{ fontSize: 20 }} />
                              </ListItemIcon>
                              <ListItemText
                                primary={sub.title}
                                slotProps={{
                                  primary: {
                                    sx: {
                                      fontSize: "0.85rem",
                                      fontWeight: subSelected ? 700 : 500,
                                      color: subSelected ? "#fff" : BRAND.paper,
                                    },
                                  },
                                }}
                              />
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                    </List>
                  </Collapse>
                )}
              </Box>
            );
          })}
        </List>

        <Divider sx={{ borderColor: BRAND.border }} />
        <List sx={{ p: 1.5 }}>
          <ListItem disablePadding>
            <ListItemButton
              onClick={handleLogout}
              sx={{
                borderRadius: 1.5,
                border: `1px solid ${BRAND.border}`,
                "&:hover": { bgcolor: BRAND.hover },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: BRAND.primaryLight }}>
                <Logout />
              </ListItemIcon>
              <ListItemText
                primary="Cerrar sesión"
                slotProps={{
                  primary: { sx: { fontWeight: 600, color: BRAND.paper } },
                }}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 2 },
          pt: { xs: 1.5, sm: 2 },
          width: `calc(100% - ${drawerWidth}px)`,
          minHeight: "100vh",
          bgcolor: BRAND.bg,
          backgroundImage: BRAND.bgImage,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
          backgroundRepeat: "no-repeat",
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 48, sm: 56 } }} />
        {children}
      </Box>
    </Box>
  );
}

export default DashboardShell;
