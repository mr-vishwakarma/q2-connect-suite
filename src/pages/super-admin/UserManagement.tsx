import { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Search,
  Shield,
  KeyRound,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Building2,
  RefreshCw,
  MoreVertical,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { superAdminService } from '@/services/api/superAdmin.service';
import { SaasUserListItem } from '@/types';
import { toast } from 'react-toastify';

import { useDebounce } from '@/hooks/useDebounce';

export default function UserManagement() {
  const [users, setUsers] = useState<SaasUserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 20 });
  const [selectedUser, setSelectedUser] = useState<SaasUserListItem | null>(null);
  const [newRole, setNewRole] = useState('');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  const fetchUsers = useCallback(async (page = 1, signal?: AbortSignal) => {
    try {
      setIsLoading(true);
      const params: any = { page, limit: 20 };
      if (roleFilter !== 'ALL') params.role = roleFilter;
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'ACTIVE') params.isActive = true;
        if (statusFilter === 'SUSPENDED') params.isActive = false;
        if (statusFilter === 'LOCKED') params.isLocked = true;
      }
      if (debouncedSearch) params.search = debouncedSearch;

      const res = await superAdminService.getUsers(params, { signal });
      if (res.success && res.data) {
        setUsers(res.data.users || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (error: any) {
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') return;
      console.error('Failed to load users:', error);
      toast.error('Failed to load user directory');
    } finally {
      setIsLoading(false);
    }
  }, [roleFilter, statusFilter, debouncedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    fetchUsers(currentPage, controller.signal);
    return () => {
      controller.abort();
    };
  }, [currentPage, fetchUsers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleToggleStatus = async (user: SaasUserListItem) => {
    const action = user.isActive ? 'suspend' : 'activate';
    if (!confirm(`Are you sure you want to ${action} user "${user.name}"?`)) return;

    try {
      const res = await superAdminService.updateUserStatus(user._id, !user.isActive, 'Super Admin manual action');
      if (res.success) {
        toast.success(`User ${action}d successfully`);
        fetchUsers(currentPage);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || `Failed to ${action} user`);
    }
  };

  const handleUnlock = async (user: SaasUserListItem) => {
    try {
      const res = await superAdminService.unlockUserAccount(user._id);
      if (res.success) {
        toast.success(`Account unlocked for "${user.name}"`);
        fetchUsers(currentPage);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to unlock account');
    }
  };

  const handleRevokeSessions = async (user: SaasUserListItem) => {
    if (!confirm(`Force logout and revoke all active sessions for "${user.name}"?`)) return;

    try {
      const res = await superAdminService.revokeUserSessions(user._id);
      if (res.success) {
        toast.success(`Active sessions revoked for "${user.name}"`);
        fetchUsers(currentPage);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to revoke sessions');
    }
  };

  const handleOpenRoleModal = (user: SaasUserListItem) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setIsRoleModalOpen(true);
  };

  const handleSaveRole = async () => {
    if (!selectedUser || !newRole) return;
    try {
      const res = await superAdminService.updateUserRole(selectedUser._id, newRole);
      if (res.success) {
        toast.success(`Role updated to ${newRole} for "${selectedUser.name}"`);
        setIsRoleModalOpen(false);
        fetchUsers(currentPage);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update role');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Global User Directory</h1>
          <p className="text-sm text-muted-foreground">Manage user accounts, RBAC roles, security lockouts, and sessions across all tenants.</p>
        </div>
        <Button onClick={() => fetchUsers(currentPage)} variant="outline" size="sm" className="self-start sm:self-auto">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or username..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 bg-card"
          />
        </form>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 px-3 rounded-md bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="admin">Hostel Admin</option>
            <option value="ORGANIZATION_OWNER">Organization Owner</option>
            <option value="warden">Warden</option>
            <option value="student">Student</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 px-3 rounded-md bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="LOCKED">Security Locked</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
              <tr>
                <th className="px-5 py-3.5">User Details</th>
                <th className="px-5 py-3.5">Assigned Role</th>
                <th className="px-5 py-3.5">Tenant Organization</th>
                <th className="px-5 py-3.5">Account Status</th>
                <th className="px-5 py-3.5">Created & Last Active</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      Loading global users...
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                    <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-60" />
                    No users found matching your filters.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-foreground">{user.name}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                      {user.username && (
                        <div className="text-xs font-mono text-muted-foreground">@{user.username}</div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        variant="outline"
                        className={
                          user.role === 'SUPER_ADMIN'
                            ? 'border-red-500/40 text-red-400 bg-red-500/10'
                            : user.role === 'admin' || user.role === 'ORGANIZATION_OWNER'
                            ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                            : user.role === 'warden'
                            ? 'border-blue-500/40 text-blue-400 bg-blue-500/10'
                            : 'border-zinc-500/40 text-zinc-400 bg-zinc-500/10'
                        }
                      >
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-foreground">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium">
                          {user.organization?.name || 'Platform Level'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant="outline"
                          className={
                            user.isActive
                              ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 w-fit'
                              : 'border-red-500/30 text-red-400 bg-red-500/10 w-fit'
                          }
                        >
                          {user.isActive ? 'Active' : 'Suspended'}
                        </Badge>
                        {user.isLocked && (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 w-fit">
                            <Lock className="w-3 h-3 mr-1" /> Locked
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      <div>Created: {new Date(user.createdAt).toLocaleDateString()}</div>
                      {user.lastLogin && <div>Last: {new Date(user.lastLogin).toLocaleDateString()}</div>}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {user.isLocked && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                            onClick={() => handleUnlock(user)}
                            title="Unlock locked account"
                          >
                            <Unlock className="w-3.5 h-3.5 mr-1" /> Unlock
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => handleOpenRoleModal(user)}
                          title="Change Role"
                        >
                          Role
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => handleRevokeSessions(user)}
                          title="Force logout all sessions"
                        >
                          Revoke
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={`h-8 ${user.isActive ? 'text-red-400 hover:bg-red-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}
                          onClick={() => handleToggleStatus(user)}
                        >
                          {user.isActive ? 'Suspend' : 'Activate'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="px-5 py-4 border-t border-border flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Showing Page {currentPage} of {pagination.totalPages} ({pagination.total} users)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= pagination.totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Role Change Modal */}
      {isRoleModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-lg text-foreground">Change User Role</h3>
              <button
                onClick={() => setIsRoleModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Update authoritative RBAC role for <strong className="text-foreground">{selectedUser.name}</strong> ({selectedUser.email}).
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Target Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="student">student (Resident)</option>
                <option value="warden">warden (Hostel Staff)</option>
                <option value="admin">admin (Hostel Manager)</option>
                <option value="ORGANIZATION_OWNER">ORGANIZATION_OWNER (Tenant Owner)</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN (Platform Control Plane)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsRoleModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRole} className="bg-primary text-primary-foreground">
                Save Role
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
