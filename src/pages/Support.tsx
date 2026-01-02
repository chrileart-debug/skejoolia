import { Link } from "react-router-dom";
import { Mail, MessageCircle, HelpCircle, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const Support = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Logo */}
        <div className="flex items-center justify-center font-extrabold tracking-tighter select-none text-3xl md:text-4xl mb-8 text-foreground">
          <span>S</span>
          <span>K</span>
          <span>E</span>
          <span>J</span>
          <span className="text-primary inline-flex items-center justify-center mx-[2px] hover:rotate-180 transition-transform duration-700 ease-in-out">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 6v6l4 2"></path>
              <circle cx="12" cy="12" r="10"></circle>
            </svg>
          </span>
          <span>O</span>
          <span>L</span>
        </div>

        <h1 className="text-3xl font-bold text-center mb-8">Suporte</h1>

        {/* Contact Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Mail className="h-6 w-6 text-primary" />
                Email
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-2">Envie suas dúvidas por email:</p>
              <a href="mailto:suporte@skejool.com.br" className="text-primary hover:underline font-medium">
                suporte@skejool.com.br
              </a>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <MessageCircle className="h-6 w-6 text-primary" />
                WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-2">Atendimento via WhatsApp:</p>
              <a href="https://wa.me/5516997982485" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                (16) 99798-2485
              </a>
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <HelpCircle className="h-6 w-6 text-primary" />
              Perguntas Frequentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>Como funciona o período de teste gratuito?</AccordionTrigger>
                <AccordionContent>
                  Você tem 7 dias para testar todas as funcionalidades do plano escolhido gratuitamente. 
                  Não é necessário cartão de crédito para começar. Após o período de teste, você pode 
                  assinar para continuar usando.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>Posso mudar de plano depois?</AccordionTrigger>
                <AccordionContent>
                  Sim! Você pode fazer upgrade do plano Básico para o Corporativo a qualquer momento. 
                  O valor será ajustado proporcionalmente ao período restante.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>Como configuro o agente de WhatsApp?</AccordionTrigger>
                <AccordionContent>
                  Após criar sua conta, vá em "Integrações" para conectar seu WhatsApp via QR Code. 
                  Em seguida, crie um agente em "Agentes" e vincule à integração criada.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>Posso cancelar minha assinatura?</AccordionTrigger>
                <AccordionContent>
                  Sim, você pode cancelar sua assinatura a qualquer momento na página de Faturas. 
                  O acesso continua até o fim do período já pago.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5">
                <AccordionTrigger>Meus dados estão seguros?</AccordionTrigger>
                <AccordionContent>
                  Sim! Utilizamos criptografia de ponta a ponta e seguimos as melhores práticas de 
                  segurança. Seus dados são armazenados em servidores seguros e nunca são 
                  compartilhados com terceiros sem sua autorização.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Back Link */}
        <div className="mt-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Support;
