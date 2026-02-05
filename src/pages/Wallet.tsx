import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Laboratory, AnnualPlan, Promotion } from '@/types/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Wallet, TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface LedgerEntry {
  id: string;
  type: 'ingreso' | 'egreso';
  concept: string;
  amount: number;
  date: string;
  source: string;
}

export default function WalletPage() {
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<string>('');
  
  const [annualBudget, setAnnualBudget] = useState(0);
  const [committedAmount, setCommittedAmount] = useState(0);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchLaboratories();
  }, []);

  useEffect(() => {
    if (selectedLabId) {
      fetchWalletData(selectedLabId);
    } else {
      setAnnualBudget(0);
      setCommittedAmount(0);
      setLedgerEntries([]);
    }
  }, [selectedLabId]);

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
      const { data: plans, error: plansError } = await supabase
        .from('annual_plans')
        .select('*')
        .eq('lab_id', labId);

      if (plansError) {
        console.error('Error fetching plans:', plansError);
      }

      // Fetch promotions for committed amount
      const { data: promos, error: promosError } = await supabase
        .from('promotions')
        .select('*')
        .eq('lab_id', labId)
        .in('status', ['activa', 'borrador', 'revision', 'aprobada']);

      if (promosError) {
        console.error('Error fetching promos:', promosError);
      }

      // Calculate totals
      const totalBudget = (plans || []).reduce(
        (sum, plan) => sum + (plan.total_budget_allocated || 0), 
        0
      );
      
      const totalCommitted = (promos || []).reduce(
        (sum, promo) => sum + (promo.estimated_cost || 0), 
        0
      );

      setAnnualBudget(totalBudget);
      setCommittedAmount(totalCommitted);

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
            source: 'Plan'
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
            source: promo.status
          });
        }
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

  const availableBalance = annualBudget - committedAmount;
  const isNegativeBalance = availableBalance < 0;
  const utilizationPercent = annualBudget > 0 ? (committedAmount / annualBudget) * 100 : 0;

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
        <div className="flex items-center gap-3">
          <Wallet className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Billetera y Control de Saldos</h1>
            <p className="text-muted-foreground">
              Control financiero por laboratorio
            </p>
          </div>
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
          /* Empty State */
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* Card 1: Annual Budget */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Presupuesto Anual
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(annualBudget)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total asignado en planes activos
                  </p>
                </CardContent>
              </Card>

              {/* Card 2: Committed Amount */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Comprometido en Promos
                  </CardTitle>
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">
                    {formatCurrency(committedAmount)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {utilizationPercent.toFixed(1)}% del presupuesto utilizado
                  </p>
                  {/* Progress bar */}
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
                  Historial de ingresos y compromisos
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
                        <TableHead>Estado</TableHead>
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
                            <Badge variant="outline" className="capitalize">
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
                      El monto comprometido en promociones supera el presupuesto asignado 
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
