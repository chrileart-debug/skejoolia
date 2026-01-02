import { useState, useMemo } from "react";
import { HelpCircle, Play, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useTutorials } from "@/hooks/useTutorials";
import { getEmbedUrl } from "@/lib/videoEmbed";
import { Skeleton } from "@/components/ui/skeleton";

interface TutorialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TutorialsModal({ open, onOpenChange }: TutorialsModalProps) {
  const { data: tutorials, isLoading } = useTutorials();
  const [search, setSearch] = useState("");

  const filteredTutorials = useMemo(() => {
    if (!tutorials) return [];
    if (!search.trim()) return tutorials;
    
    const searchLower = search.toLowerCase();
    return tutorials.filter(
      (t) =>
        t.title.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower)
    );
  }, [tutorials, search]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    filteredTutorials.forEach((t) => {
      if (t.category) cats.add(t.category);
    });
    return ["Todos", ...Array.from(cats)];
  }, [filteredTutorials]);

  const getTutorialsByCategory = (category: string) => {
    if (category === "Todos") return filteredTutorials;
    return filteredTutorials.filter((t) => t.category === category);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Central de Ajuda
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tutoriais..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="px-4 pb-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredTutorials.length > 0 ? (
          <Tabs defaultValue="Todos" className="w-full">
            <div className="px-4">
              <TabsList className="w-full h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                {categories.map((category) => (
                  <TabsTrigger
                    key={category}
                    value={category}
                    className="text-xs px-2.5 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    {category}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <ScrollArea className="max-h-[50vh] px-4 pb-4">
              {categories.map((category) => (
                <TabsContent key={category} value={category} className="mt-3">
                  <Accordion type="single" collapsible className="w-full">
                    {getTutorialsByCategory(category).map((tutorial) => (
                      <AccordionItem key={tutorial.id} value={tutorial.id}>
                        <AccordionTrigger className="text-left">
                          <div className="flex items-center gap-2">
                            <Play className="h-4 w-4 text-primary flex-shrink-0" />
                            <span>{tutorial.title}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {tutorial.description && (
                            <p className="text-sm text-muted-foreground mb-3">
                              {tutorial.description}
                            </p>
                          )}
                          {tutorial.video_url && getEmbedUrl(tutorial.video_url) && (
                            <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                              <iframe
                                src={getEmbedUrl(tutorial.video_url) || ""}
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                title={tutorial.title}
                              />
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </TabsContent>
              ))}
            </ScrollArea>
          </Tabs>
        ) : (
          <p className="text-center text-muted-foreground py-8 px-4">
            {search ? "Nenhum tutorial encontrado." : "Nenhum tutorial disponível no momento."}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
