import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  Ban,
  CheckCircle2,
  GitFork,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { OnboardTenantModal } from '@/components/super-admin/OnboardTenantModal';
import { superAdminService } from '@/services/api/superAdmin.service';
import { Organization } from '@/types';
import { toast } from 'react-toastify';

export default function OrganizationList() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [suspendTargetOrg, setSuspendTargetOrg] = useState<Organization | null>(null);
  const [isSuspendingAction, setIsSuspendingAction] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setIsLoading(true);
      const res = await superAdminService.getOrganizations();
      if (res.success && res.data) {
        if (Array.isArray(res.data)) {
          setOrganizations(res.data);
        } else if (Array.isArray((res.data as any).organizations)) {
          setOrganizations((res.data as any).organizations);
        }
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSuspendToggle = async () => {
    if (!suspendTargetOrg) return;
    const isSuspending = suspendTargetOrg.status !== 'SUSPENDED';
    try {
      setIsSuspendingAction(true);
      const res = await superAdminService.suspendOrganization(suspendTargetOrg._id || suspendTargetOrg.id, isSuspending);
      if (res.success) {
        toast.success(`Organization '${suspendTargetOrg.name}' ${isSuspending ? 'suspended' : 'activated'} successfully`);
        setSuspendTargetOrg(null);
        fetchOrganizations();
      }
    } catch (error) {
      toast.error('Failed to update organization status');
    } finally {
      setIsSuspendingAction(false);
    }
  };

  const filteredOrgs = organizations.filter((o) => {
    const matchesSearch =
      o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.contactEmail.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Organizations (Tenants)</h1>
          <p className="text-sm text-muted-foreground">Manage tenant companies, branches, subscriptions and isolation.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
          <Plus className="w-4 h-4 mr-2" />
          Onboard New Tenant
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search by name, slug or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>

        <div className="w-full sm:w-48">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-card">
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="TRIAL">Trial</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Organizations Table Card */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase border-b border-border/50">
                <tr>
                  <th className="p-4">Organization</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Branches</th>
                  <th className="p-4">Students</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredOrgs.map((org) => {
                  const orgId = org._id || org.id;
                  return (
                    <tr key={orgId} className="hover:bg-secondary/20 transition-colors content-visibility-auto">
                      <td className="p-4 font-medium text-foreground">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-amber-500">
                            {org.name.charAt(0)}
                          </div>
                          <div>
                            <span className="block font-semibold">{org.name}</span>
                            <span className="text-xs text-muted-foreground font-mono">/{org.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant="outline"
                          className={
                            org.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : org.status === 'TRIAL'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-destructive/10 text-destructive border-destructive/30'
                          }
                        >
                          {org.status}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                          <GitFork className="w-3.5 h-3.5 text-blue-400" />
                          <span>{org.hostelCount ?? 1}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                          <Users className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{org.studentCount ?? 0}</span>
                        </div>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">
                        <p>{org.contactEmail}</p>
                        <p>{org.phone || '--'}</p>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/super-admin/organizations/${orgId}`}>
                              <ExternalLink className="w-3.5 h-3.5 mr-1" />
                              Manage
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSuspendTargetOrg(org)}
                            className={org.status === 'SUSPENDED' ? 'text-emerald-400 hover:text-emerald-300' : 'text-destructive hover:text-destructive/80'}
                            title={org.status === 'SUSPENDED' ? 'Activate Organization' : 'Suspend Organization'}
                          >
                            {org.status === 'SUSPENDED' ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog for Tenant Suspension / Activation */}
      <AlertDialog open={!!suspendTargetOrg} onOpenChange={(open) => !open && setSuspendTargetOrg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                suspendTargetOrg?.status === 'SUSPENDED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-destructive/10 text-destructive'
              }`}>
                {suspendTargetOrg?.status === 'SUSPENDED' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <AlertDialogTitle>
                {suspendTargetOrg?.status === 'SUSPENDED'
                  ? `Activate "${suspendTargetOrg?.name}"?`
                  : `Suspend "${suspendTargetOrg?.name}"?`}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-2 text-sm">
              {suspendTargetOrg?.status === 'SUSPENDED' ? (
                <>
                  Activating this organization will restore portal access for its administrators, wardens, and students across all registered branches.
                </>
              ) : (
                <>
                  <strong className="text-destructive font-semibold">Critical Impact:</strong> Suspending this organization will immediately invalidate all active user sessions and refresh tokens. No students, staff, or administrators from this tenant will be allowed to log in until reactivated.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSuspendingAction}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSuspendToggle}
              disabled={isSuspendingAction}
              className={
                suspendTargetOrg?.status === 'SUSPENDED'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
              }
            >
              {isSuspendingAction
                ? 'Processing...'
                : suspendTargetOrg?.status === 'SUSPENDED'
                ? 'Yes, Activate Organization'
                : 'Yes, Suspend Organization'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Real-world Multi-Stage Onboarding Wizard Modal */}
      <OnboardTenantModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={fetchOrganizations}
      />
    </div>
  );
}
