import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const FB_PIXEL_ID = "916021168260117";

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
    _fbq: unknown;
  }
}

// Inicializa o script do Facebook Pixel dinamicamente
function initFacebookPixel() {
  if (window.fbq) return; // Já inicializado

  const n = (window.fbq = function (...args: unknown[]) {
    if ((n as any).callMethod) {
      (n as any).callMethod.apply(n, args);
    } else {
      (n as any).queue.push(args);
    }
  }) as any;

  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];

  // Carrega o script do Facebook
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  console.log("[FB Pixel] Script loaded dynamically");
}

// Inicializa o Pixel com dados do usuário para melhor match quality
function initPixelWithUserData(userData?: { email?: string; phone?: string }) {
  if (!window.fbq) return;

  if (userData?.email || userData?.phone) {
    // Inicializa com dados avançados do usuário para melhor match quality
    window.fbq("init", FB_PIXEL_ID, {
      em: userData.email?.toLowerCase().trim(),
      ph: userData.phone?.replace(/\D/g, ""), // Remove formatação do telefone
    });
    console.log("[FB Pixel] Initialized with user data for advanced matching");
  } else {
    // Inicializa sem dados do usuário
    window.fbq("init", FB_PIXEL_ID);
    console.log("[FB Pixel] Initialized without user data");
  }
}

export function FacebookPixel() {
  const location = useLocation();
  const { user } = useAuth();
  const isInitialized = useRef(false);
  const lastUserEmail = useRef<string | null>(null);

  // Inicializa o Pixel uma vez quando o componente monta
  useEffect(() => {
    if (!isInitialized.current) {
      initFacebookPixel();
      isInitialized.current = true;
    }
  }, []);

  // Reinicializa com dados do usuário quando o usuário loga
  useEffect(() => {
    if (!window.fbq) return;

    const userEmail = user?.email;

    // Só reinicializa se o email mudou (login/logout)
    if (userEmail !== lastUserEmail.current) {
      lastUserEmail.current = userEmail || null;

      if (userEmail) {
        // Usuário logado - reinicializa com dados para melhor match
        initPixelWithUserData({
          email: userEmail,
          phone: user?.user_metadata?.phone,
        });
      } else {
        // Usuário deslogado - inicializa sem dados
        initPixelWithUserData();
      }
    }
  }, [user?.email, user?.user_metadata?.phone]);

  // Dispara PageView a cada mudança de rota
  useEffect(() => {
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "PageView");
      console.log("[FB Pixel] PageView tracked on route:", location.pathname);
    }
  }, [location.pathname]);

  // Componente não renderiza nada visualmente
  return null;
}
