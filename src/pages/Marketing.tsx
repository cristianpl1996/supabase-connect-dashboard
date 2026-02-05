import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Promotion, Laboratory, PromoMechanic } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, Copy, Download, Sparkles, Loader2, ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { GoogleGenerativeAI } from '@google/generative-ai';
import html2canvas from 'html2canvas';

const API_KEY = "AIzaSyDiEnLT_ocn3_1B-y1eFGfWaP_njAHxxoM";
const genAI = new GoogleGenerativeAI(API_KEY);

interface PromotionWithDetails extends Promotion {
  laboratory?: Laboratory;
  mechanics?: PromoMechanic[];
}

export default function Marketing() {
  const { toast } = useToast();
  const flashcardRef = useRef<HTMLDivElement>(null);
  
  const [promotions, setPromotions] = useState<PromotionWithDetails[]>([]);
  const [selectedPromoId, setSelectedPromoId] = useState<string>('');
  const [selectedPromo, setSelectedPromo] = useState<PromotionWithDetails | null>(null);
  const [generatedCopy, setGeneratedCopy] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    fetchPromotions();
  }, []);

  useEffect(() => {
    if (selectedPromoId) {
      const promo = promotions.find(p => p.id === selectedPromoId);
      if (promo) {
        setSelectedPromo(promo);
        generateCopy(promo);
      }
    } else {
      setSelectedPromo(null);
      setGeneratedCopy('');
    }
  }, [selectedPromoId, promotions]);

  async function fetchPromotions() {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .in('status', ['activa', 'borrador'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching promotions:', error);
      return;
    }

    // Fetch labs and mechanics for each promotion
    const promosWithDetails: PromotionWithDetails[] = [];
    
    for (const promo of data || []) {
      const [labRes, mechRes] = await Promise.all([
        supabase.from('laboratories').select('*').eq('id', promo.lab_id).single(),
        supabase.from('promo_mechanics').select('*').eq('promo_id', promo.id)
      ]);
      
      promosWithDetails.push({
        ...promo,
        laboratory: labRes.data || undefined,
        mechanics: mechRes.data || []
      });
    }

    setPromotions(promosWithDetails);
  }

  function getMechanicDescription(promo: PromotionWithDetails): string {
    if (!promo.mechanics || promo.mechanics.length === 0) return 'Sin mecánica definida';
    
    const mech = promo.mechanics[0];
    const condition = mech.condition_config as any || {};
    const reward = mech.reward_config as any || {};
    
    let conditionText = '';
    if (mech.condition_type === 'sku_list') {
      conditionText = `Compra ${condition.quantity || 'X'} unidades`;
    } else if (mech.condition_type === 'min_amount') {
      conditionText = `Compra mínima $${(condition.amount || 0).toLocaleString()}`;
    } else if (mech.condition_type === 'category') {
      conditionText = `En categoría ${condition.category || ''}`;
    }
    
    let rewardText = '';
    if (mech.reward_type === 'free_product') {
      rewardText = `Lleva ${reward.quantity || 'X'} GRATIS`;
    } else if (mech.reward_type === 'discount_percent') {
      rewardText = `${reward.percentage || 0}% de descuento`;
    } else if (mech.reward_type === 'special_price') {
      rewardText = `Precio especial $${(reward.price || 0).toLocaleString()}`;
    }
    
    return `${conditionText} → ${rewardText}`;
  }

  async function generateCopy(promo: PromotionWithDetails) {
    setIsGenerating(true);
    setGeneratedCopy('');
    
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const mechanicDesc = getMechanicDescription(promo);
      const labName = promo.laboratory?.name || 'Laboratorio';
      const vigencia = `${format(new Date(promo.start_date), 'dd MMM', { locale: es })} al ${format(new Date(promo.end_date), 'dd MMM yyyy', { locale: es })}`;
      
      const prompt = `Actúa como un experto en Marketing B2B Veterinario.
Escribe un mensaje para WhatsApp corto, urgente y vendedor sobre esta promoción:

- Laboratorio: ${labName}
- Título: ${promo.title}
- Mecánica: ${mechanicDesc}
- Vigencia: ${vigencia}
- Descripción adicional: ${promo.description || 'N/A'}

Usa emojis, destaca el beneficio financiero y pon un Call to Action claro.
Formato: Texto plano listo para pegar en WhatsApp. NO uses markdown. Máximo 280 caracteres.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      setGeneratedCopy(text.trim());
    } catch (error) {
      console.error('Error generating copy:', error);
      toast({
        title: 'Error',
        description: 'No se pudo generar el texto. Intenta de nuevo.',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopyToClipboard() {
    try {
      await navigator.clipboard.writeText(generatedCopy);
      toast({
        title: '¡Copiado!',
        description: 'Texto copiado al portapapeles'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo copiar el texto',
        variant: 'destructive'
      });
    }
  }

  async function handleDownloadFlashcard() {
    if (!flashcardRef.current) return;
    
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(flashcardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true
      });
      
      const link = document.createElement('a');
      link.download = `promo-${selectedPromo?.title?.replace(/\s+/g, '-') || 'flashcard'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast({
        title: '¡Descargado!',
        description: 'Imagen guardada correctamente'
      });
    } catch (error) {
      console.error('Error downloading:', error);
      toast({
        title: 'Error',
        description: 'No se pudo descargar la imagen',
        variant: 'destructive'
      });
    } finally {
      setIsDownloading(false);
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
            <p className="text-muted-foreground">
              Genera materiales de venta en segundos
            </p>
          </div>
        </div>

        {/* Selector de Campaña */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Seleccionar Promoción</CardTitle>
            <CardDescription>
              Elige una promoción activa o en borrador para generar materiales
            </CardDescription>
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
                      <span className={`w-2 h-2 rounded-full ${
                        promo.status === 'activa' ? 'bg-green-500' : 'bg-yellow-500'
                      }`} />
                      {promo.title} - {promo.laboratory?.name || 'Sin lab'}
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
                <CardDescription>
                  Texto optimizado para WhatsApp Business
                </CardDescription>
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
                      className="min-h-[200px] text-base"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCopyToClipboard}
                        disabled={!generatedCopy}
                        className="flex-1"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar al Portapapeles
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => generateCopy(selectedPromo)}
                      >
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
                  Flashcard Visual
                </CardTitle>
                <CardDescription>
                  Imagen lista para Estado de WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Flashcard Preview */}
                <div
                  ref={flashcardRef}
                  className="relative overflow-hidden rounded-xl p-6 text-white"
                  style={{
                    background: 'linear-gradient(135deg, #0ea5e9 0%, #10b981 50%, #059669 100%)',
                    aspectRatio: '9/16',
                    maxHeight: '400px'
                  }}
                >
                  {/* Background Pattern */}
                  <div 
                    className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                    }}
                  />
                  
                  <div className="relative h-full flex flex-col justify-between">
                    {/* Header - Lab Name */}
                    <div className="text-center">
                      <div className="inline-block bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                        <span className="font-bold text-lg tracking-wide">
                          {selectedPromo.laboratory?.name?.toUpperCase() || 'LABORATORIO'}
                        </span>
                      </div>
                    </div>

                    {/* Center - Main Content */}
                    <div className="text-center space-y-4">
                      <h2 className="text-2xl md:text-3xl font-extrabold leading-tight drop-shadow-lg">
                        {selectedPromo.title}
                      </h2>
                      
                      <div className="bg-white/25 backdrop-blur-sm rounded-xl p-4 mx-auto max-w-[90%]">
                        <p className="text-xl font-bold">
                          {getMechanicDescription(selectedPromo)}
                        </p>
                      </div>
                    </div>

                    {/* Footer - Validity */}
                    <div className="text-center space-y-2">
                      <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 inline-block">
                        <p className="text-sm font-medium opacity-90">Válido hasta</p>
                        <p className="font-bold">
                          {format(new Date(selectedPromo.end_date), "dd 'de' MMMM, yyyy", { locale: es })}
                        </p>
                      </div>
                      
                      <p className="text-xs opacity-75">
                        ¡Pregunta a tu asesor comercial!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Download Button */}
                <Button
                  onClick={handleDownloadFlashcard}
                  disabled={isDownloading}
                  className="w-full"
                  size="lg"
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Descargar Imagen (.PNG)
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {!selectedPromo && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Megaphone className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold text-muted-foreground">
                Selecciona una promoción
              </h3>
              <p className="text-muted-foreground mt-2 max-w-md">
                Elige una promoción activa del dropdown para generar automáticamente 
                el texto de WhatsApp y la imagen para redes sociales.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
