import { useEffect, useRef, useState } from "react";
import { generateMarketingCopy, listMarketingPromotions, Promotion, uploadMarketingFlashcard } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Copy, Download, Sparkles, Loader2, ImageIcon, Save, Camera } from "lucide-react";
import { format } from "date-fns";
import html2canvas from "html2canvas";

export default function Marketing() {
  const { toast } = useToast();
  const flashcardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedPromoId, setSelectedPromoId] = useState<string>("");
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [generatedCopy, setGeneratedCopy] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [imageZoom, setImageZoom] = useState([100]);

  useEffect(() => {
    void fetchPromotions();
  }, []);

  useEffect(() => {
    if (!selectedPromoId) {
      setSelectedPromo(null);
      setGeneratedCopy("");
      setProductImage(null);
      return;
    }
    const promo = promotions.find((item) => item.id === selectedPromoId) ?? null;
    setSelectedPromo(promo);
    setGeneratedCopy(promo?.marketing_copy ?? "");
    setProductImage(null);
    setImageZoom([100]);
    if (promo && !promo.marketing_copy) {
      void handleGenerateCopy(promo.id);
    }
  }, [selectedPromoId, promotions]);

  async function fetchPromotions() {
    try {
      setPromotions(await listMarketingPromotions());
    } catch (error) {
      console.error("Error fetching promotions:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las promociones desde la API",
        variant: "destructive",
      });
    }
  }

  function getMechanicDescription(promo: Promotion): string {
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

  function getDiscountDisplay(promo: Promotion): string {
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

  async function handleGenerateCopy(promoId: string) {
    setIsGenerating(true);
    try {
      const response = await generateMarketingCopy(promoId);
      setGeneratedCopy(response.marketing_copy);
      setPromotions((prev) =>
        prev.map((promo) => (promo.id === promoId ? { ...promo, marketing_copy: response.marketing_copy } : promo)),
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
      await navigator.clipboard.writeText(generatedCopy);
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
      setPromotions((prev) =>
        prev.map((promo) =>
          promo.id === selectedPromo.id
            ? { ...promo, flash_card_url: payload.flash_card_url, marketing_copy: payload.marketing_copy }
            : promo,
        ),
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
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Megaphone className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Kit de Difusion</h1>
          <p className="text-muted-foreground">Genera materiales de venta profesionales en segundos</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Seleccionar Promocion</CardTitle>
          <CardDescription>Elige una promocion para generar materiales</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedPromoId} onValueChange={setSelectedPromoId}>
            <SelectTrigger className="w-full md:w-[400px]">
              <SelectValue placeholder="Seleccionar promocion..." />
            </SelectTrigger>
            <SelectContent>
              {promotions.map((promo) => (
                <SelectItem key={promo.id} value={promo.id}>
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${promo.status === "activa" ? "bg-green-500" : "bg-yellow-500"}`} />
                    {promo.title} - {promo.laboratory_name || "Sin lab"}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedPromo ? (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Copywriting API
              </CardTitle>
              <CardDescription>Texto optimizado para WhatsApp Business</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isGenerating ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-3 text-muted-foreground">Generando desde la API...</span>
                </div>
              ) : (
                <>
                  <Textarea
                    value={generatedCopy}
                    onChange={(e) => setGeneratedCopy(e.target.value)}
                    placeholder="El texto generado aparecera aqui..."
                    className="min-h-[180px] text-base"
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleCopyToClipboard} disabled={!generatedCopy} className="flex-1">
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar al Portapapeles
                    </Button>
                    <Button variant="outline" onClick={() => void handleGenerateCopy(selectedPromo.id)}>
                      <Sparkles className="h-4 w-4 mr-2" />
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
                <ImageIcon className="h-5 w-5 text-primary" />
                Flashcard Visual (1080x1080)
              </CardTitle>
              <CardDescription>Imagen profesional para Instagram y WhatsApp</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleProductImageUpload} className="hidden" />

              {productImage && (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Zoom:</span>
                  <Slider value={imageZoom} onValueChange={setImageZoom} min={50} max={200} step={5} className="flex-1" />
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
                      <span className="font-bold text-xs text-gray-600">DISTRIBUIDORA</span>
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
                          <Camera className="h-10 w-10 mb-2" />
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
                      Valido del {format(new Date(selectedPromo.start_date), "dd/MM/yyyy")} al {format(new Date(selectedPromo.end_date), "dd/MM/yyyy")}
                    </p>
                    <p>Aplican terminos y condiciones. Stock sujeto a disponibilidad.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => void handleDownloadFlashcard()} disabled={isDownloading} className="flex-1" size="lg">
                  {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Descargar PNG
                </Button>
                <Button onClick={() => void handleSaveToHistory()} disabled={isSaving} variant="secondary" size="lg" className="flex-1">
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Guardar en Historial
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Megaphone className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold text-muted-foreground">Selecciona una promocion</h3>
            <p className="text-muted-foreground mt-2 max-w-md">
              Elige una promocion del dropdown para generar automaticamente el texto y la imagen para redes sociales.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
