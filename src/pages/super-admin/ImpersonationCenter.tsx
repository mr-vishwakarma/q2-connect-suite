import { useEffect, useState } from 'react';
import {
  UserCheck,
  Building2,
  Users,
  Shield,
  AlertTriangle,
  ArrowRight,
  Clock,
  History,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { superAdminService } from '@/services/api/superAdmin.service';
import { Organization, SaasUserListItem } from '@/types';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

export default function ImpersonationCenter() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [orgUsers, setOrgUsers] = useState<SaasUserListItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      fetchUsersForOrg(selectedOrgId);
    } else {
      setOrgUsers([]);
      setSelectedUserId('');
    }
  }, [selectedOrgId]);

  const fetchOrganizations = async () => {
    try {
      const res = await superAdminService.getOrganizations();
      if (res.success && res.data) {
        const orgList = Array.isArray(res.data) ? res.data : (res.data as any).organizations || [];
        setOrganizations(orgList);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    }
  };

  const fetchUsersForOrg = async (orgId: string) => {
    try {
      setIsUsersLoading(true);
      const res = await superAdminService.getUsers({ limit: 50 });
      if (res.success && res.data) {
        const filtered = (res.data.users || []).filter(
          (u) => u.organization?._id === orgId && u.role !== 'SUPER_ADMIN'
        );
        setOrgUsers(filtered);
        if (filtered.length > 0) {
          setSelectedUserId(filtered[0]._id);
        } else {
          setSelectedUserId('');
        }
      }
    } catch (error) {
      console.error('Failed to load users for organization:', error);
    } finally {
      setIsUsersLoading(false);
    }
  };

  const handleStartImpersonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !selectedUserId || !reason.trim()) {
      toast.error('Please select an organization, user, and provide a valid reason.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await superAdminService.startImpersonation({
        organizationId: selectedOrgId,
        targetUserId: selectedUserId,
        reason: reason.trim(),
      });

      if (res.success && res.data) {
        toast.success('Support impersonation session activated');
        // Store impersonation metadata in session storage for the banner
        sessionStorage.setItem('impersonation_active', 'true');
        sessionStorage.setItem('impersonation_target', JSON.stringify(res.data.user || {}));
        sessionStorage.setItem('impersonation_org', JSON.stringify(res.data.organization || {}));
        
        // Save current super admin token if needed to revert later
        const currentToken = localStorage.getItem('token');
        if (currentToken) {
          sessionStorage.setItem('superadmin_original_token', currentToken);
        }
        
        // Set impersonation token
        if (res.data.token) {
          localStorage.setItem('token', res.data.token);
        }

        // Navigate into tenant manager dashboard
        navigate('/admin/dashboard');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to initialize impersonation session');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Controlled Support Impersonation</h1>
        <p className="text-sm text-muted-foreground">
          Safely troubleshoot tenant issues by assuming user context under strict audit control.
        </p>
      </div>

      {/* Security Warning Notice */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3.5">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <h4 className="font-semibold text-amber-400">Strict Compliance & Auditing Enforced</h4>
          <p className="text-muted-foreground text-xs leading-relaxed">
            All actions executed during an impersonation session are cryptographically tied to both your Super Admin account
            and the target user account. Passwords, secrets, and financial credentials are never exposed. A visible amber support
            banner will persist across the screen.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Launcher Card */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              Launch Support Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleStartImpersonation} className="space-y-4">
              {/* Step 1: Select Organization */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  1. Target Organization (Tenant)
                </label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="">-- Choose Tenant --</option>
                  {organizations.map((org) => (
                    <option key={org._id || org.id} value={org._id || org.id}>
                      {org.name} ({org.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Select User */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  2. Target User / Administrator
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={!selectedOrgId || isUsersLoading}
                  required
                >
                  {isUsersLoading ? (
                    <option>Loading tenant users...</option>
                  ) : orgUsers.length === 0 ? (
                    <option value="">No authorized users found in this tenant</option>
                  ) : (
                    orgUsers.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} — {u.email} ({u.role})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Step 3: Mandatory Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  3. Reason for Impersonation (Mandatory Audit Log)
                </label>
                <Input
                  placeholder="e.g. Investigating room allocation error reported in Ticket #1042"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="bg-secondary"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || !selectedOrgId || !selectedUserId || !reason.trim()}
                className="w-full bg-primary text-primary-foreground font-semibold h-11 mt-2"
              >
                {isLoading ? (
                  'Starting Session...'
                ) : (
                  <>
                    <UserCheck className="w-4 h-4 mr-2" />
                    Enter Tenant Session
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Guardrails Card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              Security Guardrails
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5 text-xs text-muted-foreground">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground block">Zero Privilege Escalation</strong>
                Cannot impersonate another Super Admin account.
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground block">Short Session TTL</strong>
                Impersonation tokens automatically expire after 60 minutes of inactivity.
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground block">One-Click Exit</strong>
                A persistent top banner lets you immediately terminate the session and return to Super Admin.
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground block">Dual Actor Auditing</strong>
                Both original Super Admin ID and target tenant ID are recorded in every mutation audit log.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
