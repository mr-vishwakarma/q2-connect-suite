import { useEffect, useState } from 'react';
import { ToggleLeft, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { superAdminService } from '@/services/api/superAdmin.service';
import { FeatureDefinition } from '@/types';

export default function FeatureCatalog() {
  const [features, setFeatures] = useState<FeatureDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    try {
      setIsLoading(true);
      const res = await superAdminService.getFeatures();
      if (res.success && res.data) {
        setFeatures(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch feature catalog:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Global Feature Catalog</h1>
        <p className="text-sm text-muted-foreground">Standardized feature flags available across tenant subscription tiers.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((feat) => (
          <Card key={feat.key} className="border-border/60 bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold">{feat.name}</CardTitle>
              <Badge variant="outline" className="text-xs uppercase font-mono">{feat.category}</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{feat.description}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[11px] font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                  key: {feat.key}
                </span>
                {feat.defaultEnabled && (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                    Default On
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
