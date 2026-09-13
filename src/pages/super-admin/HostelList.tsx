import { useEffect, useState } from 'react';
import {
  GitFork,
  Search,
  Building2,
  Users,
  Bed,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  MapPin,
  Phone,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { superAdminService } from '@/services/api/superAdmin.service';
import { HostelMetricsData } from '@/types';
import { toast } from 'react-toastify';

export default function HostelList() {
  const [hostels, setHostels] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<HostelMetricsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 20 });

  useEffect(() => {
    fetchMetrics();
  }, []);

  useEffect(() => {
    fetchHostels(currentPage);
  }, [currentPage, statusFilter, genderFilter]);

  const fetchMetrics = async () => {
    try {
      const res = await superAdminService.getHostelMetrics();
      if (res.success && res.data) {
        setMetrics(res.data);
      }
    } catch (error) {
      console.error('Failed to load hostel metrics:', error);
    }
  };

  const fetchHostels = async (page = 1) => {
    try {
      setIsLoading(true);
      const params: any = { page, limit: 20 };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (genderFilter !== 'ALL') params.genderType = genderFilter;
      if (searchTerm) params.search = searchTerm;

      const res = await superAdminService.getHostels(params);
      if (res.success && res.data) {
        if (Array.isArray(res.data)) {
          setHostels(res.data);
          setPagination({ total: res.data.length, totalPages: 1, limit: 20 });
        } else {
          setHostels(res.data.hostels || []);
          if (res.data.pagination) {
            setPagination(res.data.pagination);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load hostels:', error);
      toast.error('Failed to load hostels');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchHostels(1);
  };

  const filteredHostels = hostels.filter((h) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (h.name && h.name.toLowerCase().includes(term)) ||
      (h.code && h.code.toLowerCase().includes(term)) ||
      (h.organizationId?.name && h.organizationId.name.toLowerCase().includes(term)) ||
      (h.address && h.address.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Global Hostel Directory</h1>
          <p className="text-sm text-muted-foreground">Cross-tenant hostel properties, capacity metrics, and occupancy tracking.</p>
        </div>
        <Button
          onClick={() => {
            fetchMetrics();
            fetchHostels(currentPage);
          }}
          variant="outline"
          size="sm"
          className="self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Properties</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{metrics?.totalHostels ?? '--'}</h3>
              <p className="text-xs text-emerald-500 font-medium mt-1">
                {metrics?.activeHostels ?? 0} Active Properties
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <GitFork className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Global Capacity</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{metrics?.totalCapacity ?? '--'}</h3>
              <p className="text-xs text-muted-foreground mt-1">Total registered beds</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
              <Bed className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Occupancy</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {metrics ? `${metrics.overallOccupancyRate}%` : '--'}
              </h3>
              <p className="text-xs text-amber-500 font-medium mt-1">
                {metrics?.totalOccupied ?? 0} Beds Occupied
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vacant Beds</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{metrics?.totalVacant ?? '--'}</h3>
              <p className="text-xs text-emerald-500 font-medium mt-1">Available for allotment</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search hostels by name, code, tenant or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card"
          />
        </form>

        <div className="flex items-center gap-2">
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="h-10 px-3 rounded-md bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Types</option>
            <option value="BOYS">Boys</option>
            <option value="GIRLS">Girls</option>
            <option value="COED">Co-Ed</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-md bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Hostels Table */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
              <tr>
                <th className="px-5 py-3.5">Hostel Property</th>
                <th className="px-5 py-3.5">Tenant Organization</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Capacity & Occupancy</th>
                <th className="px-5 py-3.5">Location & Contact</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      Loading global hostel directory...
                    </div>
                  </td>
                </tr>
              ) : filteredHostels.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-60" />
                    No hostels found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredHostels.map((hostel) => {
                  const capacity = hostel.capacity || 0;
                  const occupied = hostel.occupiedCount || 0;
                  const occupancyPercent = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;

                  return (
                    <tr key={hostel._id || hostel.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-foreground">{hostel.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">Code: {hostel.code || 'N/A'}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-foreground">
                            {hostel.organizationId?.name || 'Independent / Unlinked'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge
                          variant="outline"
                          className={
                            hostel.genderType === 'GIRLS'
                              ? 'border-pink-500/30 text-pink-400 bg-pink-500/10'
                              : hostel.genderType === 'BOYS'
                              ? 'border-blue-500/30 text-blue-400 bg-blue-500/10'
                              : 'border-purple-500/30 text-purple-400 bg-purple-500/10'
                          }
                        >
                          {hostel.genderType || 'COED'}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1.5 min-w-[140px]">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {occupied} / {capacity} Beds
                            </span>
                            <span className="font-medium text-foreground">{occupancyPercent}%</span>
                          </div>
                          <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                occupancyPercent > 90
                                  ? 'bg-red-500'
                                  : occupancyPercent > 70
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${occupancyPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs space-y-1">
                          {hostel.address && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[180px]">{hostel.address}</span>
                            </div>
                          )}
                          {hostel.contactPhone && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Phone className="w-3.5 h-3.5 shrink-0" />
                              <span>{hostel.contactPhone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge
                          variant="outline"
                          className={
                            hostel.status === 'ACTIVE'
                              ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                              : 'border-zinc-500/30 text-zinc-400 bg-zinc-500/10'
                          }
                        >
                          {hostel.status || 'ACTIVE'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="px-5 py-4 border-t border-border flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Showing Page {currentPage} of {pagination.totalPages} ({pagination.total} total)
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
    </div>
  );
}
