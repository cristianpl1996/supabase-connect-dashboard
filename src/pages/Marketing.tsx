import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Promotion, Laboratory, PromoMechanic } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Copy, Download, Sparkles, Loader2, ImageIcon, Upload, Save, Camera } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { GoogleGenerativeAI } from "@google/generative-ai";
import html2canvas from "html2canvas";

const API_KEY = "AIzaSyDiEnLT_ocn3_1B-y1eFGfWaP_njAHxxoM";
const genAI = new GoogleGenerativeAI(API_KEY);

interface PromotionWithDetails extends Promotion {
  laboratory?: Laboratory;
  mechanics?: PromoMechanic[];
}

export default function Marketing() {
  const { toast } = useToast();
  const flashcardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [promotions, setPromotions] = useState<PromotionWithDetails[]>([]);
  const [selectedPromoId, setSelectedPromoId] = useState<string>("");
  const [selectedPromo, setSelectedPromo] = useState<PromotionWithDetails | null>(null);
  const [generatedCopy, setGeneratedCopy] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Product image state
  const [productImage, setProductImage] = useState<string | null>(null);
  const [imageZoom, setImageZoom] = useState([100]);

  useEffect(() => {
    fetchPromotions();
  }, []);

  useEffect(() => {
    if (selectedPromoId) {
      const promo = promotions.find((p) => p.id === selectedPromoId);
      if (promo) {
        setSelectedPromo(promo);
        // Load existing marketing copy if available
        if (promo.marketing_copy) {
          setGeneratedCopy(promo.marketing_copy);
        } else {
          generateCopy(promo);
        }
        // Reset product image when changing promo
        setProductImage(null);
        setImageZoom([100]);
      }
    } else {
      setSelectedPromo(null);
      setGeneratedCopy("");
      setProductImage(null);
    }
  }, [selectedPromoId, promotions]);

  async function fetchPromotions() {
    const { data, error } = await supabase
      .from("promotions")
      .select("*")
      .in("status", ["activa", "borrador"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching promotions:", error);
      return;
    }

    const promosWithDetails: PromotionWithDetails[] = [];

    for (const promo of data || []) {
      const [labRes, mechRes] = await Promise.all([
        supabase.from("laboratories").select("*").eq("id", promo.lab_id).single(),
        supabase.from("promo_mechanics").select("*").eq("promo_id", promo.id),
      ]);

      promosWithDetails.push({
        ...promo,
        laboratory: labRes.data || undefined,
        mechanics: mechRes.data || [],
      });
    }

    setPromotions(promosWithDetails);
  }

  function getMechanicDescription(promo: PromotionWithDetails): string {
    if (!promo.mechanics || promo.mechanics.length === 0) return "Promoción Especial";

    const mech = promo.mechanics[0];
    const condition = (mech.condition_config as any) || {};
    const reward = (mech.reward_config as any) || {};

    if (mech.condition_type === "sku_list" && mech.reward_type === "free_product") {
      return `PAGUE ${condition.quantity || "X"} LLEVE ${(condition.quantity || 0) + (reward.quantity || 0)}`;
    }

    if (mech.reward_type === "discount_percent") {
      return `${reward.percentage || 0}% DESCUENTO`;
    }

    if (mech.reward_type === "special_price") {
      return `PRECIO ESPECIAL $${(reward.price || 0).toLocaleString()}`;
    }

    return "Promoción Especial";
  }

  function getDiscountDisplay(promo: PromotionWithDetails): string {
    if (!promo.mechanics || promo.mechanics.length === 0) return "";

    const mech = promo.mechanics[0];
    const reward = (mech.reward_config as any) || {};

    if (mech.reward_type === "discount_percent") {
      return `-${reward.percentage || 0}%`;
    }
    if (mech.reward_type === "free_product") {
      return `+${reward.quantity || 0} GRATIS`;
    }
    return "";
  }

  async function generateCopy(promo: PromotionWithDetails) {
    setIsGenerating(true);
    setGeneratedCopy("");

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

      const mechanicDesc = getMechanicDescription(promo);
      const labName = promo.laboratory?.name || "Laboratorio";
      const vigencia = `${format(new Date(promo.start_date), "dd MMM", { locale: es })} al ${format(new Date(promo.end_date), "dd MMM yyyy", { locale: es })}`;

      const prompt = `Actúa como un experto en Marketing B2B Veterinario.
Escribe un mensaje para WhatsApp corto, urgente y vendedor sobre esta promoción:

- Laboratorio: ${labName}
- Título: ${promo.title}
- Mecánica: ${mechanicDesc}
- Vigencia: ${vigencia}
- Descripción adicional: ${promo.description || "N/A"}

Usa emojis, destaca el beneficio financiero y pon un Call to Action claro.
Formato: Texto plano listo para pegar en WhatsApp. NO uses markdown. Máximo 280 caracteres.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      setGeneratedCopy(text.trim());
    } catch (error) {
      console.error("Error generating copy:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el texto. Intenta de nuevo.",
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
        title: "¡Copiado!",
        description: "Texto copiado al portapapeles",
      });
    } catch (error) {
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

  async function handleDownloadFlashcard() {
    if (!flashcardRef.current) return;

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
      link.download = `promo-${selectedPromo?.title?.replace(/\s+/g, "-") || "flashcard"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast({
        title: "¡Descargado!",
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
    if (!flashcardRef.current || !selectedPromo) return;

    setIsSaving(true);
    try {
      // Generate canvas
      const canvas = await html2canvas(flashcardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        width: 540,
        height: 540,
      });

      // Convert to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/png", 1.0);
      });

      // Upload to Supabase Storage
      const fileName = `flashcard-${selectedPromo.id}-${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("marketing-assets")
        .upload(fileName, blob, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast({
          title: "Error al subir",
          description: 'No se pudo subir la imagen. Verifica que el bucket "marketing-assets" exista.',
          variant: "destructive",
        });
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from("marketing-assets").getPublicUrl(fileName);

      // Update promotion record
      const { error: updateError } = await supabase
        .from("promotions")
        .update({
          flash_card_url: urlData.publicUrl,
          marketing_copy: generatedCopy,
        })
        .eq("id", selectedPromo.id);

      if (updateError) {
        console.error("Update error:", updateError);
        toast({
          title: "Error al guardar",
          description: "No se pudo actualizar la promoción",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "¡Guardado!",
        description: "Flashcard y copy guardados en el historial de la promoción",
      });

      // Refresh promotions
      fetchPromotions();
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al guardar",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Megaphone className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Kit de Difusión</h1>
            <p className="text-muted-foreground">Genera materiales de venta profesionales en segundos</p>
          </div>
        </div>

        {/* Selector de Campaña */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Seleccionar Promoción</CardTitle>
            <CardDescription>Elige una promoción activa o en borrador para generar materiales</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedPromoId} onValueChange={setSelectedPromoId}>
              <SelectTrigger className="w-full md:w-[400px]">
                <SelectValue placeholder="Seleccionar promoción activa..." />
              </SelectTrigger>
              <SelectContent>
                {promotions.map((promo) => (
                  <SelectItem key={promo.id} value={promo.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          promo.status === "activa" ? "bg-green-500" : "bg-yellow-500"
                        }`}
                      />
                      {promo.title} - {promo.laboratory?.name || "Sin lab"}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedPromo && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Generador de Copy */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Copywriting IA
                </CardTitle>
                <CardDescription>Texto optimizado para WhatsApp Business</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isGenerating ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-3 text-muted-foreground">Generando con Gemini...</span>
                  </div>
                ) : (
                  <>
                    <Textarea
                      value={generatedCopy}
                      onChange={(e) => setGeneratedCopy(e.target.value)}
                      placeholder="El texto generado aparecerá aquí..."
                      className="min-h-[180px] text-base"
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleCopyToClipboard} disabled={!generatedCopy} className="flex-1">
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar al Portapapeles
                      </Button>
                      <Button variant="outline" onClick={() => generateCopy(selectedPromo)}>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Regenerar
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Generador de Flashcard */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  Flashcard Visual (1080x1080)
                </CardTitle>
                <CardDescription>Imagen profesional para Instagram y WhatsApp</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProductImageUpload}
                  className="hidden"
                />

                {/* Image Zoom Control */}
                {productImage && (
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">Zoom:</span>
                    <Slider
                      value={imageZoom}
                      onValueChange={setImageZoom}
                      min={50}
                      max={200}
                      step={5}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-12">{imageZoom[0]}%</span>
                  </div>
                )}

                {/* Flashcard Preview - 1080x1080 aspect ratio */}
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
                  {/* Background Pattern */}
                  <div
                    className="absolute inset-0 opacity-5"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`,
                    }}
                  />

                  <div className="relative h-full p-6 flex flex-col">
                    {/* Header - Logos */}
                    <div className="flex justify-between items-start">
                      {/* Lab Logo - Top Left */}
                      <div className="bg-white rounded-lg px-3 py-2 shadow-lg">
                        <span className="font-bold text-sm text-gray-800">
                          {selectedPromo.laboratory?.name?.toUpperCase() || "LAB"}
                        </span>
                      </div>

                      {/* Distributor Logo - Top Right */}
                      <div className="bg-white/90 rounded-lg px-3 py-2 shadow-lg">
                        <span className="font-bold text-xs text-gray-600">DISTRIBUIDORA</span>
                      </div>
                    </div>

                    {/* Center Content */}
                    <div className="flex-1 flex flex-col items-center justify-center py-4">
                      {/* Product Image Upload Zone */}
                      {productImage ? (
                        <div className="relative cursor-pointer mb-4" onClick={() => fileInputRef.current?.click()}>
                          <img
                            src={productImage}
                            alt="Producto"
                            className="object-contain drop-shadow-2xl"
                            style={{
                              maxWidth: `${imageZoom[0] * 1.5}px`,
                              maxHeight: `${imageZoom[0] * 1.5}px`,
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          className="border-2 border-dashed border-white/40 rounded-xl p-8 cursor-pointer hover:border-white/70 transition-colors bg-white/10 backdrop-blur-sm mb-4"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <div className="flex flex-col items-center text-white/80">
                            <Camera className="h-10 w-10 mb-2" />
                            <span className="text-sm font-medium text-center">
                              📷 Clic para subir
                              <br />
                              foto del producto
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Promo Title */}
                      <h2 className="text-white text-xl md:text-2xl font-extrabold text-center leading-tight drop-shadow-lg mb-3">
                        {selectedPromo.title}
                      </h2>

                      {/* Discount Badge */}
                      {getDiscountDisplay(selectedPromo) && (
                        <div className="bg-red-600 text-white px-6 py-3 rounded-full shadow-xl transform -rotate-2">
                          <span className="text-2xl md:text-3xl font-black">{getDiscountDisplay(selectedPromo)}</span>
                        </div>
                      )}
                    </div>

                    {/* Mechanic Banner */}
                    <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-xl mb-4">
                      <p className="text-center text-lg md:text-xl font-bold text-gray-800">
                        {getMechanicDescription(selectedPromo)}
                      </p>
                    </div>

                    {/* Footer - Legal Text */}
                    <div className="text-center text-white/70 text-xs space-y-1">
                      <p>
                        Válido del {format(new Date(selectedPromo.start_date), "dd/MM/yyyy")} al{" "}
                        {format(new Date(selectedPromo.end_date), "dd/MM/yyyy")}
                      </p>
                      <p>Aplican términos y condiciones. Stock sujeto a disponibilidad.</p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button onClick={handleDownloadFlashcard} disabled={isDownloading} className="flex-1" size="lg">
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Descargar PNG
                  </Button>

                  <Button
                    onClick={handleSaveToHistory}
                    disabled={isSaving}
                    variant="secondary"
                    size="lg"
                    className="flex-1"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Guardar en Historial
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!selectedPromo && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Megaphone className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold text-muted-foreground">Selecciona una promoción</h3>
              <p className="text-muted-foreground mt-2 max-w-md">
                Elige una promoción activa del dropdown para generar automáticamente el texto de WhatsApp y la imagen
                profesional para redes sociales.
              </p>
            </CardContent>
          </Card>
        )}

        {/* SQL Instructions for setup */}
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-700 dark:text-amber-400">
              ⚠️ Configuración requerida en Supabase
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              Ejecuta estos comandos SQL en tu consola de Supabase para habilitar la persistencia:
            </p>
            <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
              {`-- 1. Agregar columna marketing_copy si no existe
ALTER TABLE promotions 
ADD COLUMN IF NOT EXISTS marketing_copy TEXT;

-- 2. Crear bucket de storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-assets', 'marketing-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Política para permitir uploads públicos
CREATE POLICY "Allow public uploads" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'marketing-assets');

CREATE POLICY "Allow public reads" ON storage.objects
FOR SELECT USING (bucket_id = 'marketing-assets');`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
