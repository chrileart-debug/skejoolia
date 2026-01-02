import { HelpCircle, Play } from "lucide-react";
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
import { useTutorials } from "@/hooks/useTutorials";
import { getEmbedUrl } from "@/lib/videoEmbed";
import { Skeleton } from "@/components/ui/skeleton";

interface TutorialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TutorialsModal({ open, onOpenChange }: TutorialsModalProps) {
  const { data: tutorials, isLoading } = useTutorials();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Central de Ajuda
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] px-4 pb-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : tutorials && tutorials.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {tutorials.map((tutorial) => (
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
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhum tutorial disponível no momento.
            </p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
