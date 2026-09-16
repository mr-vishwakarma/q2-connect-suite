import { useEffect, useState, useCallback } from 'react';
import { ShieldAlert, RefreshCw, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { InlineSkeletonList } from '@/components/ui/dashboard-skeleton';
import { superAdminService } from '@/services/api/superAdmin.service';
import { AuditLogItem } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';

export default function AuditLogsView() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [actionFilter, setActionFilter] = useState('ALL');

  const fetchLogs = useCallback(async (targetPage = page) => {
    try {
      setIsLoading(true);
      const params: any = { page: targetPage, limit: 25 };
      if (actionFilter !== 'ALL') params.action = actionFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res = await superAdminService.getAuditLogs(params);
      if (res.success && res.data) {
        if (Array.isArray(res.data)) {
          setLogs(res.data);
          setTotalLogs(res.data.length);
          setTotalPages(1);
        } else if (res.data.logs) {
          setLogs(res.data.logs);
          if (res.data.pagination) {
            setTotalPages(res.data.pagination.totalPages || 1);
            setTotalLogs(res.data.pagination.total || res.data.logs.length);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [actionFilter, debouncedSearch]);

  useEffect(() => {
    fetchLogs(page);
  }, [page, fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform Compliance Audit Logs</h1>
          <p className="text-sm text-muted-foreground">
            Immutable audit trails of critical administrative actions and tenant events ({totalLogs} Total Records).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchLogs(page)} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Logs
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search by actor, action, or entity..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-9 bg-card"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-md bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="ALL">All Actions</option>
          <option value="LOGIN">LOGIN</option>
          <option value="UPDATE_STATUS">UPDATE_STATUS</option>
          <option value="ASSIGN_ROLE">ASSIGN_ROLE</option>
          <option value="CREATE_EXPENSE">CREATE_EXPENSE</option>
          <option value="SECURITY_UNLOCK">SECURITY_UNLOCK</option>
          <option value="REFUND_PAYMENT">REFUND_PAYMENT</option>
        </select>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase border-b border-border/50">
                <tr>
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Actor</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Entity</th>
                  <th className="p-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-6">
                      <InlineSkeletonList rows={5} />
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-sm text-muted-foreground">
                      No compliance audit records found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log._id} className="hover:bg-secondary/20 transition-colors text-xs content-visibility-auto">
                      <td className="p-4 text-muted-foreground font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-4 font-medium text-foreground">
                        {log.actorName || 'System'}
                        <span className="text-[11px] text-muted-foreground block font-mono">{log.actorEmail}</span>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {log.action}
                        </Badge>
                      </td>
                      <td className="p-4 font-medium text-foreground">
                        {log.entityType}
                      </td>
                      <td className="p-4 text-muted-foreground font-mono">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Server-Side Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-border/60 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Showing Page {page} of {totalPages} ({totalLogs} total events)
              </span>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

