import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Laboratory, WalletLedger, PlanFund } from '@/types/database';
import { getBudgetRulesConfig, isFundSpendable } from '@/hooks/useBudgetRules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Wallet, TrendingUp, TrendingDown, DollarSign, AlertTriangle, Plus, FileText, CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LedgerEntry {
  id: string;
  type: 'ingreso' | 'egreso';
  concept: string;
  amount: number;
  date: string;
  source: string;
  category: 'plan' | 'promo' | 'ajuste';
}

export default function WalletPage() {
  const { toast } = useToast();
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<string>('');
  const [selectedLabName, setSelectedLabName] = useState<string>('');
  
  const [annualBudget, setAnnualBudget] = useState(0);
  const [committedAmount, setCommittedAmount] = useState(0);
  const [adjustmentsPositive, setAdjustmentsPositive] = useState(0);
  const [adjustmentsNegative, setAdjustmentsNegative] = useState(0);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Adjustment modal state
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'ingreso' | 'egreso'>('ingreso');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentDate, setAdjustmentDate] = useState<Date>(new Date());
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchLaboratories();
  }, []);

  useEffect(() => {
    if (selectedLabId) {
      const lab = laboratories.find(l => l.id === selectedLabId);
      setSelectedLabName(lab?.name || '');
      fetchWalletData(selectedLabId);
    } else {
      setAnnualBudget(0);
      setCommittedAmount(0);
      setAdjustmentsPositive(0);
      setAdjustmentsNegative(0);
      setLedgerEntries([]);
    }
  }, [selectedLabId, laboratories]);

  async function fetchLaboratories() {
    const { data, error } = await supabase
      .from('laboratories')
      .select('*')
      .order('name');

    if (!error && data) {
      setLaboratories(data);
    }
  }

  async function fetchWalletData(labId: string) {
    setIsLoading(true);
    
    try {
      // Fetch annual plans for budget
      const { data: plans } = await supabase
        .from('annual_plans')
        .select('*')
        .eq('lab_id', labId);

      // Fetch plan_funds for spendable budget calculation
      const planIds = (plans || []).map(p => p.id);
      let planFunds: PlanFund[] = [];
      if (planIds.length > 0) {
        const { data: fundsData } = await supabase
          .from('plan_funds')
          .select('*')
          .in('plan_id', planIds);
        planFunds = fundsData || [];
      }

      // Fetch promotions for committed amount
      const { data: promos } = await supabase
        .from('promotions')
        .select('*')
        .eq('lab_id', labId)
        .in('status', ['activa', 'borrador', 'revision', 'aprobada']);

      // Fetch wallet adjustments
      const { data: adjustments } = await supabase
        .from('wallet_ledger')
        .select('*')
        .eq('lab_id', labId)
        .eq('transaction_type', 'ajuste_manual')
        .order('transaction_date', { ascending: false });

      // Get budget rules configuration
      const budgetRules = getBudgetRulesConfig();

      // Calculate SPENDABLE budget: only sum funds whose concepts are marked as spendable
      let spendableBudget = 0;
      const planPurchaseGoals: Record<string, number> = {};
      (plans || []).forEach(p => {
        planPurchaseGoals[p.id] = p.total_purchase_goal || 0;
      });

      planFunds.forEach(fund => {
        const isSpendable = isFundSpendable(budgetRules, fund.concept, fund.amount_type);
        if (isSpendable) {
          if (fund.amount_type === 'fijo') {
            spendableBudget += fund.amount_value || 0;
          } else {
            // Percentage: calculate from the plan's purchase goal
            const purchaseGoal = planPurchaseGoals[fund.plan_id] || 0;
            spendableBudget += (purchaseGoal * (fund.amount_value || 0)) / 100;
          }
        }
      });

      const totalCommitted = (promos || []).reduce(
        (sum, promo) => sum + (promo.estimated_cost || 0), 
        0
      );

      // Calculate adjustments (positive amounts = income, negative = expense)
      let positiveAdj = 0;
      let negativeAdj = 0;
      (adjustments || []).forEach(adj => {
        if (adj.amount > 0) {
          positiveAdj += adj.amount;
        } else {
          negativeAdj += Math.abs(adj.amount);
        }
      });

      setAnnualBudget(spendableBudget);
      setCommittedAmount(totalCommitted);
      setAdjustmentsPositive(positiveAdj);
      setAdjustmentsNegative(negativeAdj);

      // Build ledger entries
      const entries: LedgerEntry[] = [];

      // Add income entries from plans
      for (const plan of plans || []) {
        if (plan.total_budget_allocated && plan.total_budget_allocated > 0) {
          entries.push({
            id: `plan-${plan.id}`,
            type: 'ingreso',
            concept: `Plan Anual ${plan.year}: ${plan.name}`,
            amount: plan.total_budget_allocated,
            date: plan.created_at,
            source: 'Plan',
            category: 'plan'
          });
        }
      }

      // Add expense entries from promotions
      for (const promo of promos || []) {
        if (promo.estimated_cost && promo.estimated_cost > 0) {
          entries.push({
            id: `promo-${promo.id}`,
            type: 'egreso',
            concept: promo.title,
            amount: promo.estimated_cost,
            date: promo.created_at,
            source: promo.status,
            category: 'promo'
          });
        }
      }

      // Add adjustment entries
      for (const adj of adjustments || []) {
        entries.push({
          id: `adj-${adj.id}`,
          type: adj.amount > 0 ? 'ingreso' : 'egreso',
          concept: adj.description || 'Ajuste manual',
          amount: Math.abs(adj.amount),
          date: adj.transaction_date,
          source: 'Ajuste',
          category: 'ajuste'
        });
      }

      // Sort by date descending
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setLedgerEntries(entries);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveAdjustment() {
    if (!selectedLabId || !adjustmentReason.trim() || !adjustmentAmount) {
      toast({
        title: 'Campos incompletos',
        description: 'Por favor completa todos los campos',
        variant: 'destructive'
      });
      return;
    }

    setIsSavingAdjustment(true);
    
    try {
      const amount = adjustmentType === 'ingreso' 
        ? Math.abs(parseFloat(adjustmentAmount))
        : -Math.abs(parseFloat(adjustmentAmount));

      const { error } = await supabase
        .from('wallet_ledger')
        .insert({
          lab_id: selectedLabId,
          transaction_type: 'ajuste_manual',
          amount: amount,
          description: adjustmentReason,
          transaction_date: format(adjustmentDate, 'yyyy-MM-dd')
        });

      if (error) throw error;

      toast({
        title: '¡Ajuste guardado!',
        description: 'El movimiento se registró correctamente'
      });

      // Reset form and close modal
      setAdjustmentReason('');
      setAdjustmentAmount('');
      setAdjustmentDate(new Date());
      setIsAdjustmentOpen(false);
      
      // Refresh data
      fetchWalletData(selectedLabId);
    } catch (error) {
      console.error('Error saving adjustment:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el ajuste',
        variant: 'destructive'
      });
    } finally {
      setIsSavingAdjustment(false);
    }
  }

  function handleExportPDF() {
    if (!selectedLabId) return;
    
    setIsExporting(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Estado de Cuenta', pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Laboratorio: ${selectedLabName}`, 14, 35);
      doc.text(`Fecha de emisión: ${format(new Date(), "dd 'de' MMMM, yyyy", { locale: es })}`, 14, 42);
      
      // Divider line
      doc.setDrawColor(200);
      doc.line(14, 48, pageWidth - 14, 48);
      
      // Executive Summary
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumen Ejecutivo', 14, 58);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      
      const summaryData = [
        ['Presupuesto Anual (Planes)', formatCurrency(annualBudget)],
        ['(+) Ajustes Positivos', formatCurrency(adjustmentsPositive)],
        ['(-) Comprometido en Promos', formatCurrency(committedAmount)],
        ['(-) Ajustes Negativos', formatCurrency(adjustmentsNegative)],
        ['= SALDO DISPONIBLE', formatCurrency(availableBalance)]
      ];
      
      autoTable(doc, {
        startY: 62,
        head: [],
        body: summaryData,
        theme: 'plain',
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 60, halign: 'right', fontStyle: 'bold' }
        },
        styles: { fontSize: 11 },
        didParseCell: (data) => {
          if (data.row.index === 4) {
            data.cell.styles.fillColor = availableBalance >= 0 ? [220, 252, 231] : [254, 226, 226];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });
      
      // Divider
      const afterSummaryY = (doc as any).lastAutoTable.finalY + 10;
      doc.line(14, afterSummaryY, pageWidth - 14, afterSummaryY);
      
      // Detail Table
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Detalle de Movimientos', 14, afterSummaryY + 10);
      
      const tableData = ledgerEntries.map(entry => [
        format(new Date(entry.date), 'dd/MM/yyyy'),
        entry.type === 'ingreso' ? 'Ingreso' : 'Egreso',
        entry.concept.length > 40 ? entry.concept.substring(0, 40) + '...' : entry.concept,
        entry.source,
        `${entry.type === 'ingreso' ? '+' : '-'} ${formatCurrency(entry.amount)}`
      ]);
      
      autoTable(doc, {
        startY: afterSummaryY + 14,
        head: [['Fecha', 'Tipo', 'Concepto', 'Origen', 'Monto']],
        body: tableData,
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 20 },
          2: { cellWidth: 70 },
          3: { cellWidth: 25 },
          4: { cellWidth: 35, halign: 'right' }
        },
        styles: { fontSize: 9 },
        didParseCell: (data) => {
          if (data.column.index === 4 && data.section === 'body') {
            const value = data.cell.raw as string;
            if (value.startsWith('+')) {
              data.cell.styles.textColor = [22, 163, 74];
            } else {
              data.cell.styles.textColor = [220, 38, 38];
            }
          }
        }
      });
      
      // Footer
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text('Este documento es un extracto generado automáticamente.', 14, finalY);
      doc.text('Para dudas o aclaraciones, contactar al departamento comercial.', 14, finalY + 5);
      
      // Save
      doc.save(`estado-cuenta-${selectedLabName.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
      toast({
        title: '¡PDF Generado!',
        description: 'El estado de cuenta se descargó correctamente'
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error',
        description: 'No se pudo generar el PDF',
        variant: 'destructive'
      });
    } finally {
      setIsExporting(false);
    }
  }

  // New formula: (Budget + Positive Adjustments) - (Committed + Negative Adjustments)
  const availableBalance = (annualBudget + adjustmentsPositive) - (committedAmount + adjustmentsNegative);
  const isNegativeBalance = availableBalance < 0;
  const totalIncome = annualBudget + adjustmentsPositive;
  const totalExpense = committedAmount + adjustmentsNegative;
  const utilizationPercent = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Wallet className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Billetera y Control de Saldos</h1>
              <p className="text-muted-foreground">
                Control financiero por laboratorio
              </p>
            </div>
          </div>
          
          {selectedLabId && (
            <div className="flex gap-2">
              <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Ajuste
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Ajuste Manual</DialogTitle>
                    <DialogDescription>
                      Nota crédito o débito al saldo del laboratorio
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Tipo de Ajuste</Label>
                      <Select value={adjustmentType} onValueChange={(v) => setAdjustmentType(v as 'ingreso' | 'egreso')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ingreso">
                            <span className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-green-600" />
                              Ingreso Adicional (Suma)
                            </span>
                          </SelectItem>
                          <SelectItem value="egreso">
                            <span className="flex items-center gap-2">
                              <TrendingDown className="h-4 w-4 text-red-600" />
                              Deducción / Glosa (Resta)
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Motivo</Label>
                      <Textarea
                        placeholder="Ej: Apoyo evento ganadero WhatsApp, Glosa factura #123..."
                        value={adjustmentReason}
                        onChange={(e) => setAdjustmentReason(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Valor</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={adjustmentAmount}
                        onChange={(e) => setAdjustmentAmount(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Fecha</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !adjustmentDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {adjustmentDate ? format(adjustmentDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={adjustmentDate}
                            onSelect={(date) => date && setAdjustmentDate(date)}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAdjustmentOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveAdjustment} disabled={isSavingAdjustment}>
                      {isSavingAdjustment && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Guardar Ajuste
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <Button onClick={handleExportPDF} disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Exportar PDF
              </Button>
            </div>
          )}
        </div>

        {/* Lab Selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Seleccionar Laboratorio</CardTitle>
            <CardDescription>
              Elige un laboratorio para ver su estado financiero
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedLabId} onValueChange={setSelectedLabId}>
              <SelectTrigger className="w-full md:w-[400px]">
                <SelectValue placeholder="Seleccionar laboratorio..." />
              </SelectTrigger>
              <SelectContent>
                {laboratories.map((lab) => (
                  <SelectItem key={lab.id} value={lab.id}>
                    {lab.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {!selectedLabId ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Wallet className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold text-muted-foreground">
                Selecciona un laboratorio
              </h3>
              <p className="text-muted-foreground mt-2 max-w-md">
                Elige un laboratorio del dropdown para ver su presupuesto anual,
                el monto comprometido en promociones y el saldo disponible.
              </p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* Card 1: Spendable Budget + Positive Adjustments */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Presupuesto Gastable
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(totalIncome)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Fondos gastables: {formatCurrency(annualBudget)}
                    {adjustmentsPositive > 0 && ` + Ajustes: ${formatCurrency(adjustmentsPositive)}`}
                  </p>
                </CardContent>
              </Card>

              {/* Card 2: Committed + Negative Adjustments */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Comprometido
                  </CardTitle>
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">
                    {formatCurrency(totalExpense)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Promos: {formatCurrency(committedAmount)}
                    {adjustmentsNegative > 0 && ` + Deducciones: ${formatCurrency(adjustmentsNegative)}`}
                  </p>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        utilizationPercent > 90 ? 'bg-destructive' : 
                        utilizationPercent > 70 ? 'bg-amber-500' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Available Balance */}
              <Card className={isNegativeBalance ? 'border-destructive' : ''}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Saldo Disponible
                  </CardTitle>
                  {isNegativeBalance ? (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${
                    isNegativeBalance ? 'text-destructive' : 'text-green-600'
                  }`}>
                    {formatCurrency(availableBalance)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isNegativeBalance 
                      ? '⚠️ Presupuesto excedido' 
                      : 'Disponible para nuevas campañas'
                    }
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Ledger Table */}
            <Card>
              <CardHeader>
                <CardTitle>Extracto de Movimientos</CardTitle>
                <CardDescription>
                  Historial de ingresos, compromisos y ajustes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {ledgerEntries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay movimientos registrados para este laboratorio
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Origen</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(entry.date), 'dd MMM yyyy', { locale: es })}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={entry.type === 'ingreso' ? 'default' : 'destructive'}
                              className={entry.type === 'ingreso' 
                                ? 'bg-green-100 text-green-800 hover:bg-green-100' 
                                : ''
                              }
                            >
                              {entry.type === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium max-w-[300px] truncate">
                            {entry.concept}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "capitalize",
                                entry.category === 'ajuste' && 'border-purple-500 text-purple-700'
                              )}
                            >
                              {entry.source}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${
                            entry.type === 'ingreso' ? 'text-green-600' : 'text-destructive'
                          }`}>
                            {entry.type === 'ingreso' ? '+' : '-'} {formatCurrency(entry.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Warning if over budget */}
            {isNegativeBalance && (
              <Card className="border-destructive bg-destructive/5">
                <CardContent className="flex items-center gap-4 py-4">
                  <AlertTriangle className="h-8 w-8 text-destructive flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-destructive">
                      Presupuesto Excedido
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      El monto comprometido supera el presupuesto disponible 
                      en {formatCurrency(Math.abs(availableBalance))}. 
                      Revisa las promociones activas o solicita ampliación de presupuesto.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
