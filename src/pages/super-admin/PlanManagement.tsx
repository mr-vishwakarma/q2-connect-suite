import { useEffect, useState } from 'react';
import { CreditCard, Check, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { superAdminService } from '@/services/api/superAdmin.service';
import { SubscriptionPlan } from '@/types';

export default function PlanManagement() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setIsLoading(true);
      const res = await superAdminService.getPlans();
      if (res.success && res.data) {
        setPlans(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscription Plans & Limits</h1>
          <p className="text-sm text-muted-foreground">Manage SaaS pricing tiers, student capacity limits, and feature packages.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card
            key={plan._id || plan.id}
            className={`border flex flex-col justify-between ${
              plan.isPopular
                ? 'border-amber-500/60 shadow-lg shadow-amber-500/5 bg-gradient-to-b from-card to-amber-500/5'
                : 'border-border/60'
            }`}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold">{plan.name}</CardTitle>
                {plan.isPopular && <Badge className="bg-amber-500 text-black font-bold text-[10px]">MOST POPULAR</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
              <div className="pt-4">
                <span className="text-3xl font-black text-foreground">₹{plan.priceMonthly.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground"> / month</span>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-secondary/40 border border-border/50 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Students:</span>
                  <span className="font-bold text-foreground">{plan.limits?.maxStudents || 100}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Rooms:</span>
                  <span className="font-bold text-foreground">{plan.limits?.maxRooms || 50}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Hostels:</span>
                  <span className="font-bold text-foreground">{plan.limits?.maxHostels || 1}</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Included Modules:</span>
                <ul className="space-y-1 text-xs">
                  {plan.includedFeatures?.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-foreground">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{f.replace(/_/g, ' ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>

            <CardFooter className="pt-4 border-t border-border/50">
              <Button variant="outline" className="w-full text-xs">
                Edit Plan Limits
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
