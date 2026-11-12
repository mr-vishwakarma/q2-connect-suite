import { useEffect, useState, useMemo } from 'react';
import {
  ToggleLeft,
  CheckCircle,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  Trash2,
  Layers,
  Sparkles,
  ShieldAlert,
  Loader2,
  Check,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { superAdminService } from '@/services/api/superAdmin.service';
import { FeatureDefinition } from '@/types';
import { toast } from 'react-toastify';
import { getErrorMessage } from '@/utils/errorHandling';

type CategoryFilter = 'all' | 'core' | 'operations' | 'finance' | 'advanced';

export default function FeatureCatalog() {
  const [features, setFeatures] = useState<FeatureDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [isSeeding, setIsSeeding] = useState(false);

  // Dialog state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<FeatureDefinition | null>(null);
  const [deletingFeature, setDeletingFeature] = useState<FeatureDefinition | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    key: '',
    category: 'core' as 'core' | 'operations' | 'finance' | 'advanced',
    description: '',
    defaultEnabled: true,
  });

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await superAdminService.getFeatures();
      if (res.success && res.data) {
        setFeatures(res.data);
      } else {
        setFeatures([]);
      }
    } catch (err: unknown) {
      console.error('Failed to fetch feature catalog:', err);
      setError(getErrorMessage(err, 'Failed to load feature catalog'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedDefaults = async () => {
    try {
      setIsSeeding(true);
      const res = await superAdminService.seedDefaultFeatures();
      if (res.success && res.data) {
        setFeatures(res.data);
        toast.success(`Standard feature catalog initialized with ${res.data.length} modules`);
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to initialize default features'));
    } finally {
      setIsSeeding(false);
    }
  };

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      key: '',
      category: 'core',
      description: '',
      defaultEnabled: true,
    });
    setIsAddOpen(true);
  };

  const handleOpenEdit = (feat: FeatureDefinition) => {
    setEditingFeature(feat);
    setFormData({
      name: feat.name,
      key: feat.key,
      category: feat.category,
      description: feat.description || '',
      defaultEnabled: feat.defaultEnabled,
    });
  };

  const handleNameChange = (name: string) => {
    if (isAddOpen) {
      const generatedKey = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      setFormData((prev) => ({ ...prev, name, key: generatedKey }));
    } else {
      setFormData((prev) => ({ ...prev, name }));
    }
  };

  const handleSaveFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      if (editingFeature) {
        const id = editingFeature._id || editingFeature.id || editingFeature.key;
        const res = await superAdminService.updateFeature(id, {
          name: formData.name,
          category: formData.category,
          description: formData.description,
          defaultEnabled: formData.defaultEnabled,
        });
        if (res.success) {
          toast.success(`Feature '${formData.name}' updated successfully`);
          setEditingFeature(null);
          fetchFeatures();
        }
      } else {
        const res = await superAdminService.createFeature({
          name: formData.name,
          key: formData.key,
          category: formData.category,
          description: formData.description,
          defaultEnabled: formData.defaultEnabled,
        });
        if (res.success) {
          toast.success(`Feature '${formData.name}' created successfully`);
          setIsAddOpen(false);
          fetchFeatures();
        }
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to save feature'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleDefault = async (feat: FeatureDefinition) => {
    const id = feat._id || feat.id || feat.key;
    const nextVal = !feat.defaultEnabled;
    try {
      // Optimistic update
      setFeatures((prev) =>
        prev.map((f) => (f.key === feat.key ? { ...f, defaultEnabled: nextVal } : f))
      );
      await superAdminService.toggleFeature(id, nextVal);
      toast.success(`${feat.name} default status is now ${nextVal ? 'Enabled' : 'Disabled'}`);
    } catch (err: unknown) {
      // Rollback
      setFeatures((prev) =>
        prev.map((f) => (f.key === feat.key ? { ...f, defaultEnabled: !nextVal } : f))
      );
      toast.error(getErrorMessage(err, 'Failed to toggle feature status'));
    }
  };

  const handleDeleteFeature = async () => {
    if (!deletingFeature) return;
    const id = deletingFeature._id || deletingFeature.id || deletingFeature.key;
    try {
      setIsSubmitting(true);
      await superAdminService.deleteFeature(id);
      toast.success(`Feature '${deletingFeature.name}' removed from catalog`);
      setDeletingFeature(null);
      fetchFeatures();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to delete feature'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFeatures = useMemo(() => {
    return features.filter((feat) => {
      const matchesCategory = selectedCategory === 'all' || feat.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        feat.name.toLowerCase().includes(q) ||
        feat.key.toLowerCase().includes(q) ||
        (feat.description && feat.description.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [features, selectedCategory, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: features.length,
      core: features.filter((f) => f.category === 'core').length,
      operations: features.filter((f) => f.category === 'operations').length,
      finance: features.filter((f) => f.category === 'finance').length,
      advanced: features.filter((f) => f.category === 'advanced').length,
    };
  }, [features]);

  const categoryColor = (cat: string) => {
    switch (cat) {
      case 'core':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'operations':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'finance':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'advanced':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-secondary text-muted-foreground border-border';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Global Feature Catalog</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Standardized feature flags and modular capabilities available across tenant subscription tiers.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFeatures}
            disabled={isLoading}
            className="h-9 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="h-9 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Feature
          </Button>
        </div>
      </div>

      {/* Summary Stat Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="p-3 rounded-xl bg-card border border-border/60">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Total Modules</span>
          <span className="text-lg sm:text-xl font-bold text-foreground mt-0.5 block">{counts.all}</span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border/60">
          <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider block">Core Suite</span>
          <span className="text-lg sm:text-xl font-bold text-blue-400 mt-0.5 block">{counts.core}</span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border/60">
          <span className="text-[11px] font-medium text-purple-400 uppercase tracking-wider block">Operations</span>
          <span className="text-lg sm:text-xl font-bold text-purple-400 mt-0.5 block">{counts.operations}</span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border/60">
          <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider block">Finance</span>
          <span className="text-lg sm:text-xl font-bold text-emerald-400 mt-0.5 block">{counts.finance}</span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border/60 col-span-2 sm:col-span-1">
          <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider block">Advanced / AI</span>
          <span className="text-lg sm:text-xl font-bold text-amber-400 mt-0.5 block">{counts.advanced}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/60">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search features by name, key, or capability..."
            className="pl-9 h-9 text-xs bg-background/50 border-border/70"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
          {(['all', 'core', 'operations', 'finance', 'advanced'] as CategoryFilter[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap capitalize ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-black font-semibold shadow-sm'
                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              {cat} ({counts[cat]})
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-between gap-3 text-destructive">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span className="text-xs sm:text-sm font-medium">{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchFeatures} className="text-xs h-8">
            Retry
          </Button>
        </div>
      )}

      {/* Loading Skeleton Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div key={idx} className="p-4 rounded-xl bg-card border border-border/60 animate-pulse space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-4 bg-muted rounded w-16" />
              </div>
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-5/6" />
              <div className="pt-2 flex items-center justify-between">
                <div className="h-5 bg-muted rounded w-24" />
                <div className="h-5 bg-muted rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredFeatures.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 px-4 border border-dashed border-border/80 rounded-2xl bg-card/40">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            {features.length === 0 ? 'No Feature Modules In Catalog' : 'No Matching Features Found'}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            {features.length === 0
              ? 'Your feature catalog database has not been initialized yet. Seed standard SaaS features to enable tenant plan provisioning.'
              : `No features match your search "${searchQuery}" in category "${selectedCategory}". Try clearing your filters.`}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {features.length === 0 ? (
              <Button
                onClick={handleSeedDefaults}
                disabled={isSeeding}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs h-9"
              >
                {isSeeding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Initializing Catalog...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Initialize Standard Feature Catalog
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="text-xs"
              >
                Clear Filters
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleOpenAdd} className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Create Custom Feature
            </Button>
          </div>
        </div>
      ) : (
        /* Feature Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFeatures.map((feat) => {
            const id = feat._id || feat.id || feat.key;
            return (
              <Card
                key={feat.key}
                className="border-border/60 bg-card hover:border-amber-500/40 transition-all duration-200 flex flex-col justify-between group shadow-sm"
              >
                <CardHeader className="pb-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm sm:text-base font-bold text-foreground leading-snug">
                      {feat.name}
                    </CardTitle>
                    <Badge variant="outline" className={`text-[10px] font-mono uppercase shrink-0 ${categoryColor(feat.category)}`}>
                      {feat.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {feat.description || 'No description provided.'}
                  </p>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                    <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 truncate">
                      {feat.key}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleToggleDefault(feat)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5 ${
                        feat.defaultEnabled
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
                      }`}
                      title="Toggle whether newly registered organizations receive this feature by default"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${feat.defaultEnabled ? 'bg-emerald-400' : 'bg-muted-foreground'}`} />
                      {feat.defaultEnabled ? 'Default On' : 'Default Off'}
                    </button>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(feat)}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingFeature(feat)}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Feature Modal */}
      <Dialog
        open={isAddOpen || !!editingFeature}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setEditingFeature(null);
          }
        }}
      >
        <DialogContent className="max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle>{editingFeature ? 'Edit Feature Definition' : 'Register New Feature Flag'}</DialogTitle>
            <DialogDescription>
              {editingFeature
                ? 'Update module display metadata and default tenant onboarding status.'
                : 'Define a standardized feature flag that can be bundled into subscription tiers.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveFeature} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="featName" className="text-xs">Feature Display Name</Label>
              <Input
                id="featName"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Visitor Pass Management"
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="featKey" className="text-xs">System Feature Key (Unique identifier)</Label>
              <Input
                id="featKey"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                placeholder="e.g. visitor_management"
                disabled={!!editingFeature}
                required
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="featCategory" className="text-xs">Operational Category</Label>
              <select
                id="featCategory"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as FeatureDefinition['category'] })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="core">Core (Essential hostel management)</option>
                <option value="operations">Operations (Mess, laundry, passes)</option>
                <option value="finance">Finance (Fee matrix, expenses, deposits)</option>
                <option value="advanced">Advanced (AI, biometric, API access)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="featDesc" className="text-xs">Description</Label>
              <Textarea
                id="featDesc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief summary of what this module provides to hostel operators..."
                rows={3}
                className="text-xs resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="featDefault"
                type="checkbox"
                checked={formData.defaultEnabled}
                onChange={(e) => setFormData({ ...formData, defaultEnabled: e.target.checked })}
                className="w-4 h-4 rounded border-border text-amber-500 focus:ring-amber-500"
              />
              <Label htmlFor="featDefault" className="text-xs cursor-pointer">
                Enable by default for newly onboarded tenants
              </Label>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddOpen(false);
                  setEditingFeature(null);
                }}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...
                  </>
                ) : editingFeature ? (
                  'Update Feature'
                ) : (
                  'Create Feature'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog
        open={!!deletingFeature}
        onOpenChange={(open) => !open && setDeletingFeature(null)}
      >
        <AlertDialogContent className="max-w-md w-[95vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Feature Module</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold text-foreground">"{deletingFeature?.name}"</span>?
              This removes the feature flag definition from the platform catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting} className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFeature}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold"
            >
              {isSubmitting ? 'Deleting...' : 'Delete Feature'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
