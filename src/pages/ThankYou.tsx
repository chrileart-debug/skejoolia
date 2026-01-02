import { useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFacebookPixel, generateEventId } from "@/hooks/useFacebookPixel";

/**
 * Thank You Page - Confirmação após checkout externo
 * 
 * Recebe parâmetros via query string:
 * - plan: nome do plano
 * - value: valor da compra
 * - type: tipo (subscription, purchase, etc.)
 * - event_id: ID do evento para deduplicação CAPI (opcional)
 * 
 * Exemplo: /obrigado?plan=Plano%20VIP&value=99.90&type=subscription
 */
export default function ThankYou() {
  const [searchParams] = useSearchParams();
  const { trackPurchaseWithCAPI } = useFacebookPixel();
  const hasFiredPurchase = useRef(false);

  const planName = searchParams.get("plan") || "Assinatura";
  const value = parseFloat(searchParams.get("value") || "0");
  const type = searchParams.get("type") || "subscription";
  const eventIdFromUrl = searchParams.get("event_id");

  useEffect(() => {
    // Guard: Only fire once per page load
    if (hasFiredPurchase.current) return;
    
    // Guard: Only fire if we have a valid value
    if (value <= 0) {
      console.log("[ThankYou] No valid value, skipping Purchase event");
      return;
    }

    // Guard: Check sessionStorage to prevent duplicate on reload
    const sessionKey = `purchase_fired_${eventIdFromUrl || planName}`;
    if (sessionStorage.getItem(sessionKey)) {
      console.log("[ThankYou] Purchase already fired for this session, skipping");
      hasFiredPurchase.current = true;
      return;
    }

    hasFiredPurchase.current = true;
    sessionStorage.setItem(sessionKey, "true");

    // Fire Purchase event with CAPI
    const eventId = eventIdFromUrl || generateEventId();
    
    trackPurchaseWithCAPI({
      value,
      currency: "BRL",
      contentName: planName,
      contentType: type,
      eventId,
    });

    console.log("[ThankYou] Purchase event fired:", { planName, value, type, eventId });
  }, [planName, value, type, eventIdFromUrl, trackPurchaseWithCAPI]);

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          {/* Success Icon */}
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-10 h-10 text-primary-foreground" />
            </div>
            <Sparkles className="absolute -top-1 -right-1 w-6 h-6 text-primary animate-pulse" />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Compra Confirmada!
            </h1>
            <p className="text-muted-foreground">
              Obrigado por sua assinatura
            </p>
          </div>

          {/* Purchase Details */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Plano</span>
              <span className="font-medium text-foreground">{planName}</span>
            </div>
            {value > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Valor</span>
                <span className="font-bold text-primary text-lg">
                  {formatPrice(value)}
                </span>
              </div>
            )}
          </div>

          {/* Message */}
          <p className="text-sm text-muted-foreground">
            Você receberá um e-mail de confirmação com todos os detalhes da sua assinatura.
          </p>

          {/* CTA */}
          <div className="space-y-3 pt-2">
            <Button asChild className="w-full" size="lg">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao início
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
