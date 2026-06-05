import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { generateAiText, listMarketingPromotions, MarketingPromotion, uploadMarketingFlashcard } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { ModuleErrorCard } from "@/components/common/ModuleErrorCard";
import { ErrorDisabledContent } from "@/components/common/ErrorDisabledContent";
import { PageHeader } from "@/components/common/PageHeader";
import { Megaphone, Copy, Download, Sparkles, Loader2, ImageIcon, Save, Camera, ChevronsUpDown, Check } from "lucide-react";
import { format } from "date-fns";
import html2canvas from "html2canvas";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<string, string> = {
  activa:     'bg-emerald-500',
  borrador:   'bg-gray-400',
  cancelada:  'bg-red-500',
  finalizada: 'bg-slate-400',
  revision:   'bg-amber-500',
  aprobada:   'bg-blue-500',
  pausada:    'bg-orange-500',
};

const MARKETING_AI_MODEL = (import.meta.env.VITE_MARKETING_AI_MODEL as string | undefined) ?? "gpt-4o-mini";
const MARKETING_SYSTEM_PROMPT =
  "Eres un copywriter senior para distribuidores veterinarios B2B en Colombia. " +
  "Genera un unico mensaje listo para WhatsApp Business, directo, comercial y natural. " +
  "No uses markdown, comillas, emojis, hashtags ni explicaciones. Maximo 280 caracteres.";
function MarketingAiLoader() {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-background px-6 py-10">
      <style>{`
        @keyframes marketing-ai-float {
          0%, 100% { transform: translateY(0); opacity: .35; }
          50% { transform: translateY(-10px); opacity: .8; }
        }
        @keyframes marketing-ai-wave {
          0%, 100% { transform: scaleY(.45); opacity: .35; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes marketing-ai-sweep {
          0% { transform: translateX(-18%) translateY(0); }
          50% { transform: translateX(12%) translateY(-2%); }
          100% { transform: translateX(-18%) translateY(0); }
        }
        @keyframes marketing-ai-sweep-reverse {
          0% { transform: translateX(14%) translateY(0); }
          50% { transform: translateX(-10%) translateY(2%); }
          100% { transform: translateX(14%) translateY(0); }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-[-10%] top-[18%] h-28 rounded-full bg-primary/10 blur-3xl animate-[marketing-ai-sweep_4.2s_ease-in-out_infinite]" />
        <div className="absolute inset-x-[-14%] bottom-[14%] h-32 rounded-full bg-primary/8 blur-3xl animate-[marketing-ai-sweep-reverse_5.4s_ease-in-out_infinite]" />
        <div className="absolute left-[18%] top-[34%] size-2 rounded-full bg-primary/35 animate-[marketing-ai-float_3.4s_ease-in-out_infinite]" />
        <div className="absolute right-[20%] top-[42%] size-2 rounded-full bg-primary/40 animate-[marketing-ai-float_4.1s_ease-in-out_infinite]" />
        <div className="absolute left-[30%] top-[58%] size-1.5 rounded-full bg-primary/25 animate-[marketing-ai-float_3.1s_ease-in-out_infinite]" />
        <div className="absolute right-[32%] top-[62%] size-1.5 rounded-full bg-primary/30 animate-[marketing-ai-float_3.8s_ease-in-out_infinite]" />
      </div>

      <div className="relative z-10 flex min-h-[180px] flex-col items-center justify-center gap-6 text-center">
        <div className="flex items-end gap-1.5">
          {[0, 1, 2, 3, 4, 5, 6].map((item) => (
            <span
              key={item}
              className="w-1.5 rounded-full bg-primary animate-[marketing-ai-wave_1.1s_ease-in-out_infinite]"
              style={{
                height: `${18 + [6, 18, 30, 42, 30, 18, 6][item]}px`,
                animationDelay: `${item * 90}ms`,
              }}
            />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Generando resultado…</p>
      </div>
    </div>
  );
}

export default function Marketing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const flashcardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousSelectedPromoIdRef = useRef<string>("");

  const {
    data: allPromotions = [],
    isLoading: isLoadingPromotions,
    isError,
    error: promotionsError,
    refetch,
  } = useQuery({
    queryKey: ['marketing-promotions'],
    queryFn: listMarketingPromotions,
    staleTime: 30_000,
  });

  const promotions = allPromotions.filter((p) => p.status !== 'cancelada' && p.status !== 'finalizada');

  const [selectedPromoId, setSelectedPromoId] = useState<string>("");
  const [comboOpen, setComboOpen] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<MarketingPromotion | null>(null);
  const [generatedCopy, setGeneratedCopy] = useState("");
  const [displayedCopy, setDisplayedCopy] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTypingCopy, setIsTypingCopy] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [imageZoom, setImageZoom] = useState([100]);

  // eslint-disable-next-line react-doctor/no-cascading-set-state -- intentional: animation timer; setStates run at different moments across interval ticks
  useEffect(() => {
    if (!isTypingCopy) return;

    setDisplayedCopy("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setDisplayedCopy(generatedCopy.slice(0, index));
      if (index >= generatedCopy.length) {
        window.clearInterval(timer);
        setIsTypingCopy(false);
      }
    }, 14);

    return () => window.clearInterval(timer);
  }, [generatedCopy, isTypingCopy]);

  useEffect(() => {
    if (!selectedPromoId) {
      previousSelectedPromoIdRef.current = "";
      // React 18 batches these synchronous resets into a single re-render
      setSelectedPromo(null);
      setGeneratedCopy("");
      setDisplayedCopy("");
      setProductImage(null);
      return;
    }

    const promo = promotions.find((item) => item.id === selectedPromoId) ?? null;
    const selectedChanged = previousSelectedPromoIdRef.current !== selectedPromoId;
    previousSelectedPromoIdRef.current = selectedPromoId;

    setSelectedPromo(promo);
    if (selectedChanged) {
      setGeneratedCopy(promo?.marketing_copy ?? "");
      setDisplayedCopy(promo?.marketing_copy ?? "");
      setIsTypingCopy(false);
      setProductImage(null);
      setImageZoom([100]);
      if (promo && !promo.marketing_copy) {
        void handleGenerateCopy(promo);
      }
      return;
    }

    if (!isGenerating && !isTypingCopy && promo?.marketing_copy !== undefined) {
      setGeneratedCopy(promo?.marketing_copy ?? "");
      setDisplayedCopy(promo?.marketing_copy ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: promo is derived from existing deps; handleGenerateCopy is not useCallback
  }, [selectedPromoId, promotions, isGenerating, isTypingCopy]);

  function getMechanicDescription(promo: MarketingPromotion): string {
    if (!promo.mechanic) return "Promocion Especial";
    const condition = promo.mechanic.condition_config ?? {};
    const reward = promo.mechanic.reward_config ?? {};
    if (promo.mechanic.condition_type === "sku_list" && promo.mechanic.reward_type === "free_product") {
      return `PAGUE ${String(condition.quantity ?? "X")} LLEVE ${Number(condition.quantity ?? 0) + Number(reward.value ?? reward.quantity ?? 0)}`;
    }
    if (promo.mechanic.reward_type === "discount_percent") {
      return `${reward.value ?? reward.discount_percent ?? 0}% DESCUENTO`;
    }
    if (promo.mechanic.reward_type === "price_override") {
      return `PRECIO ESPECIAL $${Number(reward.value ?? reward.special_price ?? 0).toLocaleString()}`;
    }
    return "Promocion Especial";
  }

  function getDiscountDisplay(promo: MarketingPromotion): string {
    if (!promo.mechanic) return "";
    const reward = promo.mechanic.reward_config ?? {};
    if (promo.mechanic.reward_type === "discount_percent") {
      return `-${reward.value ?? reward.discount_percent ?? 0}%`;
    }
    if (promo.mechanic.reward_type === "free_product") {
      return `+${reward.value ?? reward.quantity ?? reward.free_qty ?? 0} GRATIS`;
    }
    return "";
  }

  function buildMarketingUserInput(promo: MarketingPromotion): string {
    const labName = promo.laboratory_name || "Laboratorio";
    const description = promo.description || "N/A";
    const mechanicDescription = promo.mechanic?.summary || getMechanicDescription(promo) || "Promocion especial";
    const start = format(new Date(promo.start_date + 'T00:00:00'), "dd/MM/yyyy");
    const end = format(new Date(promo.end_date + 'T00:00:00'), "dd/MM/yyyy");

    return [
      "Actua como un experto en marketing B2B veterinario.",
      "Escribe un mensaje corto, urgente y vendedor para WhatsApp, sin markdown y maximo 280 caracteres.",
      `Laboratorio: ${labName}.`,
      `Titulo: ${promo.title}.`,
      `Mecanica: ${mechanicDescription}.`,
      `Vigencia: ${start} al ${end}.`,
      `Descripcion adicional: ${description}.`,
    ].join(" ");
  }

  async function handleGenerateCopy(promo: MarketingPromotion) {
    setIsGenerating(true);
    try {
      const response = await generateAiText({
        model: MARKETING_AI_MODEL,
        system_prompt: MARKETING_SYSTEM_PROMPT,
        user_input: buildMarketingUserInput(promo),
        temperature: 0.7,
        max_output_tokens: 140,
      });
      setGeneratedCopy(response.text);
      setDisplayedCopy("");
      setIsTypingCopy(true);
      queryClient.setQueryData<MarketingPromotion[]>(['marketing-promotions'], (prev) =>
        prev?.map((item) => item.id === promo.id ? { ...item, marketing_copy: response.text } : item) ?? []
      );
    } catch (error) {
      console.error("Error generating copy:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el texto desde la API",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopyToClipboard() {
    try {
      await navigator.clipboard.writeText(displayedCopy || generatedCopy);
      toast({
        title: "Copiado",
        description: "Texto copiado al portapapeles",
      });
    } catch {
      toast({
        title: "Error",
        description: "No se pudo copiar el texto",
        variant: "destructive",
      });
    }
  }

  function handleProductImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Por favor sube un archivo de imagen",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setProductImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function buildCanvasBlob(): Promise<Blob | null> {
    if (!flashcardRef.current) return null;
    const canvas = await html2canvas(flashcardRef.current, {
      scale: 2,
      backgroundColor: null,
      useCORS: true,
      width: 540,
      height: 540,
    });
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png", 1.0);
    });
  }

  async function handleDownloadFlashcard() {
    if (!flashcardRef.current || !selectedPromo) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(flashcardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        width: 540,
        height: 540,
      });
      const link = document.createElement("a");
      link.download = `promo-${selectedPromo.title.replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({
        title: "Descargado",
        description: "Imagen guardada correctamente",
      });
    } catch (error) {
      console.error("Error downloading:", error);
      toast({
        title: "Error",
        description: "No se pudo descargar la imagen",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleSaveToHistory() {
    if (!selectedPromo) return;
    setIsSaving(true);
    try {
      const blob = await buildCanvasBlob();
      if (!blob) throw new Error("No se pudo generar la imagen");
      const payload = await uploadMarketingFlashcard(
        selectedPromo.id,
        blob,
        `flashcard-${selectedPromo.id}-${Date.now()}.png`,
        generatedCopy,
      );
      queryClient.setQueryData<MarketingPromotion[]>(['marketing-promotions'], (prev) =>
        prev?.map((promo) =>
          promo.id === selectedPromo.id
            ? { ...promo, flash_card_url: payload.flash_card_url, marketing_copy: payload.marketing_copy }
            : promo
        ) ?? []
      );
      setSelectedPromo((prev) =>
        prev ? { ...prev, flash_card_url: payload.flash_card_url, marketing_copy: payload.marketing_copy } : prev,
      );
      toast({
        title: "Guardado",
        description: "Flashcard y copy guardados en el historial de la promocion",
      });
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Error",
        description: "Ocurrio un error al guardar en la API",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-screen-2xl space-y-5 sm:space-y-6">
      <ErrorDisabledContent disabled={isError}>
        <PageHeader
          icon={Megaphone}
          title="Kit de Difusion"
          description="Genera materiales de venta profesionales en segundos"
        />
      </ErrorDisabledContent>

      {isError && (
        <ModuleErrorCard
          message={promotionsError instanceof Error ? promotionsError.message : 'Error al cargar las promociones'}
          onRetry={() => void refetch()}
          loading={isLoadingPromotions}
        />
      )}

      <ErrorDisabledContent disabled={isError} className="space-y-5 sm:space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Seleccionar Promocion</CardTitle>
            <CardDescription>Elige una promocion para generar materiales</CardDescription>
          </CardHeader>
          <CardContent>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboOpen}
                  disabled={isLoadingPromotions}
                  className="w-full md:w-[480px] justify-between font-normal"
                >
                  {selectedPromoId && selectedPromo ? (
                    <span className="flex items-center gap-2 truncate">
                      <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[selectedPromo.status] ?? 'bg-gray-400'}`} />
                      <span className="truncate">{selectedPromo.title} — {selectedPromo.laboratory_name || 'Sin Laboratorio'}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Seleccionar promocion…</span>
                  )}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[480px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar promocion…" />
                  <CommandList className="max-h-72">
                    <CommandEmpty>No se encontraron promociones.</CommandEmpty>
                    <CommandGroup>
                      {promotions.map((promo) => (
                        <CommandItem
                          key={promo.id}
                          value={`${promo.id} ${promo.title} ${promo.laboratory_name ?? ''} ${promo.status}`}
                          onSelect={() => {
                            setSelectedPromoId(promo.id);
                            setComboOpen(false);
                          }}
                          className="gap-2.5"
                        >
                          <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[promo.status] ?? 'bg-gray-400'}`} />
                          <span className="flex-1 truncate">{promo.title} — {promo.laboratory_name || 'Sin Laboratorio'}</span>
                          <Check className={cn('size-4 shrink-0 text-primary', selectedPromoId === promo.id ? 'opacity-100' : 'opacity-0')} />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>

        {selectedPromo ? (
          <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />
                  Copywriting IA
                </CardTitle>
                <CardDescription>Texto optimizado para promociones</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isGenerating ? (
                  <MarketingAiLoader />
                ) : (
                  <>
                    <div className="relative">
                      <Textarea
                        value={displayedCopy}
                        onChange={(e) => {
                          setDisplayedCopy(e.target.value);
                          setGeneratedCopy(e.target.value);
                          setIsTypingCopy(false);
                        }}
                        disabled={isGenerating}
                        placeholder="El texto generado aparecera aqui…"
                        className="min-h-[180px] pr-8 text-base"
                      />
                      {isTypingCopy && (
                        <span className="pointer-events-none absolute bottom-5 right-4 h-5 w-[2px] animate-pulse bg-primary" />
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Button onClick={handleCopyToClipboard} disabled={!displayedCopy || isGenerating} className="w-full">
                        <Copy className="size-4 mr-2" />
                        Copiar al Portapapeles
                      </Button>
                      <Button variant="outline" onClick={() => void handleGenerateCopy(selectedPromo)} disabled={isGenerating} className="w-full sm:w-auto">
                        <Sparkles className="size-4 mr-2" />
                        Regenerar
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="size-5 text-primary" />
                  Flashcard Visual (1080x1080)
                </CardTitle>
                <CardDescription>Imagen profesional para Instagram y WhatsApp</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleProductImageUpload} className="hidden" />

                {productImage && (
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">Zoom:</span>
                    <Slider value={imageZoom} onValueChange={setImageZoom} min={50} max={200} step={5} disabled={isDownloading || isSaving} className="flex-1" />
                    <span className="text-sm font-medium w-12">{imageZoom[0]}%</span>
                  </div>
                )}

                <div
                  ref={flashcardRef}
                  className="relative overflow-hidden rounded-xl"
                  style={{
                    width: "100%",
                    maxWidth: "540px",
                    aspectRatio: "1/1",
                    background: "linear-gradient(145deg, #1e3a5f 0%, #0d9488 50%, #059669 100%)",
                    margin: "0 auto",
                  }}
                >
                  <div className="relative h-full p-6 flex flex-col">
                    <div className="flex justify-between items-start">
                      <div className="bg-white rounded-lg px-3 py-2 shadow-lg">
                        <span className="font-bold text-sm text-gray-800">{selectedPromo.laboratory_name?.toUpperCase() || "LAB"}</span>
                      </div>
                      <div className="bg-white/90 rounded-lg px-3 py-2 shadow-lg">
                        <span className="font-bold text-xs text-gray-600">IVANAGRO S.A.</span>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center py-4">
                      {productImage ? (
                        <div className="relative cursor-pointer mb-4" onClick={() => fileInputRef.current?.click()}>
                          <img
                            src={productImage}
                            alt="Producto"
                            className="object-contain drop-shadow-2xl"
                            style={{ maxWidth: `${imageZoom[0] * 1.5}px`, maxHeight: `${imageZoom[0] * 1.5}px` }}
                          />
                        </div>
                      ) : (
                        <div
                          className="border-2 border-dashed border-white/40 rounded-xl p-8 cursor-pointer hover:border-white/70 transition-colors bg-white/10 backdrop-blur-sm mb-4"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <div className="flex flex-col items-center text-white/80">
                            <Camera className="size-10 mb-2" />
                            <span className="text-sm font-medium text-center">Clic para subir foto del producto</span>
                          </div>
                        </div>
                      )}

                      <h2 className="text-white text-xl md:text-2xl font-extrabold text-center leading-tight drop-shadow-lg mb-3">{selectedPromo.title}</h2>

                      {getDiscountDisplay(selectedPromo) && (
                        <div className="bg-red-600 text-white px-6 py-3 rounded-full shadow-xl transform -rotate-2">
                          <span className="text-2xl md:text-3xl font-black">{getDiscountDisplay(selectedPromo)}</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-xl mb-4">
                      <p className="text-center text-lg md:text-xl font-bold text-gray-800">{getMechanicDescription(selectedPromo)}</p>
                    </div>

                    <div className="text-center text-white/70 text-xs space-y-1">
                      <p>
                        Valido del {format(new Date(selectedPromo.start_date + 'T00:00:00'), "dd/MM/yyyy")} al {format(new Date(selectedPromo.end_date + 'T00:00:00'), "dd/MM/yyyy")}
                      </p>
                      <p>Aplican terminos y condiciones. Inventario sujeto a disponibilidad.</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button onClick={() => void handleDownloadFlashcard()} disabled={isDownloading || isGenerating} className="w-full" size="lg">
                    {isDownloading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Download className="size-4 mr-2" />}
                    Descargar PNG
                  </Button>
                  <Button onClick={() => void handleSaveToHistory()} disabled={isSaving || isGenerating} variant="secondary" size="lg" className="w-full">
                    {isSaving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
                    Guardar en Historial
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Megaphone className="size-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold text-muted-foreground">Selecciona una promocion</h3>
              <p className="text-muted-foreground mt-2 max-w-md">
                Elige una promocion del dropdown para generar automaticamente el texto y la imagen para redes sociales.
              </p>
            </CardContent>
          </Card>
        )}
      </ErrorDisabledContent>
    </div>
  );
}
