import { useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { useSetPageHeader } from "@/contexts/PageHeaderContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Mail, MessageCircle, PlayCircle, BookOpen } from "lucide-react";
import { useTutorials } from "@/hooks/useTutorials";
import { getEmbedUrl } from "@/lib/videoEmbed";

interface Tutorial {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  category: string | null;
  display_order: number;
}

interface OutletContextType {
  onMenuClick: () => void;
}

export default function Help() {
  useOutletContext<OutletContextType>();
  const { data: tutorials = [], isLoading } = useTutorials();
  const [search, setSearch] = useState("");
  
  useSetPageHeader("Central de Ajuda", "Tutoriais, perguntas frequentes e suporte");
  
  const filteredTutorials = useMemo(() => {
    if (!search.trim()) return tutorials;
    const searchLower = search.toLowerCase();
    return tutorials.filter(
      (t: Tutorial) =>
        t.title.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower)
    );
  }, [tutorials, search]);

  const categories = useMemo(() => {
    const cats = new Set(filteredTutorials.map((t: Tutorial) => t.category || "Geral"));
    return Array.from(cats) as string[];
  }, [filteredTutorials]);

  const getTutorialsByCategory = (category: string): Tutorial[] => {
    return filteredTutorials.filter((t: Tutorial) => (t.category || "Geral") === category);
  };

  const faqItems = [
    {
      question: "Como faço para agendar um horário?",
      answer: "Você pode agendar através da página de Agenda, clicando no botão '+' ou diretamente em um horário disponível no calendário."
    },
    {
      question: "Como configuro meu agente de IA?",
      answer: "Acesse a página de Agentes, onde você pode criar e configurar seu agente virtual para atendimento automático via WhatsApp."
    },
    {
      question: "Como adiciono novos serviços?",
      answer: "Na página de Serviços, clique no botão '+' para adicionar um novo serviço com nome, preço, duração e descrição."
    },
    {
      question: "Como funciona o Clube de assinaturas?",
      answer: "O Clube permite criar planos de assinatura para seus clientes, oferecendo serviços recorrentes com benefícios especiais."
    },
    {
      question: "Como convido membros para minha equipe?",
      answer: "Na página de Equipe, você pode convidar novos membros por e-mail, definindo suas permissões de acesso."
    }
  ];

  return (
    <div className="min-h-screen">
      <div className="p-4 lg:p-6 space-y-6">
        {/* Contact Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                E-mail
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Envie suas dúvidas ou sugestões
              </p>
              <a
                href="mailto:suporte@skejool.com.br"
                className="text-primary hover:underline font-medium"
              >
                suporte@skejool.com.br
              </a>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Atendimento rápido via WhatsApp
              </p>
              <a
                href="https://wa.me/5516997982485"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                (16) 99798-2485
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Tutorials Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-primary" />
              Tutoriais em Vídeo
            </CardTitle>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tutoriais..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredTutorials.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {search ? "Nenhum tutorial encontrado" : "Nenhum tutorial disponível"}
              </p>
            ) : (
              <Tabs defaultValue={categories[0]} className="w-full">
                <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1">
                  {categories.map((category) => (
                    <TabsTrigger
                      key={category}
                      value={category}
                      className="text-xs sm:text-sm"
                    >
                      {category}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {categories.map((category) => (
                  <TabsContent key={category} value={category} className="mt-4">
                    <ScrollArea className="max-h-[400px]">
                      <Accordion type="single" collapsible className="space-y-2">
                        {getTutorialsByCategory(category).map((tutorial) => (
                          <AccordionItem
                            key={tutorial.id}
                            value={tutorial.id}
                            className="border rounded-lg px-4"
                          >
                            <AccordionTrigger className="hover:no-underline py-3">
                              <div className="flex items-center gap-3 text-left">
                                <PlayCircle className="w-5 h-5 text-primary shrink-0" />
                                <div>
                                  <p className="font-medium">{tutorial.title}</p>
                                  {tutorial.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {tutorial.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-4">
                              <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                                <iframe
                                  src={getEmbedUrl(tutorial.video_url)}
                                  title={tutorial.title}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  className="w-full h-full"
                                />
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </ScrollArea>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Perguntas Frequentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="space-y-2">
              {faqItems.map((item, index) => (
                <AccordionItem
                  key={index}
                  value={`faq-${index}`}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline py-3 text-left">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
